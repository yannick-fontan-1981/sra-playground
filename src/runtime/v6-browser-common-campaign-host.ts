import {
  dispatchProductAction,
  ready as productReady,
  type DispatchPorts,
  type DispatchResult,
  type ProductReadinessState,
  type XYActionData,
} from '../agent-product-dispatch.ts';
import {
  CommonCampaignOwner,
  type CampaignPrepareResult,
  type CampaignReturnReceipt,
  type CommonCampaignOwnerOptions,
} from '../logos-engine/v6-common-campaign-owner.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import type { AgentObservation } from './contracts.ts';
import type { GameObservation } from './browser-games.ts';
import { BrowserAgentObservationStream } from './v6-browser-agent-observation.ts';

export interface BrowserCampaignObservationPair {
  sessionId: string;
  gameObservation: GameObservation;
  agentObservation: AgentObservation;
}

export type BrowserCampaignActionPreparation = Extract<
  CampaignPrepareResult,
  { status: 'action' }
>;

export interface BrowserCampaignReturnPair {
  sessionId: string;
  preparation: BrowserCampaignActionPreparation;
  beforeGameObservation: GameObservation;
  beforeAgentObservation: AgentObservation;
  afterGameObservation: GameObservation;
  afterAgentObservation: AgentObservation;
}

/**
 * Product/browser transport owned by one already-registered symbolic owner.
 *
 * It only translates public observations into that owner's declared context and
 * return payload. It does not rank proposals, synthesize bundles or gain release
 * authority.
 */
export interface BrowserCampaignOwnerTransport {
  ownerId: string;
  context(input: BrowserCampaignObservationPair): unknown;
  returnPayload(input: BrowserCampaignReturnPair): unknown;
  /**
   * Observe a selected physical return only after the common campaign has routed
   * it to the exact owner, and before the product presents that return.
   *
   * This hook may update owner-local boundary or retention state. It must not
   * dispatch another action or gain release authority.
   */
  afterAcquire?(
    input: BrowserCampaignReturnPair,
    receipt: CampaignReturnReceipt,
  ): void;
}

export interface BrowserCampaignHostOptions {
  campaign: CommonCampaignOwner;
  ownerTransports: readonly BrowserCampaignOwnerTransport[];
  eventRef?(input: BrowserCampaignReturnPair): string;
}

export interface BrowserCampaignSessionInput {
  sessionId: string;
  observation: GameObservation;
  initialSequence?: number;
}

export interface BrowserCampaignDispatchPorts extends DispatchPorts<GameObservation> {
  onCampaignAcquired?(
    receipt: CampaignReturnReceipt,
    observation: AgentObservation,
  ): void;
}

export type BrowserCampaignHostStatus =
  | 'not-started'
  | 'not-ready'
  | CampaignPrepareResult['status'];

export interface BrowserCampaignHostResult {
  status: BrowserCampaignHostStatus;
  reason?: 'product-not-ready' | 'stale-product-observation';
  preparation: CampaignPrepareResult | null;
  dispatch: DispatchResult | null;
  acquisition: CampaignReturnReceipt | null;
  returnedObservation: AgentObservation | null;
}

interface ActiveBrowserCampaignSession {
  sessionId: string;
  stream: BrowserAgentObservationStream;
  gameObservation: GameObservation;
  agentObservation: AgentObservation;
}

function nonEmpty(value: string, label: string): void {
  if (!value) throw new TypeError(`${label} must be a non-empty string`);
}

function actionData(
  preparation: BrowserCampaignActionPreparation,
): XYActionData | undefined {
  return preparation.action.id === 6
    ? { x: preparation.action.data.x, y: preparation.action.data.y }
    : undefined;
}

function defaultEventRef(input: BrowserCampaignReturnPair): string {
  return [
    'browser-return',
    input.sessionId,
    input.afterAgentObservation.sequence,
    input.preparation.needId,
  ].join(':');
}

function cloneAgentObservation(observation: AgentObservation): AgentObservation {
  return {
    ...observation,
    image: {
      ...observation.image,
      pixels: observation.image.pixels.slice(),
    },
    availableActionIds: [...observation.availableActionIds],
  };
}

/**
 * Own the public product seam around CommonCampaignOwner.
 *
 * One cycle is deliberately ordered as:
 *
 * public observation -> owner contexts -> Logos preparation -> product dispatch
 * -> public return conversion -> correlated acquisition -> presentation.
 *
 * Therefore no next symbolic decision can be requested before the selected
 * owner has consumed the physical return carrying the same `needId`.
 */
export class BrowserCommonCampaignHost {
  readonly #campaign: CommonCampaignOwner;
  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();
  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;
  #active: ActiveBrowserCampaignSession | null = null;

