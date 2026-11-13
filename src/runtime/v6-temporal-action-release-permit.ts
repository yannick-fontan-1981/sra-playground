import type { TemporalSelectionBridgeResult } from '../logos-engine/v6-temporal-selection-bridge.ts';
import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { ActionId, AgentObservation } from './contracts.ts';
import { fingerprintAgentObservation } from './v6-temporal-decision-port.ts';
import type {
  PreparedTemporalActionWitness,
  TemporalActReleaseAuditResult,
} from './v6-temporal-act-release-audit.ts';
import {
  validateTemporalPreparedActionBindingReceipt,
  type TemporalPreparedActionBindingReceipt,
} from './v6-temporal-action-binding.ts';

/**
 * Reconstructed ordinary single-action permit boundary.
 *
 * Durable V5 donors keep ActionIntent, ActionReleasePermit, ACT and the
 * environment boundary separate. This module reconstructs only the permit
 * carried by a validated concentration lease. It never returns the AgentAction
 * payload and never authorizes environment dispatch.
 */

export const TEMPORAL_CONCENTRATION_LEASE_SCHEMA_VERSION =
  'sra.temporal_concentration_lease.v1' as const;
export const TEMPORAL_ACTION_RELEASE_PERMIT_SCHEMA_VERSION =
  'sra.temporal_action_release_permit.v1' as const;

export interface TemporalConcentrationLeaseAuthority {
  leaseRef: string;
  drmDecisionRef: string;
  srcDecisionRef: string;
  acquisitionReasonRef: string;
  genericPrincipleRef: string;
  expectedEffectRef: string;
  premiseEvidenceRefs: readonly string[];
  falsifierRefs: readonly string[];
  evidenceRefs: readonly string[];
  expiresAfterObservationRevision: number;
}

export interface TemporalConcentrationLeaseReceipt {
  schemaVersion: typeof TEMPORAL_CONCENTRATION_LEASE_SCHEMA_VERSION;
  leaseRef: string;
  workflowRef: string;
  sourceHash: string;
  sessionId: string;
  observationSequence: number;
  observationFingerprint: string;
  temporalIdentity: TemporalObservationIdentity;
  frameRevision: number;
  contractRevision: number;
  intentRef: string;
  bindingRef: string;
  actionCandidateRef: string;
  allowedActionRef: string;
  actionId: ActionId;
  drmDecisionRef: string;
  srcDecisionRef: string;
  acquisitionReasonRef: string;
  genericPrincipleRef: string;
  expectedEffectRef: string;
  premiseEvidenceRefs: readonly string[];
  falsifierRefs: readonly string[];
  evidenceRefs: readonly string[];
  state: 'validated';
  expiresAfterObservationRevision: number;
  leaseFingerprint: string;
}

export interface TemporalActionReleasePermitAuthority {
  permitRef: string;
  viabilityAssessmentRef: string;
  commitmentDecisionRef: string;
  validThroughObservationRevision: number;
  evidenceRefs: readonly string[];
  concentrationLease: TemporalConcentrationLeaseAuthority;
}

export interface TemporalActionReleasePermitReceipt {
  schemaVersion: typeof TEMPORAL_ACTION_RELEASE_PERMIT_SCHEMA_VERSION;
  permitRef: string;
  workflowRef: string;
  sourceHash: string;
  sessionId: string;
  observationSequence: number;
  observationFingerprint: string;
  temporalIdentity: TemporalObservationIdentity;
  stateRevision: number;
  validThroughObservationRevision: number;
  intentRef: string;
  bindingRef: string;
  selectedRef: string;
  decisionFingerprint: string;
  actionCandidateRef: string;
  targetRef: string;
  actionId: ActionId;
  availableActionRef: string;
  preActionSnapshotDigest: string;
  viabilityAssessmentRef: string;
  commitmentDecisionRef: string;
  concentrationLease: TemporalConcentrationLeaseReceipt;
  evidenceRefs: readonly string[];
  declaredSeriesRef: null;
  declaredSeriesIntentRefs: readonly [];
  declaredSeriesActionRefs: readonly [];
  concentrationAcquisitionDeferred: false;
  actionPermitPresent: true;
  actionPayloadPresent: false;
  actionReleased: false;
  environmentDispatchAuthorized: false;
  actAuthorized: true;
  permitFingerprint: string;
}

