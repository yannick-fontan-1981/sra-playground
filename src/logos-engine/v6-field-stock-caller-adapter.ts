import { isAgentAction, type AgentAction } from '../runtime/contracts.ts';
import { ObservedAddressedMaterialRuntime } from '../runtime/observed-addressed-material-runtime.ts';
import type {
  FieldStockDependencies,
  FieldStockProposal,
  FieldStockProposalResult,
  RetainedAddressedFieldPrior,
} from './field-stock.ts';
import type { PublicObservationLike } from './linked-preparation.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import {
  commonCampaignFeedbackPayload,
  commonCampaignProposalPayload,
  isCommonCampaignObservation,
  type CommonCampaignObservation,
  type CommonCampaignOwner,
  type CommonCampaignProposalPayload,
} from './v6-common-campaign-contracts.ts';
import type {
  CollectedProposal,
  CommonCallerAcquisition,
  CommonCallerProposal,
} from './v6-neutral-common-caller.ts';
import { releaseBundle, type AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';
import type { SymbolicRecord } from './v6-operations.ts';
import { digestPublicValue } from '../runtime/v6-public-observation-measurement.ts';

interface FieldStockCandidate {
  version: 1;
  kind: 'field_stock_candidate';
  action: AgentAction;
  command: { action_ref: string; data: { x: number; y: number } };
  proposal: FieldStockProposalResult & FieldStockProposal;
  stepIndex: number;
  bundle: CompositionBundle;
  state: SymbolicRecord;
  identity: AuthorityObservationIdentity;
}

interface AuthorizedFieldStockOwnerData {
  proposal: FieldStockProposalResult & FieldStockProposal;
  stepIndex: number;
  command: { action_ref: string; data: { x: number; y: number } };
}

export interface FieldStockFeedbackReceipt {
  ownerId: string;
  source: 'selected' | 'passive';
  needId: string | null;
  compare?: { matched: boolean | null; seal_prefix: boolean; reason: string };
  record?: ReturnType<ObservedAddressedMaterialRuntime['recordStock']>;
  boundary: ReturnType<ObservedAddressedMaterialRuntime['boundary']>;
  status: ReturnType<ObservedAddressedMaterialRuntime['status']>;
}

export interface FieldStockCallerOwnerOptions {
  initialPrior?: RetainedAddressedFieldPrior;
  remaining?: number;
  dependencies?: FieldStockDependencies;
  trace?: OperationTraceSink;
  cache?: OperationResultCache;
}

function candidate(value: unknown): FieldStockCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || item.kind !== 'field_stock_candidate') return null;
  if (!isAgentAction(item.action) || !item.proposal || typeof item.proposal !== 'object') return null;
  return item as unknown as FieldStockCandidate;
}

function ownerData(value: unknown): AuthorizedFieldStockOwnerData | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!item.proposal || typeof item.proposal !== 'object') return null;
  if (!Number.isInteger(item.stepIndex) || !item.command || typeof item.command !== 'object') return null;
  return item as unknown as AuthorizedFieldStockOwnerData;
}

function actionFrom(
  action: { action_ref: string; data: { x: number; y: number } },
): AgentAction | null {
  const match = /^ACTION([0-7])$/.exec(action.action_ref);
  if (!match) return null;
  const id = Number(match[1]);
  const candidateAction: unknown = id === 6
    ? { id, data: { x: action.data.x, y: action.data.y } }
    : { id };
  return isAgentAction(candidateAction) ? candidateAction : null;
}

