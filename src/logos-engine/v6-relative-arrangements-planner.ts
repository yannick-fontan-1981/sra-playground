/** Finite source geometry and conditional actuator experiments; no acquired universal gain. */
import { canonical } from './canonical.ts';
import type { NativeRecord } from './v6-native-types.ts';
import type { RelativeArrangementLayout, RelativeArrangementModel, RelativeArrangementPoint,
  RelativeArrangementTarget } from './v6-relative-arrangements-geometry.ts';

export interface RelativeArrangementConfiguration {
  maximum_assignments: number; first_control_step: number; unmeasured_concordant_gain: number;
  order: string[]; question: string; experiment_semantics: string;
}
export type RelativeArrangementTrial = readonly [readonly [number, number], string, readonly [number, number], readonly [number, number]];
export interface RelativeArrangementPair { from: RelativeArrangementPoint; to: RelativeArrangementPoint; value: number }
export interface RelativeArrangementAssignment {
  target: RelativeArrangementTarget; pairs: RelativeArrangementPair[]; moves: RelativeArrangementPair[]; distance: number;
}
type RelativeArrangementRank = [number, number, 1, RelativeArrangementPoint] | [number, number, 0, number, RelativeArrangementPoint];
export interface RelativeArrangementOffer extends NativeRecord {
  kind: 'select_participant' | 'probe_actuator_relation'; point: RelativeArrangementPoint;
  goal: RelativeArrangementAssignment; move: RelativeArrangementPair;
  predictions: { selected_participant: RelativeArrangementPoint; actuator_marker?: RelativeArrangementPoint };
  model_evidence: string[]; assumptions: string[]; falsifiers: string[]; risks: string[]; cost: 1; rank: RelativeArrangementRank;
  pad_ref?: string; trial?: RelativeArrangementTrial; unmeasured_axes?: number[]; alternatives?: string[];
}

const samePoint = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const pointOrder = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const distance = (a: readonly number[], b: readonly number[]): number => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!);
export const relativeArrangementTrialKey = (trial: RelativeArrangementTrial): string => canonical(trial);

/** itertools.permutations preserves input/index order, including repeated values. */
function* permutations<T>(values: readonly T[]): Generator<T[]> {
  const used = Array<boolean>(values.length).fill(false), chosen: T[] = [];
  function* visit(): Generator<T[]> {
    if (chosen.length === values.length) { yield [...chosen]; return; }
    for (let index = 0; index < values.length; index++) {
      if (used[index]) continue;
      used[index] = true; chosen.push(values[index]!); yield* visit(); chosen.pop(); used[index] = false;
    }
  }
  yield* visit();
}
/** Last group advances fastest, and product of no groups contains one empty tuple. */
function* product<T>(groups: readonly (readonly T[])[]): Generator<T[]> {
  if (groups.some(group => !group.length)) return;
  const indices = groups.map(() => 0);
  while (true) {
    yield groups.map((group, index) => group[indices[index]!]!);
    let axis = groups.length - 1;
    while (axis >= 0) {
      indices[axis] = indices[axis]! + 1;
      if (indices[axis]! < groups[axis]!.length) break;
      indices[axis] = 0; axis--;
    }
    if (axis < 0) return;
  }
}
function rankOrder(a: RelativeArrangementRank, b: RelativeArrangementRank): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const x = a[index]!, y = b[index]!;
    const order = Array.isArray(x) && Array.isArray(y) ? pointOrder(x, y) : (x as number) - (y as number);
    if (order) return order;
  }
  return a.length - b.length;
}

export function relativeArrangementAssignments(layout: RelativeArrangementLayout, targets: readonly RelativeArrangementTarget[],
  limit: number): RelativeArrangementAssignment[] {
  const objects = layout.objects, values = [...new Set(objects.map(obj => obj.value))].sort((a, b) => a - b);
  const out: RelativeArrangementAssignment[] = [];
  for (const target of targets) {
    const groups: RelativeArrangementPair[][][] = [];
    for (const value of values) {
      const source = objects.filter(obj => obj.value === value).map(obj => [...obj.xy] as RelativeArrangementPoint).sort(pointOrder);
      const wanted = target.target.filter(([, , v]) => v === value).map(([x, y]): RelativeArrangementPoint => [x, y]).sort(pointOrder);
      if (source.length > 6) return [];
      const choices: RelativeArrangementPair[][] = [];
      for (const order of permutations(wanted)) choices.push(source.slice(0, order.length).map((from, i) => ({ from, to: order[i]!, value })));
      groups.push(choices);
    }
    // These two source refusals discard all earlier targets too. The declared
    // assignment limit is per target product, not a new global search cap.
    if (groups.reduce((count, group) => count * group.length, 1) > limit) return [];
    for (const parts of product(groups)) {
      const pairs = parts.flat().map(({ from, to, value }): RelativeArrangementPair => ({ from: [...from], to: [...to], value }));
      const moves = pairs.filter(pair => !samePoint(pair.from, pair.to));
      out.push({ target, pairs, moves, distance: moves.reduce((total, pair) => total + distance(pair.from, pair.to), 0) });
    }
  }
  return out;
}

