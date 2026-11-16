import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { fitOrbit, measureOrbitField, orbitCycles, orbitRoute, orbitValues, type OrbitField } from '../logos-engine/v6-orbit-constraints.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';

export const slotPermutationId = 'sic_slot_permutation';
export const verifySlotPermutationId = 'sic_verify_slot_permutation';
export const slotPermutationStrategies = {
  test_slot_permutation: 'Test how a visible control rearranges the slots',
  apply_slot_permutation: 'Apply a measured rearrangement toward the marked target',
  distinguish_slot_permutations: 'Retest on a different arrangement to distinguish possible effects',
} as const;

type Model = { key: NativePoint; permutations: number[][]; evidence: string; tried: string[] };
type State = { layout: string; models: Record<string, Model>; count: number };
type Board = { values: number[]; positions: NativePoint[]; size: number };
type Track = { across: 0 | 1; lanes: number[]; indices: number[]; alternating: number[] };
type Geometry = { layout: string; tracks: Track[]; rings?: number[][] };
type Proposal = NativeProposal & { local: State; control: NativePoint; board: Board; prediction: number[] | null; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const sortedControls = (scene: OrbitField) => [...scene.controls.values()].sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
const predict = (permutation: readonly number[], values: readonly number[]) => permutation.map(i => values[i]!);
const maxProjectedStates = 32 ** 3;

function visibleControlInputs(observation: NativeObservation): NativeCommand[] {
  return observation.entities.flatMap(entity => {
    if (entity.rectangular || entity.mask.length === 0 || entity.area < 4) return [];
    const [left, top, right, bottom] = entity.bbox;
    const distance = ([x, y]: NativePoint) => Math.abs(2 * x + left - right) + Math.abs(2 * y + top - bottom);
    const [x, y] = entity.mask.reduce((best, point) => distance(point) < distance(best) ? point : best);
    return [{ action_ref: 'ACTION6', data: { x: x + left, y: y + top } }];
  });
}

function distributedTracks(positions: readonly NativePoint[]): Track[] {
  const tracks: Track[] = [];
  for (const across of [0, 1] as const) {
    const along = across === 0 ? 1 : 0;
    const lines = new Map<number, number[]>();
    for (const [index, position] of positions.entries()) {
      const lane = lines.get(position[across]) ?? [];
      lane.push(index);
      lines.set(position[across], lane);
    }
    const profiles = new Map<string, { lanes: number[]; segments: number[][] }>();
    for (const [lane, indices] of [...lines].sort(([a], [b]) => a - b)) {
      indices.sort((a, b) => positions[a]![along] - positions[b]![along]);
      const coordinates = indices.map(i => positions[i]![along]);
      if (coordinates.length < 4) continue;
      const gaps = coordinates.slice(1).map((value, i) => value - coordinates[i]!);
      const pitch = Math.min(...gaps);
      const boundaries = [0, ...gaps.flatMap((gap, i) => gap > pitch ? [i + 1] : []), indices.length];
      if (boundaries.length < 3 || boundaries.slice(1).some((end, i) => end - boundaries[i]! < 2)) continue;
      const profile = profiles.get(key(coordinates)) ?? { lanes: [], segments: [] };
      profile.lanes.push(lane);
      profile.segments.push(indices);
      profiles.set(key(coordinates), profile);
    }
    for (const { lanes, segments } of profiles.values()) {
      if (lanes.length < 2) continue;
      tracks.push({ across, lanes, indices: segments.flat(),
        alternating: segments.flatMap((line, i) => i % 2 === 0 ? line : [...line].reverse()) });
    }
  }
  return tracks;
}

function prioritizeTrials(tracks: readonly Track[], size: number, controls: ReturnType<typeof sortedControls>, models: State['models']) {
  const unmeasured = controls.filter(control => !models[key(control.key)]);
  if (!tracks.length) return unmeasured[0];
  const axis = (point: NativePoint) => {
    const alignments = new Set(tracks.filter(track => track.lanes.some(lane =>
      lane <= point[track.across] && point[track.across] < lane + size)).map(track => track.across));
    return alignments.size === 1 ? [...alignments][0]! : null;
  };
  const covered = Object.values(models).map(model => axis(model.key));
  const novel = unmeasured.find(control => { const aligned = axis(control.key); return aligned !== null && !covered.includes(aligned); });
  return novel ?? unmeasured[0];
}

export function createSicVerifySlotPermutation(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  let geometry: Geometry | null = null;
  return {
    id: verifySlotPermutationId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureOrbitField(observation, visibleControlInputs(observation));
      if (!scene || scene.positions.length > 64 || scene.targets.size > 3) return null;
      if (scene.positions.length ** scene.targets.size > maxProjectedStates) return null;
      const { positions, size, targets } = scene, controls = sortedControls(scene);
      const layout = key([observation.level_epoch, positions, size, [...targets], controls.map(control => control.key)]);
      if (geometry?.layout !== layout) geometry = { layout, tracks: distributedTracks(positions) };
      const { tracks } = geometry;
      if (controls.length > (tracks.length ? 32 : 8)) return null;
      const local = state?.layout === layout ? state : { layout, models: {}, count: 0 };
      if (local.count >= 32) return null;
      const values = orbitValues(rows, positions, size);
      if (!values.length || [...targets].every(([i, color]) => values[i] === color)) return null;
      const operators = new Map(Object.entries(local.models).flatMap(([ref, model]) =>
        model.permutations.length === 1 ? [[ref, { key: model.key, permutation: model.permutations[0]! }] as const] : []));
      const path = orbitRoute(values, targets, operators, Math.min(remaining, 32 - local.count));
      const next = path?.length ? scene.controls.get(key(path[0])) : null;
      const unmeasured = prioritizeTrials(tracks, size, controls, local.models);
      const arrangement = key(values);
      const ambiguous = controls.find(control => {
        const model = local.models[key(control.key)];
        return model && model.permutations.length > 1 && !model.tried.includes(arrangement)
          && new Set(model.permutations.map(permutation => key(predict(permutation, values)))).size > 1;
      });
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set(Object.values(local.models).map(model => model.evidence))];
      const trial = unmeasured ?? ambiguous;
      const mode = execution?.reasoningMode ?? (next ? 'solving' : 'exploration');
      const facts = { routeSupported: !!next, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const control = strategy === 'P07' ? next : trial;
      if (!control) return null;
      const phase = strategy === 'P07' ? 'apply_slot_permutation' : unmeasured ? 'test_slot_permutation' : 'distinguish_slot_permutations';
      const label = slotPermutationStrategies[phase], parent = 'G_official_completion';
      const goal = { kind: 'match_visible_marked_slots', scope: ref.split(':revision:', 1)[0]!, subjects: ['marked_slot_field'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_marked_slots' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `slot-permutation:${need.id}`;
      const [x, y] = control.key, command = { action_ref: 'ACTION6', data: { x, y } }, actions = [command];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, control.key, { reason: label, evidence });
      const operator = operators.get(key(control.key));
      const moving = operator?.permutation.flatMap((from, to) => from === to ? [] : [to]) ?? [];
      const distributed = tracks.find(track => track.indices.length === moving.length && track.indices.every(i => moving.includes(i)));
      const slot = (i: number) => { const [x, y] = positions[i]!; return [x, y, x + size - 1, y + size - 1]; };
      const targetColors = new Set(targets.values());
      const motion = distributed && operator ? moving.flatMap(to => {
        const from = operator.permutation[to]!;
        return values[from] !== values[to] && targetColors.has(values[from]!) ? [{ source: slot(from), destination: slot(to) }] : [];
      }).slice(0, 3) : [];
      const situation = distributed && next ? `This control rearranges ${moving.length} slots across ${distributed.lanes.length} lines. ${path!.length} moves remain.`
        : strategy === 'P07' ? `The measured rearrangements give a route in ${path!.length} moves.` : label;
      return { status: 'proposed', kind: verifySlotPermutationId, actions, local, control: control.key,
        board: { values, positions, size }, prediction: operator ? predict(operator.permutation, values) : null, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: pointBinding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Bring the marked slots to their displayed target colors', mode,
          situation,
          agenda: [], evidence, triggerCard: decision.receipt.workflow, control: control.box, distance: strategy === 'P07' ? path!.length : null,
          targets: [...targets.keys()].map(slot), ...(motion.length ? { motion } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'slot_permutation_bound' : 'slot_permutation_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actual = orbitValues(second, proposal.board.positions, proposal.board.size);
      const matched = proposal.prediction ? key(actual) === key(proposal.prediction) : null;
      return { matched, seal_prefix: true, reason: matched === false ? 'slot_permutation_contradicted'
        : matched ? 'slot_permutation_confirmed' : 'observe_slot_rearrangement' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, control, board: { values, positions, size } } = proposal;
      const actual = orbitValues(second, positions, size);
      const prior = local.models[key(control)];
      let permutations: number[][] = [];
      if (proposal.prediction && key(proposal.prediction) === key(actual) && key(values) !== key(actual)) {
        permutations = prior?.permutations ?? [];
      } else if (actual.length) {
        if (geometry?.layout !== local.layout) geometry = { layout: local.layout, tracks: distributedTracks(positions) };
        geometry.rings ??= [...orbitCycles(positions), ...geometry.tracks.flatMap(track => [track.indices, track.alternating])];
        const possible = fitOrbit(values, actual, geometry.rings);
        permutations = prior ? possible.filter(option => prior.permutations.some(previous => key(previous) === key(option))) : possible;
      }
      const model = { key: control, permutations, evidence: after.observation_ref, tried: [...(prior?.tried ?? []), key(values)] };
      state = { ...local, models: { ...local.models, [key(control)]: model }, count: local.count + 1 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
