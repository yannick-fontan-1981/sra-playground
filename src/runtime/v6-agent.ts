import type { GameObservation } from './browser-games.ts';
import type { AgentAction } from './contracts.ts';
import { isTerminalState } from './contracts.ts';
import { BrowserV6WorkerClient } from './v6-agent-client.ts';
import {
  emptyV6Snapshot, nativeV6Action, sameV6Action, sameV6Observation, toV6PublicObservation, v6FrameHash,
  V6AgentError, V6_DEFAULT_ACTIONS_PER_LEVEL, V6_MAX_RUN_ACTIONS, V6_REFERENCE_COMMIT,
} from './v6-agent-protocol.ts';
import type {
  NativeGraphEdit, V6AgentOperation, V6AgentResult, V6AgentTransport, V6BackendSnapshot, V6Budgets, V6Phase, V6PublicObservation,
} from './v6-agent-protocol.ts';
import type { KnowledgeMemory } from '../logos-engine/kernel.ts';
import { immutableJson } from '../logos-engine/canonical.ts';

export { BrowserV6WorkerClient } from './v6-agent-client.ts';

export type V6AgentStatus = 'idle' | 'preparing' | 'thinking' | 'acting' | 'paused' | 'stopped' | 'error';

/**
 * UI contract: backend counts describe actual native reasoning state, with null for unavailable
 * metrics. actionCount/sequence count witnessed native actions in this session.
 * A paused prefix and its pending command survive Step/Run and natural level ends.
 */
export interface V6AgentSnapshot extends V6BackendSnapshot {
  status: V6AgentStatus;
  message: string;
  actionCount: number;
  sequence: number;
  sessionId: string | null;
  phase: V6Phase | null;
  pendingAction: AgentAction | null;
  canStep: boolean;
  canRun: boolean;
  paused: boolean;
  busy: boolean;
  requiresNewSession: boolean;
  actionsPerLevel: number;
  targetLevels: number | null;
}

export interface V6AgentHost {
  getObservation(): GameObservation | null;
  canDispatch(): boolean;
  /** Serialize one native command and await its final public visual observation. */
  dispatch(action: AgentAction): Promise<V6DispatchResult>;
  onState(snapshot: V6AgentSnapshot): void;
}

/** Measured native time excludes the host's animation/presentation delay. */
export type V6DispatchResult = GameObservation | { observation: GameObservation; executionMs: number };

export interface V6AgentOptions extends V6AgentHost {
  transport?: V6AgentTransport;
  actionsPerLevel?: number;
  /** Defaults to the game's complete native campaign. */
  targetLevels?: number;
  maxSessionActions?: number;
}

