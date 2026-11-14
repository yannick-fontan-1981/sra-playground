import type { NativeStoreWrite } from '../logos-engine/v6-knowledge-store.ts';
import { sicNeedId, type NeedIdentity } from './need-identity.ts';

type Status = 'assigned' | 'observed' | 'satisfied' | 'refuted' | 'expired';

export interface AssignedNeed extends NeedIdentity {
  readonly id: string;
  readonly evidence: readonly string[];
  readonly status: 'assigned';
}

export function assignedNeed(value: unknown): AssignedNeed | null {
  if (typeof value !== 'object' || value === null) return null;
  const need = value as Partial<AssignedNeed>;
  if (typeof need.kind !== 'string' || !need.kind || typeof need.scope !== 'string' || !need.scope
    || typeof need.parentObjective !== 'string' || !need.parentObjective || typeof need.satisfactionContract !== 'string' || !need.satisfactionContract
    || !Array.isArray(need.subjects) || !need.subjects.every(subject => typeof subject === 'string')
    || !Array.isArray(need.evidence) || !need.evidence.length || !need.evidence.every(ref => typeof ref === 'string')
    || !need.id || need.status !== 'assigned' || sicNeedId(need as NeedIdentity) !== need.id) return null;
  return need as AssignedNeed;
}

/** The native graph owns the need through the same commit as the witnessed
 * plan. Repeated assignments revise a single node with a stable identity. */
export function needCheckpoint(need: AssignedNeed, status: Status, observation: string, plan: string,
  previous: { readonly firstPlan?: string } | null): NativeStoreWrite {
  return { id: need.id, kind: 'component_state', component: 'sic_need', status: status === 'assigned' ? 'active' : 'observed',
    evidence: [...new Set([...need.evidence, observation])],
    value: { ...need, status, firstPlan: previous?.firstPlan ?? plan, latestPlan: plan, latestObservation: observation } };
}
