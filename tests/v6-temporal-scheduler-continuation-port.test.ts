import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import type {
  TemporalSelectionAlternative,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
import {
  TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION,
  TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION,
  TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION,
  TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION,
  TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION,
  TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION,
  temporalActionObservedFingerprint,
  temporalCausalObservationFingerprint,
  temporalCausalResumeReceiptFingerprint,
  temporalLeaseObservedTransitionFingerprint,
  temporalResumedCheckpointFingerprint,
  type TemporalActionObservedReceipt,
  type TemporalCausalObservationReceipt,
  type TemporalCausalResumeJournal,
  type TemporalCausalResumeReceipt,
  type TemporalLeaseObservedTransitionReceipt,
  type TemporalResumedWorkflowCheckpoint,
} from '../src/runtime/v6-temporal-causal-resume.ts';
import {
  createTemporalPostActionDomainReceipt,
  createTemporalResumeContinuationJournal,
  prepareTemporalResumeContinuation,
  type TemporalPostActionDomainReceipt,
  type TemporalResumeContinuationCurrentAuthority,
  type TemporalResumeContinuationReceipt,
} from '../src/runtime/v6-temporal-resume-continuation.ts';
import {
  PassiveTemporalSchedulerContinuationPort,
  bindTemporalSchedulerContinuationEnvelope,
  createTemporalSchedulerContinuationAcknowledgement,
  createTemporalSchedulerContinuationJournal,
  restoreTemporalSchedulerContinuationJournal,
  temporalSchedulerContinuationHandoffFingerprint,
  type SchedulerContinuationPort,
  type TemporalSchedulerContinuationAcknowledgement,
  type TemporalSchedulerContinuationConsumerInput,
  type TemporalSchedulerContinuationCurrentAuthority,
  type TemporalSchedulerContinuationEnvelope,
} from '../src/runtime/v6-temporal-scheduler-continuation-port.ts';

const sourceAuthority: TemporalSourceAuthority = {
  workflowRef: 'arc3.temporal_selection',
  sourceHash: 'source-hash',
  authorizedWorkflowRefs: ['arc3.temporal_selection'],
  authorizedSourceHash: 'source-hash',
};

function causalReceipt(suffix = ''): TemporalCausalResumeReceipt {
  const observationBase: Omit<
    TemporalCausalObservationReceipt,
    'observationFingerprintSeal'
  > = {
    schemaVersion: TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION,
    observationReceiptRef: `temporal-observation-acquired:dispatch:8${suffix}`,
    dispatchRef: `dispatch:8${suffix}`,
    dispatchFingerprint: `dispatch-fingerprint:8${suffix}`,
    environmentActionEventRef: `environment-event:8${suffix}`,
    actionIntentRef: `intent:8${suffix}`,
    actionReleasePermitRef: `permit:8${suffix}`,
    actReceiptRef: `act-receipt:8${suffix}`,
    workflowRef: 'arc3.temporal_selection',
    workflowInstanceRef: `workflow-instance:8${suffix}`,
    sourceHash: 'source-hash',
    runRef: `session:1${suffix}`,
    timelineRef: `timeline:episode:1${suffix}`,
    previousFrameRef: `observation:8${suffix}`,
    frameRef: `observation:9${suffix}`,
    stateRevision: 9,
    observationIdentity: {
      episodeId: `timeline:episode:1${suffix}`,
      levelEpoch: 2,
      observationId: `observation:9${suffix}`,
      observationRevision: 9,
    },
    observationSequence: 9,
    rawInputRef: `raw-input:9${suffix}`,
    observationFingerprint: `public-observation-fingerprint:9${suffix}`,
    acquisitionModelRef: 'transport.causal_frame',
    evidenceRefs: [`evidence:dispatch:8${suffix}`],
  };
  const observation: TemporalCausalObservationReceipt = {
    ...observationBase,
    observationFingerprintSeal:
      temporalCausalObservationFingerprint(observationBase),
  };

  const actionObservedBase: Omit<
    TemporalActionObservedReceipt,
    'actionObservedFingerprint'
  > = {
    schemaVersion: TEMPORAL_ACTION_OBSERVED_SCHEMA_VERSION,
    actionObservedRef: `temporal-action-observed:workflow-instance:8:9${suffix}`,
    operationalReturnBindingRef: `operational-return-binding:9${suffix}`,
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
    evidenceRefs: [`evidence:action-observed:9${suffix}`],
  };
  const actionObserved: TemporalActionObservedReceipt = {
    ...actionObservedBase,
    actionObservedFingerprint:
      temporalActionObservedFingerprint(actionObservedBase),
  };

  const transitionBase: Omit<
    TemporalLeaseObservedTransitionReceipt,
    'transitionFingerprint'
  > = {
    schemaVersion: TEMPORAL_LEASE_OBSERVED_TRANSITION_SCHEMA_VERSION,
    transitionRef: `temporal-lease-observed:lease:8:observation:9${suffix}`,
    leaseRef: `lease:8${suffix}`,
    permitRef: observation.actionReleasePermitRef,
    actionIntentRef: observation.actionIntentRef,
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
    evidenceRefs: [`evidence:lease-observed:9${suffix}`],
  };
  const leaseTransition: TemporalLeaseObservedTransitionReceipt = {
    ...transitionBase,
    transitionFingerprint:
      temporalLeaseObservedTransitionFingerprint(transitionBase),
  };

  const checkpointBase: Omit<
    TemporalResumedWorkflowCheckpoint,
    'resumedCheckpointFingerprint'
  > = {
    schemaVersion: TEMPORAL_RESUMED_CHECKPOINT_SCHEMA_VERSION,
    resumedCheckpointRef: `temporal-workflow-resumed:workflow-instance:8:9${suffix}`,
    previousCheckpointRef: `checkpoint:suspended:8${suffix}`,
    previousCheckpointFingerprint: `checkpoint-fingerprint:8${suffix}`,
    workflowRef: observation.workflowRef,
    workflowInstanceRef: observation.workflowInstanceRef,
    sourceHash: observation.sourceHash,
    runRef: observation.runRef,
    timelineRef: observation.timelineRef,
    previousFrameRef: observation.previousFrameRef,
    frameRef: observation.frameRef,
    stateRevision: observation.stateRevision,
    checkpointSequence: 9,
    status: 'active',
    awaitingFrameBindingRef: `binding:next-frame${suffix}`,
    boundRawInputRef: observation.rawInputRef,
    consumedObservationRefs: [observation.observationReceiptRef],
    pendingActionLineageCleared: true,
    observationReceiptRef: observation.observationReceiptRef,
    actionObservedRef: actionObserved.actionObservedRef,
    leaseObservedTransitionRef: leaseTransition.transitionRef,
    evidenceRefs: [`evidence:resumed-checkpoint:9${suffix}`],
  };
  const resumedCheckpoint: TemporalResumedWorkflowCheckpoint = {
    ...checkpointBase,
    resumedCheckpointFingerprint:
      temporalResumedCheckpointFingerprint(checkpointBase),
  };

  const receiptBase: Omit<
    TemporalCausalResumeReceipt,
    'receiptFingerprint'
  > = {
    schemaVersion: TEMPORAL_CAUSAL_RESUME_RECEIPT_SCHEMA_VERSION,
    resumeRef: `temporal-causal-resume:checkpoint:suspended:8:dispatch:8${suffix}`,
    dispatchRef: observation.dispatchRef,
    dispatchFingerprint: observation.dispatchFingerprint,
    checkpointRef: resumedCheckpoint.previousCheckpointRef,
    checkpointFingerprint: resumedCheckpoint.previousCheckpointFingerprint,
    observation,
    actionObserved,
    leaseTransition,
    resumedCheckpoint,
    evidenceRefs: [`evidence:causal-resume:9${suffix}`],
    observationConsumed: true,
    checkpointResumed: true,
    causalResumeAuthorized: true,
    workflowResumed: true,
  };
  return {
    ...receiptBase,
    receiptFingerprint: temporalCausalResumeReceiptFingerprint(receiptBase),
  };
}

function causalJournal(
  receipt: TemporalCausalResumeReceipt,
): TemporalCausalResumeJournal {
  return {
    schemaVersion: TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION,
    maxResumes: 128,
    receipts: [receipt],
  };
}

function alternatives(suffix = ''): TemporalSelectionAlternative[] {
  return [
    {
      ref: `candidate:post:a${suffix}`,
      facts: { route: 'left', phase: 9 },
      evidenceRefs: [`evidence:post:a:9${suffix}`],
    },
    {
      ref: `candidate:post:b${suffix}`,
      facts: { route: 'right', phase: 9 },
      evidenceRefs: [`evidence:post:b:9${suffix}`],
    },
  ];
}

function domain(
  receipt: TemporalCausalResumeReceipt,
  suffix = '',
): TemporalPostActionDomainReceipt {
  return createTemporalPostActionDomainReceipt({
    resumeReceipt: receipt,
    sourceAuthority,
    producerRef: `domain-producer:post-action${suffix}`,
    alternatives: alternatives(suffix),
    requirementRefs: [`requirement:current-post-action-evidence${suffix}`],
    evidenceRefs: [`evidence:domain-producer:9${suffix}`],
  });
}

function continuationAuthority(
  receipt: TemporalCausalResumeReceipt,
  currentDomain: TemporalPostActionDomainReceipt,
): TemporalResumeContinuationCurrentAuthority {
  const authority: TemporalResumeContinuationCurrentAuthority = {
    continuationRequestRef: `continuation-request:9:${receipt.resumeRef}`,
    currentResumeFingerprint: receipt.receiptFingerprint,
    currentResumedCheckpointFingerprint:
      receipt.resumedCheckpoint.resumedCheckpointFingerprint,
    currentDomainFingerprint: currentDomain.domainFingerprint,
    currentWorkflowRef: receipt.observation.workflowRef,
    currentWorkflowInstanceRef: receipt.observation.workflowInstanceRef,
    currentSourceHash: receipt.observation.sourceHash,
    currentRunRef: receipt.observation.runRef,
    currentTimelineRef: receipt.observation.timelineRef,
    currentFrameRef: receipt.observation.frameRef,
    currentStateRevision: receipt.observation.stateRevision,
    causalReceiptCurrent: true,
    checkpointCurrent: true,
    sourceCurrent: true,
    domainProducerCurrent: true,
    evidenceRefs: [],
  };
  authority.evidenceRefs = [
    authority.continuationRequestRef,
    authority.currentResumeFingerprint,
    authority.currentResumedCheckpointFingerprint,
    authority.currentDomainFingerprint,
  ];
  return authority;
}

function continuationReceipt(suffix = ''): TemporalResumeContinuationReceipt {
  const causal = causalReceipt(suffix);
  const currentDomain = domain(causal, suffix);
  return prepareTemporalResumeContinuation({
    journal: createTemporalResumeContinuationJournal(),
    causalResumeJournal: causalJournal(causal),
    resumeRef: causal.resumeRef,
    domain: currentDomain,
    sourceAuthority,
    currentAuthority: continuationAuthority(causal, currentDomain),
  }).receipt;
}

function envelope(suffix = ''): TemporalSchedulerContinuationEnvelope {
  return bindTemporalSchedulerContinuationEnvelope(
    continuationReceipt(suffix),
    `continue qualified post-action state${suffix}`,
  );
}

function currentAuthority(
  currentEnvelope: TemporalSchedulerContinuationEnvelope,
  overrides: Partial<TemporalSchedulerContinuationCurrentAuthority> = {},
): TemporalSchedulerContinuationCurrentAuthority {
  const receipt = currentEnvelope.continuationReceipt;
  const base: TemporalSchedulerContinuationCurrentAuthority = {
    handoffRequestRef: `scheduler-handoff-request:${receipt.continuationRef}`,
    currentContinuationFingerprint: currentEnvelope.continuationFingerprint,
    currentResumedCheckpointFingerprint:
      currentEnvelope.resumedCheckpointFingerprint,
    currentPostActionStateFingerprint:
      currentEnvelope.postActionStateFingerprint,
    currentWorkflowRef: receipt.domain.workflowRef,
    currentWorkflowInstanceRef: receipt.domain.workflowInstanceRef,
    currentSourceHash: receipt.domain.sourceHash,
    currentRunRef: receipt.domain.runRef,
    currentTimelineRef: receipt.domain.timelineRef,
    currentFrameRef: receipt.domain.frameRef,
    currentStateRevision: receipt.domain.stateRevision,
    continuationCurrent: true,
    checkpointCurrent: true,
    stateCurrent: true,
    sourceCurrent: true,
    evidenceRefs: [],
  };
  const merged = { ...base, ...overrides };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : [
      merged.handoffRequestRef,
      merged.currentContinuationFingerprint,
      merged.currentResumedCheckpointFingerprint,
      merged.currentPostActionStateFingerprint,
    ];
  return merged;
}

class RecordingSchedulerPort implements SchedulerContinuationPort {
  readonly portRef: string;
  readonly status: 'accepted' | 'refused';
  calls = 0;
  lastInput: TemporalSchedulerContinuationConsumerInput | null = null;
  mutate?: (
    acknowledgement: TemporalSchedulerContinuationAcknowledgement,
  ) => TemporalSchedulerContinuationAcknowledgement;
  throwMessage: string | null = null;

  constructor(
    portRef = 'scheduler-continuation:test',
    status: 'accepted' | 'refused' = 'accepted',
  ) {
    this.portRef = portRef;
    this.status = status;
  }

  accept(
    input: TemporalSchedulerContinuationConsumerInput,
    signal: AbortSignal,
  ): TemporalSchedulerContinuationAcknowledgement {
    this.calls += 1;
    this.lastInput = structuredClone(input);
    if (signal.aborted) throw new Error('scheduler handoff aborted');
    if (this.throwMessage) throw new Error(this.throwMessage);
    const acknowledgement = createTemporalSchedulerContinuationAcknowledgement(
      this.portRef,
      input,
      this.status,
      this.status === 'accepted'
        ? 'qualified scheduler accepted the passive handoff'
        : 'qualified scheduler refused the passive handoff',
      [
        `evidence:${this.portRef}`,
        input.envelopeFingerprint,
        input.handoffRequestRef,
      ],
    );
    return this.mutate ? this.mutate(acknowledgement) : acknowledgement;
  }
}

test('missing scheduler returns continuation_withheld without consuming the receipt', async () => {
  const currentEnvelope = envelope();
  const port = new PassiveTemporalSchedulerContinuationPort();
  port.submit(currentEnvelope);
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(result.status, 'continuation_withheld');
  assert.equal(result.continuationConsumed, false);
  assert.equal(result.schedulerExecutionStarted, false);
  assert.equal(result.workerActionProduced, false);
  assert.equal(result.actAuthorized, false);
  assert.equal(port.snapshot().pendingEnvelopeRefs.length, 1);
  assert.equal(port.snapshot().journal.receipts.length, 0);
});

test('accepted handoff consumes one receipt but starts no scheduler execution', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(result.status, 'continuation_accepted');
  assert.equal(result.continuationConsumed, true);
  assert.equal(result.schedulerExecutionStarted, false);
  assert.equal(result.workerActionProduced, false);
  assert.equal(result.actAuthorized, false);
  assert.equal(scheduler.calls, 1);
  assert.deepEqual(
    scheduler.lastInput?.resumedCheckpoint,
    currentEnvelope.resumedCheckpoint,
  );
  assert.deepEqual(
    scheduler.lastInput?.postActionState,
    currentEnvelope.postActionState,
  );
  assert.equal(port.snapshot().pendingEnvelopeRefs.length, 0);
  assert.equal(port.snapshot().journal.receipts.length, 1);
});

