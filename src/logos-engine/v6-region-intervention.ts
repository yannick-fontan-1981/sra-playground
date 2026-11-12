export interface RegionInterventionObservation {
  methodRef: string;
  separatorRef: string;
  actionRef: string;
  affectedRegions: readonly string[];
  effectKey: string;
  levelEpoch: string | number;
  observationRevision: number;
}

export interface RegionInterventionCandidate {
  methodRef: string;
  separatorRef: string;
  availableActions: readonly string[];
  levelEpoch: string | number;
}

export interface RegionInterventionProposal {
  methodRef: string;
  separatorRef: string;
  actionRef: string;
  expectedEffectKey: string;
  expectedAffectedRegions: readonly string[];
  evidenceCount: number;
}

interface RegionEvidenceRecord {
  separatorRef: string;
  actionRef: string;
  affectedRegions: string[];
  effectKey: string;
  levelEpoch: string | number;
  observationRevision: number;
}

interface LearnedRegionMethod {
  methodRef: string;
  actionRef: string;
  affectedRegions: string[];
  effectKey: string;
  levelEpoch: string | number;
  lastRevision: number;
  contradicted: boolean;
  evidence: RegionEvidenceRecord[];
  contradictions: RegionEvidenceRecord[];
}

export interface RegionInterventionSnapshot {
  version: 1;
  methods: Array<{
    methodRef: string;
    actionRef: string;
    affectedRegions: string[];
    effectKey: string;
    levelEpoch: string | number;
    lastRevision: number;
    contradicted: boolean;
    evidence: RegionEvidenceRecord[];
    contradictions: RegionEvidenceRecord[];
  }>;
}

const MAX_METHODS = 128;
const MAX_EVIDENCE_PER_METHOD = 32;
const MAX_AFFECTED_REGIONS = 256;

function assertNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

function normalizedRegions(regions: readonly string[]): string[] {
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new RangeError('affectedRegions must contain at least one region');
  }
  if (regions.length > MAX_AFFECTED_REGIONS) {
    throw new RangeError(`affectedRegions exceeds ${MAX_AFFECTED_REGIONS}`);
  }
  const unique = new Set<string>();
  for (const region of regions) {
    assertNonEmpty(region, 'affected region');
    unique.add(region);
  }
  return [...unique].sort();
}

