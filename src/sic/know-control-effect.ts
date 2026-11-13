import type { EvidenceRef, SituationFrame, SituationKey, SituationScope, SituationValues } from './situation.ts';

export type Applicability = 'applicable' | 'not_applicable' | 'unknown';

type Condition = {
  [K in SituationKey]-?: { readonly key: K; readonly value: SituationValues[K] }
}[SituationKey];

export interface ControlEffectStrategy {
  readonly id: string;
  readonly label: string;
  readonly conditions: readonly Condition[];
}

export interface ControlEffectGraph {
  readonly id: string;
  readonly version: number;
  readonly experiments: readonly ControlEffectStrategy[];
  readonly fallback: ControlEffectStrategy;
}

export interface ControlEffectNeed {
  readonly scope: SituationScope;
  readonly controlRef: string | null;
  readonly subjectRef: string | null;
}

const experimentConditions = [
  { key: 'commandAvailable', value: true },
  { key: 'subjectObservable', value: true },
  { key: 'effectIsolatable', value: true },
  { key: 'riskBounded', value: true },
  { key: 'experimentPending', value: false },
] as const satisfies readonly Condition[];

// One selection among controlled experiments. Passive observation is the explicit fallback.
export const knowControlEffectGraph: ControlEffectGraph = {
  id: 'know_control_effect',
  version: 1,
  experiments: [
    {
      id: 'learn-control-effect',
      label: 'Compare before and after a click',
      conditions: [{ key: 'controlModel', value: 'identified_click' }, ...experimentConditions],
    },
    {
      id: 'learn-direction-effect',
      label: 'Track the same subject after a direction input',
      conditions: [{ key: 'controlModel', value: 'directional' }, ...experimentConditions],
    },
    {
      id: 'learn-selected-transform-effect',
      label: 'Track the selected subject through a transformation',
      conditions: [{ key: 'controlModel', value: 'selection_then_transform' }, ...experimentConditions],
    },
  ],
  fallback: {
    id: 'observe-control-effect-passively',
    label: 'Look for evidence in an ordinary return',
    conditions: [{ key: 'passiveObservationPossible', value: true }],
  },
};

export interface BranchEvaluation {
  readonly id: string;
  readonly label: string;
  readonly status: Applicability;
  readonly missing: readonly SituationKey[];
  readonly excludedBy: readonly SituationKey[];
  readonly evidence: readonly EvidenceRef[];
}

export interface ControlEffectResolution {
  readonly needId: string;
  readonly graphId: string;
  readonly graphVersion: number;
  readonly schemaVersion: SituationFrame['schemaVersion'];
  readonly frameRevision: number;
  readonly outcome: 'candidate' | 'needs_evidence' | 'ambiguous' | 'uncovered' | 'closed' | 'stale' | 'unscoped';
  readonly candidate?: BranchEvaluation;
  readonly branches: readonly BranchEvaluation[];
  readonly missing: readonly SituationKey[];
}

function evaluateBranch(strategy: ControlEffectStrategy, frame: SituationFrame): BranchEvaluation {
  const missing = new Set<SituationKey>();
  const excludedBy = new Set<SituationKey>();
  const evidence = new Map<string, EvidenceRef>();
  for (const condition of strategy.conditions) {
    const trait = frame.traits[condition.key];
    if (trait?.status !== 'known') {
      missing.add(condition.key);
      continue;
    }
    if (trait.value !== condition.value) excludedBy.add(condition.key);
    for (const item of trait.evidence) evidence.set(item.ref, item);
  }
  return {
    id: strategy.id,
    label: strategy.label,
    status: excludedBy.size ? 'not_applicable' : missing.size ? 'unknown' : 'applicable',
    missing: [...missing],
    excludedBy: [...excludedBy],
    evidence: [...evidence.values()],
  };
}

export function evaluateControlEffect(
  need: ControlEffectNeed,
  frame: SituationFrame,
  graph: ControlEffectGraph = knowControlEffectGraph,
): ControlEffectResolution {
  const base = {
    needId: JSON.stringify([graph.id, need.scope.session, need.scope.level, need.controlRef, need.subjectRef]),
    graphId: graph.id,
    graphVersion: graph.version,
    schemaVersion: frame.schemaVersion,
    frameRevision: frame.revision,
  };
  if (need.scope.session !== frame.scope.session || need.scope.level !== frame.scope.level) {
    return { ...base, outcome: 'stale', branches: [], missing: [] };
  }
  if (frame.phase === 'terminal') return { ...base, outcome: 'closed', branches: [], missing: [] };

  const branches = graph.experiments.map(strategy => evaluateBranch(strategy, frame));
  const result = { ...base, branches, missing: [] };
  const applicable = branches.filter(branch => branch.status === 'applicable');
  if (applicable.length > 1) return { ...result, outcome: 'ambiguous' };
  // Excluded branches cannot block a candidate or contribute missing evidence.
  const missing = [...new Set(branches.flatMap(branch => branch.status === 'unknown' ? branch.missing : []))];
  if (missing.length) return { ...result, outcome: 'needs_evidence', missing };
  if (!need.controlRef || !need.subjectRef) return { ...result, outcome: 'unscoped' };
  const [candidate] = applicable;
  if (candidate) return { ...result, outcome: 'candidate', candidate };

  const fallback = evaluateBranch(graph.fallback, frame);
  const withFallback = { ...result, branches: [...branches, fallback] };
  if (fallback.status === 'applicable') return { ...withFallback, outcome: 'candidate', candidate: fallback };
  if (fallback.status === 'unknown') return { ...withFallback, outcome: 'needs_evidence', missing: fallback.missing };
  return { ...withFallback, outcome: 'uncovered' };
}
