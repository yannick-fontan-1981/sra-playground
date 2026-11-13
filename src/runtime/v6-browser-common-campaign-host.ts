import {
  dispatchProductAction,
  ready as productReady,
  type DispatchPorts,
  type DispatchResult,
  type ProductReadinessState,
  type XYActionData,
} from '../agent-product-dispatch.ts';
import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';
import {
  CommonCampaignCheckpointCoordinator,
  type CommonCampaignCheckpointParticipant,
  type CommonCampaignCheckpointV1,
} from '../logos-engine/v6-common-campaign-checkpoint.ts';
import {
  CommonCampaignOwner,
  type CampaignPrepareResult,
  type CampaignReturnReceipt,
  type CommonCampaignOwnerOptions,
} from '../logos-engine/v6-common-campaign-owner.ts';
import {
  FieldStockCallerOwnerAdapter,
  FIELD_STOCK_CALLER_OWNER_ID,
  type FieldStockCampaignContext,
} from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import type { AgentObservation } from './contracts.ts';
import type { GameObservation } from './browser-games.ts';
import { ObservedAddressedMaterialRuntime } from './observed-addressed-material-runtime.ts';
import {
  BrowserAgentObservationStream,
  toAgentObservationFromGame,
} from './v6-browser-agent-observation.ts';
import { PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES } from './v6-public-addressed-field-learning.ts';
import {
  completePublicCampaignEntities,
  measurePublicCampaignObservation,
  PUBLIC_FIELD_STOCK_DEPENDENCIES,
  type PublicCampaignObservation,
} from './v6-public-observation-measurement.ts';

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
   * Observe a physical return after the selected owner has acquired it and
   * before the product presents the observation. Passive owners may use this to
   * update retained public knowledge, but they may not acquire the selected
   * need or propose another action from this hook.
   */
  observeAcquiredReturn?(
    input: BrowserCampaignReturnPair,
    receipt: CampaignReturnReceipt,
  ): void;
}

