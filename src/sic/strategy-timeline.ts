import rules from './strategy-rules.json' with { type: 'json' };
import type { DirectionalReturn } from './directional-return.ts';

type StrategyFact = 'previousPredictionFailed' | 'differentPlan' | 'multipleSteps' | 'explicitPrediction' | 'publishedQuestion';

export interface StrategyRule {
  readonly id: string;
  readonly title: string;
  readonly need: string;
  readonly situation: string;
  readonly when?: readonly string[];
  readonly whenAny?: readonly string[];
}

/** A read-only rule catalog. Unknown predicates cannot activate a configuration. */
export function matchStrategy(facts: ReadonlySet<StrategyFact>, configurations: readonly StrategyRule[] = rules): StrategyRule | null {
  const matches = (key: string) => facts.has(key as StrategyFact);
  return configurations.find(rule => {
    const all = rule.when ?? [], any = rule.whenAny ?? [];
    return (all.length > 0 || any.length > 0) && all.every(matches) && (!any.length || any.some(matches));
  }) ?? null;
}

interface Episode {
  readonly first: DirectionalReturn;
  readonly last: DirectionalReturn;
  readonly previous: DirectionalReturn | null;
  readonly next: DirectionalReturn | null;
  readonly rule: StrategyRule | null;
  readonly status: 'contradicted' | 'advanced' | 'replaced' | 'confirmed' | 'unverified';
}

const contiguous = (a: DirectionalReturn | undefined, b: DirectionalReturn) => a && a.sessionId === b.sessionId
  && a.toLevel === a.fromLevel && a.toLevel === b.fromLevel && a.sequence + 1 === b.sequence && !a.restart;
const plan = (item: DirectionalReturn | undefined) => item?.decision?.planRevision ?? item?.decision?.proposalRef ?? null;
const replaces = (a: DirectionalReturn | undefined, b: DirectionalReturn | undefined) => plan(a) !== null
  && plan(b) !== null && plan(a) !== plan(b);

/** Group only observed actions. An unanswered check or a new plan alone is no contradiction. */
export function strategyTimeline(returns: readonly DirectionalReturn[]): Episode[] {
  const groups: { start: number; end: number }[] = [];
  for (const [i, step] of returns.entries()) {
    if (!step.decision) continue;
    const before = returns[i - 1], last = groups.at(-1);
    if (last?.end === i - 1 && contiguous(before, step) && before?.nativeCheck?.matched !== false && plan(step) !== null
        && plan(before) === plan(step) && step.decision.stepIndex !== 0) last.end = i;
    else groups.push({ start: i, end: i });
  }
  return groups.map(({ start, end }) => {
    const first = returns[start]!, last = returns[end]!;
    const previous = contiguous(returns[start - 1], first) ? returns[start - 1]! : null;
    const next = returns[end + 1] && contiguous(last, returns[end + 1]!) && returns[end + 1]!.decision
      ? returns[end + 1]! : null;
    const facts = new Set<StrategyFact>();
    if (previous?.nativeCheck?.matched === false) facts.add('previousPredictionFailed');
    if (previous && replaces(previous, first)) facts.add('differentPlan');
    if (first.decision!.remainingSteps > 1) facts.add('multipleSteps');
    if (first.decision!.steps[0]?.expected) facts.add('explicitPrediction');
    if (first.decision!.question) facts.add('publishedQuestion');
    const status = last.nativeCheck?.matched === false ? 'contradicted' : last.toLevel > last.fromLevel ? 'advanced'
      : next && last.decision!.remainingSteps > 1 && replaces(last, next) ? 'replaced'
        : last.nativeCheck?.matched === true ? 'confirmed' : 'unverified';
    return { first, last, previous, next, rule: matchStrategy(facts), status };
  });
}
