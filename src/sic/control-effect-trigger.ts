import type { ReasoningMode } from './reasoning-mode.ts';

export interface ControlEffectTriggerFacts {
  readonly current: string;
  readonly priorEffect?: string;
  readonly planDependency?: string;
  readonly evidence: readonly string[];
}

const cards = {
  revalidate_control: { mode: 'assimilation', reason: 'Recheck a prior effect in the observed situation.' },
  explore_control: { mode: 'exploration', reason: 'Measure the effect that the current objective still needs.' },
  unblock_plan_control: { mode: 'solving', reason: 'Resolve the unknown effect required by an existing plan.' },
} as const;

export interface ControlEffectTrigger {
  readonly id: keyof typeof cards;
  readonly mode: ReasoningMode;
  readonly reason: string;
  readonly evidence: readonly string[];
}

/** P05 has already proved a current subject and a needed, available, untried control. */
export function controlEffectTrigger(mode: ReasoningMode, facts: ControlEffectTriggerFacts): ControlEffectTrigger {
  const requested = mode === 'assimilation' ? facts.priorEffect : mode === 'solving' ? facts.planDependency : undefined;
  const proof = requested && requested !== facts.current && facts.evidence.includes(requested) ? requested : undefined;
  const id = proof && mode === 'assimilation' ? 'revalidate_control' : proof && mode === 'solving' ? 'unblock_plan_control' : 'explore_control';
  return { id, ...cards[id], evidence: proof ? [...new Set([facts.current, proof])] : [facts.current] };
}

export function isControlEffectTriggerId(value: unknown): value is ControlEffectTrigger['id'] {
  return typeof value === 'string' && Object.hasOwn(cards, value);
}

export function readControlEffectTrigger(value: unknown, observationRef: string): ControlEffectTrigger | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<ControlEffectTrigger>;
  if (!isControlEffectTriggerId(record.id) || !Array.isArray(record.evidence) || !record.evidence.every(ref => typeof ref === 'string')
    || !record.evidence.includes(observationRef)) return undefined;
  const card = cards[record.id];
  if (record.mode !== card.mode || record.reason !== card.reason) return undefined;
  if (card.mode !== 'exploration' && !record.evidence.some(ref => ref !== observationRef)) return undefined;
  return { id: record.id, ...card, evidence: record.evidence.slice(0, 4) };
}