test('exact replay reuses the handoff receipt without invoking the scheduler twice', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const authority = currentAuthority(currentEnvelope);
  const first = await port.continue(
    currentEnvelope.continuationRef,
    authority,
    new AbortController().signal,
  );
  const second = await port.continue(
    currentEnvelope.continuationRef,
    { ...authority, continuationCurrent: false },
    new AbortController().signal,
  );
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(second.status, 'continuation_accepted');
  assert.equal(scheduler.calls, 1);
  assert.equal(
    second.receipt?.receiptFingerprint,
    first.receipt?.receiptFingerprint,
  );
});

test('a scheduler refusal is terminal and cannot fall through to another handoff', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort('scheduler:refuse', 'refused');
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const first = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  const second = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(first.status, 'continuation_refused');
  assert.equal(first.continuationConsumed, true);
  assert.equal(second.reused, true);
  assert.equal(scheduler.calls, 1);
});

test('current continuation, checkpoint, state and Source gates block before consumer invocation', async () => {
  const cases: Array<Partial<TemporalSchedulerContinuationCurrentAuthority>> = [
    { continuationCurrent: false },
    { checkpointCurrent: false },
    { stateCurrent: false },
    { sourceCurrent: false },
    { currentWorkflowRef: 'other-workflow' },
    { currentRunRef: 'other-run' },
    { currentTimelineRef: 'other-timeline' },
    { currentFrameRef: 'other-frame' },
    { currentStateRevision: 10 },
  ];
  for (const overrides of cases) {
    const currentEnvelope = envelope(`:${Object.keys(overrides)[0]}`);
    const scheduler = new RecordingSchedulerPort();
    const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
    port.submit(currentEnvelope);
    const result = await port.continue(
      currentEnvelope.continuationRef,
      currentAuthority(currentEnvelope, overrides),
      new AbortController().signal,
    );
    assert.equal(result.status, 'blocked');
    assert.equal(result.continuationConsumed, false);
    assert.equal(scheduler.calls, 0);
  }
});