export interface TemporalActionReleasePermitProjection {
  status: 'permitted';
  permitRef: string;
  leaseRef: string;
  intentRef: string;
  bindingRef: string;
  selectedRef: string;
  decisionFingerprint: string;
  actionCandidateRef: string;
  targetRef: string;
  actionId: ActionId;
  availableActionRef: string;
  validThroughObservationRevision: number;
  evidenceRefs: readonly string[];
  actionPermitPresent: true;
  releaseEligible: true;
  actionPayloadPresent: false;
  actionReleased: false;
  environmentDispatchAuthorized: false;
  actAuthorized: true;
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

export function temporalAvailableActionRef(
  observation: AgentObservation,
  actionId: ActionId,
): string {
  return [
    'available-action',
    observation.sessionId,
    String(observation.sequence),
    String(actionId),
  ].join(':');
}

function leaseBase(
  lease: TemporalConcentrationLeaseReceipt,
): Omit<TemporalConcentrationLeaseReceipt, 'leaseFingerprint'> {
  return {
    schemaVersion: lease.schemaVersion,
    leaseRef: lease.leaseRef,
    workflowRef: lease.workflowRef,
    sourceHash: lease.sourceHash,
    sessionId: lease.sessionId,
    observationSequence: lease.observationSequence,
    observationFingerprint: lease.observationFingerprint,
    temporalIdentity: structuredClone(lease.temporalIdentity),
    frameRevision: lease.frameRevision,
    contractRevision: lease.contractRevision,
    intentRef: lease.intentRef,
    bindingRef: lease.bindingRef,
    actionCandidateRef: lease.actionCandidateRef,
    allowedActionRef: lease.allowedActionRef,
    actionId: lease.actionId,
    drmDecisionRef: lease.drmDecisionRef,
    srcDecisionRef: lease.srcDecisionRef,
    acquisitionReasonRef: lease.acquisitionReasonRef,
    genericPrincipleRef: lease.genericPrincipleRef,
    expectedEffectRef: lease.expectedEffectRef,
    premiseEvidenceRefs: [...lease.premiseEvidenceRefs],
    falsifierRefs: [...lease.falsifierRefs],
    evidenceRefs: [...lease.evidenceRefs],
    state: 'validated',
    expiresAfterObservationRevision: lease.expiresAfterObservationRevision,
  };
}

export function temporalConcentrationLeaseFingerprint(
  lease: Omit<TemporalConcentrationLeaseReceipt, 'leaseFingerprint'>,
): string {
  return fingerprint({
    ...lease,
    premiseEvidenceRefs: canonicalRefs(lease.premiseEvidenceRefs),
    falsifierRefs: canonicalRefs(lease.falsifierRefs),
    evidenceRefs: canonicalRefs(lease.evidenceRefs),
  });
}

function permitBase(
  permit: TemporalActionReleasePermitReceipt,
): Omit<TemporalActionReleasePermitReceipt, 'permitFingerprint'> {
  return {
    schemaVersion: permit.schemaVersion,
    permitRef: permit.permitRef,
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    sessionId: permit.sessionId,
    observationSequence: permit.observationSequence,
    observationFingerprint: permit.observationFingerprint,
    temporalIdentity: structuredClone(permit.temporalIdentity),
    stateRevision: permit.stateRevision,
    validThroughObservationRevision: permit.validThroughObservationRevision,
    intentRef: permit.intentRef,
    bindingRef: permit.bindingRef,
    selectedRef: permit.selectedRef,
    decisionFingerprint: permit.decisionFingerprint,
    actionCandidateRef: permit.actionCandidateRef,
    targetRef: permit.targetRef,
    actionId: permit.actionId,
    availableActionRef: permit.availableActionRef,
    preActionSnapshotDigest: permit.preActionSnapshotDigest,
    viabilityAssessmentRef: permit.viabilityAssessmentRef,
    commitmentDecisionRef: permit.commitmentDecisionRef,
    concentrationLease: {
      ...leaseBase(permit.concentrationLease),
      leaseFingerprint: permit.concentrationLease.leaseFingerprint,
    },
    evidenceRefs: [...permit.evidenceRefs],
    declaredSeriesRef: null,
    declaredSeriesIntentRefs: [],
    declaredSeriesActionRefs: [],
    concentrationAcquisitionDeferred: false,
    actionPermitPresent: true,
    actionPayloadPresent: false,
    actionReleased: false,
    environmentDispatchAuthorized: false,
    actAuthorized: true,
  };
}

export function temporalActionReleasePermitFingerprint(
  permit: Omit<TemporalActionReleasePermitReceipt, 'permitFingerprint'>,
): string {
  return fingerprint({
    ...permit,
    concentrationLease: {
      ...permit.concentrationLease,
      premiseEvidenceRefs: canonicalRefs(permit.concentrationLease.premiseEvidenceRefs),
      falsifierRefs: canonicalRefs(permit.concentrationLease.falsifierRefs),
      evidenceRefs: canonicalRefs(permit.concentrationLease.evidenceRefs),
    },
    evidenceRefs: canonicalRefs(permit.evidenceRefs),
  });
}

function validateEligibleAudit(
  audit: TemporalActReleaseAuditResult,
  binding: TemporalPreparedActionBindingReceipt,
): void {
  if (
    audit.status !== 'eligible'
    || audit.reason !== 'all_release_gates_satisfied'
    || !audit.releaseEligible
  ) {
    throw new Error('ACT release permit requires an eligible release audit');
  }
  if (
    audit.actionPayloadPresent !== false
    || audit.actionReleased !== false
    || audit.actAuthorized !== false
  ) {
    throw new Error('release audit crossed its non-authorizing boundary');
  }
  if (
    audit.intentRef !== binding.intentRef
    || audit.selectedRef !== binding.selectedRef
    || audit.decisionFingerprint !== binding.decisionFingerprint
    || audit.actionWitnessRef !== binding.actionWitnessRef
    || audit.actionFamilyRef !== binding.actionFamilyRef
  ) {
    throw new Error('release audit and prepared action binding identity mismatch');
  }
  if (!sameIdentity(audit.identity, binding.temporalIdentity)) {
    throw new Error('release audit and prepared action binding observation mismatch');
  }
  if (!validUniqueRefs(audit.evidenceRefs)) {
    throw new Error('release audit evidence domain is invalid');
  }
}

function validateAuthorityEvidence(
  authority: TemporalActionReleasePermitAuthority,
  binding: TemporalPreparedActionBindingReceipt,
  audit: TemporalActReleaseAuditResult,
): void {
  const lease = authority.concentrationLease;
  if (
    !validRef(authority.permitRef)
    || !validRef(authority.viabilityAssessmentRef)
    || !validRef(authority.commitmentDecisionRef)
    || !validUniqueRefs(authority.evidenceRefs)
    || !validRevision(authority.validThroughObservationRevision)
    || !validRef(lease.leaseRef)
    || !validRef(lease.drmDecisionRef)
    || !validRef(lease.srcDecisionRef)
    || !validRef(lease.acquisitionReasonRef)
    || !validRef(lease.genericPrincipleRef)
    || !validRef(lease.expectedEffectRef)
    || !validUniqueRefs(lease.premiseEvidenceRefs)
    || !validUniqueRefs(lease.falsifierRefs)
    || !validUniqueRefs(lease.evidenceRefs)
    || !validRevision(lease.expiresAfterObservationRevision)
  ) {
    throw new Error('ACT release permit authority identity or evidence domain is invalid');
  }
  if (!binding.expectationRefs.includes(lease.expectedEffectRef)) {
    throw new Error('ACT release permit expected effect differs from the frozen intent');
  }

  const causalEvidence = new Set([
    ...audit.evidenceRefs,
    ...binding.expectationRefs,
    ...binding.groundingEvidenceRefs,
    ...binding.actionEvidenceRefs,
    ...binding.targetEvidenceRefs,
  ]);
  const requiredAuthorityRefs = [
    authority.viabilityAssessmentRef,
    authority.commitmentDecisionRef,
    lease.drmDecisionRef,
    lease.srcDecisionRef,
    lease.acquisitionReasonRef,
    lease.genericPrincipleRef,
    lease.expectedEffectRef,
    ...authority.evidenceRefs,
    ...lease.premiseEvidenceRefs,
    ...lease.falsifierRefs,
    ...lease.evidenceRefs,
  ];
  if (requiredAuthorityRefs.some(ref => !causalEvidence.has(ref))) {
    throw new Error('ACT release permit authority is absent from the qualified evidence');
  }
}

function buildLease(
  binding: TemporalPreparedActionBindingReceipt,
  observation: AgentObservation,
  authority: TemporalConcentrationLeaseAuthority,
): TemporalConcentrationLeaseReceipt {
  const availableActionRef = temporalAvailableActionRef(observation, binding.candidateAction.id);
  const premiseEvidenceRefs = canonicalRefs(authority.premiseEvidenceRefs);
  const falsifierRefs = canonicalRefs(authority.falsifierRefs);
  const evidenceRefs = canonicalRefs([
    ...authority.evidenceRefs,
    binding.bindingFingerprint,
    binding.intentRef,
    binding.actionCandidateRef,
    availableActionRef,
    ...binding.groundingEvidenceRefs,
    ...binding.actionEvidenceRefs,
    ...binding.targetEvidenceRefs,
    ...premiseEvidenceRefs,
    ...falsifierRefs,
  ]);
  const base: Omit<TemporalConcentrationLeaseReceipt, 'leaseFingerprint'> = {
    schemaVersion: TEMPORAL_CONCENTRATION_LEASE_SCHEMA_VERSION,
    leaseRef: authority.leaseRef,
    workflowRef: binding.workflowRef,
    sourceHash: binding.sourceHash,
    sessionId: observation.sessionId,
    observationSequence: observation.sequence,
    observationFingerprint: fingerprintAgentObservation(observation),
    temporalIdentity: structuredClone(binding.temporalIdentity),
    frameRevision: binding.temporalIdentity.observationRevision,
    contractRevision: binding.temporalIdentity.observationRevision,
    intentRef: binding.intentRef,
    bindingRef: binding.bindingFingerprint,
    actionCandidateRef: binding.actionCandidateRef,
    allowedActionRef: availableActionRef,
    actionId: binding.candidateAction.id,
    drmDecisionRef: authority.drmDecisionRef,
    srcDecisionRef: authority.srcDecisionRef,
    acquisitionReasonRef: authority.acquisitionReasonRef,
    genericPrincipleRef: authority.genericPrincipleRef,
    expectedEffectRef: authority.expectedEffectRef,
    premiseEvidenceRefs,
    falsifierRefs,
    evidenceRefs,
    state: 'validated',
    expiresAfterObservationRevision: authority.expiresAfterObservationRevision,
  };
  return {
    ...base,
    leaseFingerprint: temporalConcentrationLeaseFingerprint(base),
  };
}

function validateLease(
  lease: TemporalConcentrationLeaseReceipt,
  binding: TemporalPreparedActionBindingReceipt,
  observation: AgentObservation,
): void {
  if (lease.schemaVersion !== TEMPORAL_CONCENTRATION_LEASE_SCHEMA_VERSION) {
    throw new Error('unsupported temporal concentration lease version');
  }
  if (lease.state !== 'validated') {
    throw new Error('ordinary ACT release requires a validated concentration lease');
  }
  if (
    !validRef(lease.leaseRef)
    || !validRef(lease.drmDecisionRef)
    || !validRef(lease.srcDecisionRef)
    || !validRef(lease.acquisitionReasonRef)
    || !validRef(lease.genericPrincipleRef)
    || !validRef(lease.expectedEffectRef)
    || !validUniqueRefs(lease.premiseEvidenceRefs)
    || !validUniqueRefs(lease.falsifierRefs)
    || !validUniqueRefs(lease.evidenceRefs)
  ) {
    throw new Error('temporal concentration lease identity or evidence domain is invalid');
  }
  if (
    lease.workflowRef !== binding.workflowRef
    || lease.sourceHash !== binding.sourceHash
    || lease.sessionId !== observation.sessionId
    || lease.observationSequence !== observation.sequence
    || lease.observationFingerprint !== fingerprintAgentObservation(observation)
  ) {
    throw new Error('temporal concentration lease Source or public observation mismatch');
  }
  if (!sameIdentity(lease.temporalIdentity, binding.temporalIdentity)) {
    throw new Error('temporal concentration lease observation identity mismatch');
  }
  if (
    lease.frameRevision !== binding.temporalIdentity.observationRevision
    || lease.contractRevision !== binding.temporalIdentity.observationRevision
    || !validRevision(lease.expiresAfterObservationRevision)
    || lease.expiresAfterObservationRevision < lease.contractRevision
  ) {
    throw new Error('temporal concentration lease revision window is invalid');
  }
  if (!binding.expectationRefs.includes(lease.expectedEffectRef)) {
    throw new Error('temporal concentration lease expected effect mismatch');
  }
  const availableActionRef = temporalAvailableActionRef(observation, binding.candidateAction.id);
  if (
    lease.intentRef !== binding.intentRef
    || lease.bindingRef !== binding.bindingFingerprint
    || lease.actionCandidateRef !== binding.actionCandidateRef
    || lease.actionId !== binding.candidateAction.id
    || lease.allowedActionRef !== availableActionRef
  ) {
    throw new Error('temporal concentration lease action binding mismatch');
  }
  if (!observation.availableActionIds.includes(lease.actionId)) {
    throw new Error('temporal concentration lease action is no longer available');
  }
  const requiredEvidence = [
    binding.bindingFingerprint,
    binding.intentRef,
    binding.actionCandidateRef,
    availableActionRef,
    ...binding.groundingEvidenceRefs,
    ...binding.actionEvidenceRefs,
    ...binding.targetEvidenceRefs,
    ...lease.premiseEvidenceRefs,
    ...lease.falsifierRefs,
  ];
  if (requiredEvidence.some(ref => !lease.evidenceRefs.includes(ref))) {
    throw new Error('temporal concentration lease lost declared evidence');
  }
  if (lease.leaseFingerprint !== temporalConcentrationLeaseFingerprint(leaseBase(lease))) {
    throw new Error('temporal concentration lease fingerprint mismatch');
  }
}

export function createTemporalActionReleasePermitReceipt(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
  binding: TemporalPreparedActionBindingReceipt,
  audit: TemporalActReleaseAuditResult,
  authority: TemporalActionReleasePermitAuthority,
): TemporalActionReleasePermitReceipt {
  validateTemporalPreparedActionBindingReceipt(binding, projection, witness, observation);
  validateEligibleAudit(audit, binding);
  validateAuthorityEvidence(authority, binding, audit);

  const currentRevision = binding.temporalIdentity.observationRevision;
  if (authority.validThroughObservationRevision < currentRevision) {
    throw new Error('ACT release permit is stale at creation');
  }
  const lease = buildLease(binding, observation, authority.concentrationLease);
  validateLease(lease, binding, observation);
  if (authority.validThroughObservationRevision > lease.expiresAfterObservationRevision) {
    throw new Error('ACT release permit outlives its concentration lease');
  }

  const evidenceRefs = canonicalRefs([
    ...authority.evidenceRefs,
    ...audit.evidenceRefs,
    ...binding.groundingEvidenceRefs,
    ...binding.actionEvidenceRefs,
    ...binding.targetEvidenceRefs,
    ...lease.evidenceRefs,
    binding.bindingFingerprint,
    authority.viabilityAssessmentRef,
    authority.commitmentDecisionRef,
    authority.permitRef,
  ]);
  const base: Omit<TemporalActionReleasePermitReceipt, 'permitFingerprint'> = {
    schemaVersion: TEMPORAL_ACTION_RELEASE_PERMIT_SCHEMA_VERSION,
    permitRef: authority.permitRef,
    workflowRef: binding.workflowRef,
    sourceHash: binding.sourceHash,
    sessionId: observation.sessionId,
    observationSequence: observation.sequence,
    observationFingerprint: fingerprintAgentObservation(observation),
    temporalIdentity: structuredClone(binding.temporalIdentity),
    stateRevision: currentRevision,
    validThroughObservationRevision: authority.validThroughObservationRevision,
    intentRef: binding.intentRef,
    bindingRef: binding.bindingFingerprint,
    selectedRef: binding.selectedRef,
    decisionFingerprint: binding.decisionFingerprint,
    actionCandidateRef: binding.actionCandidateRef,
    targetRef: binding.targetRef,
    actionId: binding.candidateAction.id,
    availableActionRef: temporalAvailableActionRef(observation, binding.candidateAction.id),
    preActionSnapshotDigest: fingerprintAgentObservation(observation),
    viabilityAssessmentRef: authority.viabilityAssessmentRef,
    commitmentDecisionRef: authority.commitmentDecisionRef,
    concentrationLease: lease,
    evidenceRefs,
    declaredSeriesRef: null,
    declaredSeriesIntentRefs: [],
    declaredSeriesActionRefs: [],
    concentrationAcquisitionDeferred: false,
    actionPermitPresent: true,
    actionPayloadPresent: false,
    actionReleased: false,
    environmentDispatchAuthorized: false,
    actAuthorized: true,
  };
  const permit: TemporalActionReleasePermitReceipt = {
    ...base,
    permitFingerprint: temporalActionReleasePermitFingerprint(base),
  };
  validateTemporalActionReleasePermitReceipt(
    permit,
    projection,
    witness,
    observation,
    binding,
    audit,
  );
  return permit;
}

export function validateTemporalActionReleasePermitReceipt(
  permit: TemporalActionReleasePermitReceipt,
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
  binding: TemporalPreparedActionBindingReceipt,
  audit: TemporalActReleaseAuditResult,
): void {
  validateTemporalPreparedActionBindingReceipt(binding, projection, witness, observation);
  validateEligibleAudit(audit, binding);
  validateLease(permit.concentrationLease, binding, observation);
  if (permit.schemaVersion !== TEMPORAL_ACTION_RELEASE_PERMIT_SCHEMA_VERSION) {
    throw new Error('unsupported temporal ACT release permit version');
  }
  if (
    permit.actionPermitPresent !== true
    || permit.actionPayloadPresent !== false
    || permit.actionReleased !== false
    || permit.environmentDispatchAuthorized !== false
    || permit.actAuthorized !== true
    || permit.declaredSeriesRef !== null
    || permit.declaredSeriesIntentRefs.length !== 0
    || permit.declaredSeriesActionRefs.length !== 0
    || permit.concentrationAcquisitionDeferred !== false
  ) {
    throw new Error('temporal ACT release permit crossed its declared boundary');
  }
  if (
    !validRef(permit.permitRef)
    || !validRef(permit.viabilityAssessmentRef)
    || !validRef(permit.commitmentDecisionRef)
    || !validUniqueRefs(permit.evidenceRefs)
  ) {
    throw new Error('temporal ACT release permit identity or evidence domain is invalid');
  }
  if (
    permit.workflowRef !== binding.workflowRef
    || permit.sourceHash !== binding.sourceHash
    || permit.sessionId !== observation.sessionId
    || permit.observationSequence !== observation.sequence
    || permit.observationFingerprint !== fingerprintAgentObservation(observation)
    || permit.preActionSnapshotDigest !== fingerprintAgentObservation(observation)
  ) {
    throw new Error('temporal ACT release permit Source or snapshot mismatch');
  }
  if (!sameIdentity(permit.temporalIdentity, binding.temporalIdentity)) {
    throw new Error('temporal ACT release permit observation identity mismatch');
  }
  if (
    permit.stateRevision !== binding.temporalIdentity.observationRevision
    || !validRevision(permit.validThroughObservationRevision)
    || permit.validThroughObservationRevision < permit.stateRevision
    || permit.validThroughObservationRevision
      > permit.concentrationLease.expiresAfterObservationRevision
  ) {
    throw new Error('temporal ACT release permit revision window is invalid');
  }
  const availableActionRef = temporalAvailableActionRef(observation, binding.candidateAction.id);
  if (
    permit.intentRef !== binding.intentRef
    || permit.bindingRef !== binding.bindingFingerprint
    || permit.selectedRef !== binding.selectedRef
    || permit.decisionFingerprint !== binding.decisionFingerprint
    || permit.actionCandidateRef !== binding.actionCandidateRef
    || permit.targetRef !== binding.targetRef
    || permit.actionId !== binding.candidateAction.id
    || permit.availableActionRef !== availableActionRef
  ) {
    throw new Error('temporal ACT release permit intent or action binding mismatch');
  }
  if (!observation.availableActionIds.includes(permit.actionId)) {
    throw new Error('temporal ACT release permit action is no longer available');
  }
  const requiredEvidence = [
    ...audit.evidenceRefs,
    ...binding.groundingEvidenceRefs,
    ...binding.actionEvidenceRefs,
    ...binding.targetEvidenceRefs,
    ...permit.concentrationLease.evidenceRefs,
    binding.bindingFingerprint,
    permit.viabilityAssessmentRef,
    permit.commitmentDecisionRef,
    permit.permitRef,
  ];
  if (requiredEvidence.some(ref => !permit.evidenceRefs.includes(ref))) {
    throw new Error('temporal ACT release permit lost required evidence');
  }
  if (
    permit.permitFingerprint
      !== temporalActionReleasePermitFingerprint(permitBase(permit))
  ) {
    throw new Error('temporal ACT release permit fingerprint mismatch');
  }
}

export function projectTemporalActionReleasePermit(
  permit: TemporalActionReleasePermitReceipt,
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
  binding: TemporalPreparedActionBindingReceipt,
  audit: TemporalActReleaseAuditResult,
): TemporalActionReleasePermitProjection {
  validateTemporalActionReleasePermitReceipt(
    permit,
    projection,
    witness,
    observation,
    binding,
    audit,
  );
  return {
    status: 'permitted',
    permitRef: permit.permitRef,
    leaseRef: permit.concentrationLease.leaseRef,
    intentRef: permit.intentRef,
    bindingRef: permit.bindingRef,
    selectedRef: permit.selectedRef,
    decisionFingerprint: permit.decisionFingerprint,
    actionCandidateRef: permit.actionCandidateRef,
    targetRef: permit.targetRef,
    actionId: permit.actionId,
    availableActionRef: permit.availableActionRef,
    validThroughObservationRevision: permit.validThroughObservationRevision,
    evidenceRefs: [...permit.evidenceRefs],
    actionPermitPresent: true,
    releaseEligible: true,
    actionPayloadPresent: false,
    actionReleased: false,
    environmentDispatchAuthorized: false,
    actAuthorized: true,
  };
}
