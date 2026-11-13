import type { TemporalObservationIdentity } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { AgentAction, AgentObservation } from './contracts.ts';
import { isAgentAction } from './contracts.ts';
import { fingerprintAgentObservation } from './v6-temporal-decision-port.ts';
import {
  temporalPreparedActionBindingFingerprint,
  type TemporalPreparedActionBindingReceipt,
} from './v6-temporal-action-binding.ts';
import {
  temporalActionReleasePermitFingerprint,
  temporalAvailableActionRef,
  temporalConcentrationLeaseFingerprint,
  type TemporalActionReleasePermitReceipt,
  type TemporalConcentrationLeaseReceipt,
} from './v6-temporal-action-release-permit.ts';
import {
  temporalActLeaseTransitionFingerprint,
  temporalActTerminalReceiptFingerprint,
  type TemporalActConsumedReceipt,
} from './v6-temporal-act-consumption.ts';

/**
 * Reconstructed V6 environment boundary through durable dispatch recording.
 *
 * The historical donor persists an attempt before the first external call. Once
 * such an attempt exists without a durable dispatch record, the outcome is
 * unknown and automatic redelivery is forbidden. This module preserves that
 * fail-closed property. It deliberately stops before causal workflow resume.
 */

export const TEMPORAL_ACTION_BOUNDARY_CHECKPOINT_SCHEMA_VERSION =
  'sra.temporal_action_boundary_checkpoint.v1' as const;
export const TEMPORAL_ENVIRONMENT_ACTION_REQUEST_SCHEMA_VERSION =
  'sra.temporal_environment_action_request.v1' as const;
export const TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION =
  'sra.temporal_environment_action_response.v1' as const;
export const TEMPORAL_ENVIRONMENT_ATTEMPT_SCHEMA_VERSION =
  'sra.temporal_environment_attempt.v1' as const;
export const TEMPORAL_ENVIRONMENT_DISPATCH_SCHEMA_VERSION =
  'sra.temporal_environment_dispatch.v1' as const;
export const TEMPORAL_ACTION_BOUNDARY_JOURNAL_SCHEMA_VERSION =
  'sra.temporal_action_boundary_journal.v1' as const;

const DEFAULT_MAX_DISPATCHES = 128;
const MAX_DISPATCHES_LIMIT = 1024;

type MaybePromise<T> = T | Promise<T>;

export type TemporalTransportMetadataValue = string | number | boolean | null;
export type TemporalTransportMetadata = Readonly<
  Record<string, TemporalTransportMetadataValue>
>;

export interface TemporalActionBoundaryCheckpoint {
  schemaVersion: typeof TEMPORAL_ACTION_BOUNDARY_CHECKPOINT_SCHEMA_VERSION;
  checkpointRef: string;
  status: 'suspended';
  environmentAdapterRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  pendingIntentRef: string;
  pendingPermitRef: string;
  pendingActReceiptRef: string;
  pendingActReceiptFingerprint: string;
  preActionSnapshotDigest: string;
  worldContextRef: string;
  worldContextDigest: string;
  responsibilityRef: string;
  releasedLeaseTransitionRef: string;
  evidenceRefs: readonly string[];
}

export type TemporalActionBoundaryCurrentLeaseState =
  | 'validated'
  | 'released'
  | 'invalidated'
  | 'expired';

export interface TemporalActionBoundaryCurrentAuthority {
  boundaryRequestRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  currentSnapshotDigest: string;
  currentAvailableActionRef: string;
  environmentAdapterRef: string;
  worldContextRef: string;
  worldContextDigest: string;
  canonicalBindingFingerprint: string;
  canonicalPermitFingerprint: string;
  canonicalActReceiptFingerprint: string;
  canonicalLeaseTransitionFingerprint: string;
  currentLeaseState: TemporalActionBoundaryCurrentLeaseState;
  checkpointCurrent: boolean;
  sourceCurrent: boolean;
  responsibilityCurrent: boolean;
  intentCurrent: boolean;
  bindingCurrent: boolean;
  permitCurrent: boolean;
  actReceiptCurrent: boolean;
  releasedLeaseCurrent: boolean;
  worldContextCurrent: boolean;
  environmentAdapterCurrent: boolean;
  evidenceRefs: readonly string[];
}

export interface TemporalEnvironmentActionRequest {
  schemaVersion: typeof TEMPORAL_ENVIRONMENT_ACTION_REQUEST_SCHEMA_VERSION;
  dispatchRef: string;
  environmentAdapterRef: string;
  checkpointRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  actionRef: string;
  action: AgentAction;
  observationSequence: number;
  preActionSnapshotDigest: string;
  worldContextRef: string;
  worldContextDigest: string;
  requestDigest: string;
}

export interface TemporalEnvironmentActionResponse {
  schemaVersion: typeof TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION;
  dispatchRef: string;
  environmentActionEventRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  observationIdentity: TemporalObservationIdentity;
  observation: AgentObservation;
  observationFingerprint: string;
  responseDigest: string;
  transportMetadata: TemporalTransportMetadata;
}

export interface TemporalEnvironmentDispatchAttemptReceipt {
  schemaVersion: typeof TEMPORAL_ENVIRONMENT_ATTEMPT_SCHEMA_VERSION;
  attemptRef: string;
  dispatchRef: string;
  requestDigest: string;
  environmentAdapterRef: string;
  checkpointRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  actionRef: string;
  actionId: number;
  preActionSnapshotDigest: string;
  worldContextRef: string;
  worldContextDigest: string;
  outcomeStatus: 'prepared';
  redeliveryPermitted: false;
  evidenceRefs: readonly string[];
  attemptFingerprint: string;
}