test('an aborted handoff does not invoke or consume the scheduler continuation', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const controller = new AbortController();
  controller.abort();
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    controller.signal,
  );
  assert.equal(result.status, 'aborted');
  assert.equal(result.continuationConsumed, false);
  assert.equal(scheduler.calls, 0);
  assert.equal(port.snapshot().pendingEnvelopeRefs.length, 1);
});

test('tampered continuation envelope is rejected at submit', () => {
  const currentEnvelope = envelope();
  const tampered = {
    ...currentEnvelope,
    postActionStateFingerprint: 'fnv1a32:tampered',
  };
  const port = new PassiveTemporalSchedulerContinuationPort();
  assert.throws(
    () => port.submit(tampered),
    /envelope is invalid/,
  );
});

test('malformed scheduler acknowledgement blocks and leaves the envelope pending', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  scheduler.mutate = acknowledgement => ({
    ...acknowledgement,
    schedulerExecutionStarted: true as false,
  });
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(result.status, 'blocked');
  assert.equal(result.continuationConsumed, false);
  assert.equal(port.snapshot().pendingEnvelopeRefs.length, 1);
});

test('consumer exception remains retryable because scheduler execution was never authorized', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  scheduler.throwMessage = 'consumer unavailable';
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const first = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(first.status, 'blocked');
  assert.equal(first.continuationConsumed, false);
  scheduler.throwMessage = null;
  const second = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.equal(second.status, 'continuation_accepted');
  assert.equal(scheduler.calls, 2);
});

