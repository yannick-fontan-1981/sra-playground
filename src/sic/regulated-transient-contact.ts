import { acquireTransientCurve, matchingTransientDisplay, projectTransientCurve } from '../logos-engine/v6-transient-contact-memory.ts';
import { measureScalarFillDisplay, orderedTransientComponentPathFacts } from '../logos-engine/v6-transient-measurements.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import type { NativeBox, NativeCommand, NativeObservation, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';

type Model = NonNullable<ReturnType<typeof acquireTransientCurve>>;
type Adjustment = { delta: number; evidence: string };
export type CurveWitness = { model: Model; epoch: number | null; controls: Record<string, Adjustment>; attempted: string[]; boundary?: string };
export const regulatedContactStrategies = {
  measure_trajectory_adjustment: 'Test how an available command changes the visible magnitude',
  raise_trajectory_clearance: 'Raise the observed magnitude to seek a contact that clears the visible obstacles',
  test_regulated_contact: 'Test a contact projected from the observed motion and current magnitude',
} as const;
type Strategy = keyof typeof regulatedContactStrategies;
export type RegulatedChoice = {
  strategy: Strategy; action: NativeCommand; source: NativeBox; peer: NativeBox; meter: NativeBox; projected: NativePoint | null;
  count: number; expectedSign: number | null; shot: string | null; evidence: string[];
};

export function learnCurveWitness(before: NativeObservation, after: NativeObservation, command: NativeCommand,
  first: NativeRows, second: NativeRows, frames: readonly NativeRows[], prior?: CurveWitness | null): CurveWitness | null {
  if (command.action_ref !== 'ACTION6' || frames.length < 5) return null;
  const intermediate = symbolicDigest(frames.at(-1)!) === symbolicDigest(second) ? frames.slice(0, -1) : frames;
  const facts = orderedTransientComponentPathFacts(first, intermediate, second, command.action_ref, command.data);
  const model = acquireTransientCurve(first, intermediate, facts, before.level_epoch, [before.observation_ref, after.observation_ref],
    command, prior ? [prior.model] : []);
  return model?.fill.scalar_fill_display_present && model.fill.scalar_fill_count > 0
    ? { model, epoch: null, controls: {}, attempted: [] } : null;
}

export function chooseRegulatedContact(witness: CurveWitness, observation: NativeObservation, rows: NativeRows): RegulatedChoice | null {
  const available = observation.available_action_refs;
  if (witness.epoch !== observation.level_epoch || !available.includes('ACTION6')) return null;
  const fill = measureScalarFillDisplay(rows), count = fill.scalar_fill_count as number;
  if (!matchingTransientDisplay(witness.model.fill, fill) || count < 1) return null;
  const projection = projectTransientCurve(witness.model, rows, count);
  if (projection.status !== 'measured') return null;
  const positive = Object.entries(witness.controls).filter(([input, entry]) => entry.delta > 0 && available.includes(input));
  const evidence = [...new Set([...(witness.model.evidence as string[]), ...(witness.boundary ? [witness.boundary] : []),
    ...Object.values(witness.controls).map(entry => entry.evidence)])];
  const meter: NativeBox = fill.scalar_fill_orientation === 'horizontal'
    ? [fill.scalar_fill_start, fill.scalar_fill_index, fill.scalar_fill_end, fill.scalar_fill_index]
    : [fill.scalar_fill_index, fill.scalar_fill_start, fill.scalar_fill_index, fill.scalar_fill_end];
  const view = { source: projection.source_box as NativeBox, peer: projection.peer_box as NativeBox, meter, count, evidence };
  const point = projection.contact_solution as NativePoint | null;
  const increase = positive[0];
  const guardCount = increase && count > witness.model.fill.scalar_fill_count ? count - increase[1].delta : count;
  const guard = guardCount === count ? projection : projectTransientCurve(witness.model, rows, guardCount);
  if (point && guard.contact_solution) {
    const [y, x] = point, shot = [count, x, y].join(',');
    if (!witness.attempted.includes(shot)) {
      return { ...view, strategy: 'test_regulated_contact', action: { action_ref: 'ACTION6', data: { x, y } },
        projected: [x, y], expectedSign: null, shot };
    }
  }
  const input = increase?.[0] ?? available.find(action => /^ACTION[1-4]$/.test(action) && !witness.controls[action]);
  if (!input) return null;
  const strategy = increase ? 'raise_trajectory_clearance' : 'measure_trajectory_adjustment';
  return { ...view, strategy, action: { action_ref: input, data: {} }, projected: null,
    expectedSign: increase ? 1 : null, shot: null };
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
    return { ...witness, epoch: after.level_epoch, boundary: after.observation_ref, attempted: [] };
  }
  if (choice.shot) {
    const measurement = learnCurveWitness(before, after, choice.action, first, second, frames, witness);
    return { ...witness, ...(measurement ? { model: measurement.model } : {}), attempted: [...witness.attempted, choice.shot] };
  }
  const delta = measureRegulatedAdjustment(choice, first, second);
  return { ...witness, controls: { ...witness.controls, [choice.action.action_ref]: { delta: delta ?? 0, evidence: after.observation_ref } } };
}
