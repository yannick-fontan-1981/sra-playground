import { acquireTransientCurve, matchingTransientDisplay, projectTransientCurve, transientSignature, transientSourceRoleProbe } from '../logos-engine/v6-transient-contact-memory.ts';
import { measureScalarFillDisplay, orderedTransientComponentPathFacts } from '../logos-engine/v6-transient-measurements.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { supportKey, supportParts } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';

type Model = NonNullable<ReturnType<typeof acquireTransientCurve>>;
type Adjustment = { delta: number; evidence: string };
type Impact = { point: NativePoint; count: number; obstacle: NativeBox; evidence: string; displayOverlay?: string };
export type CurveWitness = { model: Model; epoch: number | null; controls: Record<string, Adjustment>; attempted: string[];
  boundary?: string; impact?: Impact };
export const regulatedContactStrategies = {
  measure_trajectory_adjustment: 'Test how an available command changes the visible magnitude',
  raise_trajectory_clearance: 'Raise the observed magnitude to seek a contact that clears the visible obstacles',
  test_regulated_contact: 'Test a contact projected from the observed motion and current magnitude',
  verify_relocated_source: 'Test the trajectory of the newly located source',
  prepare_obstacle_clearance: 'Adjust the magnitude of the trajectory that hit the obstacle',
  test_obstacle_clearance: 'Repeat the same aim after the projected path clears the obstacle',
} as const;
type Strategy = keyof typeof regulatedContactStrategies;
export type RegulatedChoice = {
  strategy: Strategy; action: NativeCommand; source: NativeBox; peer: NativeBox; meter: NativeBox; projected: NativePoint | null;
  count: number; expectedSign: number | null; shot: string | null; evidence: string[];
  sourceCandidate?: string; impact?: Impact;
};

function measureImpact(model: Model, facts: NativeRecord, first: NativeRows, second: NativeRows,
  animationStart: NativeRows, command: NativeCommand, evidence: string): Impact | null {
  if (facts.transient_terminal_restored_persistent_contact_present !== true) return null;
  const parts = supportParts(first), terminal = facts.transient_terminal_restored_persistent_component_ref;
  const obstacle = parts.find(part => part.component_id === terminal && part.area > 1);
  if (!obstacle || terminal === facts.unique_transient_path_source_component_ref || transientSignature(obstacle) === model.peer_signature) return null;
  const { left, top, right, bottom } = obstacle.bbox;
  const { x, y } = command.data;
  if (x === undefined || y === undefined) return null;
  const oldIds = new Set(parts.map(part => part.component_id));
  const overlays = supportParts(second).filter(part => !oldIds.has(part.component_id) && part.area < model.track[0].area
    && part.bbox.left <= x && x <= part.bbox.right && part.bbox.top <= y && y <= part.bbox.bottom);
  // A visible aim mark is only exempted if it was already drawn when the returning piece crossed it.
  const overlay = overlays.length === 1 ? overlays[0]! : null;
  const covered = new Set(overlay?.pixels.map(supportKey));
  const crossesMark = overlay && supportParts(animationStart).some(part => part.component_id === overlay.component_id)
    && model.track.slice(0, -2).some((sample: { pixels: number[][] }) => sample.pixels.some(pixel => covered.has(supportKey(pixel))));
  return { point: [x, y], count: model.fill.scalar_fill_count, obstacle: [left, top, right, bottom], evidence,
    ...(crossesMark ? { displayOverlay: overlay.component_id } : {}) };
}

export function learnCurveWitness(before: NativeObservation, after: NativeObservation, command: NativeCommand,
  first: NativeRows, second: NativeRows, frames: readonly NativeRows[], prior?: CurveWitness | null,
  sourceCandidate?: string): CurveWitness | null {
  if (command.action_ref !== 'ACTION6' || frames.length < 5) return null;
  const intermediate = symbolicDigest(frames.at(-1)!) === symbolicDigest(second) ? frames.slice(0, -1) : frames;
  const facts = orderedTransientComponentPathFacts(first, intermediate, second, command.action_ref, command.data);
  if (sourceCandidate && sourceCandidate !== facts.unique_transient_path_source_component_ref) return null;
  const model = acquireTransientCurve(first, intermediate, facts, before.level_epoch, [before.observation_ref, after.observation_ref],
    command, prior ? [prior.model] : []);
  if (!model?.fill.scalar_fill_display_present || model.fill.scalar_fill_count < 1) return null;
  const impact = sourceCandidate || prior?.impact
    ? measureImpact(model, facts, first, second, intermediate[0]!, command, after.observation_ref) : null;
  return { model, epoch: null, controls: {}, attempted: [], ...(impact ? { impact } : {}) };
}

