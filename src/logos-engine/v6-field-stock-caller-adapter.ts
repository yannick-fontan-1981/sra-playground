import type { AgentAction } from '../runtime/contracts.ts';
import { ObservedAddressedMaterialRuntime } from '../runtime/observed-addressed-material-runtime.ts';
import type {
  FieldStockDependencies,
  FieldStockProposal,
  FieldStockProposalResult,
} from './field-stock.ts';
import type { PublicFrameLike, PublicObservationLike } from './linked-preparation.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import type {
  CampaignLogosActionPayload,
  CampaignSelectedReturnEnvelope,
} from './v6-common-campaign-owner.ts';
import {
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from './v6-neutral-common-caller.ts';
import type { SymbolicRecord } from './v6-operations.ts';

export const FIELD_STOCK_CALLER_OWNER_ID = 'addressed_field_stock';

export interface FieldStockCampaignContext {
  sessionId: string;
  observation: PublicObservationLike;
  rows: readonly (readonly number[])[];
  remaining: number;
  dependencies: FieldStockDependencies;
}

export interface FieldStockCampaignReturnPayload {
  after: PublicObservationLike;
  rows: readonly (readonly number[])[];
}

export interface FieldStockCampaignAcquisitionReceipt {
  needId: string;
  eventRef: string;
  proposalRef: string;
  comparison: ReturnType<ObservedAddressedMaterialRuntime['afterStock']>;
  record: ReturnType<ObservedAddressedMaterialRuntime['recordStock']>;
}

interface FieldStockCampaignCorrelation {
  proposal: FieldStockProposalResult;
  stepIndex: number;
  before: PublicObservationLike;
  firstRows: readonly (readonly number[])[];
  command: { action_ref: string; data: { x: number; y: number } };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function context(value: unknown): FieldStockCampaignContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Partial<FieldStockCampaignContext>;
  if (!candidate.observation || !Array.isArray(candidate.rows) || !candidate.dependencies) {
    return undefined;
  }
  nonEmpty(candidate.sessionId, 'FieldStock campaign session id');
  if (!Number.isInteger(candidate.remaining) || Number(candidate.remaining) < 1) {
    throw new RangeError('FieldStock campaign remaining budget must be a positive integer');
  }
  return candidate as FieldStockCampaignContext;
}

function addressedAction(command: { action_ref: string; data: { x: number; y: number } }): AgentAction {
  if (command.action_ref !== 'ACTION6') {
    throw new Error('FieldStock common campaign currently admits only addressed ACTION6 proposals');
  }
  const { x, y } = command.data;
  if (![x, y].every(value => Number.isInteger(value) && value >= 0 && value < 64)) {
    throw new RangeError('FieldStock addressed coordinates must be integers in [0, 63]');
  }
  return { id: 6, data: { x, y } };
}

function publicFrame(
  observation: PublicObservationLike,
  rows: readonly (readonly number[])[],
): PublicFrameLike {
  return {
    frame_rows: rows,
    level: observation.level_epoch,
    levels_completed: observation.levels_completed,
    state: observation.state,
    frame_hash: observation.frame_hash,
    available_action_refs: observation.available_action_refs,
  };
}

function buildPayload(
  campaign: FieldStockCampaignContext,
  proposal: FieldStockProposalResult,
): CampaignLogosActionPayload {
  const firstCommand = proposal.actions[0];
  if (!firstCommand) throw new Error('FieldStock proposal has no action');
  const action = addressedAction(firstCommand);

  if (!Array.isArray(proposal.compositions) || proposal.compositions.length === 0) {
    throw new Error('FieldStock proposal has no symbolic composition');
  }
  const compositions = proposal.compositions as SymbolicRecord[];
  const focus = object(compositions[0], 'FieldStock focus composition');
  nonEmpty(focus.id, 'FieldStock focus composition id');

  const template = object(proposal.bundle_template, 'FieldStock bundle template');
  if (template.operation_key !== 'OP18') {
    throw new Error('FieldStock campaign requires an OP18 bundle template');
  }
  nonEmpty(template.objective_ref, 'FieldStock objective reference');
  if (!Array.isArray(template.evidence) || template.evidence.length === 0) {
    throw new Error('FieldStock bundle template requires evidence');
  }
  const preserveRefs = Array.isArray(template.preserve_refs)
    ? template.preserve_refs.map(value => String(value))
    : [];
  const preservationChanges = proposal.preservation_changes && typeof proposal.preservation_changes === 'object'
    ? proposal.preservation_changes as Record<string, unknown>
    : {};
  const preservationEvidence: Record<string, unknown> = {};
  for (const ref of preserveRefs) {
    if (!compositions.some(composition => String(composition.id) === ref)) {
      throw new Error(`FieldStock preservation reference ${ref} is outside the proposal domain`);
    }
    if (!Object.hasOwn(preservationChanges, ref)) {
      throw new Error(`FieldStock preservation reference ${ref} has no evidence`);
    }
    preservationEvidence[ref] = preservationChanges[ref];
  }

  const objectiveRef = template.objective_ref;
  const stateCompositions = compositions.map(item => structuredClone(item));
  if (!stateCompositions.some(composition => String(composition.id) === objectiveRef)) {
    stateCompositions.push({ id: objectiveRef, observed: true });
  }

  const proposalRef = `${String(focus.id)}:${campaign.observation.observation_ref}:step:0`;
  const bundleId = `bundle:${proposalRef}`;
  const facts = object(proposal.facts, 'FieldStock proposal facts');
  const outcomeGuard = object(template.outcome_guard, 'FieldStock outcome guard');
  const bundle: CompositionBundle = {
    ...template,
    id: bundleId,
    operation_key: 'OP18',
    composition_ref: String(focus.id),
    objective_ref: objectiveRef,
    preserve_refs: preserveRefs,
    observation_revision: campaign.observation.revision,
    kind: 'probe',
    actions: [action],
    purpose: String(template.purpose ?? 'measure the selected FieldStock question'),
    preconditions: facts,
    evidence: template.evidence,
    ...(preserveRefs.length ? { preservation_evidence: preservationEvidence } : {}),
    outcome_guard: outcomeGuard as { path: ['value']; contains: string },
  };

  const correlation: FieldStockCampaignCorrelation = {
    proposal: structuredClone(proposal),
    stepIndex: 0,
    before: structuredClone(campaign.observation),
    firstRows: structuredClone(campaign.rows),
    command: structuredClone(firstCommand),
  };
  return {
    action,
    bundle,
    state: {
      compositions: stateCompositions,
      facts,
    },
    identity: {
      episodeId: campaign.sessionId,
      levelEpoch: campaign.observation.level_epoch,
      observationId: campaign.observation.observation_ref,
      observationRevision: campaign.observation.revision,
    },
    correlation,
  };
}

function selectedEnvelope(value: unknown): CampaignSelectedReturnEnvelope {
  const envelope = object(value, 'FieldStock acquisition envelope') as unknown as CampaignSelectedReturnEnvelope;
  if (envelope.version !== 1 || typeof envelope.needId !== 'string' || !envelope.needId) {
    throw new TypeError('invalid FieldStock campaign return envelope');
  }
  if (envelope.proposal.ownerId !== FIELD_STOCK_CALLER_OWNER_ID) {
    throw new Error('FieldStock campaign return was routed to the wrong owner');
  }
  return envelope;
}

function correlation(value: unknown): FieldStockCampaignCorrelation {
  const candidate = object(value, 'FieldStock correlation') as unknown as FieldStockCampaignCorrelation;
  if (!candidate.proposal || !Array.isArray(candidate.proposal.actions)) {
    throw new TypeError('FieldStock correlation has no proposal');
  }
  if (!Number.isInteger(candidate.stepIndex) || candidate.stepIndex < 0) {
    throw new TypeError('FieldStock correlation has an invalid step index');
  }
  return candidate;
}

function returned(value: unknown): FieldStockCampaignReturnPayload {
  const candidate = object(value, 'FieldStock return payload') as unknown as FieldStockCampaignReturnPayload;
  if (!candidate.after || !Array.isArray(candidate.rows)) {
    throw new TypeError('FieldStock return payload requires after observation and rows');
  }
  return candidate;
}

/**
 * Connect one currently revalidated FieldStock to the neutral common caller.
 *
 * The adapter exposes only the first action of a bounded proposal. After the
 * public return, the specialized FieldStock comparison and recording functions
 * consume the correlated result before another proposal may be considered.
 */
export class FieldStockCallerOwnerAdapter implements CommonCallerOwner {
  readonly id = FIELD_STOCK_CALLER_OWNER_ID;

  constructor(
    readonly runtime: ObservedAddressedMaterialRuntime = new ObservedAddressedMaterialRuntime(),
  ) {}

  propose(value: unknown): CommonCallerProposal | undefined {
    const campaign = context(value);
    if (!campaign) return undefined;
    const proposal = this.runtime.proposeStock(
      campaign.observation,
      campaign.rows,
      campaign.remaining,
      campaign.dependencies,
    );
    if (!proposal || proposal.status !== 'proposed' || proposal.actions.length === 0) {
      return undefined;
    }

    const guard = this.runtime.beforeStock(
      proposal as unknown as FieldStockProposal,
      0,
      publicFrame(campaign.observation, campaign.rows),
      campaign.observation,
    );
    if (!guard.admitted) return undefined;

    const payload = buildPayload(campaign, proposal);
    return {
      ownerId: this.id,
      proposalRef: `${payload.bundle.composition_ref}:${campaign.observation.observation_ref}:step:0`,
      actionRef: 'ACTION6',
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): FieldStockCampaignAcquisitionReceipt {
    if (event.source !== 'selected') {
      throw new Error('FieldStock campaign owner accepts only selected returns');
    }
    const envelope = selectedEnvelope(event.payload);
    const linked = correlation(envelope.correlation);
    const result = returned(envelope.returnPayload);
    if (result.after.revision <= linked.before.revision) {
      throw new Error('FieldStock return revision must advance beyond the selected observation');
    }

    const comparison = this.runtime.afterStock(
      linked.proposal as unknown as FieldStockProposal,
      linked.stepIndex,
      linked.before,
      result.after,
      linked.firstRows,
      result.rows,
    );
    const recorded = this.runtime.recordStock(
      linked.before,
      result.after,
      linked.command,
      linked.firstRows,
      result.rows,
      linked.proposal as unknown as FieldStockProposal,
      linked.stepIndex,
    );
    return {
      needId: envelope.needId,
      eventRef: event.eventRef,
      proposalRef: envelope.proposal.proposalRef,
      comparison,
      record: recorded,
    };
  }
}
