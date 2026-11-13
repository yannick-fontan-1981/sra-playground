import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from './contracts.ts';
import type { AgentDecisionPort } from './v6-agent-worker-core.ts';
import {
  FieldStockCallerOwnerAdapter,
  type FieldStockCallerOwnerOptions,
} from '../logos-engine/v6-field-stock-caller-adapter.ts';
import {
  commonCampaignProposalPayload,
  type CommonCampaignFeedbackPayload,
  type CommonCampaignObservation,
  type CommonCampaignOwner,
} from '../logos-engine/v6-common-campaign-contracts.ts';
import {
  NeutralCommonCaller,
  type CallerRouteReceipt,
  type CallerSelection,
  type CollectedProposal,
} from '../logos-engine/v6-neutral-common-caller.ts';
import { PublicSingleActionCallerOwnerAdapter } from '../logos-engine/v6-public-single-action-caller-adapter.ts';
import type { OperationResultCache } from '../logos-engine/v6-operation-cache.ts';
import type { OperationTraceSink } from '../logos-engine/v6-operation-trace.ts';
import { measurePublicCampaignObservation } from './v6-public-observation-measurement.ts';

export interface CommonCampaignDecisionPortOptions {
  fieldStock?: FieldStockCallerOwnerOptions;
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
  additionalOwners?: readonly CommonCampaignOwner[];
}

export interface PendingCommonCampaignDecision {
  selected: CollectedProposal;
  action: AgentAction;
  needId: string;
  bundleId: string;
  before: CommonCampaignObservation;
}

function eventRef(
  kind: 'return' | 'advance',
  before: CommonCampaignObservation,
  after: CommonCampaignObservation,
  suffix = '',
): string {
  return [
    `common-campaign-${kind}`,
    before.agent.sessionId,
    before.agent.sequence,
    after.agent.sequence,
    suffix,
  ].filter(Boolean).join(':');
}

/**
 * Persistent public campaign owner for the reconstructed worker.
 *
 * The neutral caller alone decides cardinality. Owner-specific OP18/OP28
 * authorization occurs only after exactly one proposal was selected. The next
 * public observation is then routed to the selected owner with the same needId,
 * and to the other owners as passive evidence.
 */
export class V6CommonCampaignDecisionPort implements AgentDecisionPort {
  readonly options: CommonCampaignDecisionPortOptions;
  #caller = new NeutralCommonCaller();
  #owners = new Map<string, CommonCampaignOwner>();
  #sessionId: string | null = null;
  #previous: CommonCampaignObservation | undefined;
  #pending: PendingCommonCampaignDecision | undefined;
  #lastSelection: CallerSelection = { status: 'none', proposals: [] };
  #lastFeedbackReceipts: CallerRouteReceipt[] = [];

  constructor(options: CommonCampaignDecisionPortOptions = {}) {
    this.options = options;
    this.#installOwners();
  }

  initialize(sessionId: string): void {
    this.#sessionId = sessionId;
    this.#previous = undefined;
    this.#pending = undefined;
    this.#lastSelection = { status: 'none', proposals: [] };
    this.#lastFeedbackReceipts = [];
    this.#caller = new NeutralCommonCaller();
    for (const owner of this.#owners.values()) {
      owner.reset?.();
      this.#caller.register(owner);
    }
  }

  cancel(sessionId: string): void {
    if (this.#sessionId === sessionId) {
      this.#pending = undefined;
      this.#previous = undefined;
    }
  }