function bundleFrom(
  proposal: FieldStockProposalResult,
  observation: PublicObservationLike,
): { bundle: CompositionBundle; state: SymbolicRecord } | null {
  const template = proposal.bundle_template;
  if (!template || typeof template !== 'object') return null;
  const values = template as Record<string, unknown>;
  const compositionRef = values.composition_ref;
  const objectiveRef = values.objective_ref;
  const purpose = values.purpose;
  const preconditions = values.preconditions;
  const evidence = values.evidence;
  const guard = values.outcome_guard;
  if (typeof compositionRef !== 'string'
    || typeof objectiveRef !== 'string'
    || typeof purpose !== 'string'
    || !preconditions || typeof preconditions !== 'object'
    || !Array.isArray(evidence)
    || !guard || typeof guard !== 'object') {
    return null;
  }
  const preserveRefs = Array.isArray(values.preserve_refs)
    ? values.preserve_refs.filter((item): item is string => typeof item === 'string')
    : [];
  const bundleId = `field-stock-bundle:${observation.observation_ref}:${digestPublicValue(proposal.actions).slice(0, 16)}`;
  const bundle: CompositionBundle = {
    ...values,
    id: bundleId,
    operation_key: 'OP18',
    composition_ref: compositionRef,
    objective_ref: objectiveRef,
    preserve_refs: preserveRefs,
    observation_revision: observation.revision,
    kind: 'probe',
    actions: structuredClone(proposal.actions),
    purpose,
    preconditions: structuredClone(preconditions as SymbolicRecord),
    evidence: structuredClone(evidence),
    outcome_guard: structuredClone(guard as { path: ['value']; contains: string }),
  };
  const compositions = Array.isArray(proposal.compositions)
    ? structuredClone(proposal.compositions as SymbolicRecord[])
    : [];
  return {
    bundle,
    state: {
      compositions: [
        { id: objectiveRef, observed: true },
        ...compositions,
      ],
      facts: structuredClone((proposal.facts ?? {}) as SymbolicRecord),
    },
  };
}

function officialBoundary(
  before: CommonCampaignObservation,
  after: CommonCampaignObservation,
): boolean {
  return before.observation.level_epoch !== after.observation.level_epoch
    || before.observation.levels_completed !== after.observation.levels_completed
    || before.observation.state !== after.observation.state;
}

function commandFrom(action: AgentAction | undefined): { action_ref: string; data?: Record<string, unknown> } | null {
  if (!action) return null;
  if (action.id === 6) return { action_ref: 'ACTION6', data: { ...action.data } };
  return { action_ref: `ACTION${action.id}` };
}

const defaultDependencies: FieldStockDependencies = {
  digest: digestPublicValue,
  makeLocusWitness(observation, _rows, point, reason, evidence) {
    return {
      observation_ref: observation.observation_ref,
      point: [...point],
      reason,
      evidence: [...evidence],
    };
  },
};

/**
 * Neutral-caller owner for the retained/revalidated FieldStock slice.
 *
 * It never creates a prior from visual resemblance. A prior must be explicitly
 * supplied or retained by the owned runtime across an observed official boundary.
 */
export class FieldStockCallerOwnerAdapter implements CommonCampaignOwner {
  readonly id = 'addressed_field_stock';
  readonly options: FieldStockCallerOwnerOptions;
  #runtime = new ObservedAddressedMaterialRuntime();

  constructor(options: FieldStockCallerOwnerOptions = {}) {
    this.options = options;
    this.reset();
  }

  get runtime(): ObservedAddressedMaterialRuntime {
    return this.#runtime;
  }

  reset(): void {
    this.#runtime = new ObservedAddressedMaterialRuntime();
    if (this.options.initialPrior) {
      this.#runtime.field.prior = structuredClone(this.options.initialPrior);
    }
  }

  propose(context: unknown): CommonCallerProposal | undefined {
    if (!isCommonCampaignObservation(context)) return undefined;
    this.#runtime.revalidate(context.observation, context.rows);
    const proposal = this.#runtime.proposeStock(
      context.observation,
      context.rows,
      this.options.remaining ?? 16,
      this.options.dependencies ?? defaultDependencies,
    );
    if (!proposal || proposal.status !== 'proposed' || proposal.actions.length === 0) return undefined;

