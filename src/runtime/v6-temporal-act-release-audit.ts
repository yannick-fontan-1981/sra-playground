import type { TemporalSelectionBridgeResult } from '../logos-engine/v6-temporal-selection-bridge.ts';
import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';

/**
 * Reconstructed ACT-release audit boundary for TemporalSelection.
 *
 * This module does not construct an AgentAction and does not grant ACT. It
 * records only whether an already prepared action intent has passed every gate
 * that durable V5 Source donors place before release_action.
 */

export type TemporalCommitmentDecision = 'commit' | 'revise' | 'defer' | 'reject';
export type TemporalViabilityStatus = 'viable' | 'conditional' | 'blocked' | 'undetermined';
export type TemporalFatalReplayDisposition =
  | 'no_observed_fatal_replay'
  | 'reject_observed_fatal_replay'
  | 'unresolved';
export type TemporalEndpointDisposition = 'not_applicable' | 'clear' | 'contact' | 'unresolved';

export interface PreparedTemporalActionWitness {
  intentRef: string;
  selectedRef: string;
  decisionFingerprint: string;
  identity: TemporalObservationIdentity;
  currentFrameRef: string;
  actionWitnessRef: string;
  actionFamilyRef: string;
  expectationRefs: readonly string[];
  groundingEvidenceRefs: readonly string[];
}

export interface TemporalActReleaseGateFacts {
  groundingValid: boolean;
  commitmentDecision: TemporalCommitmentDecision;
  viabilityStatus: TemporalViabilityStatus;
  experimentCommitmentCurrent: boolean;
  controlEvidenceCurrent: boolean;
  memoryReuseValid: boolean;
  parentContinuityAllowsCandidate: boolean;
  parentInfluenceAllowsCandidate: boolean;
  fatalReplayDisposition: TemporalFatalReplayDisposition;
  endpointDisposition: TemporalEndpointDisposition;
  currentActionAvailable: boolean;
  evidenceRefs: readonly string[];
}

export type TemporalActReleaseAuditStatus = 'eligible' | 'blocked' | 'deferred';

export type TemporalActReleaseAuditReason =
  | 'selection_not_accepted'
  | 'selection_binding_mismatch'
  | 'decision_fingerprint_mismatch'
  | 'observation_binding_mismatch'
  | 'current_frame_mismatch'
  | 'intent_identity_invalid'
  | 'expectation_domain_invalid'
  | 'grounding_evidence_domain_invalid'
  | 'release_evidence_domain_invalid'
  | 'selected_evidence_not_grounded'
  | 'current_action_unavailable'
  | 'action_grounding_invalid'
  | 'commitment_revision_required'
  | 'commitment_deferred'
  | 'commitment_rejected'
  | 'viability_blocked'
  | 'viability_undetermined'
  | 'experiment_commitment_not_current'
  | 'control_evidence_not_current'
  | 'memory_reuse_not_validated'
  | 'parent_continuity_not_revalidated'
  | 'parent_influence_not_revalidated'
  | 'observed_fatal_replay'
  | 'fatal_replay_safety_unresolved'
  | 'hostile_endpoint_contact'
  | 'endpoint_safety_unresolved'
  | 'all_release_gates_satisfied';

export interface TemporalActReleaseAuditResult {
  status: TemporalActReleaseAuditStatus;
  reason: TemporalActReleaseAuditReason;
  releaseEligible: boolean;
  intentRef: string | null;
  selectedRef: string | null;
  decisionFingerprint: string;
  identity: TemporalObservationIdentity;
  actionWitnessRef: string | null;
  actionFamilyRef: string | null;
  evidenceRefs: readonly string[];
  actionPayloadPresent: false;
  actionReleased: false;
  actAuthorized: false;
}

