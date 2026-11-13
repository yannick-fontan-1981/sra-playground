import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';
import { fingerprintAgentObservation } from './v6-temporal-decision-port.ts';
import {
  temporalActionReleasePermitFingerprint,
  temporalConcentrationLeaseFingerprint,
  type TemporalActionReleasePermitReceipt,
  type TemporalConcentrationLeaseReceipt,
} from './v6-temporal-action-release-permit.ts';
import {
  temporalActLeaseTransitionFingerprint,
  temporalActTerminalReceiptFingerprint,
  type TemporalActConsumedReceipt,
} from './v6-temporal-act-consumption.ts';
import {
  restoreTemporalActionBoundaryJournal,
  temporalEnvironmentDispatchFingerprint,
  type TemporalActionBoundaryCheckpoint,
  type TemporalActionBoundaryJournal,
  type TemporalEnvironmentDispatchAttemptReceipt,
  type TemporalEnvironmentDispatchReceipt,
} from './v6-temporal-action-boundary.ts';

/**
 * Reconstructed causal return boundary after one durable environment dispatch.
 *
 * The durable V5 donor consumes an acquired observation only while the exact
 * workflow checkpoint is still suspended, the Source and pre-action snapshot
 * remain current, and the observation names the same intent, permit and
 * environment event. It then binds the raw input, clears pending action
 * lineage, moves the lease RELEASED -> OBSERVED and resumes one checkpoint.
 *
 * This module reconstructs that ordinary single-action contract. It does not
 * reconcile an attempt whose external outcome is unknown and it does not run
 * the workflow interpreter after the resumed checkpoint.
 */

export const TEMPORAL_CAUSAL_RESUME_CHECKPOINT_SCHEMA_VERSION =
  'sra.temporal_causal_resume_checkpoint.v1' as const;
export const TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION =
  'sra.temporal_causal_observation.v1' as const;
export const TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION =
  'sra.temporal_action_observed.v1' as const;
export const TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION =
  'sra.temporal_lease_observed_transition.v1' as const;
export const TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION =
  'sra.temporal_resumed_checkpoint.v1' as const;
export const TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION =
  'sra.temporal_causal_resume_receipt.v1' as const;
export const TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION =
  'sra.temporal_causal_resume_journal.v1' as const;

const DEFAULT_MAX_RESUMES = 128;
const MAX_RESUMES_LIMIT = 1024;

export interface TemporalCausalResumeCheckpoint {
  schemaVersion: typeof TEMPORAL_CAUSAL_RESUME_CHECKPOINT_SCHEMA_VERSION;
  boundaryCheckpoint: TemporalActionBoundaryCheckpoint;
  checkpointSequence: number;
  awaitingFrameBindingRef: string;
  suspensionFrameRef: string;
  consumedObservationRefs: readonly string[];
  checkpointFingerprint: string;
}

export interface TemporalCausalResumeCurrentAuthority {
  resumeRequestRef: string;
  currentCheckpointRef: string;
  currentCheckpointFingerprint: string;
  currentSourceHash: string;
  currentRunRef: string;
  currentTimelineRef: string;
  currentFrameRef: string;
  currentStateRevision: number;
  currentSemanticSnapshotDigest: string;
  canonicalDispatchFingerprint: string;
  canonicalActReceiptFingerprint: string;
  canonicalLeaseTransitionFingerprint: string;
  canonicalResponsibleIntentRef: string;
  operationalReturnBindingRef: string;
  checkpointCurrent: boolean;
  sourceCurrent: boolean;
  responsibilityCurrent: boolean;
  responsibleIntentCurrent: boolean;
  observedConsequenceBindingCurrent: boolean;
  evidenceRefs: readonly string[];
}

export interface TemporalCausalObservationReceipt {
  schemaVersion: typeof TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION;
  observationReceiptRef: string;
  dispatchRef: string;
  dispatchFingerprint: string;
  environmentActionEventRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  previousFrameRef: string;
  frameRef: string;
  stateRevision: number;
  observationIdentity: TemporalObservationIdentity;
  observationSequence: number;
  rawInputRef: string;
  observationFingerprint: string;
  acquisitionModelRef: 'transport.causal_frame';
  evidenceRefs: readonly string[];
  observationFingerprintSeal: string;
}

export interface TemporalActionObservedReceipt {
  schemaVersion: typeof TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION;
  actionObservedRef: string;
  operationalReturnBindingRef: string;
  dispatchRef: string;
  environmentActionEventRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  observationReceiptRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  evidenceRefs: readonly string[];
  actionObservedFingerprint: string;
}

export interface TemporalLeaseObservedTransitionReceipt {
  schemaVersion: typeof TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION;
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
  fromState: 'released';
  toState: 'observed';
  reasonRef: string;
  actionObservedRef: string;
  evidenceRefs: readonly string[];
  transitionFingerprint: string;
}

export interface TemporalResumedWorkflowCheckpoint {
  schemaVersion: typeof TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION;
  resumedCheckpointRef: string;
  previousCheckpointRef: string;
  previousCheckpointFingerprint: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  previousFrameRef: string;
  frameRef: string;
  stateRevision: number;
  checkpointSequence: number;
  status: 'active';
  awaitingFrameBindingRef: string;
  boundRawInputRef: string;
  consumedObservationRefs: readonly string[];
  pendingActionLineageCleared: true;
  observationReceiptRef: string;
  actionObservedRef: string;
  leaseObservedTransitionRef: string;
  evidenceRefs: readonly string[];
  resumedCheckpointFingerprint: string;
}

export interface TemporalCausalResumeReceipt {
  schemaVersion: typeof TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION;
  resumeRef: string;
  dispatchRef: string;
  dispatchFingerprint: string;
  checkpointRef: string;
  checkpointFingerprint: string;
  observation: TemporalCausalObservationReceipt;
  actionObserved: TemporalActionObservedReceipt;
  leaseTransition: TemporalLeaseObservedTransitionReceipt;
  resumedCheckpoint: TemporalResumedWorkflowCheckpoint;
  evidenceRefs: readonly string[];
  observationConsumed: true;
  checkpointResumed: true;
  causalResumeAuthorized: true;
  workflowResumed: true;
  receiptFingerprint: string;
}