type HostPhase = 'initializing' | 'planning' | 'acting' | 'observing' | null;

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${label} must be a positive integer.`);
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function copiedSnapshot(snapshot: V6BackendSnapshot): V6BackendSnapshot {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.sourceCommit !== V6_REFERENCE_COMMIT
    || typeof snapshot.sourceDigest !== 'string' || !snapshot.sourceDigest
    || !Number.isSafeInteger(snapshot.actions) || snapshot.actions < 0
    || !Number.isFinite(snapshot.activeSeconds) || snapshot.activeSeconds < 0
    || !Array.isArray(snapshot.trace)) throw new V6AgentError('invalid', 'The V6 solver returned an invalid state snapshot.');
  for (const name of ['cycles', 'nodeCount', 'hypothesisCount', 'compositionCount'] as const) {
    const count = snapshot[name];
    if (count !== null && (!Number.isSafeInteger(count) || count < 0)) throw new V6AgentError('invalid', `V6 returned an invalid ${name} metric.`);
  }
  if (snapshot.graphChain !== undefined && (typeof snapshot.graphChain !== 'string' || !/^[a-f0-9]{64}$/.test(snapshot.graphChain)
    || typeof snapshot.nativeExecutionDigest !== 'string' || !/^[a-f0-9]{64}$/.test(snapshot.nativeExecutionDigest)
    || !Number.isSafeInteger(snapshot.graphRevision) || snapshot.graphRevision! < 1)) throw new V6AgentError('invalid', 'The native knowledge graph identity is invalid.');
  return deepFreeze(structuredClone({ ...snapshot, trace: snapshot.trace.slice(-128) }));
}

/**
 * The host owns transport and lifecycle only. The native TypeScript reasoning
 * worker owns its SRC selection, plans, guards and end-of-prefix reconciliation.
 */
export class BrowserV6Agent {
  private readonly host: V6AgentHost;
  private readonly transport: V6AgentTransport;
  private readonly actionsPerLevel: number;
  private readonly requestedTarget?: number;
  private readonly maxSessionActions?: number;
  private knowledge: V6BackendSnapshot = emptyV6Snapshot();
  private status: V6AgentStatus = 'idle';
  private message = 'Start the native SRA agent from level 1. Step and Pause preserve its current plan.';
  private sessionId: string | null = null;
  private gameCode: string | null = null;
  private observed: V6PublicObservation | null = null;
  private pending: V6AgentResult | null = null;
  private usedTickets = new Set<string>();
  private actionCount = 0;
  private sequence = 0;
  private epoch = 0;
  private targetLevels: number | null = null;
  private disposed = false;
  private requiresNewSession = false;
  private stopRequested = false;
  private phase: HostPhase = null;
  private operation: Promise<void> | null = null;

  constructor(options: V6AgentOptions) {
    this.host = options; this.transport = options.transport ?? new BrowserV6WorkerClient();
    this.actionsPerLevel = positiveInteger(options.actionsPerLevel ?? V6_DEFAULT_ACTIONS_PER_LEVEL, 'The action cap per level');
    if (options.targetLevels !== undefined) this.requestedTarget = positiveInteger(options.targetLevels, 'The target level count');
    if (options.maxSessionActions !== undefined) this.maxSessionActions = positiveInteger(options.maxSessionActions, 'The session action cap');
  }

  private entryProblem(current: GameObservation | null): string | null {
    if (!current) return 'Load a game before starting V6.';
    if (!this.sessionId && (current.level !== 1 || current.levelsCompleted !== 0)) return 'V6 starts at level 1 with no completed levels. Restart the game to begin.';
    if (isTerminalState(current.state)) return `The game reports ${current.state}.`;
    if (!current.availableActionIds.some(id => Number.isInteger(id) && id >= 1 && id <= 7)) return 'The game currently offers no native action.';
    return null;
  }

  get snapshot(): V6AgentSnapshot {
    const current = this.host.getObservation();
    const problem = this.entryProblem(current);
    const canStep = !this.disposed && !this.operation && !this.requiresNewSession && this.host.canDispatch() && !problem;
    let pendingAction: AgentAction | null = null;
    if (this.pending?.kind === 'action' && this.pending.command) {
      try { pendingAction = nativeV6Action(this.pending.command); } catch { /* Invalid replies never dispatch. */ }
    }
    return Object.freeze({
      ...this.knowledge, status: this.status,
      message: !this.operation && !this.requiresNewSession && problem ? problem : this.message,
      actionCount: this.actionCount, sequence: this.sequence, sessionId: this.sessionId,
      phase: this.pending?.phase ?? null, pendingAction, canStep, canRun: canStep,
      paused: this.status === 'paused', busy: this.operation !== null, requiresNewSession: this.requiresNewSession,
      actionsPerLevel: this.actionsPerLevel, targetLevels: this.targetLevels,
    });
  }

  refresh(): void { this.emit(); }
  private emit(): void { this.host.onState(this.snapshot); }
  private state(status: V6AgentStatus, message: string): void { this.status = status; this.message = message; this.emit(); }
  private stillCurrent(epoch: number): boolean { return !this.disposed && epoch === this.epoch; }

  private assertFresh(expected: V6PublicObservation, epoch: number): void {
    if (!this.stillCurrent(epoch)) throw new V6AgentError('cancelled', 'The V6 session was replaced.');
    const current = this.host.getObservation();
    if (!this.host.canDispatch() || !this.sessionId || current?.gameCode !== this.gameCode
      || expected.stepIndex !== this.sequence || !sameV6Observation(expected, current)) {
      throw new V6AgentError('stale', 'The public board changed while V6 was reasoning. Start a new session.');
    }
  }

  private accept(result: V6AgentResult): void {
    const phase = result.kind === 'action' ? 'authorised_not_executed' : result.kind === 'boundary' ? 'sealed_prefix' : result.kind === 'stopped' ? 'stopped' : null;
    if (result.ok !== true || result.sessionId !== this.sessionId || phase === null || result.phase !== phase
      || result.kind === 'action' && (!result.command || !result.ticket)
      || result.kind !== 'action' && (result.command !== null || result.ticket !== null)) {
      throw new V6AgentError('invalid', 'The V6 solver returned an inconsistent native reasoning state.');
    }
    this.knowledge = copiedSnapshot(result.snapshot);
    this.pending = deepFreeze(structuredClone(result));
  }

  private budgets(current: GameObservation): V6Budgets {
    const count = positiveInteger(current.levelCount, 'The native level count');
    const targetLevels = this.requestedTarget ?? count;
    if (targetLevels > count) throw new V6AgentError('invalid', 'The requested target exceeds the native level count.');
    const levelActionCaps = Array<number>(targetLevels).fill(this.actionsPerLevel);
    const total = targetLevels * this.actionsPerLevel;
    if (!Number.isSafeInteger(total)) throw new V6AgentError('invalid', 'The total action budget is too large.');
    this.targetLevels = targetLevels;
    return { targetLevels, levelActionCaps, ...(this.maxSessionActions === undefined ? {} : { maxActions: Math.min(this.maxSessionActions, total) }) };
  }

  step(): Promise<void> { return this.start(1); }
  run(maxActions = 16): Promise<void> {
    if (!Number.isSafeInteger(maxActions) || maxActions < 1 || maxActions > V6_MAX_RUN_ACTIONS) return Promise.reject(new RangeError(`A V6 run contains 1–${V6_MAX_RUN_ACTIONS} actions.`));
    return this.start(maxActions);
  }

  /** Explicit read of the same versioned graph used by the native runtime. */
  inspectKnowledge(): Promise<KnowledgeMemory> {
    if (this.operation || !this.sessionId || this.disposed) return Promise.reject(new V6AgentError('busy_edit', 'Wait for the current reasoning operation before inspecting its graph.'));
    const epoch = this.epoch, sessionId = this.sessionId;
    const read = Promise.resolve().then(async () => {
      const result = await this.transport.request({ type: 'inspect', sessionId, sequence: this.sequence });
      if (!this.stillCurrent(epoch)) throw new V6AgentError('cancelled', 'The native session was replaced during inspection.');
      this.accept(result);
      if (!result.knowledge || result.knowledge.chain !== this.knowledge.graphChain) throw new V6AgentError('invalid', 'The inspected graph is not the current native knowledge.');
      return deepFreeze(structuredClone(result.knowledge));
    }).finally(() => { if (this.operation === lock) { this.operation = null; this.emit(); } });
    const lock = read.then(() => {}, () => {});
    this.operation = lock; this.emit(); return read;
  }

  /** Edits are serialized, compare the graph version, and never dispatch. */
  edit(input: NativeGraphEdit): Promise<void> {
    if (this.operation || !this.sessionId || this.pending?.kind !== 'boundary' || this.disposed || this.requiresNewSession) {
      return Promise.reject(new V6AgentError('busy_edit', 'Edits require a paused sealed prefix with no pending action.'));
    }
    let edit: NativeGraphEdit;
    try { edit = immutableJson(input) as unknown as NativeGraphEdit; }
    catch { return Promise.reject(new V6AgentError('invalid_edit', 'The edit must contain plain finite JSON data.')); }
    const epoch = this.epoch, sessionId = this.sessionId;
    let operation: Promise<void>;
    operation = Promise.resolve().then(async () => {
      if (!this.observed) throw new V6AgentError('invalid', 'No native observation is current.');
      this.assertFresh(this.observed, epoch);
      try {
        if (!await this.request({ type: 'edit', sessionId, sequence: this.sequence, edit }, epoch)) return;
        this.assertFresh(this.observed, epoch);
        this.state('paused', 'The validated graph edit is stored. The next plan will read the revised nodes.');
      } catch (error) {
        if (!this.stillCurrent(epoch)) return;
        if (error instanceof V6AgentError && ['invalid_edit', 'stale_edit', 'busy_edit'].includes(error.code)) {
          if (error.snapshot) this.knowledge = copiedSnapshot(error.snapshot);
          this.state('paused', `${error.message} The native session and its evidence are retained.`);
        } else {
          this.requiresNewSession = true;
          this.state('error', error instanceof Error ? error.message : String(error));
        }
        throw error;
      }
    }).finally(() => { if (this.operation === operation) { this.operation = null; this.emit(); } });
    this.operation = operation; this.emit(); return operation;
  }

  private start(maxActions: number): Promise<void> {
    if (this.operation) return this.operation;
    if (!this.snapshot.canStep) { this.emit(); return Promise.resolve(); }
    this.stopRequested = false;
    const epoch = this.epoch;
    let operation: Promise<void>;
    operation = Promise.resolve().then(() => this.loop(maxActions, epoch)).finally(() => {
      if (this.operation === operation) { this.operation = null; this.phase = null; this.emit(); }
    });
    this.operation = operation; this.emit();
    return operation;
  }

  private async request(operation: V6AgentOperation, epoch: number): Promise<V6AgentResult | null> {
    const result = await this.transport.request(operation);
    if (!this.stillCurrent(epoch)) return null;
    this.accept(result);
    return result;
  }

  private async initialize(epoch: number): Promise<boolean> {
    const current = this.host.getObservation();
    if (!current || !this.host.canDispatch()) throw new V6AgentError('stale', 'The game is not ready for V6.');
    const problem = this.entryProblem(current);
    if (problem) { this.state('stopped', problem); return false; }
    if (this.sessionId) {
      if (!this.observed) throw new V6AgentError('invalid', 'The V6 session has no acquired observation.');
      this.assertFresh(this.observed, epoch);
      return true;
    }
    const sessionId = `sra-v6-${crypto.randomUUID()}`;
    const observation = toV6PublicObservation(current, 0);
    const budgets = this.budgets(current);
    this.sessionId = sessionId; this.gameCode = current.gameCode; this.observed = observation;
    this.phase = 'initializing'; this.state('preparing', 'Loading the native SRA runtime and reading the public game frames…');
    return (await this.request({ type: 'init', sessionId, sequence: 0, observation, budgets }, epoch)) !== null;
  }

  private async validateAction(result: V6AgentResult, expected: V6PublicObservation): Promise<AgentAction> {
    const ticket = result.ticket;
    if (!ticket || !result.command) throw new V6AgentError('invalid', 'The V6 action has no authorization ticket.');
    const action = nativeV6Action(result.command);
    const reserved = nativeV6Action(ticket);
    if (typeof ticket.id !== 'string' || !ticket.id || this.usedTickets.has(ticket.id)
      || ticket.sessionId !== this.sessionId || ticket.sourceDigest !== this.knowledge.sourceDigest
      || ticket.graphChain !== this.knowledge.graphChain || ticket.nativeExecutionDigest !== this.knowledge.nativeExecutionDigest
      || ticket.level !== expected.level || ticket.levelsCompleted !== expected.levelsCompleted
      || !Number.isSafeInteger(ticket.decisionRevision) || ticket.decisionRevision < 1
      || !Number.isSafeInteger(ticket.actionIndex) || ticket.actionIndex < 0
      || typeof ticket.observationRef !== 'string' || !ticket.observationRef
      || !sameV6Action(action, reserved) || !expected.availableActionIds.includes(action.id)
      || ticket.frameHash !== await v6FrameHash(expected.frame)) {
      throw new V6AgentError('stale', 'The V6 authorization does not match this public observation and command.');
    }
    return action;
  }

  private async loop(maxActions: number, epoch: number): Promise<void> {
    let applied = 0;
    try {
      if (!await this.initialize(epoch)) return;
      while (applied < maxActions && !this.stopRequested && this.stillCurrent(epoch)) {
        const expected = this.observed;
        const sessionId = this.sessionId;
        if (!expected || !sessionId || !this.pending) throw new V6AgentError('invalid', 'The native V6 transfer has no current state.');
        this.assertFresh(expected, epoch);
        if (this.pending.kind === 'stopped') { this.finish(this.pending.reason); return; }
        if (this.pending.kind === 'boundary') {
          this.phase = 'planning'; this.state('thinking', 'V6 sealed its action prefix and is planning from the acquired evidence…');
          if (this.stopRequested) break;
          this.assertFresh(expected, epoch);
          if (!await this.request({ type: 'resume', sessionId, sequence: this.sequence }, epoch)) return;
          continue;
        }
        const pending = this.pending;
        const action = await this.validateAction(pending, expected);
        if (!this.stillCurrent(epoch)) return;
        if (this.stopRequested) break;
        this.assertFresh(expected, epoch);
        this.phase = 'acting'; this.state('acting', action.id === 6 ? `Applying ACTION6 at (${action.data.x}, ${action.data.y})…` : `Applying ACTION${action.id} to the native game…`);
        if (this.stopRequested) break;
        // Last freshness check and native dispatch share a synchronous turn.
        this.assertFresh(expected, epoch);
        this.usedTickets.add(pending.ticket!.id);
        const started = performance.now();
        const dispatched = await this.host.dispatch(action);
        const measured = Math.max(0, performance.now() - started);
        if (!this.stillCurrent(epoch)) return;
        this.actionCount += 1; this.sequence += 1; applied += 1;
        const next = 'observation' in dispatched ? dispatched.observation : dispatched;
        const executionMs = 'observation' in dispatched ? dispatched.executionMs : measured;
        if (!Number.isFinite(executionMs) || executionMs < 0) throw new V6AgentError('invalid', 'The host returned an invalid native execution duration.');
        if (next.gameCode !== this.gameCode) throw new V6AgentError('stale', 'The native action returned another game.');
        const after = toV6PublicObservation(next, this.sequence);
        const current = this.host.getObservation();
        if (current?.gameCode !== this.gameCode || !sameV6Observation(after, current)) throw new V6AgentError('stale', 'The displayed game no longer matches the returned native outcome.');
        this.observed = after;
        this.phase = 'observing'; this.state('thinking', 'V6 is acquiring the real outcome and continuing its committed prefix…');
        // Even a Pause must acquire an action that has already entered the game.
        // Invalidation, unlike Pause, closes this observation's entire session.
        if (!this.stillCurrent(epoch)) return;
        const acquired = await this.request({ type: 'advance', sessionId, sequence: this.sequence, ticketId: pending.ticket!.id, observation: after, executionMs }, epoch);
        if (!acquired) return;
        const progressed = next.levelsCompleted > expected.levelsCompleted || next.level > expected.level;
        if (isTerminalState(next.state)) {
          this.state('stopped', `The game reports ${next.state}. Its final public outcome has been acquired.`);
          return;
        }
        if (progressed) {
          if (acquired.kind === 'stopped') this.finish(acquired.reason);
          else this.state('paused', 'Level completed. V6 acquired the outcome and retained its transfer memory. Continue when ready.');
          return;
        }
        if (acquired.kind === 'stopped') { this.finish(acquired.reason); return; }
      }
      if (!this.stillCurrent(epoch)) return;
      if (this.pending?.kind === 'stopped') { this.finish(this.pending.reason); return; }
      this.state('paused', this.stopRequested ? 'Paused. The current V6 prefix, pending command and acquired evidence are retained.'
        : maxActions === 1 ? 'One action completed. Continue the same V6 plan when ready.'
          : `Batch limit reached: ${applied} actions. The V6 plan and memory are retained.`);
    } catch (error) {
      if (!this.stillCurrent(epoch)) return;
      if (error instanceof V6AgentError && error.snapshot) {
        try { this.knowledge = copiedSnapshot(error.snapshot); } catch { /* Retain the last valid state. */ }
      }
      this.requiresNewSession = true;
      const message = error instanceof Error ? error.message : String(error);
      this.state('error', `${message} Start a new reasoning session to continue.`);
    }
  }

  private finish(reason: string | null): void {
    this.requiresNewSession = true;
    this.state('stopped', reason ? `V6 stopped: ${reason}. Its acquired evidence is retained for inspection.` : 'V6 completed its run. Its acquired evidence is retained for inspection.');
  }

  pause(): void {
    if (this.disposed) return;
    this.stopRequested = true;
    // Preserve the committed plan. The reasoning worker finishes its current
    // action/prefix boundary; a later Step resumes the exact pending command.
    this.state('paused', !this.operation ? 'Paused. The V6 plan and acquired evidence are retained.'
      : this.phase === 'acting' || this.phase === 'observing' ? 'Pausing after the engaged action and its real outcome…'
        : 'Pausing at the next V6 action boundary. The current computation will finish safely…');
  }

  invalidate(reason: string): void {
    if (this.disposed) return;
    this.epoch += 1; this.stopRequested = true; this.transport.reset(reason);
    this.sessionId = null; this.gameCode = null; this.observed = null; this.pending = null;
    this.usedTickets.clear(); this.actionCount = 0; this.sequence = 0; this.targetLevels = null;
    this.knowledge = emptyV6Snapshot(); this.requiresNewSession = false;
    this.state('idle', reason);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.epoch += 1; this.stopRequested = true;
    this.transport.dispose(); this.emit();
  }
}
