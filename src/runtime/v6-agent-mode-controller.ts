import type { ProductReadinessState } from '../agent-product-dispatch.ts';
import type { AgentObservation } from './contracts.ts';
import type { GameObservation } from './browser-games.ts';
import {
  type BrowserCampaignDispatchPorts,
  type BrowserCampaignHostResult,
  type BrowserCampaignSessionInput,
} from './v6-browser-common-campaign-host.ts';

export type AgentModeSeam = 'browser-common-campaign';

export type AgentModeControllerPhase =
  | 'idle'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'disposed';

export type AgentModeStopReason =
  | 'manual'
  | 'game-change'
  | 'cancelled'
  | 'none'
  | 'ambiguous'
  | 'blocked'
  | 'complete'
  | 'game-over'
  | 'dispatch-rejected'
  | 'stale'
  | 'max-steps'
  | 'error';

export type AgentModeWaitReason =
  | 'product-not-ready'
  | 'stale-product-observation'
  | 'pending';

export type AgentModeRunStatus =
  | 'not-started'
  | 'busy'
  | 'waiting'
  | 'stopped'
  | 'disposed';

export interface AgentModeRunResult {
  seam: AgentModeSeam;
  status: AgentModeRunStatus;
  reason?: AgentModeStopReason | AgentModeWaitReason;
  steps: number;
  lastHostResult: BrowserCampaignHostResult | null;
  error?: unknown;
}

export interface AgentModeRunInput {
  state(): ProductReadinessState;
  ports: BrowserCampaignDispatchPorts;
  maxSteps?: number;
}

/** Narrow product-facing contract implemented by BrowserCommonCampaignHost. */
export interface AgentModeBrowserHost {
  begin(input: BrowserCampaignSessionInput): AgentObservation;
  run(
    state: ProductReadinessState,
    ports: BrowserCampaignDispatchPorts,
  ): Promise<BrowserCampaignHostResult>;
  cancel(): boolean;
  dispose(): void;
}

export interface AgentModeControllerOptions {
  /** Explicit seam identity. The controller never owns two seams at once. */
  seam: AgentModeSeam;
  host: AgentModeBrowserHost;
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 64;

function boundedSteps(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return value;
}

function isCompleteState(value: string | undefined): boolean {
  return value === 'WIN' || value === 'LEVEL_COMPLETE';
}

function isGameOverState(value: string | undefined): boolean {
  return value === 'GAME_OVER' || value === 'GAMEOVER';
}

/**
 * Own one explicitly selected product Agent seam.
 *
 * The controller serializes complete campaigns, bounds their action count and
 * invalidates an in-flight dispatch when the user returns to Manual mode or a
 * new game replaces the current session. It never ranks proposals and never
 * substitutes an action when the underlying campaign returns none, ambiguous or
 * blocked.
 */
export class V6AgentModeController {
  readonly #seam: AgentModeSeam;
  readonly #host: AgentModeBrowserHost;
  readonly #defaultMaxSteps: number;
  #phase: AgentModeControllerPhase = 'idle';
  #sessionId: string | null = null;
  #epoch = 0;
  #stopReason: AgentModeStopReason | null = null;
  #runPromise: Promise<AgentModeRunResult> | null = null;

  constructor(options: AgentModeControllerOptions) {
    this.#seam = options.seam;
    this.#host = options.host;
    this.#defaultMaxSteps = boundedSteps(
      options.maxSteps ?? DEFAULT_MAX_STEPS,
      'agent mode maxSteps',
    );
  }

  begin(input: BrowserCampaignSessionInput): AgentObservation {
    this.#assertUsable();
    this.#epoch += 1;
    this.#stopReason = null;
    const observation = this.#host.begin(input);
    this.#sessionId = input.sessionId;
    this.#phase = 'ready';
    return observation;
  }

