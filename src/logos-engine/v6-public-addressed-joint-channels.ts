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

export const PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID = 'public_action_availability_v1';
export const PUBLIC_VISIBLE_TARGET_CHANNEL_ID = 'public_visible_target_v1';
export const PUBLIC_SMLP_GATE_PRODUCER_ID = 'public_smlp_gate_target_v1';

export interface PublicSmlpGateCandidate {
  version: 1;
  producerId: typeof PUBLIC_SMLP_GATE_PRODUCER_ID;
  observationRef: string;
  jointRef: string;
  targetRef: string;
  patchSignature: string;
  orientation: 'closed_vertical' | 'closed_horizontal' | 'open_horizontal' | 'open_vertical';
  action: Extract<AgentAction, { id: 6 }>;
  evidenceRefs: string[];
}

export interface PublicAddressedJointChannelReceipt {
  acquired: true;
  channelId: string;
  contributionRef: string;
  needId: string;
  proposalRef: string;
  jointRef: string;
  action: AgentAction;
  returnPayload: unknown;
}

type GateOrientation = PublicSmlpGateCandidate['orientation'];

interface GateMatch {
  x: number;
  y: number;
  orientation: GateOrientation;
  patchSignature: string;
}

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
    throw new RangeError('public SMLP gate producer requires one 64x64 palette-index frame');
  }
  for (const value of observation.image.pixels) {
    if (value > 15) throw new RangeError('public SMLP gate producer received an invalid palette index');
  }
  return observation.image.pixels;
}

function pixel(pixels: Uint8Array, x: number, y: number): number {
  return pixels[y * 64 + x]!;
}

function patchValues(pixels: Uint8Array, x: number, y: number): number[] {
  const values: number[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      values.push(pixel(pixels, x + dx, y + dy));
    }
  }
  return values;
}

function same(values: readonly number[]): boolean {
  return values.length > 0 && values.every(value => value === values[0]);
}

function orientationAt(
  pixels: Uint8Array,
  x: number,
  y: number,
): GateOrientation | undefined {
  const topLeft = pixel(pixels, x - 1, y - 1);
  const top = pixel(pixels, x, y - 1);
  const topRight = pixel(pixels, x + 1, y - 1);
  const left = pixel(pixels, x - 1, y);
  const center = pixel(pixels, x, y);
  const right = pixel(pixels, x + 1, y);
  const bottomLeft = pixel(pixels, x - 1, y + 1);
  const bottom = pixel(pixels, x, y + 1);
  const bottomRight = pixel(pixels, x + 1, y + 1);

  if (top === 5 && center === 5 && bottom === 5) {
    const surround = [topLeft, topRight, left, right, bottomLeft, bottomRight];
    if (same(surround) && surround[0] !== 5) return 'closed_vertical';
  }

  if (left === 5 && center === 5 && right === 5) {
    const surround = [topLeft, top, topRight, bottomLeft, bottom, bottomRight];
    if (same(surround) && surround[0] !== 5) return 'closed_horizontal';
  }

  const openHorizontal = (
    bottom === top
    && ![2, 3, 4, 5].includes(top)
    && center === 3
    && [topLeft, topRight, left, right, bottomLeft, bottomRight]
      .every(value => value === 2)
  );
  if (openHorizontal) return 'open_horizontal';

  const openVertical = (
    right === left
    && ![2, 3, 4, 5].includes(left)
    && center === 3
    && [topLeft, top, topRight, bottomLeft, bottom, bottomRight]
      .every(value => value === 2)
  );
  return openVertical ? 'open_vertical' : undefined;
}

function visibleSmlpGates(
  observation: AgentObservation,
  limit = Number.POSITIVE_INFINITY,
): GateMatch[] {
  const pixels = validatePublicImage(observation);
  const matches: GateMatch[] = [];
  for (let y = 8; y <= 58; y += 1) {
    for (let x = 1; x <= 62; x += 1) {
      const orientation = orientationAt(pixels, x, y);
      if (!orientation) continue;
      matches.push({
        x,
        y,
        orientation,
        patchSignature: patchValues(pixels, x, y).join(','),
      });
      if (matches.length >= limit) return matches;
    }
  }
  return matches;
}

function candidateFromMatch(
  observation: AgentObservation,
  match: GateMatch,
): PublicSmlpGateCandidate {
  const currentObservationRef = observationRef(observation);
  const targetRef = [
    'public-smlp-gate',
    currentObservationRef,
    match.orientation,
    match.x,
    match.y,
    match.patchSignature,
  ].join(':');
  const action: Extract<AgentAction, { id: 6 }> = {
    id: 6,
    data: { x: match.x, y: match.y },
  };
  return {
    version: 1,
    producerId: PUBLIC_SMLP_GATE_PRODUCER_ID,
    observationRef: currentObservationRef,
    jointRef: `public-addressed-joint:${targetRef}:ACTION6`,
    targetRef,
    patchSignature: match.patchSignature,
    orientation: match.orientation,
    action,
    evidenceRefs: [
      currentObservationRef,
      targetRef,
      `producer:${PUBLIC_SMLP_GATE_PRODUCER_ID}`,
    ],
  };
}