export function chooseRegulatedContact(witness: CurveWitness, observation: NativeObservation, rows: NativeRows): RegulatedChoice | null {
  const available = observation.available_action_refs;
  if (witness.epoch !== observation.level_epoch || !available.includes('ACTION6')) return null;
  const fill = measureScalarFillDisplay(rows), count = fill.scalar_fill_count as number;
  if (!matchingTransientDisplay(witness.model.fill, fill) || count < 1) return null;
  const current = projectTransientCurve(witness.model, rows, count);
  const role = current.reason === 'current_source_peer_not_unique' && witness.model.acquisition_epoch !== observation.level_epoch
    ? transientSourceRoleProbe(witness.model, rows) : null;
  const sourceCandidate = role?.source_candidate as string | undefined;
  const project = (magnitude: number) => sourceCandidate ? projectTransientCurve(witness.model, rows, magnitude, { sourceCandidate })
    : projectTransientCurve(witness.model, rows, magnitude);
  const projection = sourceCandidate ? project(count) : current;
  if (projection.status !== 'measured') return null;
  const positive = Object.entries(witness.controls).filter(([input, entry]) => entry.delta > 0 && available.includes(input));
  const evidence = [...new Set([...(witness.model.evidence as string[]), ...(witness.boundary ? [witness.boundary] : []),
    ...(witness.impact ? [witness.impact.evidence] : []),
    ...Object.values(witness.controls).map(entry => entry.evidence)])];
  const meter: NativeBox = fill.scalar_fill_orientation === 'horizontal'
    ? [fill.scalar_fill_start, fill.scalar_fill_index, fill.scalar_fill_end, fill.scalar_fill_index]
    : [fill.scalar_fill_index, fill.scalar_fill_start, fill.scalar_fill_index, fill.scalar_fill_end];
  const view = { source: projection.source_box as NativeBox, peer: projection.peer_box as NativeBox, meter, count, evidence };
  const increase = positive[0];
  const impact = witness.impact;
  if (impact && increase) {
    const projectAim = (magnitude: number, displayOverlay?: string) => projectTransientCurve(witness.model, rows, magnitude, {
      aim: impact.point, displayOverlay,
    }).contact_solution;
    const [x, y] = impact.point, shot = [count, x, y].join(',');
    if (count > impact.count && projectAim(count, impact.displayOverlay) && !witness.attempted.includes(shot)) {
      return { ...view, strategy: 'test_obstacle_clearance', action: { action_ref: 'ACTION6', data: { x, y } },
        projected: impact.point, expectedSign: null, shot, impact };
    }
    if (count === impact.count && !projectAim(count, impact.displayOverlay) && projectAim(count + increase[1].delta, impact.displayOverlay)) {
      return { ...view, strategy: 'prepare_obstacle_clearance', action: { action_ref: increase[0], data: {} },
        projected: null, expectedSign: 1, shot: null, impact };
    }
  }
  const point = projection.contact_solution as NativePoint | null;
  const guardCount = increase && count > witness.model.fill.scalar_fill_count ? count - increase[1].delta : count;
  const guard = guardCount === count ? projection : project(guardCount);
  if (point && guard.contact_solution) {
    const [y, x] = point, shot = [count, x, y].join(',');
    if (!witness.attempted.includes(shot)) {
      return { ...view, strategy: sourceCandidate ? 'verify_relocated_source' : 'test_regulated_contact',
        action: { action_ref: 'ACTION6', data: { x, y } }, projected: [x, y], expectedSign: null, shot,
        ...(sourceCandidate ? { sourceCandidate } : {}) };
    }
  }
  if (impact) return null;
  const input = increase?.[0] ?? available.find(action => /^ACTION[1-4]$/.test(action) && !witness.controls[action]);
  if (!input) return null;
  const strategy = increase ? 'raise_trajectory_clearance' : 'measure_trajectory_adjustment';
  return { ...view, strategy, action: { action_ref: input, data: {} }, projected: null,
    expectedSign: increase ? 1 : null, shot: null, ...(sourceCandidate ? { sourceCandidate } : {}) };
}

export function measureRegulatedAdjustment(choice: RegulatedChoice, first: NativeRows, second: NativeRows): number | null {
  const fill = measureScalarFillDisplay(second);
  if (!matchingTransientDisplay(measureScalarFillDisplay(first), fill)) return null;
  for (const [left, top, right, bottom] of [choice.source, choice.peer]) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (first[y]?.[x] !== second[y]?.[x]) return null;
    }
  }
  return fill.scalar_fill_count - choice.count;
}

export function retainRegulatedReturn(witness: CurveWitness, choice: RegulatedChoice, before: NativeObservation,
  after: NativeObservation, first: NativeRows, second: NativeRows, frames: readonly NativeRows[]): CurveWitness {
  if (after.levels_completed > before.levels_completed) {
    const { impact: _impact, ...retained } = witness;
    return { ...retained, epoch: after.level_epoch, boundary: after.observation_ref, attempted: [] };
  }
  if (choice.shot) {
    const measurement = learnCurveWitness(before, after, choice.action, first, second, frames, witness, choice.sourceCandidate);
    const { impact: _impact, ...retained } = witness;
    return { ...retained, ...(measurement ? { model: measurement.model } : {}), ...(measurement?.impact ? { impact: measurement.impact } : {}),
      attempted: [...witness.attempted, choice.shot] };
  }
  const delta = measureRegulatedAdjustment(choice, first, second);
  return { ...witness, controls: { ...witness.controls, [choice.action.action_ref]: { delta: delta ?? 0, evidence: after.observation_ref } } };
}
