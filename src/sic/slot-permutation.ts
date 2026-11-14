import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { fitOrbit, measureOrbitField, orbitCycles, orbitRoute, orbitValues, type OrbitField } from '../logos-engine/v6-orbit-constraints.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const slotPermutationId = 'sic_slot_permutation';
export const slotPermutationStrategies = {
  test_slot_permutation: 'Test how a visible control rearranges the slots',
  apply_slot_permutation: 'Apply a measured rearrangement toward the marked target',
  distinguish_slot_permutations: 'Retest on a different arrangement to distinguish possible effects',
} as const;
const graph = compileStrategyGraph({ id: 'match_marked_slots_by_permuting_contents', version: 1, order: 'FALLBACK',
  priorities: ['apply_slot_permutation', 'test_slot_permutation', 'distinguish_slot_permutations'],
  strategies: {
    test_slot_permutation: [{ fact: 'unmeasuredControl', expected: true, label: 'A repeated control shape has an unmeasured effect on the slots' }],
    apply_slot_permutation: [{ fact: 'knownRoute', expected: true, label: 'A composition of uniquely measured permutations reaches the marked target' }],
    distinguish_slot_permutations: [{ fact: 'canDisambiguate', expected: true, label: 'The current arrangement distinguishes remaining interpretations of the same control' }],
  },
}, ['unmeasuredControl', 'knownRoute', 'canDisambiguate']);

type Model = { key: NativePoint; permutations: number[][]; evidence: string; tried: string[] };
type State = { layout: string; models: Record<string, Model>; count: number };
type Board = { values: number[]; positions: NativePoint[]; size: number };
type Proposal = NativeProposal & { local: State; control: NativePoint; board: Board; prediction: number[] | null; needId: string };
const key = (value: unknown) => JSON.stringify(value);
const sortedControls = (scene: OrbitField) => [...scene.controls.values()].sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1]);
const predict = (permutation: readonly number[], values: readonly number[]) => permutation.map(i => values[i]!);

function visibleControlInputs(observation: NativeObservation): NativeCommand[] {
  return observation.entities.flatMap(entity => {
    if (entity.rectangular || entity.mask.length === 0 || entity.area < 4) return [];
    const [left, top, right, bottom] = entity.bbox;
    const distance = ([x, y]: NativePoint) => Math.abs(2 * x + left - right) + Math.abs(2 * y + top - bottom);
    const [x, y] = entity.mask.reduce((best, point) => distance(point) < distance(best) ? point : best);
    return [{ action_ref: 'ACTION6', data: { x: x + left, y: y + top } }];
  });
}

export function createSicSlotPermutation(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: slotPermutationId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureOrbitField(observation, visibleControlInputs(observation));
      if (!scene || scene.positions.length > 32 || scene.controls.size > 8 || scene.targets.size > 3) return null;
      const { positions, size, targets } = scene, controls = sortedControls(scene);
      const layout = key([observation.level_epoch, positions, size, [...targets], controls.map(control => control.key)]);
      const local = state?.layout === layout ? state : { layout, models: {}, count: 0 };
      if (local.count >= 32) return null;
      const values = orbitValues(rows, positions, size);
      if (!values.length || [...targets].every(([i, color]) => values[i] === color)) return null;
      const operators = new Map(Object.entries(local.models).flatMap(([ref, model]) =>
        model.permutations.length === 1 ? [[ref, { key: model.key, permutation: model.permutations[0]! }] as const] : []));
      const path = orbitRoute(values, targets, operators, Math.min(remaining, 32 - local.count));
      const next = path?.length ? scene.controls.get(key(path[0])) : null;
      const unmeasured = controls.find(control => !local.models[key(control.key)]);
      const arrangement = key(values);
      const ambiguous = controls.find(control => {
        const model = local.models[key(control.key)];
        return model && model.permutations.length > 1 && !model.tried.includes(arrangement)
          && new Set(model.permutations.map(permutation => key(predict(permutation, values)))).size > 1;
      });
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set(Object.values(local.models).map(model => model.evidence))];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        unmeasuredControl: { value: !!unmeasured, evidence }, knownRoute: { value: !!next, evidence },
        canDisambiguate: { value: !!ambiguous, evidence },
      }, planners: { test_slot_permutation: () => unmeasured ?? null, apply_slot_permutation: () => next ?? null,
        distinguish_slot_permutations: () => ambiguous ?? null } });
      if (!selected) return null;
      const strategy = selected.id, control = selected.plan, label = slotPermutationStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'match_visible_marked_slots', scope: ref.split(':revision:', 1)[0]!, subjects: ['marked_slot_field'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_matching_marked_slots' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `slot-permutation:${need.id}`;
      const [x, y] = control.key, command = { action_ref: 'ACTION6', data: { x, y } }, actions = [command];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, control.key, { reason: label, evidence });
      const operator = operators.get(key(control.key));
      return { status: 'proposed', kind: slotPermutationId, actions, local, control: control.key,
        board: { values, positions, size }, prediction: operator ? predict(operator.permutation, values) : null, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: pointBinding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the marked slots to their displayed target colors', mode: next ? 'solving' : 'exploration',
          situation: next ? `The measured rearrangements give a route in ${path!.length} moves.` : label,
          agenda: entries, evidence, control: control.box, distance: path?.length ?? null,
          targets: [...targets.keys()].map(i => {
            const [x, y] = positions[i]!;
            return [x, y, x + size - 1, y + size - 1];
          }) },
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
      const possible = actual.length ? fitOrbit(values, actual, orbitCycles(positions)) : [];
      const permutations = prior ? possible.filter(option => prior.permutations.some(previous => key(previous) === key(option))) : possible;
      const model = { key: control, permutations, evidence: after.observation_ref, tried: [...(prior?.tried ?? []), key(values)] };
      state = { ...local, models: { ...local.models, [key(control)]: model }, count: local.count + 1 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
