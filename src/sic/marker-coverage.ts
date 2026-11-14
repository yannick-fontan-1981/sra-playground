import {
  acquireConstellation, constellationAgreement, constellationBodyPixels, constellationCursorAt, constellationFocus,
  constellationJointGoal, constellationMaterial, constellationMechanicalPoseOptions, constellationMinus, constellationOutside,
  constellationPlus, ConstellationEvidence, measureConstellationLayout,
} from '../logos-engine/v6-constellation-cover.ts';
import { PointSet, type Point } from '../logos-engine/v6-point-set.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const markerCoverageId = 'sic_marker_coverage';
export const markerCoverageStrategies = {
  measure_support_motion: 'Test how the selected piece moves',
  measure_remaining_directions: 'Complete the observed movement controls',
  change_controlled_support: 'Change which piece is controlled',
  cover_compatible_markers: 'Move the selected piece toward compatible markers',
} as const;

const graph = compileStrategyGraph({
  id: 'place_independently_controlled_supports', version: 1, order: 'FALLBACK',
  priorities: ['cover_compatible_markers', 'change_controlled_support', 'measure_remaining_directions', 'measure_support_motion'],
  strategies: {
    measure_support_motion: [{ fact: 'acquire', expected: true, label: 'Independent movement is needed to distinguish the selected piece from overlapping pieces' }],
    measure_remaining_directions: [{ fact: 'calibrate', expected: true, label: 'The selected piece is tracked and some directions remain unmeasured' }],
    change_controlled_support: [{ fact: 'cycle', expected: true, label: 'Another piece must be measured or moved and the input is a candidate for changing selection' }],
    cover_compatible_markers: [{ fact: 'move', expected: true, label: 'The pieces fit the current view and a measured direction brings one closer to a compatible placement' }],
  },
}, ['acquire', 'calibrate', 'cycle', 'move']);

type Step = { action: NativeCommand; cursor: Point; mode: 'acquire' | 'calibrate' | 'cycle' | 'move';
  poses?: readonly Point[]; expected_after: readonly Point[] | null; acquisition_focus_projection?: Point; unobserved_support_pixels?: number };
type Proposal = NativeProposal & { steps: readonly [Step]; measured: NativeRecord; count: number; needId: string };

