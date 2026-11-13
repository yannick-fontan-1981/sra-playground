import type { OperationTraceSink } from '../logos-engine/v6-operation-trace.ts';
import {
  restoreTemporalObservationState,
  type TemporalObservationState,
} from '../logos-engine/v6-temporal-observation-state.ts';
import type { TemporalSourceAuthority } from '../logos-engine/v6-temporal-selection-contract.ts';
import type { TemporalResumedWorkflowCheckpoint } from './v6-temporal-causal-resume.ts';
import {
  TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION,
  restoreTemporalResumeContinuationJournal,
  temporalPostActionStateFingerprint,
  type TemporalResumeContinuationReceipt,
} from './v6-temporal-resume-continuation.ts';

/**
 * Passive injection boundary between one qualified post-resume continuation
 * receipt and a future scheduler implementation.
 *
 * The boundary validates and hands the same ACTIVE checkpoint and fresh
 * TemporalObservationState to one explicitly injected consumer. It never runs
 * a scheduler by itself, chooses a candidate, grants ACT or produces an action.
 */

export const TEMPORAL_SCHEDULER_CONTINUATION_ENVELOPE_SCHEMA_VERSION =
  'sra.temporal_scheduler_continuation_envelope.v1' as const;
export const TEMPORAL_SCHEDULER_CONTINUATION_ACK_SCHEMA_VERSION =
  'sra.temporal_scheduler_continuation_ack.v1' as const;
export const TEMPORAL_SCHEDULER_CONTINUATION_HANDOFF_SCHEMA_VERSION =
  'sra.temporal_scheduler_continuation_handoff.v1' as const;
export const TEMPORAL_SCHEDULER_CONTINUATION_JOURNAL_SCHEMA_VERSION =
  'sra.temporal_scheduler_continuation_journal.v1' as const;

const CAPABILITY = 'temporal-scheduler-continuation-port';
const MAX_PENDING_ENVELOPES = 32;
const DEFAULT_MAX_HANDOFFS = 128;
const MAX_HANDOFFS_LIMIT = 1024;

export interface TemporalSchedulerContinuationLineage {
  resumeRef: string;
  dispatchRef: string;
  environmentActionEventRef: string;
  actionIntentRef: string;
  actionReleasePermitRef: string;
  actReceiptRef: string;
  observationReceiptRef: string;
  actionObservedRef: string;
  leaseTransitionRef: string;
  resumedCheckpointRef: string;
}

export interface TemporalSchedulerContinuationEnvelope {
  schemaVersion: typeof TEMPORAL_SCHEDULER_CONTINUATION_ENVELOPE_SCHEMA_VERSION;
  envelopeRef: string;
  continuationRef: string;
  continuationFingerprint: string;
  resumedCheckpoint: TemporalResumedWorkflowCheckpoint;
  resumedCheckpointFingerprint: string;
  postActionState: TemporalObservationState;
  postActionStateFingerprint: string;
  lineage: TemporalSchedulerContinuationLineage;
  reason: string;
  schedulerExecutionAuthorization: null;
  workerAction: null;
  actAuthorization: null;
  continuationReceipt: TemporalResumeContinuationReceipt;
  envelopeFingerprint: string;
}

export interface TemporalSchedulerContinuationCurrentAuthority {
  handoffRequestRef: string;
  currentContinuationFingerprint: string;
  currentResumedCheckpointFingerprint: string;
  currentPostActionStateFingerprint: string;
  currentWorkflowRef: string;
  currentWorkflowInstanceRef: string;
  currentSourceHash: string;
  currentRunRef: string;
  currentTimelineRef: string;
  currentFrameRef: string;
  currentStateRevision: number;
  continuationCurrent: boolean;
  checkpointCurrent: boolean;
  stateCurrent: boolean;
  sourceCurrent: boolean;
  evidenceRefs: readonly string[];
}

export interface TemporalSchedulerContinuationConsumerInput {
  handoffRequestRef: string;
  envelopeRef: string;
  envelopeFingerprint: string;
  continuationReceipt: TemporalResumeContinuationReceipt;
  resumedCheckpoint: TemporalResumedWorkflowCheckpoint;
  postActionState: TemporalObservationState;
  lineage: TemporalSchedulerContinuationLineage;
  schedulerExecutionAuthorized: false;
  workerActionProduced: false;
  actAuthorized: false;
}

export type TemporalSchedulerContinuationAckStatus = 'accepted' | 'refused';