test('journal restoration preserves detached data and rejects fingerprint tampering', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  const snapshot = port.snapshot().journal;
  const restored = restoreTemporalSchedulerContinuationJournal(snapshot);
  restored.receipts[0]!.evidenceRefs[0] = 'mutated-locally';
  assert.notEqual(
    snapshot.receipts[0]!.evidenceRefs[0],
    'mutated-locally',
  );

  const receipt = snapshot.receipts[0]!;
  const tampered = {
    ...receipt,
    receiptFingerprint: 'fnv1a32:tampered',
  };
  assert.throws(
    () => restoreTemporalSchedulerContinuationJournal({
      ...snapshot,
      receipts: [tampered],
    }),
    /handoff receipt is invalid/,
  );
});

test('journal restoration rejects duplicate continuation identities', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  const snapshot = port.snapshot().journal;
  assert.throws(
    () => restoreTemporalSchedulerContinuationJournal({
      ...snapshot,
      maxHandoffs: 2,
      receipts: [snapshot.receipts[0]!, snapshot.receipts[0]!],
    }),
    /duplicate identity/,
  );
});

test('bounded handoff journal fails closed instead of dropping consumed continuation history', async () => {
  const firstEnvelope = envelope(':first');
  const secondEnvelope = envelope(':second');
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({
    scheduler,
    journal: createTemporalSchedulerContinuationJournal(1),
  });
  port.submit(firstEnvelope);
  port.submit(secondEnvelope);
  const first = await port.continue(
    firstEnvelope.continuationRef,
    currentAuthority(firstEnvelope),
    new AbortController().signal,
  );
  const second = await port.continue(
    secondEnvelope.continuationRef,
    currentAuthority(secondEnvelope),
    new AbortController().signal,
  );
  assert.equal(first.status, 'continuation_accepted');
  assert.equal(second.status, 'blocked');
  assert.equal(second.continuationConsumed, false);
  assert.equal(port.snapshot().journal.receipts.length, 1);
});