const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const samePoint = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const distance = ([x, y]: Point) => Math.abs(x) + Math.abs(y);
function bounds(points: Iterable<Point>): NativeBox | null {
  const entries = [...points];
  if (!entries.length) return null;
  const xs = entries.map(point => point[0]), ys = entries.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

function measurements(snapshot: NativeRecord | null): ConstellationEvidence {
  const measured = new ConstellationEvidence();
  if (snapshot) measured.restore(snapshot);
  return measured;
}

function nextProbe(measured: ConstellationEvidence, rows: NativeRows, cursor: Point, inputs: readonly string[]): Step | null {
  const model = measured.model!;
  const untried = (input: string) => !measured.tried.has(JSON.stringify([input, cursor]));
  const unknown = inputs.find(input => !measured.motion.has(input) && input !== measured.selector && untried(input));
  if (measured.active === null) {
    if (unknown) return { action: command(unknown), cursor, mode: 'acquire', expected_after: null };
    const origin = measured.samples[0]!.focus;
    const offsets = measured.samples.map(sample => constellationMinus(sample.focus, origin));
    const candidates = [...measured.motion].flatMap(([input, vector]) => {
      const point = constellationPlus(cursor, vector), [x, y] = point;
      if (!inputs.includes(input) || !untried(input) || constellationOutside(new PointSet([point]), model).size
        || measured.bodies.some((body, i) => constellationBodyPixels(body, measured.poses[i]!).has(point))) return [];
      const independent = offsets.some(offset => vector[0] * offset[1] !== vector[1] * offset[0]);
      return [{ input, point, rank: 2 * Number(!independent) + Number(rows[y]![x] !== model.background) }];
    });
    candidates.sort((a, b) => a.rank - b.rank);
    const choice = candidates[0];
    return choice ? { action: command(choice.input), cursor, mode: 'acquire', expected_after: null,
      acquisition_focus_projection: choice.point } : null;
  }
  if (measured.motion.size < 4) {
    const vectors = [...measured.motion.values()];
    const input = unknown ?? [...measured.motion].find(([key, vector]) =>
      inputs.includes(key) && untried(key) && !vectors.some(other => samePoint(other, [-vector[0], -vector[1]])))?.[0];
    return input ? { action: command(input), cursor, mode: 'calibrate', expected_after: null } : null;
  }
  const input = measured.selector ?? inputs.find(key => !measured.motion.has(key));
  return input && inputs.includes(input) ? { action: command(input), cursor, mode: 'cycle', expected_after: null } : null;
}

export function createSicMarkerCoverage(): NativeFamily<Proposal> {
  let snapshot: NativeRecord | null = null;
  let count = 0;
  return {
    id: markerCoverageId,
    async propose(observation, rows, inputs, remaining) {
      const keys = inputs.filter(input => !Object.keys(input.data ?? {}).length && input.action_ref !== 'ACTION7').map(input => input.action_ref);
      if (remaining < 1 || keys.length < 3) return null;
      const prior = snapshot?.epoch === observation.level_epoch ? snapshot : null;
      const issued = prior ? count : 0;
      if (issued >= 64) return null;
      const measured = measurements(prior);
      if (!prior) {
        measured.epoch = observation.level_epoch;
        measured.firstObservation = observation.observation_ref;
        measured.model = measureConstellationLayout(observation, rows);
      }
      const model = measured.model;
      if (!model || measured.retired) return null;
      const retained = measured.active === null ? null : measured.poses[measured.active]!;
      const cursor = constellationFocus(rows, model) ?? (measured.complete && retained
        && constellationCursorAt(rows, model, retained, measured.bodies, measured.poses, measured.active) ? retained : null);
      if (!cursor) return null;
      if (!measured.samples.length) measured.samples.push({ focus: cursor, material: constellationMaterial(rows, model) });
      if (measured.active === null) {
        const learned = acquireConstellation(measured.samples, model);
        if (learned) {
          measured.active = measured.bodies.length;
          measured.bodies.push(learned);
          measured.poses.push(cursor);
        }
      }

      let step: Step | null = null;
      let destination: NativeBox | null = null;
      const active = measured.active;
      if (!measured.complete) step = nextProbe(measured, rows, cursor, keys);
      else if (active !== null && constellationAgreement(rows, model, measured.bodies, measured.poses, cursor, active)) {
        const quantum = [...measured.motion.values()].flat().reduce((result, value) => gcd(result, Math.abs(value)), 0);
        if (!quantum) return null;
        const options = await constellationMechanicalPoseOptions(observation, rows, measured.bodies, measured.poses, model, quantum);
        const goal = constellationJointGoal(measured.bodies, measured.poses, model, quantum, options);
        if (!goal || measured.poses.every((pose, i) => samePoint(pose, goal[i]!))) return null;
        const delta = constellationMinus(goal[active]!, measured.poses[active]!);
        destination = bounds(constellationBodyPixels(measured.bodies[active]!, goal[active]!));
        if (distance(delta) === 0) {
          if (measured.selector && keys.includes(measured.selector)) step = { action: command(measured.selector), cursor, mode: 'cycle',
            poses: measured.poses, expected_after: null };
        } else {
          const move = [...measured.motion].find(([key, vector]) => keys.includes(key) && distance(constellationMinus(delta, vector)) < distance(delta));
          if (move) {
            const next = [...measured.poses];
            next[active] = constellationPlus(cursor, move[1]);
            step = { action: command(move[0]), cursor, mode: 'move', poses: measured.poses, expected_after: next,
              unobserved_support_pixels: constellationOutside(constellationBodyPixels(measured.bodies[active]!, next[active]!), model).size };
          }
        }
      }
      if (!step) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...new Set([...measured.refs.values()].filter(value => value !== ref))];
      const { selected, entries } = resolveStrategyGraph({
        graph, mode: 'active',
        facts: {
          acquire: { value: step.mode === 'acquire', evidence }, calibrate: { value: step.mode === 'calibrate', evidence },
          cycle: { value: step.mode === 'cycle', evidence }, move: { value: step.mode === 'move', evidence },
        },
        planners: { measure_support_motion: () => step, measure_remaining_directions: () => step,
          change_controlled_support: () => step, cover_compatible_markers: () => step },
      });
      if (!selected) return null;
      const strategy = selected.id, label = markerCoverageStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'place_independently_controlled_supports', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['selected_piece', 'other_pieces', 'compatible_markers'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_observed_marker_coverage' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'marker-coverage:' + need.id, actions = [step.action];
      return { status: 'proposed', kind: markerCoverageId, actions, steps: [step], measured: measured.state(), count: issued, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
        sicSituationCard: { strategy, need: 'Bring movable pieces onto compatible markers when their controls are known',
          mode: step.mode === 'move' ? 'solving' : measured.complete ? 'assimilation' : 'exploration',
          situation: measured.complete ? label : label + '. Some pixels may belong to overlapping pieces.',
          agenda: entries, evidence, actor: active === null ? bounds([cursor]) : bounds(constellationBodyPixels(measured.bodies[active]!, cursor)),
          otherSupports: measured.bodies.flatMap((body, i) => i === active ? [] : [bounds(constellationBodyPixels(body, measured.poses[i]!))]),
          targets: destination ? [destination] : [...model.targets.values()].map(bounds) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const result = measurements(proposal.measured).before(proposal, index, packet, observation);
      return { admitted: result.admitted, reason: result.reason };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = measurements(proposal.measured).after(proposal, index, before, after, first, second);
      return { matched: result.matched, seal_prefix: true, reason: result.reason };
    },
    async record(before, after, command, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const measured = measurements(proposal.measured);
      await measured.record(before, after, command, first, second, proposal, index);
      measured.events = [];
      snapshot = measured.state();
      count = proposal.count + 1;
      return { events: [] };
    },
    state: () => ({ snapshot, count }),
    restore(value) {
      snapshot = structuredClone(value.snapshot as NativeRecord | null ?? null);
      count = typeof value.count === 'number' ? value.count : 0;
    },
  };
}