export interface TemporalCausalResumeJournal {
  schemaVersion: typeof TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION;
  maxResumes: number;
  receipts: readonly TemporalCausalResumeReceipt[];
}

export interface ResumeTemporalWorkflowFromDispatchInput {
  journal: TemporalCausalResumeJournal;
  boundaryJournal: TemporalActionBoundaryJournal;
  dispatchRef: string;
  checkpoint: TemporalCausalResumeCheckpoint;
  permit: TemporalActionReleasePermitReceipt;
  actReceipt: TemporalActConsumedReceipt;
  currentAuthority: TemporalCausalResumeCurrentAuthority;
}

export interface TemporalCausalResumeResult {
  journal: TemporalCausalResumeJournal;
  receipt: TemporalCausalResumeReceipt;
  emittedResumedCheckpoint: TemporalResumedWorkflowCheckpoint | null;
  reused: boolean;
}

export type TemporalCausalResumeRefusalReason =
  | 'checkpoint_not_current'
  | 'source_changed'
  | 'run_changed'
  | 'timeline_changed'
  | 'frame_changed'
  | 'state_revision_changed'
  | 'semantic_snapshot_changed'
  | 'responsibility_not_current'
  | 'responsible_intent_not_current'
  | 'observed_consequence_binding_not_current'
  | 'canonical_dispatch_changed'
  | 'canonical_act_receipt_changed'
  | 'canonical_lease_transition_changed';

export class TemporalCausalResumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalCausalResumeError';
  }
}

export class TemporalCausalResumeRefusedError extends TemporalCausalResumeError {
  readonly reason: TemporalCausalResumeRefusalReason;
  readonly observationConsumed = false as const;
  readonly checkpointResumed = false as const;

  constructor(reason: TemporalCausalResumeRefusalReason) {
    super(`temporal causal resume refused: ${reason}`);
    this.name = 'TemporalCausalResumeRefusedError';
    this.reason = reason;
  }
}

export class TemporalCausalResumeUnknownOutcomeError extends TemporalCausalResumeError {
  readonly outcomeStatus = 'unknown' as const;
  readonly redeliveryPermitted = false as const;
  readonly reconciliationRequired = true as const;
  readonly observationConsumed = false as const;
  readonly checkpointResumed = false as const;
  readonly dispatchRef: string;
  readonly requestDigest: string;

  constructor(dispatchRef: string, requestDigest: string) {
    super(
      `causal resume is forbidden for unknown dispatch outcome ${dispatchRef}; external reconciliation is required`,
    );
    this.name = 'TemporalCausalResumeUnknownOutcomeError';
    this.dispatchRef = dispatchRef;
    this.requestDigest = requestDigest;
  }
}

