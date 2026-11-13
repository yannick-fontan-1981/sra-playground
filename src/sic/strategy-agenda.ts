export type Applicability = 'applicable' | 'inapplicable' | 'undetermined';

export interface StrategyCandidate<Id extends string, Plan> {
  readonly id: Id;
  readonly applicability: Applicability;
  readonly reason: string;
  readonly plan: () => Plan | null;
}

export interface AgendaEntry<Id extends string = string> {
  readonly id: Id;
  readonly applicability: Applicability;
  readonly reason: string;
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
    entries.push({ id, applicability, reason, result });
  }
  return { selected, entries };
}
