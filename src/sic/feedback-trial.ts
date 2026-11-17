import { chooseFeedbackTrialCooperative, type FeedbackConfiguration } from '../logos-engine/v6-feedback-sequences-finite.ts';
import { feedbackBorder, feedbackMatches, feedbackPalette, feedbackValues, initialFeedbackLayout,
  type FeedbackHistoryRow, type FeedbackLayout, type FeedbackSlotRow } from '../logos-engine/v6-feedback-sequences-visual.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseFromFeedback, feedbackChoiceFacts, feedbackChoiceModule } from './feedback-choice-card.ts';
import { sicNeedId } from './need-identity.ts';

export const feedbackTrialId = 'sic_feedback_trial';
export const verifyOrderedFeedbackId = 'sic_verify_ordered_feedback';
export const feedbackTrialStrategies = {
  test_ordered_entry: 'Test what the distinctive palette tile enters',
  refine_ordered_trial: 'Choose a trial that separates the remaining answers',
  submit_ordered_trial: 'Submit the complete trial to obtain positional feedback',
} as const;
const configuration: FeedbackConfiguration = { stages: [], allocation_orders: ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT'],
  measures: ['WORST_NONWINNING_RESIDUAL', 'SUM_SQUARED_RESIDUALS', 'NONWINNING_BRANCHES'],
  maximum_candidates: 4096, maximum_trials: 256, maximum_evaluations: 65536, maximum_bundle: 1,
  group_equivalent_trials: true, prune_dominated_trials: true, question: 'Separate the possible ordered answers' };
type TrialPlan = { values: number[]; candidates: number; revealed: (number | null)[] };
type State = { layout: FeedbackLayout; active: FeedbackSlotRow | null; repeatable: boolean | null; submission: string | null;
  history: FeedbackHistoryRow[]; blocked: string[]; evidence: string[]; stopped: boolean; plan?: TrialPlan };
type EntryEvidence = { completed: number; size: FeedbackLayout['size']; pitch: number; rowOffsets: number[];
  activeOffset: number; submit: string; proof: string[] };
type Choice = { action: NativeCommand; value: number | null; prefix: number[]; candidates: number | null; trial: number[] | null;
  evaluatedTrials?: number; plan?: TrialPlan };