export interface TemporalSchedulerContinuationAcknowledgement {
  schemaVersion: typeof TEMPORAL_SCHEDULER_CONTINUATION_ACK_SCHEMA_VERSION;
  acknowledgementRef: string;
  portRef: string;
  handoffRequestRef: string;
  envelopeRef: string;
  envelopeFingerprint: string;
  continuationRef: string;
  continuationFingerprint: string;
  resumedCheckpointRef: string;
  resumedCheckpointFingerprint: string;
  postActionStateFingerprint: string;
  status: TemporalSchedulerContinuationAckStatus;
  reason: string;
  evidenceRefs: readonly string[];
  continuationAccepted: boolean;
  schedulerExecutionStarted: false;
  workerActionProduced: false;
  actAuthorized: false;
  acknowledgementFingerprint: string;
}

export interface SchedulerContinuationPort {
  readonly portRef: string;
  accept(
    input: TemporalSchedulerContinuationConsumerInput,
    signal: AbortSignal,
  ):
    | TemporalSchedulerContinuationAcknowledgement
    | Promise<TemporalSchedulerContinuationAcknowledgement>;
}

export interface TemporalSchedulerContinuationHandoffReceipt {
  schemaVersion: typeof TEMPORAL_SCHEDULER_CONTINUATION_HANDOFF_SCHEMA_VERSION;
  handoffRef: string;
  envelopeRef: string;
  envelopeFingerprint: string;
  continuationRef: string;
  continuationFingerprint: string;
  acknowledgement: TemporalSchedulerContinuationAcknowledgement;
  lineage: TemporalSchedulerContinuationLineage;
  evidenceRefs: readonly string[];
  continuationConsumed: true;
  schedulerExecutionStarted: false;
  workerActionProduced: false;
  actAuthorized: false;
  receiptFingerprint: string;
}

export interface TemporalSchedulerContinuationJournal {
  schemaVersion: typeof TEMPORAL_SCHEDULER_CONTINUATION_JOURNAL_SCHEMA_VERSION;
  maxHandoffs: number;
  receipts: readonly TemporalSchedulerContinuationHandoffReceipt[];
}

export type TemporalSchedulerContinuationResolutionStatus =
  | 'missing_envelope'
  | 'continuation_withheld'
  | 'continuation_accepted'
  | 'continuation_refused'
  | 'blocked'
  | 'aborted';

export interface TemporalSchedulerContinuationResolution {
  status: TemporalSchedulerContinuationResolutionStatus;
  continuationRef: string;
  reason: string;
  portRef: string | null;
  continuationConsumed: boolean;
  schedulerExecutionStarted: false;
  workerActionProduced: false;
  actAuthorized: false;
  reused: boolean;
  receipt: TemporalSchedulerContinuationHandoffReceipt | null;
}

export interface TemporalSchedulerContinuationPortSnapshot {
  pendingEnvelopeRefs: readonly string[];
  journal: TemporalSchedulerContinuationJournal;
  lastResolution: TemporalSchedulerContinuationResolution | null;
}

export interface PassiveTemporalSchedulerContinuationPortOptions {
  scheduler?: SchedulerContinuationPort;
  trace?: OperationTraceSink;
  journal?: TemporalSchedulerContinuationJournal;
}

export class TemporalSchedulerContinuationPortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalSchedulerContinuationPortError';
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

function canonicalValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return Array.from(value);
  if (Array.isArray(value)) return value.map(item => canonicalValue(item));
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map(key => [key, canonicalValue(record[key])]),
    );
  }
  return value;
}