export interface TemporalEnvironmentDispatchReceipt {
  schemaVersion: typeof TEMPORAL_ENVIRONMENT_DISPATCH_SCHEMA_VERSION;
  dispatchReceiptRef: string;
  dispatchRef: string;
  attemptRef: string;
  attemptFingerprint: string;
  requestDigest: string;
  responseDigest: string;
  environmentActionEventRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  actionRef: string;
  observationIdentity: TemporalObservationIdentity;
  observation: AgentObservation;
  observationFingerprint: string;
  transportMetadata: TemporalTransportMetadata;
  outcomeStatus: 'dispatched';
  redeliveryPermitted: false;
  causalResumeAuthorized: false;
  workflowResumed: false;
  evidenceRefs: readonly string[];
  dispatchFingerprint: string;
}

export interface TemporalActionBoundaryJournal {
  schemaVersion: typeof TEMPORAL_ACTION_BOUNDARY_JOURNAL_SCHEMA_VERSION;
  maxDispatches: number;
  attempts: readonly TemporalEnvironmentDispatchAttemptReceipt[];
  dispatches: readonly TemporalEnvironmentDispatchReceipt[];
}

export interface TemporalEnvironmentTransport {
  execute(
    request: TemporalEnvironmentActionRequest,
  ): MaybePromise<TemporalEnvironmentActionResponse>;
}

export interface TemporalActionBoundaryPersistence {
  persistAttempt(
    journal: TemporalActionBoundaryJournal,
    attempt: TemporalEnvironmentDispatchAttemptReceipt,
  ): MaybePromise<TemporalActionBoundaryJournal>;
  persistDispatch(
    journal: TemporalActionBoundaryJournal,
    dispatch: TemporalEnvironmentDispatchReceipt,
  ): MaybePromise<TemporalActionBoundaryJournal>;
}

export interface TemporalActionBoundaryQualificationHooks {
  afterAttemptPersistedBeforeTransport?(
    request: TemporalEnvironmentActionRequest,
    journal: TemporalActionBoundaryJournal,
  ): MaybePromise<void>;
  afterTransportBeforeDispatchPersistence?(
    request: TemporalEnvironmentActionRequest,
    response: TemporalEnvironmentActionResponse,
    journal: TemporalActionBoundaryJournal,
  ): MaybePromise<void>;
}

export interface DispatchTemporalActOutputInput {
  journal: TemporalActionBoundaryJournal;
  checkpoint: TemporalActionBoundaryCheckpoint;
  currentAuthority: TemporalActionBoundaryCurrentAuthority;
  observation: AgentObservation;
  binding: TemporalPreparedActionBindingReceipt;
  permit: TemporalActionReleasePermitReceipt;
  actReceipt: TemporalActConsumedReceipt;
  persistence: TemporalActionBoundaryPersistence;
  transport: TemporalEnvironmentTransport;
  qualificationHooks?: TemporalActionBoundaryQualificationHooks;
}

export interface TemporalActionBoundaryDispatchResult {
  status: 'dispatched';
  journal: TemporalActionBoundaryJournal;
  request: TemporalEnvironmentActionRequest;
  dispatch: TemporalEnvironmentDispatchReceipt;
  response: TemporalEnvironmentActionResponse;
  reused: boolean;
  transportCalled: boolean;
  observationAcquired: true;
  causalResumeAuthorized: false;
  workflowResumed: false;
}

export type TemporalActionBoundaryDispatchRefusalReason =
  | 'checkpoint_not_current'
  | 'source_changed'
  | 'responsibility_not_current'
  | 'intent_not_current'
  | 'binding_not_current'
  | 'permit_not_current'
  | 'act_receipt_not_current'
  | 'lease_not_released'
  | 'state_revision_changed'
  | 'observation_snapshot_changed'
  | 'action_unavailable'
  | 'world_context_changed'
  | 'environment_adapter_changed';

export class TemporalActionBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalActionBoundaryError';
  }
}

export class TemporalActionBoundaryDispatchRefusedError
  extends TemporalActionBoundaryError {
  readonly outcomeStatus = 'not_dispatched_release_refused' as const;
  readonly redeliveryPermitted = false as const;
  readonly reconciliationRequired = true as const;
  readonly transportAttempted = false as const;

  constructor(
    readonly reason: TemporalActionBoundaryDispatchRefusalReason,
  ) {
    super(`temporal ActionBoundary refused before transport: ${reason}`);
    this.name = 'TemporalActionBoundaryDispatchRefusedError';
  }
}

