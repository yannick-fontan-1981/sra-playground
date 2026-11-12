import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptedTemporalSelection,
  consumeExternalTemporalSelection,
} from '../src/logos-engine/v6-temporal-selection-adapter.ts';
import {
  attachQualifiedTemporalReturn,
  createTemporalObservationState,
} from '../src/logos-engine/v6-temporal-observation-state.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
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
      levelEpoch: 1,
      observationId: 'obs-5',
      observationRevision: 5,
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
    requestedAtRevision: 4,
    expectedProducerDefinitionRef: 'producer:def',
    expectedProducerSourceHash: 'producer:source',
    scopeRefs: ['timeline:1', 'obs-5'],
  };
  const returned: TemporalContributionReturn = {
    request: req,
    producerDefinitionRef: 'producer:def',
    producerSourceHash: 'producer:source',
    returnedAtRevision: 5,
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
    currentScopeRefs: ['timeline:1', 'obs-5'],
    currentRevision: 5,
    productRevisions: { [productRef]: 5 },
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

test('adapter projects an externally supplied candidate without choosing it or granting ACT', () => {
  const result = consumeExternalTemporalSelection(
    stateWithReturns(),
    authority,
    { selectedRef: 'candidate:b' },
  );
  assert.equal(result.decision.status, 'accepted');
  assert.equal(acceptedTemporalSelection(result)?.selectedRef, 'candidate:b');
  assert.equal(result.actAuthorized, false);
  assert.equal(result.consumedReturn, false);
  assert.deepEqual(result.state.consumedReturnIdentityKeys, []);
});

test('external null selection remains an explicit fail-closed refusal', () => {
  const result = consumeExternalTemporalSelection(
    stateWithReturns(),
    authority,
    { selectedRef: null },
  );
  assert.deepEqual(result.decision, {
    status: 'refused',
    reason: 'unresolved_selection',
    preservedAlternativeRefs: ['candidate:a', 'candidate:b'],
    actAuthorized: false,
  });
});

test('external ref outside the Source domain is refused', () => {
  const result = consumeExternalTemporalSelection(
    stateWithReturns(),
    authority,
    { selectedRef: 'candidate:outside' },
  );
  assert.equal(result.decision.status, 'refused');
  assert.equal(result.decision.reason, 'selected_ref_outside_domain');
});

test('adapter consumes only the exact qualified return linked to selected evidence', () => {
  const state = stateWithReturns();
  const returnB = measured('return:b', 'product:b');
  const result = consumeExternalTemporalSelection(
    state,
    authority,
    { selectedRef: 'candidate:b', consumeReturn: returnB },
  );
  assert.equal(result.decision.status, 'accepted');
  assert.equal(result.consumedReturn, true);
  assert.equal(result.state.consumedReturnIdentityKeys.length, 1);
  assert.equal(state.consumedReturnIdentityKeys.length, 0);
});

test('same exact return boundary is idempotent on repeated consumption', () => {
  const returnB = measured('return:b', 'product:b');
  const first = consumeExternalTemporalSelection(
    stateWithReturns(),
    authority,
    { selectedRef: 'candidate:b', consumeReturn: returnB },
  );
  const second = consumeExternalTemporalSelection(
    first.state,
    authority,
    { selectedRef: 'candidate:b', consumeReturn: returnB },
  );
  assert.equal(first.consumedReturn, true);
  assert.equal(second.consumedReturn, false);
  assert.equal(second.state.consumedReturnIdentityKeys.length, 1);
});

test('adapter refuses consumption of a return not linked to selected evidence', () => {
  const returnA = measured('return:a', 'product:a');
  assert.throws(
    () => consumeExternalTemporalSelection(
      stateWithReturns(),
      authority,
      { selectedRef: 'candidate:b', consumeReturn: returnA },
    ),
    /not linked to the selected alternative/,
  );
});

test('adapter refuses consumption of an unqualified return boundary', () => {
  const unknown = measured('return:b', 'product:unknown');
  assert.throws(
    () => consumeExternalTemporalSelection(
      stateWithReturns(),
      authority,
      { selectedRef: 'candidate:b', consumeReturn: unknown },
    ),
    /unqualified temporal return/,
  );
});

test('refused selection cannot consume a candidate return', () => {
  const returnB = measured('return:b', 'product:b');
  assert.throws(
    () => consumeExternalTemporalSelection(
      stateWithReturns(),
      authority,
      { selectedRef: null, consumeReturn: returnB },
    ),
    /refused temporal selection cannot consume/,
  );
});