export function relativeArrangementOptions(layout: RelativeArrangementLayout, targets: readonly RelativeArrangementTarget[],
  models: readonly RelativeArrangementModel[], selectionRef: string | null, failed: ReadonlySet<string>,
  config: RelativeArrangementConfiguration): RelativeArrangementOffer[] {
  const alternatives = relativeArrangementAssignments(layout, targets, config.maximum_assignments), selected = layout.selected;
  const offers: RelativeArrangementOffer[] = [];
  for (const goal of alternatives) {
    if (!goal.moves.length) continue;
    const available = goal.moves.filter(move => selected && samePoint(move.from, selected.xy) && move.value === selected.value);
    if (!available.length) {
      for (const move of goal.moves) {
        const role = layout.objects.find(obj => samePoint(obj.xy, move.from) && obj.value === move.value)!;
        offers.push({ kind: 'select_participant', point: role.point, goal, move, predictions: { selected_participant: role.xy }, model_evidence: [],
          assumptions: ['pointing_may_select_this_participant'], falsifiers: ['no_unique_selection_marker', 'another_participant_changes'],
          risks: ['selection_effect_not_yet_attested'], cost: 1, rank: [goal.distance, goal.moves.length, 1, move.from] });
      }
      continue;
    }
    const move = available[0]!, residual: RelativeArrangementPoint = [move.to[0] - move.from[0], move.to[1] - move.from[1]];
    for (const pad of layout.pads) {
      const marker = pad.selected;
      if (!marker || marker.value !== selected!.value) continue;
      const records = models.filter(model => model.control.pad_ref === pad.ref && (model.selection_ref ?? null) === selectionRef
        && model.object_value === selected!.value);
      const gains = new Map<number, number>(), refs: string[] = [];
      let contradiction = false;
      for (const model of records) {
        const diff: RelativeArrangementPoint = [model.control.to[0] - model.control.from[0], model.control.to[1] - model.control.from[1]];
        for (const axis of [0, 1] as const) {
          if (!diff[axis]) continue;
          const gain = model.delta[axis] / diff[axis];
          if (!gain || Math.abs(model.delta[axis]) > Math.floor(layout.shape[axis] / 2)) continue;
          if (gains.has(axis) && gains.get(axis) !== gain) contradiction = true;
          gains.set(axis, gain); refs.push(...model.evidence);
        }
      }
      if (contradiction) continue;
      for (const dest of pad.cells) {
        const d: RelativeArrangementPoint = [dest.xy[0] - marker.xy[0], dest.xy[1] - marker.xy[1]];
        if (!d.some(value => value !== 0)) continue;
        if (!records.length && Math.max(...d.map(Math.abs)) > config.first_control_step) continue;
        // Fractional source gains remain exact binary-number calculations. A
        // nonintegral predicted locus is rejected, without rounding or repair.
        const predicted: RelativeArrangementPoint = [
          move.from[0] + d[0] * (gains.get(0) ?? config.unmeasured_concordant_gain),
          move.from[1] + d[1] * (gains.get(1) ?? config.unmeasured_concordant_gain),
        ];
        if (predicted.some((value, axis) => value !== Math.trunc(value) || !(0 <= value && value < layout.shape[axis]!))) continue;
        const remaining = distance(predicted, move.to), before = residual.reduce((sum, value) => sum + Math.abs(value), 0);
        if (remaining >= before) continue;
        if (layout.objects.some(obj => samePoint(obj.xy, predicted) && !samePoint(obj.xy, selected!.xy))) continue;
        const trial: RelativeArrangementTrial = [selected!.xy, pad.ref, marker.xy, dest.xy];
        if (failed.has(relativeArrangementTrialKey(trial))) continue;
        const unmeasured = [0, 1].filter(axis => d[axis] && !gains.has(axis));
        offers.push({ kind: 'probe_actuator_relation', point: dest.point, goal, move, pad_ref: pad.ref, trial,
          predictions: { selected_participant: predicted.map(Math.trunc) as RelativeArrangementPoint, actuator_marker: dest.xy },
          model_evidence: [...new Set(refs)], assumptions: ['current_selection_and_pad_gain_persist',
            ...(unmeasured.length ? ['concordant_unit_gain_unmeasured_axes'] : [])], unmeasured_axes: unmeasured,
          alternatives: ['no_motion', 'opposite_motion', 'different_gain', 'coupled_motion', 'edge_transition'],
          falsifiers: ['other_participant_changes', 'different_observed_displacement', 'marker_does_not_follow', 'expected_relative_arrangement_without_boundary'],
          risks: ['return_not_proven', 'gain_not_universal', 'possible_overlap_or_nonlocal_transition'], cost: 1,
          rank: [goal.distance - before + remaining, goal.moves.length, 0, unmeasured.length, dest.point] });
      }
    }
  }
  // Modern JS sort is stable, preserving source offer order for equal ranks.
  return offers.sort((a, b) => rankOrder(a.rank, b.rank));
}