type Proposal = NativeProposal & { local: State; choice: Choice; palette: [number, number][]; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function activePrefix(rows: NativeRows, layout: FeedbackLayout, active: FeedbackSlotRow) {
  const values = feedbackValues(rows, layout, active.y, layout.count);
  if (!values) return null;
  const selected = values.filter(value => value !== active.empty);
  return selected.every(value => layout.alphabet.includes(value)) &&
    equal(values, [...selected, ...Array(values.length - selected.length).fill(active.empty)]) ? selected : null;
}

export function createSicVerifyOrderedFeedback(): NativeFamily<Proposal> {
  let state: State | null = null;
  let retained: EntryEvidence | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyOrderedFeedbackId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseFromFeedback, {}, await feedbackChoiceModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.layout.epoch === observation.level_epoch ? state : null;
      const layout = prior?.layout ?? initialFeedbackLayout(observation);
      if (!layout || prior?.stopped || (prior?.history.length ?? 0) >= 12) return null;
      const palette = feedbackPalette(observation, layout);
      if (!palette) return null;
      const offsets = layout.slot_rows.map(row => row.y - layout.palette_y).sort((a, b) => a - b);
      const comparable = !prior && retained?.completed === observation.levels_completed && retained.pitch === layout.pitch
        && equal(retained.size, layout.size) && equal(retained.rowOffsets, offsets);
      const restoredRow = comparable ? layout.slot_rows.find(row => row.y - layout.palette_y === retained!.activeOffset) ?? null : null;
      const submission = restoredRow && retained && observation.available_action_refs.includes(retained.submit) ? retained.submit : null;
      const local: State = prior ?? { layout, active: restoredRow, repeatable: null, submission, history: [], blocked: [],
        evidence: restoredRow ? retained!.proof : [], stopped: false };
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
        // Use the measured palette order as stable input identities for tie-breaking.
        const indexOf = (color: number) => layout.alphabet.indexOf(color);
        const revealed = raw.map(color => color === other.empty ? null : indexOf(color));
        if (revealed.includes(-1)) return null;
        const plan = local.plan;
        if (local.repeatable && plan && equal(plan.revealed, revealed) && equal(plan.values.slice(0, prefix.length), prefix)
          && plan.values.length === layout.count && layout.count - prefix.length + 1 <= remaining
          && plan.values.slice(prefix.length).every(value => palette.some(([, color]) => color === value))) {
          choice = entry(plan.values[prefix.length]!, plan.candidates, plan.values);
          if (choice) choice.plan = plan;
        } else {
          const ordered = layout.alphabet.map((_, index) => index);
          const history = local.history.map(row => ({ ...row, values: row.values.map(indexOf) }));
          const result = await chooseFeedbackTrialCooperative([ordered, layout.count, prefix.map(indexOf), history,
            revealed, local.repeatable, observation, remaining, configuration], execution);
          if (result.status === 'proposed') {
            const trial = (result.trial as number[]).map(index => layout.alphabet[index]!);
            choice = entry(trial[prefix.length]!, Number(result.candidate_count), trial);
            if (choice) {
              choice.plan = { values: trial, candidates: Number(result.candidate_count), revealed };
              if (typeof result.evaluated_trial_count === 'number') choice.evaluatedTrials = result.evaluated_trial_count;
            }
          }
        }
      }
      if (!choice || local.blocked.includes(JSON.stringify([observation.frame_hash, choice.action]))) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const submitting = choice.value === null;
      const knownSubmission = submitting && local.submission === choice.action.action_ref;
      const singleAnswer = choice.candidates === 1;
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = feedbackChoiceFacts(mode, { pointedCueNeedsTest: !local.active, feedbackSupportsOneChoice: singleAnswer,
        trialCanClarifyAlternatives: !!local.active && !submitting && !singleAnswer,
        firstSubmissionNeedsFeedback: submitting && !knownSubmission, submissionControlObserved: knownSubmission });
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = singleAnswer || knownSubmission ? 'P02' : 'P05';
      if (decision?.result !== strategy) return null;
      const phase = submitting ? 'submit_ordered_trial' : local.active ? 'refine_ordered_trial' : 'test_ordered_entry';
      const label = feedbackTrialStrategies[phase], parent = 'G_official_completion';
      const objective = { kind: 'infer_ordered_code_from_positions', scope: layout.ref, subjects: ['ordered_slots', 'positional_feedback'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_submitting_the_ordered_answer' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `feedback-trial:${need.id}`;
      const actions = [choice.action];
      const point: NativePoint | null = choice.value === null ? null : [choice.action.data.x!, choice.action.data.y!];
      const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const box = (y: number, count: number): NativeBox => [layout.xs[0]!, y, layout.xs[count - 1]! + w - 1, y + h - 1];
      return { status: 'proposed', kind: verifyOrderedFeedbackId, actions, local, choice, palette, needId: need.id,
        steps: [{ action: choice.action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Infer the ordered answer from the positional marks', mode,
          situation: choice.candidates === null ? label : singleAnswer ? 'One answer remains compatible with the observed feedback.'
            : choice.evaluatedTrials === undefined ? `${choice.candidates} answers remain compatible. The next tile preserves the current prefix.`
              : `${choice.candidates} answers remain compatible. ${choice.evaluatedTrials} distinct trial patterns were compared.`,
          agenda: [], evidence, triggerCard: decision.receipt.workflow,
          palette: box(layout.palette_y, layout.xs.length), slots: layout.slot_rows.map(row => box(row.y, row.count)) },
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
      const matched = choice.value !== null ? local.layout.slot_rows.filter(row => (!local.active || local.repeatable === null || local.active.y === row.y) &&
        equal(activePrefix(second, local.layout, row), [...choice.prefix, choice.value])).length === 1 : null;
      return { matched, seal_prefix: true, reason: matched ? 'ordered_tile_appended' : 'measure_entry_or_feedback_return' };
    },
    async record(before, after, issued, _first, second, proposal) {
      const { local, choice, palette } = proposal, { layout } = local;
      if (after.levels_completed > before.levels_completed && choice.value === null && local.active) {
        retained = { completed: after.levels_completed, size: layout.size, pitch: layout.pitch,
          rowOffsets: layout.slot_rows.map(row => row.y - layout.palette_y).sort((a, b) => a - b),
          activeOffset: local.active.y - layout.palette_y, submit: issued.action_ref,
          proof: [...local.evidence.slice(-4), after.observation_ref] };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = { ...local, evidence: [...local.evidence.slice(-5), after.observation_ref] };
      delete next.plan;
      if (choice.value === null) {
        const matches = await feedbackMatches(second, after, layout, choice.prefix);
        const cleared = local.active && activePrefix(second, layout, local.active)?.length === 0;
        if (cleared && matches.length === 1) {
          next.history = [...local.history, { ...matches[0]!, ref: after.observation_ref, before: before.observation_ref }];
          next.submission = issued.action_ref;
        } else next.stopped = true;
      } else {
        const active = layout.slot_rows.filter(row => (!local.active || local.repeatable === null || local.active.y === row.y) &&
          equal(activePrefix(second, layout, row), [...choice.prefix, choice.value]));
        const afterPalette = feedbackPalette(after, layout)?.map(([, color]) => color), beforePalette = palette.map(([, color]) => color);
        const mode = equal(afterPalette, beforePalette) ? true : equal(afterPalette, beforePalette.filter(color => color !== choice.value)) ? false : null;
        if (active.length === 1 && mode !== null && (local.repeatable === null || local.repeatable === mode)) {
          next.active = active[0]!;
          next.repeatable = mode;
          if (mode && choice.plan) next.plan = choice.plan;
        } else next.blocked = [...local.blocked, JSON.stringify([before.frame_hash, choice.action])];
      }
      state = next;
      return { events: [], ...(local.repeatable === null && next.repeatable === true
        ? { reviewEvidence: 'The value was appended and the palette remained visible, allowing another selection of the same value.' } : {}) };
    },
    state: () => ({ state, retained }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained as EntryEvidence | undefined) ?? null);
    },
  };
}
