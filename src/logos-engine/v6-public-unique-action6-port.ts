import type { AgentAction, AgentObservation } from '../runtime/contracts.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import type { AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { SymbolicRecord } from './v6-operations.ts';

export type PublicUniqueAction6TargetKind = 'stck-stack-card' | 'smlp-gate';

export interface PublicUniqueAction6Target {
  kind: PublicUniqueAction6TargetKind;
  x: number;
  y: number;
  evidenceRef: string;
}

export interface PublicUniqueAction6Preparation {
  action: AgentAction;
  bundle: CompositionBundle;
  state: SymbolicRecord;
  identity: AuthorityObservationIdentity;
  target: PublicUniqueAction6Target;
}

const STCK_CARD_COLORS = new Set([7, 8, 9, 10, 11, 14]);
const SMLP_EXCLUDED_OPEN_COLORS = new Set([2, 3, 4, 5]);

function publicFrame(observation: AgentObservation): Uint8Array | undefined {
  if (
    observation.state !== 'NOT_FINISHED'
    || !observation.availableActionIds.includes(6)
    || observation.image.width !== 64
    || observation.image.height !== 64
    || observation.image.pixelFormat !== 'palette-index-u8'
    || observation.image.pixels.length !== 4096
  ) {
    return undefined;
  }
  return observation.image.pixels;
}

function pixel(frame: Uint8Array, x: number, y: number): number {
  return frame[y * 64 + x] ?? -1;
}

function allSame(values: readonly (number | undefined)[]): boolean {
  const first = values[0];
  return first !== undefined && values.every(value => value === first);
}

function uniqueTarget(
  targets: Map<string, PublicUniqueAction6Target>,
): PublicUniqueAction6Target | undefined {
  return targets.size === 1 ? targets.values().next().value : undefined;
}

/**
 * Detect one visible STCK stack card without using the historical bottom-most
 * ranking rule. Each public card body is a solid 8-pixel-wide block in the left
 * stack panel, with at least two rows and a one-row gap between cards.
 */
export function findUniqueStckStackCardTarget(
  observation: AgentObservation,
): PublicUniqueAction6Target | undefined {
  const frame = publicFrame(observation);
  if (!frame) return undefined;

  const runs: Array<{ color: number; startY: number; endY: number }> = [];
  let active: { color: number; startY: number; endY: number } | undefined;

  for (let y = 0; y <= 53; y += 1) {
    const color = pixel(frame, 4, y);
    const solid = STCK_CARD_COLORS.has(color)
      && [2, 3, 4, 5, 6, 7].every(x => pixel(frame, x, y) === color);

    if (solid && active?.color === color && active.endY + 1 === y) {
      active.endY = y;
      continue;
    }
    if (active) {
      if (active.endY - active.startY + 1 >= 2) runs.push(active);
      active = undefined;
    }
    if (solid) active = { color, startY: y, endY: y };
  }
  if (active && active.endY - active.startY + 1 >= 2) runs.push(active);
  if (runs.length !== 1) return undefined;

  const run = runs[0]!;
  const y = Math.floor((run.startY + run.endY) / 2);
  return {
    kind: 'stck-stack-card',
    x: 4,
    y,
    evidenceRef: `public-stck-stack-card:${run.color}:${run.startY}-${run.endY}`,
  };
}

function smlpGateAt(
  frame: Uint8Array,
  x: number,
  y: number,
): boolean {
  const patch = [
    [pixel(frame, x - 1, y - 1), pixel(frame, x, y - 1), pixel(frame, x + 1, y - 1)],
    [pixel(frame, x - 1, y), pixel(frame, x, y), pixel(frame, x + 1, y)],
    [pixel(frame, x - 1, y + 1), pixel(frame, x, y + 1), pixel(frame, x + 1, y + 1)],
  ];

  const verticalLine = patch[0]![1] === 5 && patch[1]![1] === 5 && patch[2]![1] === 5;
  if (verticalLine) {
    const surround = [patch[0]![0], patch[0]![2], patch[1]![0], patch[1]![2], patch[2]![0], patch[2]![2]];
    if (allSame(surround) && surround[0] !== 5) return true;
  }

  const horizontalLine = patch[1]![0] === 5 && patch[1]![1] === 5 && patch[1]![2] === 5;
  if (horizontalLine) {
    const surround = [patch[0]![0], patch[0]![1], patch[0]![2], patch[2]![0], patch[2]![1], patch[2]![2]];
    if (allSame(surround) && surround[0] !== 5) return true;
  }

  const openHorizontalColor = patch[0]![1]!;
  const openHorizontal = patch[2]![1] === openHorizontalColor
    && !SMLP_EXCLUDED_OPEN_COLORS.has(openHorizontalColor)
    && patch[1]![1] === 3
    && [patch[0]![0], patch[0]![2], patch[1]![0], patch[1]![2], patch[2]![0], patch[2]![2]]
      .every(value => value === 2);
  if (openHorizontal) return true;

  const openVerticalColor = patch[1]![0]!;
  return patch[1]![2] === openVerticalColor
    && !SMLP_EXCLUDED_OPEN_COLORS.has(openVerticalColor)
    && patch[1]![1] === 3
    && [patch[0]![0], patch[0]![1], patch[0]![2], patch[2]![0], patch[2]![1], patch[2]![2]]
      .every(value => value === 2);
}

