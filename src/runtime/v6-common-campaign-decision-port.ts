import type { AgentAction, AgentObservation } from './contracts.ts';
import type { AgentDecisionPort } from './v6-agent-worker-core.ts';
import {
  completePublicCampaignEntities,
  measurePublicCampaignObservation,
  PUBLIC_FIELD_STOCK_DEPENDENCIES,
  type PublicCampaignObservation,
} from './v6-public-observation-measurement.ts';
import type { FieldStockDependencies } from '../logos-engine/field-stock.ts';
import {
  CommonCampaignOwner,
  type CampaignPrepareResult,
  type CampaignReturnReceipt,
} from '../logos-engine/v6-common-campaign-owner.ts';
import {
  FieldStockCallerOwnerAdapter,
  FIELD_STOCK_CALLER_OWNER_ID,
} from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  JOINT_CHANNEL_OWNER_ID,
  JointChannelOwner,
  type JointChannel,
} from '../logos-engine/v6-joint-channel-owner.ts';
import type { CommonCallerOwner } from '../logos-engine/v6-neutral-common-caller.ts';
import type { OperationResultCache } from '../logos-engine/v6-operation-cache.ts';
import type { OperationTraceSink } from '../logos-engine/v6-operation-trace.ts';
import {
  PublicSingleActionCallerOwnerAdapter,
  PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID,
} from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import {
  ObservedAddressedMaterialRuntime,
  type AddressedKnowledgeStatus,
} from './observed-addressed-material-runtime.ts';

export type PublicCampaignObservationMode = 'full' | 'agent-only';

export interface V6CommonCampaignDecisionPortOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
  /** Defaults to true. Disable only when no FieldStock owner consumes rows. */
  fieldStockEnabled?: boolean;
  /** Defaults to true. */
  publicSingleActionEnabled?: boolean;
  /** Defaults to full. Agent-only skips rows/entities and requires FieldStock disabled. */
  publicObservationMode?: PublicCampaignObservationMode;
  fieldStockRuntimeFactory?: () => ObservedAddressedMaterialRuntime;
  fieldStockDependencies?: FieldStockDependencies;
  fieldStockRemaining?: number;
  /** Optional bounded multi-channel owner; absent by default. */
  jointChannels?: readonly JointChannel[];
  /** Explicit public context for each joint channel on the current observation. */
  jointContextByChannel?: (
    current: PublicCampaignObservation,
  ) => Readonly<Record<string, unknown>>;
  additionalOwners?: readonly CommonCallerOwner[];
  additionalContextByOwner?: (
    current: PublicCampaignObservation,
  ) => Readonly<Record<string, unknown>>;
}

export type AddressedBoundaryReceipt = ReturnType<ObservedAddressedMaterialRuntime['boundary']>;

function cloneAgentObservation(source: AgentObservation): AgentObservation {
  return {
    ...source,
    image: {
      ...source.image,
      pixels: Uint8Array.from(source.image.pixels),
    },
    availableActionIds: [...source.availableActionIds],
  };
}

/**
 * Minimal public wrapper for owners that consume the validated AgentObservation
 * directly and do not need FieldStock rows, entities or a content frame hash.
 */
function measureAgentOnlyCampaignObservation(
  source: AgentObservation,
): PublicCampaignObservation {
  const agent = cloneAgentObservation(source);
  const observationRef = `public-observation:${agent.sessionId}:${agent.sequence}`;
  return {
    agent,
    observation: {
      observation_ref: observationRef,
      revision: agent.sequence,
      level_epoch: agent.level,
      levels_completed: agent.levelsCompleted,
      state: agent.state,
      frame_hash: `public-frame-not-materialized:${agent.sessionId}:${agent.sequence}`,
      available_action_refs: agent.availableActionIds.map(id => `ACTION${id}`),
    },
    rows: [],
  };
}

