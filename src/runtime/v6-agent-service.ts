import type {
  NativeBackendFactory, NativeBudgets, NativeCommand, NativeExecution, NativePublicObservation,
  NativeRuntimeSnapshot, NativeRuntimeYield, NativeV6Backend,
} from '../logos-engine/v6-native-types.ts';
import { NativeEditRejected } from '../logos-engine/v6-native-types.ts';
import { compileRecoveryPack } from '../sic/active-recovery.ts';
import {
  nativeV6Action, validateV6PublicObservation, v6FrameHash, V6AgentError, V6_REFERENCE_COMMIT,
} from './v6-agent-protocol.ts';
import type {
  V6AgentOperation, V6AgentResult, V6BackendSnapshot, V6Budgets, V6Command, V6PublicObservation, V6Ticket,
} from './v6-agent-protocol.ts';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function integer(value: unknown, minimum: number, maximum: number, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new V6AgentError('invalid', `Invalid ${name}.`);
  return value;
}

function budgets(value: V6Budgets): NativeBudgets {
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !['targetLevels', 'levelActionCaps', 'maxActions'].includes(key))) {
    throw new V6AgentError('invalid', 'Malformed native solver budgets.');
  }
  const targetLevels = integer(value.targetLevels, 1, 1000, 'target level count');
  if (!Array.isArray(value.levelActionCaps) || value.levelActionCaps.length !== targetLevels) throw new V6AgentError('invalid', 'An explicit action cap is required for every target level.');
  const caps = value.levelActionCaps.map(cap => integer(cap, 1, 100_000, 'per-level action cap'));
  const total = caps.reduce((sum, cap) => sum + cap, 0);
  const maxActions = value.maxActions === undefined ? total : Math.min(total, integer(value.maxActions, 1, 1_000_000, 'total action cap'));
  return freeze({ targetLevels, levelActionCaps: caps, maxActions });
}

async function nativeObservation(packet: V6PublicObservation): Promise<NativePublicObservation> {
  return freeze({
    frame_rows: packet.frame, frame_packet: packet.frames, level: packet.level,
    levels_completed: packet.levelsCompleted, state: packet.state, step_index: packet.stepIndex,
    available_action_refs: packet.availableActionIds.map(id => `ACTION${id}`), frame_hash: await v6FrameHash(packet.frame),
  });
}

function commandFromNative(command: NativeCommand): V6Command {
  const candidate = { actionRef: command.action_ref, data: { ...command.data } };
  nativeV6Action(candidate);
  return freeze(candidate);
}

/**
 * Native worker protocol. It owns one immutable public observation and one
 * outstanding authorization; it never receives a native game or simulator.
 */
export class V6AgentService {
  private readonly factory: NativeBackendFactory;
  private backend: NativeV6Backend | null = null;
  private sessionId: string | null = null;
  private sequence = 0;
  private current: NativePublicObservation | null = null;
  private result: V6AgentResult | null = null;
  private pending: { ticket: V6Ticket; command: NativeCommand } | null = null;
  private usedTickets = new Set<string>();
  private issuedTickets = 0;
  private busy = false;
  private closed = false;
  // Keys belong to the backend; values are detached, deeply frozen public
  // copies. Weak ownership follows the backend's bounded trace/prefix lifetime.
  private snapshotCopies = new WeakMap<object, unknown>();
  private immutableSnapshotBranches = new WeakSet<object>();

  constructor(factory: NativeBackendFactory) { this.factory = factory; }

  private execution(signal?: AbortSignal): NativeExecution {
    return {
      signal,
      yieldControl: () => new Promise<void>(resolve => setTimeout(resolve, 0)),
    };
  }

  private checkSignal(signal?: AbortSignal): void {
    if (signal?.aborted) throw new V6AgentError('cancelled', 'The native solver session was cancelled.');
  }

