import type { SicNeed } from './need-registry.ts';

export const victoryReviewNodeId = 'sic:victory_reviews';

export interface SicVictoryReview {
  readonly level: number;
  readonly score: number;
  readonly winningAction: number;
  readonly command: string;
  readonly beforeRef: string;
  readonly afterRef: string;
  readonly hypothesis: {
    readonly label: string;
    readonly contract: string;
    readonly subjects: readonly string[];
  } | null;
  readonly checks: readonly {
    readonly action: number;
    readonly observationRef: string;
    readonly matched: boolean | null;
    readonly reason: string | null;
  }[];
}

const record = (value: unknown) => value && typeof value === 'object' ? value as Record<string, unknown> : null;
const position = (ref: string) => {
  const found = /:epoch:(\d+):revision:(\d+):frame:/.exec(ref);
  return found ? { level: Number(found[1]), action: Number(found[2]) - 1 } : null;
};

export function buildVictoryReview(input: {
  level: number; score: number; winningAction: number; command: string; beforeRef: string; afterRef: string;
  need: SicNeed | undefined; label: string | null; satisfied: boolean; returns: readonly unknown[];
}): SicVictoryReview {
  const { level, score, winningAction, command, beforeRef, afterRef, need, label, satisfied } = input;
  const hypothesis = need && label && satisfied && !need.satisfactionContract.startsWith('observe_')
    ? { label, contract: need.satisfactionContract, subjects: need.subjects }
    : null;
  const checked = new Map<number, SicVictoryReview['checks'][number]>();
  for (const item of input.returns) {
    const transition = record(item), outcome = record(transition?.outcome);
    const after = transition?.after;
    const matched = typeof outcome?.matched === 'boolean' ? outcome.matched : null;
    const effect = typeof transition?.observedEffect === 'string' ? transition.observedEffect : null;
    if (typeof after !== 'string' || matched === null && !effect) continue;
    const entry = position(after);
    if (!entry || entry.level !== level || entry.action < 1 || entry.action >= winningAction) continue;
    checked.set(entry.action, { action: entry.action, observationRef: after, matched,
      reason: effect ?? (typeof outcome?.reason === 'string' ? outcome.reason : null) });
  }
  const ordered = [...checked.values()].sort((a, b) => a.action - b.action);
  const checks = [...ordered.filter(check => check.matched !== false).slice(-4), ...ordered.filter(check => check.matched === false).slice(-3)]
    .sort((a, b) => a.action - b.action);
  return { level, score, winningAction, command, beforeRef, afterRef, hypothesis, checks };
}
