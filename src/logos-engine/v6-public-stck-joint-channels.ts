import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from '../runtime/contracts.ts';
import {
  prepareJointChannelActionPayload,
  sealJointChannelActionPayload,
} from './v6-joint-channel-action.ts';
import type { CampaignLogosActionPayload } from './v6-common-campaign-owner.ts';
import type {
  JointChannel,
  JointChannelAcquisition,
  JointChannelContribution,
  JointChannelContributionRequest,
} from './v6-joint-channel-owner.ts';
import {
  findUniqueVisibleStckStackCardTarget,
} from './v6-public-unique-stck-action6-port.ts';

export const PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID = 'public_stck_action_availability_v1';
export const PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID = 'public_stck_visible_target_v1';
export const PUBLIC_STCK_TARGET_PRODUCER_ID = 'public_stck_unique_stack_card_target_v1';

export interface PublicStckTargetCandidate {
  version: 1;
  producerId: typeof PUBLIC_STCK_TARGET_PRODUCER_ID;
  observationRef: string;
  jointRef: string;
  targetRef: string;
  targetKind: 'stack_card';
  targetEvidenceRef: string;
  action: Extract<AgentAction, { id: 6 }>;
  evidenceRefs: string[];
}

export interface PublicStckJointChannelReceipt {
  acquired: true;
  channelId: string;
  contributionRef: string;
  needId: string;
  proposalRef: string;
  jointRef: string;
  action: AgentAction;
  returnPayload: unknown;
}

const TRUSTED_CANDIDATE_OBSERVATIONS = new WeakMap<
  PublicStckTargetCandidate,
  AgentObservation
>();
const TRUSTED_CANDIDATE_PAYLOADS = new WeakMap<
  PublicStckTargetCandidate,
  CampaignLogosActionPayload
>();

function observationRef(observation: AgentObservation): string {
  return `public-observation:${observation.sessionId}:${observation.sequence}`;
}

/**
 * Reuse the canonical ambiguity-preserving STCK detector to produce one target
 * identity from public pixels alone. Several cards remain unresolved; this
 * producer never ranks them and never invents a shop fallback.
 */
export function producePublicStckTargetCandidate(
  observation: AgentObservation,
): PublicStckTargetCandidate | undefined {
  const target = findUniqueVisibleStckStackCardTarget(observation);
  if (!target) return undefined;

  const currentObservationRef = observationRef(observation);
  const targetRef = [
    'public-stck-unique-card',
    currentObservationRef,
    target.x,
    target.y,
    target.evidenceRef,
  ].join(':');
  const action = {
    id: 6,
    data: Object.freeze({ x: target.x, y: target.y }),
  } as Extract<AgentAction, { id: 6 }>;
  Object.freeze(action);
  const evidenceRefs = Object.freeze([
    currentObservationRef,
    targetRef,
    target.evidenceRef,
    `producer:${PUBLIC_STCK_TARGET_PRODUCER_ID}`,
  ]) as unknown as string[];
  const candidate = Object.freeze({
    version: 1,
    producerId: PUBLIC_STCK_TARGET_PRODUCER_ID,
    observationRef: currentObservationRef,
    jointRef: `public-stck-unique-card-joint:${targetRef}:ACTION6`,
    targetRef,
    targetKind: 'stack_card',
    targetEvidenceRef: target.evidenceRef,
    action,
    evidenceRefs,
  }) as PublicStckTargetCandidate;
  TRUSTED_CANDIDATE_OBSERVATIONS.set(candidate, observation);
  return candidate;
}

function candidateContext(
  request: JointChannelContributionRequest,
): PublicStckTargetCandidate | undefined {
  if (!request.context || typeof request.context !== 'object' || Array.isArray(request.context)) {
    return undefined;
  }
  const candidate = request.context as Partial<PublicStckTargetCandidate>;
  if (
    candidate.version !== 1
    || candidate.producerId !== PUBLIC_STCK_TARGET_PRODUCER_ID
    || candidate.observationRef !== observationRef(request.observation)
    || typeof candidate.jointRef !== 'string'
    || candidate.jointRef.length === 0
    || typeof candidate.targetRef !== 'string'
    || candidate.targetRef.length === 0
    || candidate.targetKind !== 'stack_card'
    || typeof candidate.targetEvidenceRef !== 'string'
    || candidate.targetEvidenceRef.length === 0
    || !Array.isArray(candidate.evidenceRefs)
    || !isAgentAction(candidate.action)
    || candidate.action.id !== 6
  ) {
    return undefined;
  }
  return candidate as PublicStckTargetCandidate;
}

