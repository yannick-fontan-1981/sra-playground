import assert from 'node:assert/strict';
import test from 'node:test';
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
  restoreTemporalResumeContinuationJournal,
  temporalPostActionDomainFingerprint,
  temporalResumeContinuationReceiptFingerprint,
  TemporalResumeContinuationError,
  TemporalResumeContinuationRefusedError,
  type TemporalPostActionDomainReceipt,
  type TemporalResumeContinuationCurrentAuthority,
  type TemporalResumeContinuationJournal,
} from '../src/runtime/v6-temporal-resume-continuation.ts';

const sourceAuthority: TemporalSourceAuthority = {
  workflowRef: 'arc3.temporal_selection',
  sourceHash: 'source-hash',
  authorizedWorkflowRefs: ['arc3.temporal_selection'],
  authorizedSourceHash: 'source-hash',
};

function causalReceipt(): TemporalCausalResumeReceipt {
  const observationBase: Omit<
    TemporalCausalObservationReceipt,
    'observationFingerprintSeal'
  > = {
    schemaVersion: TEMPORAL_CAUSAL_OBSERVATION_SCHEMA_VERSION,
    observationReceiptRef: 'temporal-observation-acquired:dispatch:8',
    dispatchRef: 'dispatch:8',
    dispatchFingerprint: 'dispatch-fingerprint:8',
    environmentActionEventRef: 'environment-event:8',
    actionIntentRef: 'intent:8',
    actionReleasePermitRef: 'permit:8',
    actReceiptRef: 'act-receipt:8',
    workflowRef: 'arc3.temporal_selection',
    workflowInstanceRef: 'workflow-instance:8',
    sourceHash: 'source-hash',
    runRef: 'session:1',
    timelineRef: 'timeline:episode:1',
    previousFrameRef: 'observation:8',
    frameRef: 'observation:9',
    stateRevision: 9,
    observationIdentity: {
      episodeId: 'timeline:episode:1',
      levelEpoch: 2,
      observationId: 'observation:9',
      observationRevision: 9,
    },
    observationSequence: 9,
    rawInputRef: 'raw-input:9',
    observationFingerprint: 'public-observation-fingerprint:9',
    acquisitionModelRef: 'transport.causal_frame',
    evidenceRefs: ['evidence:dispatch:8'],
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
    actionObservedRef: 'temporal-action-observed:workflow-instance:8:9',
    operationalReturnBindingRef: 'operational-return-binding:9',
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
    evidenceRefs: ['evidence:action-observed:9'],
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
    transitionRef: 'temporal-lease-observed:lease:8:observation:9',
    leaseRef: 'lease:8',
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
    evidenceRefs: ['evidence:lease-observed:9'],
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
    resumedCheckpointRef: 'temporal-workflow-resumed:workflow-instance:8:9',
    previousCheckpointRef: 'checkpoint:suspended:8',
    previousCheckpointFingerprint: 'checkpoint-fingerprint:8',
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
    awaitingFrameBindingRef: 'binding:next-frame',
    boundRawInputRef: observation.rawInputRef,
    consumedObservationRefs: [observation.observationReceiptRef],
    pendingActionLineageCleared: true,
    observationReceiptRef: observation.observationReceiptRef,
    actionObservedRef: actionObserved.actionObservedRef,
    leaseObservedTransitionRef: leaseTransition.transitionRef,
    evidenceRefs: ['evidence:resumed-checkpoint:9'],
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
    resumeRef: 'temporal-causal-resume:checkpoint:suspended:8:dispatch:8',
    dispatchRef: observation.dispatchRef,
    dispatchFingerprint: observation.dispatchFingerprint,
    checkpointRef: resumedCheckpoint.previousCheckpointRef,
    checkpointFingerprint: resumedCheckpoint.previousCheckpointFingerprint,
    observation,
    actionObserved,
    leaseTransition,
    resumedCheckpoint,
    evidenceRefs: ['evidence:causal-resume:9'],
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
  receipt = causalReceipt(),
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
      evidenceRefs: ['evidence:post:a:9'],
    },
    {
      ref: `candidate:post:b${suffix}`,
      facts: { route: 'right', phase: 9 },
      evidenceRefs: ['evidence:post:b:9'],
    },
  ];
}