function sameRegions(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function cloneRecord(record: RegionEvidenceRecord): RegionEvidenceRecord {
  return {
    ...record,
    affectedRegions: [...record.affectedRegions],
  };
}

function validateObservation(input: RegionInterventionObservation): RegionEvidenceRecord {
  assertNonEmpty(input.methodRef, 'methodRef');
  assertNonEmpty(input.separatorRef, 'separatorRef');
  assertNonEmpty(input.actionRef, 'actionRef');
  assertNonEmpty(input.effectKey, 'effectKey');
  if (!Number.isInteger(input.observationRevision) || input.observationRevision < 0) {
    throw new RangeError('observationRevision must be a non-negative integer');
  }
  if (
    typeof input.levelEpoch !== 'string'
    && typeof input.levelEpoch !== 'number'
  ) {
    throw new TypeError('levelEpoch must be a string or number');
  }
  return {
    separatorRef: input.separatorRef,
    actionRef: input.actionRef,
    affectedRegions: normalizedRegions(input.affectedRegions),
    effectKey: input.effectKey,
    levelEpoch: input.levelEpoch,
    observationRevision: input.observationRevision,
  };
}

function validateMethod(method: LearnedRegionMethod): void {
  assertNonEmpty(method.methodRef, 'methodRef');
  assertNonEmpty(method.actionRef, 'actionRef');
  assertNonEmpty(method.effectKey, 'effectKey');
  normalizedRegions(method.affectedRegions);
  if (!Number.isInteger(method.lastRevision) || method.lastRevision < 0) {
    throw new RangeError('lastRevision must be a non-negative integer');
  }
  if (method.evidence.length > MAX_EVIDENCE_PER_METHOD) {
    throw new RangeError('too many evidence records');
  }
  if (method.contradictions.length > MAX_EVIDENCE_PER_METHOD) {
    throw new RangeError('too many contradiction records');
  }
}

export class RegionInterventionModel {
  readonly #methods = new Map<string, LearnedRegionMethod>();

  observe(input: RegionInterventionObservation): {
    status: 'learned' | 'confirmed' | 'contradicted' | 'stale';
    methodRef: string;
  } {
    const record = validateObservation(input);
    const current = this.#methods.get(input.methodRef);

    if (!current) {
      if (this.#methods.size >= MAX_METHODS) {
        throw new RangeError(`Region method count exceeds ${MAX_METHODS}`);
      }
      this.#methods.set(input.methodRef, {
        methodRef: input.methodRef,
        actionRef: record.actionRef,
        affectedRegions: [...record.affectedRegions],
        effectKey: record.effectKey,
        levelEpoch: record.levelEpoch,
        lastRevision: record.observationRevision,
        contradicted: false,
        evidence: [cloneRecord(record)],
        contradictions: [],
      });
      return { status: 'learned', methodRef: input.methodRef };
    }

    if (record.observationRevision < current.lastRevision) {
      return { status: 'stale', methodRef: input.methodRef };
    }

    const agrees = (
      current.actionRef === record.actionRef
      && current.effectKey === record.effectKey
      && current.levelEpoch === record.levelEpoch
      && sameRegions(current.affectedRegions, record.affectedRegions)
    );

    current.lastRevision = record.observationRevision;

    if (!agrees) {
      if (current.contradictions.length >= MAX_EVIDENCE_PER_METHOD) {
        throw new RangeError('too many contradiction records');
      }
      current.contradicted = true;
      current.contradictions.push(cloneRecord(record));
      return { status: 'contradicted', methodRef: input.methodRef };
    }

    if (current.evidence.length >= MAX_EVIDENCE_PER_METHOD) {
      throw new RangeError('too many evidence records');
    }
    current.evidence.push(cloneRecord(record));
    return { status: 'confirmed', methodRef: input.methodRef };
  }

  propose(candidate: RegionInterventionCandidate): RegionInterventionProposal | undefined {
    assertNonEmpty(candidate.methodRef, 'methodRef');
    assertNonEmpty(candidate.separatorRef, 'separatorRef');
    if (!Array.isArray(candidate.availableActions)) {
      throw new TypeError('availableActions must be an array');
    }
    const method = this.#methods.get(candidate.methodRef);
    if (!method || method.contradicted) return undefined;
    if (method.levelEpoch !== candidate.levelEpoch) return undefined;
    if (!candidate.availableActions.includes(method.actionRef)) return undefined;
    if (method.evidence.some(record => record.separatorRef === candidate.separatorRef)) return undefined;
    return {
      methodRef: method.methodRef,
      separatorRef: candidate.separatorRef,
      actionRef: method.actionRef,
      expectedEffectKey: method.effectKey,
      expectedAffectedRegions: [...method.affectedRegions],
      evidenceCount: method.evidence.length,
    };
  }

  get(methodRef: string): Readonly<LearnedRegionMethod> | undefined {
    const method = this.#methods.get(methodRef);
    return method ? structuredClone(method) : undefined;
  }

  snapshot(): RegionInterventionSnapshot {
    return {
      version: 1,
      methods: [...this.#methods.values()]
        .sort((a, b) => a.methodRef.localeCompare(b.methodRef))
        .map(method => structuredClone(method)),
    };
  }

  restore(snapshot: RegionInterventionSnapshot): void {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.methods)) {
      throw new TypeError('invalid RegionIntervention snapshot');
    }
    if (snapshot.methods.length > MAX_METHODS) {
      throw new RangeError('too many methods in snapshot');
    }
    const restored = new Map<string, LearnedRegionMethod>();
    for (const raw of snapshot.methods) {
      const method = structuredClone(raw) as LearnedRegionMethod;
      validateMethod(method);
      if (restored.has(method.methodRef)) {
        throw new Error(`duplicate Region method ${method.methodRef}`);
      }
      for (const record of [...method.evidence, ...method.contradictions]) {
        validateObservation({
          methodRef: method.methodRef,
          separatorRef: record.separatorRef,
          actionRef: record.actionRef,
          affectedRegions: record.affectedRegions,
          effectKey: record.effectKey,
          levelEpoch: record.levelEpoch,
          observationRevision: record.observationRevision,
        });
      }
      restored.set(method.methodRef, method);
    }
    this.#methods.clear();
    for (const [key, value] of restored) this.#methods.set(key, value);
  }

  get size(): number {
    return this.#methods.size;
  }
}

export const REGION_INTERVENTION_LIMITS = Object.freeze({
  maxMethods: MAX_METHODS,
  maxEvidencePerMethod: MAX_EVIDENCE_PER_METHOD,
  maxAffectedRegions: MAX_AFFECTED_REGIONS,
});