  constructor(options: BrowserCampaignHostOptions) {
    this.#campaign = options.campaign;
    this.#eventRef = options.eventRef ?? defaultEventRef;

    const registered = new Set(this.#campaign.ownerIds);
    for (const transport of options.ownerTransports) {
      nonEmpty(transport.ownerId, 'browser campaign owner transport id');
      if (!registered.has(transport.ownerId)) {
        throw new Error(`browser campaign transport ${transport.ownerId} has no registered owner`);
      }
      if (this.#transports.has(transport.ownerId)) {
        throw new Error(`duplicate browser campaign transport ${transport.ownerId}`);
      }
      this.#transports.set(transport.ownerId, transport);
    }

    for (const ownerId of registered) {
      if (!this.#transports.has(ownerId)) {
        throw new Error(`registered campaign owner ${ownerId} has no browser transport`);
      }
    }
  }

  begin(input: BrowserCampaignSessionInput): AgentObservation {
    nonEmpty(input.sessionId, 'browser campaign session id');
    if (this.#active) this.#campaign.cancel(this.#active.sessionId);

    const stream = new BrowserAgentObservationStream({
      sessionId: input.sessionId,
      gameCode: input.observation.gameCode,
      initialSequence: input.initialSequence,
    });
    const agentObservation = stream.next(input.observation);
    this.#active = {
      sessionId: input.sessionId,
      stream,
      gameObservation: input.observation,
      agentObservation,
    };
    return cloneAgentObservation(agentObservation);
  }

  async run(
    state: ProductReadinessState,
    ports: BrowserCampaignDispatchPorts,
  ): Promise<BrowserCampaignHostResult> {
    const active = this.#active;
    if (!active) return this.#emptyResult('not-started');
    if (!productReady(state)) {
      return this.#emptyResult('not-ready', 'product-not-ready');
    }
    if (state.observation !== active.gameObservation) {
      return this.#emptyResult('not-ready', 'stale-product-observation');
    }

    const pair: BrowserCampaignObservationPair = {
      sessionId: active.sessionId,
      gameObservation: active.gameObservation,
      agentObservation: active.agentObservation,
    };
    const contextByOwner: Record<string, unknown> = {};
    for (const [ownerId, transport] of this.#transports) {
      contextByOwner[ownerId] = transport.context(pair);
    }

    const preparation = this.#campaign.prepare(
      active.agentObservation,
      contextByOwner,
    );
    if (preparation.status !== 'action') {
      return {
        status: preparation.status,
        preparation,
        dispatch: null,
        acquisition: null,
        returnedObservation: null,
      };
    }

    const transport = this.#transports.get(preparation.ownerId);
    if (!transport) {
      this.#campaign.cancel(active.sessionId);
      throw new Error(`selected campaign owner ${preparation.ownerId} has no browser transport`);
    }

    let acquisition: CampaignReturnReceipt | null = null;
    let returnedObservation: AgentObservation | null = null;
    let returnCommitted = false;

    try {
      const dispatch = await dispatchProductAction(
        state,
        preparation.action.id,
        actionData(preparation),
        {
          action: (action, data) => ports.action(action, data),
          present: async (next, generation) => {
            const converted = active.stream.next(next);
            const returnPair: BrowserCampaignReturnPair = {
              sessionId: active.sessionId,
              preparation,
              beforeGameObservation: active.gameObservation,
              beforeAgentObservation: active.agentObservation,
              afterGameObservation: next,
              afterAgentObservation: converted,
            };
            const eventRef = this.#eventRef(returnPair);
            nonEmpty(eventRef, 'browser campaign return event reference');
            acquisition = this.#campaign.acquire({
              sessionId: active.sessionId,
              needId: preparation.needId,
              eventRef,
              payload: transport.returnPayload(returnPair),
            });

            active.gameObservation = next;
            active.agentObservation = converted;
            returnedObservation = cloneAgentObservation(converted);
            returnCommitted = true;
            transport.afterAcquire?.(returnPair, acquisition);
            ports.onCampaignAcquired?.(acquisition, returnedObservation);

            await ports.present(next, generation);
          },
          now: () => ports.now(),
          generation: () => this.#active === active ? ports.generation() : Number.NaN,
          setBusy: value => ports.setBusy(value),
          onDispatchMeasured: elapsedMs => ports.onDispatchMeasured?.(elapsedMs),
          onError: (error, generation) => ports.onError?.(error, generation),
        },
      );

      if (!dispatch.accepted && !returnCommitted) {
        this.#campaign.cancel(active.sessionId);
      }
      return {
        status: 'action',
        preparation,
        dispatch,
        acquisition,
        returnedObservation,
      };
    } catch (error) {
      if (!returnCommitted) this.#campaign.cancel(active.sessionId);
      throw error;
    }
  }

  cancel(): boolean {
    const active = this.#active;
    if (!active) return false;
    return this.#campaign.cancel(active.sessionId);
  }

  dispose(): void {
    this.cancel();
    this.#active = null;
  }

  get sessionId(): string | null {
    return this.#active?.sessionId ?? null;
  }

  get currentGameObservation(): GameObservation | null {
    return this.#active?.gameObservation ?? null;
  }

  get currentAgentObservation(): AgentObservation | null {
    return this.#active
      ? cloneAgentObservation(this.#active.agentObservation)
      : null;
  }

  #emptyResult(
    status: 'not-started' | 'not-ready',
    reason?: BrowserCampaignHostResult['reason'],
  ): BrowserCampaignHostResult {
    return {
      status,
      ...(reason ? { reason } : {}),
      preparation: null,
      dispatch: null,
      acquisition: null,
      returnedObservation: null,
    };
  }
}

export interface PublicSingleActionBrowserCampaignHostOptions {
  campaign?: CommonCampaignOwnerOptions;
  eventRef?(input: BrowserCampaignReturnPair): string;
}

/**
 * Build the first bounded product-capable host using only the strict OP28 public
 * single-action owner. This remains a fallback seam, not a general SRA planner.
 */
export function createPublicSingleActionBrowserCampaignHost(
  options: PublicSingleActionBrowserCampaignHostOptions = {},
): BrowserCommonCampaignHost {
  const owner = new PublicSingleActionCallerOwnerAdapter();
  const campaign = new CommonCampaignOwner([owner], options.campaign);
  return new BrowserCommonCampaignHost({
    campaign,
    eventRef: options.eventRef,
    ownerTransports: [{
      ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
      context: input => ({ observation: input.agentObservation }),
      returnPayload: input => ({ observation: input.afterAgentObservation }),
    }],
  });
}