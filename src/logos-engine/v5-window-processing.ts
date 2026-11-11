/** Consumed models and private kernels from V5 window_processing_d.py.
 * Persistent ranks are never compacted. A conditional projection is neither
 * a measured beat law nor permission to issue an external input.
 * Source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 */
import { compareUnicode, isJsonObject } from './canonical.ts';
import { RecolorComputationInterrupted } from './v6-topological-recolor-geometry.ts';
import type { RecolorWorkBudget } from './v6-topological-recolor-geometry.ts';

export type WindowRecord = Record<string, any>;
type R = WindowRecord;
export interface TrainRankD {
  unit_ref: string; rank: number; current_color_ref: string; captured: boolean;
}
export interface WindowReceiverD {
  receiver_ref: string; first_rank_at_beat_zero: number; window_size: number;
  admitted_color_refs: string[] | null; maximal_group_required: boolean;
  required_parent_events: [string, string][]; action: 'CAPTURE' | 'PAINT' | 'PULSE';
  paint_color_ref: string | null; event_ref: string; one_use_for_run: boolean;
}
export interface BeatPulseD { receiver_ref: string; event_ref: string; beat: number }
export interface WindowBeatStateD {
  train: TrainRankD[]; receivers: WindowReceiverD[]; receiver_order: string[];
  spent_for_run_refs: string[]; current_pulses: BeatPulseD[]; beat: number;
  rank_shift_per_beat: number; visitation_policy: 'single_ordered_pass' | 'revisit_to_quiescence';
  revisit_receiver_refs: string[]; firing_bounds: [string, number][];
  revisit_termination_evidence_ref: string | null;
}

const TRAIN_FIELDS = ['unit_ref', 'rank', 'current_color_ref', 'captured'];
const RECEIVER_FIELDS = ['receiver_ref', 'first_rank_at_beat_zero', 'window_size', 'admitted_color_refs',
  'maximal_group_required', 'required_parent_events', 'action', 'paint_color_ref', 'event_ref', 'one_use_for_run'];
const PULSE_FIELDS = ['receiver_ref', 'event_ref', 'beat'];
const STATE_FIELDS = ['train', 'receivers', 'receiver_order', 'spent_for_run_refs', 'current_pulses', 'beat',
  'rank_shift_per_beat', 'visitation_policy', 'revisit_receiver_refs', 'firing_bounds', 'revisit_termination_evidence_ref'];
const WHITESPACE = /^[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;

function record(value: unknown, fields: readonly string[], name: string): R {
  if (!isJsonObject(value) || Object.keys(value).some(key => !fields.includes(key))) {
    throw new TypeError(`${name} requires its declared fields only`);
  }
  return value;
}
function ref(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('A mechanical reference must be a string');
  const result = value.replace(WHITESPACE, '');
  if (!result.length) throw new TypeError('A mechanical reference must not be empty');
  return result;
}
function nullableRef(value: unknown): string | null { return value === null ? null : ref(value); }
function defaultField(row: R, key: string, fallback: unknown): any { return Object.hasOwn(row, key) ? row[key] : fallback; }
function integer(value: unknown, minimum = -Number.MAX_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number {
  let result: unknown = value;
  if (typeof result === 'boolean') result = Number(result);
  else if (typeof result === 'string' && /^[+-]?\d+(?:\.0+)?$/.test(result.trim())) result = Number(result.trim());
  if (typeof result !== 'number' || !Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new TypeError('A mechanical integer is outside the admitted exact native domain');
  }
  return Object.is(result, -0) ? 0 : result;
}
function boolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['0', 'off', 'f', 'false', 'n', 'no'].includes(lower)) return false;
    if (['1', 'on', 't', 'true', 'y', 'yes'].includes(lower)) return true;
  }
  throw new TypeError('Invalid mechanical boolean');
}
function sequence<T>(value: unknown, read: (item: any) => T, minimum = 0, maximum = 4096): T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Invalid mechanical sequence');
  return value.map(read);
}
function pair<A, B>(value: unknown, left: (item: unknown) => A, right: (item: unknown) => B): [A, B] {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError('A mechanical pair requires exactly two fields');
  return [left(value[0]), right(value[1])];
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new TypeError('Unknown mechanical literal');
  return value as T;
}

/** JSON-domain constructors: defaults/invariants are source-shaped. General
 * Python object coercions and integers outside the safe native domain are not
 * claimed. Inputs are detached; projections never mutate their caller. */
