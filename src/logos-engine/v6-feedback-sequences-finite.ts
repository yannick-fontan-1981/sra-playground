/**
 * V6 feedback_sequences/finite.py and its consumed V5 accounting closure.
 * Scope: constraint_filter and trial_partitions with enumerated duplicate-allowed
 * secrets, current observed history and revealed ranks. This is not a transfer
 * of V5 protocol fitting, policy trees, transactions or retained-history joins.
 */
import type { NativeExecution, NativeObservation, NativeRecord } from './v6-native-types.ts';
import type { FeedbackHistoryRow } from './v6-feedback-sequences-visual.ts';

export interface FeedbackConfiguration {
  stages: string[]; allocation_orders: ('LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT')[];
  measures: FeedbackMeasure[]; maximum_candidates: number; maximum_trials: number;
  maximum_evaluations: number; maximum_bundle: number; question: string;
}
export type FeedbackMeasure = 'WORST_NONWINNING_RESIDUAL' | 'SUM_SQUARED_RESIDUALS' | 'NONWINNING_BRANCHES' | 'WINNING_HYPOTHESES';
interface Law { ref: string; exact: string; elsewhere: string; absent: string; order: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT' }
interface Account { code: string[]; law: Law }
const same = (a: readonly unknown[], b: readonly unknown[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const lexical = (a: readonly string[], b: readonly string[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  return a.length - b.length;
};
const numericLexical = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};
/** Exact occurrences are reserved before displaced occurrences, for both orders. */
export function evaluateFeedbackAccounting(secret: readonly string[], trial: readonly string[], law: Law): string[] {
  const marks = trial.map(() => law.absent), remaining = new Map<string, number>();
  for (const value of secret) remaining.set(value, (remaining.get(value) ?? 0) + 1);
  for (let rank = 0; rank < trial.length; rank++) if (trial[rank] === secret[rank]) {
    const value = trial[rank]!; marks[rank] = law.exact; remaining.set(value, remaining.get(value)! - 1);
  }
  for (let i = 0; i < trial.length; i++) {
    const rank = law.order === 'LEFT_TO_RIGHT' ? i : trial.length - i - 1, value = trial[rank]!;
    if (marks[rank] !== law.exact && (remaining.get(value) ?? 0) > 0) {
      marks[rank] = law.elsewhere; remaining.set(value, remaining.get(value)! - 1);
    }
  }
  return marks;
}

function* feedbackTrialCalculation(alphabet: readonly number[], length: number, prefixValues: readonly number[],
  history: readonly FeedbackHistoryRow[], revealed: readonly (number | null)[], repeatable: boolean | null,
  _observation: NativeObservation, budget: number, configuration: FeedbackConfiguration): Generator<NativeRecord, NativeRecord> {
  const refs = alphabet.map(value => `value:${value}`), prefix = prefixValues.map(value => `value:${value}`);
  const codesCount = refs.length ** length;
  if (codesCount > configuration.maximum_candidates) return { status: 'candidate_bound', count_lower_bound: codesCount };
  const marks = [...new Set(history.flatMap(row => row.marks))].sort();
  if (marks.length > 3) return { status: 'unsupported_feedback_classes' };
  while (marks.length < 3) marks.push(`unseen_style:${marks.length}`);
  const laws: Law[] = [];
  for (let e = 0; e < 3; e++) for (let d = 0; d < 3; d++) if (d !== e) for (let a = 0; a < 3; a++) if (a !== e && a !== d) {
    for (const order of configuration.allocation_orders) laws.push({ ref: `law:${laws.length}`, exact: marks[e]!, elsewhere: marks[d]!, absent: marks[a]!, order });
  }
  if (!history.length) laws.splice(1);
  // Native validation preserves the admitted Pydantic bounds of the consumed request.
  if (!Number.isSafeInteger(length) || length < 1 || length > 12 || refs.length > 32 || new Set(refs).size !== refs.length
    || prefix.length > length || revealed.length !== length || history.length > 256 || laws.length > 16
    || new Set(history.map(row => row.ref)).size !== history.length || prefix.some(value => !refs.includes(value))
    || revealed.some(value => value !== null && !alphabet.includes(value))
    || history.some(row => row.values.length !== row.marks.length || row.values.length > length || row.values.some(value => !alphabet.includes(value)))) {
    throw new TypeError('Feedback finite request is outside the original rank, value or evidence domain');
  }
  const histories = history.map(row => ({ trial: row.values.map(value => `value:${value}`), marks: row.marks }));
  const accounts: Account[] = [], candidates: string[][] = [], compatibleLaws = new Set<string>();
  let evaluations = 0, yieldedEvaluations = 0;
  for (let index = 0; index < codesCount; index++) {
    if (index % 32 === 0 || evaluations - yieldedEvaluations >= 512) {
      yieldedEvaluations = evaluations;
      yield { phase: 'candidate_accounts', next_candidate_index: index, feedback_evaluations: evaluations };
    }
    let cursor = index;
    const code = Array<string>(length);
    for (let rank = length - 1; rank >= 0; rank--) { code[rank] = refs[cursor % refs.length]!; cursor = Math.floor(cursor / refs.length); }
    if (revealed.some((value, rank) => value !== null && code[rank] !== `value:${value}`)) continue;
    const needed = laws.length * histories.length;
    if (evaluations + needed > configuration.maximum_evaluations) return { status: 'feedback_contradiction_or_bound', prerequisites: [], bound: true };
    let supported = false;
    for (const law of laws) {
      evaluations += histories.length;
      if (histories.every(row => same(evaluateFeedbackAccounting(code, row.trial, law), row.marks))) {
        accounts.push({ code, law }); compatibleLaws.add(law.ref); supported = true;
      }
    }
    if (supported) candidates.push(code);
  }
  if (!accounts.length) return { status: 'feedback_contradiction_or_bound', prerequisites: ['code.current_reading_or_model_contradiction'], bound: false };
  const legal = candidates.filter(code => same(code.slice(0, prefix.length), prefix) && (repeatable !== false || new Set(code).size === code.length));
  if (!legal.length) return { status: 'preserved_prefix_has_no_admissible_trial', candidates: candidates.length };
  if (legal.length > configuration.maximum_trials) return { status: 'trial_bound', candidates: candidates.length, trials: legal.length };
  let selected: { trial: string[]; score: number[]; partitionCount: number } | null = null;
  for (let trialIndex = 0; trialIndex < legal.length; trialIndex++) {
    const trial = legal[trialIndex]!;
    yield { phase: 'trial_partitions', next_trial_index: trialIndex, feedback_evaluations: evaluations };
    if (evaluations + accounts.length > configuration.maximum_evaluations) return { status: 'partition_bound', bound: true };
    evaluations += accounts.length;
    const branches = new Map<string, { winning: boolean; secrets: Set<string>; accounts: number }>();
    for (let accountIndex = 0; accountIndex < accounts.length; accountIndex++) {
      if (accountIndex > 0 && accountIndex % 128 === 0) yield { phase: 'trial_partitions', next_trial_index: trialIndex,
        next_account_index: accountIndex, feedback_evaluations: evaluations };
      const account = accounts[accountIndex]!;
      const feedback = evaluateFeedbackAccounting(account.code, trial, account.law), winning = same(account.code, trial);
      const key = JSON.stringify([feedback, winning]), branch = branches.get(key) ?? { winning, secrets: new Set(), accounts: 0 };
      branch.secrets.add(JSON.stringify(account.code)); branch.accounts++; branches.set(key, branch);
    }
    const nonwinning = [...branches.values()].filter(branch => !branch.winning);
    const measures: Record<FeedbackMeasure, number> = {
      WORST_NONWINNING_RESIDUAL: Math.max(0, ...nonwinning.map(branch => branch.secrets.size)),
      SUM_SQUARED_RESIDUALS: nonwinning.reduce((sum, branch) => sum + branch.secrets.size ** 2, 0),
      NONWINNING_BRANCHES: nonwinning.length,
      WINNING_HYPOTHESES: [...branches.values()].filter(branch => branch.winning).reduce((sum, branch) => sum + branch.accounts, 0),
    };
    const score = configuration.measures.map(measure => measures[measure]);
    if (!selected || numericLexical(score, selected.score) < 0 || numericLexical(score, selected.score) === 0 && lexical(trial, selected.trial) < 0) {
      selected = { trial, score, partitionCount: branches.size };
    }
  }
  const needed = length - prefix.length + 1;
  if (needed > budget) return { status: 'input_budget', needed, remaining: budget };
  return { status: 'proposed', trial: selected!.trial.map(value => Number(value.slice(6))), candidate_count: candidates.length,
    law_alternatives: compatibleLaws.size, trial_count: legal.length,
    minimax: Object.fromEntries(configuration.measures.map((measure, i) => [measure, selected!.score[i]!])),
    partition_count: selected!.partitionCount, information_cost: needed,
    scope: 'minimum worst residual among complete plausible codes preserving the active prefix; no multi-attempt success guarantee',
    assumptions: ['positionwise_exact_elsewhere_absent_feedback', 'unrevealed_values_remain_possible', 'secret_repetitions_not_excluded_by_palette_removal'],
    evidence: history.map(row => row.ref) };
}

type FeedbackArguments = [alphabet: readonly number[], length: number, prefixValues: readonly number[],
  history: readonly FeedbackHistoryRow[], revealed: readonly (number | null)[], repeatable: boolean | null,
  observation: NativeObservation, budget: number, configuration: FeedbackConfiguration];

/** Deterministic source-domain calculation, also used by the original differential oracle. */
export function chooseFeedbackTrial(...args: FeedbackArguments): NativeRecord {
  const work = feedbackTrialCalculation(...args);
  for (let next = work.next(); ; next = work.next()) if (next.done) return next.value;
}

/** Native scheduling adaptation; an unfinished enumeration never recommends a trial. */
export async function chooseFeedbackTrialCooperative(args: FeedbackArguments, execution?: NativeExecution): Promise<NativeRecord> {
  if (!execution) return chooseFeedbackTrial(...args);
  const work = feedbackTrialCalculation(...args);
  let frontier: NativeRecord = { phase: 'not_started' };
  const now = execution.now ?? (() => performance.now());
  let lastYield = now(), slices = 0;
  const interruption = (): string | null => execution.signal?.aborted ? 'aborted'
    : execution.deadlineMs !== undefined && now() >= execution.deadlineMs ? 'deadline' : null;
  for (;;) {
    const interrupted = interruption();
    if (interrupted) return { status: 'native_feedback_search_incomplete', reason: interrupted, frontier,
      domain_complete: false, recommendation: null, scope: 'Native cooperative scheduling; no incomplete residual is treated as an exhaustive domain.' };
    const next = work.next();
    if (next.done) return next.value;
    frontier = next.value;
    // Small domains do not schedule a timer per candidate or proposed trial.
    // Both finite work slices and elapsed time bound the cooperative quantum.
    if (++slices >= 16 || now() - lastYield >= 8) {
      await execution.yieldControl(); lastYield = now(); slices = 0;
    }
  }
}