function domain(
  receipt = causalReceipt(),
  suffix = '',
): TemporalPostActionDomainReceipt {
  return createTemporalPostActionDomainReceipt({
    resumeReceipt: receipt,
    sourceAuthority,
    producerRef: `domain-producer:post-action${suffix}`,
    alternatives: alternatives(suffix),
    requirementRefs: ['requirement:current-post-action-evidence'],
    evidenceRefs: ['evidence:domain-producer:9'],
  });
}

function currentAuthority(
  receipt: TemporalCausalResumeReceipt,
  currentDomain: TemporalPostActionDomainReceipt,
  overrides: Partial<TemporalResumeContinuationCurrentAuthority> = {},
): TemporalResumeContinuationCurrentAuthority {
  const base: TemporalResumeContinuationCurrentAuthority = {
    continuationRequestRef: 'continuation-request:9',
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
  const merged = { ...base, ...overrides };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : [
      merged.continuationRequestRef,
      merged.currentResumeFingerprint,
      merged.currentResumedCheckpointFingerprint,
      merged.currentDomainFingerprint,
    ];
  return merged;
}

function prepare(
  continuationJournal = createTemporalResumeContinuationJournal(),
  receipt = causalReceipt(),
  currentDomain = domain(receipt),
  authority = currentAuthority(receipt, currentDomain),
) {
  return prepareTemporalResumeContinuation({
    journal: continuationJournal,
    causalResumeJournal: causalJournal(receipt),
    resumeRef: receipt.resumeRef,
    domain: currentDomain,
    sourceAuthority,
    currentAuthority: authority,
  });
}

test('causal resume creates one fresh post-action TemporalObservationState without running the scheduler', () => {
  const result = prepare();
  assert.equal(result.reused, false);
  assert.ok(result.emittedPostActionState);
  assert.equal(result.receipt.continuationPrepared, true);
  assert.equal(result.receipt.schedulerExecutionStarted, false);
  assert.equal(result.receipt.workerActionProduced, false);
  assert.equal(result.receipt.actAuthorized, false);
  assert.equal(result.receipt.postActionState.actAuthorized, false);
  assert.equal(result.receipt.postActionState.qualifiedReturns.length, 0);
  assert.equal(result.receipt.postActionState.memoryReuseContract, null);
  assert.deepEqual(
    result.receipt.postActionState.identity,
    result.receipt.causalResume.observation.observationIdentity,
  );
});

test('post-action domain is descriptive and contains no selected candidate', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  assert.equal('selectedRef' in currentDomain, false);
  assert.deepEqual(
    [...currentDomain.preserveRefs].sort(),
    currentDomain.alternatives.map(item => item.ref).sort(),
  );
  const result = prepare(
    createTemporalResumeContinuationJournal(),
    receipt,
    currentDomain,
  );
  assert.equal('selectedRef' in result.receipt.postActionState, false);
});

test('exact continuation replay is idempotent and emits no second state', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const first = prepare(
    createTemporalResumeContinuationJournal(),
    receipt,
    currentDomain,
  );
  const replayAuthority = currentAuthority(receipt, currentDomain, {
    checkpointCurrent: false,
    domainProducerCurrent: false,
  });
  const second = prepare(
    first.journal,
    receipt,
    currentDomain,
    replayAuthority,
  );
  assert.equal(second.reused, true);
  assert.equal(second.emittedPostActionState, null);
  assert.equal(
    second.receipt.receiptFingerprint,
    first.receipt.receiptFingerprint,
  );
  assert.equal(second.journal.receipts.length, 1);
});

test('one causal resume cannot be continued with a different domain identity', () => {
  const receipt = causalReceipt();
  const firstDomain = domain(receipt);
  const first = prepare(
    createTemporalResumeContinuationJournal(),
    receipt,
    firstDomain,
  );
  const changedDomain = domain(receipt, ':changed');
  assert.throws(
    () => prepare(
      first.journal,
      receipt,
      changedDomain,
      currentAuthority(receipt, changedDomain),
    ),
    /another domain identity/,
  );
});

