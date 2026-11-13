import type { TemporalSelectionBridgeResult } from '../logos-engine/v6-temporal-selection-bridge.ts';
import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { AgentObservation } from './contracts.ts';
import { fingerprintAgentObservation } from './v6-temporal-decision-port.ts';
import type {
  PreparedTemporalActionWitness,
  TemporalActReleaseAuditResult,
} from './v6-temporal-act-release-audit.ts';
import {
  temporalPreparedActionBindingFingerprint,
  type TemporalPreparedActionBindingReceipt,
} from './v6-temporal-action-binding.ts';
import {
  temporalActionReleasePermitFingerprint,
  temporalAvailableActionRef,
  temporalConcentrationLeaseFingerprint,
  validateTemporalActionReleasePermitReceipt,
  type TemporalActionReleasePermitReceipt,
  type TemporalConcentrationLeaseReceipt,
} from './v6-temporal-action-release-permit.ts';

/**
 * Reconstructed ordinary ACT-consumption boundary.
 *
 * The durable V5 donors keep permission, ACT and environment dispatch separate.
 * This module consumes one already-qualified permit, revalidates the current
 * execution context, moves the lease from VALIDATED to RELEASED, and emits the
 * minimal ActOutput identity expected by the future environment boundary.
 * It never returns an AgentAction payload and never calls the environment.
 */

export const TEMPORAL_ACT_LEASE_TRANSITION_SCHEMA_VERSION =
  'sra.temporal_act_lease_transition.v1' as const;
export const TEMPORAL_ACT_TERMINAL_RECEIPT_SCHEMA_VERSION =
  'sra.temporal_act_terminal_receipt.v1' as const;
export const TEMPORAL_ACT_CONSUMPTION_JOURNAL_SCHEMA_VERSION =
  'sra.temporal_act_consumption_journal.v1' as const;

const DEFAULT_MAX_TERMINAL_RECEIPTS = 128;
const MAX_TERMINAL_RECEIPTS_LIMIT = 1024;

export type TemporalActCurrentLeaseState =
  | 'validated'
  | 'released'
  | 'invalidated'
  | 'expired';

export type TemporalActRevocationReason =
  | 'source_changed'
  | 'run_changed'
  | 'timeline_changed'
  | 'frame_changed'
  | 'state_revision_changed'
  | 'temporal_identity_changed'
  | 'observation_sequence_changed'
  | 'observation_snapshot_changed'
  | 'permit_not_canonical'
  | 'lease_not_canonical'
  | 'permit_expired'
  | 'lease_expired'
  | 'lease_not_validated'
  | 'action_unavailable'
  | 'support_withdrawn'
  | 'responsibility_not_current'
  | 'goal_consumption_not_current'
  | 'parent_continuation_not_current'
  | 'contribution_transport_not_current'
  | 'execution_context_not_current';

export interface TemporalActCurrentAuthority {
  actRequestRef: string;
  workflowRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  temporalIdentity: TemporalObservationIdentity;
  currentSnapshotDigest: string;
  currentAvailableActionRef: string;
  canonicalPermitFingerprint: string;
  canonicalLeaseFingerprint: string;
  currentLeaseState: TemporalActCurrentLeaseState;
  supportsWithdrawnRefs: readonly string[];
  sourceCurrent: boolean;
  responsibilityCurrent: boolean;
  goalConsumptionEvidenceCurrent: boolean;
  parentContinuationCurrent: boolean;
  contributionTransportCurrent: boolean;
  canonicalExecutionContextCurrent: boolean;
  reasoningContextRef: string;
  responsibilityRef: string;
  goalConsumptionEvidenceRef: string;
  parentContinuationRef: string;
  contributionTransportRef: string;
  canonicalExecutionContextRef: string;
  evidenceRefs: readonly string[];
}

export interface TemporalActOutput {
  outputKind: 'action_dispatch';
  actionRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  dispatchStatus: 'pending_environment_boundary';
}