  decide(
    observation: AgentObservation,
    _budgetMs: number,
    signal: AbortSignal,
  ): AgentAction | undefined {
    if (signal.aborted) return undefined;
    if (this.#sessionId !== observation.sessionId) {
      throw new Error('common campaign observation does not belong to the initialized session');
    }
    const current = measurePublicCampaignObservation(observation);
    this.#routePrevious(current);
    if (signal.aborted) return undefined;

    const contexts = Object.fromEntries(
      [...this.#owners.keys()].map(ownerId => [ownerId, current]),
    );
    const proposals = this.#caller.collect(contexts);
    const selection = this.#caller.select(proposals);
    this.#lastSelection = structuredClone(selection);
    this.#previous = current;
    this.#pending = undefined;
    if (selection.status !== 'selected' || !selection.selected) return undefined;

    const owner = this.#owners.get(selection.selected.ownerId);
    if (!owner) throw new Error(`selected common campaign owner ${selection.selected.ownerId} is unavailable`);
    const authorized = owner.authorize(selection.selected, current);
    if (!authorized || !isAgentAction(authorized.action)) return undefined;
    if (!current.agent.availableActionIds.includes(authorized.action.id)) return undefined;

    const selected: CollectedProposal = {
      ...structuredClone(selection.selected),
      payload: structuredClone(authorized),
    };
    const payload = commonCampaignProposalPayload(selected.payload);
    if (!payload) return undefined;
    this.#pending = {
      selected,
      action: structuredClone(payload.action),
      needId: payload.needId,
      bundleId: payload.bundleId,
      before: current,
    };
    return structuredClone(payload.action);
  }

  get pendingDecision(): PendingCommonCampaignDecision | undefined {
    return this.#pending ? structuredClone(this.#pending) : undefined;
  }

  get lastSelection(): CallerSelection {
    return structuredClone(this.#lastSelection);
  }

  get lastFeedbackReceipts(): CallerRouteReceipt[] {
    return structuredClone(this.#lastFeedbackReceipts);
  }

  get fieldStockOwner(): FieldStockCallerOwnerAdapter {
    const owner = this.#owners.get('addressed_field_stock');
    if (!(owner instanceof FieldStockCallerOwnerAdapter)) {
      throw new Error('FieldStock owner is not installed');
    }
    return owner;
  }

  #installOwners(): void {
    const field = new FieldStockCallerOwnerAdapter({
      ...this.options.fieldStock,
      trace: this.options.fieldStock?.trace ?? this.options.trace,
      cache: this.options.fieldStock?.cache ?? this.options.cache,
    });
    const publicAction = new PublicSingleActionCallerOwnerAdapter({
      trace: this.options.trace,
      cache: this.options.cache,
    });
    const owners: CommonCampaignOwner[] = [field, publicAction, ...(this.options.additionalOwners ?? [])];
    this.#owners.clear();
    this.#caller = new NeutralCommonCaller();
    for (const owner of owners) {
      if (this.#owners.has(owner.id)) throw new Error(`duplicate common campaign owner ${owner.id}`);
      this.#owners.set(owner.id, owner);
      this.#caller.register(owner);
    }
  }

  #routePrevious(current: CommonCampaignObservation): void {
    this.#lastFeedbackReceipts = [];
    if (this.#pending) {
      const pending = this.#pending;
      const feedback: CommonCampaignFeedbackPayload = {
        version: 1,
        kind: 'action_return',
        needId: pending.needId,
        action: structuredClone(pending.action),
        selected: structuredClone(pending.selected),
        before: pending.before,
        after: current,
      };
      const selectedSelection: CallerSelection = {
        status: 'selected',
        selected: pending.selected,
        proposals: [pending.selected],
      };
      const ref = eventRef('return', pending.before, current, pending.needId);
      this.#lastFeedbackReceipts.push(
        this.#caller.routeSelected(selectedSelection, ref, feedback),
      );
      const passiveOwnerIds = this.#caller.ownerIds.filter(ownerId => ownerId !== pending.selected.ownerId);
      if (passiveOwnerIds.length) {
        const payloads = Object.fromEntries(passiveOwnerIds.map(ownerId => [ownerId, feedback]));
        this.#lastFeedbackReceipts.push(...this.#caller.routePassive(passiveOwnerIds, ref, payloads));
      }
      return;
    }
    if (!this.#previous) return;

    const feedback: CommonCampaignFeedbackPayload = {
      version: 1,
      kind: 'observation_advance',
      before: this.#previous,
      after: current,
    };
    const ref = eventRef('advance', this.#previous, current);
    const ownerIds = this.#caller.ownerIds;
    const payloads = Object.fromEntries(ownerIds.map(ownerId => [ownerId, feedback]));
    this.#lastFeedbackReceipts.push(...this.#caller.routePassive(ownerIds, ref, payloads));
  }
}
