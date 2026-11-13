import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTemporalSourceDecisionReceipt,
  temporalDecisionFingerprint,
  validateTemporalSourceDecisionReceipt,
} from '../src/logos-engine/v6-temporal-decision-receipt.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';

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
    identity: { episodeId: 'ep', levelEpoch: 2, observationId: 'obs-8', observationRevision: 8 },
    alternatives: [
      { ref: 'candidate:b', facts: {}, evidenceRefs: ['ev:b'] },
      { ref: 'candidate:a', facts: {}, evidenceRefs: ['ev:a'] },
    ],
    requirementRefs: ['requirement.current_evidence'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

test('receipt seals Source, DRM, observation, domain and selected ref', () => {
  const receipt = createTemporalSourceDecisionReceipt(
    request(), authority, ['drm:2', 'drm:1'], 'candidate:b', ['ev:b'],
  );
  assert.equal(receipt.selectedRef, 'candidate:b');
  assert.equal(receipt.actAuthorized, false);
  assert.deepEqual(receipt.alternativeRefs, ['candidate:a', 'candidate:b']);
  assert.doesNotThrow(() => validateTemporalSourceDecisionReceipt(receipt, request(), authority));
});

test('fingerprint is deterministic across canonicalized set ordering', () => {
  const first = createTemporalSourceDecisionReceipt(
    request(), authority, ['drm:2', 'drm:1'], 'candidate:a', ['ev:2', 'ev:1'],
  );
  const secondBase = {
    ...first,
    drmSourceHashes: ['drm:1', 'drm:2'],
    evidenceRefs: ['ev:1', 'ev:2'],
  };
  const { decisionFingerprint: _ignored, ...base } = secondBase;
  assert.equal(first.decisionFingerprint, temporalDecisionFingerprint(base));
});

test('receipt rejects Source authority mismatch', () => {
  assert.throws(
    () => createTemporalSourceDecisionReceipt(
      { ...request(), sourceHash: 'other' }, authority, ['drm:1'], 'candidate:a', ['ev:a'],
    ),
    /mismatched Source authority/,
  );
});

test('receipt requires at least one unique DRM source hash', () => {
  assert.throws(
    () => createTemporalSourceDecisionReceipt(request(), authority, [], 'candidate:a', ['ev:a']),
    /requires unique DRM source hashes/,
  );
  assert.throws(
    () => createTemporalSourceDecisionReceipt(request(), authority, ['drm:1', 'drm:1'], 'candidate:a', ['ev:a']),
    /requires unique DRM source hashes/,
  );
});

test('receipt cannot seal a selected ref outside the Source domain', () => {
  assert.throws(
    () => createTemporalSourceDecisionReceipt(request(), authority, ['drm:1'], 'candidate:x', []),
    /outside the Source domain/,
  );
});

test('validation rejects a receipt replayed against another observation', () => {
  const receipt = createTemporalSourceDecisionReceipt(request(), authority, ['drm:1'], 'candidate:a', ['ev:a']);
  const other = request();
  other.identity = { ...other.identity, observationRevision: 9, observationId: 'obs-9' };
  assert.throws(
    () => validateTemporalSourceDecisionReceipt(receipt, other, authority),
    /observation identity mismatch/,
  );
});

test('validation rejects a changed alternative domain', () => {
  const receipt = createTemporalSourceDecisionReceipt(request(), authority, ['drm:1'], 'candidate:a', ['ev:a']);
  const changed = request();
  changed.alternatives = [changed.alternatives[0]!];
  changed.preserveRefs = ['candidate:b'];
  assert.throws(
    () => validateTemporalSourceDecisionReceipt(receipt, changed, authority),
    /alternative domain mismatch/,
  );
});

test('validation detects payload tampering through the fingerprint', () => {
  const receipt = createTemporalSourceDecisionReceipt(request(), authority, ['drm:1'], 'candidate:a', ['ev:a']);
  const tampered = { ...receipt, evidenceRefs: ['ev:tampered'] };
  assert.throws(
    () => validateTemporalSourceDecisionReceipt(tampered, request(), authority),
    /fingerprint mismatch/,
  );
});

test('null selected ref is a valid sealed refusal result and still grants no ACT', () => {
  const receipt = createTemporalSourceDecisionReceipt(request(), authority, ['drm:1'], null, ['ev:refusal']);
  assert.equal(receipt.selectedRef, null);
  assert.equal(receipt.actAuthorized, false);
  assert.doesNotThrow(() => validateTemporalSourceDecisionReceipt(receipt, request(), authority));
});
