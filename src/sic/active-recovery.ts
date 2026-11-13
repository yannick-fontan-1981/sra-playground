import { symbolicDigest } from '../logos-engine/v6-hash.ts';

/** Validated settings for the contact-recovery capability. */
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
  needKind: 'restore_rooted_contact_projection',
  need: 'Restore a projection that accounts for the contact chain',
  objective: { id: 'find_ordered_contact_access', label: 'Find an access that puts the pieces in the reference order' },
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

export interface ContactRecoveryNeed {
  readonly id: string;
  readonly kind: typeof rootedRecoveryStrategy.needKind;
  readonly subject: string;
  readonly scope: string;
  readonly parentObjective: 'G_official_completion';
  readonly satisfactionContract: 'official_progress_under_guarded_access';
  readonly evidence: readonly [string, string];
  readonly status: 'admitted' | 'assigned' | 'satisfied' | 'refuted' | 'expired';
  readonly outcomeRef?: string;
}

function readObservationRef(value: string) {
  const match = /^(.+:epoch:[1-9]\d*):revision:([1-9]\d*):frame:.+$/.exec(value);
  if (!match) return null;
  const revision = Number(match[2]);
  return Number.isSafeInteger(revision) ? { scope: match[1], revision } : null;
}

export function admitContactRecoveryNeed(witness: ReturnWitness, layout: string): ContactRecoveryNeed | null {
  const before = readObservationRef(witness.before), after = readObservationRef(witness.after);
  if (!before || !after || before.scope !== after.scope || before.revision + 1 !== after.revision
    || !layout || witness.layout !== layout || witness.cell_push_witness !== true) return null;
  const parentObjective = 'G_official_completion', satisfactionContract = 'official_progress_under_guarded_access';
  return {
    id: 'sic-need:' + symbolicDigest([rootedRecoveryStrategy.needKind, [layout], after.scope, satisfactionContract, parentObjective, witness.after]),
    kind: rootedRecoveryStrategy.needKind, subject: layout, scope: after.scope, parentObjective, satisfactionContract,
    evidence: [witness.before, witness.after], status: 'admitted',
  };
}

export function selectRootedRecovery(pack: RecoveryPack, refutations: readonly ReturnWitness[], layout: string, observationRef: string,
  retained?: ContactRecoveryNeed) {
  const [witness] = refutations;
  if (!witness) return { status: 'unneeded' } as const;
  const need = admitContactRecoveryNeed(witness, layout);
  const current = readObservationRef(observationRef), after = readObservationRef(witness.after);
  const applicable = refutations.length === 1 && need && current && after
    && need.scope === current.scope && after.revision <= current.revision;
  if (!applicable) return { status: 'unresolved' } as const;
  if (retained?.id === need.id && retained.status !== 'admitted' && retained.status !== 'assigned') return { status: 'unresolved' } as const;
  return {
    status: pack.mode === 'active' ? 'selected' : 'shadow',
    strategy: rootedRecoveryStrategy.id, needId: need.id, evidence: need.evidence, configuration: pack,
  } as const;
}
