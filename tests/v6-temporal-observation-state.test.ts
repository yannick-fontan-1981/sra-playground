import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachQualifiedTemporalReturn,
  attachTemporalMemoryReuse,
  createTemporalObservationState,
  markTemporalReturnConsumed,
  restoreTemporalObservationState,
  snapshotTemporalObservationState,
  temporalReturnAlreadyConsumed,
} from '../src/logos-engine/v6-temporal-observation-state.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
import {
  freezeTemporalMemoryReuse,
  type TemporalMemoryIntent,
  type TemporalMemoryProof,
} from '../src/logos-engine/v6-temporal-memory-contract.ts';
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

function selectionRequest(): TemporalSelectionRequest {
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
      { ref: 'candidate:a', facts: { locus: [10, 11] }, evidenceRefs: ['obs-3'] },
      { ref: 'candidate:b', facts: { locus: [20, 21] }, evidenceRefs: ['obs-4'] },
    ],
    requirementRefs: ['requirement.current_evidence'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

const contributionRequest: TemporalContributionRequest = {
  requestRef: 'request:1',
  recipientWorkflowRef: 'arc3.temporal_selection',
  timelineRef: 'timeline:1',
  requestedAtRevision: 4,
  expectedProducerDefinitionRef: 'producer:def',
  expectedProducerSourceHash: 'producer:source',
  scopeRefs: ['timeline:1', 'obs-5'],
};

const contributionReturn: TemporalContributionReturn = {
  request: contributionRequest,
  producerDefinitionRef: 'producer:def',
  producerSourceHash: 'producer:source',
  returnedAtRevision: 5,
  productRefs: ['product:a'],
  evidenceRefs: ['obs-5'],
  requiresCurrentRevalidation: true,
  returnDigest: 'return:digest',
};

function measuredReturn() {
  return measureTemporalReturnIdentity({
    request: contributionRequest,
    returned: contributionReturn,
    consumerRef: 'arc3.temporal_selection',
    timelineRef: 'timeline:1',
    currentScopeRefs: ['timeline:1', 'obs-5'],
    currentRevision: 5,
    productRevisions: { 'product:a': 5 },
    productDigests: { 'product:a': 'digest:a' },
    producerMatches: true,
    sourceTerminalMatches: true,
    requestOriginMatches: true,
  });
}

function memory() {
  const proofs: Record<string, TemporalMemoryProof> = {
    old: {
      ref: 'old', digest: 'old-digest', disposition: 'active', polarity: 'positive',
      epistemicStatus: 'supported', activeContradictions: [], defeatedBy: [],
    },
    current: {
      ref: 'current', digest: 'current-digest', disposition: 'active', polarity: 'positive',
      epistemicStatus: 'established', activeContradictions: [], defeatedBy: [],
      memoryRevalidationObservationRef: 'obs-5',
    },
  };
  const contract = freezeTemporalMemoryReuse({
    memoryReuseRequired: true,
    memoryReuseContractRef: 'memory:1',
    recalledClaimRefs: ['old'],
    currentSupportClaimRefs: ['current'],
  }, proofs, 'obs-5');
  assert.ok(contract);
  const intent: TemporalMemoryIntent = {
    frameId: 'obs-5',
    memoryReuseRequired: true,
    canonicalPremiseClaimRefs: ['old', 'current'],
    premiseClaimRefs: ['old', 'current'],
    memoryReuseContract: contract,
  };
  return { proofs, intent };
}

test('minimal state is descriptive and starts with no return, memory or ACT authority', () => {
  const state = createTemporalObservationState(selectionRequest(), authority);
  assert.equal(state.actAuthorized, false);
  assert.deepEqual(state.qualifiedReturns, []);
  assert.equal(state.memoryReuseContract, null);
  assert.deepEqual(state.consumedReturnIdentityKeys, []);
});

test('state rejects an invalid Source selection envelope', () => {
  const bad = { ...selectionRequest(), sourceHash: 'wrong' };
  assert.throws(() => createTemporalObservationState(bad, authority), /invalid temporal selection envelope/);
});

test('only a fully qualified current-workflow return may be attached', () => {
  const state = createTemporalObservationState(selectionRequest(), authority);
  const measured = measuredReturn();
  const updated = attachQualifiedTemporalReturn(state, measured);
  assert.equal(updated.qualifiedReturns.length, 1);
  assert.equal(state.qualifiedReturns.length, 0);

  const wrongRevision = { ...measured, comparisonRevision: 6 };
  assert.throws(() => attachQualifiedTemporalReturn(state, wrongRevision), /different observation revision/);
});

test('same measured boundary is idempotent and not duplicated', () => {
  const initial = createTemporalObservationState(selectionRequest(), authority);
  const once = attachQualifiedTemporalReturn(initial, measuredReturn());
  const twice = attachQualifiedTemporalReturn(once, measuredReturn());
  assert.equal(twice.qualifiedReturns.length, 1);
});

test('memory reuse must be revalidated against this exact observation', () => {
  const state = createTemporalObservationState(selectionRequest(), authority);
  const { proofs, intent } = memory();
  const updated = attachTemporalMemoryReuse(state, intent, proofs);
  assert.deepEqual(updated.memoryProofRefs, ['current', 'old']);
  assert.equal(updated.memoryReuseContract?.observationRef, 'obs-5');

  const wrong = { ...intent, frameId: 'obs-4' };
  assert.throws(() => attachTemporalMemoryReuse(state, wrong, proofs), /different observation/);
});

test('a return can be marked consumed only after qualification and only once', () => {
  const initial = createTemporalObservationState(selectionRequest(), authority);
  const measured = measuredReturn();
  assert.throws(() => markTemporalReturnConsumed(initial, measured), /unqualified/);

  const attached = attachQualifiedTemporalReturn(initial, measured);
  const consumed = markTemporalReturnConsumed(attached, measured);
  assert.equal(temporalReturnAlreadyConsumed(consumed, measured), true);
  const again = markTemporalReturnConsumed(consumed, measured);
  assert.equal(again.consumedReturnIdentityKeys.length, 1);
});

test('snapshot is detached and restoration preserves the descriptive state', () => {
  const initial = createTemporalObservationState(selectionRequest(), authority);
  const attached = attachQualifiedTemporalReturn(initial, measuredReturn());
  const { proofs, intent } = memory();
  const withMemory = attachTemporalMemoryReuse(attached, intent, proofs);
  const consumed = markTemporalReturnConsumed(withMemory, measuredReturn());

  const snap = snapshotTemporalObservationState(consumed);
  (snap.alternatives[0]!.facts as { locus: number[] }).locus[0] = 999;
  assert.deepEqual(consumed.alternatives[0]!.facts, { locus: [10, 11] });

  const cleanSnap = snapshotTemporalObservationState(consumed);
  const restored = restoreTemporalObservationState(cleanSnap, authority);
  assert.deepEqual(restored, consumed);
  assert.equal(restored.actAuthorized, false);
});

test('restoration rejects a consumed identity with no qualified return', () => {
  const state = createTemporalObservationState(selectionRequest(), authority);
  const corrupted = {
    ...state,
    consumedReturnIdentityKeys: ['not-a-real-return'],
  };
  assert.throws(
    () => restoreTemporalObservationState(corrupted, authority),
    /no qualified measured boundary/,
  );
});

test('restoration rejects duplicate measured return boundaries', () => {
  const state = createTemporalObservationState(selectionRequest(), authority);
  const measured = measuredReturn();
  const corrupted = {
    ...state,
    qualifiedReturns: [measured, measured],
  };
  assert.throws(
    () => restoreTemporalObservationState(corrupted, authority),
    /duplicate measured returns/,
  );
});