export function normalizeTrainRank(value: unknown): TrainRankD {
  const row = record(value, TRAIN_FIELDS, 'TrainRankD');
  return { unit_ref: ref(row.unit_ref), rank: integer(row.rank), current_color_ref: ref(row.current_color_ref), captured: boolean(row.captured) };
}
export function normalizeWindowReceiver(value: unknown): WindowReceiverD {
  const row = record(value, RECEIVER_FIELDS, 'WindowReceiverD');
  return { receiver_ref: ref(row.receiver_ref), first_rank_at_beat_zero: integer(row.first_rank_at_beat_zero),
    window_size: integer(row.window_size, 1, 4096),
    admitted_color_refs: row.admitted_color_refs === null ? null : sequence(row.admitted_color_refs, ref, 0, Number.MAX_SAFE_INTEGER),
    maximal_group_required: boolean(row.maximal_group_required),
    required_parent_events: sequence(defaultField(row, 'required_parent_events', []), item => pair(item, ref, ref), 0, 128),
    action: choice(row.action, ['CAPTURE', 'PAINT', 'PULSE']), paint_color_ref: nullableRef(row.paint_color_ref),
    event_ref: ref(row.event_ref), one_use_for_run: boolean(row.one_use_for_run) };
}
export function normalizeBeatPulse(value: unknown): BeatPulseD {
  const row = record(value, PULSE_FIELDS, 'BeatPulseD');
  return { receiver_ref: ref(row.receiver_ref), event_ref: ref(row.event_ref), beat: integer(row.beat, 0) };
}
export function normalizeWindowBeatState(value: unknown): WindowBeatStateD {
  const row = record(value, STATE_FIELDS, 'WindowBeatStateD');
  const state: WindowBeatStateD = {
    train: sequence(defaultField(row, 'train', []), normalizeTrainRank), receivers: sequence(row.receivers, normalizeWindowReceiver, 1, 128),
    receiver_order: sequence(row.receiver_order, ref, 1, 128), spent_for_run_refs: sequence(defaultField(row, 'spent_for_run_refs', []), ref, 0, 128),
    current_pulses: sequence(defaultField(row, 'current_pulses', []), normalizeBeatPulse), beat: integer(row.beat, 0),
    rank_shift_per_beat: integer(row.rank_shift_per_beat),
    visitation_policy: choice(row.visitation_policy, ['single_ordered_pass', 'revisit_to_quiescence']),
    revisit_receiver_refs: sequence(defaultField(row, 'revisit_receiver_refs', []), ref, 0, 128),
    firing_bounds: sequence(defaultField(row, 'firing_bounds', []), item => pair(item, ref, integer), 0, 128),
    revisit_termination_evidence_ref: nullableRef(row.revisit_termination_evidence_ref),
  };
  const ids = new Set(state.receivers.map(receiver => receiver.receiver_ref));
  if (new Set(state.train.map(unit => unit.unit_ref)).size !== state.train.length
    || new Set(state.train.map(unit => unit.rank)).size !== state.train.length) throw new TypeError('Train identities/ranks must persist without compaction');
  if (ids.size !== state.receivers.length || state.receiver_order.length !== ids.size
    || new Set(state.receiver_order).size !== ids.size || state.receiver_order.some(id => !ids.has(id))) {
    throw new TypeError('Receiver visitation order must be supplied exactly');
  }
  if ([...state.spent_for_run_refs, ...state.revisit_receiver_refs].some(id => !ids.has(id))) throw new TypeError('Spent/reentry receiver identity absent');
  const order = new Map(state.receiver_order.map((id, index) => [id, index]));
  for (const receiver of state.receivers) {
    if (receiver.action === 'PAINT' && receiver.paint_color_ref === null) throw new TypeError('Paint receiver needs its actual output color');
    if (receiver.required_parent_events.some(([parent]) => !ids.has(parent) || order.get(parent)! >= order.get(receiver.receiver_ref)!)) {
      throw new TypeError('Declared parent dependencies must precede their allowed visits');
    }
  }
  if (new Map(state.firing_bounds).size !== state.firing_bounds.length
    || state.firing_bounds.some(([id, bound]) => !ids.has(id) || bound < 1)) throw new TypeError('Revisit firing certificate invalid');
  return state;
}