/**
 * Persistent worker-side host for the canonical CommonCampaignOwner.
 *
 * Every validated public observation is consumed before the worker applies its
 * terminal or decision-budget stop. This lets the host settle the previously
 * released action with the same needId, cross an official boundary and retain
 * knowledge even when no next action may be requested. Non-terminal observations
 * are then revalidated before the next proposal. The host never ranks ambiguous
 * proposals and never invents ACTION6 coordinates.
 *
 * A joint-channel owner is installed only when explicit channels are supplied.
 * It can collapse compatible contributions into one proposal, but an independent
 * owner proposal still makes the common campaign ambiguous.
 *
 * The optional agent-only mode is a bounded performance seam for owner sets
 * that consume only AgentObservation. It does not weaken public validation,
 * release authority, ambiguity handling or return acquisition. FieldStock must
 * be explicitly disabled because its contract requires rows and entity state.
 */
export class V6CommonCampaignDecisionPort implements AgentDecisionPort {
  readonly options: V6CommonCampaignDecisionPortOptions;
  #campaign!: CommonCampaignOwner;
  #fieldRuntime!: ObservedAddressedMaterialRuntime;
  #jointOwner: JointChannelOwner | undefined;
  #sessionId: string | null = null;
  #current: PublicCampaignObservation | undefined;
  #lastPrepare: CampaignPrepareResult | undefined;
  #lastAcquisition: CampaignReturnReceipt | undefined;
  #lastBoundary: AddressedBoundaryReceipt | undefined;
  #lastRevalidation: AddressedKnowledgeStatus | undefined;

  constructor(options: V6CommonCampaignDecisionPortOptions = {}) {
    this.options = options;
    if (options.fieldStockRemaining !== undefined
      && (!Number.isInteger(options.fieldStockRemaining) || options.fieldStockRemaining < 1)) {
      throw new RangeError('FieldStock remaining budget must be a positive integer');
    }
    if (this.#observationMode === 'agent-only' && this.#fieldStockEnabled) {
      throw new Error('agent-only public observation mode requires FieldStock to be disabled');
    }
    this.#rebuildCampaign();
  }

  initialize(sessionId: string, _seed: number): void {
    if (!sessionId) throw new TypeError('common campaign session id must be non-empty');
    this.#sessionId = sessionId;
    this.#current = undefined;
    this.#lastPrepare = undefined;
    this.#lastAcquisition = undefined;
    this.#lastBoundary = undefined;
    this.#lastRevalidation = undefined;
    this.#rebuildCampaign();
  }

  cancel(sessionId: string): void {
    if (this.#sessionId !== sessionId) return;
    this.#campaign.cancel(sessionId);
    this.#current = undefined;
    this.#sessionId = null;
  }

  observe(observation: AgentObservation): void {
    this.#assertSession(observation);
    if (this.#current?.agent.sequence === observation.sequence) return;
    if (this.#current && observation.sequence < this.#current.agent.sequence) {
      throw new Error('common campaign observation sequence moved backwards');
    }

    const previous = this.#current;
    let current = this.#measure(observation);
    const pending = this.#campaign.pending(observation.sessionId);
    if (pending) {
      if (!previous) {
        throw new Error('common campaign has a pending action without its prior public observation');
      }
      this.#lastAcquisition = this.#campaign.acquire({
        sessionId: observation.sessionId,
        needId: pending.needId,
        eventRef: current.observation.observation_ref,
        payload: this.#fieldStockEnabled
          ? {
              after: current.observation,
              rows: current.rows,
            }
          : {
              after: current.observation,
            },
      });
    } else {
      this.#lastAcquisition = undefined;
    }

    if (!this.#fieldStockEnabled) {
      this.#lastBoundary = undefined;
      this.#lastRevalidation = undefined;
      this.#current = current;
      this.#lastPrepare = undefined;
      return;
    }

    if (previous) {
      this.#lastBoundary = this.#fieldRuntime.boundary(
        previous.observation,
        current.observation,
      );
    } else {
      this.#lastBoundary = undefined;
    }

    if (observation.state === 'WIN') {
      this.#lastRevalidation = this.#fieldRuntime.status();
      this.#current = current;
      this.#lastPrepare = undefined;
      return;
    }

