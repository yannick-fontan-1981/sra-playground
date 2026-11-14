import { chooseFeedbackTrialCooperative, type FeedbackConfiguration } from '../logos-engine/v6-feedback-sequences-finite.ts';
import { feedbackBorder, feedbackMatches, feedbackPalette, feedbackValues, initialFeedbackLayout,
  type FeedbackHistoryRow, type FeedbackLayout, type FeedbackSlotRow } from '../logos-engine/v6-feedback-sequences-visual.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const feedbackTrialId = 'sic_feedback_trial';
export const feedbackTrialStrategies = {
  test_ordered_entry: 'Test what the distinctive palette tile enters',
  refine_ordered_trial: 'Choose a trial that separates the remaining answers',
  submit_ordered_trial: 'Submit the complete trial to obtain positional feedback',
} as const;
const graph = compileStrategyGraph({ id: 'learn_ordered_answer_from_feedback', version: 1, order: 'FALLBACK',
  priorities: ['submit_ordered_trial', 'refine_ordered_trial', 'test_ordered_entry'],
  strategies: {
    test_ordered_entry: [{ fact: 'entry', expected: true, label: 'A single palette tile has a distinct border and the input row is unconfirmed' }],
    refine_ordered_trial: [{ fact: 'fill', expected: true, label: 'A bounded comparison found a trial compatible with the current prefix' }],
    submit_ordered_trial: [{ fact: 'submit', expected: true, label: 'The input row is complete and a submission control can be tested' }],
  },
}, ['entry', 'fill', 'submit']);
const configuration: FeedbackConfiguration = { stages: [], allocation_orders: ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT'],
  measures: ['WORST_NONWINNING_RESIDUAL', 'SUM_SQUARED_RESIDUALS', 'NONWINNING_BRANCHES'],
  maximum_candidates: 4096, maximum_trials: 256, maximum_evaluations: 65536, maximum_bundle: 1,
  question: 'Separate the possible ordered answers' };
type State = { layout: FeedbackLayout; active: FeedbackSlotRow | null; repeatable: boolean | null; submission: string | null;
  history: FeedbackHistoryRow[]; blocked: string[]; evidence: string[]; stopped: boolean };