function eligibility(state: WindowBeatStateD, receiver: WindowReceiverD, train: readonly TrainRankD[],
  spent: ReadonlySet<string>, pulses: readonly BeatPulseD[], budget: RecolorWorkBudget): R {
  budget.visit({ stage: 'exact_rank_window', receiver_ref: receiver.receiver_ref, beat: state.beat });
  const first = receiver.first_rank_at_beat_zero + state.rank_shift_per_beat * state.beat;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(first + receiver.window_size)) throw new TypeError('Projected rank is outside the exact native domain');
  const ranks = Array.from({ length: receiver.window_size }, (_, offset) => first + offset), byRank = new Map(train.map(unit => [unit.rank, unit]));
  const reasons: string[] = [];
  if (spent.has(receiver.receiver_ref) && receiver.one_use_for_run) reasons.push('SINGLE_OPPORTUNITY_ALREADY_SPENT');
  const window = ranks.map(rank => byRank.get(rank));
  if (window.some(unit => unit === undefined || unit.captured)) reasons.push('MISSING_OR_CAPTURED_FIXED_RANK');
  else {
    const colors = new Set(window.map(unit => unit!.current_color_ref));
    if (colors.size !== 1) reasons.push('WINDOW_NOT_HOMOGENEOUS');
    else {
      const color = window[0]!.current_color_ref;
      if (receiver.admitted_color_refs !== null && !receiver.admitted_color_refs.includes(color)) reasons.push('FILTER_COLOR_MISMATCH');
      if (receiver.maximal_group_required && [first - 1, first + receiver.window_size].some(rank => {
        const unit = byRank.get(rank); return unit !== undefined && !unit.captured && unit.current_color_ref === color;
      })) reasons.push('MATCHING_WINDOW_IS_NOT_MAXIMAL_GROUP');
    }
  }
  const missing = receiver.required_parent_events.filter(([parent, event]) => !pulses.some(pulse =>
    pulse.receiver_ref === parent && pulse.event_ref === event && pulse.beat === state.beat));
  if (missing.length) reasons.push('REQUIRED_PARENT_PULSE_NOT_AT_THIS_BEAT');
  return { receiver_ref: receiver.receiver_ref, beat: state.beat, input_ranks: ranks, eligible: reasons.length === 0,
    rejection_causes: reasons, missing_same_beat_parent_events: missing };
}

export function windowEligibility(state: unknown, receiver: unknown, train: readonly unknown[],
  spent: ReadonlySet<string> | readonly string[], pulses: readonly unknown[], budget: RecolorWorkBudget): R {
  return eligibility(normalizeWindowBeatState(state), normalizeWindowReceiver(receiver), train.map(normalizeTrainRank),
    new Set(spent), pulses.map(normalizeBeatPulse), budget);
}

export function processOneBeat(value: unknown, budget: RecolorWorkBudget, depthBound: number): [WindowBeatStateD, R] {
  const state = normalizeWindowBeatState(value), depth = integer(depthBound);
  let train = [...state.train];
  const spent = new Set(state.spent_for_run_refs), pulses = state.current_pulses.filter(pulse => pulse.beat === state.beat),
    receivers = new Map(state.receivers.map(receiver => [receiver.receiver_ref, receiver])),
    counts = new Map(state.receiver_order.map(id => [id, 0])), fired = new Set<string>(), examined: R[] = [], skipped: R[] = [], events: R[] = [],
    bounds = new Map(state.firing_bounds), revisits = new Set(state.revisit_receiver_refs);
  if (state.visitation_policy === 'revisit_to_quiescence'
    && (!state.revisit_termination_evidence_ref || state.revisit_receiver_refs.some(id => !bounds.has(id)))) {
    throw new RecolorComputationInterrupted('REVISIT_POLICY_TERMINATION_OR_RIGHTS_NOT_BOUND', {});
  }
  for (let iteration = 0; iteration < depth; iteration++) {
    let changed = false;
    for (const id of state.receiver_order) {
      if (iteration && (!revisits.has(id) || counts.get(id)! >= bounds.get(id)!)) continue;
      const receiver = receivers.get(id)!, result = eligibility(state, receiver, train, spent, pulses, budget);
      examined.push({ receiver_ref: id, pass_index: iteration });
      if (!result.eligible) {
        skipped.push({ receiver_ref: id, pass_index: iteration, rejection_causes: result.rejection_causes }); continue;
      }
      if (receiver.one_use_for_run && fired.has(id)) continue;
      const ranks = new Set<number>(result.input_ranks);
      train = train.map(unit => receiver.action === 'CAPTURE' && ranks.has(unit.rank) ? { ...unit, captured: true }
        : receiver.action === 'PAINT' && ranks.has(unit.rank) ? { ...unit, current_color_ref: receiver.paint_color_ref! } : unit);
      pulses.push({ receiver_ref: id, event_ref: receiver.event_ref, beat: state.beat });
      if (receiver.one_use_for_run) spent.add(id);
      fired.add(id); counts.set(id, counts.get(id)! + 1); changed = true;
      events.push({ receiver_ref: id, event_ref: receiver.event_ref, beat: state.beat, firing_index: counts.get(id),
        action: receiver.action, input_ranks: result.input_ranks });
    }
    if (state.visitation_policy === 'single_ordered_pass' || !changed) {
      const spentRefs = [...spent].sort(compareUnicode);
      return [{ ...state, train, spent_for_run_refs: spentRefs, current_pulses: pulses }, {
        examined_this_pass: examined, skipped_occurrences: skipped, fired_this_beat: [...fired].sort(compareUnicode),
        spent_for_run_refs: spentRefs, ordered_events: events }];
    }
  }
  throw new RecolorComputationInterrupted('BEAT_VISITATION_BOUND', { beat: state.beat });
}