test('consumed continuation cannot be submitted again', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  assert.throws(
    () => port.submit(currentEnvelope),
    /already consumed/,
  );
});

test('missing envelope is explicit and produces no scheduler call', async () => {
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  const fakeEnvelope = envelope();
  const result = await port.continue(
    fakeEnvelope.continuationRef,
    currentAuthority(fakeEnvelope),
    new AbortController().signal,
  );
  assert.equal(result.status, 'missing_envelope');
  assert.equal(result.continuationConsumed, false);
  assert.equal(scheduler.calls, 0);
});

test('handoff receipt retains causal lineage but no selected ref or executable action', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  const receipt = result.receipt!;
  assert.equal(receipt.lineage.dispatchRef, currentEnvelope.lineage.dispatchRef);
  assert.equal(receipt.lineage.actionIntentRef, currentEnvelope.lineage.actionIntentRef);
  assert.equal('selectedRef' in receipt, false);
  assert.equal('candidateAction' in receipt, false);
  assert.equal('action' in receipt, false);
  assert.equal(receipt.schedulerExecutionStarted, false);
  assert.equal(receipt.workerActionProduced, false);
  assert.equal(receipt.actAuthorized, false);
});

test('full and counters trace modes record a separate non-OP continuation capability', async () => {
  const fullTrace = new OperationTraceSink(32, 'full');
  const countersTrace = new OperationTraceSink(32, 'counters');
  const fullEnvelope = envelope(':full');
  const counterEnvelope = envelope(':counters');
  const fullPort = new PassiveTemporalSchedulerContinuationPort({ trace: fullTrace });
  const counterPort = new PassiveTemporalSchedulerContinuationPort({ trace: countersTrace });
  fullPort.submit(fullEnvelope);
  counterPort.submit(counterEnvelope);
  await fullPort.continue(
    fullEnvelope.continuationRef,
    currentAuthority(fullEnvelope),
    new AbortController().signal,
  );
  await counterPort.continue(
    counterEnvelope.continuationRef,
    currentAuthority(counterEnvelope),
    new AbortController().signal,
  );
  const full = fullTrace.snapshot();
  const counters = countersTrace.snapshot();
  assert.equal(full.events.some(event => (
    event.kind === 'capability'
      && event.capability === 'temporal-scheduler-continuation-port'
  )), true);
  assert.equal(counters.events.length, 0);
  assert.equal(
    counters.counters['need:temporal-scheduler-continuation-port'],
    1,
  );
  assert.equal(
    counters.counters['capability:temporal-scheduler-continuation-port:refused'],
    1,
  );
});

test('handoff fingerprint is canonical across evidence ordering', async () => {
  const currentEnvelope = envelope();
  const scheduler = new RecordingSchedulerPort();
  const port = new PassiveTemporalSchedulerContinuationPort({ scheduler });
  port.submit(currentEnvelope);
  const result = await port.continue(
    currentEnvelope.continuationRef,
    currentAuthority(currentEnvelope),
    new AbortController().signal,
  );
  const receipt = result.receipt!;
  const reordered = {
    ...receipt,
    evidenceRefs: [...receipt.evidenceRefs].reverse(),
  };
  const { receiptFingerprint: _ignored, ...base } = reordered;
  assert.equal(
    temporalSchedulerContinuationHandoffFingerprint(base),
    receipt.receiptFingerprint,
  );
});
