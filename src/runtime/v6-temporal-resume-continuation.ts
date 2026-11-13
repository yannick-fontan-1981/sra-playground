import {
  createTemporalObservationState,
  restoreTemporalObservationState,
  type TemporalObservationState,
} from '../logos-engine/v6-temporal-observation-state.ts';
import {
  validateTemporalSelectionRequest,
  type TemporalObservationIdentity,
  type TemporalSelectionAlternative,
  type TemporalSelectionRequest,
  type TemporalSourceAuthority,
} from '../logos-engine/v6-temporal-selection-contract.ts';
import {
  restoreTemporalCausalResumeJournal,
  type TemporalCausalResumeJournal,
  type TemporalCausalResumeReceipt,
} from './v6-temporal-causal-resume.ts';

/**
 * Descriptive continuation boundary after one qualified causal resume.
 *
 * This module seals an externally supplied post-action alternative domain and
 * creates a fresh TemporalObservationState for the acquired observation. It
 * deliberately does not run the scheduler, choose an alternative, authorize
 * ACT, dispatch another action, or carry pre-action memory/returns forward.
 */

export const TEMPORAL_POST_ACTION_DOMAIN_SCHEMA_VERSION =
  'sra.temporal_post_action_domain.v1' as const;
export const TEMPORAL_RESUME_CONTINUATION_RECEIPT_SCHEMA_VERSION =
  'sra.temporal_resume_continuation_receipt.v1' as const;
export const TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION =
  'sra.temporal_resume_continuation_journal.v1' as const;

const DEFAULT_MAX_CONTINUATIONS = 128;
const MAX_CONTINUATIONS_LIMIT = 1024;

export interface TemporalPostActionDomainReceipt {
  schemaVersion: typeof TEMPORAL_POST_ACTION_DOMAIN_SCHEMA_VERSION;
  domainReceiptRef: string;
  producerRef: string;
  workflowRef: string;
  workflowInstanceRef: string;
  sourceHash: string;
  runRef: string;
  timelineRef: string;
  frameRef: string;
  stateRevision: number;
  rawInputRef: string;
  resumeRef: string;
  resumeFingerprint: string;
  dispatchRef: string;
  dispatchFingerprint: string;
  observationReceiptRef: string;
  observationFingerprintSeal: string;
  resumedCheckpointRef: string;
  resumedCheckpointFingerprint: string;
  identity: TemporalObservationIdentity;
  alternatives: readonly TemporalSelectionAlternative[];
  requirementRefs: readonly string[];
  preserveRefs: readonly string[];
  evidenceRefs: readonly string[];
  domainFingerprint: string;
}

export interface CreateTemporalPostActionDomainInput {
  resumeReceipt: TemporalCausalResumeReceipt;
  sourceAuthority: TemporalSourceAuthority;
  producerRef: string;
  alternatives: readonly TemporalSelectionAlternative[];
  requirementRefs: readonly string[];
  evidenceRefs: readonly string[];
}

export interface TemporalResumeContinuationCurrentAuthority {
  continuationRequestRef: string;
  currentResumeFingerprint: string;
  currentResumedCheckpointFingerprint: string;
  currentDomainFingerprint: string;
  currentWorkflowRef: string;
  currentWorkflowInstanceRef: string;
  currentSourceHash: string;
  currentRunRef: string;
  currentTimelineRef: string;
  currentFrameRef: string;
  currentStateRevision: number;
  causalReceiptCurrent: boolean;
  checkpointCurrent: boolean;
  sourceCurrent: boolean;
  domainProducerCurrent: boolean;
  evidenceRefs: readonly string[];
}

