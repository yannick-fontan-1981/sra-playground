import type { GameObservation } from './browser-games.ts';
import { isSupportedAgentActionId, isTerminalState, matchesPublicObservation, toAgentObservation } from './contracts.ts';
import type { AgentObservation, SupportedAgentActionId } from './contracts.ts';
import { SraAgentError } from './sra-agent-protocol.ts';
import type { SraAgentOperation, SraAgentResult, SraAgentTransport, SraKnowledgeSummary, SraWorkerResponse } from './sra-agent-protocol.ts';

interface Pending {
  operation: SraAgentOperation;
  resolve: (result: SraAgentResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Lazy worker transport. A reset invalidates every outstanding request. */
export class BrowserSraWorkerClient implements SraAgentTransport {
  private readonly workerFactory: () => Worker;
  private worker: Worker | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private disposed = false;

  constructor(workerFactory: () => Worker = () => new Worker(new URL('./sra-agent-worker.ts', import.meta.url), { type: 'module', name: 'logos-engine-agent' })) {
    this.workerFactory = workerFactory;
  }

  private getWorker(): Worker {
    if (this.disposed) throw new SraAgentError('cancelled', 'The agent is closed.');
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.addEventListener('message', (event: MessageEvent<SraWorkerResponse>) => {
      if (this.worker !== worker) return;
      const response = event.data;
      if (!response || typeof response !== 'object') return;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id); clearTimeout(pending.timeout);
      if (response.sessionId !== pending.operation.sessionId || response.sequence !== pending.operation.sequence) {
        pending.reject(new SraAgentError('stale', 'A response belongs to an obsolete agent observation.'));
      } else if ('error' in response) {
        pending.reject(new SraAgentError(response.error.code, response.error.message));
      } else if (response.result && typeof response.result.kind === 'string') pending.resolve(response.result);
      else pending.reject(new SraAgentError('invalid', 'The reasoning worker returned an invalid response.'));
    });
    worker.addEventListener('error', () => { if (this.worker === worker) this.fail(new SraAgentError('internal', 'The reasoning worker stopped. Start a new session to retry.')); });
    worker.addEventListener('messageerror', () => { if (this.worker === worker) this.fail(new SraAgentError('internal', 'The reasoning response could not be read. Start a new session to retry.')); });
    this.worker = worker;
    return worker;
  }

  request(operation: SraAgentOperation): Promise<SraAgentResult> {
    return new Promise((resolve, reject) => {
      const worker = this.getWorker();
      const id = ++this.nextId;
      const timeout = setTimeout(() => this.fail(new SraAgentError('timeout', 'The reasoning worker timed out. Start a new session to retry.')), 30000);
      this.pending.set(id, { operation, resolve, reject, timeout });
      try { worker.postMessage({ ...operation, id }); }
      catch (error) {
        this.pending.delete(id); clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  cancel(sessionId: string): void { this.worker?.postMessage({ type: 'cancel', id: ++this.nextId, sessionId }); }
  private fail(error: Error): void {
    this.worker?.terminate(); this.worker = null;
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); }
    this.pending.clear();
  }
  reset(reason: string): void { this.fail(new SraAgentError('cancelled', reason)); }
  dispose(): void { this.disposed = true; this.reset('The agent was closed.'); }
}

export type SraAgentStatus = 'idle' | 'preparing' | 'thinking' | 'acting' | 'paused' | 'stopped' | 'error';
export interface SraAgentSnapshot extends SraKnowledgeSummary {
  status: SraAgentStatus;
  message: string;
  actionCount: number;
  canStep: boolean;
  canRun: boolean;
  paused: boolean;
  busy: boolean;
  sessionId: string | null;
  sequence: number;
  requiresNewSession: boolean;
}

export interface SraAgentHost {
  getObservation(): GameObservation | null;
  canDispatch(): boolean;
  /** Must serialize the native action and await its final visual observation. */
  dispatch(actionId: SupportedAgentActionId): Promise<GameObservation>;
  onState(snapshot: SraAgentSnapshot): void;
}
export interface SraAgentOptions extends SraAgentHost {
  /** Deterministic transport injection for lifecycle tests, not a policy bypass. */
  transport?: SraAgentTransport;
}

const emptySummary = (): SraKnowledgeSummary => ({ cycles: 0, choices: 0, nodeCount: 0, hypothesisCount: 0, compositionCount: 0, lastDecision: null, trace: [] });
type Phase = 'preparing' | 'choosing' | 'consuming' | 'abandoning' | 'acting' | 'observing' | null;

/**
 * Host session coordinator, with no game-solving policy. All choices come from
 * the V7 worker; this class owns only lifecycle, freshness and native dispatch.
 */
export class BrowserSraAgent {
  private readonly host: SraAgentHost;
  private readonly transport: SraAgentTransport;
  private status: SraAgentStatus = 'idle';
  private message = 'Observe the current board, then let V7 choose a bounded exploratory action.';
  private knowledge: SraKnowledgeSummary = emptySummary();
  private sessionId: string | null = null;
  private observed: AgentObservation | null = null;
  private sequence = 0;
  private actionCount = 0;
  private epoch = 0;
  private disposed = false;
  private requiresNewSession = false;
  private stopRequested = false;
  private phase: Phase = null;
  private operation: Promise<void> | null = null;

  constructor(options: SraAgentOptions) { this.host = options; this.transport = options.transport ?? new BrowserSraWorkerClient(); }

  get snapshot(): SraAgentSnapshot {
    const current = this.host.getObservation();
    const supported = current?.availableActionIds.some(isSupportedAgentActionId) ?? false;
    const canStep = !this.disposed && !this.operation && !this.requiresNewSession && this.host.canDispatch()
      && Boolean(current && !isTerminalState(current.state) && supported);
    let message = this.message;
    if (!this.operation && !this.requiresNewSession && current && this.host.canDispatch()) {
      if (isTerminalState(current.state)) message = `The game reports ${current.state}. Use the manual controls to continue.`;
      else if (!supported) message = 'This first policy uses ACTION1–5. Coordinate clicks (ACTION6) and recovery (ACTION7) are deferred.';
    }
    return Object.freeze({
      ...this.knowledge, status: this.status, message, actionCount: this.actionCount,
      canStep, canRun: canStep, paused: this.status === 'paused', busy: this.operation !== null,
      sessionId: this.sessionId, sequence: this.sequence, requiresNewSession: this.requiresNewSession,
    });
  }

  refresh(): void { this.emit(); }
  private emit(): void { this.host.onState(this.snapshot); }
  private state(status: SraAgentStatus, message: string): void { this.status = status; this.message = message; this.emit(); }
  private apply(result: SraAgentResult): void {
    this.knowledge = { ...result.summary, trace: Object.freeze(result.summary.trace.slice(-128).map(event => Object.freeze({ ...event }))) };
  }
  private stillCurrent(epoch: number): boolean { return !this.disposed && epoch === this.epoch; }

  private assertFresh(expected: AgentObservation, epoch: number): void {
    if (!this.stillCurrent(epoch)) throw new SraAgentError('cancelled', 'The reasoning session was replaced.');
    if (!this.host.canDispatch() || !matchesPublicObservation(expected, this.host.getObservation())
      || this.sequence !== expected.sequence || this.sessionId !== expected.sessionId) {
      throw new SraAgentError('stale', 'The board changed while V7 was thinking. Start a new reasoning session.');
    }
  }

  step(): Promise<void> { return this.start(1); }
  run(maxActions = 4): Promise<void> {
    if (!Number.isSafeInteger(maxActions) || maxActions < 1 || maxActions > 4) return Promise.reject(new RangeError('A run contains one to four actions.'));
    return this.start(maxActions);
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
    this.operation = operation;
    this.emit();
    return operation;
  }

  private async loop(maxActions: number, epoch: number): Promise<void> {
    let applied = 0;
    try {
      while (applied < maxActions && !this.stopRequested && this.stillCurrent(epoch)) {
        if (!await this.oneAction(epoch)) break;
        applied += 1;
      }
      if (!this.stillCurrent(epoch) || this.requiresNewSession || this.status === 'stopped') return;
      if (this.stopRequested) this.state('paused', 'Paused. The last completed observation and knowledge are retained.');
      else this.state('paused', maxActions === 1 ? 'One action completed. Inspect the result or continue.' : `Batch limit reached: ${applied} actions. Run again to continue with the same memory.`);
    } catch (error) {
      if (!this.stillCurrent(epoch)) return;
      if ((error instanceof SraAgentError && error.code === 'cancelled') || error instanceof Error && error.name === 'AbortError') {
        this.state('paused', 'Reasoning paused. The last completed observation and knowledge are retained.');
      } else {
        this.requiresNewSession = true;
        const message = error instanceof Error ? error.message : String(error);
        const budget = error instanceof SraAgentError && error.code === 'budget' || /budget|deadline|instruction limit/i.test(message);
        this.state(budget ? 'stopped' : 'error', `${message} Use New session to continue from the displayed board.`);
      }
    }
  }

  private async oneAction(epoch: number): Promise<boolean> {
    const current = this.host.getObservation();
    if (!current || !this.host.canDispatch()) throw new SraAgentError('stale', 'The game is no longer ready for the agent.');
    if (isTerminalState(current.state)) { this.state('stopped', `The game reports ${current.state}.`); return false; }
    this.sessionId ??= `sra:${crypto.randomUUID()}`;
    const sessionId = this.sessionId;
    const expected = toAgentObservation(current, sessionId, this.sequence);
    if (!this.observed) {
      this.phase = 'preparing'; this.state('preparing', 'Reading the public board and initializing V7…');
      const result = await this.transport.request({ type: 'initialize', sessionId, sequence: 0, observation: expected });
      if (!this.stillCurrent(epoch)) return false;
      if (result.kind !== 'ready') throw new SraAgentError('invalid', 'The agent did not initialize.');
      this.apply(result); this.observed = expected;
    } else if (!matchesPublicObservation(this.observed, current)) {
      throw new SraAgentError('stale', 'The current board is not the last observation acquired by V7.');
    }
    if (this.stopRequested) return false;
    this.assertFresh(expected, epoch);
    this.phase = 'choosing'; this.state('thinking', 'V7 is selecting an interaction from the observed questions…');
    const choice = await this.transport.request({ type: 'choose', sessionId, sequence: this.sequence });
    if (!this.stillCurrent(epoch)) return false;
    this.apply(choice);
    if (this.stopRequested) return false;
    if (choice.kind === 'stopped') { this.requiresNewSession = choice.reason !== 'terminal'; this.state('stopped', choice.message); return false; }
    if (choice.kind !== 'choice' || !isSupportedAgentActionId(choice.action) || !expected.availableActionIds.includes(choice.action)) {
      throw new SraAgentError('invalid', 'V7 did not return an available grounded action.');
    }
    this.assertFresh(expected, epoch);
    this.phase = 'consuming';
    const consumed = await this.transport.request({ type: 'consume', sessionId, sequence: this.sequence, proposal: choice.proposal });
    if (!this.stillCurrent(epoch)) return false;
    this.apply(consumed);
    if (consumed.kind !== 'consumed' || consumed.action !== choice.action || !isSupportedAgentActionId(consumed.action)) {
      throw new SraAgentError('invalid', 'The consumed proposal does not match the selected action.');
    }
    const abandon = async (): Promise<false> => {
      this.phase = 'abandoning';
      const result = await this.transport.request({ type: 'abandon', sessionId, sequence: this.sequence, proposalId: consumed.proposalId });
      if (this.stillCurrent(epoch)) {
        if (result.kind !== 'abandoned') throw new SraAgentError('invalid', 'The pending action could not be cancelled.');
        this.apply(result);
      }
      return false;
    };
    if (this.stopRequested) return abandon();
    this.assertFresh(expected, epoch);
    this.phase = 'acting'; this.state('acting', `Applying ACTION${consumed.action} to the native game…`);
    if (this.stopRequested) return abandon();
    // Last guard and dispatch share this synchronous turn: a stale decision
    // never enters the game's FIFO queue, even after a delayed consume reply.
    this.assertFresh(expected, epoch);
    const next = await this.host.dispatch(consumed.action);
    if (!this.stillCurrent(epoch)) return false;
    this.actionCount += 1; this.sequence += 1;
    if (next.gameCode !== expected.gameCode) throw new SraAgentError('stale', 'The native action returned a different game.');
    if (next.level !== expected.level) {
      this.requiresNewSession = true;
      this.state('stopped', 'The game moved to another level. Use New session to observe this level; knowledge from the previous level is retained for inspection.');
      return false;
    }
    const after = toAgentObservation(next, sessionId, this.sequence);
    this.phase = 'observing'; this.state('thinking', 'Acquiring the action’s public outcome…');
    const observed = await this.transport.request({ type: 'observe', sessionId, sequence: this.sequence, observation: after, action: consumed.action });
    if (!this.stillCurrent(epoch)) return false;
    if (observed.kind !== 'observed') throw new SraAgentError('invalid', 'The native action outcome was not acquired.');
    this.apply(observed); this.observed = after;
    if (isTerminalState(next.state) || next.levelsCompleted !== expected.levelsCompleted) {
      this.requiresNewSession = true;
      this.state('stopped', isTerminalState(next.state) ? `The game reports ${next.state}. The agent has stopped.` : 'Level progress changed. Use New session before continuing.');
      return false;
    }
    return true;
  }

  pause(): void {
    if (this.disposed) return;
    this.stopRequested = true;
    if (this.sessionId && (this.phase === 'preparing' || this.phase === 'choosing' || this.phase === 'consuming')) this.transport.cancel(this.sessionId);
    this.state('paused', !this.operation ? 'Paused. The last completed observation and knowledge are retained.'
      : this.phase === 'acting' || this.phase === 'observing' ? 'Pausing after the current action and its observation…' : 'Pausing reasoning…');
  }

  invalidate(reason: string): void {
    if (this.disposed) return;
    this.epoch += 1; this.stopRequested = true;
    this.transport.reset(reason);
    this.sessionId = null; this.observed = null; this.sequence = 0; this.actionCount = 0;
    this.knowledge = emptySummary(); this.requiresNewSession = false;
    this.state('idle', reason);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.epoch += 1; this.stopRequested = true;
    this.transport.dispose(); this.emit();
  }
}