test('domain identity must match the exact acquired causal observation', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const tamperedBase = {
    ...currentDomain,
    frameRef: 'observation:other',
    identity: {
      ...currentDomain.identity,
      observationId: 'observation:other',
    },
  };
  const { domainFingerprint: _ignored, ...base } = tamperedBase;
  const tampered = {
    ...tamperedBase,
    domainFingerprint: temporalPostActionDomainFingerprint(base),
  };
  assert.throws(
    () => prepare(
      createTemporalResumeContinuationJournal(),
      receipt,
      tampered,
      currentAuthority(receipt, tampered),
    ),
    /does not belong to the causal resume/,
  );
});

test('domain fingerprint tampering is rejected before continuation', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const tampered = {
    ...currentDomain,
    domainFingerprint: 'fnv1a32:tampered',
  };
  assert.throws(
    () => prepare(
      createTemporalResumeContinuationJournal(),
      receipt,
      tampered,
      currentAuthority(receipt, tampered),
    ),
    /post-action domain receipt is invalid/,
  );
});

test('Source authority mismatch cannot create a post-action domain', () => {
  const receipt = causalReceipt();
  assert.throws(
    () => createTemporalPostActionDomainReceipt({
      resumeReceipt: receipt,
      sourceAuthority: { ...sourceAuthority, sourceHash: 'wrong-source' },
      producerRef: 'domain-producer:post-action',
      alternatives: alternatives(),
      requirementRefs: ['requirement:current-post-action-evidence'],
      evidenceRefs: ['evidence:domain-producer:9'],
    }),
    /Source-authorized/,
  );
});

test('current Source, checkpoint and domain-producer gates remain independent', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const cases: Array<[
    Partial<TemporalResumeContinuationCurrentAuthority>,
    string,
  ]> = [
    [{ causalReceiptCurrent: false }, 'causal_receipt_not_current'],
    [{ checkpointCurrent: false }, 'checkpoint_not_current'],
    [{ sourceCurrent: false }, 'source_changed'],
    [{ currentFrameRef: 'observation:other' }, 'frame_changed'],
    [{ currentStateRevision: 10 }, 'state_revision_changed'],
    [{ domainProducerCurrent: false }, 'domain_producer_not_current'],
    [{ currentDomainFingerprint: 'domain:other' }, 'domain_changed'],
  ];
  for (const [overrides, reason] of cases) {
    assert.throws(
      () => prepare(
        createTemporalResumeContinuationJournal(),
        receipt,
        currentDomain,
        currentAuthority(receipt, currentDomain, overrides),
      ),
      (error: unknown) => {
        assert.ok(error instanceof TemporalResumeContinuationRefusedError);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  }
});

test('missing causal receipt cannot be converted into a continuation', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  assert.throws(
    () => prepareTemporalResumeContinuation({
      journal: createTemporalResumeContinuationJournal(),
      causalResumeJournal: {
        schemaVersion: TEMPORAL_CAUSAL_RESUME_JOURNAL_SCHEMA_VERSION,
        maxResumes: 128,
        receipts: [],
      },
      resumeRef: receipt.resumeRef,
      domain: currentDomain,
      sourceAuthority,
      currentAuthority: currentAuthority(receipt, currentDomain),
    }),
    /requires a durable causal resume receipt/,
  );
});

test('tampered causal receipt is rejected before domain continuation', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const tampered = {
    ...receipt,
    observation: {
      ...receipt.observation,
      rawInputRef: 'raw-input:tampered',
    },
  };
  assert.throws(
    () => prepareTemporalResumeContinuation({
      journal: createTemporalResumeContinuationJournal(),
      causalResumeJournal: causalJournal(tampered),
      resumeRef: tampered.resumeRef,
      domain: currentDomain,
      sourceAuthority,
      currentAuthority: currentAuthority(receipt, currentDomain),
    }),
    /causal observation receipt is invalid|causal resume receipt is invalid/,
  );
});

test('post-action state is detached and carries no pre-action return or memory proof', () => {
  const result = prepare();
  const emitted = result.emittedPostActionState;
  assert.ok(emitted);
  (emitted.alternatives[0]!.facts as { route: string }).route = 'mutated';
  assert.deepEqual(result.receipt.postActionState.alternatives[0]!.facts, {
    route: 'left',
    phase: 9,
  });
  assert.deepEqual(result.receipt.postActionState.qualifiedReturns, []);
  assert.deepEqual(result.receipt.postActionState.consumedReturnIdentityKeys, []);
  assert.equal(result.receipt.postActionState.memoryReuseContract, null);
  assert.deepEqual(result.receipt.postActionState.memoryProofRefs, []);
});

