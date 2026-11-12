import {
  isAgentAction,
  PROTOCOL_VERSION,
  type AgentAction,
  type AgentObservation,
  type AgentWorkerRequest,
  type AgentWorkerResponse,
} from './contracts.ts';

export interface AgentDecisionPort {
  initialize?(sessionId: string, seed: number): void | Promise<void>;
  decide(
    observation: AgentObservation,
    budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined | Promise<AgentAction | undefined>;
  cancel?(sessionId: string): void;
}

export interface AgentWorkerCoreOptions {
  implementationRevision: string;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

interface SessionState {
  sessionId: string;
  lastSequence: number;
  cancelled: boolean;
}

const TIMEOUT = Symbol('timeout');

export class AgentWorkerCore {
  readonly #decisionPort: AgentDecisionPort;
  readonly #implementationRevision: string;
  readonly #setTimer: NonNullable<AgentWorkerCoreOptions['setTimer']>;
  readonly #clearTimer: NonNullable<AgentWorkerCoreOptions['clearTimer']>;
  #session: SessionState | undefined;
  #activeAbort: AbortController | undefined;

  constructor(decisionPort: AgentDecisionPort, options: AgentWorkerCoreOptions) {
    if (!options.implementationRevision) {
      throw new TypeError('implementationRevision must be non-empty');
    }
    this.#decisionPort = decisionPort;
    this.#implementationRevision = options.implementationRevision;
    this.#setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
    this.#clearTimer = options.clearTimer ?? (timer => clearTimeout(timer));
  }

  async handle(request: AgentWorkerRequest): Promise<AgentWorkerResponse> {
    if (request.type === 'initialize') return this.#initialize(request);
    if (request.type === 'cancel') return this.#cancel(request.sessionId);
    return this.#observe(request.observation, request.budgetMs);
  }

  async #initialize(request: Extract<AgentWorkerRequest, { type: 'initialize' }>): Promise<AgentWorkerResponse> {
    if (request.protocolVersion !== PROTOCOL_VERSION) {
      return { type: 'error', sessionId: request.sessionId, message: 'Unsupported agent protocol version.' };
    }
    if (!request.sessionId) {
      return { type: 'error', sessionId: request.sessionId, message: 'Session id is required.' };
    }
    if (!Number.isInteger(request.seed)) {
      return { type: 'error', sessionId: request.sessionId, message: 'Seed must be an integer.' };
    }

    this.#activeAbort?.abort();
    this.#activeAbort = undefined;
    this.#session = { sessionId: request.sessionId, lastSequence: -1, cancelled: false };
    await this.#decisionPort.initialize?.(request.sessionId, request.seed);
    return {
      type: 'ready',
      sessionId: request.sessionId,
      implementationRevision: this.#implementationRevision,
    };
  }

  #cancel(sessionId: string): AgentWorkerResponse {
    const session = this.#session;
    if (!session || session.sessionId !== sessionId) {
      return { type: 'error', sessionId, message: 'Unknown or inactive session.' };
    }
    session.cancelled = true;
    this.#activeAbort?.abort();
    this.#activeAbort = undefined;
    this.#decisionPort.cancel?.(sessionId);
    return { type: 'stopped', sessionId, reason: 'cancelled' };
  }

  async #observe(observation: AgentObservation, budgetMs: number): Promise<AgentWorkerResponse> {
    const session = this.#session;
    if (!session || session.sessionId !== observation.sessionId) {
      return { type: 'error', sessionId: observation.sessionId, message: 'Observation session does not match active session.' };
    }
    if (session.cancelled) {
      return { type: 'stopped', sessionId: session.sessionId, reason: 'cancelled' };
    }
    if (observation.protocolVersion !== PROTOCOL_VERSION) {
      return { type: 'error', sessionId: session.sessionId, message: 'Observation protocol version mismatch.' };
    }
    if (!Number.isInteger(observation.sequence) || observation.sequence <= session.lastSequence) {
      return { type: 'error', sessionId: session.sessionId, message: 'Observation sequence must increase monotonically.' };
    }
    session.lastSequence = observation.sequence;

    if (observation.state === 'WIN') {
      return { type: 'stopped', sessionId: session.sessionId, reason: 'complete' };
    }
    if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
      return { type: 'stopped', sessionId: session.sessionId, reason: 'budget' };
    }

    const controller = new AbortController();
    this.#activeAbort?.abort();
    this.#activeAbort = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMEOUT>(resolve => {
      timer = this.#setTimer(() => {
        controller.abort();
        resolve(TIMEOUT);
      }, budgetMs);
    });

    try {
      const decision = await Promise.race([
        Promise.resolve(this.#decisionPort.decide(observation, budgetMs, controller.signal)),
        timeout,
      ]);
      if (decision === TIMEOUT || controller.signal.aborted) {
        return { type: 'stopped', sessionId: session.sessionId, reason: session.cancelled ? 'cancelled' : 'budget' };
      }
      if (decision === undefined) {
        return { type: 'stopped', sessionId: session.sessionId, reason: 'budget' };
      }
      if (!isAgentAction(decision)) {
        return { type: 'error', sessionId: session.sessionId, message: 'Decision port returned an invalid action.' };
      }
      if (!observation.availableActionIds.includes(decision.id)) {
        return { type: 'error', sessionId: session.sessionId, message: 'Decision port returned an unavailable action.' };
      }
      return {
        type: 'action',
        sessionId: session.sessionId,
        sequence: observation.sequence,
        action: decision,
      };
    } catch (error) {
      if (controller.signal.aborted) {
        return { type: 'stopped', sessionId: session.sessionId, reason: session.cancelled ? 'cancelled' : 'budget' };
      }
      return {
        type: 'error',
        sessionId: session.sessionId,
        message: error instanceof Error ? error.message : 'Agent decision failed.',
      };
    } finally {
      if (timer !== undefined) this.#clearTimer(timer);
      if (this.#activeAbort === controller) this.#activeAbort = undefined;
    }
  }
}