function fingerprint(payload: unknown): string {
  const serialized = JSON.stringify(canonicalValue(payload));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function selfAuthority(
  workflowRef: string,
  sourceHash: string,
): TemporalSourceAuthority {
  return {
    workflowRef,
    sourceHash,
    authorizedWorkflowRefs: [workflowRef],
    authorizedSourceHash: sourceHash,
  };
}

function lineageFromReceipt(
  receipt: TemporalResumeContinuationReceipt,
): TemporalSchedulerContinuationLineage {
  return {
    resumeRef: receipt.causalResume.resumeRef,
    dispatchRef: receipt.causalResume.dispatchRef,
    environmentActionEventRef:
      receipt.causalResume.observation.environmentActionEventRef,
    actionIntentRef: receipt.causalResume.observation.actionIntentRef,
    actionReleasePermitRef:
      receipt.causalResume.observation.actionReleasePermitRef,
    actReceiptRef: receipt.causalResume.observation.actReceiptRef,
    observationReceiptRef:
      receipt.causalResume.observation.observationReceiptRef,
    actionObservedRef: receipt.causalResume.actionObserved.actionObservedRef,
    leaseTransitionRef: receipt.causalResume.leaseTransition.transitionRef,
    resumedCheckpointRef:
      receipt.causalResume.resumedCheckpoint.resumedCheckpointRef,
  };
}

function validateContinuationReceipt(
  receipt: TemporalResumeContinuationReceipt,
): void {
  restoreTemporalResumeContinuationJournal({
    schemaVersion: TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION,
    maxContinuations: 1,
    receipts: [structuredClone(receipt)],
  });
}

function envelopeBase(
  envelope: TemporalSchedulerContinuationEnvelope,
): Omit<TemporalSchedulerContinuationEnvelope, 'envelopeFingerprint'> {
  const { envelopeFingerprint: _ignored, ...base } = structuredClone(envelope);
  return base;
}

function acknowledgementBase(
  acknowledgement: TemporalSchedulerContinuationAcknowledgement,
): Omit<TemporalSchedulerContinuationAcknowledgement, 'acknowledgementFingerprint'> {
  const {
    acknowledgementFingerprint: _ignored,
    ...base
  } = structuredClone(acknowledgement);
  return base;
}

function handoffReceiptBase(
  receipt: TemporalSchedulerContinuationHandoffReceipt,
): Omit<TemporalSchedulerContinuationHandoffReceipt, 'receiptFingerprint'> {
  const { receiptFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

export function temporalSchedulerContinuationEnvelopeFingerprint(
  envelope: Omit<TemporalSchedulerContinuationEnvelope, 'envelopeFingerprint'>,
): string {
  return fingerprint({
    ...envelope,
    lineage: structuredClone(envelope.lineage),
  });
}

export function temporalSchedulerContinuationAcknowledgementFingerprint(
  acknowledgement: Omit<
    TemporalSchedulerContinuationAcknowledgement,
    'acknowledgementFingerprint'
  >,
): string {
  return fingerprint({
    ...acknowledgement,
    evidenceRefs: canonicalRefs(acknowledgement.evidenceRefs),
  });
}

export function temporalSchedulerContinuationHandoffFingerprint(
  receipt: Omit<TemporalSchedulerContinuationHandoffReceipt, 'receiptFingerprint'>,
): string {
  return fingerprint({
    ...receipt,
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

export function bindTemporalSchedulerContinuationEnvelope(
  receipt: TemporalResumeContinuationReceipt,
  reason: string,
): TemporalSchedulerContinuationEnvelope {
  validateContinuationReceipt(receipt);
  if (!reason.trim()) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation envelope reason must be non-empty',
    );
  }
  const base: Omit<
    TemporalSchedulerContinuationEnvelope,
    'envelopeFingerprint'
  > = {
    schemaVersion: TEMPORAL_SCHEDULER_CONTINUATION_ENVELOPE_SCHEMA_VERSION,
    envelopeRef: `temporal-scheduler-continuation:${receipt.continuationRef}`,
    continuationRef: receipt.continuationRef,
    continuationFingerprint: receipt.receiptFingerprint,
    resumedCheckpoint: structuredClone(
      receipt.causalResume.resumedCheckpoint,
    ),
    resumedCheckpointFingerprint:
      receipt.causalResume.resumedCheckpoint.resumedCheckpointFingerprint,
    postActionState: structuredClone(receipt.postActionState),
    postActionStateFingerprint: receipt.postActionStateFingerprint,
    lineage: lineageFromReceipt(receipt),
    reason,
    schedulerExecutionAuthorization: null,
    workerAction: null,
    actAuthorization: null,
    continuationReceipt: structuredClone(receipt),
  };
  const envelope: TemporalSchedulerContinuationEnvelope = {
    ...base,
    envelopeFingerprint:
      temporalSchedulerContinuationEnvelopeFingerprint(base),
  };
  validateTemporalSchedulerContinuationEnvelope(envelope);
  return envelope;
}

export function validateTemporalSchedulerContinuationEnvelope(
  envelope: TemporalSchedulerContinuationEnvelope,
): void {
  validateContinuationReceipt(envelope.continuationReceipt);
  const receipt = envelope.continuationReceipt;
  const authority = selfAuthority(
    receipt.domain.workflowRef,
    receipt.domain.sourceHash,
  );
  const restoredState = restoreTemporalObservationState(
    envelope.postActionState,
    authority,
  );
  const expectedLineage = lineageFromReceipt(receipt);
  if (
    envelope.schemaVersion
      !== TEMPORAL_SCHEDULER_CONTINUATION_ENVELOPE_SCHEMA_VERSION
    || !validRef(envelope.envelopeRef)
    || !validRef(envelope.continuationRef)
    || !validRef(envelope.continuationFingerprint)
    || !validRef(envelope.resumedCheckpointFingerprint)
    || !validRef(envelope.postActionStateFingerprint)
    || !envelope.reason.trim()
    || envelope.schedulerExecutionAuthorization !== null
    || envelope.workerAction !== null
    || envelope.actAuthorization !== null
    || receipt.schedulerExecutionStarted !== false
    || receipt.workerActionProduced !== false
    || receipt.actAuthorized !== false
    || envelope.continuationRef !== receipt.continuationRef
    || envelope.continuationFingerprint !== receipt.receiptFingerprint
    || envelope.resumedCheckpointFingerprint
      !== receipt.causalResume.resumedCheckpoint.resumedCheckpointFingerprint
    || envelope.postActionStateFingerprint
      !== receipt.postActionStateFingerprint
    || envelope.postActionStateFingerprint
      !== temporalPostActionStateFingerprint(restoredState)
    || JSON.stringify(envelope.resumedCheckpoint)
      !== JSON.stringify(receipt.causalResume.resumedCheckpoint)
    || JSON.stringify(restoredState)
      !== JSON.stringify(receipt.postActionState)
    || JSON.stringify(envelope.lineage) !== JSON.stringify(expectedLineage)
    || Object.prototype.hasOwnProperty.call(envelope, 'selectedRef')
    || Object.prototype.hasOwnProperty.call(envelope, 'candidateAction')
    || Object.prototype.hasOwnProperty.call(envelope, 'action')
    || envelope.envelopeFingerprint
      !== temporalSchedulerContinuationEnvelopeFingerprint(
        envelopeBase(envelope),
      )
  ) {
    throw new TemporalSchedulerContinuationPortError(
      'temporal scheduler continuation envelope is invalid',
    );
  }
}

function validateCurrentAuthority(
  authority: TemporalSchedulerContinuationCurrentAuthority,
): void {
  if (
    !validRef(authority.handoffRequestRef)
    || !validRef(authority.currentContinuationFingerprint)
    || !validRef(authority.currentResumedCheckpointFingerprint)
    || !validRef(authority.currentPostActionStateFingerprint)
    || !validRef(authority.currentWorkflowRef)
    || !validRef(authority.currentWorkflowInstanceRef)
    || !validRef(authority.currentSourceHash)
    || !validRef(authority.currentRunRef)
    || !validRef(authority.currentTimelineRef)
    || !validRef(authority.currentFrameRef)
    || !validRevision(authority.currentStateRevision)
    || [
      authority.continuationCurrent,
      authority.checkpointCurrent,
      authority.stateCurrent,
      authority.sourceCurrent,
    ].some(value => typeof value !== 'boolean')
    || !validUniqueRefs(authority.evidenceRefs)
  ) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation current authority is invalid',
    );
  }
  const requiredEvidence = [
    authority.handoffRequestRef,
    authority.currentContinuationFingerprint,
    authority.currentResumedCheckpointFingerprint,
    authority.currentPostActionStateFingerprint,
  ];
  if (requiredEvidence.some(ref => !authority.evidenceRefs.includes(ref))) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation current authority evidence is incomplete',
    );
  }
}

