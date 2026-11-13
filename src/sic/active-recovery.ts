import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { evaluateStrategyGuards, type StrategyFact, type StrategyGuard } from './strategy-agenda.ts';

export const contactRecoveryStrategies = Object.freeze({
  revise_rooted_contact: 'Revise the contact projection',
  reposition_root_before_contact: 'Reposition the root before aligning the pieces',
});
export type ContactStrategy = keyof typeof contactRecoveryStrategies;
export const contactRecoveryOrder = Object.freeze(['revise_rooted_contact', 'reposition_root_before_contact'] as const);

export function isContactStrategy(input: unknown): input is ContactStrategy {
  return typeof input === 'string' && Object.hasOwn(contactRecoveryStrategies, input);
}

/** Validated settings for the contact-recovery capability. */
export interface RecoveryPack {
  readonly version: 1;
  readonly mode: 'active' | 'shadow';
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly strategyOrder?: readonly ContactStrategy[];
}

export const defaultRecoveryPack: RecoveryPack = Object.freeze({
  version: 1, mode: 'active', maxDepth: 88, maxNodes: 1000,
});

export function compileRecoveryPack(input: unknown = defaultRecoveryPack): RecoveryPack {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected a recovery configuration.');
  const fields = Object.keys(input).sort().join(',');
  if (fields !== 'maxDepth,maxNodes,mode,version' && fields !== 'maxDepth,maxNodes,mode,strategyOrder,version') {
    throw new TypeError('Recovery configuration accepts version, mode, maxDepth, maxNodes and optional strategyOrder.');
  }
  const pack = input as Record<string, unknown>;
  if (pack.version !== 1) throw new TypeError('Unsupported recovery configuration version.');
  if (pack.mode !== 'active' && pack.mode !== 'shadow') throw new TypeError('Recovery mode must be active or shadow.');
  const bounded = (value: unknown, maximum: number): value is number =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= maximum;
  if (!bounded(pack.maxDepth, defaultRecoveryPack.maxDepth) || !bounded(pack.maxNodes, defaultRecoveryPack.maxNodes)) {
    throw new RangeError('Recovery limits must be 1–88 moves and 1–1000 states.');
  }
  const order = pack.strategyOrder;
  if (Object.hasOwn(pack, 'strategyOrder') && (!Array.isArray(order) || order.length !== contactRecoveryOrder.length
    || !contactRecoveryOrder.every(id => order.includes(id)))) {
    throw new TypeError('Recovery strategy order must contain each registered strategy exactly once.');
  }
  return Object.freeze({ version: 1, mode: pack.mode, maxDepth: pack.maxDepth, maxNodes: pack.maxNodes,
    ...(Array.isArray(order) && order[0] !== contactRecoveryOrder[0] ? { strategyOrder: Object.freeze([...order]) } : {}) });
}

export const rootedRecoveryStrategy = Object.freeze({
  needKind: 'restore_rooted_contact_projection',
  need: 'Restore a projection that accounts for the contact chain',
  objective: { id: 'find_ordered_contact_access', label: 'Find an access that puts the pieces in the reference order' },
});

type ContactFact = 'wholeCellContact' | 'availableRootTranslation' | 'alreadyAssigned';
export const contactRecoveryGraph = Object.freeze({
  id: 'rooted-contact-access',
  version: 1,
  order: 'FALLBACK',
  strategies: {
    revise_rooted_contact: [
      { fact: 'wholeCellContact', expected: true, label: 'Whole-cell contact witnessed in the current layout' },
    ],
    reposition_root_before_contact: [
      { fact: 'wholeCellContact', expected: true, label: 'Whole-cell contact witnessed in the current layout' },
      { fact: 'alreadyAssigned', expected: false, label: 'No checked recovery step yet' },
      { fact: 'availableRootTranslation', expected: true, label: 'A measured root translation is available' },
    ],
  } satisfies Record<ContactStrategy, readonly [StrategyGuard<ContactFact>, ...StrategyGuard<ContactFact>[]]>,
});

export function contactSituation(choice: { needId: string; evidence: readonly [string, string]; assignmentRef: string | null },
  observationRef: string, observedTranslations: readonly string[]) {
  const facts: Record<ContactFact, StrategyFact> = {
    wholeCellContact: { value: true, evidence: choice.evidence },
    alreadyAssigned: choice.assignmentRef ? { value: true, evidence: [choice.assignmentRef] }
      : { value: false, evidence: [observationRef, ...choice.evidence] },
    availableRootTranslation: observedTranslations.length
      ? { value: true, evidence: [observationRef, ...new Set(observedTranslations)] } : { value: 'unknown' },
  };
  return { id: 'sic-situation:' + symbolicDigest([contactRecoveryGraph.id, choice.needId]), revision: observationRef, facts };
}

export function evaluateContactStrategy(id: ContactStrategy, situation: ReturnType<typeof contactSituation>) {
  const guards = evaluateStrategyGuards<ContactFact>(situation.facts, contactRecoveryGraph.strategies[id]);
  return { id, applicability: guards.applicability, reason: guards.reason,
    evidence: [...new Set(guards.tested.flatMap(guard => guard.observed.value === 'unknown' ? [] : guard.observed.evidence))] };
}

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
  const scope = match?.[1];
  const revision = Number(match?.[2]);
  return scope && Number.isSafeInteger(revision) ? { scope, revision } : null;
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
    needId: need.id, evidence: need.evidence, configuration: pack,
    assignmentRef: retained?.id === need.id && retained.status === 'assigned' ? retained.outcomeRef ?? observationRef : null,
  } as const;
}