export interface TemporalActLeaseTransitionReceipt {
  schemaVersion: typeof TEMPORAL_ACT_LEASE_TRANSITION_SCHEMA_VERSION;
  transitionRef: string;
  leaseRef: string;
  permitRef: string;
  actionIntentRef: string;
  workflowRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  fromState: 'validated';
  toState: 'released' | 'invalidated' | 'expired';
  reasonRef: string;
  evidenceRefs: readonly string[];
  transitionFingerprint: string;
}

interface TemporalActTerminalReceiptBase {
  schemaVersion: typeof TEMPORAL_ACT_TERMINAL_RECEIPT_SCHEMA_VERSION;
  receiptRef: string;
  permitRef: string;
  permitFingerprint: string;
  leaseRef: string;
  leaseFingerprint: string;
  intentRef: string;
  bindingRef: string;
  actionRef: string;
  workflowRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  temporalIdentity: TemporalObservationIdentity;
  leaseTransition: TemporalActLeaseTransitionReceipt;
  evidenceRefs: readonly string[];
  actionPayloadPresent: false;
  environmentDispatchAuthorized: false;
  permitReusable: false;
  actAuthorized: false;
  receiptFingerprint: string;
}

export interface TemporalActConsumedReceipt extends TemporalActTerminalReceiptBase {
  status: 'consumed';
  reason: 'act_release_consumed';
  permitConsumed: true;
  actCompleted: true;
  actionReleased: true;
  actOutput: TemporalActOutput;
}

export interface TemporalActRevokedReceipt extends TemporalActTerminalReceiptBase {
  status: 'revoked';
  reason: TemporalActRevocationReason;
  permitConsumed: false;
  actCompleted: false;
  actionReleased: false;
  actOutput: null;
}

export type TemporalActTerminalReceipt =
  | TemporalActConsumedReceipt
  | TemporalActRevokedReceipt;

type TemporalActTerminalReceiptWithoutFingerprint =
  TemporalActTerminalReceipt extends infer Receipt
    ? Receipt extends TemporalActTerminalReceipt
      ? Omit<Receipt, 'receiptFingerprint'>
      : never
    : never;

export interface TemporalActConsumptionJournal {
  schemaVersion: typeof TEMPORAL_ACT_CONSUMPTION_JOURNAL_SCHEMA_VERSION;
  maxTerminalReceipts: number;
  terminalReceipts: readonly TemporalActTerminalReceipt[];
}

export interface ConsumeTemporalActionReleasePermitInput {
  journal: TemporalActConsumptionJournal;
  projection: TemporalSelectionBridgeResult;
  witness: PreparedTemporalActionWitness;
  observation: AgentObservation;
  binding: TemporalPreparedActionBindingReceipt;
  audit: TemporalActReleaseAuditResult;
  permit: TemporalActionReleasePermitReceipt;
  currentAuthority: TemporalActCurrentAuthority;
}

export interface TemporalActConsumptionResult {
  journal: TemporalActConsumptionJournal;
  receipt: TemporalActTerminalReceipt;
  emittedActOutput: TemporalActOutput | null;
  reused: boolean;
}