/**
 * Public producer used by the first real 9C2 corpus.
 *
 * It scans only the visible 64x64 palette frame, using the source-qualified
 * SMLP gate glyphs and the already-qualified explicit row-major tie rule. It
 * never reads engine state, fixtures, control identifiers, routes or prepared
 * solutions.
 */
export function producePublicSmlpGateCandidate(
  observation: AgentObservation,
): PublicSmlpGateCandidate | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;
  const [match] = visibleSmlpGates(observation, 1);
  return match ? candidateFromMatch(observation, match) : undefined;
}

/**
 * Strict product variant: expose a candidate only when the public frame contains
 * exactly one source-qualified SMLP gate. Several gates remain unresolved; no
 * row-major ranking is introduced into the active browser product.
 */
export function produceUniquePublicSmlpGateCandidate(
  observation: AgentObservation,
): PublicSmlpGateCandidate | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;
  const matches = visibleSmlpGates(observation, 2);
  return matches.length === 1
    ? candidateFromMatch(observation, matches[0]!)
    : undefined;
}

function candidateContext(
  request: JointChannelContributionRequest,
): PublicSmlpGateCandidate | undefined {
  if (!request.context || typeof request.context !== 'object' || Array.isArray(request.context)) {
    return undefined;
  }
  const candidate = request.context as Partial<PublicSmlpGateCandidate>;
  if (
    candidate.version !== 1
    || candidate.producerId !== PUBLIC_SMLP_GATE_PRODUCER_ID
    || candidate.observationRef !== observationRef(request.observation)
    || typeof candidate.jointRef !== 'string'
    || candidate.jointRef.length === 0
    || typeof candidate.targetRef !== 'string'
    || candidate.targetRef.length === 0
    || typeof candidate.patchSignature !== 'string'
    || candidate.patchSignature.length === 0
    || !Array.isArray(candidate.evidenceRefs)
    || !isAgentAction(candidate.action)
    || candidate.action.id !== 6
  ) {
    return undefined;
  }
  return candidate as PublicSmlpGateCandidate;
}

function verifiedTargetCandidate(
  request: JointChannelContributionRequest,
): PublicSmlpGateCandidate | undefined {
  const candidate = candidateContext(request);
  if (!candidate) return undefined;
  const reproduced = producePublicSmlpGateCandidate(request.observation);
  if (!reproduced) return undefined;
  if (
    reproduced.targetRef !== candidate.targetRef
    || reproduced.patchSignature !== candidate.patchSignature
    || reproduced.orientation !== candidate.orientation
    || reproduced.action.data.x !== candidate.action.data.x
    || reproduced.action.data.y !== candidate.action.data.y
    || reproduced.jointRef !== candidate.jointRef
  ) {
    return undefined;
  }
  return candidate;
}

abstract class PublicAddressedJointChannelBase implements JointChannel {
  abstract readonly id: string;

  abstract contribute(
    request: JointChannelContributionRequest,
  ): JointChannelContribution | undefined;

  acquire(event: JointChannelAcquisition): PublicAddressedJointChannelReceipt {
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
    candidate: PublicSmlpGateCandidate,
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

/** Contributes current public ACTION6 admissibility, but no target geometry. */
export class PublicActionAvailabilityJointChannel extends PublicAddressedJointChannelBase {
  readonly id = PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID;

  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined {
    const candidate = candidateContext(request);
    if (!candidate || !request.observation.availableActionIds.includes(6)) return undefined;
    return this.contribution(
      request,
      candidate,
      `availability:${candidate.observationRef}:ACTION6`,
    );
  }
}

/** Contributes the revalidated visible gate target and its addressed coordinates. */
export class PublicVisibleTargetJointChannel extends PublicAddressedJointChannelBase {
  readonly id = PUBLIC_VISIBLE_TARGET_CHANNEL_ID;

  contribute(request: JointChannelContributionRequest): JointChannelContribution | undefined {
    const candidate = verifiedTargetCandidate(request);
    if (!candidate) return undefined;
    return this.contribution(
      request,
      candidate,
      `visible-target:${candidate.targetRef}`,
    );
  }
}

export function createPublicSmlpAddressedJointChannels(): readonly JointChannel[] {
  return [
    new PublicActionAvailabilityJointChannel(),
    new PublicVisibleTargetJointChannel(),
  ];
}

function contextFromCandidate(
  candidate: PublicSmlpGateCandidate | undefined,
): Readonly<Record<string, unknown>> {
  if (!candidate) return {};
  return {
    [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: structuredClone(candidate),
    [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: structuredClone(candidate),
  };
}

/** Build the already-qualified row-major context used by Lot 9C2. */
export function publicSmlpAddressedJointContext(
  observation: AgentObservation,
): Readonly<Record<string, unknown>> {
  return contextFromCandidate(producePublicSmlpGateCandidate(observation));
}

/** Build the ambiguity-preserving context used by the active browser product. */
export function publicUniqueSmlpAddressedJointContext(
  observation: AgentObservation,
): Readonly<Record<string, unknown>> {
  return contextFromCandidate(produceUniquePublicSmlpGateCandidate(observation));
}
