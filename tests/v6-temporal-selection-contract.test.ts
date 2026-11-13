import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectTemporalSelectionDecision,
  validateTemporalSelectionRequest,
  type TemporalSelectionRequest,
  type TemporalSourceAuthority,
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
    identity: {
      episodeId: 'ep',
      levelEpoch: 1,
      observationId: 'obs-4',
      observationRevision: 4,
    },
    alternatives: [
      { ref: 'candidate:a', facts: { x: 10, y: 11 }, evidenceRefs: ['obs-2'] },
      { ref: 'candidate:b', facts: { x: 20, y: 21 }, evidenceRefs: ['obs-3'] },
    ],
    requirementRefs: ['requirement.current_evidence'],
    preserveRefs: ['candidate:a', 'candidate:b'],
    receiptRef: 'receipt-4',
    receiptPreviouslyConsumed: false,
  };
}

test('TemporalSelection contract requires exact Source authority', () => {
  const bad = { ...request(), sourceHash: 'wrong' };
  assert.deepEqual(validateTemporalSelectionRequest(bad, authority), {
    status: 'refused',
    reason: 'source_authority_mismatch',
    preservedAlternativeRefs: ['candidate:a', 'candidate:b'],
    actAuthorized: false,
  });
});

test('TemporalSelection preserves the complete declared alternative domain', () => {
  const bad = { ...request(), preserveRefs: ['candidate:a'] };
  assert.equal(validateTemporalSelectionRequest(bad, authority)?.reason, 'preserve_domain_mismatch');
});

test('TemporalSelection refuses duplicate candidate identities', () => {
  const base = request();
  const bad = { ...base, alternatives: [base.alternatives[0]!, base.alternatives[0]!] };
  assert.equal(validateTemporalSelectionRequest(bad, authority)?.reason, 'duplicate_alternative_ref');
});

test('TemporalSelection consumes one receipt at most once', () => {
  const bad = { ...request(), receiptPreviouslyConsumed: true };
  assert.equal(validateTemporalSelectionRequest(bad, authority)?.reason, 'receipt_already_consumed');
});

test('TemporalSelection unresolved result fails closed and never authorizes ACT', () => {
  assert.deepEqual(projectTemporalSelectionDecision(request(), authority, null), {
    status: 'refused',
    reason: 'unresolved_selection',
    preservedAlternativeRefs: ['candidate:a', 'candidate:b'],
    actAuthorized: false,
  });
});

test('TemporalSelection cannot select outside the Source-declared domain', () => {
  const result = projectTemporalSelectionDecision(request(), authority, 'candidate:unknown');
  assert.equal(result.status, 'refused');
  assert.equal(result.reason, 'selected_ref_outside_domain');
  assert.equal(result.actAuthorized, false);
});

test('TemporalSelection accepted projection preserves evidence and still grants no ACT', () => {
  const result = projectTemporalSelectionDecision(request(), authority, 'candidate:b');
  assert.deepEqual(result, {
    status: 'accepted',
    selectedRef: 'candidate:b',
    selectedFacts: { x: 20, y: 21 },
    selectedEvidenceRefs: ['obs-3'],
    preservedAlternativeRefs: ['candidate:a', 'candidate:b'],
    actAuthorized: false,
  });
});
