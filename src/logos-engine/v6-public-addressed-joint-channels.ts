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
export const PUBLIC_STCK_TARGET_PRODUCER_ID = 'public_stck_stack_shop_target_v1';

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

export interface PublicStckTargetCandidate {
  version: 1;
  producerId: typeof PUBLIC_STCK_TARGET_PRODUCER_ID;
  observationRef: string;
  jointRef: string;
  targetRef: string;
  patchSignature: string;
  targetKind: 'stack_card_remove' | 'shop_button_add';
  action: Extract<AgentAction, { id: 6 }>;
  evidenceRefs: string[];
}

export type PublicAddressedTargetCandidate =
  | PublicSmlpGateCandidate
  | PublicStckTargetCandidate;

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

interface StckTargetMatch {
  x: number;
  y: number;
  targetKind: PublicStckTargetCandidate['targetKind'];
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
    throw new RangeError('public addressed target producer requires one 64x64 palette-index frame');
  }
  for (const value of observation.image.pixels) {
    if (value > 15) throw new RangeError('public addressed target producer received an invalid palette index');
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

function firstVisibleSmlpGate(observation: AgentObservation): GateMatch | undefined {
  const pixels = validatePublicImage(observation);
  for (let y = 8; y <= 58; y += 1) {
    for (let x = 1; x <= 62; x += 1) {
      const orientation = orientationAt(pixels, x, y);
      if (!orientation) continue;
      return {
        x,
        y,
        orientation,
        patchSignature: patchValues(pixels, x, y).join(','),
      };
    }
  }
  return undefined;
}

/**
 * Public producer used by the first real 9C2 corpus.
 *
 * It scans only the visible 64x64 palette frame, using the source-qualified
 * SMLP gate glyphs and an explicit row-major tie rule. It never reads engine
 * state, fixtures, control identifiers, routes or prepared solutions.
 */
export function producePublicSmlpGateCandidate(
  observation: AgentObservation,
): PublicSmlpGateCandidate | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;
  const match = firstVisibleSmlpGate(observation);
  if (!match) return undefined;

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

const STCK_CARD_COLORS = new Set([7, 8, 9, 10, 11, 14]);

function firstVisibleStckShopButton(pixels: Uint8Array): StckTargetMatch | undefined {
  const active: boolean[] = [];
  for (let x = 0; x < 64; x += 1) {
    let nonBlack = 0;
    for (let y = 54; y <= 58; y += 1) {
      if (pixel(pixels, x, y) !== 5) nonBlack += 1;
    }
    active.push(nonBlack >= 2);
  }

  let start = -1;
  for (let x = 0; x <= 64; x += 1) {
    const on = x < 64 ? active[x] : false;
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      const end = x - 1;
      if (end - start + 1 >= 5) {
        const values: number[] = [];
        for (let y = 54; y <= 58; y += 1) {
          for (let xx = start; xx <= end; xx += 1) {
            values.push(pixel(pixels, xx, y));
          }
        }
        return {
          x: Math.floor((start + end) / 2),
          y: 56,
          targetKind: 'shop_button_add',
          patchSignature: `${start}-${end}:${values.join(',')}`,
        };
      }
      start = -1;
    }
  }
  return undefined;
}

function firstVisibleStckStackCard(pixels: Uint8Array): StckTargetMatch | undefined {
  for (let y = 53; y >= 0; y -= 1) {
    const centerColor = pixel(pixels, 4, y);
    if (!STCK_CARD_COLORS.has(centerColor)) continue;
    const interior: number[] = [];
    for (let x = 2; x < 8; x += 1) interior.push(pixel(pixels, x, y));
    if (!interior.every(value => value === centerColor)) continue;
    const signature: number[] = [];
    for (let yy = Math.max(0, y - 1); yy <= Math.min(53, y + 1); yy += 1) {
      for (let x = 1; x < 9; x += 1) signature.push(pixel(pixels, x, yy));
    }
    return {
      x: 4,
      y,
      targetKind: 'stack_card_remove',
      patchSignature: `${centerColor}:${signature.join(',')}`,
    };
  }
  return undefined;
}

/**
 * Public STCK target producer for Lot 9C3.
 *
 * A visible active shop button proves that the public frame is currently in an
 * addressed shop interaction state. While that state is visible, the producer
 * chooses the lowest visible stack-card face for removal; when no card face is
 * visible it chooses the first active shop button. This exactly mirrors the
 * already qualified public Region corpus without reading `at_shop`, stack data,
 * button ids or any other hidden engine field.
 */
