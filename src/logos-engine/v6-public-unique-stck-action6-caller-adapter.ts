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
import { preparePublicUniqueStckAction6Decision } from './v6-public-unique-stck-action6-port.ts';

export const PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID = 'public_unique_stck_action6_op28';

export interface PublicUniqueStckAction6CallerContext {
  gameCode: string;
  observation: AgentObservation;
}

export interface PublicUniqueStckAction6AcquisitionReceipt {
  acquired: true;
  needId: string;
  eventRef: string;
  proposalRef: string;
  returnPayload: unknown;
}

function callerContext(context: unknown): PublicUniqueStckAction6CallerContext | undefined {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return undefined;
  const candidate = context as Partial<PublicUniqueStckAction6CallerContext>;
  if (
    candidate.gameCode !== 'STCK'
    || !candidate.observation
  ) {
    return undefined;
  }
  return candidate as PublicUniqueStckAction6CallerContext;
}

function selectedEnvelope(value: unknown): CampaignSelectedReturnEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('public unique STCK ACTION6 acquisition requires a campaign return envelope');
  }
  const envelope = value as CampaignSelectedReturnEnvelope;
  if (envelope.version !== 1 || typeof envelope.needId !== 'string' || !envelope.needId) {
    throw new TypeError('invalid public unique STCK ACTION6 campaign return envelope');
  }
  if (envelope.proposal.ownerId !== PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID) {
    throw new Error('public unique STCK ACTION6 return was routed to the wrong owner');
  }
  return envelope;
}

/**
 * Neutral STCK owner for a complete ACTION6 coordinate pair proved by one
 * public stack card. It never ranks multiple cards and accepts only its
 * selected physical return.
 */
export class PublicUniqueStckAction6CallerOwnerAdapter implements CommonCallerOwner {
  readonly id = PUBLIC_UNIQUE_STCK_ACTION6_CALLER_OWNER_ID;

  propose(context: unknown): CommonCallerProposal | undefined {
    const input = callerContext(context);
    if (!input) return undefined;
    const prepared = preparePublicUniqueStckAction6Decision(input.observation);
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

  acquire(event: CommonCallerAcquisition): PublicUniqueStckAction6AcquisitionReceipt {
    if (event.source !== 'selected') {
      throw new Error('public unique STCK ACTION6 owner accepts only selected returns');
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
