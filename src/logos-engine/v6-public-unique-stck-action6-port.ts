import type { AgentAction, AgentObservation } from '../runtime/contracts.ts';
import type { CompositionBundle } from './v6-composition-engine.ts';
import type { AuthorityObservationIdentity } from './v6-native-authority.ts';
import type { SymbolicRecord } from './v6-operations.ts';

export interface PublicUniqueStckAction6Target {
  kind: 'stck-stack-card';
  x: number;
  y: number;
  evidenceRef: string;
}

export interface PublicUniqueStckAction6Preparation {
  action: AgentAction;
  bundle: CompositionBundle;
  state: SymbolicRecord;
  identity: AuthorityObservationIdentity;
  target: PublicUniqueStckAction6Target;
}

const STCK_CARD_COLORS = new Set([7, 8, 9, 10, 11, 14]);

function publicImageFrame(observation: AgentObservation): Uint8Array | undefined {
  if (
    observation.state !== 'NOT_FINISHED'
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

function uniqueStackCardTarget(
  frame: Uint8Array,
): PublicUniqueStckAction6Target | undefined {
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
  return {
    kind: 'stck-stack-card',
    x: 4,
    y: Math.floor((run.startY + run.endY) / 2),
    evidenceRef: `public-stck-stack-card:${run.color}:${run.startY}-${run.endY}`,
  };
}

/**
 * Detect one visible STCK stack card from the public image alone.
 *
 * This image-only producer deliberately does not inspect action availability so
 * a separate symbolic channel can own physical ACTION6 admissibility. Several
 * public cards remain unresolved; no ranking rule is introduced.
 */
export function findUniqueVisibleStckStackCardTarget(
  observation: AgentObservation,
): PublicUniqueStckAction6Target | undefined {
  const frame = publicImageFrame(observation);
  return frame ? uniqueStackCardTarget(frame) : undefined;
}

/**
 * Detect one actionable STCK stack card without using the historical bottom-most
 * ranking rule. Each public card body is a solid 8-pixel-wide block in the left
 * stack panel, with at least two rows and a one-row gap between cards.
 */
export function findUniqueStckStackCardTarget(
  observation: AgentObservation,
): PublicUniqueStckAction6Target | undefined {
  if (!observation.availableActionIds.includes(6)) return undefined;
  return findUniqueVisibleStckStackCardTarget(observation);
}

/**
 * Build an OP28 bundle only after the public STCK observation proves one
 * complete ACTION6 coordinate pair. Several cards remain unresolved.
 */
export function preparePublicUniqueStckAction6Decision(
  observation: AgentObservation,
): PublicUniqueStckAction6Preparation | undefined {
  const target = findUniqueStckStackCardTarget(observation);
  if (!target) return undefined;

  const action: AgentAction = { id: 6, data: { x: target.x, y: target.y } };
  const scope = `${observation.sessionId}:level:${observation.level}`;
  const observationRef = `public-observation:${observation.sessionId}:${observation.sequence}`;
  const targetRef = `public-action6-target:STCK:${target.kind}:${target.x}:${target.y}`;
  const compositionRef = `public-action6:${scope}:STCK:${target.kind}`;
  const objectiveRef = `public-objective:${scope}:probe-unique-stck-card`;
  const bundleId = `public-action6-bundle:${scope}:${observation.sequence}:STCK:${target.x}:${target.y}`;
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
    purpose: 'probe the sole publicly observed STCK stack card without ranking alternatives',
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
