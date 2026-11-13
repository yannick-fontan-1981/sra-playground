export type Applicability = 'applicable' | 'inapplicable' | 'undetermined';

export type StrategyFact = { readonly value: boolean; readonly evidence: readonly [string, ...string[]] }
  | { readonly value: 'unknown' };

export interface StrategyGuard<Key extends string> {
  readonly fact: Key;
  readonly expected: boolean;
  readonly label: string;
}

export function evaluateStrategyGuards<Key extends string>(facts: Readonly<Record<Key, StrategyFact>>,
  guards: readonly [StrategyGuard<Key>, ...StrategyGuard<Key>[]]) {
  const tested = guards.map(guard => ({ ...guard, observed: facts[guard.fact] }));
  const contradicted = tested.find(guard => guard.observed.value !== 'unknown' && guard.observed.value !== guard.expected);
  const unknown = tested.find(guard => guard.observed.value === 'unknown');
  const applicability: Applicability = contradicted ? 'inapplicable' : unknown ? 'undetermined' : 'applicable';
  return { applicability, reason: contradicted ? `Condition not met: ${contradicted.label}.`
    : unknown ? `Evidence missing: ${unknown.label}.`
    : tested.map(guard => guard.label).join(' · ') + '.', tested };
}

export interface StrategyCandidate<Id extends string, Plan> {
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
export function runStrategyAgenda<Id extends string, Plan>(candidates: readonly StrategyCandidate<Id, Plan>[], mode: 'active' | 'shadow') {
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