export interface TemporalResumeContinuationReceipt {
  schemaVersion: typeof TEMPORAL_RESUME_CONTINUATION_RECEIPT_SCHEMA_VERSION;
  continuationRef: string;
  causalResume: TemporalCausalResumeReceipt;
  domain: TemporalPostActionDomainReceipt;
  postActionState: TemporalObservationState;
  postActionStateFingerprint: string;
  evidenceRefs: readonly string[];
  causalReceiptConsumed: true;
  priorQualifiedReturnsCarried: false;
  priorMemoryReuseCarried: false;
  continuationPrepared: true;
  schedulerExecutionStarted: false;
  workerActionProduced: false;
  actAuthorized: false;
  receiptFingerprint: string;
}

export interface TemporalResumeContinuationJournal {
  schemaVersion: typeof TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION;
  maxContinuations: number;
  receipts: readonly TemporalResumeContinuationReceipt[];
}

export interface PrepareTemporalResumeContinuationInput {
  journal: TemporalResumeContinuationJournal;
  causalResumeJournal: TemporalCausalResumeJournal;
  resumeRef: string;
  domain: TemporalPostActionDomainReceipt;
  sourceAuthority: TemporalSourceAuthority;
  currentAuthority: TemporalResumeContinuationCurrentAuthority;
}

export interface TemporalResumeContinuationResult {
  journal: TemporalResumeContinuationJournal;
  receipt: TemporalResumeContinuationReceipt;
  emittedPostActionState: TemporalObservationState | null;
  reused: boolean;
}

export type TemporalResumeContinuationRefusalReason =
  | 'causal_receipt_not_current'
  | 'checkpoint_not_current'
  | 'source_changed'
  | 'workflow_changed'
  | 'run_changed'
  | 'timeline_changed'
  | 'frame_changed'
  | 'state_revision_changed'
  | 'domain_producer_not_current'
  | 'domain_changed';

export class TemporalResumeContinuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporalResumeContinuationError';
  }
}

