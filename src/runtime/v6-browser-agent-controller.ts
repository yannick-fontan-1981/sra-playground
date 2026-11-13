import type { ProductReadinessState } from '../agent-product-dispatch.ts';
import type { GameObservation } from './browser-games.ts';
import {
  createPublicSingleActionBrowserCampaignHost,
  type BrowserCampaignDispatchPorts,
  type BrowserCampaignHostResult,
  type BrowserCommonCampaignHost,
} from './v6-browser-common-campaign-host.ts';

/**
 * The first product controller deliberately owns exactly one qualified seam.
 * The Worker host remains available for other runtimes but is never instantiated
 * by this browser controller, preventing two campaign owners from acting on the
 * same product session.
 */
export const BROWSER_AGENT_CONTROLLER_STATUS = Object.freeze({
  available: true,
  name: 'SRA',
  status: 'bounded-browser-common-campaign',
  seam: 'browser-common-campaign',
} as const);

export type BrowserAgentControllerPhase =
  | 'idle'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'disposed';

export type BrowserAgentControllerStopReason =
  | 'manual'
  | 'replaced'
  | 'not-started'
  | 'not-ready'
  | 'none'
  | 'ambiguous'
  | 'pending'
  | 'blocked'
  | 'terminal'
  | 'stale'
  | 'action-limit'
  | 'error'
  | 'disposed';

export interface BrowserAgentControllerSnapshot {
  seam: typeof BROWSER_AGENT_CONTROLLER_STATUS.seam;
  phase: BrowserAgentControllerPhase;
  sessionId: string | null;
  stopReason: BrowserAgentControllerStopReason | null;
  campaignStatus: BrowserCampaignHostResult['status'] | null;
  actionsDispatched: number;
}

export interface BrowserAgentControllerPorts extends BrowserCampaignDispatchPorts {
  /** Return the live product state; copied snapshots are intentionally rejected. */
  readState(): ProductReadinessState;
  /** Give rendering and mode-change events a turn between accepted actions. */
  yieldToBrowser?(): Promise<void>;
}

export type BrowserAgentCampaignHost = Pick<
  BrowserCommonCampaignHost,
  'begin' | 'run' | 'cancel' | 'dispose' | 'currentGameObservation'
>;

export interface BrowserAgentControllerOptions {
  createHost?: () => BrowserAgentCampaignHost;
  makeSessionId?: (observation: GameObservation, ordinal: number) => string;
  maxActions?: number;
  onStateChange?(snapshot: BrowserAgentControllerSnapshot): void;
  onError?(error: unknown, snapshot: BrowserAgentControllerSnapshot): void;
}

function terminal(observation: ProductReadinessState['observation']): boolean {
  return Boolean(observation && [
    'WIN',
    'LEVEL_COMPLETE',
    'GAME_OVER',
    'GAMEOVER',
  ].includes(observation.state));
}

function stopReasonFor(result: BrowserCampaignHostResult): BrowserAgentControllerStopReason {
  if (result.status === 'not-ready') {
    return result.reason === 'stale-product-observation' ? 'stale' : 'not-ready';
  }
  if (result.status === 'not-started') return 'not-started';
  if (result.status === 'none') return 'none';
  if (result.status === 'ambiguous') return 'ambiguous';
  if (result.status === 'pending') return 'pending';
  if (result.status === 'blocked') return 'blocked';
  return result.dispatch?.stale ? 'stale' : 'not-ready';
}

function stopPriority(reason: BrowserAgentControllerStopReason): number {
  if (reason === 'disposed') return 3;
  if (reason === 'replaced') return 2;
  if (reason === 'manual') return 1;
  return 0;
}

/**
 * Own a bounded, single-seam browser Agent session.
 *
 * The controller never chooses an action itself. It repeatedly asks the
 * qualified CommonCampaignOwner host for one already-authorized action and
 * stops immediately when the host reports no proposal, ambiguity, a blocked
 * release, stale product state, a terminal observation, an error or the hard
 * action bound.
 */
export class BrowserAgentController {
  readonly #createHost: () => BrowserAgentCampaignHost;
  readonly #makeSessionId: NonNullable<BrowserAgentControllerOptions['makeSessionId']>;
  readonly #maxActions: number;
  readonly #onStateChange?: BrowserAgentControllerOptions['onStateChange'];
  readonly #onError?: BrowserAgentControllerOptions['onError'];

  #host: BrowserAgentCampaignHost | null = null;
  #phase: BrowserAgentControllerPhase = 'idle';
  #sessionId: string | null = null;
  #stopReason: BrowserAgentControllerStopReason | null = null;
  #requestedStop: BrowserAgentControllerStopReason | null = null;
  #campaignStatus: BrowserCampaignHostResult['status'] | null = null;
  #actionsDispatched = 0;
  #sessionOrdinal = 0;
  #runPromise: Promise<BrowserAgentControllerSnapshot> | null = null;
  #disposed = false;