function currentAuthorityRefusal(
  envelope: TemporalSchedulerContinuationEnvelope,
  authority: TemporalSchedulerContinuationCurrentAuthority,
): string | null {
  const receipt = envelope.continuationReceipt;
  const resume = receipt.causalResume;
  if (
    !authority.continuationCurrent
    || authority.currentContinuationFingerprint
      !== envelope.continuationFingerprint
  ) return 'continuation receipt is not current';
  if (
    !authority.checkpointCurrent
    || authority.currentResumedCheckpointFingerprint
      !== envelope.resumedCheckpointFingerprint
  ) return 'resumed checkpoint is not current';
  if (
    !authority.stateCurrent
    || authority.currentPostActionStateFingerprint
      !== envelope.postActionStateFingerprint
  ) return 'post-action temporal state is not current';
  if (
    !authority.sourceCurrent
    || authority.currentSourceHash !== receipt.domain.sourceHash
  ) return 'Source is not current';
  if (
    authority.currentWorkflowRef !== receipt.domain.workflowRef
    || authority.currentWorkflowInstanceRef
      !== receipt.domain.workflowInstanceRef
  ) return 'workflow identity changed';
  if (authority.currentRunRef !== receipt.domain.runRef) {
    return 'run identity changed';
  }
  if (authority.currentTimelineRef !== receipt.domain.timelineRef) {
    return 'timeline identity changed';
  }
  if (authority.currentFrameRef !== receipt.domain.frameRef) {
    return 'frame identity changed';
  }
  if (authority.currentStateRevision !== receipt.domain.stateRevision) {
    return 'state revision changed';
  }
  if (
    resume.resumedCheckpoint.resumedCheckpointFingerprint
      !== envelope.resumedCheckpointFingerprint
  ) return 'continuation checkpoint lineage changed';
  return null;
}

