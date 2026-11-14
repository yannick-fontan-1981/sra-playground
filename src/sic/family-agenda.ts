export type FamilyAgendaMode = 'shadow' | 'active';
export type FamilyAgendaSetting = FamilyAgendaMode | 'native';
export const defaultBrowserFamilyAgenda: FamilyAgendaSetting = 'active';

export type FamilyTrial = {
  readonly family: string;
  readonly selected: boolean;
  readonly source_trigger_group?: string;
};

export interface FamilyAgendaReceipt {
  readonly mode: FamilyAgendaMode;
  readonly observationRef: string;
  readonly selected: string | null;
  readonly visited: readonly string[];
  readonly matchesSource?: boolean;
  readonly reasoning?: import('./reasoning-mode.ts').ReasoningSituation
    & ReturnType<typeof import('./reasoning-mode.ts').selectReasoningMode> & { readonly card: string };
}

/** Evaluate the declared family order lazily. A refusal that blocks unrelated
 * exploration is an offer and stops the agenda exactly like a bound plan. */
export async function selectStrategyFamily(groups: readonly { readonly id: string }[], offer: (index: number) => Promise<FamilyTrial | null>,
  order: readonly number[] = groups.map((_, index) => index)) {
  const visited: string[] = [];
  for (const index of order) {
    const group = groups[index]!;
    const trial = await offer(index);
    if (!trial) return { selected: null, visited, complete: false };
    visited.push(trial.selected ? trial.source_trigger_group ?? group.id : group.id);
    if (trial.selected) return { selected: trial.family, visited, complete: true };
  }
  return { selected: null, visited, complete: true };
}