export function producePublicStckTargetCandidate(
  observation: AgentObservation,
): PublicStckTargetCandidate | undefined {
  if (observation.state !== 'NOT_FINISHED') return undefined;
  const pixels = validatePublicImage(observation);
  const shopButton = firstVisibleStckShopButton(pixels);
  if (!shopButton) return undefined;
  const match = firstVisibleStckStackCard(pixels) ?? shopButton;

  const currentObservationRef = observationRef(observation);
  const targetRef = [
    'public-stck-target',
    currentObservationRef,
    match.targetKind,
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
    producerId: PUBLIC_STCK_TARGET_PRODUCER_ID,
    observationRef: currentObservationRef,
    jointRef: `public-addressed-joint:${targetRef}:ACTION6`,
    targetRef,
    patchSignature: match.patchSignature,
    targetKind: match.targetKind,
    action,
    evidenceRefs: [
      currentObservationRef,
      targetRef,
      `producer:${PUBLIC_STCK_TARGET_PRODUCER_ID}`,
    ],
  };
}

function candidateContext(
  request: JointChannelContributionRequest,
): PublicAddressedTargetCandidate | undefined {
  if (!request.context || typeof request.context !== 'object' || Array.isArray(request.context)) {
    return undefined;
  }
  const candidate = request.context as Partial<PublicAddressedTargetCandidate>;
  if (
    candidate.version !== 1
    || (candidate.producerId !== PUBLIC_SMLP_GATE_PRODUCER_ID
      && candidate.producerId !== PUBLIC_STCK_TARGET_PRODUCER_ID)
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
  if (
    candidate.producerId === PUBLIC_SMLP_GATE_PRODUCER_ID
    && !['closed_vertical', 'closed_horizontal', 'open_horizontal', 'open_vertical']
      .includes((candidate as Partial<PublicSmlpGateCandidate>).orientation ?? '')
  ) {
    return undefined;
  }
  if (
    candidate.producerId === PUBLIC_STCK_TARGET_PRODUCER_ID
    && !['stack_card_remove', 'shop_button_add']
      .includes((candidate as Partial<PublicStckTargetCandidate>).targetKind ?? '')
  ) {
    return undefined;
  }
  return candidate as PublicAddressedTargetCandidate;
}

function reproduceTargetCandidate(
  observation: AgentObservation,
  candidate: PublicAddressedTargetCandidate,
): PublicAddressedTargetCandidate | undefined {
  return candidate.producerId === PUBLIC_SMLP_GATE_PRODUCER_ID
    ? producePublicSmlpGateCandidate(observation)
    : producePublicStckTargetCandidate(observation);
}

function verifiedTargetCandidate(
  request: JointChannelContributionRequest,
): PublicAddressedTargetCandidate | undefined {
  const candidate = candidateContext(request);
  if (!candidate) return undefined;
  const reproduced = reproduceTargetCandidate(request.observation, candidate);
  if (!reproduced || reproduced.producerId !== candidate.producerId) return undefined;
  if (
    reproduced.targetRef !== candidate.targetRef
    || reproduced.patchSignature !== candidate.patchSignature
    || reproduced.action.data.x !== candidate.action.data.x
    || reproduced.action.data.y !== candidate.action.data.y
    || reproduced.jointRef !== candidate.jointRef
  ) {
    return undefined;
  }
  if (
    candidate.producerId === PUBLIC_SMLP_GATE_PRODUCER_ID
    && reproduced.producerId === PUBLIC_SMLP_GATE_PRODUCER_ID
    && reproduced.orientation !== candidate.orientation
  ) {
    return undefined;
  }
  if (
    candidate.producerId === PUBLIC_STCK_TARGET_PRODUCER_ID
    && reproduced.producerId === PUBLIC_STCK_TARGET_PRODUCER_ID
    && reproduced.targetKind !== candidate.targetKind
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
    candidate: PublicAddressedTargetCandidate,
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

/** Contributes the revalidated visible target and its addressed coordinates. */
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

export function createPublicStckAddressedJointChannels(): readonly JointChannel[] {
  return [
    new PublicActionAvailabilityJointChannel(),
    new PublicVisibleTargetJointChannel(),
  ];
}

/** Build the explicit per-channel SMLP context expected by the decision port. */
export function publicSmlpAddressedJointContext(
  observation: AgentObservation,
): Readonly<Record<string, unknown>> {
  const candidate = producePublicSmlpGateCandidate(observation);
  if (!candidate) return {};
  return {
    [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: structuredClone(candidate),
    [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: structuredClone(candidate),
  };
}

/** Build the explicit per-channel STCK context expected by the decision port. */
export function publicStckAddressedJointContext(
  observation: AgentObservation,
): Readonly<Record<string, unknown>> {
  const candidate = producePublicStckTargetCandidate(observation);
  if (!candidate) return {};
  return {
    [PUBLIC_ACTION_AVAILABILITY_CHANNEL_ID]: structuredClone(candidate),
    [PUBLIC_VISIBLE_TARGET_CHANNEL_ID]: structuredClone(candidate),
  };
}
