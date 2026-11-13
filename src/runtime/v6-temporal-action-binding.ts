import type { TemporalSelectionBridgeResult } from '../logos-engine/v6-temporal-selection-bridge.ts';
import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { ActionId, AgentAction, AgentObservation } from './contracts.ts';
import { isAgentAction } from './contracts.ts';
import { fingerprintAgentObservation } from './v6-temporal-decision-port.ts';
import type { PreparedTemporalActionWitness } from './v6-temporal-act-release-audit.ts';

export const TEMPORAL_ACTION_BINDING_SCHEMA_VERSION =
  'sra.temporal_prepared_action_binding.v1' as const;

export type TemporalPreparedActionTarget =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'action'; actionId: Exclude<ActionId, 6> };

export interface TemporalPreparedActionCandidateSpec {
  actionCandidateRef: string;
  targetRef: string;
  target: TemporalPreparedActionTarget;
  candidateAction: AgentAction;
  actionEvidenceRefs: readonly string[];
  targetEvidenceRefs: readonly string[];
}

export interface TemporalPreparedActionBindingReceipt {
  schemaVersion: typeof TEMPORAL_ACTION_BINDING_SCHEMA_VERSION;
  workflowRef: string;
  sourceHash: string;
  sessionId: string;
  observationSequence: number;
  observationFingerprint: string;
  temporalIdentity: TemporalObservationIdentity;
  selectedRef: string;
  decisionFingerprint: string;
  intentRef: string;
  currentFrameRef: string;
  actionWitnessRef: string;
  actionFamilyRef: string;
  actionCandidateRef: string;
  targetRef: string;
  target: TemporalPreparedActionTarget;
  candidateAction: AgentAction;
  expectationRefs: readonly string[];
  groundingEvidenceRefs: readonly string[];
  actionEvidenceRefs: readonly string[];
  targetEvidenceRefs: readonly string[];
  bindingFingerprint: string;
  actAuthorized: false;
}