export class TemporalActionBoundaryUncertainError
  extends TemporalActionBoundaryError {
  readonly outcomeStatus = 'unknown' as const;
  readonly redeliveryPermitted = false as const;
  readonly reconciliationRequired = true as const;

  constructor(
    readonly dispatchRef: string,
    readonly requestDigest: string,
    readonly journal: TemporalActionBoundaryJournal,
    cause?: unknown,
  ) {
    super(
      `dispatch outcome is unknown for ${dispatchRef}; redelivery is forbidden until external reconciliation`,
    );
    this.name = 'TemporalActionBoundaryUncertainError';
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function validRef(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function validRevision(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
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

function canonicalRefs(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function canonicalMetadata(
  metadata: TemporalTransportMetadata,
): Record<string, TemporalTransportMetadataValue> {
  return Object.fromEntries(
    Object.keys(metadata)
      .sort()
      .map(key => [key, metadata[key] ?? null]),
  );
}

function normalizedAction(action: AgentAction): AgentAction {
  return action.id === 6
    ? { id: 6, data: { x: action.data.x, y: action.data.y } }
    : { id: action.id };
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

function validateMetadata(metadata: TemporalTransportMetadata): void {
  const entries = Object.entries(metadata);
  if (
    entries.length > 64
    || entries.some(([key, value]) => (
      !validRef(key)
      || !['string', 'number', 'boolean'].includes(typeof value)
        && value !== null
      || typeof value === 'number' && !Number.isFinite(value)
    ))
  ) {
    throw new TemporalActionBoundaryError('transport metadata is invalid');
  }
}

function validateAgentObservation(observation: AgentObservation): void {
  if (
    observation.protocolVersion !== 1
    || !validRef(observation.sessionId)
    || !validRevision(observation.sequence)
    || observation.image.width !== 64
    || observation.image.height !== 64
    || observation.image.pixelFormat !== 'palette-index-u8'
    || !(observation.image.pixels instanceof Uint8Array)
    || observation.image.pixels.length !== 64 * 64
    || !Array.isArray(observation.availableActionIds)
    || observation.availableActionIds.some(id => (
      !Number.isInteger(id) || id < 0 || id > 7
    ))
    || new Set(observation.availableActionIds).size
      !== observation.availableActionIds.length
    || !['NOT_FINISHED', 'WIN'].includes(observation.state)
    || !validRevision(observation.level)
    || !validRevision(observation.levelsCompleted)
  ) {
    throw new TemporalActionBoundaryError('public AgentObservation is invalid');
  }
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

function attemptBase(
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
): Omit<TemporalEnvironmentDispatchAttemptReceipt, 'attemptFingerprint'> {
  const { attemptFingerprint: _ignored, ...base } = structuredClone(attempt);
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

export function temporalEnvironmentActionRequestDigest(
  request: Omit<TemporalEnvironmentActionRequest, 'requestDigest'>,
): string {
  return fingerprint({
    ...request,
    action: normalizedAction(request.action),
  });
}

export function temporalEnvironmentActionResponseDigest(
  response: Omit<TemporalEnvironmentActionResponse, 'responseDigest' | 'observation'>,
): string {
  return fingerprint({
    ...response,
    observationIdentity: structuredClone(response.observationIdentity),
    transportMetadata: canonicalMetadata(response.transportMetadata),
  });
}

export function temporalEnvironmentDispatchAttemptFingerprint(
  attempt: Omit<TemporalEnvironmentDispatchAttemptReceipt, 'attemptFingerprint'>,
): string {
  return fingerprint({
    ...attempt,
    evidenceRefs: canonicalRefs(attempt.evidenceRefs),
  });
}

export function temporalEnvironmentDispatchFingerprint(
  dispatch: Omit<TemporalEnvironmentDispatchReceipt, 'dispatchFingerprint' | 'observation'>,
): string {
  return fingerprint({
    ...dispatch,
    observationIdentity: structuredClone(dispatch.observationIdentity),
    transportMetadata: canonicalMetadata(dispatch.transportMetadata),
    evidenceRefs: canonicalRefs(dispatch.evidenceRefs),
  });
}

function validateStaticChain(
  binding: TemporalPreparedActionBindingReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): void {
  if (
    binding.bindingFingerprint
      !== temporalPreparedActionBindingFingerprint(bindingBase(binding))
  ) {
    throw new TemporalActionBoundaryError(
      'prepared action binding fingerprint mismatch at ActionBoundary',
    );
  }
  if (
    permit.concentrationLease.leaseFingerprint
      !== temporalConcentrationLeaseFingerprint(leaseBase(permit.concentrationLease))
  ) {
    throw new TemporalActionBoundaryError(
      'concentration lease fingerprint mismatch at ActionBoundary',
    );
  }
  if (
    permit.permitFingerprint
      !== temporalActionReleasePermitFingerprint(permitBase(permit))
  ) {
    throw new TemporalActionBoundaryError(
      'action release permit fingerprint mismatch at ActionBoundary',
    );
  }
  if (
    actReceipt.leaseTransition.transitionFingerprint
      !== temporalActLeaseTransitionFingerprint(
        actTransitionBase(actReceipt.leaseTransition),
      )
  ) {
    throw new TemporalActionBoundaryError(
      'released lease transition fingerprint mismatch at ActionBoundary',
    );
  }
  const receiptBase = actReceiptBase(actReceipt);
  if (
    actReceipt.receiptFingerprint
      !== temporalActTerminalReceiptFingerprint(
        receiptBase as Parameters<
          typeof temporalActTerminalReceiptFingerprint
        >[0],
      )
  ) {
    throw new TemporalActionBoundaryError(
      'ACT terminal receipt fingerprint mismatch at ActionBoundary',
    );
  }
  if (
    actReceipt.status !== 'consumed'
    || actReceipt.permitConsumed !== true
    || actReceipt.actCompleted !== true
    || actReceipt.actionReleased !== true
    || actReceipt.environmentDispatchAuthorized !== false
    || actReceipt.actionPayloadPresent !== false
    || actReceipt.permitReusable !== false
    || actReceipt.actOutput.dispatchStatus !== 'pending_environment_boundary'
    || actReceipt.leaseTransition.fromState !== 'validated'
    || actReceipt.leaseTransition.toState !== 'released'
  ) {
    throw new TemporalActionBoundaryError(
      'ActionBoundary requires one consumed ACT receipt with a released lease',
    );
  }
  if (
    !isAgentAction(binding.candidateAction)
    || binding.candidateAction.id !== permit.actionId
    || binding.intentRef !== permit.intentRef
    || binding.bindingFingerprint !== permit.bindingRef
    || binding.actionCandidateRef !== permit.actionCandidateRef
    || binding.sessionId !== permit.sessionId
    || binding.observationSequence !== permit.observationSequence
    || binding.observationFingerprint !== permit.observationFingerprint
    || binding.workflowRef !== permit.workflowRef
    || binding.sourceHash !== permit.sourceHash
    || !sameIdentity(binding.temporalIdentity, permit.temporalIdentity)
    || actReceipt.permitRef !== permit.permitRef
    || actReceipt.permitFingerprint !== permit.permitFingerprint
    || actReceipt.leaseRef !== permit.concentrationLease.leaseRef
    || actReceipt.leaseFingerprint
      !== permit.concentrationLease.leaseFingerprint
    || actReceipt.intentRef !== permit.intentRef
    || actReceipt.bindingRef !== permit.bindingRef
    || actReceipt.actionRef !== permit.actionCandidateRef
    || actReceipt.workflowRef !== permit.workflowRef
    || actReceipt.sourceHash !== permit.sourceHash
    || !sameIdentity(actReceipt.temporalIdentity, permit.temporalIdentity)
    || actReceipt.actOutput.actionRef !== permit.actionCandidateRef
    || actReceipt.actOutput.actionIntentRef !== permit.intentRef
    || actReceipt.actOutput.actionReleasePermitRef !== permit.permitRef
  ) {
    throw new TemporalActionBoundaryError(
      'ActionBoundary binding, permit and ACT receipt lineage mismatch',
    );
  }
}

function validateCheckpoint(
  checkpoint: TemporalActionBoundaryCheckpoint,
): void {
  if (
    checkpoint.schemaVersion
      !== TEMPORAL_ACTION_BOUNDARY_CHECKPOINT_SCHEMA_VERSION
    || !validRef(checkpoint.checkpointRef)
    || checkpoint.status !== 'suspended'
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
    throw new TemporalActionBoundaryError(
      'suspended ActionBoundary checkpoint is invalid',
    );
  }
  const requiredEvidence = [
    checkpoint.checkpointRef,
    checkpoint.pendingIntentRef,
    checkpoint.pendingPermitRef,
    checkpoint.pendingActReceiptRef,
    checkpoint.pendingActReceiptFingerprint,
    checkpoint.preActionSnapshotDigest,
    checkpoint.worldContextRef,
    checkpoint.worldContextDigest,
    checkpoint.responsibilityRef,
    checkpoint.releasedLeaseTransitionRef,
  ];
  if (requiredEvidence.some(ref => !checkpoint.evidenceRefs.includes(ref))) {
    throw new TemporalActionBoundaryError(
      'suspended ActionBoundary checkpoint evidence is incomplete',
    );
  }
}

function validateCurrentAuthority(
  authority: TemporalActionBoundaryCurrentAuthority,
): void {
  if (
    !validRef(authority.boundaryRequestRef)
    || !validRef(authority.workflowRef)
    || !validRef(authority.workflowInstanceRef)
    || !validRef(authority.sourceHash)
    || !validRef(authority.runRef)
    || !validRef(authority.timelineRef)
    || !validRef(authority.frameRef)
    || !validRevision(authority.stateRevision)
    || !validRef(authority.currentSnapshotDigest)
    || !validRef(authority.currentAvailableActionRef)
    || !validRef(authority.environmentAdapterRef)
    || !validRef(authority.worldContextRef)
    || !validRef(authority.worldContextDigest)
    || !validRef(authority.canonicalBindingFingerprint)
    || !validRef(authority.canonicalPermitFingerprint)
    || !validRef(authority.canonicalActReceiptFingerprint)
    || !validRef(authority.canonicalLeaseTransitionFingerprint)
    || !['validated', 'released', 'invalidated', 'expired'].includes(
      authority.currentLeaseState,
    )
    || [
      authority.checkpointCurrent,
      authority.sourceCurrent,
      authority.responsibilityCurrent,
      authority.intentCurrent,
      authority.bindingCurrent,
      authority.permitCurrent,
      authority.actReceiptCurrent,
      authority.releasedLeaseCurrent,
      authority.worldContextCurrent,
      authority.environmentAdapterCurrent,
    ].some(value => typeof value !== 'boolean')
    || !validUniqueRefs(authority.evidenceRefs)
  ) {
    throw new TemporalActionBoundaryError(
      'ActionBoundary current authority is invalid',
    );
  }
  const requiredEvidence = [
    authority.boundaryRequestRef,
    authority.currentSnapshotDigest,
    authority.currentAvailableActionRef,
    authority.environmentAdapterRef,
    authority.worldContextRef,
    authority.worldContextDigest,
    authority.canonicalBindingFingerprint,
    authority.canonicalPermitFingerprint,
    authority.canonicalActReceiptFingerprint,
    authority.canonicalLeaseTransitionFingerprint,
  ];
  if (requiredEvidence.some(ref => !authority.evidenceRefs.includes(ref))) {
    throw new TemporalActionBoundaryError(
      'ActionBoundary current authority evidence is incomplete',
    );
  }
}

function refusalReason(
  checkpoint: TemporalActionBoundaryCheckpoint,
  authority: TemporalActionBoundaryCurrentAuthority,
  observation: AgentObservation,
  binding: TemporalPreparedActionBindingReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): TemporalActionBoundaryDispatchRefusalReason | null {
  if (!authority.checkpointCurrent) return 'checkpoint_not_current';
  if (
    !authority.sourceCurrent
    || authority.workflowRef !== checkpoint.workflowRef
    || authority.workflowRef !== permit.workflowRef
    || authority.sourceHash !== checkpoint.sourceHash
    || authority.sourceHash !== permit.sourceHash
  ) return 'source_changed';
  if (!authority.responsibilityCurrent) return 'responsibility_not_current';
  if (!authority.intentCurrent) return 'intent_not_current';
  if (
    !authority.bindingCurrent
    || authority.canonicalBindingFingerprint !== binding.bindingFingerprint
  ) return 'binding_not_current';
  if (
    !authority.permitCurrent
    || authority.canonicalPermitFingerprint !== permit.permitFingerprint
  ) return 'permit_not_current';
  if (
    !authority.actReceiptCurrent
    || authority.canonicalActReceiptFingerprint !== actReceipt.receiptFingerprint
  ) return 'act_receipt_not_current';
  if (
    !authority.releasedLeaseCurrent
    || authority.currentLeaseState !== 'released'
    || authority.canonicalLeaseTransitionFingerprint
      !== actReceipt.leaseTransition.transitionFingerprint
  ) return 'lease_not_released';
  if (
    authority.workflowInstanceRef !== checkpoint.workflowInstanceRef
    || authority.runRef !== checkpoint.runRef
    || authority.timelineRef !== checkpoint.timelineRef
    || authority.frameRef !== checkpoint.frameRef
    || authority.stateRevision !== checkpoint.stateRevision
    || authority.stateRevision !== permit.stateRevision
  ) return 'state_revision_changed';
  const currentSnapshotDigest = fingerprintAgentObservation(observation);
  if (
    observation.sessionId !== checkpoint.runRef
    || observation.sequence !== permit.observationSequence
    || currentSnapshotDigest !== permit.preActionSnapshotDigest
    || currentSnapshotDigest !== checkpoint.preActionSnapshotDigest
    || authority.currentSnapshotDigest !== currentSnapshotDigest
  ) return 'observation_snapshot_changed';
  const availableActionRef = temporalAvailableActionRef(
    observation,
    permit.actionId,
  );
  if (
    !observation.availableActionIds.includes(permit.actionId)
    || permit.availableActionRef !== availableActionRef
    || authority.currentAvailableActionRef !== availableActionRef
  ) return 'action_unavailable';
  if (
    !authority.worldContextCurrent
    || authority.worldContextRef !== checkpoint.worldContextRef
    || authority.worldContextDigest !== checkpoint.worldContextDigest
  ) return 'world_context_changed';
  if (
    !authority.environmentAdapterCurrent
    || authority.environmentAdapterRef !== checkpoint.environmentAdapterRef
  ) return 'environment_adapter_changed';
  return null;
}

function validateCheckpointLineage(
  checkpoint: TemporalActionBoundaryCheckpoint,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): void {
  if (
    checkpoint.workflowRef !== permit.workflowRef
    || checkpoint.sourceHash !== permit.sourceHash
    || checkpoint.runRef !== permit.sessionId
    || checkpoint.timelineRef !== permit.temporalIdentity.episodeId
    || checkpoint.frameRef !== permit.temporalIdentity.observationId
    || checkpoint.stateRevision !== permit.stateRevision
    || checkpoint.pendingIntentRef !== permit.intentRef
    || checkpoint.pendingPermitRef !== permit.permitRef
    || checkpoint.pendingActReceiptRef !== actReceipt.receiptRef
    || checkpoint.pendingActReceiptFingerprint !== actReceipt.receiptFingerprint
    || checkpoint.preActionSnapshotDigest !== permit.preActionSnapshotDigest
    || checkpoint.releasedLeaseTransitionRef
      !== actReceipt.leaseTransition.transitionRef
  ) {
    throw new TemporalActionBoundaryError(
      'suspended checkpoint does not preserve the exact ACT lineage',
    );
  }
}

function requestWithoutDigest(
  checkpoint: TemporalActionBoundaryCheckpoint,
  binding: TemporalPreparedActionBindingReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): Omit<TemporalEnvironmentActionRequest, 'requestDigest'> {
  const dispatchIdentity = fingerprint({
    checkpointRef: checkpoint.checkpointRef,
    workflowInstanceRef: checkpoint.workflowInstanceRef,
    intentRef: permit.intentRef,
    permitRef: permit.permitRef,
    actReceiptFingerprint: actReceipt.receiptFingerprint,
  });
  return {
    schemaVersion: TEMPORAL_ENVIRONMENT_ACTION_REQUEST_SCHEMA_VERSION,
    dispatchRef: `temporal-environment-dispatch:${dispatchIdentity}`,
    environmentAdapterRef: checkpoint.environmentAdapterRef,
    checkpointRef: checkpoint.checkpointRef,
    workflowRef: checkpoint.workflowRef,
    workflowInstanceRef: checkpoint.workflowInstanceRef,
    sourceHash: checkpoint.sourceHash,
    runRef: checkpoint.runRef,
    timelineRef: checkpoint.timelineRef,
    frameRef: checkpoint.frameRef,
    stateRevision: checkpoint.stateRevision,
    actionIntentRef: permit.intentRef,
    actionReleasePermitRef: permit.permitRef,
    actReceiptRef: actReceipt.receiptRef,
    actionRef: permit.actionCandidateRef,
    action: normalizedAction(binding.candidateAction),
    observationSequence: permit.observationSequence,
    preActionSnapshotDigest: permit.preActionSnapshotDigest,
    worldContextRef: checkpoint.worldContextRef,
    worldContextDigest: checkpoint.worldContextDigest,
  };
}

export function createTemporalEnvironmentActionRequest(
  checkpoint: TemporalActionBoundaryCheckpoint,
  binding: TemporalPreparedActionBindingReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): TemporalEnvironmentActionRequest {
  const base = requestWithoutDigest(checkpoint, binding, permit, actReceipt);
  return {
    ...base,
    requestDigest: temporalEnvironmentActionRequestDigest(base),
  };
}

function buildAttempt(
  request: TemporalEnvironmentActionRequest,
  checkpoint: TemporalActionBoundaryCheckpoint,
  authority: TemporalActionBoundaryCurrentAuthority,
  binding: TemporalPreparedActionBindingReceipt,
  permit: TemporalActionReleasePermitReceipt,
  actReceipt: TemporalActConsumedReceipt,
): TemporalEnvironmentDispatchAttemptReceipt {
  const evidenceRefs = canonicalRefs([
    ...checkpoint.evidenceRefs,
    ...authority.evidenceRefs,
    binding.bindingFingerprint,
    permit.permitFingerprint,
    actReceipt.receiptFingerprint,
    actReceipt.leaseTransition.transitionFingerprint,
    request.requestDigest,
  ]);
  const base: Omit<
    TemporalEnvironmentDispatchAttemptReceipt,
    'attemptFingerprint'
  > = {
    schemaVersion: TEMPORAL_ENVIRONMENT_ATTEMPT_SCHEMA_VERSION,
    attemptRef: `temporal-environment-attempt:${request.dispatchRef}`,
    dispatchRef: request.dispatchRef,
    requestDigest: request.requestDigest,
    environmentAdapterRef: request.environmentAdapterRef,
    checkpointRef: request.checkpointRef,
    workflowRef: request.workflowRef,
    workflowInstanceRef: request.workflowInstanceRef,
    sourceHash: request.sourceHash,
    runRef: request.runRef,
    timelineRef: request.timelineRef,
    frameRef: request.frameRef,
    stateRevision: request.stateRevision,
    actionIntentRef: request.actionIntentRef,
    actionReleasePermitRef: request.actionReleasePermitRef,
    actReceiptRef: request.actReceiptRef,
    actionRef: request.actionRef,
    actionId: request.action.id,
    preActionSnapshotDigest: request.preActionSnapshotDigest,
    worldContextRef: request.worldContextRef,
    worldContextDigest: request.worldContextDigest,
    outcomeStatus: 'prepared',
    redeliveryPermitted: false,
    evidenceRefs,
  };
  return {
    ...base,
    attemptFingerprint: temporalEnvironmentDispatchAttemptFingerprint(base),
  };
}

function validateResponse(
  request: TemporalEnvironmentActionRequest,
  response: TemporalEnvironmentActionResponse,
): void {
  validateAgentObservation(response.observation);
  validateMetadata(response.transportMetadata);
  if (
    response.schemaVersion
      !== TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION
    || response.dispatchRef !== request.dispatchRef
    || !validRef(response.environmentActionEventRef)
    || response.actionIntentRef !== request.actionIntentRef
    || response.actionReleasePermitRef !== request.actionReleasePermitRef
    || response.actReceiptRef !== request.actReceiptRef
    || !validRef(response.observationIdentity.episodeId)
    || !validRef(response.observationIdentity.observationId)
    || !validRevision(response.observationIdentity.levelEpoch)
    || !validRevision(response.observationIdentity.observationRevision)
    || response.observationIdentity.episodeId !== request.timelineRef
    || response.observationIdentity.observationRevision <= request.stateRevision
    || response.observation.sessionId !== request.runRef
    || response.observation.sequence <= request.observationSequence
    || response.observationFingerprint
      !== fingerprintAgentObservation(response.observation)
  ) {
    throw new TemporalActionBoundaryError(
      'environment response changed dispatch lineage or returned an invalid observation',
    );
  }
  const { responseDigest: _ignored, observation: _observation, ...base } =
    structuredClone(response);
  if (
    response.responseDigest !== temporalEnvironmentActionResponseDigest(base)
  ) {
    throw new TemporalActionBoundaryError(
      'environment response digest mismatch',
    );
  }
}

function buildDispatch(
  request: TemporalEnvironmentActionRequest,
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
  response: TemporalEnvironmentActionResponse,
): TemporalEnvironmentDispatchReceipt {
  const evidenceRefs = canonicalRefs([
    ...attempt.evidenceRefs,
    attempt.attemptFingerprint,
    response.responseDigest,
    response.environmentActionEventRef,
    response.observationFingerprint,
  ]);
  const base: Omit<
    TemporalEnvironmentDispatchReceipt,
    'dispatchFingerprint' | 'observation'
  > = {
    schemaVersion: TEMPORAL_ENVIRONMENT_DISPATCH_SCHEMA_VERSION,
    dispatchReceiptRef: `temporal-environment-dispatched:${request.dispatchRef}`,
    dispatchRef: request.dispatchRef,
    attemptRef: attempt.attemptRef,
    attemptFingerprint: attempt.attemptFingerprint,
    requestDigest: request.requestDigest,
    responseDigest: response.responseDigest,
    environmentActionEventRef: response.environmentActionEventRef,
    actionIntentRef: request.actionIntentRef,
    actionReleasePermitRef: request.actionReleasePermitRef,
    actReceiptRef: request.actReceiptRef,
    actionRef: request.actionRef,
    observationIdentity: structuredClone(response.observationIdentity),
    observationFingerprint: response.observationFingerprint,
    transportMetadata: structuredClone(response.transportMetadata),
    outcomeStatus: 'dispatched',
    redeliveryPermitted: false,
    causalResumeAuthorized: false,
    workflowResumed: false,
    evidenceRefs,
  };
  return {
    ...base,
    observation: structuredClone(response.observation),
    dispatchFingerprint: temporalEnvironmentDispatchFingerprint(base),
  };
}

function validateAttempt(
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
): void {
  if (
    attempt.schemaVersion !== TEMPORAL_ENVIRONMENT_ATTEMPT_SCHEMA_VERSION
    || !validRef(attempt.attemptRef)
    || !validRef(attempt.dispatchRef)
    || !validRef(attempt.requestDigest)
    || !validRef(attempt.environmentAdapterRef)
    || !validRef(attempt.checkpointRef)
    || !validRef(attempt.workflowRef)
    || !validRef(attempt.workflowInstanceRef)
    || !validRef(attempt.sourceHash)
    || !validRef(attempt.runRef)
    || !validRef(attempt.timelineRef)
    || !validRef(attempt.frameRef)
    || !validRevision(attempt.stateRevision)
    || !validRef(attempt.actionIntentRef)
    || !validRef(attempt.actionReleasePermitRef)
    || !validRef(attempt.actReceiptRef)
    || !validRef(attempt.actionRef)
    || !Number.isInteger(attempt.actionId)
    || attempt.actionId < 0
    || attempt.actionId > 7
    || !validRef(attempt.preActionSnapshotDigest)
    || !validRef(attempt.worldContextRef)
    || !validRef(attempt.worldContextDigest)
    || attempt.outcomeStatus !== 'prepared'
    || attempt.redeliveryPermitted !== false
    || !validUniqueRefs(attempt.evidenceRefs)
    || attempt.attemptFingerprint
      !== temporalEnvironmentDispatchAttemptFingerprint(attemptBase(attempt))
  ) {
    throw new TemporalActionBoundaryError(
      'environment dispatch attempt receipt is invalid',
    );
  }
}

function validateDispatch(
  dispatch: TemporalEnvironmentDispatchReceipt,
): void {
  validateAgentObservation(dispatch.observation);
  validateMetadata(dispatch.transportMetadata);
  if (
    dispatch.schemaVersion !== TEMPORAL_ENVIRONMENT_DISPATCH_SCHEMA_VERSION
    || !validRef(dispatch.dispatchReceiptRef)
    || !validRef(dispatch.dispatchRef)
    || !validRef(dispatch.attemptRef)
    || !validRef(dispatch.attemptFingerprint)
    || !validRef(dispatch.requestDigest)
    || !validRef(dispatch.responseDigest)
    || !validRef(dispatch.environmentActionEventRef)
    || !validRef(dispatch.actionIntentRef)
    || !validRef(dispatch.actionReleasePermitRef)
    || !validRef(dispatch.actReceiptRef)
    || !validRef(dispatch.actionRef)
    || !validRef(dispatch.observationIdentity.episodeId)
    || !validRef(dispatch.observationIdentity.observationId)
    || !validRevision(dispatch.observationIdentity.levelEpoch)
    || !validRevision(dispatch.observationIdentity.observationRevision)
    || dispatch.observationFingerprint
      !== fingerprintAgentObservation(dispatch.observation)
    || dispatch.outcomeStatus !== 'dispatched'
    || dispatch.redeliveryPermitted !== false
    || dispatch.causalResumeAuthorized !== false
    || dispatch.workflowResumed !== false
    || !validUniqueRefs(dispatch.evidenceRefs)
    || dispatch.dispatchFingerprint
      !== temporalEnvironmentDispatchFingerprint(dispatchBase(dispatch))
  ) {
    throw new TemporalActionBoundaryError(
      'environment dispatch receipt is invalid',
    );
  }
}

function validateJournal(journal: TemporalActionBoundaryJournal): void {
  if (
    journal.schemaVersion !== TEMPORAL_ACTION_BOUNDARY_JOURNAL_SCHEMA_VERSION
    || !Number.isInteger(journal.maxDispatches)
    || journal.maxDispatches < 1
    || journal.maxDispatches > MAX_DISPATCHES_LIMIT
    || journal.attempts.length > journal.maxDispatches
    || journal.dispatches.length > journal.maxDispatches
    || journal.dispatches.length > journal.attempts.length
  ) {
    throw new TemporalActionBoundaryError(
      'temporal ActionBoundary journal envelope is invalid',
    );
  }
  const attemptRefs = new Set<string>();
  const attemptDispatchRefs = new Set<string>();
  const attemptRequestDigests = new Set<string>();
  for (const attempt of journal.attempts) {
    validateAttempt(attempt);
    if (
      attemptRefs.has(attempt.attemptRef)
      || attemptDispatchRefs.has(attempt.dispatchRef)
      || attemptRequestDigests.has(attempt.requestDigest)
    ) {
      throw new TemporalActionBoundaryError(
        'temporal ActionBoundary journal contains duplicate attempt identity',
      );
    }
    attemptRefs.add(attempt.attemptRef);
    attemptDispatchRefs.add(attempt.dispatchRef);
    attemptRequestDigests.add(attempt.requestDigest);
  }
  const dispatchRefs = new Set<string>();
  const dispatchReceiptRefs = new Set<string>();
  for (const dispatch of journal.dispatches) {
    validateDispatch(dispatch);
    if (
      dispatchRefs.has(dispatch.dispatchRef)
      || dispatchReceiptRefs.has(dispatch.dispatchReceiptRef)
    ) {
      throw new TemporalActionBoundaryError(
        'temporal ActionBoundary journal contains duplicate dispatch identity',
      );
    }
    const attempt = journal.attempts.find(
      candidate => candidate.dispatchRef === dispatch.dispatchRef,
    );
    if (
      !attempt
      || dispatch.attemptRef !== attempt.attemptRef
      || dispatch.attemptFingerprint !== attempt.attemptFingerprint
      || dispatch.requestDigest !== attempt.requestDigest
      || dispatch.actionIntentRef !== attempt.actionIntentRef
      || dispatch.actionReleasePermitRef !== attempt.actionReleasePermitRef
      || dispatch.actReceiptRef !== attempt.actReceiptRef
      || dispatch.actionRef !== attempt.actionRef
    ) {
      throw new TemporalActionBoundaryError(
        'dispatch receipt has no exact durable attempt lineage',
      );
    }
    dispatchRefs.add(dispatch.dispatchRef);
    dispatchReceiptRefs.add(dispatch.dispatchReceiptRef);
  }
}

export function createTemporalActionBoundaryJournal(
  maxDispatches = DEFAULT_MAX_DISPATCHES,
): TemporalActionBoundaryJournal {
  const journal: TemporalActionBoundaryJournal = {
    schemaVersion: TEMPORAL_ACTION_BOUNDARY_JOURNAL_SCHEMA_VERSION,
    maxDispatches,
    attempts: [],
    dispatches: [],
  };
  validateJournal(journal);
  return journal;
}

export function restoreTemporalActionBoundaryJournal(
  snapshot: TemporalActionBoundaryJournal,
): TemporalActionBoundaryJournal {
  const restored = structuredClone(snapshot);
  validateJournal(restored);
  return restored;
}

function appendAttempt(
  journal: TemporalActionBoundaryJournal,
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
): TemporalActionBoundaryJournal {
  if (journal.attempts.length >= journal.maxDispatches) {
    throw new TemporalActionBoundaryError(
      'temporal ActionBoundary attempt capacity reached',
    );
  }
  const next: TemporalActionBoundaryJournal = {
    ...structuredClone(journal),
    attempts: [
      ...journal.attempts.map(item => structuredClone(item)),
      structuredClone(attempt),
    ],
  };
  validateJournal(next);
  return next;
}

function appendDispatch(
  journal: TemporalActionBoundaryJournal,
  dispatch: TemporalEnvironmentDispatchReceipt,
): TemporalActionBoundaryJournal {
  if (journal.dispatches.length >= journal.maxDispatches) {
    throw new TemporalActionBoundaryError(
      'temporal ActionBoundary dispatch capacity reached',
    );
  }
  const next: TemporalActionBoundaryJournal = {
    ...structuredClone(journal),
    dispatches: [
      ...journal.dispatches.map(item => structuredClone(item)),
      structuredClone(dispatch),
    ],
  };
  validateJournal(next);
  return next;
}

function requirePersistedAttempt(
  journal: TemporalActionBoundaryJournal,
  attempt: TemporalEnvironmentDispatchAttemptReceipt,
): TemporalActionBoundaryJournal {
  const restored = restoreTemporalActionBoundaryJournal(journal);
  const persisted = restored.attempts.find(
    item => item.dispatchRef === attempt.dispatchRef,
  );
  if (
    !persisted
    || persisted.attemptFingerprint !== attempt.attemptFingerprint
    || restored.dispatches.some(
      dispatch => dispatch.dispatchRef === attempt.dispatchRef,
    )
  ) {
    throw new TemporalActionBoundaryError(
      'attempt persistence did not preserve the exact pre-transport record',
    );
  }
  return restored;
}

function requirePersistedDispatch(
  journal: TemporalActionBoundaryJournal,
  dispatch: TemporalEnvironmentDispatchReceipt,
): TemporalActionBoundaryJournal {
  const restored = restoreTemporalActionBoundaryJournal(journal);
  const persisted = restored.dispatches.find(
    item => item.dispatchRef === dispatch.dispatchRef,
  );
  if (
    !persisted
    || persisted.dispatchFingerprint !== dispatch.dispatchFingerprint
  ) {
    throw new TemporalActionBoundaryError(
      'dispatch persistence did not preserve the exact response record',
    );
  }
  return restored;
}

function responseFromDispatch(
  dispatch: TemporalEnvironmentDispatchReceipt,
): TemporalEnvironmentActionResponse {
  return {
    schemaVersion: TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION,
    dispatchRef: dispatch.dispatchRef,
    environmentActionEventRef: dispatch.environmentActionEventRef,
    actionIntentRef: dispatch.actionIntentRef,
    actionReleasePermitRef: dispatch.actionReleasePermitRef,
    actReceiptRef: dispatch.actReceiptRef,
    observationIdentity: structuredClone(dispatch.observationIdentity),
    observation: structuredClone(dispatch.observation),
    observationFingerprint: dispatch.observationFingerprint,
    responseDigest: dispatch.responseDigest,
    transportMetadata: structuredClone(dispatch.transportMetadata),
  };
}

export async function dispatchTemporalActOutput(
  input: DispatchTemporalActOutputInput,
): Promise<TemporalActionBoundaryDispatchResult> {
  validateJournal(input.journal);
  validateCheckpoint(input.checkpoint);
  validateCurrentAuthority(input.currentAuthority);
  validateAgentObservation(input.observation);
  validateStaticChain(input.binding, input.permit, input.actReceipt);
  validateCheckpointLineage(input.checkpoint, input.permit, input.actReceipt);

  const reason = refusalReason(
    input.checkpoint,
    input.currentAuthority,
    input.observation,
    input.binding,
    input.permit,
    input.actReceipt,
  );
  if (reason) {
    throw new TemporalActionBoundaryDispatchRefusedError(reason);
  }

  const request = createTemporalEnvironmentActionRequest(
    input.checkpoint,
    input.binding,
    input.permit,
    input.actReceipt,
  );
  const existingDispatch = input.journal.dispatches.find(
    dispatch => dispatch.dispatchRef === request.dispatchRef,
  );
  if (existingDispatch) {
    if (existingDispatch.requestDigest !== request.requestDigest) {
      throw new TemporalActionBoundaryError(
        'a prior dispatch exists with different request lineage',
      );
    }
    const response = responseFromDispatch(existingDispatch);
    validateResponse(request, response);
    return {
      status: 'dispatched',
      journal: structuredClone(input.journal),
      request: structuredClone(request),
      dispatch: structuredClone(existingDispatch),
      response,
      reused: true,
      transportCalled: false,
      observationAcquired: true,
      causalResumeAuthorized: false,
      workflowResumed: false,
    };
  }

  const existingAttempt = input.journal.attempts.find(
    attempt => attempt.dispatchRef === request.dispatchRef,
  );
  if (existingAttempt) {
    if (existingAttempt.requestDigest !== request.requestDigest) {
      throw new TemporalActionBoundaryError(
        'a prior dispatch attempt exists with different request lineage',
      );
    }
    throw new TemporalActionBoundaryUncertainError(
      request.dispatchRef,
      request.requestDigest,
      structuredClone(input.journal),
    );
  }

  const attempt = buildAttempt(
    request,
    input.checkpoint,
    input.currentAuthority,
    input.binding,
    input.permit,
    input.actReceipt,
  );
  const attemptJournal = appendAttempt(input.journal, attempt);
  const persistedAttemptJournal = requirePersistedAttempt(
    await input.persistence.persistAttempt(
      structuredClone(attemptJournal),
      structuredClone(attempt),
    ),
    attempt,
  );

  await input.qualificationHooks?.afterAttemptPersistedBeforeTransport?.(
    structuredClone(request),
    structuredClone(persistedAttemptJournal),
  );

  let response: TemporalEnvironmentActionResponse;
  try {
    response = await input.transport.execute(structuredClone(request));
    await input.qualificationHooks?.afterTransportBeforeDispatchPersistence?.(
      structuredClone(request),
      structuredClone(response),
      structuredClone(persistedAttemptJournal),
    );
    validateResponse(request, response);
  } catch (error) {
    throw new TemporalActionBoundaryUncertainError(
      request.dispatchRef,
      request.requestDigest,
      structuredClone(persistedAttemptJournal),
      error,
    );
  }

  const dispatch = buildDispatch(request, attempt, response);
  const dispatchJournal = appendDispatch(persistedAttemptJournal, dispatch);
  let persistedDispatchJournal: TemporalActionBoundaryJournal;
  try {
    persistedDispatchJournal = requirePersistedDispatch(
      await input.persistence.persistDispatch(
        structuredClone(dispatchJournal),
        structuredClone(dispatch),
      ),
      dispatch,
    );
  } catch (error) {
    throw new TemporalActionBoundaryUncertainError(
      request.dispatchRef,
      request.requestDigest,
      structuredClone(persistedAttemptJournal),
      error,
    );
  }

  return {
    status: 'dispatched',
    journal: persistedDispatchJournal,
    request: structuredClone(request),
    dispatch: structuredClone(dispatch),
    response: structuredClone(response),
    reused: false,
    transportCalled: true,
    observationAcquired: true,
    causalResumeAuthorized: false,
    workflowResumed: false,
  };
}
