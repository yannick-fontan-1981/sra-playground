/** The first executable SIC capability. Configuration cannot supply actions or evidence. */
export interface RecoveryPack {
  readonly version: 1;
  readonly mode: 'active' | 'shadow';
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export const defaultRecoveryPack: RecoveryPack = Object.freeze({
  version: 1, mode: 'active', maxDepth: 88, maxNodes: 1000,
});

export function compileRecoveryPack(input: unknown = defaultRecoveryPack): RecoveryPack {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).sort().join(',') !== 'maxDepth,maxNodes,mode,version') {
    throw new TypeError('Recovery configuration requires version, mode, maxDepth and maxNodes.');
  }
  const pack = input as Record<string, unknown>;
  if (pack.version !== 1) throw new TypeError('Unsupported recovery configuration version.');
  if (pack.mode !== 'active' && pack.mode !== 'shadow') throw new TypeError('Recovery mode must be active or shadow.');
  const bounded = (value: unknown, maximum: number): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= maximum;
  if (!bounded(pack.maxDepth, defaultRecoveryPack.maxDepth) || !bounded(pack.maxNodes, defaultRecoveryPack.maxNodes)) {
    throw new RangeError('Recovery limits must be 1–88 moves and 1–1000 states.');
  }
  return Object.freeze({ version: 1, mode: pack.mode, maxDepth: pack.maxDepth, maxNodes: pack.maxNodes });
}

export const rootedRecoveryStrategy = Object.freeze({
  id: 'revise_rooted_contact',
  label: 'Revise the contact projection',
  need: 'Restore a projection that accounts for the contact chain',
  objective: 'Find an access that puts the pieces in the reference order',
});

export function isRecoveryStop(reason: unknown): reason is 'sic_recovery_shadow' | 'rooted_cell_access_unresolved' {
  return reason === 'sic_recovery_shadow' || reason === 'rooted_cell_access_unresolved';
}

type ReturnWitness = {
  readonly before: string;
  readonly after: string;
  readonly cell_push_witness?: boolean;
  readonly layout?: string;
};

function readObservationRef(value: string) {
  const match = /^(.+:epoch:[1-9]\d*):revision:([1-9]\d*):frame:.+$/.exec(value);
  if (!match) return null;
  const revision = Number(match[2]);
  return Number.isSafeInteger(revision) ? { scope: match[1], revision } : null;
}

export function selectRootedRecovery(pack: RecoveryPack, refutations: readonly ReturnWitness[], layout: string, observationRef: string) {
  const [witness] = refutations;
  if (!witness) return { status: 'unneeded' } as const;
  const current = readObservationRef(observationRef), before = readObservationRef(witness.before), after = readObservationRef(witness.after);
  const applicable = refutations.length === 1 && witness.cell_push_witness === true && witness.layout === layout
    && current && before && after && before.scope === current.scope && after.scope === current.scope
    && before.revision + 1 === after.revision && after.revision <= current.revision;
  if (!applicable) return { status: 'unresolved' } as const;
  const needId = JSON.stringify([rootedRecoveryStrategy.id, current.scope, witness.after]);
  const evidence = [witness.before, witness.after];
  return {
    status: pack.mode === 'active' ? 'selected' : 'shadow',
    strategy: rootedRecoveryStrategy.id, needId, evidence, configuration: pack,
  } as const;
}
