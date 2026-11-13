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

export interface V6CommonCampaignDecisionPortOptions {
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
  fieldStockRuntimeFactory?: () => ObservedAddressedMaterialRuntime;
  fieldStockDependencies?: FieldStockDependencies;
  fieldStockRemaining?: number;
  additionalOwners?: readonly CommonCallerOwner[];
  additionalContextByOwner?: (
    current: PublicCampaignObservation,
  ) => Readonly<Record<string, unknown>>;
}

export type AddressedBoundaryReceipt = ReturnType<ObservedAddressedMaterialRuntime['boundary']>;

/**
 * Persistent worker-side host for the canonical CommonCampaignOwner.
 *
 * The next public observation first settles the previously released action,
 * preserving the same needId. Only after that return is consumed does this host
 * cross an official boundary, revalidate retained FieldStock knowledge and ask
 * for the next proposal. It never ranks ambiguous proposals and never invents
 * ACTION6 coordinates.
 */
export class V6CommonCampaignDecisionPort implements AgentDecisionPort {
  readonly options: V6CommonCampaignDecisionPortOptions;
  #campaign!: CommonCampaignOwner;
  #fieldRuntime!: ObservedAddressedMaterialRuntime;
  #sessionId: string | null = null;
  #previous: PublicCampaignObservation | undefined;
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
    this.#rebuildCampaign();
  }

  initialize(sessionId: string, _seed: number): void {
    if (!sessionId) throw new TypeError('common campaign session id must be non-empty');
    this.#sessionId = sessionId;
    this.#previous = undefined;
    this.#lastPrepare = undefined;
    this.#lastAcquisition = undefined;
    this.#lastBoundary = undefined;
    this.#lastRevalidation = undefined;
    this.#rebuildCampaign();
  }

  cancel(sessionId: string): void {
    if (this.#sessionId !== sessionId) return;
    this.#campaign.cancel(sessionId);
    this.#previous = undefined;
    this.#sessionId = null;
  }

  decide(
    observation: AgentObservation,
    _budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined {
    if (signal.aborted) return undefined;
    if (!this.#sessionId || observation.sessionId !== this.#sessionId) {
      throw new Error('common campaign observation does not belong to the initialized session');
    }

    let current = measurePublicCampaignObservation(observation);
    const pending = this.#campaign.pending(observation.sessionId);
    if (pending) {
      if (!this.#previous) {
        throw new Error('common campaign has a pending action without its prior public observation');
      }
      this.#lastAcquisition = this.#campaign.acquire({
        sessionId: observation.sessionId,
        needId: pending.needId,
        eventRef: current.observation.observation_ref,
        payload: {
          after: current.observation,
          rows: current.rows,
        },
      });
    } else {
      this.#lastAcquisition = undefined;
    }

    if (this.#previous) {
      this.#lastBoundary = this.#fieldRuntime.boundary(
        this.#previous.observation,
        current.observation,
      );
    } else {
      this.#lastBoundary = undefined;
    }

    if (this.#fieldRuntime.status() === 'retained_pending_revalidation') {
      current = completePublicCampaignEntities(current);
    }
    this.#lastRevalidation = this.#fieldRuntime.revalidate(
      current.observation,
      current.rows,
    );
    this.#previous = current;

    if (signal.aborted) return undefined;
    const extraContexts = this.options.additionalContextByOwner?.(current) ?? {};
    const prepared = this.#campaign.prepare(current.agent, {
      ...extraContexts,
      [FIELD_STOCK_CALLER_OWNER_ID]: {
        sessionId: current.agent.sessionId,
        observation: current.observation,
        rows: current.rows,
        remaining: this.options.fieldStockRemaining ?? 16,
        dependencies: this.options.fieldStockDependencies ?? PUBLIC_FIELD_STOCK_DEPENDENCIES,
      },
      [PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID]: {
        observation: current.agent,
      },
    });
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

  #rebuildCampaign(): void {
    this.#fieldRuntime = this.options.fieldStockRuntimeFactory?.()
      ?? new ObservedAddressedMaterialRuntime();
    const owners: CommonCallerOwner[] = [
      new FieldStockCallerOwnerAdapter(this.#fieldRuntime),
      new PublicSingleActionCallerOwnerAdapter(),
      ...(this.options.additionalOwners ?? []),
    ];
    this.#campaign = new CommonCampaignOwner(owners, {
      trace: this.options.trace,
      cache: this.options.cache,
    });
  }
}
