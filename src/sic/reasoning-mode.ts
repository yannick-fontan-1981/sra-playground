export type ReasoningMode = 'exploration' | 'assimilation' | 'solving';

export interface ReasoningSituation {
  readonly level: number;
  readonly levelsCompleted: number;
  readonly targetLevels: number;
  readonly levelActions: number;
  readonly remainingActions: number;
  readonly latestReturn: 'unknown' | 'matched' | 'contradicted';
  readonly acquiredInformation: boolean;
  readonly observationRef: string;
}

export function selectReasoningMode(situation: ReasoningSituation) {
  if (situation.levelActions === 0) {
    return { mode: 'assimilation', reason: 'Establish the actual level entry and revalidate any retained knowledge.' } as const;
  }
  if (situation.latestReturn === 'contradicted') {
    return { mode: 'exploration', reason: 'Seek evidence that explains the return that contradicted the projection.' } as const;
  }
  if (situation.latestReturn === 'matched') {
    return { mode: 'solving', reason: 'The latest check supports continuing with established effects.' } as const;
  }
  if (situation.acquiredInformation) {
    return { mode: 'assimilation', reason: 'Acquired evidence is available for revalidation in the current situation.' } as const;
  }
  return { mode: 'exploration', reason: 'The current level has no checked return supporting an execution plan.' } as const;
}

type TriggerCard = { readonly id: string; readonly mode: ReasoningMode; readonly minimumRemaining: number;
  readonly groups: readonly string[] };
export const reasoningTriggerCards: readonly TriggerCard[] = [
  { id: 'explore-grounded-question', mode: 'exploration', minimumRemaining: 2,
    groups: ['information_goal', 'acquire_control_for_target', 'view', 'view_continuity', 'observed_frontier'] },
  { id: 'explore-with-limited-reserve', mode: 'exploration', minimumRemaining: 0,
    groups: ['view', 'view_continuity', 'acquire_control_for_target', 'information_goal', 'observed_frontier'] },
  { id: 'revalidate-needed-control', mode: 'assimilation', minimumRemaining: 0,
    groups: ['acquire_control_for_target', 'information_goal', 'view', 'view_continuity', 'observed_frontier'] },
  { id: 'resume-objective-access', mode: 'solving', minimumRemaining: 0,
    groups: ['view', 'view_continuity', 'acquire_control_for_target', 'information_goal', 'observed_frontier'] },
];

/** Keep earlier obligations in their native order and prefer a different way
 * to obtain information when none of those obligations produces an offer. */
export function reasoningGroupOrder(groups: readonly { readonly id: string }[], mode: ReasoningMode, remainingActions: number) {
  const card = reasoningTriggerCards.find(row => row.mode === mode && remainingActions >= row.minimumRemaining)!;
  const preferred = card.groups;
  const order = groups.map((_, index) => index);
  const positions = order.filter(index => preferred.includes(groups[index]!.id));
  const ranked = [...positions].sort((a, b) => preferred.indexOf(groups[a]!.id) - preferred.indexOf(groups[b]!.id));
  for (const [index, position] of positions.entries()) order[position] = ranked[index]!;
  return { order, card: card.id };
}
