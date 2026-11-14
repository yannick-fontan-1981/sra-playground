import { measureSubsetScene, subsetFeedback } from '../logos-engine/v6-subset-diagnosis.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { sicNeedId } from './need-identity.ts';

export const subsetExperimentId = 'sic_subset_experiment';
const objective = 'G_official_completion';
const labels = {
  separate_candidates: 'Test a group that separates the remaining explanations',
  learn_group_control: 'Learn what a control linked to a visible group does',
  access_smaller_group: 'Check a control that could expose a smaller group',
  confirm_candidate: 'Test an individual candidate with a visible address',
};
type Strategy = keyof typeof labels;
const order: Strategy[] = ['separate_candidates', 'learn_group_control', 'access_smaller_group', 'confirm_candidate'];
const graph = compileStrategyGraph<Strategy, Strategy>({
  id: 'locate_influential_member', version: 1, order: 'FALLBACK', priorities: order,
  strategies: Object.fromEntries(order.map(id => [id, [{ fact: id, expected: true, label: labels[id] }]])) as
    Record<Strategy, [{ fact: Strategy; expected: true; label: string }]>,
}, order);
type Scene = { boxes: NativeBox[]; focus: number[]; universe_ref: string; scope_members: Record<string, number[]>;
  controls: { color: string; bbox: NativeBox; shape: readonly [number, number, unknown]; area: number }[] };
type Choice = { point: NativePoint; shape?: string; group: number[] };
type State = { epoch: number; universe: string; possible: number[]; tried: string[]; press: Record<string, string>; navigation: Record<string, string> };
type SubsetProposal = NativeProposal & { choice: Choice; domain: State; key: string };
const empty: State = { epoch: 0, universe: '', possible: [], tried: [], press: {}, navigation: {} };
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const attempt = (focus: readonly number[], point: NativePoint) => JSON.stringify([focus, point]);

export function createSicSubsetExperiment(): NativeFamily<SubsetProposal> {
  let memory = structuredClone(empty);
  function domain(observation: NativeObservation, scene: Scene): State {
    if (memory.epoch === observation.level_epoch && memory.universe === scene.universe_ref) return memory;
    return { ...memory, epoch: observation.level_epoch, universe: scene.universe_ref,
      possible: scene.boxes.map((_, i) => i), tried: [] };
  }
  return {
    id: subsetExperimentId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const scene = measureSubsetScene(rows) as Scene | null;
      if (!scene) return null;
      const current = domain(observation, scene);
      const ref = observation.observation_ref;
      const candidates = scene.controls.flatMap(control => {
        const point = center(control.bbox), shape = JSON.stringify(control.shape), group = scene.scope_members[control.color] ?? [];
        const overlap = current.possible.filter(member => group.includes(member)).length;
        return overlap && !current.tried.includes(attempt(scene.focus, point))
          ? [{ point, shape, group, overlap, density: control.area / control.shape[0] }] : [];
      });
      const distinct = candidates.filter(offer => offer.overlap < current.possible.length);
      const imbalance = (overlap: number) => Math.max(overlap, current.possible.length - overlap);
      const split = distinct.filter(offer => Object.hasOwn(current.press, offer.shape))
        .sort((a, b) => imbalance(a.overlap) - imbalance(b.overlap))[0];
      const trial = !Object.keys(current.press).length ? distinct.filter(offer => !Object.hasOwn(current.navigation, offer.shape))
        .sort((a, b) => b.density - a.density)[0] : undefined;
      const access = current.possible.length > 2 ? candidates.find(offer => !Object.hasOwn(current.press, offer.shape)) : undefined;
      const single = current.possible.map(member => ({ point: center(scene.boxes[member]!), group: [member] }))
        .find(offer => !current.tried.includes(attempt(scene.focus, offer.point)));
      const offers: Record<Strategy, Choice | undefined> = {
        separate_candidates: split, learn_group_control: trial, access_smaller_group: access, confirm_candidate: single,
      };
      const facts = Object.fromEntries(order.map(id => [id, { value: !!offers[id], evidence: [ref] as const }]));
      const planners = Object.fromEntries(order.map(id => [id, () => offers[id] ?? null])) as Record<Strategy, () => Choice | null>;
      const { selected } = resolveStrategyGraph({ graph, mode: 'active', facts, planners });
      if (!selected) return null;
      const { id: strategy, plan: choice } = selected, [x, y] = choice.point;
      const label = labels[strategy], command = { action_ref: 'ACTION6', data: { x, y } };
      const prior = choice.shape && (current.press[choice.shape] ?? current.navigation[choice.shape]);
      const proof = prior ? [ref, prior] : [ref];
      const goal = { kind: 'identify_influential_member', scope: ref.split(':revision:', 1)[0]!, subjects: [scene.universe_ref],
        parentObjective: objective, satisfactionContract: 'observe_official_progress_after_testing_a_member' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `subset:${need.id}`;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: label, evidence: proof });
      return { status: 'proposed', kind: subsetExperimentId, choice, domain: current, key: attempt(scene.focus, choice.point),
        actions: [command], steps: [{ action: command, point_binding: witness, expected_after: null }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions: [command], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_scope_target_bound' : 'scope_target_changed' };
    },
    after(_proposal, _index, before, after) {
      return { matched: null, seal_prefix: true, reason: after.level_epoch !== before.level_epoch ? 'official_boundary' : 'acquire_transient_scope_feedback' };
    },
    record(before, after, _command, rows, returned, proposal, _index, frames) {
      memory = structuredClone(proposal.domain);
      memory.tried.push(proposal.key);
      const scene = measureSubsetScene(rows);
      if (!scene) return { events: [] };
      const feedback = subsetFeedback(rows, frames.length ? frames : [returned], scene);
      const { shape } = proposal.choice;
      if (feedback?.status === 'sealed_scope_feedback') {
        if (shape) memory.press[shape] = after.observation_ref;
        const observed = new Set<number>(feedback.tested);
        const remaining = memory.possible.filter(member => observed.has(member) === (feedback.label === 'GLOBAL'));
        if (remaining.length) memory.possible = remaining;
        return { events: [{ kind: 'sic_observed_scope_feedback', result: feedback.label, tested: observed.size,
          candidates: memory.possible.length, modelRefuted: !remaining.length, observation: after.observation_ref }] };
      }
      const next = measureSubsetScene(returned);
      if (shape && next && next.universe_ref === scene.universe_ref && JSON.stringify(next.focus) !== JSON.stringify(scene.focus)) {
        memory.navigation[shape] = after.observation_ref;
      }
      return { events: [] };
    },
    state: () => ({ ...memory }),
    restore(state: NativeRecord) { memory = structuredClone(state as State); },
  };
}
