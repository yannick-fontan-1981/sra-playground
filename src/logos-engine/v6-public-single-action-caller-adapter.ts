import type { AgentObservation } from '../runtime/contracts.ts';
import {
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from './v6-neutral-common-caller.ts';
import {
  preparePublicSingleActionDecision,
} from './v6-public-single-action-port.ts';
import type {
  CampaignLogosActionPayload,
  CampaignSelectedReturnEnvelope,
} from './v6-common-campaign-owner.ts';

export const PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID = 'public_single_action_op28';

export interface PublicSingleActionCallerContext {
  observation: AgentObservation;
}

export interface PublicSingleActionAcquisitionReceipt {
  acquired: true;
  needId: string;
  eventRef: string;
  proposalRef: string;
  returnPayload: unknown;
}

function contextObservation(context: unknown): AgentObservation | undefined {
  if (!context || typeof context !== 'object' || !('observation' in context)) {
    return undefined;
  }
  return (context as PublicSingleActionCallerContext).observation;
}

function selectedEnvelope(value: unknown): CampaignSelectedReturnEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('public single-action acquisition requires a campaign return envelope');
  }
  const envelope = value as CampaignSelectedReturnEnvelope;
  if (envelope.version !== 1 || typeof envelope.needId !== 'string' || !envelope.needId) {
    throw new TypeError('invalid public single-action campaign return envelope');
  }
  if (envelope.proposal.ownerId !== PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID) {
    throw new Error('public single-action return was routed to the wrong owner');
  }
  return envelope;
}

/**
 * Common-caller adapter for the deliberately narrow public OP28 path.
 *
 * It owns no perception and learns nothing from the return. Its purpose is to
 * let the common campaign arbitrate this fallback alongside richer specialized
 * owners without giving the fallback any ranking authority.
 */
export class PublicSingleActionCallerOwnerAdapter implements CommonCallerOwner {
  readonly id = PUBLIC_SINGLE_ACTION_CALLER_OWNER_ID;

  propose(context: unknown): CommonCallerProposal | undefined {
    const observation = contextObservation(context);
    if (!observation) return undefined;
    const prepared = preparePublicSingleActionDecision(observation);
    if (!prepared) return undefined;

    const payload: CampaignLogosActionPayload = {
      action: prepared.action,
      bundle: prepared.bundle,
      state: prepared.state,
      identity: prepared.identity,
      correlation: {
        sessionId: observation.sessionId,
        sequence: observation.sequence,
      },
    };
    return {
      ownerId: this.id,
      proposalRef: prepared.bundle.id,
      actionRef: `ACTION${prepared.action.id}`,
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): PublicSingleActionAcquisitionReceipt {
    if (event.source !== 'selected') {
      throw new Error('public single-action owner accepts only selected returns');
    }
    const envelope = selectedEnvelope(event.payload);
    return {
      acquired: true,
      needId: envelope.needId,
      eventRef: event.eventRef,
      proposalRef: envelope.proposal.proposalRef,
      returnPayload: envelope.returnPayload,
    };
  }
}