type Choice = { action: NativeCommand; value: number | null; prefix: number[]; candidates: number | null; trial: number[] | null };
type Proposal = NativeProposal & { local: State; choice: Choice; palette: [number, number][]; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function activePrefix(rows: NativeRows, layout: FeedbackLayout, active: FeedbackSlotRow) {
  const values = feedbackValues(rows, layout, active.y, layout.count);
  if (!values) return null;
  const selected = values.filter(value => value !== active.empty);
  return selected.every(value => layout.alphabet.includes(value)) &&
    equal(values, [...selected, ...Array(values.length - selected.length).fill(active.empty)]) ? selected : null;
}

export function createSicFeedbackTrial(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: feedbackTrialId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.layout.epoch === observation.level_epoch ? state : null;
      const layout = prior?.layout ?? initialFeedbackLayout(observation);
      if (!layout || prior?.stopped || (prior?.history.length ?? 0) >= 12) return null;
      const palette = feedbackPalette(observation, layout);
      if (!palette) return null;
      const local: State = prior ?? { layout, active: null, repeatable: null, submission: null, history: [], blocked: [], evidence: [], stopped: false };
      const prefix = local.active ? activePrefix(rows, layout, local.active) : [];
      if (!prefix) return null;
      const [w, h] = layout.size;
      const entry = (value: number, candidates: number | null, trial: number[] | null): Choice | null => {
        const tile = palette.find(([, color]) => color === value);
        if (!tile) return null;
        return { action: { action_ref: 'ACTION6', data: { x: tile[0] + Math.floor(w / 2), y: layout.palette_y + Math.floor(h / 2) } },
          value, prefix, candidates, trial };
      };
      let choice: Choice | null = null;
      if (!local.active) {
        const styles = palette.map(([x]) => feedbackBorder(rows, x, layout.palette_y, w, h));
        const distinct = styles.flatMap((style, i) => styles.filter(other => equal(style, other)).length === 1 ? [i] : []);
        if (distinct.length === 1) choice = entry(palette[distinct[0]!]![1], null, null);
      } else if (prefix.length === layout.count) {
        const plain = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action));
        const submit = local.submission && plain.includes(local.submission) ? local.submission : plain.length === 1 ? plain[0] : null;
        if (submit) choice = { action: { action_ref: submit, data: {} }, value: null, prefix, candidates: null, trial: prefix };
      } else {
        const other = layout.slot_rows.find(row => row.y !== local.active!.y)!;
        const raw = feedbackValues(rows, layout, other.y, layout.count);
        if (!raw) return null;
        const revealed = raw.map(color => color === other.empty ? null : color);
        const result = await chooseFeedbackTrialCooperative([layout.alphabet, layout.count, prefix, local.history, revealed, local.repeatable,
          observation, remaining, configuration], execution);
        if (result.status === 'proposed') {
          const trial = result.trial as number[];
          choice = entry(trial[prefix.length]!, Number(result.candidate_count), trial);
        }
      }
      if (!choice || local.blocked.includes(JSON.stringify([observation.frame_hash, choice.action]))) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        entry: { value: !local.active, evidence }, fill: { value: !!local.active && choice.value !== null, evidence },
        submit: { value: choice.value === null, evidence },
      }, planners: { test_ordered_entry: () => choice, refine_ordered_trial: () => choice, submit_ordered_trial: () => choice } });
      if (!selected) return null;
      const strategy = selected.id, label = feedbackTrialStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'infer_ordered_code_from_positions', scope: layout.ref, subjects: ['ordered_slots', 'positional_feedback'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_submitting_the_ordered_answer' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `feedback-trial:${need.id}`;
      const actions = [choice.action];
      const point: NativePoint | null = choice.value === null ? null : [choice.action.data.x!, choice.action.data.y!];
      const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const box = (y: number, count: number): NativeBox => [layout.xs[0]!, y, layout.xs[count - 1]! + w - 1, y + h - 1];
      return { status: 'proposed', kind: feedbackTrialId, actions, local, choice, palette, needId: need.id,
        steps: [{ action: choice.action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Infer the ordered answer from the positional marks', mode: 'exploration',
          situation: choice.candidates === null ? label : `${choice.candidates} answers remain compatible. The next tile preserves the current prefix.`,
          agenda: entries, evidence, palette: box(layout.palette_y, layout.xs.length), slots: layout.slot_rows.map(row => box(row.y, row.count)) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'ordered_trial_bound' : 'ordered_trial_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, choice } = proposal;
      const matched = choice.value !== null ? local.layout.slot_rows.filter(row => (!local.active || local.active.y === row.y) &&
        equal(activePrefix(second, local.layout, row), [...choice.prefix, choice.value])).length === 1 : null;
      return { matched, seal_prefix: true, reason: matched ? 'ordered_tile_appended' : 'measure_entry_or_feedback_return' };
    },
    async record(before, after, issued, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice, palette } = proposal, { layout } = local;
      const next = { ...local, evidence: [...local.evidence.slice(-5), after.observation_ref] };
      if (choice.value === null) {
        const matches = await feedbackMatches(second, after, layout, choice.prefix);
        const cleared = local.active && activePrefix(second, layout, local.active)?.length === 0;
        if (cleared && matches.length === 1) {
          next.history = [...local.history, { ...matches[0]!, ref: after.observation_ref, before: before.observation_ref }];
          next.submission = issued.action_ref;
        } else next.stopped = true;
      } else {
        const active = layout.slot_rows.filter(row => (!local.active || local.active.y === row.y) &&
          equal(activePrefix(second, layout, row), [...choice.prefix, choice.value]));
        const afterPalette = feedbackPalette(after, layout)?.map(([, color]) => color), beforePalette = palette.map(([, color]) => color);
        const mode = equal(afterPalette, beforePalette) ? true : equal(afterPalette, beforePalette.filter(color => color !== choice.value)) ? false : null;
        if (active.length === 1 && mode !== null && (local.repeatable === null || local.repeatable === mode)) {
          next.active = active[0]!;
          next.repeatable = mode;
        } else next.blocked = [...local.blocked, JSON.stringify([before.frame_hash, choice.action])];
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