export interface BrowserCampaignHostOptions {
  campaign: CommonCampaignOwner;
  ownerTransports: readonly BrowserCampaignOwnerTransport[];
  checkpointParticipants?: readonly CommonCampaignCheckpointParticipant[];
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

export interface BrowserCampaignPendingPhysicalReturnV1 {
  preparation: BrowserCampaignActionPreparation;
  beforeGameObservation: GameObservation;
  beforeAgentObservation: AgentObservation;
}

export interface BrowserCampaignHostCheckpointV1 {
  version: 1;
  sessionId: string;
  gameCode: string;
  nextSequence: number;
  currentGameObservation: GameObservation;
  currentAgentObservation: AgentObservation;
  campaign: CommonCampaignCheckpointV1;
  pendingPhysicalReturn: BrowserCampaignPendingPhysicalReturnV1 | null;
}

export type BrowserCampaignHostRestoreStatus =
  | 'restored'
  | 'pending-return-waiting'
  | 'pending-return-acquired';

export interface BrowserCampaignHostRestoreResult {
  status: BrowserCampaignHostRestoreStatus;
  sessionId: string;
  acquisition: CampaignReturnReceipt | null;
  returnedObservation: AgentObservation;
}

interface ActiveBrowserCampaignSession {
  sessionId: string;
  stream: BrowserAgentObservationStream;
  gameObservation: GameObservation;
  agentObservation: AgentObservation;
}

interface ActivePhysicalReturn extends BrowserCampaignPendingPhysicalReturnV1 {
  sent: boolean;
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

function cloneGameObservation(observation: GameObservation): GameObservation {
  return structuredClone(observation);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameAgentObservation(left: AgentObservation, right: AgentObservation): boolean {
  return left.protocolVersion === right.protocolVersion
    && left.sessionId === right.sessionId
    && left.sequence === right.sequence
    && left.image.width === right.image.width
    && left.image.height === right.image.height
    && left.image.pixelFormat === right.image.pixelFormat
    && sameNumbers(left.image.pixels, right.image.pixels)
    && sameNumbers(left.availableActionIds, right.availableActionIds)
    && left.state === right.state
    && left.level === right.level
    && left.levelsCompleted === right.levelsCompleted;
}

function sameAction(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function browserCampaignCheckpoint(value: unknown): BrowserCampaignHostCheckpointV1 {
  const source = objectValue(value, 'browser campaign checkpoint');
  if (source.version !== 1) throw new TypeError('unsupported browser campaign checkpoint version');
  nonEmpty(source.sessionId as string, 'browser campaign checkpoint session id');
  nonEmpty(source.gameCode as string, 'browser campaign checkpoint game code');
  if (!Number.isInteger(source.nextSequence) || (source.nextSequence as number) < 0) {
    throw new RangeError('browser campaign checkpoint next sequence must be non-negative');
  }
  objectValue(source.currentGameObservation, 'browser campaign checkpoint game observation');
  const currentAgent = objectValue(
    source.currentAgentObservation,
    'browser campaign checkpoint agent observation',
  );
  objectValue(currentAgent.image, 'browser campaign checkpoint agent image');
  objectValue(source.campaign, 'browser campaign checkpoint campaign state');
  if (source.pendingPhysicalReturn !== null) {
    const pending = objectValue(
      source.pendingPhysicalReturn,
      'browser campaign checkpoint pending physical return',
    );
    const preparation = objectValue(pending.preparation, 'browser pending preparation');
    if (preparation.status !== 'action') {
      throw new TypeError('browser pending preparation must be an action');
    }
    objectValue(pending.beforeGameObservation, 'browser pending game observation');
    objectValue(pending.beforeAgentObservation, 'browser pending agent observation');
  }
  return structuredClone(source) as unknown as BrowserCampaignHostCheckpointV1;
}

export interface BrowserFieldStockCampaignTransportOptions {
  runtime?: ObservedAddressedMaterialRuntime;
  dependencies?: FieldStockDependencies;
  remaining?: number;
}

/**
 * Translate the public browser observation stream into FieldStock contexts.
 *
 * With an empty runtime this transport remains a neutral owner and returns no
 * proposal. It may, however, observe an ACTION6 return already authorized for
 * another explicit owner and acquire a strictly supported local addressed model.
 * It never creates that action or its coordinates. Retained priors still require
 * fresh public revalidation before FieldStock can propose OP18.
 */
export class BrowserFieldStockCampaignTransport implements BrowserCampaignOwnerTransport {
  readonly ownerId = FIELD_STOCK_CALLER_OWNER_ID;
  readonly runtime: ObservedAddressedMaterialRuntime;
  readonly #dependencies: FieldStockDependencies;
  readonly #remaining: number;
  #sessionId: string | null = null;
  #current: PublicCampaignObservation | null = null;
  #lastBoundaryStatus: ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null = null;
  #lastRevalidationStatus: ReturnType<ObservedAddressedMaterialRuntime['revalidate']> | null = null;
  #lastAddressedLearningStatus: ReturnType<ObservedAddressedMaterialRuntime['observeAddressedReturn']> | null = null;

  constructor(options: BrowserFieldStockCampaignTransportOptions = {}) {
    this.runtime = options.runtime ?? new ObservedAddressedMaterialRuntime();
    this.#dependencies = options.dependencies ?? PUBLIC_FIELD_STOCK_DEPENDENCIES;
    this.#remaining = options.remaining ?? 64;
    if (!Number.isInteger(this.#remaining) || this.#remaining <= 0) {
      throw new RangeError('browser FieldStock remaining budget must be a positive integer');
    }
  }

  context(input: BrowserCampaignObservationPair): FieldStockCampaignContext {
    this.#acceptSession(input.sessionId);
    const measured = this.#consume(input.agentObservation);
    return {
      sessionId: input.sessionId,
      observation: measured.observation,
      rows: measured.rows,
      remaining: this.#remaining,
      dependencies: this.#dependencies,
    };
  }

  returnPayload(input: BrowserCampaignReturnPair): unknown {
    this.#acceptSession(input.sessionId);
    const measured = measurePublicCampaignObservation(input.afterAgentObservation);
    return {
      after: measured.observation,
      rows: measured.rows,
    };
  }

  observeAcquiredReturn(
    input: BrowserCampaignReturnPair,
    _receipt: CampaignReturnReceipt,
  ): void {
    this.#acceptSession(input.sessionId);
    this.#observeAddressedReturn(input);
    this.#consume(input.afterAgentObservation);
  }

  get lastBoundaryStatus(): ReturnType<ObservedAddressedMaterialRuntime['boundary']> | null {
    return this.#lastBoundaryStatus;
  }

  get lastRevalidationStatus(): ReturnType<ObservedAddressedMaterialRuntime['revalidate']> | null {
    return this.#lastRevalidationStatus;
  }

  get lastAddressedLearningStatus(): ReturnType<ObservedAddressedMaterialRuntime['observeAddressedReturn']> | null {
    return this.#lastAddressedLearningStatus;
  }

  get currentPublicObservation(): PublicCampaignObservation | null {
    return this.#current;
  }

  #acceptSession(sessionId: string): void {
    nonEmpty(sessionId, 'browser FieldStock session id');
    if (this.#sessionId === null) {
      this.#sessionId = sessionId;
      return;
    }
    if (this.#sessionId !== sessionId) {
      throw new Error('browser FieldStock transport cannot be reused across sessions');
    }
  }

  #observeAddressedReturn(input: BrowserCampaignReturnPair): void {
    const action = input.preparation.action;
    const sameScope = input.beforeAgentObservation.level === input.afterAgentObservation.level
      && input.beforeAgentObservation.levelsCompleted === input.afterAgentObservation.levelsCompleted
      && input.beforeAgentObservation.state === input.afterAgentObservation.state;
    const status = this.runtime.status();
    if (
      action.id !== 6
      || !sameScope
      || (status !== 'empty' && status !== 'active_local_model')
    ) {
      this.#lastAddressedLearningStatus = null;
      return;
    }

    const before = completePublicCampaignEntities(
      measurePublicCampaignObservation(input.beforeAgentObservation),
    );
    const after = completePublicCampaignEntities(
      measurePublicCampaignObservation(input.afterAgentObservation),
    );
    this.#lastAddressedLearningStatus = this.runtime.observeAddressedReturn(
      before.observation,
      after.observation,
      {
        action_ref: 'ACTION6',
        data: { x: action.data.x, y: action.data.y },
      },
      before.rows,
      after.rows,
      input.afterGameObservation.frames,
      PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES,
    );
  }

  #consume(source: AgentObservation): PublicCampaignObservation {
    const observationRef = `public-observation:${source.sessionId}:${source.sequence}`;
    if (this.#current?.observation.observation_ref === observationRef) {
      return this.#current;
    }

    let measured = measurePublicCampaignObservation(source);
    if (this.#current) {
      this.#lastBoundaryStatus = this.runtime.boundary(
        this.#current.observation,
        measured.observation,
      );
    }
    if (this.runtime.status() === 'retained_pending_revalidation') {
      measured = completePublicCampaignEntities(measured);
    }
    this.#lastRevalidationStatus = this.runtime.revalidate(
      measured.observation,
      measured.rows,
    );
    this.#current = measured;
    return measured;
  }
}

