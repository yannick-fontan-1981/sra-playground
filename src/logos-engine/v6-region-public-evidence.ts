import type { AgentAction, AgentObservation } from '../runtime/contracts.ts';
import type { RegionInterventionObservation } from './v6-region-intervention.ts';
import { comparePublicObservations, type PublicObservationDelta } from './v6-public-observation-delta.ts';

export interface RegionPublicEffectEvidence {
  useful: boolean;
  separatorRef: string;
  actionRef: 'ACTION6';
  affectedRegions: string[];
  effectKey: string;
  levelEpoch: string;
  observationRevision: number;
  delta: PublicObservationDelta;
}

function separatorRef(action: Extract<AgentAction, { id: 6 }>): string {
  return `action6:${action.data.x}:${action.data.y}`;
}

export function regionPublicEffectEvidence(
  action: AgentAction,
  before: AgentObservation,
  after: AgentObservation,
): RegionPublicEffectEvidence | undefined {
  if (action.id !== 6) return undefined;
  const delta = comparePublicObservations(before, after);
  return {
    useful: delta.regions.length > 0,
    separatorRef: separatorRef(action),
    actionRef: 'ACTION6',
    affectedRegions: delta.regions.map(region => region.ref),
    effectKey: delta.effectKey,
    levelEpoch: `${after.sessionId}:level:${after.level}`,
    observationRevision: after.sequence,
    delta,
  };
}

export function bindRegionMethod(
  evidence: RegionPublicEffectEvidence,
  methodRef: string,
): RegionInterventionObservation | undefined {
  if (typeof methodRef !== 'string' || methodRef.length === 0) {
    throw new TypeError('methodRef must be a non-empty string');
  }
  if (!evidence.useful || evidence.affectedRegions.length === 0) return undefined;
  return {
    methodRef,
    separatorRef: evidence.separatorRef,
    actionRef: evidence.actionRef,
    affectedRegions: [...evidence.affectedRegions],
    effectKey: evidence.effectKey,
    levelEpoch: evidence.levelEpoch,
    observationRevision: evidence.observationRevision,
  };
}