  runUntilStop(input: AgentModeRunInput): Promise<AgentModeRunResult> {
    if (this.#phase === 'disposed') {
      return Promise.resolve(this.#baseResult('disposed', 0, null));
    }
    if (!this.#sessionId || (this.#phase !== 'ready' && this.#phase !== 'running')) {
      return Promise.resolve(this.#baseResult('not-started', 0, null));
    }
    if (this.#runPromise) {
      return Promise.resolve(this.#baseResult('busy', 0, null));
    }

    const promise = this.#run(input);
    this.#runPromise = promise;
    return promise.finally(() => {
      if (this.#runPromise === promise) this.#runPromise = null;
    });
  }

  stop(reason: Extract<AgentModeStopReason, 'manual' | 'game-change' | 'cancelled'> = 'cancelled'): boolean {
    if (this.#phase === 'disposed') return false;
    const hadSession = this.#sessionId !== null
      || this.#phase === 'ready'
      || this.#phase === 'running';
    this.#epoch += 1;
    this.#host.cancel();
    this.#sessionId = null;
    this.#stopReason = reason;
    this.#phase = hadSession ? 'stopped' : 'idle';
    return hadSession;
  }

  dispose(): void {
    if (this.#phase === 'disposed') return;
    this.#epoch += 1;
    this.#sessionId = null;
    this.#stopReason = 'cancelled';
    this.#host.dispose();
    this.#phase = 'disposed';
  }

  get seam(): AgentModeSeam {
    return this.#seam;
  }

  get phase(): AgentModeControllerPhase {
    return this.#phase;
  }

  get sessionId(): string | null {
    return this.#sessionId;
  }

  get stopReason(): AgentModeStopReason | null {
    return this.#stopReason;
  }

  get running(): boolean {
    return this.#phase === 'running';
  }

  async #run(input: AgentModeRunInput): Promise<AgentModeRunResult> {
    const sessionId = this.#sessionId;
    if (!sessionId) return this.#baseResult('not-started', 0, null);

    const epoch = this.#epoch;
    const maxSteps = boundedSteps(
      input.maxSteps ?? this.#defaultMaxSteps,
      'agent campaign maxSteps',
    );
    const externalGeneration = input.ports.generation();
    let steps = 0;
    let lastHostResult: BrowserCampaignHostResult | null = null;
    this.#phase = 'running';

    const current = (): boolean => this.#epoch === epoch
      && this.#sessionId === sessionId
      && this.#phase !== 'disposed';

    const ports: BrowserCampaignDispatchPorts = {
      action: (action, data) => input.ports.action(action, data),
      present: (observation, generation) => input.ports.present(observation, generation),
      now: () => input.ports.now(),
      generation: () => current() ? input.ports.generation() : Number.NaN,
      setBusy: value => input.ports.setBusy(value),
      onDispatchMeasured: elapsedMs => input.ports.onDispatchMeasured?.(elapsedMs),
      onError: (error, generation) => {
        if (current()) input.ports.onError?.(error, generation);
      },
      onCampaignAcquired: (receipt, observation) => {
        if (current()) input.ports.onCampaignAcquired?.(receipt, observation);
      },
    };

    try {
      while (steps < maxSteps) {
        if (!current()) {
          this.#releaseCancelledBusy(input.ports, externalGeneration);
          return this.#cancelledResult(steps, lastHostResult);
        }

        const state = input.state();
        const stateName = state.observation?.state;
        if (isCompleteState(stateName)) {
          return this.#finish('complete', steps, lastHostResult, epoch, sessionId);
        }
        if (isGameOverState(stateName)) {
          return this.#finish('game-over', steps, lastHostResult, epoch, sessionId);
        }

        lastHostResult = await this.#host.run(state, ports);

        if (!current()) {
          this.#releaseCancelledBusy(input.ports, externalGeneration);
          return this.#cancelledResult(steps, lastHostResult);
        }

        if (lastHostResult.status === 'not-ready') {
          this.#phase = 'ready';
          return {
            ...this.#baseResult('waiting', steps, lastHostResult),
            reason: lastHostResult.reason ?? 'product-not-ready',
          };
        }
        if (lastHostResult.status === 'pending') {
          this.#phase = 'ready';
          return {
            ...this.#baseResult('waiting', steps, lastHostResult),
            reason: 'pending',
          };
        }
        if (lastHostResult.status === 'not-started') {
          return this.#finish('cancelled', steps, lastHostResult, epoch, sessionId);
        }
        if (lastHostResult.status === 'none'
          || lastHostResult.status === 'ambiguous'
          || lastHostResult.status === 'blocked') {
          return this.#finish(
            lastHostResult.status,
            steps,
            lastHostResult,
            epoch,
            sessionId,
          );
        }

        const dispatch = lastHostResult.dispatch;
        if (!dispatch?.accepted) {
          return this.#finish(
            dispatch?.stale ? 'stale' : 'dispatch-rejected',
            steps,
            lastHostResult,
            epoch,
            sessionId,
          );
        }

        steps += 1;
        const returnedState = lastHostResult.returnedObservation?.state;
        if (returnedState === 'WIN') {
          return this.#finish('complete', steps, lastHostResult, epoch, sessionId);
        }
      }

      return this.#finish('max-steps', steps, lastHostResult, epoch, sessionId);
    } catch (error) {
      if (!current()) {
        this.#releaseCancelledBusy(input.ports, externalGeneration);
        return {
          ...this.#cancelledResult(steps, lastHostResult),
          error,
        };
      }
      return {
        ...this.#finish('error', steps, lastHostResult, epoch, sessionId),
        error,
      };
    }
  }

  #finish(
    reason: AgentModeStopReason,
    steps: number,
    lastHostResult: BrowserCampaignHostResult | null,
    epoch: number,
    sessionId: string,
  ): AgentModeRunResult {
    if (this.#epoch === epoch && this.#sessionId === sessionId) {
      this.#host.cancel();
      this.#sessionId = null;
      this.#stopReason = reason;
      this.#phase = 'stopped';
    }
    return {
      ...this.#baseResult('stopped', steps, lastHostResult),
      reason,
    };
  }

  #cancelledResult(
    steps: number,
    lastHostResult: BrowserCampaignHostResult | null,
  ): AgentModeRunResult {
    return {
      ...this.#baseResult('stopped', steps, lastHostResult),
      reason: this.#stopReason ?? 'cancelled',
    };
  }

  #releaseCancelledBusy(
    ports: BrowserCampaignDispatchPorts,
    externalGeneration: number,
  ): void {
    if (ports.generation() === externalGeneration) ports.setBusy(false);
  }

  #baseResult(
    status: AgentModeRunStatus,
    steps: number,
    lastHostResult: BrowserCampaignHostResult | null,
  ): AgentModeRunResult {
    return {
      seam: this.#seam,
      status,
      steps,
      lastHostResult,
    };
  }

  #assertUsable(): void {
    if (this.#phase === 'disposed') {
      throw new Error('agent mode controller is disposed');
    }
  }
}

/** Product helper retained here to make terminal checks available to UI adapters. */
export function isTerminalGameObservation(observation: GameObservation | null): boolean {
  return Boolean(
    observation
    && (isCompleteState(observation.state) || isGameOverState(observation.state)),
  );
}
