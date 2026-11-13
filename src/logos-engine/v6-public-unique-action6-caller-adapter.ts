import type { AgentObservation } from '../runtime/contracts.ts';
import type {
  CampaignLogosActionPayload,
  CampaignSelectedReturnEnvelope,
} from './v6-common-campaign-owner.ts';
import type {
  CommonCallerAcquisition,
  CommonCallerOwner,
  CommonCallerProposal,
} from './v6-neutral-common-caller.ts';
import { preparePublicUniqueAction6Decision } from './v6-public-unique-action6-port.ts';

export const PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID = 'public_unique_action6_op28';

export interface PublicUniqueAction6CallerContext {
  gameCode: string;
  observation: AgentObservation;
}

export interface PublicUniqueAction6AcquisitionReceipt {
  acquired: true;
  needId: string;
  eventRef: string;
  proposalRef: string;
  returnPayload: unknown;
}

function callerContext(context: unknown): PublicUniqueAction6CallerContext | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined;
  const candidate = context as Partial<PublicUniqueAction6CallerContext>;
  if (typeof candidate.gameCode !== 'string' || !candidate.gameCode || !candidate.observation) {
    return undefined;
  }
  return candidate as PublicUniqueAction6CallerContext;
}

function selectedEnvelope(value: unknown): CampaignSelectedReturnEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('public unique ACTION6 acquisition requires a campaign return envelope');
  }
  const envelope = value as CampaignSelectedReturnEnvelope;
  if (envelope.version !== 1 || typeof envelope.needId !== 'string' || !envelope.needId) {
    throw new TypeError('invalid public unique ACTION6 campaign return envelope');
  }
  if (envelope.proposal.ownerId !== PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID) {
    throw new Error('public unique ACTION6 return was routed to the wrong owner');
  }
  return envelope;
}

/**
 * Neutral owner for a complete ACTION6 coordinate pair proved by one public
 * target. It has no ranking authority and accepts only its selected return.
 */
export class PublicUniqueAction6CallerOwnerAdapter implements CommonCallerOwner {
  readonly id = PUBLIC_UNIQUE_ACTION6_CALLER_OWNER_ID;

  propose(context: unknown): CommonCallerProposal | undefined {
    const input = callerContext(context);
    if (!input) return undefined;
    const prepared = preparePublicUniqueAction6Decision(input.gameCode, input.observation);
    if (!prepared) return undefined;

    const payload: CampaignLogosActionPayload = {
      action: prepared.action,
      bundle: prepared.bundle,
      state: prepared.state,
      identity: prepared.identity,
      correlation: {
        sessionId: input.observation.sessionId,
        sequence: input.observation.sequence,
      },
    };

    return {
      ownerId: this.id,
      proposalRef: prepared.bundle.id,
      actionRef: `ACTION6:${prepared.target.x}:${prepared.target.y}`,
      payload,
    };
  }

  acquire(event: CommonCallerAcquisition): PublicUniqueAction6AcquisitionReceipt {
    if (event.source !== 'selected') {
      throw new Error('public unique ACTION6 owner accepts only selected returns');
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