test('continuation receipt retains causal identities but no executable action payload', () => {
  const result = prepare();
  const serialized = JSON.stringify(result.receipt);
  assert.match(serialized, /environment-event:8/);
  assert.match(serialized, /intent:8/);
  assert.match(serialized, /permit:8/);
  assert.match(serialized, /act-receipt:8/);
  assert.equal('action' in result.receipt, false);
  assert.equal('candidateAction' in result.receipt, false);
  assert.equal(result.receipt.schedulerExecutionStarted, false);
});

test('domain and continuation fingerprints are canonical across set ordering', () => {
  const receipt = causalReceipt();
  const first = createTemporalPostActionDomainReceipt({
    resumeReceipt: receipt,
    sourceAuthority,
    producerRef: 'domain-producer:post-action',
    alternatives: alternatives(),
    requirementRefs: ['requirement:a', 'requirement:b'],
    evidenceRefs: ['evidence:a', 'evidence:b'],
  });
  const second = createTemporalPostActionDomainReceipt({
    resumeReceipt: receipt,
    sourceAuthority,
    producerRef: 'domain-producer:post-action',
    alternatives: [...alternatives()].reverse(),
    requirementRefs: ['requirement:b', 'requirement:a'],
    evidenceRefs: ['evidence:b', 'evidence:a'],
  });
  assert.equal(first.domainFingerprint, second.domainFingerprint);

  const prepared = prepare(
    createTemporalResumeContinuationJournal(),
    receipt,
    first,
    currentAuthority(receipt, first),
  );
  const reordered = {
    ...prepared.receipt,
    evidenceRefs: [...prepared.receipt.evidenceRefs].reverse(),
  };
  const { receiptFingerprint: _ignored, ...base } = reordered;
  assert.equal(
    prepared.receipt.receiptFingerprint,
    temporalResumeContinuationReceiptFingerprint(base),
  );
});

test('continuation journal restoration rejects fingerprint tampering and duplicate causal identities', () => {
  const result = prepare();
  const restored = restoreTemporalResumeContinuationJournal(result.journal);
  assert.deepEqual(restored, result.journal);

  const tampered = {
    ...result.receipt,
    postActionStateFingerprint: 'fnv1a32:tampered',
  };
  assert.throws(
    () => restoreTemporalResumeContinuationJournal({
      ...result.journal,
      receipts: [tampered],
    }),
    TemporalResumeContinuationError,
  );

  assert.throws(
    () => restoreTemporalResumeContinuationJournal({
      ...result.journal,
      receipts: [result.receipt, result.receipt],
    }),
    /duplicate causal identity/,
  );
});

test('bounded continuation journal fails closed instead of dropping causal history', () => {
  const receipt = causalReceipt();
  const currentDomain = domain(receipt);
  const first = prepare(
    createTemporalResumeContinuationJournal(1),
    receipt,
    currentDomain,
  );
  assert.equal(first.journal.receipts.length, 1);

  const clonedReceipt = causalReceipt();
  const nextBase = {
    ...clonedReceipt,
    resumeRef: 'temporal-causal-resume:checkpoint:suspended:10:dispatch:10',
    dispatchRef: 'dispatch:10',
    dispatchFingerprint: 'dispatch-fingerprint:10',
    checkpointRef: 'checkpoint:suspended:10',
    checkpointFingerprint: 'checkpoint-fingerprint:10',
    observation: {
      ...clonedReceipt.observation,
      observationReceiptRef: 'temporal-observation-acquired:dispatch:10',
      dispatchRef: 'dispatch:10',
      dispatchFingerprint: 'dispatch-fingerprint:10',
      environmentActionEventRef: 'environment-event:10',
      previousFrameRef: 'observation:9',
      frameRef: 'observation:10',
      stateRevision: 10,
      observationIdentity: {
        ...clonedReceipt.observation.observationIdentity,
        observationId: 'observation:10',
        observationRevision: 10,
      },
      observationSequence: 10,
      rawInputRef: 'raw-input:10',
    },
  };
  assert.equal(first.journal.maxContinuations, 1);
  assert.throws(
    () => restoreTemporalResumeContinuationJournal({
      ...first.journal,
      maxContinuations: 0,
    }),
    /journal envelope is invalid/,
  );
  assert.ok(nextBase);
});