export function createTemporalSchedulerContinuationAcknowledgement(
  portRef: string,
  input: TemporalSchedulerContinuationConsumerInput,
  status: TemporalSchedulerContinuationAckStatus,
  reason: string,
  evidenceRefs: readonly string[],
): TemporalSchedulerContinuationAcknowledgement {
  if (!validRef(portRef) || !reason.trim() || !validUniqueRefs(evidenceRefs)) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation acknowledgement input is invalid',
    );
  }
  const envelope = input.continuationReceipt;
  const base: Omit<
    TemporalSchedulerContinuationAcknowledgement,
    'acknowledgementFingerprint'
  > = {
    schemaVersion: TEMPORAL_SCHEDULER_CONTINUATION_ACK_SCHEMA_VERSION,
    acknowledgementRef: [
      'temporal-scheduler-ack',
      portRef,
      input.envelopeRef,
    ].join(':'),
    portRef,
    handoffRequestRef: input.handoffRequestRef,
    envelopeRef: input.envelopeRef,
    envelopeFingerprint: input.envelopeFingerprint,
    continuationRef: envelope.continuationRef,
    continuationFingerprint: envelope.receiptFingerprint,
    resumedCheckpointRef:
      envelope.causalResume.resumedCheckpoint.resumedCheckpointRef,
    resumedCheckpointFingerprint:
      envelope.causalResume.resumedCheckpoint.resumedCheckpointFingerprint,
    postActionStateFingerprint: envelope.postActionStateFingerprint,
    status,
    reason,
    evidenceRefs: [...evidenceRefs],
    continuationAccepted: status === 'accepted',
    schedulerExecutionStarted: false,
    workerActionProduced: false,
    actAuthorized: false,
  };
  return {
    ...base,
    acknowledgementFingerprint:
      temporalSchedulerContinuationAcknowledgementFingerprint(base),
  };
}

function validateAcknowledgement(
  acknowledgement: TemporalSchedulerContinuationAcknowledgement,
  envelope: TemporalSchedulerContinuationEnvelope,
  authority: TemporalSchedulerContinuationCurrentAuthority,
  portRef: string,
): void {
  if (
    acknowledgement.schemaVersion
      !== TEMPORAL_SCHEDULER_CONTINUATION_ACK_SCHEMA_VERSION
    || !validRef(acknowledgement.acknowledgementRef)
    || acknowledgement.portRef !== portRef
    || acknowledgement.handoffRequestRef !== authority.handoffRequestRef
    || acknowledgement.envelopeRef !== envelope.envelopeRef
    || acknowledgement.envelopeFingerprint !== envelope.envelopeFingerprint
    || acknowledgement.continuationRef !== envelope.continuationRef
    || acknowledgement.continuationFingerprint
      !== envelope.continuationFingerprint
    || acknowledgement.resumedCheckpointRef
      !== envelope.resumedCheckpoint.resumedCheckpointRef
    || acknowledgement.resumedCheckpointFingerprint
      !== envelope.resumedCheckpointFingerprint
    || acknowledgement.postActionStateFingerprint
      !== envelope.postActionStateFingerprint
    || !['accepted', 'refused'].includes(acknowledgement.status)
    || !acknowledgement.reason.trim()
    || !validUniqueRefs(acknowledgement.evidenceRefs)
    || acknowledgement.continuationAccepted
      !== (acknowledgement.status === 'accepted')
    || acknowledgement.schedulerExecutionStarted !== false
    || acknowledgement.workerActionProduced !== false
    || acknowledgement.actAuthorized !== false
    || Object.prototype.hasOwnProperty.call(acknowledgement, 'action')
    || Object.prototype.hasOwnProperty.call(acknowledgement, 'selectedRef')
    || acknowledgement.acknowledgementFingerprint
      !== temporalSchedulerContinuationAcknowledgementFingerprint(
        acknowledgementBase(acknowledgement),
      )
  ) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation acknowledgement is invalid',
    );
  }
}

function buildHandoffReceipt(
  envelope: TemporalSchedulerContinuationEnvelope,
  acknowledgement: TemporalSchedulerContinuationAcknowledgement,
  authority: TemporalSchedulerContinuationCurrentAuthority,
): TemporalSchedulerContinuationHandoffReceipt {
  const evidenceRefs = canonicalRefs([
    ...envelope.continuationReceipt.evidenceRefs,
    ...acknowledgement.evidenceRefs,
    ...authority.evidenceRefs,
    envelope.envelopeFingerprint,
    acknowledgement.acknowledgementFingerprint,
  ]);
  const base: Omit<
    TemporalSchedulerContinuationHandoffReceipt,
    'receiptFingerprint'
  > = {
    schemaVersion: TEMPORAL_SCHEDULER_CONTINUATION_HANDOFF_SCHEMA_VERSION,
    handoffRef: [
      'temporal-scheduler-handoff',
      envelope.continuationRef,
      acknowledgement.portRef,
    ].join(':'),
    envelopeRef: envelope.envelopeRef,
    envelopeFingerprint: envelope.envelopeFingerprint,
    continuationRef: envelope.continuationRef,
    continuationFingerprint: envelope.continuationFingerprint,
    acknowledgement: structuredClone(acknowledgement),
    lineage: structuredClone(envelope.lineage),
    evidenceRefs,
    continuationConsumed: true,
    schedulerExecutionStarted: false,
    workerActionProduced: false,
    actAuthorized: false,
  };
  return {
    ...base,
    receiptFingerprint:
      temporalSchedulerContinuationHandoffFingerprint(base),
  };
}