function validRef(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validRevision(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validUniqueRefs(values: readonly string[], minimum = 1, maximum = 256): boolean {
  return values.length >= minimum
    && values.length <= maximum
    && values.every(validRef)
    && new Set(values).size === values.length;
}

function validOptionalUniqueRefs(values: readonly string[], maximum = 256): boolean {
  return values.length <= maximum
    && values.every(validRef)
    && new Set(values).size === values.length;
}

function canonicalRefs(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameIdentity(a: TemporalObservationIdentity, b: TemporalObservationIdentity): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fingerprint(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function bindingBase(
  binding: TemporalPreparedActionBindingReceipt,
): Omit<TemporalPreparedActionBindingReceipt, 'bindingFingerprint'> {
  const { bindingFingerprint: _ignored, ...base } = structuredClone(binding);
  return base;
}

function leaseBase(
  lease: TemporalConcentrationLeaseReceipt,
): Omit<TemporalConcentrationLeaseReceipt, 'leaseFingerprint'> {
  const { leaseFingerprint: _ignored, ...base } = structuredClone(lease);
  return base;
}

function permitBase(
  permit: TemporalActionReleasePermitReceipt,
): Omit<TemporalActionReleasePermitReceipt, 'permitFingerprint'> {
  const { permitFingerprint: _ignored, ...base } = structuredClone(permit);
  return base;
}

function transitionBase(
  transition: TemporalActLeaseTransitionReceipt,
): Omit<TemporalActLeaseTransitionReceipt, 'transitionFingerprint'> {
  const { transitionFingerprint: _ignored, ...base } = structuredClone(transition);
  return base;
}

function terminalReceiptBase(
  receipt: TemporalActTerminalReceipt,
): TemporalActTerminalReceiptWithoutFingerprint {
  const { receiptFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

export function temporalActLeaseTransitionFingerprint(
  transition: Omit<TemporalActLeaseTransitionReceipt, 'transitionFingerprint'>,
): string {
  return fingerprint({
    ...transition,
    evidenceRefs: canonicalRefs(transition.evidenceRefs),
  });
}

export function temporalActTerminalReceiptFingerprint(
  receipt: TemporalActTerminalReceiptWithoutFingerprint,
): string {
  return fingerprint({
    ...receipt,
    temporalIdentity: structuredClone(receipt.temporalIdentity),
    leaseTransition: {
      ...receipt.leaseTransition,
      evidenceRefs: canonicalRefs(receipt.leaseTransition.evidenceRefs),
    },
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

function validateStaticChain(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  binding: TemporalPreparedActionBindingReceipt,
  audit: TemporalActReleaseAuditResult,
  permit: TemporalActionReleasePermitReceipt,
): void {
  if (
    binding.bindingFingerprint
      !== temporalPreparedActionBindingFingerprint(bindingBase(binding))
  ) {
    throw new Error('prepared action binding fingerprint mismatch before ACT');
  }
  if (
    permit.concentrationLease.leaseFingerprint
      !== temporalConcentrationLeaseFingerprint(leaseBase(permit.concentrationLease))
  ) {
    throw new Error('concentration lease fingerprint mismatch before ACT');
  }
  if (
    permit.permitFingerprint
      !== temporalActionReleasePermitFingerprint(permitBase(permit))
  ) {
    throw new Error('ACT release permit fingerprint mismatch before consumption');
  }
  if (projection.decision.status !== 'accepted') {
    throw new Error('ACT consumption requires an accepted TemporalSelection decision');
  }
  if (
    projection.decision.selectedRef !== binding.selectedRef
    || projection.decisionRef !== binding.decisionFingerprint
    || witness.intentRef !== binding.intentRef
    || witness.selectedRef !== binding.selectedRef
    || witness.decisionFingerprint !== binding.decisionFingerprint
    || audit.status !== 'eligible'
    || audit.reason !== 'all_release_gates_satisfied'
    || !audit.releaseEligible
    || audit.intentRef !== binding.intentRef
    || audit.selectedRef !== binding.selectedRef
    || audit.decisionFingerprint !== binding.decisionFingerprint
  ) {
    throw new Error('ACT consumption static selection, intent or audit identity mismatch');
  }
  if (
    !sameIdentity(projection.state.identity, binding.temporalIdentity)
    || !sameIdentity(witness.identity, binding.temporalIdentity)
    || !sameIdentity(audit.identity, binding.temporalIdentity)
    || !sameIdentity(permit.temporalIdentity, binding.temporalIdentity)
  ) {
    throw new Error('ACT consumption static temporal identity mismatch');
  }
  if (
    permit.workflowRef !== binding.workflowRef
    || permit.sourceHash !== binding.sourceHash
    || permit.sessionId !== binding.sessionId
    || permit.observationSequence !== binding.observationSequence
    || permit.observationFingerprint !== binding.observationFingerprint
    || permit.intentRef !== binding.intentRef
    || permit.bindingRef !== binding.bindingFingerprint
    || permit.selectedRef !== binding.selectedRef
    || permit.decisionFingerprint !== binding.decisionFingerprint
    || permit.actionCandidateRef !== binding.actionCandidateRef
    || permit.targetRef !== binding.targetRef
    || permit.actionId !== binding.candidateAction.id
    || permit.concentrationLease.intentRef !== permit.intentRef
    || permit.concentrationLease.bindingRef !== permit.bindingRef
    || permit.concentrationLease.actionCandidateRef !== permit.actionCandidateRef
    || permit.concentrationLease.actionId !== permit.actionId
    || permit.concentrationLease.allowedActionRef !== permit.availableActionRef
  ) {
    throw new Error('ACT consumption static permit or lease lineage mismatch');
  }
  if (
    permit.actionPermitPresent !== true
    || permit.actionPayloadPresent !== false
    || permit.actionReleased !== false
    || permit.environmentDispatchAuthorized !== false
    || permit.actAuthorized !== true
    || permit.concentrationLease.state !== 'validated'
  ) {
    throw new Error('ACT consumption received a permit outside its pre-ACT boundary');
  }
}

function validateCurrentAuthorityShape(authority: TemporalActCurrentAuthority): void {
  if (
    !validRef(authority.actRequestRef)
    || !validRef(authority.workflowRef)
    || !validRef(authority.sourceHash)
    || !validRef(authority.runRef)
    || !validRef(authority.timelineRef)
    || !validRef(authority.frameRef)
    || !validRevision(authority.stateRevision)
    || !validRef(authority.currentSnapshotDigest)
    || !validRef(authority.currentAvailableActionRef)
    || !validRef(authority.canonicalPermitFingerprint)
    || !validRef(authority.canonicalLeaseFingerprint)
    || !validRef(authority.reasoningContextRef)
    || !validRef(authority.responsibilityRef)
    || !validRef(authority.goalConsumptionEvidenceRef)
    || !validRef(authority.parentContinuationRef)
    || !validRef(authority.contributionTransportRef)
    || !validRef(authority.canonicalExecutionContextRef)
    || !['validated', 'released', 'invalidated', 'expired'].includes(authority.currentLeaseState)
    || !validOptionalUniqueRefs(authority.supportsWithdrawnRefs)
    || !validUniqueRefs(authority.evidenceRefs)
    || [
      authority.sourceCurrent,
      authority.responsibilityCurrent,
      authority.goalConsumptionEvidenceCurrent,
      authority.parentContinuationCurrent,
      authority.contributionTransportCurrent,
      authority.canonicalExecutionContextCurrent,
    ].some(value => typeof value !== 'boolean')
  ) {
    throw new Error('ACT current authority identity or evidence domain is invalid');
  }
  const requiredEvidence = [
    authority.actRequestRef,
    authority.reasoningContextRef,
    authority.responsibilityRef,
    authority.goalConsumptionEvidenceRef,
    authority.parentContinuationRef,
    authority.contributionTransportRef,
    authority.canonicalExecutionContextRef,
    authority.canonicalPermitFingerprint,
    authority.canonicalLeaseFingerprint,
    authority.currentSnapshotDigest,
    authority.currentAvailableActionRef,
    ...authority.supportsWithdrawnRefs,
  ];
  if (requiredEvidence.some(ref => !authority.evidenceRefs.includes(ref))) {
    throw new Error('ACT current authority evidence is incomplete');
  }
}

function revocationReason(
  permit: TemporalActionReleasePermitReceipt,
  observation: AgentObservation,
  authority: TemporalActCurrentAuthority,
): TemporalActRevocationReason | null {
  if (
    !authority.sourceCurrent
    || authority.workflowRef !== permit.workflowRef
    || authority.sourceHash !== permit.sourceHash
  ) return 'source_changed';
  if (authority.runRef !== permit.sessionId || observation.sessionId !== permit.sessionId) {
    return 'run_changed';
  }
  if (authority.timelineRef !== permit.temporalIdentity.episodeId) {
    return 'timeline_changed';
  }
  if (authority.frameRef !== permit.temporalIdentity.observationId) {
    return 'frame_changed';
  }
  if (authority.stateRevision > permit.validThroughObservationRevision) {
    return 'permit_expired';
  }
  if (
    authority.currentLeaseState === 'expired'
    || authority.stateRevision > permit.concentrationLease.expiresAfterObservationRevision
  ) return 'lease_expired';
  if (
    authority.stateRevision !== permit.stateRevision
    || authority.stateRevision !== permit.temporalIdentity.observationRevision
  ) return 'state_revision_changed';
  if (!sameIdentity(authority.temporalIdentity, permit.temporalIdentity)) {
    return 'temporal_identity_changed';
  }
  if (observation.sequence !== permit.observationSequence) {
    return 'observation_sequence_changed';
  }
  const currentFingerprint = fingerprintAgentObservation(observation);
  if (
    observation.sessionId !== permit.sessionId
    || currentFingerprint !== permit.observationFingerprint
    || currentFingerprint !== permit.preActionSnapshotDigest
    || authority.currentSnapshotDigest !== currentFingerprint
  ) return 'observation_snapshot_changed';
  if (authority.canonicalPermitFingerprint !== permit.permitFingerprint) {
    return 'permit_not_canonical';
  }
  if (
    authority.canonicalLeaseFingerprint
      !== permit.concentrationLease.leaseFingerprint
  ) return 'lease_not_canonical';
  if (authority.currentLeaseState !== 'validated') {
    return 'lease_not_validated';
  }
  const availableActionRef = temporalAvailableActionRef(observation, permit.actionId);
  if (
    !observation.availableActionIds.includes(permit.actionId)
    || authority.currentAvailableActionRef !== availableActionRef
    || permit.availableActionRef !== availableActionRef
  ) return 'action_unavailable';
  if (authority.supportsWithdrawnRefs.length > 0) return 'support_withdrawn';
  if (!authority.responsibilityCurrent) return 'responsibility_not_current';
  if (!authority.goalConsumptionEvidenceCurrent) return 'goal_consumption_not_current';
  if (!authority.parentContinuationCurrent) return 'parent_continuation_not_current';
  if (!authority.contributionTransportCurrent) return 'contribution_transport_not_current';
  if (!authority.canonicalExecutionContextCurrent) return 'execution_context_not_current';
  return null;
}

function transitionReceipt(
  permit: TemporalActionReleasePermitReceipt,
  authority: TemporalActCurrentAuthority,
  toState: 'released' | 'invalidated' | 'expired',
  reasonRef: string,
  evidenceRefs: readonly string[],
): TemporalActLeaseTransitionReceipt {
  const base: Omit<TemporalActLeaseTransitionReceipt, 'transitionFingerprint'> = {
    schemaVersion: TEMPORAL_ACT_LEASE_TRANSITION_SCHEMA_VERSION,
    transitionRef: [
      'temporal-act-lease-transition',
      permit.concentrationLease.leaseRef,
      toState,
      permit.permitFingerprint,
    ].join(':'),
    leaseRef: permit.concentrationLease.leaseRef,
    permitRef: permit.permitRef,
    actionIntentRef: permit.intentRef,
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    runRef: authority.runRef,
    timelineRef: authority.timelineRef,
    frameRef: authority.frameRef,
    stateRevision: authority.stateRevision,
    fromState: 'validated',
    toState,
    reasonRef,
    evidenceRefs: canonicalRefs(evidenceRefs),
  };
  return {
    ...base,
    transitionFingerprint: temporalActLeaseTransitionFingerprint(base),
  };
}

function buildConsumedReceipt(
  permit: TemporalActionReleasePermitReceipt,
  authority: TemporalActCurrentAuthority,
): TemporalActConsumedReceipt {
  const actOutput: TemporalActOutput = {
    outputKind: 'action_dispatch',
    actionRef: permit.actionCandidateRef,
    actionIntentRef: permit.intentRef,
    actionReleasePermitRef: permit.permitRef,
    dispatchStatus: 'pending_environment_boundary',
  };
  const evidenceRefs = canonicalRefs([
    ...permit.evidenceRefs,
    ...authority.evidenceRefs,
    permit.permitFingerprint,
    permit.concentrationLease.leaseFingerprint,
    permit.bindingRef,
    permit.intentRef,
    permit.actionCandidateRef,
    permit.availableActionRef,
  ]);
  const transition = transitionReceipt(
    permit,
    authority,
    'released',
    permit.concentrationLease.srcDecisionRef,
    evidenceRefs,
  );
  const withoutFingerprint: Omit<TemporalActConsumedReceipt, 'receiptFingerprint'> = {
    schemaVersion: TEMPORAL_ACT_TERMINAL_RECEIPT_SCHEMA_VERSION,
    receiptRef: `temporal-act-consumed:${permit.permitFingerprint}`,
    status: 'consumed',
    reason: 'act_release_consumed',
    permitRef: permit.permitRef,
    permitFingerprint: permit.permitFingerprint,
    leaseRef: permit.concentrationLease.leaseRef,
    leaseFingerprint: permit.concentrationLease.leaseFingerprint,
    intentRef: permit.intentRef,
    bindingRef: permit.bindingRef,
    actionRef: permit.actionCandidateRef,
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    runRef: authority.runRef,
    timelineRef: authority.timelineRef,
    frameRef: authority.frameRef,
    stateRevision: authority.stateRevision,
    temporalIdentity: structuredClone(permit.temporalIdentity),
    leaseTransition: transition,
    evidenceRefs,
    permitConsumed: true,
    permitReusable: false,
    actCompleted: true,
    actionPayloadPresent: false,
    actionReleased: true,
    environmentDispatchAuthorized: false,
    actAuthorized: false,
    actOutput,
  };
  return {
    ...withoutFingerprint,
    receiptFingerprint: temporalActTerminalReceiptFingerprint(withoutFingerprint),
  };
}

function buildRevokedReceipt(
  permit: TemporalActionReleasePermitReceipt,
  authority: TemporalActCurrentAuthority,
  reason: TemporalActRevocationReason,
): TemporalActRevokedReceipt {
  const terminalState = reason === 'permit_expired' || reason === 'lease_expired'
    ? 'expired'
    : 'invalidated';
  const reasonRef = `act.revoked.${reason}`;
  const evidenceRefs = canonicalRefs([
    ...permit.evidenceRefs,
    ...authority.evidenceRefs,
    ...authority.supportsWithdrawnRefs,
    permit.permitFingerprint,
    permit.concentrationLease.leaseFingerprint,
    reasonRef,
  ]);
  const transition = transitionReceipt(
    permit,
    authority,
    terminalState,
    reasonRef,
    evidenceRefs,
  );
  const withoutFingerprint: Omit<TemporalActRevokedReceipt, 'receiptFingerprint'> = {
    schemaVersion: TEMPORAL_ACT_TERMINAL_RECEIPT_SCHEMA_VERSION,
    receiptRef: `temporal-act-revoked:${permit.permitFingerprint}:${reason}`,
    status: 'revoked',
    reason,
    permitRef: permit.permitRef,
    permitFingerprint: permit.permitFingerprint,
    leaseRef: permit.concentrationLease.leaseRef,
    leaseFingerprint: permit.concentrationLease.leaseFingerprint,
    intentRef: permit.intentRef,
    bindingRef: permit.bindingRef,
    actionRef: permit.actionCandidateRef,
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    runRef: authority.runRef,
    timelineRef: authority.timelineRef,
    frameRef: authority.frameRef,
    stateRevision: authority.stateRevision,
    temporalIdentity: structuredClone(permit.temporalIdentity),
    leaseTransition: transition,
    evidenceRefs,
    permitConsumed: false,
    permitReusable: false,
    actCompleted: false,
    actionPayloadPresent: false,
    actionReleased: false,
    environmentDispatchAuthorized: false,
    actAuthorized: false,
    actOutput: null,
  };
  return {
    ...withoutFingerprint,
    receiptFingerprint: temporalActTerminalReceiptFingerprint(withoutFingerprint),
  };
}

function validateTransition(transition: TemporalActLeaseTransitionReceipt): void {
  if (
    transition.schemaVersion !== TEMPORAL_ACT_LEASE_TRANSITION_SCHEMA_VERSION
    || !validRef(transition.transitionRef)
    || !validRef(transition.leaseRef)
    || !validRef(transition.permitRef)
    || !validRef(transition.actionIntentRef)
    || !validRef(transition.workflowRef)
    || !validRef(transition.sourceHash)
    || !validRef(transition.runRef)
    || !validRef(transition.timelineRef)
    || !validRef(transition.frameRef)
    || !validRevision(transition.stateRevision)
    || transition.fromState !== 'validated'
    || !['released', 'invalidated', 'expired'].includes(transition.toState)
    || !validRef(transition.reasonRef)
    || !validUniqueRefs(transition.evidenceRefs)
  ) {
    throw new Error('temporal ACT lease transition is invalid');
  }
  if (
    transition.transitionFingerprint
      !== temporalActLeaseTransitionFingerprint(transitionBase(transition))
  ) {
    throw new Error('temporal ACT lease transition fingerprint mismatch');
  }
}

function validateTerminalReceipt(receipt: TemporalActTerminalReceipt): void {
  validateTransition(receipt.leaseTransition);
  if (
    receipt.schemaVersion !== TEMPORAL_ACT_TERMINAL_RECEIPT_SCHEMA_VERSION
    || !validRef(receipt.receiptRef)
    || !validRef(receipt.permitRef)
    || !validRef(receipt.permitFingerprint)
    || !validRef(receipt.leaseRef)
    || !validRef(receipt.leaseFingerprint)
    || !validRef(receipt.intentRef)
    || !validRef(receipt.bindingRef)
    || !validRef(receipt.actionRef)
    || !validRef(receipt.workflowRef)
    || !validRef(receipt.sourceHash)
    || !validRef(receipt.runRef)
    || !validRef(receipt.timelineRef)
    || !validRef(receipt.frameRef)
    || !validRevision(receipt.stateRevision)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.actionPayloadPresent !== false
    || receipt.environmentDispatchAuthorized !== false
    || receipt.permitReusable !== false
    || receipt.actAuthorized !== false
  ) {
    throw new Error('temporal ACT terminal receipt is invalid');
  }
  if (
    receipt.leaseTransition.leaseRef !== receipt.leaseRef
    || receipt.leaseTransition.permitRef !== receipt.permitRef
    || receipt.leaseTransition.actionIntentRef !== receipt.intentRef
    || receipt.leaseTransition.workflowRef !== receipt.workflowRef
    || receipt.leaseTransition.sourceHash !== receipt.sourceHash
    || receipt.leaseTransition.runRef !== receipt.runRef
    || receipt.leaseTransition.timelineRef !== receipt.timelineRef
    || receipt.leaseTransition.frameRef !== receipt.frameRef
    || receipt.leaseTransition.stateRevision !== receipt.stateRevision
  ) {
    throw new Error('temporal ACT terminal receipt transition lineage mismatch');
  }
  if (receipt.status === 'consumed') {
    if (
      receipt.reason !== 'act_release_consumed'
      || receipt.permitConsumed !== true
      || receipt.actCompleted !== true
      || receipt.actionReleased !== true
      || receipt.leaseTransition.toState !== 'released'
      || receipt.actOutput.outputKind !== 'action_dispatch'
      || receipt.actOutput.actionRef !== receipt.actionRef
      || receipt.actOutput.actionIntentRef !== receipt.intentRef
      || receipt.actOutput.actionReleasePermitRef !== receipt.permitRef
      || receipt.actOutput.dispatchStatus !== 'pending_environment_boundary'
    ) {
      throw new Error('consumed temporal ACT receipt is inconsistent');
    }
  } else if (
    receipt.permitConsumed !== false
    || receipt.actCompleted !== false
    || receipt.actionReleased !== false
    || receipt.actOutput !== null
    || !['invalidated', 'expired'].includes(receipt.leaseTransition.toState)
  ) {
    throw new Error('revoked temporal ACT receipt is inconsistent');
  }
  if (
    receipt.receiptFingerprint
      !== temporalActTerminalReceiptFingerprint(terminalReceiptBase(receipt))
  ) {
    throw new Error('temporal ACT terminal receipt fingerprint mismatch');
  }
}

function validateJournal(journal: TemporalActConsumptionJournal): void {
  if (
    journal.schemaVersion !== TEMPORAL_ACT_CONSUMPTION_JOURNAL_SCHEMA_VERSION
    || !Number.isInteger(journal.maxTerminalReceipts)
    || journal.maxTerminalReceipts < 1
    || journal.maxTerminalReceipts > MAX_TERMINAL_RECEIPTS_LIMIT
    || journal.terminalReceipts.length > journal.maxTerminalReceipts
  ) {
    throw new Error('temporal ACT consumption journal envelope is invalid');
  }
  const permitRefs = new Set<string>();
  const permitFingerprints = new Set<string>();
  const receiptRefs = new Set<string>();
  for (const receipt of journal.terminalReceipts) {
    validateTerminalReceipt(receipt);
    if (
      permitRefs.has(receipt.permitRef)
      || permitFingerprints.has(receipt.permitFingerprint)
      || receiptRefs.has(receipt.receiptRef)
    ) {
      throw new Error('temporal ACT consumption journal contains duplicate terminal identity');
    }
    permitRefs.add(receipt.permitRef);
    permitFingerprints.add(receipt.permitFingerprint);
    receiptRefs.add(receipt.receiptRef);
  }
}

export function createTemporalActConsumptionJournal(
  maxTerminalReceipts = DEFAULT_MAX_TERMINAL_RECEIPTS,
): TemporalActConsumptionJournal {
  const journal: TemporalActConsumptionJournal = {
    schemaVersion: TEMPORAL_ACT_CONSUMPTION_JOURNAL_SCHEMA_VERSION,
    maxTerminalReceipts,
    terminalReceipts: [],
  };
  validateJournal(journal);
  return journal;
}

export function restoreTemporalActConsumptionJournal(
  snapshot: TemporalActConsumptionJournal,
): TemporalActConsumptionJournal {
  const restored = structuredClone(snapshot);
  validateJournal(restored);
  return restored;
}

function appendTerminalReceipt(
  journal: TemporalActConsumptionJournal,
  receipt: TemporalActTerminalReceipt,
): TemporalActConsumptionJournal {
  if (journal.terminalReceipts.length >= journal.maxTerminalReceipts) {
    throw new Error('temporal ACT consumption journal capacity reached');
  }
  const next: TemporalActConsumptionJournal = {
    ...structuredClone(journal),
    terminalReceipts: [...journal.terminalReceipts.map(item => structuredClone(item)), receipt],
  };
  validateJournal(next);
  return next;
}

export function consumeTemporalActionReleasePermit(
  input: ConsumeTemporalActionReleasePermitInput,
): TemporalActConsumptionResult {
  validateJournal(input.journal);
  validateStaticChain(
    input.projection,
    input.witness,
    input.binding,
    input.audit,
    input.permit,
  );
  validateCurrentAuthorityShape(input.currentAuthority);

  const existingByRef = input.journal.terminalReceipts.find(
    receipt => receipt.permitRef === input.permit.permitRef,
  );
  if (existingByRef) {
    if (existingByRef.permitFingerprint !== input.permit.permitFingerprint) {
      throw new Error('temporal ACT permit identity conflicts with an existing terminal receipt');
    }
    return {
      journal: structuredClone(input.journal),
      receipt: structuredClone(existingByRef),
      emittedActOutput: null,
      reused: true,
    };
  }
  const existingByFingerprint = input.journal.terminalReceipts.find(
    receipt => receipt.permitFingerprint === input.permit.permitFingerprint,
  );
  if (existingByFingerprint) {
    throw new Error('temporal ACT permit fingerprint belongs to another terminal identity');
  }

  const reason = revocationReason(
    input.permit,
    input.observation,
    input.currentAuthority,
  );
  if (reason) {
    const receipt = buildRevokedReceipt(
      input.permit,
      input.currentAuthority,
      reason,
    );
    const journal = appendTerminalReceipt(input.journal, receipt);
    return {
      journal,
      receipt: structuredClone(receipt),
      emittedActOutput: null,
      reused: false,
    };
  }

  validateTemporalActionReleasePermitReceipt(
    input.permit,
    input.projection,
    input.witness,
    input.observation,
    input.binding,
    input.audit,
  );
  const receipt = buildConsumedReceipt(input.permit, input.currentAuthority);
  const journal = appendTerminalReceipt(input.journal, receipt);
  return {
    journal,
    receipt: structuredClone(receipt),
    emittedActOutput: structuredClone(receipt.actOutput),
    reused: false,
  };
}