    const typedProposal = proposal as FieldStockProposalResult & FieldStockProposal;
    const command = proposal.actions[0]!;
    const action = actionFrom(command);
    if (!action) return undefined;
    const before = this.#runtime.beforeStock(typedProposal, 0, context.publicFrame, context.observation);
    if (!before.admitted) return undefined;
    const prepared = bundleFrom(proposal, context.observation);
    if (!prepared) return undefined;

    const payload: FieldStockCandidate = {
      version: 1,
      kind: 'field_stock_candidate',
      action,
      command: structuredClone(command),
      proposal: structuredClone(typedProposal),
      stepIndex: 0,
      bundle: prepared.bundle,
      state: prepared.state,
      identity: {
        episodeId: context.agent.sessionId,
        levelEpoch: context.observation.level_epoch,
        observationId: context.observation.observation_ref,
        observationRevision: context.observation.revision,
      },
    };
    return {
      ownerId: this.id,
      proposalRef: `field-stock:${prepared.bundle.id}`,
      actionRef: command.action_ref,
      payload,
    };
  }

  authorize(
    proposal: CollectedProposal,
    context: CommonCampaignObservation,
  ): CommonCampaignProposalPayload | undefined {
    if (proposal.ownerId !== this.id) return undefined;
    const prepared = candidate(proposal.payload);
    if (!prepared) return undefined;
    if (prepared.identity.observationId !== context.observation.observation_ref
      || prepared.identity.observationRevision !== context.observation.revision) {
      return undefined;
    }
    const release = releaseBundle(
      prepared.bundle,
      prepared.state,
      prepared.identity,
      this.options.trace,
      this.options.cache,
    );
    if (!release.releaseAllowed) return undefined;
    return {
      version: 1,
      kind: 'field_stock',
      action: structuredClone(prepared.action),
      needId: release.need.needId,
      bundleId: prepared.bundle.id,
      ownerData: {
        proposal: structuredClone(prepared.proposal),
        stepIndex: prepared.stepIndex,
        command: structuredClone(prepared.command),
      } satisfies AuthorizedFieldStockOwnerData,
    };
  }

  acquire(event: CommonCallerAcquisition): FieldStockFeedbackReceipt {
    const feedback = commonCampaignFeedbackPayload(event.payload);
    if (!feedback) throw new TypeError('FieldStock feedback must use the common campaign contract');

    const crossed = officialBoundary(feedback.before, feedback.after);
    let compare: FieldStockFeedbackReceipt['compare'];
    let record: FieldStockFeedbackReceipt['record'];
    const selected = commonCampaignProposalPayload(feedback.selected?.payload);
    const selectedData = selected?.kind === 'field_stock' ? ownerData(selected.ownerData) : null;

    if (event.source === 'selected'
      && selectedData
      && selected?.needId === feedback.needId) {
      compare = this.#runtime.afterStock(
        selectedData.proposal,
        selectedData.stepIndex,
        feedback.before.observation,
        feedback.after.observation,
        feedback.before.rows,
        feedback.after.rows,
      );
      if (!crossed) {
        record = this.#runtime.recordStock(
          feedback.before.observation,
          feedback.after.observation,
          selectedData.command,
          feedback.before.rows,
          feedback.after.rows,
          selectedData.proposal,
          selectedData.stepIndex,
        );
      }
    } else if (!crossed && feedback.action?.id === 6 && this.#runtime.mayUseRetainedKnowledge()) {
      const command = commandFrom(feedback.action);
      if (command) {
        record = this.#runtime.recordStock(
          feedback.before.observation,
          feedback.after.observation,
          command,
          feedback.before.rows,
          feedback.after.rows,
        );
      }
    }

    const boundary = this.#runtime.boundary(
      feedback.before.observation,
      feedback.after.observation,
    );
    return {
      ownerId: this.id,
      source: event.source,
      needId: feedback.needId ?? null,
      ...(compare ? { compare } : {}),
      ...(record ? { record } : {}),
      boundary,
      status: this.#runtime.status(),
    };
  }
}