export class TemporalResumeContinuationRefusedError
  extends TemporalResumeContinuationError {
  readonly reason: TemporalResumeContinuationRefusalReason;
  readonly causalReceiptConsumed = false as const;
  readonly continuationPrepared = false as const;

  constructor(reason: TemporalResumeContinuationRefusalReason) {
    super(`temporal resume continuation refused: ${reason}`);
    this.name = 'TemporalResumeContinuationRefusedError';
    this.reason = reason;
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

function canonicalRefs(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function cloneAlternatives(
  alternatives: readonly TemporalSelectionAlternative[],
): TemporalSelectionAlternative[] {
  return alternatives.map(item => ({
    ref: item.ref,
    facts: structuredClone(item.facts),
    evidenceRefs: [...item.evidenceRefs],
  }));
}

function canonicalAlternatives(
  alternatives: readonly TemporalSelectionAlternative[],
): TemporalSelectionAlternative[] {
  return cloneAlternatives(alternatives)
    .map(item => ({
      ...item,
      evidenceRefs: canonicalRefs(item.evidenceRefs),
    }))
    .sort((first, second) => first.ref.localeCompare(second.ref));
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

function sameIdentity(
  first: TemporalObservationIdentity,
  second: TemporalObservationIdentity,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
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

function requestFromDomain(
  domain: TemporalPostActionDomainReceipt,
): TemporalSelectionRequest {
  return {
    workflowRef: domain.workflowRef,
    sourceHash: domain.sourceHash,
    identity: structuredClone(domain.identity),
    alternatives: cloneAlternatives(domain.alternatives),
    requirementRefs: [...domain.requirementRefs],
    preserveRefs: [...domain.preserveRefs],
  };
}

function domainBase(
  receipt: TemporalPostActionDomainReceipt,
): Omit<TemporalPostActionDomainReceipt, 'domainFingerprint'> {
  const { domainFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

function continuationReceiptBase(
  receipt: TemporalResumeContinuationReceipt,
): Omit<TemporalResumeContinuationReceipt, 'receiptFingerprint'> {
  const { receiptFingerprint: _ignored, ...base } = structuredClone(receipt);
  return base;
}

export function temporalPostActionDomainFingerprint(
  receipt: Omit<TemporalPostActionDomainReceipt, 'domainFingerprint'>,
): string {
  return fingerprint({
    ...receipt,
    identity: structuredClone(receipt.identity),
    alternatives: canonicalAlternatives(receipt.alternatives),
    requirementRefs: canonicalRefs(receipt.requirementRefs),
    preserveRefs: canonicalRefs(receipt.preserveRefs),
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

export function temporalPostActionStateFingerprint(
  state: TemporalObservationState,
): string {
  return fingerprint({
    ...structuredClone(state),
    identity: structuredClone(state.identity),
    alternatives: canonicalAlternatives(state.alternatives),
    requirementRefs: canonicalRefs(state.requirementRefs),
    preserveRefs: canonicalRefs(state.preserveRefs),
    qualifiedReturns: [...state.qualifiedReturns],
    consumedReturnIdentityKeys: canonicalRefs(
      state.consumedReturnIdentityKeys,
    ),
    memoryProofRefs: canonicalRefs(state.memoryProofRefs),
  });
}

export function temporalResumeContinuationReceiptFingerprint(
  receipt: Omit<TemporalResumeContinuationReceipt, 'receiptFingerprint'>,
): string {
  return fingerprint({
    ...receipt,
    domain: {
      ...receipt.domain,
      alternatives: canonicalAlternatives(receipt.domain.alternatives),
      requirementRefs: canonicalRefs(receipt.domain.requirementRefs),
      preserveRefs: canonicalRefs(receipt.domain.preserveRefs),
      evidenceRefs: canonicalRefs(receipt.domain.evidenceRefs),
    },
    postActionState: {
      ...receipt.postActionState,
      alternatives: canonicalAlternatives(receipt.postActionState.alternatives),
      requirementRefs: canonicalRefs(receipt.postActionState.requirementRefs),
      preserveRefs: canonicalRefs(receipt.postActionState.preserveRefs),
      consumedReturnIdentityKeys: canonicalRefs(
        receipt.postActionState.consumedReturnIdentityKeys,
      ),
      memoryProofRefs: canonicalRefs(receipt.postActionState.memoryProofRefs),
    },
    evidenceRefs: canonicalRefs(receipt.evidenceRefs),
  });
}

function validateCausalResumeReceipt(
  receipt: TemporalCausalResumeReceipt,
): void {
  restoreTemporalCausalResumeJournal({
    schemaVersion: 'sra.temporal_causal_resume_journal.v1',
    maxResumes: 1,
    receipts: [structuredClone(receipt)],
  });
}

export function createTemporalPostActionDomainReceipt(
  input: CreateTemporalPostActionDomainInput,
): TemporalPostActionDomainReceipt {
  validateCausalResumeReceipt(input.resumeReceipt);
  if (!validRef(input.producerRef)) {
    throw new TemporalResumeContinuationError(
      'post-action domain producer ref is invalid',
    );
  }
  if (!validUniqueRefs(input.requirementRefs)) {
    throw new TemporalResumeContinuationError(
      'post-action requirement refs are invalid',
    );
  }
  if (!validUniqueRefs(input.evidenceRefs)) {
    throw new TemporalResumeContinuationError(
      'post-action domain evidence refs are invalid',
    );
  }
  if (
    input.alternatives.length < 1
    || input.alternatives.length > 256
    || input.alternatives.some(item => (
      !validRef(item.ref)
      || !validUniqueRefs(item.evidenceRefs)
      || item.facts === null
      || typeof item.facts !== 'object'
      || Array.isArray(item.facts)
    ))
    || new Set(input.alternatives.map(item => item.ref)).size
      !== input.alternatives.length
  ) {
    throw new TemporalResumeContinuationError(
      'post-action alternative domain is invalid',
    );
  }

  const resume = input.resumeReceipt;
  const observation = resume.observation;
  const preserveRefs = canonicalRefs(input.alternatives.map(item => item.ref));
  const request: TemporalSelectionRequest = {
    workflowRef: observation.workflowRef,
    sourceHash: observation.sourceHash,
    identity: structuredClone(observation.observationIdentity),
    alternatives: cloneAlternatives(input.alternatives),
    requirementRefs: [...input.requirementRefs],
    preserveRefs,
  };
  const invalid = validateTemporalSelectionRequest(request, input.sourceAuthority);
  if (invalid) {
    throw new TemporalResumeContinuationError(
      `post-action domain is not Source-authorized: ${invalid.reason}`,
    );
  }

  const evidenceRefs = canonicalRefs([
    ...input.evidenceRefs,
    ...resume.evidenceRefs,
    ...input.alternatives.flatMap(item => item.evidenceRefs),
    input.producerRef,
    resume.receiptFingerprint,
    resume.dispatchFingerprint,
    observation.observationFingerprintSeal,
    resume.resumedCheckpoint.resumedCheckpointFingerprint,
  ]);
  const base: Omit<TemporalPostActionDomainReceipt, 'domainFingerprint'> = {
    schemaVersion: TEMPORAL_POST_ACTION_DOMAIN_SCHEMA_VERSION,
    domainReceiptRef: [
      'temporal-post-action-domain',
      resume.resumeRef,
      input.producerRef,
    ].join(':'),
    producerRef: input.producerRef,
    workflowRef: observation.workflowRef,
    workflowInstanceRef: observation.workflowInstanceRef,
    sourceHash: observation.sourceHash,
    runRef: observation.runRef,
    timelineRef: observation.timelineRef,
    frameRef: observation.frameRef,
    stateRevision: observation.stateRevision,
    rawInputRef: observation.rawInputRef,
    resumeRef: resume.resumeRef,
    resumeFingerprint: resume.receiptFingerprint,
    dispatchRef: resume.dispatchRef,
    dispatchFingerprint: resume.dispatchFingerprint,
    observationReceiptRef: observation.observationReceiptRef,
    observationFingerprintSeal: observation.observationFingerprintSeal,
    resumedCheckpointRef: resume.resumedCheckpoint.resumedCheckpointRef,
    resumedCheckpointFingerprint:
      resume.resumedCheckpoint.resumedCheckpointFingerprint,
    identity: structuredClone(observation.observationIdentity),
    alternatives: cloneAlternatives(input.alternatives),
    requirementRefs: [...input.requirementRefs],
    preserveRefs,
    evidenceRefs,
  };
  const receipt: TemporalPostActionDomainReceipt = {
    ...base,
    domainFingerprint: temporalPostActionDomainFingerprint(base),
  };
  validateTemporalPostActionDomainReceipt(
    receipt,
    resume,
    input.sourceAuthority,
  );
  return receipt;
}

export function validateTemporalPostActionDomainReceipt(
  receipt: TemporalPostActionDomainReceipt,
  resume: TemporalCausalResumeReceipt,
  sourceAuthority: TemporalSourceAuthority,
): void {
  validateCausalResumeReceipt(resume);
  if (
    receipt.schemaVersion !== TEMPORAL_POST_ACTION_DOMAIN_SCHEMA_VERSION
    || !validRef(receipt.domainReceiptRef)
    || !validRef(receipt.producerRef)
    || !validRef(receipt.workflowRef)
    || !validRef(receipt.workflowInstanceRef)
    || !validRef(receipt.sourceHash)
    || !validRef(receipt.runRef)
    || !validRef(receipt.timelineRef)
    || !validRef(receipt.frameRef)
    || !validRevision(receipt.stateRevision)
    || !validRef(receipt.rawInputRef)
    || !validRef(receipt.resumeRef)
    || !validRef(receipt.resumeFingerprint)
    || !validRef(receipt.dispatchRef)
    || !validRef(receipt.dispatchFingerprint)
    || !validRef(receipt.observationReceiptRef)
    || !validRef(receipt.observationFingerprintSeal)
    || !validRef(receipt.resumedCheckpointRef)
    || !validRef(receipt.resumedCheckpointFingerprint)
    || !validRef(receipt.identity.episodeId)
    || !validLevelEpoch(receipt.identity.levelEpoch)
    || !validRef(receipt.identity.observationId)
    || !validRevision(receipt.identity.observationRevision)
    || !validUniqueRefs(receipt.requirementRefs)
    || !validUniqueRefs(receipt.preserveRefs)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.alternatives.length < 1
    || receipt.alternatives.length > 256
    || receipt.alternatives.some(item => (
      !validRef(item.ref)
      || !validUniqueRefs(item.evidenceRefs)
      || item.facts === null
      || typeof item.facts !== 'object'
      || Array.isArray(item.facts)
    ))
    || new Set(receipt.alternatives.map(item => item.ref)).size
      !== receipt.alternatives.length
    || Object.prototype.hasOwnProperty.call(receipt, 'selectedRef')
    || receipt.domainFingerprint
      !== temporalPostActionDomainFingerprint(domainBase(receipt))
  ) {
    throw new TemporalResumeContinuationError(
      'post-action domain receipt is invalid',
    );
  }

  const observation = resume.observation;
  if (
    receipt.workflowRef !== observation.workflowRef
    || receipt.workflowInstanceRef !== observation.workflowInstanceRef
    || receipt.sourceHash !== observation.sourceHash
    || receipt.runRef !== observation.runRef
    || receipt.timelineRef !== observation.timelineRef
    || receipt.frameRef !== observation.frameRef
    || receipt.stateRevision !== observation.stateRevision
    || receipt.rawInputRef !== observation.rawInputRef
    || receipt.resumeRef !== resume.resumeRef
    || receipt.resumeFingerprint !== resume.receiptFingerprint
    || receipt.dispatchRef !== resume.dispatchRef
    || receipt.dispatchFingerprint !== resume.dispatchFingerprint
    || receipt.observationReceiptRef !== observation.observationReceiptRef
    || receipt.observationFingerprintSeal
      !== observation.observationFingerprintSeal
    || receipt.resumedCheckpointRef
      !== resume.resumedCheckpoint.resumedCheckpointRef
    || receipt.resumedCheckpointFingerprint
      !== resume.resumedCheckpoint.resumedCheckpointFingerprint
    || !sameIdentity(receipt.identity, observation.observationIdentity)
    || receipt.identity.episodeId !== receipt.timelineRef
    || receipt.identity.observationId !== receipt.frameRef
    || receipt.identity.observationRevision !== receipt.stateRevision
  ) {
    throw new TemporalResumeContinuationError(
      'post-action domain does not belong to the causal resume',
    );
  }

  const request = requestFromDomain(receipt);
  const invalid = validateTemporalSelectionRequest(request, sourceAuthority);
  if (invalid) {
    throw new TemporalResumeContinuationError(
      `post-action domain Source validation failed: ${invalid.reason}`,
    );
  }
  const expectedPreserve = canonicalRefs(
    receipt.alternatives.map(item => item.ref),
  );
  if (
    JSON.stringify(canonicalRefs(receipt.preserveRefs))
      !== JSON.stringify(expectedPreserve)
  ) {
    throw new TemporalResumeContinuationError(
      'post-action domain lost its complete alternative scope',
    );
  }
}

function validateCurrentAuthority(
  authority: TemporalResumeContinuationCurrentAuthority,
): void {
  if (
    !validRef(authority.continuationRequestRef)
    || !validRef(authority.currentResumeFingerprint)
    || !validRef(authority.currentResumedCheckpointFingerprint)
    || !validRef(authority.currentDomainFingerprint)
    || !validRef(authority.currentWorkflowRef)
    || !validRef(authority.currentWorkflowInstanceRef)
    || !validRef(authority.currentSourceHash)
    || !validRef(authority.currentRunRef)
    || !validRef(authority.currentTimelineRef)
    || !validRef(authority.currentFrameRef)
    || !validRevision(authority.currentStateRevision)
    || [
      authority.causalReceiptCurrent,
      authority.checkpointCurrent,
      authority.sourceCurrent,
      authority.domainProducerCurrent,
    ].some(value => typeof value !== 'boolean')
    || !validUniqueRefs(authority.evidenceRefs)
  ) {
    throw new TemporalResumeContinuationError(
      'resume continuation current authority is invalid',
    );
  }
  const requiredEvidence = [
    authority.continuationRequestRef,
    authority.currentResumeFingerprint,
    authority.currentResumedCheckpointFingerprint,
    authority.currentDomainFingerprint,
  ];
  if (requiredEvidence.some(ref => !authority.evidenceRefs.includes(ref))) {
    throw new TemporalResumeContinuationError(
      'resume continuation current authority evidence is incomplete',
    );
  }
}

function refusalReason(
  resume: TemporalCausalResumeReceipt,
  domain: TemporalPostActionDomainReceipt,
  authority: TemporalResumeContinuationCurrentAuthority,
): TemporalResumeContinuationRefusalReason | null {
  if (
    !authority.causalReceiptCurrent
    || authority.currentResumeFingerprint !== resume.receiptFingerprint
  ) return 'causal_receipt_not_current';
  if (
    !authority.checkpointCurrent
    || authority.currentResumedCheckpointFingerprint
      !== resume.resumedCheckpoint.resumedCheckpointFingerprint
  ) return 'checkpoint_not_current';
  if (
    !authority.sourceCurrent
    || authority.currentSourceHash !== resume.observation.sourceHash
  ) return 'source_changed';
  if (
    authority.currentWorkflowRef !== resume.observation.workflowRef
    || authority.currentWorkflowInstanceRef
      !== resume.observation.workflowInstanceRef
  ) return 'workflow_changed';
  if (authority.currentRunRef !== resume.observation.runRef) return 'run_changed';
  if (authority.currentTimelineRef !== resume.observation.timelineRef) {
    return 'timeline_changed';
  }
  if (authority.currentFrameRef !== resume.observation.frameRef) {
    return 'frame_changed';
  }
  if (authority.currentStateRevision !== resume.observation.stateRevision) {
    return 'state_revision_changed';
  }
  if (!authority.domainProducerCurrent) return 'domain_producer_not_current';
  if (authority.currentDomainFingerprint !== domain.domainFingerprint) {
    return 'domain_changed';
  }
  return null;
}

function buildContinuationReceipt(
  resume: TemporalCausalResumeReceipt,
  domain: TemporalPostActionDomainReceipt,
  state: TemporalObservationState,
  authority: TemporalResumeContinuationCurrentAuthority,
): TemporalResumeContinuationReceipt {
  const stateFingerprint = temporalPostActionStateFingerprint(state);
  const evidenceRefs = canonicalRefs([
    ...resume.evidenceRefs,
    ...domain.evidenceRefs,
    ...authority.evidenceRefs,
    resume.receiptFingerprint,
    resume.dispatchFingerprint,
    resume.observation.observationFingerprintSeal,
    resume.actionObserved.actionObservedFingerprint,
    resume.leaseTransition.transitionFingerprint,
    resume.resumedCheckpoint.resumedCheckpointFingerprint,
    domain.domainFingerprint,
    stateFingerprint,
  ]);
  const base: Omit<
    TemporalResumeContinuationReceipt,
    'receiptFingerprint'
  > = {
    schemaVersion: TEMPORAL_RESUME_CONTINUATION_RECEIPT_SCHEMA_VERSION,
    continuationRef: [
      'temporal-resume-continuation',
      resume.resumeRef,
      domain.domainReceiptRef,
    ].join(':'),
    causalResume: structuredClone(resume),
    domain: structuredClone(domain),
    postActionState: structuredClone(state),
    postActionStateFingerprint: stateFingerprint,
    evidenceRefs,
    causalReceiptConsumed: true,
    priorQualifiedReturnsCarried: false,
    priorMemoryReuseCarried: false,
    continuationPrepared: true,
    schedulerExecutionStarted: false,
    workerActionProduced: false,
    actAuthorized: false,
  };
  return {
    ...base,
    receiptFingerprint: temporalResumeContinuationReceiptFingerprint(base),
  };
}

function validateContinuationReceipt(
  receipt: TemporalResumeContinuationReceipt,
): void {
  validateCausalResumeReceipt(receipt.causalResume);
  const authority = selfAuthority(
    receipt.domain.workflowRef,
    receipt.domain.sourceHash,
  );
  validateTemporalPostActionDomainReceipt(
    receipt.domain,
    receipt.causalResume,
    authority,
  );
  const restoredState = restoreTemporalObservationState(
    receipt.postActionState,
    authority,
  );
  if (
    receipt.schemaVersion
      !== TEMPORAL_RESUME_CONTINUATION_RECEIPT_SCHEMA_VERSION
    || !validRef(receipt.continuationRef)
    || !validRef(receipt.postActionStateFingerprint)
    || !validUniqueRefs(receipt.evidenceRefs)
    || receipt.causalReceiptConsumed !== true
    || receipt.priorQualifiedReturnsCarried !== false
    || receipt.priorMemoryReuseCarried !== false
    || receipt.continuationPrepared !== true
    || receipt.schedulerExecutionStarted !== false
    || receipt.workerActionProduced !== false
    || receipt.actAuthorized !== false
    || receipt.postActionStateFingerprint
      !== temporalPostActionStateFingerprint(restoredState)
    || restoredState.workflowRef !== receipt.domain.workflowRef
    || restoredState.sourceHash !== receipt.domain.sourceHash
    || !sameIdentity(restoredState.identity, receipt.domain.identity)
    || JSON.stringify(canonicalAlternatives(restoredState.alternatives))
      !== JSON.stringify(canonicalAlternatives(receipt.domain.alternatives))
    || JSON.stringify(canonicalRefs(restoredState.requirementRefs))
      !== JSON.stringify(canonicalRefs(receipt.domain.requirementRefs))
    || JSON.stringify(canonicalRefs(restoredState.preserveRefs))
      !== JSON.stringify(canonicalRefs(receipt.domain.preserveRefs))
    || restoredState.qualifiedReturns.length !== 0
    || restoredState.consumedReturnIdentityKeys.length !== 0
    || restoredState.memoryReuseContract !== null
    || restoredState.memoryProofRefs.length !== 0
    || receipt.receiptFingerprint
      !== temporalResumeContinuationReceiptFingerprint(
        continuationReceiptBase(receipt),
      )
  ) {
    throw new TemporalResumeContinuationError(
      'temporal resume continuation receipt is invalid',
    );
  }
}

function validateJournal(journal: TemporalResumeContinuationJournal): void {
  if (
    journal.schemaVersion
      !== TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION
    || !Number.isInteger(journal.maxContinuations)
    || journal.maxContinuations < 1
    || journal.maxContinuations > MAX_CONTINUATIONS_LIMIT
    || journal.receipts.length > journal.maxContinuations
  ) {
    throw new TemporalResumeContinuationError(
      'temporal resume continuation journal envelope is invalid',
    );
  }
  const continuationRefs = new Set<string>();
  const resumeRefs = new Set<string>();
  const checkpointRefs = new Set<string>();
  const observationRefs = new Set<string>();
  const domainRefs = new Set<string>();
  for (const receipt of journal.receipts) {
    validateContinuationReceipt(receipt);
    if (
      continuationRefs.has(receipt.continuationRef)
      || resumeRefs.has(receipt.causalResume.resumeRef)
      || checkpointRefs.has(
        receipt.causalResume.resumedCheckpoint.resumedCheckpointRef,
      )
      || observationRefs.has(
        receipt.causalResume.observation.observationReceiptRef,
      )
      || domainRefs.has(receipt.domain.domainReceiptRef)
    ) {
      throw new TemporalResumeContinuationError(
        'temporal continuation journal contains duplicate causal identity',
      );
    }
    continuationRefs.add(receipt.continuationRef);
    resumeRefs.add(receipt.causalResume.resumeRef);
    checkpointRefs.add(
      receipt.causalResume.resumedCheckpoint.resumedCheckpointRef,
    );
    observationRefs.add(
      receipt.causalResume.observation.observationReceiptRef,
    );
    domainRefs.add(receipt.domain.domainReceiptRef);
  }
}

export function createTemporalResumeContinuationJournal(
  maxContinuations = DEFAULT_MAX_CONTINUATIONS,
): TemporalResumeContinuationJournal {
  const journal: TemporalResumeContinuationJournal = {
    schemaVersion: TEMPORAL_RESUME_CONTINUATION_JOURNAL_SCHEMA_VERSION,
    maxContinuations,
    receipts: [],
  };
  validateJournal(journal);
  return journal;
}

export function restoreTemporalResumeContinuationJournal(
  snapshot: TemporalResumeContinuationJournal,
): TemporalResumeContinuationJournal {
  const restored = structuredClone(snapshot);
  validateJournal(restored);
  return restored;
}

function appendReceipt(
  journal: TemporalResumeContinuationJournal,
  receipt: TemporalResumeContinuationReceipt,
): TemporalResumeContinuationJournal {
  if (journal.receipts.length >= journal.maxContinuations) {
    throw new TemporalResumeContinuationError(
      'temporal resume continuation journal capacity reached',
    );
  }
  const next: TemporalResumeContinuationJournal = {
    ...structuredClone(journal),
    receipts: [
      ...journal.receipts.map(item => structuredClone(item)),
      structuredClone(receipt),
    ],
  };
  validateJournal(next);
  return next;
}

export function prepareTemporalResumeContinuation(
  input: PrepareTemporalResumeContinuationInput,
): TemporalResumeContinuationResult {
  validateJournal(input.journal);
  validateCurrentAuthority(input.currentAuthority);
  const causalJournal = restoreTemporalCausalResumeJournal(
    input.causalResumeJournal,
  );
  const resume = causalJournal.receipts.find(
    item => item.resumeRef === input.resumeRef,
  );
  if (!resume) {
    throw new TemporalResumeContinuationError(
      'post-action continuation requires a durable causal resume receipt',
    );
  }
  validateTemporalPostActionDomainReceipt(
    input.domain,
    resume,
    input.sourceAuthority,
  );

  const existing = input.journal.receipts.find(
    item => item.causalResume.resumeRef === resume.resumeRef,
  );
  if (existing) {
    if (
      existing.causalResume.receiptFingerprint !== resume.receiptFingerprint
      || existing.domain.domainFingerprint !== input.domain.domainFingerprint
    ) {
      throw new TemporalResumeContinuationError(
        'causal resume already continued with another domain identity',
      );
    }
    return {
      journal: structuredClone(input.journal),
      receipt: structuredClone(existing),
      emittedPostActionState: null,
      reused: true,
    };
  }

  if (input.journal.receipts.some(item => (
    item.causalResume.resumedCheckpoint.resumedCheckpointRef
      === resume.resumedCheckpoint.resumedCheckpointRef
  ))) {
    throw new TemporalResumeContinuationError(
      'resumed checkpoint already has a continuation receipt',
    );
  }

  const reason = refusalReason(resume, input.domain, input.currentAuthority);
  if (reason) throw new TemporalResumeContinuationRefusedError(reason);

  const state = createTemporalObservationState(
    requestFromDomain(input.domain),
    input.sourceAuthority,
  );
  const receipt = buildContinuationReceipt(
    resume,
    input.domain,
    state,
    input.currentAuthority,
  );
  validateContinuationReceipt(receipt);
  const journal = appendReceipt(input.journal, receipt);
  return {
    journal,
    receipt: structuredClone(receipt),
    emittedPostActionState: structuredClone(state),
    reused: false,
  };
}