  constructor(options: BrowserAgentControllerOptions = {}) {
    this.#createHost = options.createHost ?? (() => createPublicSingleActionBrowserCampaignHost());
    this.#makeSessionId = options.makeSessionId
      ?? ((observation, ordinal) => `browser-agent:${observation.gameCode}:${ordinal}`);
    this.#maxActions = options.maxActions ?? 64;
    if (!Number.isInteger(this.#maxActions) || this.#maxActions <= 0) {
      throw new RangeError('browser agent maxActions must be a positive integer');
    }
    this.#onStateChange = options.onStateChange;
    this.#onError = options.onError;
  }

  activate(
    observation: GameObservation,
    ports: BrowserAgentControllerPorts,
  ): Promise<BrowserAgentControllerSnapshot> {
    if (this.#disposed) {
      return Promise.resolve(this.snapshot());
    }

    if (this.#runPromise) {
      if (this.#requestedStop === 'manual') {
        this.#requestedStop = null;
        this.#stopReason = null;
        this.#phase = 'running';
        this.#emit();
      }
      return this.#runPromise;
    }

    if (terminal(observation)) {
      this.#phase = 'stopped';
      this.#stopReason = 'terminal';
      this.#campaignStatus = null;
      this.#actionsDispatched = 0;
      this.#emit();
      return Promise.resolve(this.snapshot());
    }

    const liveState = ports.readState();
    if (liveState.observation !== observation
      || liveState.selectedGameCode !== observation.gameCode
      || liveState.busy
      || liveState.loading
      || liveState.failed) {
      this.#phase = 'stopped';
      this.#stopReason = liveState.observation === observation ? 'not-ready' : 'stale';
      this.#campaignStatus = null;
      this.#actionsDispatched = 0;
      this.#emit();
      return Promise.resolve(this.snapshot());
    }

    const ordinal = ++this.#sessionOrdinal;
    const sessionId = this.#makeSessionId(observation, ordinal);
    if (!sessionId) throw new TypeError('browser agent session id must be non-empty');

    const host = this.#createHost();
    host.begin({ sessionId, observation });
    this.#host = host;
    this.#sessionId = sessionId;
    this.#stopReason = null;
    this.#requestedStop = null;
    this.#campaignStatus = null;
    this.#actionsDispatched = 0;
    this.#phase = 'running';
    this.#emit();

    const run = this.#run(host, ports);
    this.#runPromise = run.finally(() => {
      if (this.#runPromise === run || this.#runPromise) this.#runPromise = null;
    });
    return this.#runPromise;
  }

  /**
   * Request a graceful mode stop. An action already in flight is allowed to
   * return, be acquired and be presented before ownership returns to Manual.
   */
  deactivate(reason: 'manual' | 'replaced' = 'manual'): BrowserAgentControllerSnapshot {
    if (this.#disposed) return this.snapshot();
    if (!this.#runPromise) {
      this.#disposeHost();
      this.#phase = 'stopped';
      this.#stopReason = reason;
      this.#requestedStop = null;
      this.#emit();
      return this.snapshot();
    }

    if (!this.#requestedStop || stopPriority(reason) > stopPriority(this.#requestedStop)) {
      this.#requestedStop = reason;
    }
    this.#phase = 'stopping';
    this.#stopReason = this.#requestedStop;
    this.#emit();
    return this.snapshot();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#requestedStop = 'disposed';
    this.#host?.cancel();
    this.#disposeHost();
    this.#phase = 'disposed';
    this.#stopReason = 'disposed';
    this.#emit();
  }

  snapshot(): BrowserAgentControllerSnapshot {
    return {
      seam: BROWSER_AGENT_CONTROLLER_STATUS.seam,
      phase: this.#phase,
      sessionId: this.#sessionId,
      stopReason: this.#stopReason,
      campaignStatus: this.#campaignStatus,
      actionsDispatched: this.#actionsDispatched,
    };
  }

  get running(): boolean {
    return this.#phase === 'running' || this.#phase === 'stopping';
  }

  async #run(
    host: BrowserAgentCampaignHost,
    ports: BrowserAgentControllerPorts,
  ): Promise<BrowserAgentControllerSnapshot> {
    try {
      while (!this.#disposed && this.#host === host) {
        if (this.#requestedStop) return this.#finish(this.#requestedStop);
        if (this.#actionsDispatched >= this.#maxActions) return this.#finish('action-limit');

        const state = ports.readState();
        if (terminal(state.observation)) return this.#finish('terminal');

        const result = await host.run(state, ports);
        this.#campaignStatus = result.status;

        if (result.status !== 'action') {
          return this.#finish(stopReasonFor(result));
        }

        if (result.dispatch?.elapsedMs !== null && result.dispatch !== null) {
          this.#actionsDispatched += 1;
        }
        this.#emit();

        if (this.#requestedStop) return this.#finish(this.#requestedStop);
        if (!result.dispatch?.accepted) return this.#finish(stopReasonFor(result));

        const current = host.currentGameObservation ?? ports.readState().observation;
        if (terminal(current)) return this.#finish('terminal');
        if (this.#actionsDispatched >= this.#maxActions) return this.#finish('action-limit');

        await ports.yieldToBrowser?.();
      }
      return this.#finish(this.#disposed ? 'disposed' : 'replaced');
    } catch (error) {
      const snapshot = this.#finish('error');
      this.#onError?.(error, snapshot);
      return snapshot;
    }
  }

  #finish(reason: BrowserAgentControllerStopReason): BrowserAgentControllerSnapshot {
    this.#disposeHost();
    this.#requestedStop = null;
    this.#phase = reason === 'error' ? 'error' : reason === 'disposed' ? 'disposed' : 'stopped';
    this.#stopReason = reason;
    this.#emit();
    return this.snapshot();
  }

  #disposeHost(): void {
    const host = this.#host;
    this.#host = null;
    host?.dispose();
  }

  #emit(): void {
    this.#onStateChange?.(this.snapshot());
  }
}