export interface TemporalPreparedActionBindingResult {
  status: 'bound';
  bindingRef: string;
  selectedRef: string;
  decisionFingerprint: string;
  intentRef: string;
  actionCandidateRef: string;
  targetRef: string;
  target: TemporalPreparedActionTarget;
  candidateAction: AgentAction;
  evidenceRefs: readonly string[];
  actionAvailable: true;
  actionCandidatePresent: true;
  actionPermitPresent: false;
  releaseEligible: false;
  actionReleased: false;
  actAuthorized: false;
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

function canonicalRefs(values: readonly string[]): string[] {
  return [...values].sort();
}

function sameIdentity(a: TemporalObservationIdentity, b: TemporalObservationIdentity): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizedAction(action: AgentAction): AgentAction {
  return action.id === 6
    ? { id: 6, data: { x: action.data.x, y: action.data.y } }
    : { id: action.id };
}

function normalizedTarget(target: TemporalPreparedActionTarget): TemporalPreparedActionTarget {
  return target.kind === 'point'
    ? { kind: 'point', x: target.x, y: target.y }
    : { kind: 'action', actionId: target.actionId };
}

function validTarget(target: TemporalPreparedActionTarget): boolean {
  if (target.kind === 'point') {
    return [target.x, target.y].every(
      coordinate => Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 64,
    );
  }
  return Number.isInteger(target.actionId)
    && target.actionId >= 0
    && target.actionId <= 7
    && target.actionId !== 6;
}

function targetMatchesAction(
  target: TemporalPreparedActionTarget,
  action: AgentAction,
): boolean {
  if (action.id === 6) {
    return target.kind === 'point'
      && target.x === action.data.x
      && target.y === action.data.y;
  }
  return target.kind === 'action' && target.actionId === action.id;
}

function receiptBase(
  receipt: TemporalPreparedActionBindingReceipt,
): Omit<TemporalPreparedActionBindingReceipt, 'bindingFingerprint'> {
  return {
    schemaVersion: receipt.schemaVersion,
    workflowRef: receipt.workflowRef,
    sourceHash: receipt.sourceHash,
    sessionId: receipt.sessionId,
    observationSequence: receipt.observationSequence,
    observationFingerprint: receipt.observationFingerprint,
    temporalIdentity: structuredClone(receipt.temporalIdentity),
    selectedRef: receipt.selectedRef,
    decisionFingerprint: receipt.decisionFingerprint,
    intentRef: receipt.intentRef,
    currentFrameRef: receipt.currentFrameRef,
    actionWitnessRef: receipt.actionWitnessRef,
    actionFamilyRef: receipt.actionFamilyRef,
    actionCandidateRef: receipt.actionCandidateRef,
    targetRef: receipt.targetRef,
    target: normalizedTarget(receipt.target),
    candidateAction: normalizedAction(receipt.candidateAction),
    expectationRefs: [...receipt.expectationRefs],
    groundingEvidenceRefs: [...receipt.groundingEvidenceRefs],
    actionEvidenceRefs: [...receipt.actionEvidenceRefs],
    targetEvidenceRefs: [...receipt.targetEvidenceRefs],
    actAuthorized: false,
  };
}

function canonicalPayload(
  receipt: Omit<TemporalPreparedActionBindingReceipt, 'bindingFingerprint'>,
): string {
  return JSON.stringify({
    ...receipt,
    target: normalizedTarget(receipt.target),
    candidateAction: normalizedAction(receipt.candidateAction),
    expectationRefs: canonicalRefs(receipt.expectationRefs),
    groundingEvidenceRefs: canonicalRefs(receipt.groundingEvidenceRefs),
    actionEvidenceRefs: canonicalRefs(receipt.actionEvidenceRefs),
    targetEvidenceRefs: canonicalRefs(receipt.targetEvidenceRefs),
    actAuthorized: false,
  });
}

/**
 * Deterministic transport identity. This is not a cryptographic signature.
 */
export function temporalPreparedActionBindingFingerprint(
  receipt: Omit<TemporalPreparedActionBindingReceipt, 'bindingFingerprint'>,
): string {
  const payload = canonicalPayload(receipt);
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateWitness(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
): void {
  if (projection.decision.status !== 'accepted') {
    throw new Error('cannot bind an action candidate to a refused TemporalSelection decision');
  }
  if (witness.selectedRef !== projection.decision.selectedRef) {
    throw new Error('prepared action witness selected ref mismatch');
  }
  if (witness.decisionFingerprint !== projection.decisionRef) {
    throw new Error('prepared action witness decision fingerprint mismatch');
  }
  if (!sameIdentity(witness.identity, projection.state.identity)) {
    throw new Error('prepared action witness observation identity mismatch');
  }
  if (witness.currentFrameRef !== projection.state.identity.observationId) {
    throw new Error('prepared action witness current frame mismatch');
  }
  if (
    !validRef(witness.intentRef)
    || !validRef(witness.actionWitnessRef)
    || !validRef(witness.actionFamilyRef)
    || !validUniqueRefs(witness.expectationRefs)
    || !validUniqueRefs(witness.groundingEvidenceRefs)
  ) {
    throw new Error('prepared action witness identity or evidence domain is invalid');
  }
  if (
    projection.decision.selectedEvidenceRefs.some(
      ref => !witness.groundingEvidenceRefs.includes(ref),
    )
  ) {
    throw new Error('prepared action witness lost selected evidence during grounding');
  }
}

export function createTemporalPreparedActionBindingReceipt(
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
  candidate: TemporalPreparedActionCandidateSpec,
): TemporalPreparedActionBindingReceipt {
  validateWitness(projection, witness);
  if (
    !validRef(candidate.actionCandidateRef)
    || !validRef(candidate.targetRef)
    || !validUniqueRefs(candidate.actionEvidenceRefs)
    || !validUniqueRefs(candidate.targetEvidenceRefs)
  ) {
    throw new Error('prepared action candidate identity or evidence domain is invalid');
  }
  if (!isAgentAction(candidate.candidateAction)) {
    throw new Error('prepared action candidate is not a valid public AgentAction');
  }
  if (!validTarget(candidate.target) || !targetMatchesAction(candidate.target, candidate.candidateAction)) {
    throw new Error('prepared action target does not match the public AgentAction');
  }

  const base: Omit<TemporalPreparedActionBindingReceipt, 'bindingFingerprint'> = {
    schemaVersion: TEMPORAL_ACTION_BINDING_SCHEMA_VERSION,
    workflowRef: projection.state.workflowRef,
    sourceHash: projection.state.sourceHash,
    sessionId: observation.sessionId,
    observationSequence: observation.sequence,
    observationFingerprint: fingerprintAgentObservation(observation),
    temporalIdentity: structuredClone(projection.state.identity),
    selectedRef: projection.decision.selectedRef,
    decisionFingerprint: projection.decisionRef,
    intentRef: witness.intentRef,
    currentFrameRef: witness.currentFrameRef,
    actionWitnessRef: witness.actionWitnessRef,
    actionFamilyRef: witness.actionFamilyRef,
    actionCandidateRef: candidate.actionCandidateRef,
    targetRef: candidate.targetRef,
    target: normalizedTarget(candidate.target),
    candidateAction: normalizedAction(candidate.candidateAction),
    expectationRefs: [...witness.expectationRefs],
    groundingEvidenceRefs: [...witness.groundingEvidenceRefs],
    actionEvidenceRefs: [...candidate.actionEvidenceRefs],
    targetEvidenceRefs: [...candidate.targetEvidenceRefs],
    actAuthorized: false,
  };
  const receipt: TemporalPreparedActionBindingReceipt = {
    ...base,
    bindingFingerprint: temporalPreparedActionBindingFingerprint(base),
  };
  validateTemporalPreparedActionBindingReceipt(receipt, projection, witness, observation);
  return receipt;
}

export function validateTemporalPreparedActionBindingReceipt(
  receipt: TemporalPreparedActionBindingReceipt,
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
): void {
  validateWitness(projection, witness);
  if (receipt.schemaVersion !== TEMPORAL_ACTION_BINDING_SCHEMA_VERSION) {
    throw new Error('unsupported temporal prepared action binding version');
  }
  if (receipt.actAuthorized !== false) {
    throw new Error('prepared action binding cannot carry ACT authority');
  }
  if (
    receipt.workflowRef !== projection.state.workflowRef
    || receipt.sourceHash !== projection.state.sourceHash
  ) {
    throw new Error('prepared action binding Source identity mismatch');
  }
  if (
    receipt.selectedRef !== projection.decision.selectedRef
    || receipt.decisionFingerprint !== projection.decisionRef
    || receipt.intentRef !== witness.intentRef
    || receipt.currentFrameRef !== witness.currentFrameRef
    || receipt.actionWitnessRef !== witness.actionWitnessRef
    || receipt.actionFamilyRef !== witness.actionFamilyRef
  ) {
    throw new Error('prepared action binding intent or selection identity mismatch');
  }
  if (!sameIdentity(receipt.temporalIdentity, projection.state.identity)) {
    throw new Error('prepared action binding temporal observation mismatch');
  }
  if (
    receipt.sessionId !== observation.sessionId
    || receipt.observationSequence !== observation.sequence
    || receipt.observationFingerprint !== fingerprintAgentObservation(observation)
  ) {
    throw new Error('prepared action binding public observation mismatch');
  }
  if (
    !validRef(receipt.actionCandidateRef)
    || !validRef(receipt.targetRef)
    || !validUniqueRefs(receipt.expectationRefs)
    || !validUniqueRefs(receipt.groundingEvidenceRefs)
    || !validUniqueRefs(receipt.actionEvidenceRefs)
    || !validUniqueRefs(receipt.targetEvidenceRefs)
  ) {
    throw new Error('prepared action binding identity or evidence domain is invalid');
  }
  if (
    JSON.stringify(canonicalRefs(receipt.expectationRefs))
      !== JSON.stringify(canonicalRefs(witness.expectationRefs))
    || JSON.stringify(canonicalRefs(receipt.groundingEvidenceRefs))
      !== JSON.stringify(canonicalRefs(witness.groundingEvidenceRefs))
  ) {
    throw new Error('prepared action binding changed the frozen intent evidence');
  }
  if (!isAgentAction(receipt.candidateAction)) {
    throw new Error('prepared action binding carries an invalid public AgentAction');
  }
  if (!observation.availableActionIds.includes(receipt.candidateAction.id)) {
    throw new Error('prepared action candidate is not currently available');
  }
  if (!validTarget(receipt.target) || !targetMatchesAction(receipt.target, receipt.candidateAction)) {
    throw new Error('prepared action binding target does not match its AgentAction');
  }

  const evidence = new Set([
    ...receipt.groundingEvidenceRefs,
    ...receipt.actionEvidenceRefs,
    ...receipt.targetEvidenceRefs,
  ]);
  if (projection.decision.selectedEvidenceRefs.some(ref => !evidence.has(ref))) {
    throw new Error('prepared action binding does not preserve selected evidence');
  }

  const base = receiptBase(receipt);
  if (receipt.bindingFingerprint !== temporalPreparedActionBindingFingerprint(base)) {
    throw new Error('prepared action binding fingerprint mismatch');
  }
}

export function bindTemporalPreparedActionCandidate(
  receipt: TemporalPreparedActionBindingReceipt,
  projection: TemporalSelectionBridgeResult,
  witness: PreparedTemporalActionWitness,
  observation: AgentObservation,
): TemporalPreparedActionBindingResult {
  validateTemporalPreparedActionBindingReceipt(receipt, projection, witness, observation);
  const evidenceRefs = [...new Set([
    projection.decisionRef,
    ...projection.decision.status === 'accepted' ? projection.decision.selectedEvidenceRefs : [],
    ...receipt.groundingEvidenceRefs,
    ...receipt.actionEvidenceRefs,
    ...receipt.targetEvidenceRefs,
  ])].sort();
  return {
    status: 'bound',
    bindingRef: receipt.bindingFingerprint,
    selectedRef: receipt.selectedRef,
    decisionFingerprint: receipt.decisionFingerprint,
    intentRef: receipt.intentRef,
    actionCandidateRef: receipt.actionCandidateRef,
    targetRef: receipt.targetRef,
    target: structuredClone(receipt.target),
    candidateAction: structuredClone(receipt.candidateAction),
    evidenceRefs,
    actionAvailable: true,
    actionCandidatePresent: true,
    actionPermitPresent: false,
    releaseEligible: false,
    actionReleased: false,
    actAuthorized: false,
  };
}
