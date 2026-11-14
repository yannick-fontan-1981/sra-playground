import type { NativeStoreWrite } from '../logos-engine/v6-knowledge-store.ts';
import { sicNeedId, type NeedIdentity } from './need-identity.ts';

export const openNeedLabels = {
  restore_rooted_contact_projection: 'Find an access that accounts for the observed contact chain',
  find_observable_frontier_access: 'Find an admissible input or an observed route to one',
} as const;

type Status = 'open' | 'assigned' | 'observed' | 'satisfied' | 'refuted' | 'expired';

export interface SicNeed extends NeedIdentity {
  readonly id: string;
  readonly evidence: readonly string[];
  readonly status: 'open' | 'assigned';
}

export function readSicNeed(value: unknown): SicNeed | null {
  if (typeof value !== 'object' || value === null) return null;
  const need = value as Partial<SicNeed>;
  if (typeof need.kind !== 'string' || !need.kind || typeof need.scope !== 'string' || !need.scope
    || typeof need.parentObjective !== 'string' || !need.parentObjective || typeof need.satisfactionContract !== 'string' || !need.satisfactionContract
    || !Array.isArray(need.subjects) || !need.subjects.every(subject => typeof subject === 'string')
    || !Array.isArray(need.evidence) || !need.evidence.length || !need.evidence.every(ref => typeof ref === 'string')
    || !need.id || (need.status !== 'open' && need.status !== 'assigned') || sicNeedId(need as NeedIdentity) !== need.id) return null;
  return need as SicNeed;
}

/** The native graph owns the need through the same commit as the witnessed
 * plan. Repeated assignments revise a single node with a stable identity. */
export function needCheckpoint(need: SicNeed, status: Status, observation: string, plan: string | null,
  previous: { readonly firstPlan?: string; readonly latestPlan?: string; readonly evidence?: readonly string[] } | null,
  prerequisite?: string): NativeStoreWrite {
  const evidence = [...new Set([...(previous?.evidence ?? []).slice(0, 1), ...need.evidence, observation])];
  return { id: need.id, kind: 'component_state', component: 'sic_need', status: status === 'assigned' || status === 'open' ? 'active' : 'observed',
    evidence, ...(prerequisite ? { relations: [{ relation: 'requires', target: prerequisite }] } : {}),
    value: { ...need, evidence, status, firstPlan: previous?.firstPlan ?? plan,
      latestPlan: plan ?? previous?.latestPlan ?? null, latestObservation: observation } };
}