  private immutableSnapshotBranch(value: unknown, visiting = new Set<object>()): boolean {
    if (value === null || typeof value !== 'object') return typeof value !== 'function' && typeof value !== 'symbol';
    if (this.immutableSnapshotBranches.has(value)) return true;
    if (!Object.isFrozen(value) || visiting.has(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !(Array.isArray(value) && prototype === Array.prototype)) return false;
    visiting.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      // Frozen accessors can still change their return value. Exotic objects
      // (including frozen Map/Set/Date) likewise retain mutable internal state.
      if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value') || !this.immutableSnapshotBranch(descriptor.value, visiting)) {
        visiting.delete(value); return false;
      }
    }
    visiting.delete(value);
    this.immutableSnapshotBranches.add(value);
    return true;
  }

  private copySnapshotBranch<T>(value: T): T {
    if (value !== null && typeof value === 'object' && this.snapshotCopies.has(value)) return this.snapshotCopies.get(value) as T;
    const reusable = this.immutableSnapshotBranch(value);
    const copied = freeze(structuredClone(value));
    if (reusable && value !== null && typeof value === 'object') this.snapshotCopies.set(value, copied);
    return copied;
  }

  private snapshot(value: NativeRuntimeSnapshot): V6BackendSnapshot {
    if (!this.backend || !this.current || value.sourceCommit !== this.backend.sourceCommit || value.sourceDigest !== this.backend.sourceDigest
      || value.actions !== this.sequence || value.level !== this.current.level || value.levelsCompleted !== this.current.levels_completed
      || typeof value.activeSeconds !== 'number' || !Number.isFinite(value.activeSeconds) || value.activeSeconds < 0 || !Array.isArray(value.trace)) {
      throw new V6AgentError('invalid', 'Native solver state does not bind the acquired public observation.');
    }
    for (const name of ['cycles', 'nodeCount', 'hypothesisCount', 'compositionCount'] as const) {
      if (value[name] !== null) integer(value[name], 0, Number.MAX_SAFE_INTEGER, name);
    }
    if (value.graphChain !== undefined && (typeof value.graphChain !== 'string' || !/^[a-f0-9]{64}$/.test(value.graphChain)
      || typeof value.nativeExecutionDigest !== 'string' || !/^[a-f0-9]{64}$/.test(value.nativeExecutionDigest)
      || !Number.isSafeInteger(value.graphRevision) || value.graphRevision! < 1)) throw new V6AgentError('invalid', 'Invalid native knowledge graph identity.');
    // Capture enumerable backend fields once, including injected accessors,
    // exactly as the original public snapshot projection did.
    const publicValue = { ...value, trace: value.trace.slice(-128) };
    if (!this.immutableSnapshotBranch(publicValue.proposal) || !publicValue.trace.every(entry => this.immutableSnapshotBranch(entry))) {
      return freeze(structuredClone(publicValue));
    }
    // The current scalar/authority fields and outer containers remain fresh.
    // Only already proved immutable diagnostic branches reuse detached copies;
    // mutable or injected backend values keep their ordinary copy boundary.
    // The worker's postMessage still copies each full response independently.
    const copied = structuredClone({ ...publicValue, trace: [], proposal: null }) as V6BackendSnapshot;
    copied.trace = publicValue.trace.map(entry => this.copySnapshotBranch(entry));
    copied.proposal = this.copySnapshotBranch(publicValue.proposal);
    return freeze(copied);
  }

  private accept(yielded: NativeRuntimeYield): V6AgentResult {
    if (!this.backend || !this.current || !this.sessionId) throw new V6AgentError('invalid', 'No native solver session is initialized.');
    if (!yielded || !['action', 'boundary', 'stopped'].includes(yielded.kind)) throw new V6AgentError('invalid', 'The native solver returned an invalid decision boundary.');
    const snapshot = this.snapshot(yielded.snapshot);
    let command: V6Command | null = null;
    let ticket: V6Ticket | null = null;
    if (yielded.kind === 'action') {
      const authorization = yielded.authorization;
      if (!yielded.command || !authorization || typeof authorization.observation_ref !== 'string' || !authorization.observation_ref) {
        throw new V6AgentError('invalid', 'A native action requires an explicit current decision authorization.');
      }
      if (['WIN', 'GAME_OVER', 'LEVEL_COMPLETE'].includes(this.current.state)) throw new V6AgentError('invalid', 'The native solver cannot release an ordinary action after a terminal observation.');
      command = commandFromNative(yielded.command);
      if (!this.current.available_action_refs.includes(command.actionRef)) throw new V6AgentError('invalid', 'The native solver proposed an unavailable public action.');
      const decisionRevision = integer(authorization.decision_revision, 1, Number.MAX_SAFE_INTEGER, 'decision revision');
      const actionIndex = integer(authorization.action_index, 0, Number.MAX_SAFE_INTEGER, 'prefix action index');
      ticket = freeze({
        id: `${this.sessionId}:native:${++this.issuedTickets}`, sessionId: this.sessionId,
        sourceDigest: this.backend.sourceDigest, observationRef: authorization.observation_ref,
        ...(snapshot.graphChain ? { graphChain: snapshot.graphChain, nativeExecutionDigest: snapshot.nativeExecutionDigest } : {}),
        frameHash: this.current.frame_hash, level: this.current.level, levelsCompleted: this.current.levels_completed,
        decisionRevision, actionIndex, ...command,
      });
      this.pending = { ticket, command: freeze(structuredClone(yielded.command)) };
    } else {
      if (yielded.command !== null || yielded.authorization !== null) throw new V6AgentError('invalid', 'A non-action boundary cannot carry an executable command.');
      this.pending = null;
    }
    this.result = freeze({
      ok: true, kind: yielded.kind, sessionId: this.sessionId,
      phase: yielded.kind === 'action' ? 'authorised_not_executed' : yielded.kind === 'boundary' ? 'sealed_prefix' : 'stopped',
      reason: yielded.reason, command, ticket, snapshot,
    });
    return this.result;
  }

  async handle(operation: V6AgentOperation, signal?: AbortSignal): Promise<V6AgentResult> {
    if (this.busy) throw new V6AgentError('invalid', 'The native reasoning service is already processing an operation.');
    this.busy = true;
    let backendWork = false;
    try {
      this.checkSignal(signal);
      if (!operation || typeof operation.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(operation.sessionId)) throw new V6AgentError('invalid', 'A valid native solver session identity is required.');
      integer(operation.sequence, 0, Number.MAX_SAFE_INTEGER, 'observation sequence');
      if (operation.type === 'init') {
        if (this.backend && !this.closed) throw new V6AgentError('invalid', 'Close the current native solver session before initializing another.');
        const publicPacket = validateV6PublicObservation(operation.observation);
        if (operation.sequence !== 0 || publicPacket.stepIndex !== 0 || publicPacket.level !== 1 || publicPacket.levelsCompleted !== 0) {
          throw new V6AgentError('invalid', 'The native V6 run must begin at level 1 with zero completed levels.');
        }
        const limits = budgets(operation.budgets);
        const observation = await nativeObservation(publicPacket);
        this.checkSignal(signal);
        let recovery;
        try {
          recovery = operation.recovery === undefined ? undefined : compileRecoveryPack(operation.recovery);
        } catch (error) {
          throw new V6AgentError('invalid', (error as Error).message);
        }
        const backend = await this.factory(recovery);
        if (backend.sourceCommit !== V6_REFERENCE_COMMIT || typeof backend.sourceDigest !== 'string' || !backend.sourceDigest) {
          throw new V6AgentError('invalid', 'The native solver implementation requires explicit source provenance.');
        }
        this.backend = backend; this.sessionId = operation.sessionId; this.sequence = 0;
        this.current = observation; this.pending = null; this.result = null; this.closed = false;
        this.usedTickets.clear(); this.issuedTickets = 0;
        this.snapshotCopies = new WeakMap(); this.immutableSnapshotBranches = new WeakSet();
        backendWork = true;
        const yielded = await backend.initialize({ sessionId: operation.sessionId, observation, budgets: limits }, this.execution(signal));
        this.checkSignal(signal);
        return this.accept(yielded);
      }
      if (!this.backend || !this.current || !this.result || operation.sessionId !== this.sessionId || this.closed) throw new V6AgentError('stale', 'The native solver session is no longer current.');
      if (operation.type === 'advance') {
        const pending = this.pending;
        if (!pending || operation.ticketId !== pending.ticket.id || this.usedTickets.has(operation.ticketId)
          || operation.sequence !== this.sequence + 1) throw new V6AgentError('stale', 'The native outcome does not bind the one pending authorization.');
        // The ticket binds only these live graph/program identities. Production
        // can read them without rebuilding diagnostics; injected backends retain
        // the complete snapshot fallback. The outgoing snapshot is unchanged.
        const currentKnowledge = this.backend.authorizationIdentity ? this.backend.authorizationIdentity() : this.backend.snapshot();
        if (this.backend.authorizationIdentity && (!currentKnowledge
          || typeof currentKnowledge.graphChain !== 'string' || !/^[a-f0-9]{64}$/.test(currentKnowledge.graphChain)
          || typeof currentKnowledge.nativeExecutionDigest !== 'string' || !/^[a-f0-9]{64}$/.test(currentKnowledge.nativeExecutionDigest))) {
          throw new TypeError('Invalid native authorization identity.');
        }
        if (pending.ticket.graphChain !== currentKnowledge.graphChain || pending.ticket.nativeExecutionDigest !== currentKnowledge.nativeExecutionDigest) {
          throw new V6AgentError('stale', 'The native authorization belongs to an earlier knowledge graph.');
        }
        const publicPacket = validateV6PublicObservation(operation.observation);
        if (publicPacket.stepIndex !== operation.sequence) throw new V6AgentError('stale', 'The native outcome does not advance the public transport counter.');
        if (!Number.isFinite(operation.executionMs) || operation.executionMs < 0) throw new V6AgentError('invalid', 'Invalid native execution duration.');
        const observation = await nativeObservation(publicPacket);
        this.checkSignal(signal);
        this.usedTickets.add(operation.ticketId); this.pending = null;
        this.current = observation; this.sequence = operation.sequence;
        backendWork = true;
        const yielded = await this.backend.advance({ command: pending.command, observation, executionMs: operation.executionMs }, this.execution(signal));
        this.checkSignal(signal);
        return this.accept(yielded);
      }
      if (operation.sequence !== this.sequence) throw new V6AgentError('stale', 'The native solver observation sequence has changed.');
      if (operation.type === 'close') {
        backendWork = true;
        await this.backend.close('host_session_closed'); this.closed = true; this.pending = null;
        this.result = freeze({ ...this.result, kind: 'stopped', phase: 'stopped', reason: 'host_session_closed', command: null, ticket: null,
          snapshot: this.snapshot(this.backend.snapshot()) });
        return this.result;
      }
      if (operation.type === 'snapshot') { backendWork = true; return freeze({ ...this.result, snapshot: this.snapshot(this.backend.snapshot()) }); }
      if (operation.type === 'inspect') {
        if (!this.backend.inspectKnowledge) throw new V6AgentError('invalid', 'This backend does not expose an authoritative knowledge graph.');
        backendWork = true;
        const snapshot = this.snapshot(this.backend.snapshot()), knowledge = this.backend.inspectKnowledge();
        if (knowledge.chain !== snapshot.graphChain) throw new V6AgentError('invalid', 'Knowledge inspection does not bind the current graph.');
        return freeze({ ...this.result, snapshot, knowledge: structuredClone(knowledge) });
      }
      if (operation.type === 'edit') {
        if (this.pending || this.result.kind !== 'boundary') throw new NativeEditRejected('busy_edit', 'Edits require a sealed prefix with no outstanding action.');
        if (!this.backend.edit) throw new NativeEditRejected('invalid_edit', 'This backend does not expose editable program nodes.');
        backendWork = true;
        const yielded = await this.backend.edit(operation.edit, this.execution(signal));
        this.checkSignal(signal);
        if (yielded.kind !== 'boundary') throw new V6AgentError('invalid', 'A graph edit cannot release or execute an action.');
        return this.accept(yielded);
      }
      if (operation.type !== 'resume') throw new V6AgentError('invalid', 'Unknown native reasoning operation.');
      // An unexecuted plan step survives Pause. Resume must not mint a new ticket.
      if (this.pending || this.result.kind === 'stopped') return this.result;
      backendWork = true;
      const yielded = await this.backend.resume(this.execution(signal));
      this.checkSignal(signal);
      return this.accept(yielded);
    } catch (error) {
      if (error instanceof NativeEditRejected) {
        // Validation/compare-and-swap failures are atomic and recoverable.
        throw new V6AgentError(error.code, error.message, this.backend ? this.snapshot(this.backend.snapshot()) : undefined);
      }
      // Invalid caller input leaves a pending ticket intact. Backend failure or
      // cancellation cannot authorize another action from a partially run step.
      if (backendWork || !(error instanceof V6AgentError) || error.code === 'cancelled') {
        this.pending = null; this.closed = true;
        try { await this.backend?.close('native_runtime_error'); } catch { /* Preserve the original failure. */ }
      }
      throw error;
    } finally { this.busy = false; }
  }
}