/**
 * Own the public product seam around CommonCampaignOwner.
 *
 * One cycle is deliberately ordered as:
 *
 * public observation -> owner contexts -> Logos preparation -> product dispatch
 * -> public return conversion -> correlated acquisition -> passive public return
 * observation -> presentation.
 *
 * Therefore no next symbolic decision can be requested before the selected
 * owner has consumed the physical return carrying the same `needId`.
 */
export class BrowserCommonCampaignHost {
  readonly #campaign: CommonCampaignOwner;
  readonly #checkpoint: CommonCampaignCheckpointCoordinator;
  readonly #transports = new Map<string, BrowserCampaignOwnerTransport>();
  readonly #eventRef: (input: BrowserCampaignReturnPair) => string;
  #active: ActiveBrowserCampaignSession | null = null;
  #pendingPhysicalReturn: ActivePhysicalReturn | null = null;

  constructor(options: BrowserCampaignHostOptions) {
    this.#campaign = options.campaign;
    this.#checkpoint = new CommonCampaignCheckpointCoordinator(
      this.#campaign,
      options.checkpointParticipants ?? [],
    );
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
    this.#pendingPhysicalReturn = null;

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

    const pendingPhysicalReturn: ActivePhysicalReturn = {
      preparation: structuredClone(preparation),
      beforeGameObservation: cloneGameObservation(active.gameObservation),
      beforeAgentObservation: cloneAgentObservation(active.agentObservation),
      sent: false,
    };
    this.#pendingPhysicalReturn = pendingPhysicalReturn;

