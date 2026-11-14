import { inferLabeledSequence } from '../logos-engine/v6-labeled-sequence-mechanics.ts';
import { measureLabeledSequence } from '../logos-engine/v6-labeled-sequence-observation.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const labeledSequenceId = 'sic_labeled_sequence';
export const labeledSequenceStrategies = {
  compare_labeled_examples: 'Compare the sequence with both groups of examples',
  reuse_labeled_examples: 'Classify the new sequence using the same visible examples',
} as const;
const graph = compileStrategyGraph({ id: 'classify_with_consistent_examples', version: 1, order: 'FALLBACK',
  priorities: ['reuse_labeled_examples', 'compare_labeled_examples'],
  strategies: {
    compare_labeled_examples: [{ fact: 'consensus', expected: true, label: 'All compatible rules agree on the same label and visible control' }],
    reuse_labeled_examples: [
      { fact: 'consensus', expected: true, label: 'All compatible rules agree on the same label and visible control' },
      { fact: 'reusedExamples', expected: true, label: 'The examples and controls remain the same as in the previous observation' },
    ],
  },
}, ['consensus', 'reusedExamples']);

type Bounds = { bbox: NativeBox };
type Button = Bounds & { label: number; point: NativePoint };
type TrainingCache = NativeRecord & { epoch: number; context_ref: string; controls: Button[] };
type State = { cache: TrainingCache; ref: string; attempted: string[] };
type Proposal = NativeProposal & { cache: TrainingCache; attempt: string; needId: string };

export function createSicLabeledSequence(config: NativeRecord, now: () => number): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: labeledSequenceId,
    async propose(observation, rows, _inputs, remaining) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.cache.epoch === observation.level_epoch ? state : null;
      const scene = measureLabeledSequence(rows, prior?.cache.controls ?? null);
      if (!scene) return null;
      const result = inferLabeledSequence(scene, observation, now() + 1000, config, prior?.cache ?? null, now);
      const induction = result?.induction;
      if (!result || induction?.status !== 'COMPLETE' || induction.domain_complete !== true) return null;
      const values = induction.values;
      const models = values.observation_compatible_version_space.length;
      const labels = new Set((values.label_predictions as { predicted_label_ref: string }[]).map(item => item.predicted_label_ref));
      if (!models || values.robust_answer_and_submission_agreement !== true || labels.size !== 1) return null;
      const controls = (scene.buttons as Button[]).filter(button => labels.has(String(button.label)));
      if (controls.length !== 1) return null;
      const control = controls[0]!, [x, y] = control.point;
      const attempt = `${observation.frame_hash}:${x},${y}`;
      if (prior?.attempted.includes(attempt)) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...(result.training_reused && prior ? [prior.ref] : [])];
      const command: NativeCommand = { action_ref: 'ACTION6', data: { x, y } };
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        consensus: { value: true, evidence }, reusedExamples: { value: result.training_reused, evidence },
      }, planners: { compare_labeled_examples: () => command, reuse_labeled_examples: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = labeledSequenceStrategies[strategy], parent = 'G_official_completion';
      const goal = { kind: 'classify_visible_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: [scene.context_ref],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_from_agreed_submissions' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `labeled-sequence:${need.id}`, actions = [selected.plan];
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, control.point, { reason: label, evidence });
      return { status: 'proposed', kind: labeledSequenceId, actions, attempt, cache: result.training_cache, needId: need.id,
        steps: [{ action: command, expected_after: null, point_binding: pointBinding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Choose a label supported by the visible examples', mode: result.training_reused ? 'assimilation' : 'solving',
          situation: `${models} compatible rules agree on this label. The result of the submission is still open.`,
          agenda: entries, evidence, examples: (scene.panels as Bounds[]).map(panel => panel.bbox),
          query: (scene.query as Bounds).bbox, addressedRegion: control.bbox },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_labeled_sequence_bound' : 'labeled_sequence_changed' };
    },
    after(proposal, _index, before, after) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const changed = before.frame_hash !== after.frame_hash;
      return { matched: changed ? null : false, seal_prefix: true, reason: changed ? 'observe_next_submission_context'
        : 'labeled_submission_left_observation_unchanged' };
    },
    record(before, after, _command, _first, _second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const prior = state?.cache.epoch === before.level_epoch ? state : null;
      state = { cache: proposal.cache, ref: prior && prior.cache.context_ref === proposal.cache.context_ref ? prior.ref : before.observation_ref,
        attempted: [...(prior?.attempted.slice(-63) ?? []), proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
