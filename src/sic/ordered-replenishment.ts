import { measureOrderedRecruitment } from '../logos-engine/v6-ordered-recruitment-geometry.ts';
import { orderedRecruitmentAlternativesCooperative, orderedRecruitmentSummary } from '../logos-engine/v6-ordered-recruitment-projection.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const orderedReplenishmentId = 'sic_ordered_replenishment';
export const orderedReplenishmentStrategies = {
  test_ordered_encounter: 'Test the visible encounter and compare the surviving order',
  recruit_for_next_encounter: 'Choose reinforcement that can survive the visible encounters',
  resolve_final_ordered_encounter: 'Test the projected final encounter',
} as const;
const graph = compileStrategyGraph({ id: 'preserve_a_viable_ordered_team', version: 1, order: 'FALLBACK',
  priorities: ['resolve_final_ordered_encounter', 'recruit_for_next_encounter', 'test_ordered_encounter'],
  strategies: {
    test_ordered_encounter: [{ fact: 'intermediate', expected: true, label: 'A complete conditional route starts with an encounter followed by another visible stage' }],
    recruit_for_next_encounter: [{ fact: 'recruit', expected: true, label: 'The visible quota permits a reinforcement and all best continuations choose the same type' }],
    resolve_final_ordered_encounter: [{ fact: 'final', expected: true, label: 'The prior stages were observed and the projected encounter is the last one' }],
  },
}, ['intermediate', 'recruit', 'final']);

// The legend and order suggest a model to test. A projected result is checked after every single action.
const hypotheses = {
  queue_order_hypothesis: 'front_spiral_inward', append_hypothesis: 'tail', winner_hypothesis: 'KEEP', tie_hypothesis: 'REMOVE_BOTH',
  search_bound: 4096, quota_bound: 8, engage_prior: 'ACTION5', point_action: 'ACTION6',
  hypotheses: ['paired_legend_colors_may_be_camp_equivalent_types', 'calibrated_legend_direction_may_extend_to_other_rows',
    'front_anchored_spiral_order_not_private_path', 'equal_types_may_remove_both_alternatives_retained',
    'button_may_append_one_occurrence_and_exhaust_quota', 'engagement_may_reduce_heads_to_closure',
    'all_visible_rooms_contribute_to_terminal_survival'],
};
type Encounter = { room: number; phase: string; quota: number | null; queue: number[]; enemy: number[] };
type Step = { action: { action_ref: string; data?: { x: number; y: number } }; kind: 'assign' | 'engage';
  projected_context: Encounter | null };
type Plan = { steps: Step[]; cost: number; survivors: number };
type State = { epoch: number; order: NativeBox[] | null; count: number; stopped: boolean; evidence: string[] };
type Proposal = NativeProposal & { order: NativeBox[]; prediction: Encounter | null; needId: string; local: State };
const empty = (epoch = 0): State => ({ epoch, order: null, count: 0, stopped: false, evidence: [] });
const matches = (a: Encounter, b: Encounter | null) => b !== null && a.room === b.room && a.phase === b.phase
  && a.quota === b.quota && JSON.stringify(a.queue) === JSON.stringify(b.queue) && JSON.stringify(a.enemy) === JSON.stringify(b.enemy);

export function createSicOrderedReplenishment(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: orderedReplenishmentId,
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || !inputs.some(command => command.action_ref === 'ACTION5')) return null;
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      if (local.stopped || local.count >= 32) return null;
      const scene = measureOrderedRecruitment(rows, local.order);
      if (!scene) return null;
      const [candidates, result] = await orderedRecruitmentAlternativesCooperative(scene, hypotheses, observation,
        Math.min(remaining, 32 - local.count), execution);
      if (result.truncated || !candidates.length) return null;
      const plans = (candidates as Plan[]).filter(plan => plan.steps.length)
        .sort((a, b) => a.cost - b.cost || b.survivors - a.survivors);
      const best = plans[0];
      if (!best) return null;
      const offers = plans.filter(plan => plan.cost === best.cost && plan.survivors === best.survivors);
      const move = best.steps[0]!;
      if (offers.some(plan => JSON.stringify(plan.steps[0]) !== JSON.stringify(move))) return null;
      const command: NativeCommand = { action_ref: move.action.action_ref, data: move.action.data ?? {} };
      const point: NativePoint | null = move.action.data ? [move.action.data.x, move.action.data.y] : null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(item => item !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        intermediate: { value: move.kind === 'engage' && move.projected_context !== null, evidence },
        recruit: { value: move.kind === 'assign', evidence },
        final: { value: move.kind === 'engage' && move.projected_context === null, evidence },
      }, planners: { test_ordered_encounter: () => command, recruit_for_next_encounter: () => command,
        resolve_final_ordered_encounter: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = orderedReplenishmentStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'preserve_queue_through_visible_encounters', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['connected_encounter_rooms'], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_final_encounter' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `ordered-replenishment:${need.id}`, actions = [selected.plan];
      const binding = point ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence }) : null;
      return { status: 'proposed', kind: orderedReplenishmentId, actions, order: scene.order, prediction: move.projected_context, needId: need.id, local,
        steps: [{ action: command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Keep an ordered team able to pass the visible encounters', mode: local.count ? 'solving' : 'exploration',
          situation: label, agenda: entries, evidence, encounter: scene.order[scene.current], nextEncounter: scene.order[scene.current + 1] ?? null,
          control: binding?.bbox ?? null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'ordered_encounter_bound' : 'ordered_encounter_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const scene = measureOrderedRecruitment(second, proposal.order);
      const matched = !!scene && matches(orderedRecruitmentSummary(scene) as Encounter, proposal.prediction);
      return { matched, seal_prefix: true, reason: matched ? 'ordered_encounter_confirmed' : 'ordered_encounter_contradicted' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const scene = measureOrderedRecruitment(second, proposal.order), local = proposal.local;
      state = { ...local, order: proposal.order, count: local.count + 1,
        stopped: !scene || !matches(orderedRecruitmentSummary(scene) as Encounter, proposal.prediction),
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}