    if (this.#fieldRuntime.status() === 'retained_pending_revalidation') {
      current = completePublicCampaignEntities(current);
    }
    this.#lastRevalidation = this.#fieldRuntime.revalidate(
      current.observation,
      current.rows,
    );
    this.#current = current;
    this.#lastPrepare = undefined;
  }

  decide(
    observation: AgentObservation,
    _budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined {
    if (signal.aborted) return undefined;
    this.#assertSession(observation);
    if (this.#current?.agent.sequence !== observation.sequence) {
      this.observe(observation);
    }
    const current = this.#current;
    if (!current || current.agent.state === 'WIN' || signal.aborted) return undefined;

    const contexts: Record<string, unknown> = {
      ...(this.options.additionalContextByOwner?.(current) ?? {}),
    };
    if (this.#jointOwner) {
      contexts[JOINT_CHANNEL_OWNER_ID] = {
        observation: current.agent,
        contextByChannel: this.options.jointContextByChannel?.(current) ?? {},
      };
    }
    if (this.#fieldStockEnabled) {
      contexts[FIELD_STOCK_CALLER_OWNER_ID] = {
        sessionId: current.agent.sessionId,
        observation: current.observation,
        rows: current.rows,
        remaining: this.options.fieldStockRemaining ?? 16,
        dependencies: this.options.fieldStockDependencies ?? PUBLIC_FIELD_STOCK_DEPENDENCIES,
      };
    }
    if (this.#publicSingleActionEnabled) {
      contexts[PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID] = {
        observation: current.agent,
      };
    }

    const prepared = this.#campaign.prepare(current.agent, contexts);
    this.#lastPrepare = prepared;
    return prepared.status === 'action'
      ? structuredClone(prepared.action)
      : undefined;
  }

  get campaign(): CommonCampaignOwner {
    return this.#campaign;
  }

  get fieldRuntime(): ObservedAddressedMaterialRuntime {
    return this.#fieldRuntime;
  }

  get jointOwner(): JointChannelOwner | undefined {
    return this.#jointOwner;
  }

  get pendingDecision(): ReturnType<CommonCampaignOwner['pending']> {
    return this.#sessionId ? this.#campaign.pending(this.#sessionId) : undefined;
  }

  get lastPrepare(): CampaignPrepareResult | undefined {
    return this.#lastPrepare ? structuredClone(this.#lastPrepare) : undefined;
  }

  get lastAcquisition(): CampaignReturnReceipt | undefined {
    return this.#lastAcquisition ? structuredClone(this.#lastAcquisition) : undefined;
  }

  get lastBoundary(): AddressedBoundaryReceipt | undefined {
    return this.#lastBoundary ? structuredClone(this.#lastBoundary) : undefined;
  }

  get lastRevalidation(): AddressedKnowledgeStatus | undefined {
    return this.#lastRevalidation;
  }

  get #fieldStockEnabled(): boolean {
    return this.options.fieldStockEnabled !== false;
  }

  get #publicSingleActionEnabled(): boolean {
    return this.options.publicSingleActionEnabled !== false;
  }

  get #observationMode(): PublicCampaignObservationMode {
    return this.options.publicObservationMode ?? 'full';
  }

  #measure(observation: AgentObservation): PublicCampaignObservation {
    return this.#observationMode === 'agent-only'
      ? measureAgentOnlyCampaignObservation(observation)
      : measurePublicCampaignObservation(observation);
  }

  #assertSession(observation: AgentObservation): void {
    if (!this.#sessionId || observation.sessionId !== this.#sessionId) {
      throw new Error('common campaign observation does not belong to the initialized session');
    }
  }

  #rebuildCampaign(): void {
    this.#fieldRuntime = this.options.fieldStockRuntimeFactory?.()
      ?? new ObservedAddressedMaterialRuntime();
    this.#jointOwner = this.options.jointChannels && this.options.jointChannels.length > 0
      ? new JointChannelOwner(this.options.jointChannels)
      : undefined;
    const owners: CommonCallerOwner[] = [
      ...(this.#fieldStockEnabled ? [new FieldStockCallerOwnerAdapter(this.#fieldRuntime)] : []),
      ...(this.#jointOwner ? [this.#jointOwner] : []),
      ...(this.#publicSingleActionEnabled ? [new PublicSingleActionCallerOwnerAdapter()] : []),
      ...(this.options.additionalOwners ?? []),
    ];
    this.#campaign = new CommonCampaignOwner(owners, {
      trace: this.options.trace,
      cache: this.options.cache,
    });
  }
}