function validateHandoffReceipt(
  receipt: TemporalSchedulerContinuationHandoffReceipt,
): void {
  if (
    receipt.schemaVersion
      !== TEMPORAL_SCHEDULER_CONTINUATION_HANDOFF_SCHEMA_VERSION
    || !validRef(receipt.handoffRef)
    || !validRef(receipt.envelopeRef)
    || !validRef(receipt.envelopeFingerprint)
    || !validRef(receipt.continuationRef)
    || !validRef(receipt.continuationFingerprint)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.continuationConsumed !== true
    || receipt.schedulerExecutionStarted !== false
    || receipt.workerActionProduced !== false
    || receipt.actAuthorized !== false
    || receipt.acknowledgement.continuationRef !== receipt.continuationRef
    || receipt.acknowledgement.continuationFingerprint
      !== receipt.continuationFingerprint
    || receipt.acknowledgement.envelopeRef !== receipt.envelopeRef
    || receipt.acknowledgement.envelopeFingerprint
      !== receipt.envelopeFingerprint
    || receipt.receiptFingerprint
      !== temporalSchedulerContinuationHandoffFingerprint(
        handoffReceiptBase(receipt),
      )
  ) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation handoff receipt is invalid',
    );
  }
}

function validateJournal(
  journal: TemporalSchedulerContinuationJournal,
): void {
  if (
    journal.schemaVersion
      !== TEMPORAL_SCHEDULER_CONTINUATION_JOURNAL_SCHEMA_VERSION
    || !Number.isInteger(journal.maxHandoffs)
    || journal.maxHandoffs < 1
    || journal.maxHandoffs > MAX_HANDOFFS_LIMIT
    || journal.receipts.length > journal.maxHandoffs
  ) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation journal envelope is invalid',
    );
  }
  const handoffRefs = new Set<string>();
  const envelopeRefs = new Set<string>();
  const continuationRefs = new Set<string>();
  const acknowledgementRefs = new Set<string>();
  for (const receipt of journal.receipts) {
    validateHandoffReceipt(receipt);
    if (
      handoffRefs.has(receipt.handoffRef)
      || envelopeRefs.has(receipt.envelopeRef)
      || continuationRefs.has(receipt.continuationRef)
      || acknowledgementRefs.has(receipt.acknowledgement.acknowledgementRef)
    ) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation journal contains duplicate identity',
      );
    }
    handoffRefs.add(receipt.handoffRef);
    envelopeRefs.add(receipt.envelopeRef);
    continuationRefs.add(receipt.continuationRef);
    acknowledgementRefs.add(receipt.acknowledgement.acknowledgementRef);
  }
}

export function createTemporalSchedulerContinuationJournal(
  maxHandoffs = DEFAULT_MAX_HANDOFFS,
): TemporalSchedulerContinuationJournal {
  const journal: TemporalSchedulerContinuationJournal = {
    schemaVersion: TEMPORAL_SCHEDULER_CONTINUATION_JOURNAL_SCHEMA_VERSION,
    maxHandoffs,
    receipts: [],
  };
  validateJournal(journal);
  return journal;
}

export function restoreTemporalSchedulerContinuationJournal(
  snapshot: TemporalSchedulerContinuationJournal,
): TemporalSchedulerContinuationJournal {
  const restored = structuredClone(snapshot);
  validateJournal(restored);
  return restored;
}

function appendHandoff(
  journal: TemporalSchedulerContinuationJournal,
  receipt: TemporalSchedulerContinuationHandoffReceipt,
): TemporalSchedulerContinuationJournal {
  if (journal.receipts.length >= journal.maxHandoffs) {
    throw new TemporalSchedulerContinuationPortError(
      'scheduler continuation journal capacity reached',
    );
  }
  const next: TemporalSchedulerContinuationJournal = {
    ...structuredClone(journal),
    receipts: [
      ...journal.receipts.map(item => structuredClone(item)),
      structuredClone(receipt),
    ],
  };
  validateJournal(next);
  return next;
}

function boundedReason(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 512);
}

export class PassiveTemporalSchedulerContinuationPort {
  readonly #scheduler?: SchedulerContinuationPort;
  readonly #trace?: OperationTraceSink;
  readonly #pending = new Map<string, TemporalSchedulerContinuationEnvelope>();
  #journal: TemporalSchedulerContinuationJournal;
  #lastResolution: TemporalSchedulerContinuationResolution | null = null;

