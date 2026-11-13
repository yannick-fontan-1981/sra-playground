import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { runTemporalSelectionBridge } from '../src/logos-engine/v6-temporal-selection-bridge.ts';
import {
  attachQualifiedTemporalReturn,
  createTemporalObservationState,
} from '../src/logos-engine/v6-temporal-observation-state.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
import { createTemporalSourceDecisionReceipt } from '../src/logos-engine/v6-temporal-decision-receipt.ts';
import {
  measureTemporalReturnIdentity,
  type TemporalContributionRequest,
  type TemporalContributionReturn,
} from '../src/logos-engine/v6-temporal-return-contract.ts';

const authority: TemporalSourceAuthority = {
  workflowRef: 'arc3.temporal_selection',
  sourceHash: 'source-hash',
  authorizedWorkflowRefs: ['arc3.temporal_selection'],
  authorizedSourceHash: 'source-hash',
};

function request(): TemporalSelectionRequest {
  return {
    workflowRef: 'arc3.temporal_selection',
    sourceHash: 'source-hash',
    identity: {
      episodeId: 'ep',
      levelEpoch: 2,
      observationId: 'obs-8',
      observationRevision: 8,
    },
    alternatives: [
      { ref: 'candidate:a', facts: { locus: [1, 2] }, evidenceRefs: ['return:a'] },
      { ref: 'candidate:b', facts: { locus: [3, 4] }, evidenceRefs: ['return:b'] },
    ],
    requirementRefs: ['requirement.current_evidence'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

function measured(evidenceRef: string, productRef: string) {
  const req: TemporalContributionRequest = {
    requestRef: `request:${productRef}`,
    recipientWorkflowRef: 'arc3.temporal_selection',
    timelineRef: 'timeline:1',
    requestedAtRevision: 7,
    expectedProducerDefinitionRef: 'producer:def',
    expectedProducerSourceHash: 'producer:source',
    scopeRefs: ['timeline:1', 'obs-8'],
  };
  const returned: TemporalContributionReturn = {
    request: req,
    producerDefinitionRef: 'producer:def',
    producerSourceHash: 'producer:source',
    returnedAtRevision: 8,
    productRefs: [productRef],
    evidenceRefs: [evidenceRef],
    requiresCurrentRevalidation: true,
    returnDigest: `digest:${productRef}`,
  };
  return measureTemporalReturnIdentity({
    request: req,
    returned,
    consumerRef: 'arc3.temporal_selection',
    timelineRef: 'timeline:1',
    currentScopeRefs: ['timeline:1', 'obs-8'],
    currentRevision: 8,
    productRevisions: { [productRef]: 8 },
    productDigests: { [productRef]: `seal:${productRef}` },
    producerMatches: true,
    sourceTerminalMatches: true,
    requestOriginMatches: true,
  });
}

function stateWithReturns() {
  let state = createTemporalObservationState(request(), authority);
  state = attachQualifiedTemporalReturn(state, measured('return:a', 'product:a'));
  state = attachQualifiedTemporalReturn(state, measured('return:b', 'product:b'));
  return state;
}

function receipt(selectedRef: string | null, evidenceRefs: readonly string[]) {
  return createTemporalSourceDecisionReceipt(
    request(), authority, ['drm:temporal'], selectedRef, evidenceRefs,
  );
}

test('bridge traces need, verified projection and no fake OP event', () => {
  const trace = new OperationTraceSink();
  const result = runTemporalSelectionBridge(
    stateWithReturns(),
    authority,
    receipt('candidate:b', ['return:b']),
    { reason: 'choose within the current Source-declared temporal domain', trace },
  );

  assert.equal(result.decision.status, 'accepted');
  assert.equal(result.actAuthorized, false);
  assert.equal(result.consumedReturn, false);

  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.events.map(event => event.kind), [
    'need', 'capability', 'capability_consumption',
  ]);
  assert.equal(snapshot.counters['need:temporal-selection'], 1);
  assert.equal(snapshot.counters['capability:temporal-selection:accepted'], 1);
  assert.equal(snapshot.counters['capability_consumption:temporal-selection:project'], 1);
  assert.equal(snapshot.events.some(event => event.kind === 'operation' || event.kind === 'consumption'), false);
});

test('bridge traces a verified refusal without fallback', () => {
  const trace = new OperationTraceSink();
  const result = runTemporalSelectionBridge(
    stateWithReturns(),
    authority,
    receipt(null, ['return:refusal']),
    { reason: 'Source returned no selected temporal alternative', trace },
  );

  assert.equal(result.decision.status, 'refused');
  assert.equal(result.actAuthorized, false);
  assert.equal(trace.snapshot().counters['capability:temporal-selection:refused'], 1);
  assert.equal(trace.snapshot().counters['capability_consumption:temporal-selection:refuse'], 1);
});

test('bridge traces exact evidence consumption once', () => {
  const trace = new OperationTraceSink();
  const selectedReturn = measured('return:b', 'product:b');
  const selectedReceipt = receipt('candidate:b', ['return:b']);
  const first = runTemporalSelectionBridge(
    stateWithReturns(),
    authority,
    selectedReceipt,
    { reason: 'consume current candidate evidence', trace, consumeReturn: selectedReturn },
  );
  const second = runTemporalSelectionBridge(
    first.state,
    authority,
    selectedReceipt,
    { reason: 'replay same current candidate evidence', trace, consumeReturn: selectedReturn },
  );

  assert.equal(first.consumedReturn, true);
  assert.equal(second.consumedReturn, false);
  const consumptions = trace.snapshot().events.filter(event =>
    event.kind === 'capability_consumption' && event.effectKind === 'consume_evidence'
  );
  assert.deepEqual(consumptions.map(event => event.kind === 'capability_consumption' && event.semanticEffect), [
    true, false,
  ]);
});

test('bridge records a blocked capability before propagating invalid receipt failure', () => {
  const trace = new OperationTraceSink();
  const valid = receipt('candidate:a', ['return:a']);
  const tampered = { ...valid, evidenceRefs: ['tampered'] };

  assert.throws(
    () => runTemporalSelectionBridge(
      stateWithReturns(),
      authority,
      tampered,
      { reason: 'validate external temporal decision', trace },
    ),
    /fingerprint mismatch/,
  );

  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.events.map(event => event.kind), [
    'need', 'capability', 'capability_consumption',
  ]);
  assert.equal(snapshot.counters['capability:temporal-selection:blocked'], 1);
  assert.equal(snapshot.counters['capability_consumption:temporal-selection:refuse'], 1);
});

test('bridge blocks an evidence return not linked to selected candidate', () => {
  const trace = new OperationTraceSink();
  assert.throws(
    () => runTemporalSelectionBridge(
      stateWithReturns(),
      authority,
      receipt('candidate:b', ['return:b']),
      {
        reason: 'attempt mismatched evidence consumption',
        trace,
        consumeReturn: measured('return:a', 'product:a'),
      },
    ),
    /not linked to the selected alternative/,
  );
  assert.equal(trace.snapshot().counters['capability:temporal-selection:blocked'], 1);
});

test('bridge need identity is stable for the same observation and decision receipt', () => {
  const selectedReceipt = receipt('candidate:a', ['return:a']);
  const first = runTemporalSelectionBridge(
    stateWithReturns(), authority, selectedReceipt, { reason: 'first pass' },
  );
  const second = runTemporalSelectionBridge(
    stateWithReturns(), authority, selectedReceipt, { reason: 'second pass' },
  );
  assert.equal(first.needId, second.needId);
  assert.equal(first.decisionRef, selectedReceipt.decisionFingerprint);
});