function sameIdentity(a: TemporalObservationIdentity, b: TemporalObservationIdentity): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validRef(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validUniqueRefs(values: readonly string[], minimum = 1, maximum = 64): boolean {
  return values.length >= minimum
    && values.length <= maximum
    && values.every(validRef)
    && new Set(values).size === values.length;
}

function evidenceRefs(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness | null,
  facts: TemporalActReleaseGateFacts | null,
): string[] {
  return [...new Set([
    projection.decisionRef,
    ...(projection.decision.status === 'accepted' ? projection.decision.selectedEvidenceRefs : []),
    ...(witness?.groundingEvidenceRefs ?? []),
    ...(facts?.evidenceRefs ?? []),
    ...(witness ? [witness.intentRef, witness.actionWitnessRef] : []),
  ])].filter(validRef).sort();
}

function result(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness | null,
  facts: TemporalActReleaseGateFacts | null,
  status: TemporalActReleaseAuditStatus,
  reason: TemporalActReleaseAuditReason,
): TemporalActReleaseAuditResult {
  return {
    status,
    reason,
    releaseEligible: status === 'eligible',
    intentRef: witness?.intentRef ?? null,
    selectedRef: projection.decision.status === 'accepted' ? projection.decision.selectedRef : null,
    decisionFingerprint: projection.decisionRef,
    identity: structuredClone(projection.state.identity),
    actionWitnessRef: witness?.actionWitnessRef ?? null,
    actionFamilyRef: witness?.actionFamilyRef ?? null,
    evidenceRefs: evidenceRefs(projection, witness, facts),
    actionPayloadPresent: false,
    actionReleased: false,
    actAuthorized: false,
  };
}

/**
 * Audit an already prepared action intent against the durable V5 release gates.
 *
 * An eligible result is still not an ACT permit: no AgentAction is accepted or
 * returned by this module. Candidate-to-action binding remains a separate,
 * currently unreconstructed contract.
 */
export function auditTemporalActRelease(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  facts: TemporalActReleaseGateFacts,
): TemporalActReleaseAuditResult {
  if (projection.decision.status !== 'accepted') {
    return result(projection, witness, facts, 'blocked', 'selection_not_accepted');
  }
  if (witness.selectedRef !== projection.decision.selectedRef) {
    return result(projection, witness, facts, 'blocked', 'selection_binding_mismatch');
  }
  if (witness.decisionFingerprint !== projection.decisionRef) {
    return result(projection, witness, facts, 'blocked', 'decision_fingerprint_mismatch');
  }
  if (!sameIdentity(witness.identity, projection.state.identity)) {
    return result(projection, witness, facts, 'blocked', 'observation_binding_mismatch');
  }
  if (witness.currentFrameRef !== projection.state.identity.observationId) {
    return result(projection, witness, facts, 'blocked', 'current_frame_mismatch');
  }
  if (
    !validRef(witness.intentRef)
    || !validRef(witness.actionWitnessRef)
    || !validRef(witness.actionFamilyRef)
  ) {
    return result(projection, witness, facts, 'blocked', 'intent_identity_invalid');
  }
  if (!validUniqueRefs(witness.expectationRefs)) {
    return result(projection, witness, facts, 'blocked', 'expectation_domain_invalid');
  }
  if (!validUniqueRefs(witness.groundingEvidenceRefs)) {
    return result(projection, witness, facts, 'blocked', 'grounding_evidence_domain_invalid');
  }
  if (!validUniqueRefs(facts.evidenceRefs)) {
    return result(projection, witness, facts, 'blocked', 'release_evidence_domain_invalid');
  }
  if (
    projection.decision.selectedEvidenceRefs.some(
      ref => !witness.groundingEvidenceRefs.includes(ref),
    )
  ) {
    return result(projection, witness, facts, 'blocked', 'selected_evidence_not_grounded');
  }
  if (!facts.currentActionAvailable) {
    return result(projection, witness, facts, 'blocked', 'current_action_unavailable');
  }
  if (!facts.groundingValid) {
    return result(projection, witness, facts, 'blocked', 'action_grounding_invalid');
  }

  if (facts.commitmentDecision === 'revise') {
    return result(projection, witness, facts, 'blocked', 'commitment_revision_required');
  }
  if (facts.commitmentDecision === 'defer') {
    return result(projection, witness, facts, 'deferred', 'commitment_deferred');
  }
  if (facts.commitmentDecision === 'reject') {
    return result(projection, witness, facts, 'blocked', 'commitment_rejected');
  }

  if (facts.viabilityStatus === 'blocked') {
    return result(projection, witness, facts, 'blocked', 'viability_blocked');
  }
  if (facts.viabilityStatus === 'undetermined') {
    return result(projection, witness, facts, 'deferred', 'viability_undetermined');
  }
  if (!facts.experimentCommitmentCurrent) {
    return result(projection, witness, facts, 'blocked', 'experiment_commitment_not_current');
  }
  if (!facts.controlEvidenceCurrent) {
    return result(projection, witness, facts, 'blocked', 'control_evidence_not_current');
  }
  if (!facts.memoryReuseValid) {
    return result(projection, witness, facts, 'blocked', 'memory_reuse_not_validated');
  }
  if (!facts.parentContinuityAllowsCandidate) {
    return result(projection, witness, facts, 'blocked', 'parent_continuity_not_revalidated');
  }
  if (!facts.parentInfluenceAllowsCandidate) {
    return result(projection, witness, facts, 'blocked', 'parent_influence_not_revalidated');
  }

  if (facts.fatalReplayDisposition === 'reject_observed_fatal_replay') {
    return result(projection, witness, facts, 'blocked', 'observed_fatal_replay');
  }
  if (facts.fatalReplayDisposition === 'unresolved') {
    return result(projection, witness, facts, 'deferred', 'fatal_replay_safety_unresolved');
  }
  if (facts.endpointDisposition === 'contact') {
    return result(projection, witness, facts, 'blocked', 'hostile_endpoint_contact');
  }
  if (facts.endpointDisposition === 'unresolved') {
    return result(projection, witness, facts, 'deferred', 'endpoint_safety_unresolved');
  }

  return result(projection, witness, facts, 'eligible', 'all_release_gates_satisfied');
}
