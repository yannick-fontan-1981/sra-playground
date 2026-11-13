import {
  isAgentAction,
  type AgentAction,
  type AgentObservation,
} from '../runtime/contracts.ts';
import {
  prepareJointChannelActionPayload,
} from './v6-joint-channel-action.ts';
import type {
  JointChannel,
  JointChannelAcquisition,
  JointChannelContribution,
  JointChannelContributionRequest,
} from './v6-joint-channel-owner.ts';

export const PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID = 'public_stck_action_availability_v1';
export const PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID = 'public_stck_visible_target_v1';
export const PUBLIC_STCK_TARGET_PRODUCER_ID = 'public_stck_stack_or_shop_target_v1';

export type PublicStckTargetKind = 'stack_card' | 'shop_button';

export interface PublicStckTargetCandidate {
  version: 1;
  producerId: typeof PUBLIC_STCK_TARGET_PRODUCER_ID;
  observationRef: string;
  jointRef: string;
  targetRef: string;
  shopRef: string;
  targetKind: PublicStckTargetKind;
  targetSignature: string;
  shopSignature: string;
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

interface PublicShopMatch {
  startX: number;
  endX: number;
  x: number;
  y: 56;
  signature: string;
}

interface PublicStackCardMatch {
  x: 4;
  y: number;
  color: number;
  signature: string;
}

const STCK_CARD_COLORS = new Set([7, 8, 9, 10, 11, 14]);

function observationRef(observation: AgentObservation): string {
  return `public-observation:${observation.sessionId}:${observation.sequence}`;
}

function validatePublicImage(observation: AgentObservation): Uint8Array {
  if (
    observation.image.width !== 64
    || observation.image.height !== 64
    || observation.image.pixelFormat !== 'palette-index-u8'
    || !(observation.image.pixels instanceof Uint8Array)
    || observation.image.pixels.length !== 64 * 64
  ) {
    throw new RangeError('public STCK target producer requires one 64x64 palette-index frame');
  }
  for (const value of observation.image.pixels) {
    if (value > 15) throw new RangeError('public STCK target producer received an invalid palette index');
  }
  return observation.image.pixels;
}

function pixel(pixels: Uint8Array, x: number, y: number): number {
  return pixels[y * 64 + x]!;
}

function publicShopMatch(pixels: Uint8Array): PublicShopMatch | undefined {
  const activeColumns: boolean[] = [];
  for (let x = 0; x < 64; x += 1) {
    let nonBlack = 0;
    for (let y = 54; y <= 58; y += 1) {
      if (pixel(pixels, x, y) !== 5) nonBlack += 1;
    }
    activeColumns.push(nonBlack >= 2);
  }

  let startX = -1;
  for (let x = 0; x <= 64; x += 1) {
    const active = x < 64 ? activeColumns[x] : false;
    if (active && startX < 0) startX = x;
    if (!active && startX >= 0) {
      const endX = x - 1;
      if (endX - startX + 1 >= 5) {
        const values: number[] = [];
        for (let y = 54; y <= 58; y += 1) {
          for (let column = startX; column <= endX; column += 1) {
            values.push(pixel(pixels, column, y));
          }
        }
        return {
          startX,
          endX,
          x: Math.floor((startX + endX) / 2),
          y: 56,
          signature: values.join(','),
        };
      }
      startX = -1;
    }
  }
  return undefined;
}

function publicStackCardMatch(pixels: Uint8Array): PublicStackCardMatch | undefined {
  for (let y = 53; y >= 0; y -= 1) {
    const color = pixel(pixels, 4, y);
    if (!STCK_CARD_COLORS.has(color)) continue;
    const values: number[] = [];
    for (let x = 2; x < 8; x += 1) values.push(pixel(pixels, x, y));
    if (!values.every(value => value === color)) continue;
    return {
      x: 4,
      y,
      color,
      signature: values.join(','),
    };
  }
  return undefined;
}

/**
 * Derive the source-qualified STCK ACTION6 probe solely from the public frame.
 *
 * A public shop segment must be active before any target is admitted. While a
 * visible stack card exists, the lowest visible card is selected. Otherwise the
 * first visible shop segment is selected. The scan and tie rules exactly match
 * the already qualified 9B public Region corpus; no engine state or fixture is
 * available to this producer.
 */
export function producePublicStckTargetCandidate(
  observation: AgentObservation,
): PublicStckTargetCandidate | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;
  const pixels = validatePublicImage(observation);
  const shop = publicShopMatch(pixels);
  if (!shop) return undefined;
  const card = publicStackCardMatch(pixels);

  const currentObservationRef = observationRef(observation);
  const shopRef = [
    'public-stck-shop',
    currentObservationRef,
    shop.startX,
    shop.endX,
    shop.signature,
  ].join(':');

  const targetKind: PublicStckTargetKind = card ? 'stack_card' : 'shop_button';
  const targetX = card?.x ?? shop.x;
  const targetY = card?.y ?? shop.y;
  const targetSignature = card?.signature ?? shop.signature;
  const targetRef = [
    'public-stck-target',
    currentObservationRef,
    targetKind,
    targetX,
    targetY,
    targetSignature,
  ].join(':');
  const action: Extract<AgentAction, { id: 6 }> = {
    id: 6,
    data: { x: targetX, y: targetY },
  };

  return {
    version: 1,
    producerId: PUBLIC_STCK_TARGET_PRODUCER_ID,
    observationRef: currentObservationRef,
    jointRef: `public-stck-addressed-joint:${targetRef}:ACTION6`,
    targetRef,
    shopRef,
    targetKind,
    targetSignature,
    shopSignature: shop.signature,
    action,
    evidenceRefs: [
      currentObservationRef,
      shopRef,
      targetRef,
      `producer:${PUBLIC_STCK_TARGET_PRODUCER_ID}`,
    ],
  };
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
    || typeof candidate.shopRef !== 'string'
    || candidate.shopRef.length === 0
    || (candidate.targetKind !== 'stack_card' && candidate.targetKind !== 'shop_button')
    || typeof candidate.targetSignature !== 'string'
    || candidate.targetSignature.length === 0
    || typeof candidate.shopSignature !== 'string'
    || candidate.shopSignature.length === 0
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
  const reproduced = producePublicStckTargetCandidate(request.observation);
  if (!reproduced) return undefined;
  if (
    reproduced.targetRef !== candidate.targetRef
    || reproduced.shopRef !== candidate.shopRef
    || reproduced.targetKind !== candidate.targetKind
    || reproduced.targetSignature !== candidate.targetSignature
    || reproduced.shopSignature !== candidate.shopSignature
    || reproduced.action.data.x !== candidate.action.data.x
    || reproduced.action.data.y !== candidate.action.data.y
    || reproduced.jointRef !== candidate.jointRef
  ) {
    return undefined;
  }
  return candidate;
}

abstract class PublicStckJointChannelBase implements JointChannel {
  abstract readonly id: string;

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
      action: structuredClone(event.action),
      returnPayload: structuredClone(event.returnPayload),
    };
  }

  protected contribution(
    request: JointChannelContributionRequest,
    candidate: PublicStckTargetCandidate,
    contributionRef: string,
  ): JointChannelContribution | undefined {
    const payload = prepareJointChannelActionPayload(
      request.observation,
      candidate.action,
      candidate.jointRef,
    );
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

/** Contributes the revalidated visible STCK target and addressed coordinates. */
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
    [PUBLIC_STCK_ACTION_AVAILABILITY_CHANNEL_ID]: structuredClone(candidate),
    [PUBLIC_STCK_VISIBLE_TARGET_CHANNEL_ID]: structuredClone(candidate),
  };
}