function verifiedTargetCandidate(
  request: JointChannelContributionRequest,
): PublicStckTargetCandidate | undefined {
  const candidate = candidateContext(request);
  if (!candidate) return undefined;
  if (TRUSTED_CANDIDATE_OBSERVATIONS.get(candidate) === request.observation) {
    return candidate;
  }
  const reproduced = producePublicStckTargetCandidate(request.observation);
  if (!reproduced) return undefined;
  if (
    reproduced.targetRef !== candidate.targetRef
    || reproduced.targetEvidenceRef !== candidate.targetEvidenceRef
    || reproduced.action.data.x !== candidate.action.data.x
    || reproduced.action.data.y !== candidate.action.data.y
    || reproduced.jointRef !== candidate.jointRef
  ) {
    return undefined;
  }
  return candidate;
}

function contributionPayload(
  request: JointChannelContributionRequest,
  candidate: PublicStckTargetCandidate,
): CampaignLogosActionPayload | undefined {
  const trusted = TRUSTED_CANDIDATE_OBSERVATIONS.get(candidate) === request.observation;
  if (trusted) {
    const cached = TRUSTED_CANDIDATE_PAYLOADS.get(candidate);
    if (cached) return cached;
  }
  const payload = prepareJointChannelActionPayload(
    request.observation,
    candidate.action,
    candidate.jointRef,
  );
  if (!payload || !trusted) return payload;
  const sealed = sealJointChannelActionPayload(payload);
  TRUSTED_CANDIDATE_PAYLOADS.set(candidate, sealed);
  return sealed;
}

abstract class PublicStckJointChannelBase implements JointChannel {
  abstract readonly id: string;
  readonly acquisitionMode = 'readonly' as const;

  abstract contribute(
    request: JointChannelContributionRequest,
  ): JointChannelContribution | undefined;

  acquire(event: JointChannelAcquisition): PublicStckJointChannelReceipt {
    if (event.channelId !== this.id) {
      throw new Error(`joint return for ${event.channelId} was routed to ${this.id}`);
    }
    return {
      acquired: true,
      channelId: this.id,
      contributionRef: event.contributionRef,
      needId: event.needId,
      proposalRef: event.proposalRef,
      jointRef: event.jointRef,
      action: event.action,
      returnPayload: event.returnPayload,
    };
  }

  protected contribution(
    request: JointChannelContributionRequest,
    candidate: PublicStckTargetCandidate,
    contributionRef: string,
  ): JointChannelContribution | undefined {
    const payload = contributionPayload(request, candidate);
    if (!payload) return undefined;
    return {
      channelId: this.id,
      contributionRef,
      jointRef: candidate.jointRef,
      actionRef: 'ACTION6',
      payload,
    };
  }
}

/** Contributes only current public ACTION6 admissibility. */
export class PublicStckActionAvailabilityJointChannel extends PublicStckJointChannelBase {
  readonly id = PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID;

  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined {
    const candidate = candidateContext(request);
    if (!candidate || !request.observation.availableActionIds.includes(6)) return undefined;
    return this.contribution(
      request,
      candidate,
      `stck-availability:${candidate.observationRef}:ACTION6`,
    );
  }
}

/** Contributes the revalidated unique visible STCK card and its coordinates. */
export class PublicStckVisibleTargetJointChannel extends PublicStckJointChannelBase {
  readonly id = PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID;

  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined {
    const candidate = verifiedTargetCandidate(request);
    if (!candidate) return undefined;
    return this.contribution(
      request,
      candidate,
      `stck-visible-target:${candidate.targetRef}`,
    );
  }
}

export function createPublicStckAddressedJointChannels(): readonly JointChannel[] {
  return [
    new PublicStckActionAvailabilityJointChannel(),
    new PublicStckVisibleTargetJointChannel(),
  ];
}

/** Build the explicit per-channel context expected by V6CommonCampaignDecisionPort. */
export function publicStckAddressedJointContext(
  observation: AgentObservation,
): Readonly<Record<string, unknown>> {
  const candidate = producePublicStckTargetCandidate(observation);
  if (!candidate) return {};
  return {
    [PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID]: candidate,
    [PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID]: candidate,
  };
}
