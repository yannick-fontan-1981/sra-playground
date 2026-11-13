export type Applicability = 'applicable' | 'inapplicable' | 'undetermined';

export type StrategyFact = { readonly value: boolean; readonly evidence: readonly [string, ...string[]] }
  | { readonly value: 'unknown' };

export interface StrategyGuard<Key extends string> {
  readonly fact: Key;
  readonly expected: boolean;
  readonly label: string;
}

export interface StrategyGraph<Id extends string, Key extends string> {
  readonly id: string;
  readonly version: number;
  readonly order: 'FALLBACK';
  readonly priorities: readonly Id[];
  readonly strategies: Readonly<Record<Id, readonly [StrategyGuard<Key>, ...StrategyGuard<Key>[]]>>;
}

export function compileStrategyGraph<Id extends string, Key extends string>(
  graph: StrategyGraph<Id, Key>, dimensions: readonly Key[],
): StrategyGraph<Id, Key> {
  const ids = Object.keys(graph.strategies);
  if (!graph.id || !Number.isSafeInteger(graph.version) || graph.version < 1 || graph.order !== 'FALLBACK'
    || ids.length === 0 || graph.priorities.length !== ids.length || new Set(graph.priorities).size !== ids.length
    || graph.priorities.some(id => !Object.hasOwn(graph.strategies, id))) {
    throw new TypeError('The SIC graph requires a valid identity and a complete, unique strategy order.');
  }
  for (const id of graph.priorities) {
    const guards = graph.strategies[id];
    if (!guards.length || guards.some(guard => !dimensions.includes(guard.fact)
      || typeof guard.expected !== 'boolean' || !guard.label.trim())
      || new Set(guards.map(guard => guard.fact)).size !== guards.length) {
      throw new TypeError(`Invalid or conflicting applicability conditions for ${id}.`);
    }
    for (const guard of guards) Object.freeze(guard);
    Object.freeze(guards);
  }
  Object.freeze(graph.priorities);
  Object.freeze(graph.strategies);
  return Object.freeze(graph);
}

/** Count complete boolean situations covered by this graph. Missing evidence
 * is handled separately at runtime and never qualifies a guard. */
export function auditStrategyGraph<Id extends string, Key extends string>(graph: StrategyGraph<Id, Key>, priorities = graph.priorities) {
  const dimensions = [...new Set(graph.priorities.flatMap(id => graph.strategies[id].map(guard => guard.fact)))];
  if (dimensions.length > 12) throw new RangeError('The exhaustive SIC graph audit supports at most 12 boolean dimensions.');
  const combinations = 2 ** dimensions.length, offsets = new Map(dimensions.map((fact, i) => [fact, i]));
  const matches = priorities.map(id => ({ id, applicable: 0, first: 0 }));
  let covered = 0, overlapping = 0;
  for (let bits = 0; bits < combinations; bits++) {
    const applicable = matches.filter(({ id }) => graph.strategies[id].every(guard =>
      Boolean(bits & (1 << offsets.get(guard.fact)!)) === guard.expected));
    if (applicable.length > 0) {
      covered++;
      applicable[0]!.first++;
    }
    if (applicable.length > 1) overlapping++;
    for (const entry of applicable) entry.applicable++;
  }
  return { dimensions, combinations, covered, uncovered: combinations - covered, overlapping, matches };
}

function evaluateStrategyGuards<Key extends string>(facts: Readonly<Partial<Record<Key, StrategyFact>>>,
  guards: readonly [StrategyGuard<Key>, ...StrategyGuard<Key>[]]) {
  const tested = guards.map(guard => ({ ...guard, observed: facts[guard.fact] ?? { value: 'unknown' as const } }));
  const contradicted = tested.find(guard => guard.observed.value !== 'unknown' && guard.observed.value !== guard.expected);
  const unknown = tested.find(guard => guard.observed.value === 'unknown');
  const applicability: Applicability = contradicted ? 'inapplicable' : unknown ? 'undetermined' : 'applicable';
  return { applicability, reason: contradicted ? `Condition not met: ${contradicted.label}.`
    : unknown ? `Evidence missing: ${unknown.label}.`
    : tested.map(guard => guard.label).join(' · ') + '.', tested };
}

interface StrategyCandidate<Id extends string, Plan> {
  readonly id: Id;
  readonly applicability: Applicability;
  readonly reason: string;
  readonly evidence?: readonly string[];
  readonly plan: () => Plan | null;
}

export interface AgendaEntry<Id extends string = string> {
  readonly id: Id;
  readonly applicability: Applicability;
  readonly reason: string;
  readonly evidence?: readonly string[];
  readonly result: 'selected' | 'no_plan' | 'lower_priority' | 'skipped' | 'shadow';
}

/** Candidates are ordered by the resolution graph before they are offered here. */
function runStrategyAgenda<Id extends string, Plan>(candidates: readonly StrategyCandidate<Id, Plan>[], mode: 'active' | 'shadow') {
  let selected: { id: Id; plan: Plan } | null = null;
  const entries: AgendaEntry<Id>[] = [];
  for (const candidate of candidates) {
    const { id, applicability, reason } = candidate;
    let result: AgendaEntry['result'] = 'skipped';
    if (applicability === 'applicable') {
      if (mode === 'shadow') result = 'shadow';
      else if (selected) result = 'lower_priority';
      else {
        const plan = candidate.plan();
        if (plan !== null) {
          result = 'selected';
          selected = { id, plan };
        } else result = 'no_plan';
      }
    }
    entries.push({ id, applicability, reason, result, ...(candidate.evidence?.length ? { evidence: candidate.evidence } : {}) });
  }
  return { selected, entries };
}

export function resolveStrategyGraph<Id extends string, Key extends string, Plan>({
  graph, facts, mode, planners, priorities = graph.priorities,
}: { graph: StrategyGraph<Id, Key>; facts: Readonly<Partial<Record<Key, StrategyFact>>>; mode: 'active' | 'shadow';
  planners: Readonly<Record<Id, () => Plan | null>>; priorities?: readonly Id[] }) {
  const candidates = priorities.map(id => {
    const assessment = evaluateStrategyGuards(facts, graph.strategies[id]);
    const evidence = [...new Set(assessment.tested.flatMap(guard => guard.observed.value === 'unknown' ? [] : guard.observed.evidence))];
    return { id, applicability: assessment.applicability, reason: assessment.reason, evidence, plan: planners[id] };
  });
  return runStrategyAgenda(candidates, mode);
}
