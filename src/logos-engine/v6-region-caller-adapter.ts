import {
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from './v6-neutral-common-caller.ts';
import {
  RegionInterventionOwner,
  type RegionAcquisitionEvent,
} from './v6-region-intervention-owner.ts';
import type { RegionInterventionCandidate } from './v6-region-intervention.ts';

export interface RegionCallerContext {
  candidate: RegionInterventionCandidate;
}

export interface RegionCallerPayload {
  observation: RegionAcquisitionEvent['observation'];
}

function proposalRef(
  methodRef: string,
  separatorRef: string,
  actionRef: string,
): string {
  return 'public_region_intervention:' + methodRef + ':' + separatorRef + ':' + actionRef;
}

export class RegionCallerOwnerAdapter implements CommonCallerOwner {
  readonly id = 'public_region_intervention';

  constructor(readonly region: RegionInterventionOwner = new RegionInterventionOwner()) {}

  propose(context: unknown): CommonCallerProposal | undefined {
    if (!context || typeof context !== 'object' || !('candidate' in context)) {
      return undefined;
    }
    const candidate = (context as RegionCallerContext).candidate;
    const proposal = this.region.propose(candidate);
    if (!proposal) return undefined;
    return {
      ownerId: this.id,
      proposalRef: proposalRef(proposal.methodRef, proposal.separatorRef, proposal.actionRef),
      actionRef: proposal.actionRef,
      payload: proposal,
    };
  }

  acquire(event: CommonCallerAcquisition): unknown {
    if (!event.payload || typeof event.payload !== 'object' || !('observation' in event.payload)) {
      throw new TypeError('Region caller payload must contain an observation');
    }
    const payload = event.payload as RegionCallerPayload;
    return this.region.acquire({
      eventRef: event.eventRef,
      source: event.source,
      observation: payload.observation,
    });
  }
}