    let acquisition: CampaignReturnReceipt | null = null;
    let returnedObservation: AgentObservation | null = null;
    let returnCommitted = false;

    try {
      const dispatch = await dispatchProductAction(
        state,
        preparation.action.id,
        actionData(preparation),
        {
          action: (action, data) => {
            if (this.#active !== active || this.#pendingPhysicalReturn !== pendingPhysicalReturn) {
              throw new Error('browser campaign action lost active ownership before dispatch');
            }
            pendingPhysicalReturn.sent = true;
            return ports.action(action, data);
          },
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
            if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {
              this.#pendingPhysicalReturn = null;
            }
            for (const observer of this.#transports.values()) {
              observer.observeAcquiredReturn?.(returnPair, acquisition);
            }
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
        if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {
          this.#pendingPhysicalReturn = null;
        }
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
      if (this.#pendingPhysicalReturn === pendingPhysicalReturn) {
        this.#pendingPhysicalReturn = null;
      }
      throw error;
    }
  }

  snapshot(): BrowserCampaignHostCheckpointV1 {
    const active = this.#active;
    if (!active) throw new Error('browser campaign host has no active session to checkpoint');

    const pendingCampaign = this.#campaign.pending(active.sessionId);
    const pendingPhysical = this.#pendingPhysicalReturn;
    if (pendingPhysical && !pendingPhysical.sent) {
      throw new Error('browser campaign cannot checkpoint before the physical action is sent');
    }
    if (Boolean(pendingCampaign) !== Boolean(pendingPhysical)) {
      throw new Error('browser campaign pending decision and physical return are inconsistent');
    }
    if (pendingCampaign && pendingPhysical) {
      if (pendingCampaign.needId !== pendingPhysical.preparation.needId
        || pendingCampaign.ownerId !== pendingPhysical.preparation.ownerId
        || pendingCampaign.proposalRef !== pendingPhysical.preparation.proposalRef
        || !sameAction(pendingCampaign.action, pendingPhysical.preparation.action)) {
        throw new Error('browser campaign pending physical identity changed');
      }
    }

    return {
      version: 1,
      sessionId: active.sessionId,
      gameCode: active.gameObservation.gameCode,
      nextSequence: active.stream.nextSequence,
      currentGameObservation: cloneGameObservation(active.gameObservation),
      currentAgentObservation: cloneAgentObservation(active.agentObservation),
      campaign: this.#checkpoint.snapshot(),
      pendingPhysicalReturn: pendingPhysical
        ? {
            preparation: structuredClone(pendingPhysical.preparation),
            beforeGameObservation: cloneGameObservation(pendingPhysical.beforeGameObservation),
            beforeAgentObservation: cloneAgentObservation(pendingPhysical.beforeAgentObservation),
          }
        : null,
    };
  }

  restore(
    value: unknown,
    observation: GameObservation,
  ): BrowserCampaignHostRestoreResult {
    if (this.#active) throw new Error('browser campaign restore requires a fresh host');
    const checkpoint = browserCampaignCheckpoint(value);
    if (observation.gameCode !== checkpoint.gameCode) {
      throw new Error('browser campaign checkpoint belongs to another game');
    }
    if (checkpoint.currentAgentObservation.sessionId !== checkpoint.sessionId) {
      throw new Error('browser campaign checkpoint agent observation belongs to another session');
    }
    if (checkpoint.nextSequence !== checkpoint.currentAgentObservation.sequence + 1) {
      throw new Error('browser campaign checkpoint sequence is not contiguous');
    }

    const storedFromGame = toAgentObservationFromGame(
      checkpoint.currentGameObservation,
      checkpoint.sessionId,
      checkpoint.currentAgentObservation.sequence,
    );
    if (!sameAgentObservation(storedFromGame, checkpoint.currentAgentObservation)) {
      throw new Error('browser campaign checkpoint observation identity is inconsistent');
    }

    const pendingPhysical = checkpoint.pendingPhysicalReturn;
    if (pendingPhysical) {
      if (!sameAgentObservation(
        pendingPhysical.beforeAgentObservation,
        checkpoint.currentAgentObservation,
      )) {
        throw new Error('browser pending return does not start from the checkpoint observation');
      }
      const pendingFromGame = toAgentObservationFromGame(
        pendingPhysical.beforeGameObservation,
        checkpoint.sessionId,
        checkpoint.currentAgentObservation.sequence,
      );
      if (!sameAgentObservation(pendingFromGame, checkpoint.currentAgentObservation)) {
        throw new Error('browser pending return game observation is inconsistent');
      }
    }

    const liveAtStoredSequence = toAgentObservationFromGame(
      observation,
      checkpoint.sessionId,
      checkpoint.currentAgentObservation.sequence,
    );
    const unchanged = sameAgentObservation(
      liveAtStoredSequence,
      checkpoint.currentAgentObservation,
    );
    if (!pendingPhysical && !unchanged) {
      throw new Error('browser campaign checkpoint does not match the current public observation');
    }

    const before = this.#checkpoint.snapshot();
    try {
      this.#checkpoint.restore(checkpoint.campaign);
      const stream = new BrowserAgentObservationStream({
        sessionId: checkpoint.sessionId,
        gameCode: checkpoint.gameCode,
        initialSequence: checkpoint.nextSequence,
      });
      this.#active = {
        sessionId: checkpoint.sessionId,
        stream,
        gameObservation: unchanged
          ? observation
          : cloneGameObservation(pendingPhysical!.beforeGameObservation),
        agentObservation: cloneAgentObservation(checkpoint.currentAgentObservation),
      };

      const restoredPending = this.#campaign.pending(checkpoint.sessionId);
      if (Boolean(restoredPending) !== Boolean(pendingPhysical)) {
        throw new Error('restored browser campaign pending state is inconsistent');
      }
      if (restoredPending && pendingPhysical) {
        if (restoredPending.needId !== pendingPhysical.preparation.needId
          || restoredPending.ownerId !== pendingPhysical.preparation.ownerId
          || restoredPending.proposalRef !== pendingPhysical.preparation.proposalRef
          || !sameAction(restoredPending.action, pendingPhysical.preparation.action)) {
          throw new Error('restored browser campaign pending identity changed');
        }
      }

      if (!pendingPhysical) {
        return {
          status: 'restored',
          sessionId: checkpoint.sessionId,
          acquisition: null,
          returnedObservation: cloneAgentObservation(checkpoint.currentAgentObservation),
        };
      }

      if (unchanged) {
        this.#pendingPhysicalReturn = {
          preparation: structuredClone(pendingPhysical.preparation),
          beforeGameObservation: cloneGameObservation(pendingPhysical.beforeGameObservation),
          beforeAgentObservation: cloneAgentObservation(pendingPhysical.beforeAgentObservation),
          sent: true,
        };
        return {
          status: 'pending-return-waiting',
          sessionId: checkpoint.sessionId,
          acquisition: null,
          returnedObservation: cloneAgentObservation(checkpoint.currentAgentObservation),
        };
      }

      const transport = this.#transports.get(pendingPhysical.preparation.ownerId);
      if (!transport) {
        throw new Error(`selected campaign owner ${pendingPhysical.preparation.ownerId} has no browser transport`);
      }
      const converted = stream.next(observation);
      const returnPair: BrowserCampaignReturnPair = {
        sessionId: checkpoint.sessionId,
        preparation: pendingPhysical.preparation,
        beforeGameObservation: pendingPhysical.beforeGameObservation,
        beforeAgentObservation: pendingPhysical.beforeAgentObservation,
        afterGameObservation: observation,
        afterAgentObservation: converted,
      };
      const eventRef = this.#eventRef(returnPair);
      nonEmpty(eventRef, 'browser campaign restored return event reference');
      const acquisition = this.#campaign.acquire({
        sessionId: checkpoint.sessionId,
        needId: pendingPhysical.preparation.needId,
        eventRef,
        payload: transport.returnPayload(returnPair),
      });
      this.#pendingPhysicalReturn = null;
      this.#active.gameObservation = observation;
      this.#active.agentObservation = converted;
      for (const observer of this.#transports.values()) {
        observer.observeAcquiredReturn?.(returnPair, acquisition);
      }
      return {
        status: 'pending-return-acquired',
        sessionId: checkpoint.sessionId,
        acquisition,
        returnedObservation: cloneAgentObservation(converted),
      };
    } catch (error) {
      this.#active = null;
      this.#pendingPhysicalReturn = null;
      this.#checkpoint.restore(before);
      throw error;
    }
  }

  cancel(): boolean {
    const active = this.#active;
    if (!active) return false;
    this.#pendingPhysicalReturn = null;
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

export interface FieldStockAndPublicSingleActionBrowserCampaignHostOptions
  extends PublicSingleActionBrowserCampaignHostOptions {
  fieldStockRuntime?: ObservedAddressedMaterialRuntime;
  fieldStockDependencies?: FieldStockDependencies;
  fieldStockRemaining?: number;
}

/**
 * Build the bounded product host with both the retained FieldStock OP18 owner and
 * the strict public OP28 fallback. The neutral campaign preserves zero, one and
 * multiple proposals exactly; no owner receives priority over another.
 */
export function createFieldStockAndPublicSingleActionBrowserCampaignHost(
  options: FieldStockAndPublicSingleActionBrowserCampaignHostOptions = {},
): BrowserCommonCampaignHost {
  const runtime = options.fieldStockRuntime ?? new ObservedAddressedMaterialRuntime();
  const fieldOwner = new FieldStockCallerOwnerAdapter(runtime);
  const publicOwner = new PublicSingleActionCallerOwnerAdapter();
  const fieldTransport = new BrowserFieldStockCampaignTransport({
    runtime,
    dependencies: options.fieldStockDependencies,
    remaining: options.fieldStockRemaining,
  });
  const campaign = new CommonCampaignOwner(
    [fieldOwner, publicOwner],
    options.campaign,
  );
  return new BrowserCommonCampaignHost({
    campaign,
    eventRef: options.eventRef,
    ownerTransports: [
      fieldTransport,
      {
        ownerId: PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
        context: input => ({ observation: input.agentObservation }),
        returnPayload: input => ({ observation: input.afterAgentObservation }),
      },
    ],
  });
}