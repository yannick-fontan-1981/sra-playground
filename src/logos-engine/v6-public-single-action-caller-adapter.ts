import type { AgentAction } from '../runtime/contracts.ts';
import type { OperationResultCache } from './v6-operation-cache.ts';
import type { OperationTraceSink } from './v6-operation-trace.ts';
import {
  commonCampaignFeedbackPayload,
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
import { releaseBundle } from './v6-native-authority.ts';
import {
  preparePublicSingleActionDecision,
  type PublicSingleActionPreparation,
} from './v6-public-single-action-port.ts';

interface PublicSingleActionCandidate {
  version: 1;
  kind: 'public_single_action_candidate';
  preparation: PublicSingleActionPreparation;
}

export interface PublicSingleActionFeedbackReceipt {
  ownerId: string;
  source: 'selected' | 'passive';
  needId: string | null;
  beforeObservationRef: string;
  afterObservationRef: string;
}

function candidate(value: unknown): PublicSingleActionCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (item.version !== 1 || item.kind !== 'public_single_action_candidate') return null;
  if (!item.preparation || typeof item.preparation !== 'object') return null;
  return item as unknown as PublicSingleActionCandidate;
}

function actionRef(action: AgentAction): string {
  return `ACTION${action.id}`;
}

/** Neutral-caller adapter for the already-qualified bounded OP28 producer. */
export class PublicSingleActionCallerOwnerAdapter implements CommonCampaignOwner {
  readonly id = 'public_single_action';

  constructor(readonly options: {
    trace?: OperationTraceSink;
    cache?: OperationResultCache;
  } = {}) {}

  propose(context: unknown): CommonCallerProposal | undefined {
    if (!isCommonCampaignObservation(context)) return undefined;
    const preparation = preparePublicSingleActionDecision(context.agent);
    if (!preparation) return undefined;
    return {
      ownerId: this.id,
      proposalRef: `public-single-action:${preparation.bundle.id}`,
      actionRef: actionRef(preparation.action),
      payload: {
        version: 1,
        kind: 'public_single_action_candidate',
        preparation,
      } satisfies PublicSingleActionCandidate,
    };
  }

  authorize(
    proposal: CollectedProposal,
    context: CommonCampaignObservation,
  ): CommonCampaignProposalPayload | undefined {
    if (proposal.ownerId !== this.id) return undefined;
    const prepared = candidate(proposal.payload)?.preparation;
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
      kind: 'public_single_action',
      action: structuredClone(prepared.action),
      needId: release.need.needId,
      bundleId: prepared.bundle.id,
      ownerData: { observationRef: context.observation.observation_ref },
    };
  }

  acquire(event: CommonCallerAcquisition): PublicSingleActionFeedbackReceipt {
    const feedback = commonCampaignFeedbackPayload(event.payload);
    if (!feedback) throw new TypeError('public single-action feedback must use the common campaign contract');
    return {
      ownerId: this.id,
      source: event.source,
      needId: feedback.needId ?? null,
      beforeObservationRef: feedback.before.observation.observation_ref,
      afterObservationRef: feedback.after.observation.observation_ref,
    };
  }
}
