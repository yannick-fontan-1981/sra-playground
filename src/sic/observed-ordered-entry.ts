import { chooseFeedbackTrialCooperative, type FeedbackConfiguration } from '../logos-engine/v6-feedback-sequences-finite.ts';
import { feedbackBorder, feedbackMatches, feedbackPalette, feedbackValues, initialFeedbackLayout,
  type FeedbackHistoryRow, type FeedbackLayout, type FeedbackSlotRow } from '../logos-engine/v6-feedback-sequences-visual.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

export type OrderedEntry = { layout: FeedbackLayout; active?: FeedbackSlotRow; repeatable?: boolean;
  history: FeedbackHistoryRow[]; refs: string[]; rejected: string[] };
export type EntryProposal = { command: NativeCommand; box: NativeBox; label: string; evidence: string[];
  value?: number; prefix: number[]; state: OrderedEntry; palette: number[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const configuration: FeedbackConfiguration = { stages: [], allocation_orders: ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT'],
  measures: ['WORST_NONWINNING_RESIDUAL', 'SUM_SQUARED_RESIDUALS', 'NONWINNING_BRANCHES'], maximum_candidates: 8192,
  maximum_trials: 256, maximum_evaluations: 65536, maximum_bundle: 1, group_equivalent_trials: true,
  prune_dominated_trials: true, question: 'Separate the remaining ordered answers using the displayed feedback' };
const key = (observation: NativeObservation, command: NativeCommand) => JSON.stringify([observation.frame_hash, command]);

function written(rows: NativeRows, layout: FeedbackLayout, row: FeedbackSlotRow): number[] | undefined {
  const values = feedbackValues(rows, layout, row.y, layout.count);
  if (!values) return;
  const prefix = values.filter(value => value !== row.empty);
  return prefix.every(value => layout.alphabet.includes(value))
    && same(values, [...prefix, ...Array(values.length - prefix.length).fill(row.empty)]) ? prefix : undefined;
}

export async function chooseOrderedEntry(local: OrderedEntry | undefined, observation: NativeObservation,
  rows: NativeRows, submit: NativeCommand, remaining: number, execution?: NativeExecution): Promise<EntryProposal | undefined> {
  const layout = local?.layout ?? initialFeedbackLayout(observation);
  if (!layout || layout.slot_rows.length !== 2) return;
  const palette = feedbackPalette(observation, layout);
  if (!palette) return;
  const state = local ?? { layout, history: [], refs: [], rejected: [] };
  const prefix = state.active ? written(rows, layout, state.active) : [];
  if (!prefix || state.history.length >= 12) return;
  const [width, height] = layout.size;
  const box: NativeBox = [layout.xs[0]!, layout.palette_y, layout.xs.at(-1)! + width - 1, layout.palette_y + height - 1];
  const plan = { state, prefix, box, evidence: state.refs, palette: palette.map(([, color]) => color) };
  if (prefix.length === layout.count) return state.rejected.includes(key(observation, submit)) ? undefined
    : { ...plan, command: submit, label: 'Submit the completed entry and compare the returned row' };
  let value: number | undefined;
  if (!state.active) {
    const styles = palette.map(([x]) => feedbackBorder(rows, x, layout.palette_y, width, height));
    const distinctive = styles.flatMap((style, i) => styles.filter(other => same(style, other)).length === 1 ? [i] : []);
    if (distinctive.length === 1) value = palette[distinctive[0]!]![1];
  } else {
    const other = layout.slot_rows.find(row => row.y !== state.active!.y)!;
    const shown = feedbackValues(rows, layout, other.y, layout.count);
    if (!shown || state.repeatable === undefined) return;
    const index = (color: number) => layout.alphabet.indexOf(color);
    const clues = shown.map(color => color === other.empty ? null : index(color));
    if (clues.includes(-1)) return;
    const positions = layout.alphabet.map((_, i) => i);
    const history = state.history.map(row => ({ ...row, values: row.values.map(index) }));
    const result = await chooseFeedbackTrialCooperative([positions, layout.count, prefix.map(index), history,
      clues, state.repeatable, observation, remaining, configuration], execution);
    if (result.status === 'proposed') value = layout.alphabet[(result.trial as number[])[prefix.length]!];
  }
  const tile = palette.find(([, color]) => color === value);
  if (!tile || value === undefined) return;
  const command = { action_ref: 'ACTION6', data: { x: tile[0] + Math.floor(width / 2), y: layout.palette_y + Math.floor(height / 2) } };
  return state.rejected.includes(key(observation, command)) ? undefined
    : { ...plan, command, value, label: state.active ? 'Enter a value compatible with the observed feedback' : 'Test the palette entry with a distinct border' };
}

export async function observeOrderedEntry(proposal: EntryProposal, before: NativeObservation, after: NativeObservation,
  rows: NativeRows): Promise<OrderedEntry> {
  const { layout } = proposal.state;
  const next = { ...proposal.state, refs: [...proposal.state.refs.slice(-5), after.observation_ref] };
  const reject = () => ({ ...next, rejected: [...next.rejected, key(before, proposal.command)] });
  if (proposal.value === undefined) {
    const feedback = await feedbackMatches(rows, after, layout, proposal.prefix);
    if (next.active && written(rows, layout, next.active)?.length === 0 && feedback.length === 1) {
      return { ...next, history: [...next.history, { ...feedback[0]!, ref: after.observation_ref, before: before.observation_ref }] };
    }
    return reject();
  }
  const value = proposal.value, expected = [...proposal.prefix, value];
  const active = layout.slot_rows.filter(row => (!next.active || row.y === next.active.y) && same(written(rows, layout, row), expected));
  const seenPalette = feedbackPalette(after, layout)?.map(([, color]) => color);
  const repeatable = same(seenPalette, proposal.palette) ? true
    : same(seenPalette, proposal.palette.filter(color => color !== value)) ? false : undefined;
  return active.length === 1 && repeatable !== undefined && (next.repeatable === undefined || repeatable === next.repeatable)
    ? { ...next, active: active[0]!, repeatable } : reject();
}