/** Detect exactly one public SMLP gate glyph. Multiple glyphs remain unknown. */
export function findUniqueSmlpGateTarget(
  observation: AgentObservation,
): PublicUniqueAction6Target | undefined {
  const frame = publicFrame(observation);
  if (!frame) return undefined;

  const targets = new Map<string, PublicUniqueAction6Target>();
  for (let y = 8; y <= 58; y += 1) {
    for (let x = 1; x <= 62; x += 1) {
      if (!smlpGateAt(frame, x, y)) continue;
      const key = `${x}:${y}`;
      targets.set(key, {
        kind: 'smlp-gate',
        x,
        y,
        evidenceRef: `public-smlp-gate:${key}`,
      });
      if (targets.size > 1) return undefined;
    }
  }
  return uniqueTarget(targets);
}

/**
 * Resolve one game-bounded ACTION6 target solely from the public frame.
 * Unsupported games, absent targets and multiple targets produce no proposal.
 */
export function findUniquePublicAction6Target(
  gameCode: string,
  observation: AgentObservation,
): PublicUniqueAction6Target | undefined {
  if (gameCode === 'STCK') return findUniqueStckStackCardTarget(observation);
  if (gameCode === 'SMLP') return findUniqueSmlpGateTarget(observation);
  return undefined;
}

/**
 * Build an OP28 bundle only after the public observation proves one complete
 * ACTION6 coordinate pair. This producer never ranks several possible targets.
 */
export function preparePublicUniqueAction6Decision(
  gameCode: string,
  observation: AgentObservation,
): PublicUniqueAction6Preparation | undefined {
  const target = findUniquePublicAction6Target(gameCode, observation);
  if (!target) return undefined;

  const action: AgentAction = { id: 6, data: { x: target.x, y: target.y } };
  const scope = `${observation.sessionId}:level:${observation.level}`;
  const observationRef = `public-observation:${observation.sessionId}:${observation.sequence}`;
  const targetRef = `public-action6-target:${gameCode}:${target.kind}:${target.x}:${target.y}`;
  const compositionRef = `public-action6:${scope}:${gameCode}:${target.kind}`;
  const objectiveRef = `public-objective:${scope}:probe-unique-coordinate-target`;
  const bundleId = `public-action6-bundle:${scope}:${observation.sequence}:${gameCode}:${target.x}:${target.y}`;
  const facts = {
    public_action6_available: true,
    public_action6_target_unique: true,
    public_action6_target_kind: target.kind,
    public_action6_target_x: target.x,
    public_action6_target_y: target.y,
  };

  const bundle: CompositionBundle = {
    id: bundleId,
    operation_key: 'OP28',
    composition_ref: compositionRef,
    objective_ref: objectiveRef,
    preserve_refs: [observationRef],
    observation_revision: observation.sequence,
    kind: 'realize',
    actions: [action],
    purpose: 'probe the sole publicly observed coordinate target without ranking alternatives',
    preconditions: facts,
    evidence: [observationRef, targetRef, target.evidenceRef, 'public-available-actions:ACTION6'],
    preservation_evidence: {
      [observationRef]: 'public-observation-contract-v1',
    },
    outcome_guard: { path: ['value'], contains: bundleId },
  };

  const state: SymbolicRecord = {
    compositions: [
      { id: observationRef, observed: true },
      { id: targetRef, observed: true },
      { id: compositionRef, observed: true },
      { id: objectiveRef, observed: true },
    ],
    facts,
    bundles: [{
      id: bundleId,
      composition_ref: compositionRef,
      admitted: true,
      actions: [action],
      evidence: target.evidenceRef,
    }],
  };

  return {
    action,
    bundle,
    state,
    target,
    identity: {
      episodeId: observation.sessionId,
      levelEpoch: scope,
      observationId: observationRef,
      observationRevision: observation.sequence,
    },
  };
}