function validRef(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validRevision(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validLevelEpoch(value: string | number): boolean {
  return typeof value === 'string' ? validRef(value) : validRevision(value);
}

function validUniqueRefs(
  values: readonly string[],
  minimum = 1,
  maximum = 512,
): boolean {
  return values.length >= minimum
    && values.length <= maximum
    && values.every(validRef)
    && new Set(values).size === values.length;
}

function validOptionalUniqueRefs(
  values: readonly string[],
  maximum = 512,
): boolean {
  return values.length <= maximum
    && values.every(validRef)
    && new Set(values).size === values.length;
}

function canonicalRefs(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameIdentity(
  first: TemporalObservationIdentity,
  second: TemporalObservationIdentity,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
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

function boundaryCheckpointBase(
  checkpoint: TemporalActionBoundaryCheckpoint,
): TemporalActionBoundaryCheckpoint {
  return {
    ...structuredClone(checkpoint),
    evidenceRefs: canonicalRefs(checkpoint.evidenceRefs),
  };
}

function checkpointBase(
  checkpoint: TemporalCausalResumeCheckpoint,
): Omit<TemporalCausalResumeCheckpoint, 'checkpointFingerprint'> {
  return {
    schemaVersion: checkpoint.schemaVersion,
    boundaryCheckpoint: boundaryCheckpointBase(checkpoint.boundaryCheckpoint),
    checkpointSequence: checkpoint.checkpointSequence,
    awaitingFrameBindingRef: checkpoint.awaitingFrameBindingRef,
    suspensionFrameRef: checkpoint.suspensionFrameRef,
    consumedObservationRefs: canonicalRefs(checkpoint.consumedObservationRefs),
  };
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

function actReceiptBase(
  receipt: TemporalActConsumedReceipt,
): Omit<TemporalActConsumedReceipt, 'receiptFingerprint'> {
  const { receiptFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

function actTransitionBase(
  transition: TemporalActConsumedReceipt['leaseTransition'],
): Omit<TemporalActConsumedReceipt['leaseTransition'], 'transitionFingerprint'> {
  const { transitionFingerprint: _ignored, ...base } = structuredClone(transition);
  return base;
}

function dispatchBase(
  dispatch: TemporalEnvironmentDispatchReceipt,
): Omit<TemporalEnvironmentDispatchReceipt, 'dispatchFingerprint' | 'observation'> {
  const {
    dispatchFingerprint: _ignored,
    observation: _observation,
    ...base
  } = structuredClone(dispatch);
  return base;
}

function causalObservationBase(
  receipt: TemporalCausalObservationReceipt,
): Omit<TemporalCausalObservationReceipt, 'observationFingerprintSeal'> {
  const { observationFingerprintSeal: _ignored, ...base } = structuredClone(receipt);
  return base;
}

function actionObservedBase(
  receipt: TemporalActionObservedReceipt,
): Omit<TemporalActionObservedReceipt, 'actionObservedFingerprint'> {
  const { actionObservedFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

function leaseObservedTransitionBase(
  transition: TemporalLeaseObservedTransitionReceipt,
): Omit<TemporalLeaseObservedTransitionReceipt, 'transitionFingerprint'> {
  const { transitionFingerprint: _ignored, ...base } = structuredClone(transition);
  return base;
}

function resumedCheckpointBase(
  checkpoint: TemporalResumedWorkflowCheckpoint,
): Omit<TemporalResumedWorkflowCheckpoint, 'resumedCheckpointFingerprint'> {
  const { resumedCheckpointFingerprint: _ignored, ...base } = structuredClone(checkpoint);
  return base;
}

function resumeReceiptBase(
  receipt: TemporalCausalResumeReceipt,
): Omit<TemporalCausalResumeReceipt, 'receiptFingerprint'> {
  const { receiptFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

export function temporalCausalResumeCheckpointFingerprint(
  checkpoint: Omit<TemporalCausalResumeCheckpoint, 'checkpointFingerprint'>,
): string {
  return fingerprint({
    ...checkpoint,
    boundaryCheckpoint: boundaryCheckpointBase(checkpoint.boundaryCheckpoint),
    consumedObservationRefs: canonicalRefs(checkpoint.consumedObservationRefs),
  });
}

export function temporalCausalObservationFingerprint(
  receipt: Omit<TemporalCausalObservationReceipt, 'observationFingerprintSeal'>,
): string {
  return fingerprint({
    ...receipt,
    observationIdentity: structuredClone(receipt.observationIdentity),
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

export function temporalActionObservedFingerprint(
  receipt: Omit<TemporalActionObservedReceipt, 'actionObservedFingerprint'>,
): string {
  return fingerprint({
    ...receipt,
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

export function temporalLeaseObservedTransitionFingerprint(
  transition: Omit<TemporalLeaseObservedTransitionReceipt, 'transitionFingerprint'>,
): string {
  return fingerprint({
    ...transition,
    evidenceRefs: canonicalRefs(transition.evidenceRefs),
  });
}

export function temporalResumedCheckpointFingerprint(
  checkpoint: Omit<TemporalResumedWorkflowCheckpoint, 'resumedCheckpointFingerprint'>,
): string {
  return fingerprint({
    ...checkpoint,
    consumedObservationRefs: canonicalRefs(checkpoint.consumedObservationRefs),
    evidenceRefs: canonicalRefs(checkpoint.evidenceRefs),
  });
}

export function temporalCausalResumeReceiptFingerprint(
  receipt: Omit<TemporalCausalResumeReceipt, 'receiptFingerprint'>,
): string {
  return fingerprint({
    ...receipt,
    observation: {
      ...receipt.observation,
      evidenceRefs: canonicalRefs(receipt.observation.evidenceRefs),
    },
    actionObserved: {
      ...receipt.actionObserved,
      evidenceRefs: canonicalRefs(receipt.actionObserved.evidenceRefs),
    },
    leaseTransition: {
      ...receipt.leaseTransition,
      evidenceRefs: canonicalRefs(receipt.leaseTransition.evidenceRefs),
    },
    resumedCheckpoint: {
      ...receipt.resumedCheckpoint,
      consumedObservationRefs: canonicalRefs(
        receipt.resumedCheckpoint.consumedObservationRefs,
      ),
      evidenceRefs: canonicalRefs(receipt.resumedCheckpoint.evidenceRefs),
    },
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

function validateBoundaryCheckpoint(
  checkpoint: TemporalActionBoundaryCheckpoint,
): void {
  if (
    checkpoint.status !== 'suspended'
    || !validRef(checkpoint.checkpointRef)
    || !validRef(checkpoint.environmentAdapterRef)
    || !validRef(checkpoint.workflowRef)
    || !validRef(checkpoint.workflowInstanceRef)
    || !validRef(checkpoint.sourceHash)
    || !validRef(checkpoint.runRef)
    || !validRef(checkpoint.timelineRef)
    || !validRef(checkpoint.frameRef)
    || !validRevision(checkpoint.stateRevision)
    || !validRef(checkpoint.pendingIntentRef)
    || !validRef(checkpoint.pendingPermitRef)
    || !validRef(checkpoint.pendingActReceiptRef)
    || !validRef(checkpoint.pendingActReceiptFingerprint)
    || !validRef(checkpoint.preActionSnapshotDigest)
    || !validRef(checkpoint.worldContextRef)
    || !validRef(checkpoint.worldContextDigest)
    || !validRef(checkpoint.responsibilityRef)
    || !validRef(checkpoint.releasedLeaseTransitionRef)
    || !validUniqueRefs(checkpoint.evidenceRefs)
  ) {
    throw new TemporalCausalResumeError(
      'causal resume boundary checkpoint is invalid',
    );
  }
}

function validateCheckpoint(checkpoint: TemporalCausalResumeCheckpoint): void {
  validateBoundaryCheckpoint(checkpoint.boundaryCheckpoint);
  if (
    checkpoint.schemaVersion !== TEMPORAL_CAUSAL_RESUME_CHECKPOINT_SCHEMA_VERSION
    || !validRevision(checkpoint.checkpointSequence)
    || !validRef(checkpoint.awaitingFrameBindingRef)
    || !validRef(checkpoint.suspensionFrameRef)
    || !validOptionalUniqueRefs(checkpoint.consumedObservationRefs)
    || checkpoint.suspensionFrameRef !== checkpoint.boundaryCheckpoint.frameRef
    || checkpoint.checkpointFingerprint
      !== temporalCausalResumeCheckpointFingerprint(checkpointBase(checkpoint))
  ) {
    throw new TemporalCausalResumeError(
      'causal resume checkpoint envelope is invalid',
    );
  }
}

export function createTemporalCausalResumeCheckpoint(
  boundaryCheckpoint: TemporalActionBoundaryCheckpoint,
  checkpointSequence: number,
  awaitingFrameBindingRef: string,
  consumedObservationRefs: readonly string[] = [],
): TemporalCausalResumeCheckpoint {
  const base: Omit<TemporalCausalResumeCheckpoint, 'checkpointFingerprint'> = {
    schemaVersion: TEMPORAL_CAUSAL_RESUME_CHECKPOINT_SCHEMA_VERSION,
    boundaryCheckpoint: structuredClone(boundaryCheckpoint),
    checkpointSequence,
    awaitingFrameBindingRef,
    suspensionFrameRef: boundaryCheckpoint.frameRef,
    consumedObservationRefs: [...consumedObservationRefs],
  };
  const checkpoint: TemporalCausalResumeCheckpoint = {
    ...base,
    checkpointFingerprint: temporalCausalResumeCheckpointFingerprint(base),
  };
  validateCheckpoint(checkpoint);
  return checkpoint;
}

function validateCurrentAuthority(
  authority: TemporalCausalResumeCurrentAuthority,
): void {
  if (
    !validRef(authority.resumeRequestRef)
    || !validRef(authority.currentCheckpointRef)
    || !validRef(authority.currentCheckpointFingerprint)
    || !validRef(authority.currentSourceHash)
    || !validRef(authority.currentRunRef)
    || !validRef(authority.currentTimelineRef)
    || !validRef(authority.currentFrameRef)
    || !validRevision(authority.currentStateRevision)
    || !validRef(authority.currentSemanticSnapshotDigest)
    || !validRef(authority.canonicalDispatchFingerprint)
    || !validRef(authority.canonicalActReceiptFingerprint)
    || !validRef(authority.canonicalLeaseTransitionFingerprint)
    || !validRef(authority.canonicalResponsibleIntentRef)
    || !validRef(authority.operationalReturnBindingRef)
    || [
      authority.checkpointCurrent,
      authority.sourceCurrent,
      authority.responsibilityCurrent,
      authority.responsibleIntentCurrent,
      authority.observedConsequenceBindingCurrent,
    ].some(value => typeof value !== 'boolean')
    || !validUniqueRefs(authority.evidenceRefs)
  ) {
    throw new TemporalCausalResumeError(
      'causal resume current authority is invalid',
    );
  }
  const requiredEvidence = [
    authority.resumeRequestRef,
    authority.currentCheckpointFingerprint,
    authority.currentSemanticSnapshotDigest,
    authority.canonicalDispatchFingerprint,
    authority.canonicalActReceiptFingerprint,
    authority.canonicalLeaseTransitionFingerprint,
    authority.canonicalResponsibleIntentRef,
    authority.operationalReturnBindingRef,
  ];
  if (requiredEvidence.some(ref => !authority.evidenceRefs.includes(ref))) {
    throw new TemporalCausalResumeError(
      'causal resume current authority evidence is incomplete',
    );
  }
}

function validateStaticChain(
  checkpoint: TemporalCausalResumeCheckpoint,
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
  dispatch: TemporalEnvironmentDispatchReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): void {
  if (
    permit.concentrationLease.leaseFingerprint
      !== temporalConcentrationLeaseFingerprint(
        leaseBase(permit.concentrationLease),
      )
    || permit.permitFingerprint
      !== temporalActionReleasePermitFingerprint(permitBase(permit))
    || actReceipt.leaseTransition.transitionFingerprint
      !== temporalActLeaseTransitionFingerprint(
        actTransitionBase(actReceipt.leaseTransition),
      )
    || actReceipt.receiptFingerprint
      !== temporalActTerminalReceiptFingerprint(actReceiptBase(actReceipt))
    || dispatch.dispatchFingerprint
      !== temporalEnvironmentDispatchFingerprint(dispatchBase(dispatch))
  ) {
    throw new TemporalCausalResumeError(
      'causal resume static fingerprint chain is invalid',
    );
  }
  if (
    actReceipt.status !== 'consumed'
    || actReceipt.permitConsumed !== true
    || actReceipt.actionReleased !== true
    || actReceipt.actCompleted !== true
    || actReceipt.leaseTransition.fromState !== 'validated'
    || actReceipt.leaseTransition.toState !== 'released'
    || actReceipt.actOutput.dispatchStatus !== 'pending_environment_boundary'
  ) {
    throw new TemporalCausalResumeError(
      'causal resume requires one consumed ACT output and released lease',
    );
  }

  const boundary = checkpoint.boundaryCheckpoint;
  if (
    attempt.checkpointRef !== boundary.checkpointRef
    || attempt.workflowRef !== boundary.workflowRef
    || attempt.workflowInstanceRef !== boundary.workflowInstanceRef
    || attempt.sourceHash !== boundary.sourceHash
    || attempt.runRef !== boundary.runRef
    || attempt.timelineRef !== boundary.timelineRef
    || attempt.frameRef !== boundary.frameRef
    || attempt.actionIntentRef !== boundary.pendingIntentRef
    || attempt.actionReleasePermitRef !== boundary.pendingPermitRef
    || attempt.actReceiptRef !== boundary.pendingActReceiptRef
    || attempt.preActionSnapshotDigest !== boundary.preActionSnapshotDigest
    || dispatch.actionIntentRef !== attempt.actionIntentRef
    || dispatch.actionReleasePermitRef !== attempt.actionReleasePermitRef
    || dispatch.actReceiptRef !== attempt.actReceiptRef
    || dispatch.actionRef !== attempt.actionRef
    || permit.intentRef !== attempt.actionIntentRef
    || permit.permitRef !== attempt.actionReleasePermitRef
    || permit.actionCandidateRef !== attempt.actionRef
    || actReceipt.intentRef !== attempt.actionIntentRef
    || actReceipt.permitRef !== attempt.actionReleasePermitRef
    || actReceipt.receiptRef !== attempt.actReceiptRef
    || actReceipt.actionRef !== attempt.actionRef
    || actReceipt.leaseTransition.leaseRef
      !== permit.concentrationLease.leaseRef
    || actReceipt.leaseTransition.permitRef !== permit.permitRef
    || actReceipt.leaseTransition.actionIntentRef !== permit.intentRef
    || actReceipt.leaseTransition.transitionRef
      !== boundary.releasedLeaseTransitionRef
  ) {
    throw new TemporalCausalResumeError(
      'causal resume dispatch, checkpoint, intent, permit or ACT lineage mismatch',
    );
  }
  if (
    !sameIdentity(permit.temporalIdentity, actReceipt.temporalIdentity)
    || dispatch.observationIdentity.episodeId !== attempt.timelineRef
    || dispatch.observation.sessionId !== attempt.runRef
    || dispatch.observation.sequence <= permit.observationSequence
    || dispatch.observationIdentity.observationId === attempt.frameRef
    || dispatch.observationIdentity.observationRevision <= attempt.stateRevision
    || dispatch.observationFingerprint
      !== fingerprintAgentObservation(dispatch.observation)
  ) {
    throw new TemporalCausalResumeError(
      'causal resume acquired observation identity or chronology is invalid',
    );
  }
}

function refusalReason(
  checkpoint: TemporalCausalResumeCheckpoint,
  dispatch: TemporalEnvironmentDispatchReceipt,
  actReceipt: TemporalActConsumedReceipt,
  authority: TemporalCausalResumeCurrentAuthority,
): TemporalCausalResumeRefusalReason | null {
  const boundary = checkpoint.boundaryCheckpoint;
  if (
    !authority.checkpointCurrent
    || authority.currentCheckpointRef !== boundary.checkpointRef
    || authority.currentCheckpointFingerprint !== checkpoint.checkpointFingerprint
  ) return 'checkpoint_not_current';
  if (
    !authority.sourceCurrent
    || authority.currentSourceHash !== boundary.sourceHash
  ) return 'source_changed';
  if (authority.currentRunRef !== boundary.runRef) return 'run_changed';
  if (authority.currentTimelineRef !== boundary.timelineRef) {
    return 'timeline_changed';
  }
  if (authority.currentFrameRef !== boundary.frameRef) return 'frame_changed';
  if (
    authority.currentStateRevision
      !== dispatch.observationIdentity.observationRevision
  ) return 'state_revision_changed';
  if (
    authority.currentSemanticSnapshotDigest
      !== boundary.preActionSnapshotDigest
  ) return 'semantic_snapshot_changed';
  if (!authority.responsibilityCurrent) return 'responsibility_not_current';
  if (
    !authority.responsibleIntentCurrent
    || authority.canonicalResponsibleIntentRef !== boundary.pendingIntentRef
  ) return 'responsible_intent_not_current';
  if (!authority.observedConsequenceBindingCurrent) {
    return 'observed_consequence_binding_not_current';
  }
  if (authority.canonicalDispatchFingerprint !== dispatch.dispatchFingerprint) {
    return 'canonical_dispatch_changed';
  }
  if (
    authority.canonicalActReceiptFingerprint !== actReceipt.receiptFingerprint
  ) return 'canonical_act_receipt_changed';
  if (
    authority.canonicalLeaseTransitionFingerprint
      !== actReceipt.leaseTransition.transitionFingerprint
  ) return 'canonical_lease_transition_changed';
  return null;
}

function buildObservationReceipt(
  checkpoint: TemporalCausalResumeCheckpoint,
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
  dispatch: TemporalEnvironmentDispatchReceipt,
  authority: TemporalCausalResumeCurrentAuthority,
): TemporalCausalObservationReceipt {
  const boundary = checkpoint.boundaryCheckpoint;
  const evidenceRefs = canonicalRefs([
    ...boundary.evidenceRefs,
    ...attempt.evidenceRefs,
    ...dispatch.evidenceRefs,
    ...authority.evidenceRefs,
    checkpoint.checkpointFingerprint,
    dispatch.dispatchFingerprint,
    dispatch.responseDigest,
    dispatch.environmentActionEventRef,
    dispatch.observationFingerprint,
  ]);
  const base: Omit<
    TemporalCausalObservationReceipt,
    'observationFingerprintSeal'
  > = {
    schemaVersion: TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION,
    observationReceiptRef: `temporal-observation-acquired:${dispatch.dispatchRef}`,
    dispatchRef: dispatch.dispatchRef,
    dispatchFingerprint: dispatch.dispatchFingerprint,
    environmentActionEventRef: dispatch.environmentActionEventRef,
    actionIntentRef: dispatch.actionIntentRef,
    actionReleasePermitRef: dispatch.actionReleasePermitRef,
    actReceiptRef: dispatch.actReceiptRef,
    workflowRef: boundary.workflowRef,
    workflowInstanceRef: boundary.workflowInstanceRef,
    sourceHash: boundary.sourceHash,
    runRef: boundary.runRef,
    timelineRef: boundary.timelineRef,
    previousFrameRef: boundary.frameRef,
    frameRef: dispatch.observationIdentity.observationId,
    stateRevision: dispatch.observationIdentity.observationRevision,
    observationIdentity: structuredClone(dispatch.observationIdentity),
    observationSequence: dispatch.observation.sequence,
    rawInputRef: `temporal-raw-input:${dispatch.observationFingerprint}`,
    observationFingerprint: dispatch.observationFingerprint,
    acquisitionModelRef: 'transport.causal_frame',
    evidenceRefs,
  };
  return {
    ...base,
    observationFingerprintSeal: temporalCausalObservationFingerprint(base),
  };
}

function buildActionObservedReceipt(
  observation: TemporalCausalObservationReceipt,
  authority: TemporalCausalResumeCurrentAuthority,
): TemporalActionObservedReceipt {
  const evidenceRefs = canonicalRefs([
    ...observation.evidenceRefs,
    ...authority.evidenceRefs,
    observation.observationFingerprintSeal,
    authority.operationalReturnBindingRef,
  ]);
  const base: Omit<TemporalActionObservedReceipt, 'actionObservedFingerprint'> = {
    schemaVersion: TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION,
    actionObservedRef: [
      'temporal-action-observed',
      observation.workflowInstanceRef,
      String(observation.stateRevision),
    ].join(':'),
    operationalReturnBindingRef: authority.operationalReturnBindingRef,
    dispatchRef: observation.dispatchRef,
    environmentActionEventRef: observation.environmentActionEventRef,
    actionIntentRef: observation.actionIntentRef,
    actionReleasePermitRef: observation.actionReleasePermitRef,
    actReceiptRef: observation.actReceiptRef,
    observationReceiptRef: observation.observationReceiptRef,
    workflowRef: observation.workflowRef,
    workflowInstanceRef: observation.workflowInstanceRef,
    sourceHash: observation.sourceHash,
    runRef: observation.runRef,
    timelineRef: observation.timelineRef,
    frameRef: observation.frameRef,
    stateRevision: observation.stateRevision,
    evidenceRefs,
  };
  return {
    ...base,
    actionObservedFingerprint: temporalActionObservedFingerprint(base),
  };
}

function buildLeaseTransition(
  permit: TemporalActionReleasePermitReceipt,
  observation: TemporalCausalObservationReceipt,
  actionObserved: TemporalActionObservedReceipt,
): TemporalLeaseObservedTransitionReceipt {
  const evidenceRefs = canonicalRefs([
    ...permit.evidenceRefs,
    ...observation.evidenceRefs,
    ...actionObserved.evidenceRefs,
    permit.concentrationLease.leaseFingerprint,
    observation.observationFingerprintSeal,
    actionObserved.actionObservedFingerprint,
  ]);
  const base: Omit<
    TemporalLeaseObservedTransitionReceipt,
    'transitionFingerprint'
  > = {
    schemaVersion: TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION,
    transitionRef: [
      'temporal-lease-observed',
      permit.concentrationLease.leaseRef,
      observation.observationReceiptRef,
    ].join(':'),
    leaseRef: permit.concentrationLease.leaseRef,
    permitRef: permit.permitRef,
    actionIntentRef: permit.intentRef,
    workflowRef: observation.workflowRef,
    sourceHash: observation.sourceHash,
    runRef: observation.runRef,
    timelineRef: observation.timelineRef,
    frameRef: observation.frameRef,
    stateRevision: observation.stateRevision,
    fromState: 'released',
    toState: 'observed',
    reasonRef: observation.observationReceiptRef,
    actionObservedRef: actionObserved.actionObservedRef,
    evidenceRefs,
  };
  return {
    ...base,
    transitionFingerprint: temporalLeaseObservedTransitionFingerprint(base),
  };
}

function buildResumedCheckpoint(
  checkpoint: TemporalCausalResumeCheckpoint,
  observation: TemporalCausalObservationReceipt,
  actionObserved: TemporalActionObservedReceipt,
  leaseTransition: TemporalLeaseObservedTransitionReceipt,
): TemporalResumedWorkflowCheckpoint {
  const boundary = checkpoint.boundaryCheckpoint;
  const consumedObservationRefs = canonicalRefs([
    ...checkpoint.consumedObservationRefs,
    observation.observationReceiptRef,
  ]);
  const evidenceRefs = canonicalRefs([
    ...boundary.evidenceRefs,
    ...observation.evidenceRefs,
    ...actionObserved.evidenceRefs,
    ...leaseTransition.evidenceRefs,
    checkpoint.checkpointFingerprint,
    observation.observationFingerprintSeal,
    actionObserved.actionObservedFingerprint,
    leaseTransition.transitionFingerprint,
  ]);
  const nextSequence = checkpoint.checkpointSequence + 1;
  const base: Omit<
    TemporalResumedWorkflowCheckpoint,
    'resumedCheckpointFingerprint'
  > = {
    schemaVersion: TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION,
    resumedCheckpointRef: [
      'temporal-workflow-resumed',
      boundary.workflowInstanceRef,
      String(nextSequence),
    ].join(':'),
    previousCheckpointRef: boundary.checkpointRef,
    previousCheckpointFingerprint: checkpoint.checkpointFingerprint,
    workflowRef: boundary.workflowRef,
    workflowInstanceRef: boundary.workflowInstanceRef,
    sourceHash: boundary.sourceHash,
    runRef: boundary.runRef,
    timelineRef: boundary.timelineRef,
    previousFrameRef: boundary.frameRef,
    frameRef: observation.frameRef,
    stateRevision: observation.stateRevision,
    checkpointSequence: nextSequence,
    status: 'active',
    awaitingFrameBindingRef: checkpoint.awaitingFrameBindingRef,
    boundRawInputRef: observation.rawInputRef,
    consumedObservationRefs,
    pendingActionLineageCleared: true,
    observationReceiptRef: observation.observationReceiptRef,
    actionObservedRef: actionObserved.actionObservedRef,
    leaseObservedTransitionRef: leaseTransition.transitionRef,
    evidenceRefs,
  };
  return {
    ...base,
    resumedCheckpointFingerprint: temporalResumedCheckpointFingerprint(base),
  };
}

function buildResumeReceipt(
  checkpoint: TemporalCausalResumeCheckpoint,
  dispatch: TemporalEnvironmentDispatchReceipt,
  observation: TemporalCausalObservationReceipt,
  actionObserved: TemporalActionObservedReceipt,
  leaseTransition: TemporalLeaseObservedTransitionReceipt,
  resumedCheckpoint: TemporalResumedWorkflowCheckpoint,
): TemporalCausalResumeReceipt {
  const evidenceRefs = canonicalRefs([
    ...observation.evidenceRefs,
    ...actionObserved.evidenceRefs,
    ...leaseTransition.evidenceRefs,
    ...resumedCheckpoint.evidenceRefs,
    checkpoint.checkpointFingerprint,
    dispatch.dispatchFingerprint,
  ]);
  const base: Omit<TemporalCausalResumeReceipt, 'receiptFingerprint'> = {
    schemaVersion: TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION,
    resumeRef: [
      'temporal-causal-resume',
      checkpoint.boundaryCheckpoint.checkpointRef,
      dispatch.dispatchRef,
    ].join(':'),
    dispatchRef: dispatch.dispatchRef,
    dispatchFingerprint: dispatch.dispatchFingerprint,
    checkpointRef: checkpoint.boundaryCheckpoint.checkpointRef,
    checkpointFingerprint: checkpoint.checkpointFingerprint,
    observation,
    actionObserved,
    leaseTransition,
    resumedCheckpoint,
    evidenceRefs,
    observationConsumed: true,
    checkpointResumed: true,
    causalResumeAuthorized: true,
    workflowResumed: true,
  };
  return {
    ...base,
    receiptFingerprint: temporalCausalResumeReceiptFingerprint(base),
  };
}

function validateObservationReceipt(
  receipt: TemporalCausalObservationReceipt,
): void {
  if (
    receipt.schemaVersion !== TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION
    || !validRef(receipt.observationReceiptRef)
    || !validRef(receipt.dispatchRef)
    || !validRef(receipt.dispatchFingerprint)
    || !validRef(receipt.environmentActionEventRef)
    || !validRef(receipt.actionIntentRef)
    || !validRef(receipt.actionReleasePermitRef)
    || !validRef(receipt.actReceiptRef)
    || !validRef(receipt.workflowRef)
    || !validRef(receipt.workflowInstanceRef)
    || !validRef(receipt.sourceHash)
    || !validRef(receipt.runRef)
    || !validRef(receipt.timelineRef)
    || !validRef(receipt.previousFrameRef)
    || !validRef(receipt.frameRef)
    || !validRevision(receipt.stateRevision)
    || !validRef(receipt.observationIdentity.episodeId)
    || !validLevelEpoch(receipt.observationIdentity.levelEpoch)
    || !validRef(receipt.observationIdentity.observationId)
    || !validRevision(receipt.observationIdentity.observationRevision)
    || receipt.observationIdentity.episodeId !== receipt.timelineRef
    || receipt.observationIdentity.observationId !== receipt.frameRef
    || receipt.observationIdentity.observationRevision !== receipt.stateRevision
    || receipt.previousFrameRef === receipt.frameRef
    || !validRevision(receipt.observationSequence)
    || !validRef(receipt.rawInputRef)
    || !validRef(receipt.observationFingerprint)
    || receipt.acquisitionModelRef !== 'transport.causal_frame'
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.observationFingerprintSeal
      !== temporalCausalObservationFingerprint(causalObservationBase(receipt))
  ) {
    throw new TemporalCausalResumeError(
      'causal observation receipt is invalid',
    );
  }
}

function validateActionObservedReceipt(
  receipt: TemporalActionObservedReceipt,
): void {
  if (
    receipt.schemaVersion !== TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION
    || !validRef(receipt.actionObservedRef)
    || !validRef(receipt.operationalReturnBindingRef)
    || !validRef(receipt.dispatchRef)
    || !validRef(receipt.environmentActionEventRef)
    || !validRef(receipt.actionIntentRef)
    || !validRef(receipt.actionReleasePermitRef)
    || !validRef(receipt.actReceiptRef)
    || !validRef(receipt.observationReceiptRef)
    || !validRef(receipt.workflowRef)
    || !validRef(receipt.workflowInstanceRef)
    || !validRef(receipt.sourceHash)
    || !validRef(receipt.runRef)
    || !validRef(receipt.timelineRef)
    || !validRef(receipt.frameRef)
    || !validRevision(receipt.stateRevision)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.actionObservedFingerprint
      !== temporalActionObservedFingerprint(actionObservedBase(receipt))
  ) {
    throw new TemporalCausalResumeError(
      'action-observed receipt is invalid',
    );
  }
}

function validateLeaseTransition(
  transition: TemporalLeaseObservedTransitionReceipt,
): void {
  if (
    transition.schemaVersion
      !== TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION
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
    || transition.fromState !== 'released'
    || transition.toState !== 'observed'
    || !validRef(transition.reasonRef)
    || !validRef(transition.actionObservedRef)
    || !validUniqueRefs(transition.evidenceRefs)
    || transition.transitionFingerprint
      !== temporalLeaseObservedTransitionFingerprint(
        leaseObservedTransitionBase(transition),
      )
  ) {
    throw new TemporalCausalResumeError(
      'lease observed transition is invalid',
    );
  }
}

function validateResumedCheckpoint(
  checkpoint: TemporalResumedWorkflowCheckpoint,
): void {
  if (
    checkpoint.schemaVersion !== TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION
    || !validRef(checkpoint.resumedCheckpointRef)
    || !validRef(checkpoint.previousCheckpointRef)
    || !validRef(checkpoint.previousCheckpointFingerprint)
    || !validRef(checkpoint.workflowRef)
    || !validRef(checkpoint.workflowInstanceRef)
    || !validRef(checkpoint.sourceHash)
    || !validRef(checkpoint.runRef)
    || !validRef(checkpoint.timelineRef)
    || !validRef(checkpoint.previousFrameRef)
    || !validRef(checkpoint.frameRef)
    || checkpoint.previousFrameRef === checkpoint.frameRef
    || !validRevision(checkpoint.stateRevision)
    || !validRevision(checkpoint.checkpointSequence)
    || checkpoint.status !== 'active'
    || !validRef(checkpoint.awaitingFrameBindingRef)
    || !validRef(checkpoint.boundRawInputRef)
    || !validUniqueRefs(checkpoint.consumedObservationRefs)
    || checkpoint.pendingActionLineageCleared !== true
    || !validRef(checkpoint.observationReceiptRef)
    || !validRef(checkpoint.actionObservedRef)
    || !validRef(checkpoint.leaseObservedTransitionRef)
    || !validUniqueRefs(checkpoint.evidenceRefs)
    || checkpoint.resumedCheckpointFingerprint
      !== temporalResumedCheckpointFingerprint(
        resumedCheckpointBase(checkpoint),
      )
  ) {
    throw new TemporalCausalResumeError(
      'resumed workflow checkpoint is invalid',
    );
  }
}

function validateResumeReceipt(receipt: TemporalCausalResumeReceipt): void {
  validateObservationReceipt(receipt.observation);
  validateActionObservedReceipt(receipt.actionObserved);
  validateLeaseTransition(receipt.leaseTransition);
  validateResumedCheckpoint(receipt.resumedCheckpoint);
  if (
    receipt.schemaVersion !== TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION
    || !validRef(receipt.resumeRef)
    || !validRef(receipt.dispatchRef)
    || !validRef(receipt.dispatchFingerprint)
    || !validRef(receipt.checkpointRef)
    || !validRef(receipt.checkpointFingerprint)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.observationConsumed !== true
    || receipt.checkpointResumed !== true
    || receipt.causalResumeAuthorized !== true
    || receipt.workflowResumed !== true
    || receipt.observation.dispatchRef !== receipt.dispatchRef
    || receipt.observation.dispatchFingerprint !== receipt.dispatchFingerprint
    || receipt.actionObserved.dispatchRef !== receipt.dispatchRef
    || receipt.checkpointRef
      !== receipt.resumedCheckpoint.previousCheckpointRef
    || receipt.checkpointFingerprint
      !== receipt.resumedCheckpoint.previousCheckpointFingerprint
    || receipt.actionObserved.observationReceiptRef
      !== receipt.observation.observationReceiptRef
    || receipt.actionObserved.environmentActionEventRef
      !== receipt.observation.environmentActionEventRef
    || receipt.leaseTransition.reasonRef
      !== receipt.observation.observationReceiptRef
    || receipt.leaseTransition.actionObservedRef
      !== receipt.actionObserved.actionObservedRef
    || receipt.resumedCheckpoint.observationReceiptRef
      !== receipt.observation.observationReceiptRef
    || receipt.resumedCheckpoint.actionObservedRef
      !== receipt.actionObserved.actionObservedRef
    || receipt.resumedCheckpoint.leaseObservedTransitionRef
      !== receipt.leaseTransition.transitionRef
    || receipt.receiptFingerprint
      !== temporalCausalResumeReceiptFingerprint(resumeReceiptBase(receipt))
  ) {
    throw new TemporalCausalResumeError(
      'temporal causal resume receipt is invalid',
    );
  }
}

function validateJournal(journal: TemporalCausalResumeJournal): void {
  if (
    journal.schemaVersion !== TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION
    || !Number.isInteger(journal.maxResumes)
    || journal.maxResumes < 1
    || journal.maxResumes > MAX_RESUMES_LIMIT
    || journal.receipts.length > journal.maxResumes
  ) {
    throw new TemporalCausalResumeError(
      'temporal causal resume journal envelope is invalid',
    );
  }
  const resumeRefs = new Set<string>();
  const dispatchRefs = new Set<string>();
  const checkpointRefs = new Set<string>();
  const observationRefs = new Set<string>();
  const eventRefs = new Set<string>();
  for (const receipt of journal.receipts) {
    validateResumeReceipt(receipt);
    if (
      resumeRefs.has(receipt.resumeRef)
      || dispatchRefs.has(receipt.dispatchRef)
      || checkpointRefs.has(receipt.checkpointRef)
      || observationRefs.has(receipt.observation.observationReceiptRef)
      || eventRefs.has(receipt.observation.environmentActionEventRef)
    ) {
      throw new TemporalCausalResumeError(
        'temporal causal resume journal contains duplicate causal identity',
      );
    }
    resumeRefs.add(receipt.resumeRef);
    dispatchRefs.add(receipt.dispatchRef);
    checkpointRefs.add(receipt.checkpointRef);
    observationRefs.add(receipt.observation.observationReceiptRef);
    eventRefs.add(receipt.observation.environmentActionEventRef);
  }
}

export function createTemporalCausalResumeJournal(
  maxResumes = DEFAULT_MAX_RESUMES,
): TemporalCausalResumeJournal {
  const journal: TemporalCausalResumeJournal = {
    schemaVersion: TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION,
    maxResumes,
    receipts: [],
  };
  validateJournal(journal);
  return journal;
}

export function restoreTemporalCausalResumeJournal(
  snapshot: TemporalCausalResumeJournal,
): TemporalCausalResumeJournal {
  const restored = structuredClone(snapshot);
  validateJournal(restored);
  return restored;
}

function appendReceipt(
  journal: TemporalCausalResumeJournal,
  receipt: TemporalCausalResumeReceipt,
): TemporalCausalResumeJournal {
  if (journal.receipts.length >= journal.maxResumes) {
    throw new TemporalCausalResumeError(
      'temporal causal resume journal capacity reached',
    );
  }
  const next: TemporalCausalResumeJournal = {
    ...structuredClone(journal),
    receipts: [
      ...journal.receipts.map(item => structuredClone(item)),
      structuredClone(receipt),
    ],
  };
  validateJournal(next);
  return next;
}

export function resumeTemporalWorkflowFromDispatch(
  input: ResumeTemporalWorkflowFromDispatchInput,
): TemporalCausalResumeResult {
  validateJournal(input.journal);
  validateCheckpoint(input.checkpoint);
  validateCurrentAuthority(input.currentAuthority);

  const boundaryJournal = restoreTemporalActionBoundaryJournal(
    input.boundaryJournal,
  );
  const attempt = boundaryJournal.attempts.find(
    item => item.dispatchRef === input.dispatchRef,
  );
  const dispatch = boundaryJournal.dispatches.find(
    item => item.dispatchRef === input.dispatchRef,
  );
  if (!dispatch) {
    if (attempt) {
      throw new TemporalCausalResumeUnknownOutcomeError(
        attempt.dispatchRef,
        attempt.requestDigest,
      );
    }
    throw new TemporalCausalResumeError(
      'causal resume requires a durable dispatch receipt',
    );
  }
  if (!attempt) {
    throw new TemporalCausalResumeError(
      'durable dispatch has no exact attempt lineage',
    );
  }

  validateStaticChain(
    input.checkpoint,
    attempt,
    dispatch,
    input.permit,
    input.actReceipt,
  );

  const existingByDispatch = input.journal.receipts.find(
    receipt => receipt.dispatchRef === dispatch.dispatchRef,
  );
  if (existingByDispatch) {
    if (
      existingByDispatch.dispatchFingerprint !== dispatch.dispatchFingerprint
      || existingByDispatch.checkpointRef
        !== input.checkpoint.boundaryCheckpoint.checkpointRef
      || existingByDispatch.checkpointFingerprint
        !== input.checkpoint.checkpointFingerprint
    ) {
      throw new TemporalCausalResumeError(
        'causal dispatch identity conflicts with an existing resume receipt',
      );
    }
    return {
      journal: structuredClone(input.journal),
      receipt: structuredClone(existingByDispatch),
      emittedResumedCheckpoint: null,
      reused: true,
    };
  }
  const existingByCheckpoint = input.journal.receipts.find(
    receipt => (
      receipt.checkpointRef === input.checkpoint.boundaryCheckpoint.checkpointRef
    ),
  );
  if (existingByCheckpoint) {
    throw new TemporalCausalResumeError(
      'suspended checkpoint already resumed from another dispatch',
    );
  }

  const expectedObservationRef = `temporal-observation-acquired:${dispatch.dispatchRef}`;
  if (
    input.checkpoint.consumedObservationRefs.includes(expectedObservationRef)
    || input.journal.receipts.some(receipt => (
      receipt.observation.environmentActionEventRef
        === dispatch.environmentActionEventRef
    ))
  ) {
    throw new TemporalCausalResumeError(
      'causal observation or environment event was already consumed',
    );
  }

  const reason = refusalReason(
    input.checkpoint,
    dispatch,
    input.actReceipt,
    input.currentAuthority,
  );
  if (reason) throw new TemporalCausalResumeRefusedError(reason);

  const observation = buildObservationReceipt(
    input.checkpoint,
    attempt,
    dispatch,
    input.currentAuthority,
  );
  const actionObserved = buildActionObservedReceipt(
    observation,
    input.currentAuthority,
  );
  const leaseTransition = buildLeaseTransition(
    input.permit,
    observation,
    actionObserved,
  );
  const resumedCheckpoint = buildResumedCheckpoint(
    input.checkpoint,
    observation,
    actionObserved,
    leaseTransition,
  );
  const receipt = buildResumeReceipt(
    input.checkpoint,
    dispatch,
    observation,
    actionObserved,
    leaseTransition,
    resumedCheckpoint,
  );
  validateResumeReceipt(receipt);
  const journal = appendReceipt(input.journal, receipt);
  return {
    journal,
    receipt: structuredClone(receipt),
    emittedResumedCheckpoint: structuredClone(resumedCheckpoint),
    reused: false,
  };
}