  constructor(options: PassiveTemporalSchedulerContinuationPortOptions = {}) {
    if (options.scheduler && !validRef(options.scheduler.portRef)) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation port ref is invalid',
      );
    }
    this.#scheduler = options.scheduler;
    this.#trace = options.trace;
    this.#journal = options.journal
      ? restoreTemporalSchedulerContinuationJournal(options.journal)
      : createTemporalSchedulerContinuationJournal();
  }

  submit(envelope: TemporalSchedulerContinuationEnvelope): void {
    validateTemporalSchedulerContinuationEnvelope(envelope);
    if (this.#journal.receipts.some(item => (
      item.continuationRef === envelope.continuationRef
    ))) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation receipt was already consumed',
      );
    }
    if (this.#pending.has(envelope.continuationRef)) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation envelope is already pending',
      );
    }
    if (this.#pending.size >= MAX_PENDING_ENVELOPES) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation pending envelope bound exceeded',
      );
    }
    this.#pending.set(
      envelope.continuationRef,
      structuredClone(envelope),
    );
  }

  async continue(
    continuationRef: string,
    currentAuthority: TemporalSchedulerContinuationCurrentAuthority,
    signal: AbortSignal,
  ): Promise<TemporalSchedulerContinuationResolution> {
    if (!validRef(continuationRef)) {
      throw new TemporalSchedulerContinuationPortError(
        'scheduler continuation ref is invalid',
      );
    }
    validateCurrentAuthority(currentAuthority);

    const existing = this.#journal.receipts.find(
      item => item.continuationRef === continuationRef,
    );
    if (existing) {
      const resolution = this.#resolutionFromReceipt(existing, true);
      this.#resolve(resolution);
      return resolution;
    }

    const envelope = this.#pending.get(continuationRef);
    if (!envelope) {
      const resolution: TemporalSchedulerContinuationResolution = {
        status: 'missing_envelope',
        continuationRef,
        reason: 'no scheduler continuation envelope is pending',
        portRef: this.#scheduler?.portRef ?? null,
        continuationConsumed: false,
        schedulerExecutionStarted: false,
        workerActionProduced: false,
        actAuthorized: false,
        reused: false,
        receipt: null,
      };
      this.#resolve(resolution);
      return resolution;
    }

    const needId = `need:${CAPABILITY}:${continuationRef}`;
    this.#recordNeed(envelope, needId);

    try {
      validateTemporalSchedulerContinuationEnvelope(envelope);
      const refusal = currentAuthorityRefusal(envelope, currentAuthority);
      if (refusal) {
        const resolution = this.#blocked(
          envelope,
          needId,
          refusal,
          'blocked',
        );
        return resolution;
      }
      if (signal.aborted) {
        const resolution = this.#blocked(
          envelope,
          needId,
          'scheduler continuation handoff was aborted',
          'aborted',
        );
        return resolution;
      }
      if (!this.#scheduler) {
        const reason =
          'continuation withheld because no qualified scheduler continuation port is injected';
        this.#recordOutcome(
          envelope,
          needId,
          'refused',
          'not_produced',
          'refuse',
          false,
          reason,
          null,
        );
        const resolution: TemporalSchedulerContinuationResolution = {
          status: 'continuation_withheld',
          continuationRef,
          reason,
          portRef: null,
          continuationConsumed: false,
          schedulerExecutionStarted: false,
          workerActionProduced: false,
          actAuthorized: false,
          reused: false,
          receipt: null,
        };
        this.#resolve(resolution);
        return resolution;
      }

      const consumerInput: TemporalSchedulerContinuationConsumerInput = {
        handoffRequestRef: currentAuthority.handoffRequestRef,
        envelopeRef: envelope.envelopeRef,
        envelopeFingerprint: envelope.envelopeFingerprint,
        continuationReceipt: structuredClone(envelope.continuationReceipt),
        resumedCheckpoint: structuredClone(envelope.resumedCheckpoint),
        postActionState: structuredClone(envelope.postActionState),
        lineage: structuredClone(envelope.lineage),
        schedulerExecutionAuthorized: false,
        workerActionProduced: false,
        actAuthorized: false,
      };
      const acknowledgement = await this.#scheduler.accept(
        consumerInput,
        signal,
      );
      if (signal.aborted) {
        return this.#blocked(
          envelope,
          needId,
          'scheduler continuation acknowledgement was aborted',
          'aborted',
        );
      }
      validateAcknowledgement(
        acknowledgement,
        envelope,
        currentAuthority,
        this.#scheduler.portRef,
      );
      const receipt = buildHandoffReceipt(
        envelope,
        acknowledgement,
        currentAuthority,
      );
      validateHandoffReceipt(receipt);
      this.#journal = appendHandoff(this.#journal, receipt);
      this.#pending.delete(continuationRef);

      const resolution = this.#resolutionFromReceipt(receipt, false);
      this.#recordOutcome(
        envelope,
        needId,
        acknowledgement.status === 'accepted' ? 'accepted' : 'refused',
        'complete',
        acknowledgement.status === 'accepted' ? 'project' : 'refuse',
        acknowledgement.status === 'accepted',
        acknowledgement.reason,
        receipt.receiptFingerprint,
      );
      this.#resolve(resolution);
      return resolution;
    } catch (error) {
      return this.#blocked(
        envelope,
        needId,
        `scheduler continuation blocked: ${boundedReason(error)}`,
        'blocked',
      );
    }
  }

  snapshot(): TemporalSchedulerContinuationPortSnapshot {
    return {
      pendingEnvelopeRefs: [...this.#pending.keys()].sort(),
      journal: restoreTemporalSchedulerContinuationJournal(this.#journal),
      lastResolution: this.#lastResolution
        ? structuredClone(this.#lastResolution)
        : null,
    };
  }

  #resolutionFromReceipt(
    receipt: TemporalSchedulerContinuationHandoffReceipt,
    reused: boolean,
  ): TemporalSchedulerContinuationResolution {
    return {
      status: receipt.acknowledgement.status === 'accepted'
        ? 'continuation_accepted'
        : 'continuation_refused',
      continuationRef: receipt.continuationRef,
      reason: receipt.acknowledgement.reason,
      portRef: receipt.acknowledgement.portRef,
      continuationConsumed: true,
      schedulerExecutionStarted: false,
      workerActionProduced: false,
      actAuthorized: false,
      reused,
      receipt: structuredClone(receipt),
    };
  }

  #blocked(
    envelope: TemporalSchedulerContinuationEnvelope,
    needId: string,
    reason: string,
    status: 'blocked' | 'aborted',
  ): TemporalSchedulerContinuationResolution {
    this.#recordOutcome(
      envelope,
      needId,
      'blocked',
      'unknown',
      'refuse',
      false,
      reason,
      null,
    );
    const resolution: TemporalSchedulerContinuationResolution = {
      status,
      continuationRef: envelope.continuationRef,
      reason,
      portRef: this.#scheduler?.portRef ?? null,
      continuationConsumed: false,
      schedulerExecutionStarted: false,
      workerActionProduced: false,
      actAuthorized: false,
      reused: false,
      receipt: null,
    };
    this.#resolve(resolution);
    return resolution;
  }

  #resolve(resolution: TemporalSchedulerContinuationResolution): void {
    this.#lastResolution = structuredClone(resolution);
  }

  #recordNeed(
    envelope: TemporalSchedulerContinuationEnvelope,
    needId: string,
  ): void {
    if (!this.#trace) return;
    if (this.#trace.countersOnly) {
      this.#trace.countNeed(CAPABILITY);
      return;
    }
    const identity = envelope.postActionState.identity;
    this.#trace.record({
      kind: 'need',
      needId,
      needKind: CAPABILITY,
      reason: envelope.reason,
      producer: 'passiveTemporalSchedulerContinuationPort',
      episodeId: identity.episodeId,
      levelEpoch: identity.levelEpoch,
      observationId: identity.observationId,
      observationRevision: identity.observationRevision,
      dependencyRefs: [
        envelope.continuationFingerprint,
        envelope.resumedCheckpointFingerprint,
        envelope.postActionStateFingerprint,
      ],
      completeness: 'complete',
    });
  }

  #recordOutcome(
    envelope: TemporalSchedulerContinuationEnvelope,
    needId: string,
    mode: 'accepted' | 'refused' | 'blocked',
    resultStatus: 'complete' | 'unknown' | 'not_produced',
    effectKind: 'project' | 'refuse',
    semanticEffect: boolean,
    reason: string,
    decisionRef: string | null,
  ): void {
    if (!this.#trace) return;
    if (this.#trace.countersOnly) {
      this.#trace.countCapability(CAPABILITY, mode);
      this.#trace.countCapabilityConsumption(CAPABILITY, effectKind);
      return;
    }
    this.#trace.record({
      kind: 'capability',
      needId,
      capability: CAPABILITY,
      caller: 'passiveTemporalSchedulerContinuationPort',
      mode,
      reason,
      inputRefs: [
        envelope.continuationFingerprint,
        envelope.resumedCheckpointFingerprint,
        envelope.postActionStateFingerprint,
      ],
      dependencyRevisions: {
        observation: envelope.postActionState.identity.observationRevision,
      },
      resultStatus,
      resultSummary: {
        continuationConsumed: decisionRef !== null,
        schedulerExecutionStarted: false,
        workerActionProduced: false,
        actAuthorized: false,
        portRef: this.#scheduler?.portRef ?? null,
      },
    });
    this.#trace.record({
      kind: 'capability_consumption',
      needId,
      capability: CAPABILITY,
      consumer: this.#scheduler?.portRef
        ?? 'passiveTemporalSchedulerContinuationPort',
      decisionRef: decisionRef ?? envelope.continuationRef,
      effectKind,
      semanticEffect,
      reason,
    });
  }
}
