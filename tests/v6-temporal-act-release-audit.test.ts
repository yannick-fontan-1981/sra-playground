import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditTemporalActRelease,
  type PreparedTemporalActionWitness,
  type TemporalActReleaseGateFacts,
} from '../src/runtime/v6-temporal-act-release-audit.ts';
import { createTemporalSourceDecisionReceipt } from '../src/logos-engine/v6-temporal-decision-receipt.ts';
import { createTemporalObservationState } from '../src/logos-engine/v6-temporal-observation-state.ts';
import { runTemporalSelectionBridge } from '../src/logos-engine/v6-temporal-selection-bridge.ts';
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
    identity: {
      episodeId: 'ep',
      levelEpoch: 2,
      observationId: 'obs-8',
      observationRevision: 8,
    },
    alternatives: [
      { ref: 'candidate:a', facts: { route: 'left' }, evidenceRefs: ['evidence:a'] },
      { ref: 'candidate:b', facts: { route: 'right' }, evidenceRefs: ['evidence:b'] },
    ],
    requirementRefs: ['requirement.current_action_is_available'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

function projection(selectedRef: string | null = 'candidate:a') {
  const current = request();
  const state = createTemporalObservationState(current, authority);
  const receipt = createTemporalSourceDecisionReceipt(
    current,
    authority,
    ['drm:action-choice'],
    selectedRef,
    selectedRef === null ? ['evidence:refusal'] : [`evidence:${selectedRef.endsWith('a') ? 'a' : 'b'}`],
  );
  return runTemporalSelectionBridge(state, authority, receipt, {
    reason: 'audit an externally prepared intent without releasing an action',
  });
}

function witness(overrides: Partial<PreparedTemporalActionWitness> = {}): PreparedTemporalActionWitness {
  const current = projection();
  return {
    intentRef: 'intent:probe-8',
    selectedRef: 'candidate:a',
    decisionFingerprint: current.decisionRef,
    identity: structuredClone(current.state.identity),
    currentFrameRef: 'obs-8',
    actionWitnessRef: 'witness:action-8',
    actionFamilyRef: 'action-family:point',
    expectationRefs: ['expectation:visible-delta'],
    groundingEvidenceRefs: ['evidence:a', 'grounding:current'],
    ...overrides,
  };
}

function facts(overrides: Partial<TemporalActReleaseGateFacts> = {}): TemporalActReleaseGateFacts {
  return {
    groundingValid: true,
    commitmentDecision: 'commit',
    viabilityStatus: 'conditional',
    experimentCommitmentCurrent: true,
    controlEvidenceCurrent: true,
    memoryReuseValid: true,
    parentContinuityAllowsCandidate: true,
    parentInfluenceAllowsCandidate: true,
    fatalReplayDisposition: 'no_observed_fatal_replay',
    endpointDisposition: 'clear',
    currentActionAvailable: true,
    evidenceRefs: ['release:commitment', 'release:safety'],
    ...overrides,
  };
}

test('all donor release gates make the prepared intent eligible but still release no action', () => {
  const current = projection();
  const audited = auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef }), facts());
  assert.equal(audited.status, 'eligible');
  assert.equal(audited.reason, 'all_release_gates_satisfied');
  assert.equal(audited.releaseEligible, true);
  assert.equal(audited.actionPayloadPresent, false);
  assert.equal(audited.actionReleased, false);
  assert.equal(audited.actAuthorized, false);
});

test('a refused selection cannot enter the action-release gates', () => {
  const current = projection(null);
  const audited = auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef }), facts());
  assert.equal(audited.status, 'blocked');
  assert.equal(audited.reason, 'selection_not_accepted');
});

test('prepared intent must preserve the selected candidate and decision fingerprint', () => {
  const current = projection();
  assert.equal(
    auditTemporalActRelease(current, witness({ selectedRef: 'candidate:b', decisionFingerprint: current.decisionRef }), facts()).reason,
    'selection_binding_mismatch',
  );
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: 'decision:stale' }), facts()).reason,
    'decision_fingerprint_mismatch',
  );
});

test('prepared intent must belong to the exact observation and current frame', () => {
  const current = projection();
  const changedIdentity = { ...current.state.identity, observationRevision: 9 };
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef, identity: changedIdentity }), facts()).reason,
    'observation_binding_mismatch',
  );
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef, currentFrameRef: 'obs-7' }), facts()).reason,
    'current_frame_mismatch',
  );
});

test('intent, expectation and grounding evidence domains must remain explicit and bounded', () => {
  const current = projection();
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef, intentRef: '' }), facts()).reason,
    'intent_identity_invalid',
  );
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef, expectationRefs: [] }), facts()).reason,
    'expectation_domain_invalid',
  );
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef, groundingEvidenceRefs: ['evidence:a', 'evidence:a'] }), facts()).reason,
    'grounding_evidence_domain_invalid',
  );
});

test('release evidence must be explicit and selected evidence must survive grounding', () => {
  const current = projection();
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef }), facts({ evidenceRefs: [] })).reason,
    'release_evidence_domain_invalid',
  );
  assert.equal(
    auditTemporalActRelease(
      current,
      witness({ decisionFingerprint: current.decisionRef, groundingEvidenceRefs: ['grounding:current'] }),
      facts(),
    ).reason,
    'selected_evidence_not_grounded',
  );
});

test('current action availability and grounding are distinct blocking gates', () => {
  const current = projection();
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef }), facts({ currentActionAvailable: false })).reason,
    'current_action_unavailable',
  );
  assert.equal(
    auditTemporalActRelease(current, witness({ decisionFingerprint: current.decisionRef }), facts({ groundingValid: false })).reason,
    'action_grounding_invalid',
  );
});

test('commitment revise and reject block while defer remains explicitly deferred', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(auditTemporalActRelease(current, prepared, facts({ commitmentDecision: 'revise' })).reason, 'commitment_revision_required');
  assert.equal(auditTemporalActRelease(current, prepared, facts({ commitmentDecision: 'reject' })).reason, 'commitment_rejected');
  const deferred = auditTemporalActRelease(current, prepared, facts({ commitmentDecision: 'defer' }));
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.reason, 'commitment_deferred');
});

test('viability blocked stops and undetermined defers while conditional is admitted', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(auditTemporalActRelease(current, prepared, facts({ viabilityStatus: 'blocked' })).reason, 'viability_blocked');
  const deferred = auditTemporalActRelease(current, prepared, facts({ viabilityStatus: 'undetermined' }));
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.reason, 'viability_undetermined');
  assert.equal(auditTemporalActRelease(current, prepared, facts({ viabilityStatus: 'conditional' })).status, 'eligible');
});

test('current experiment commitment, control evidence and memory reuse are independent gates', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(auditTemporalActRelease(current, prepared, facts({ experimentCommitmentCurrent: false })).reason, 'experiment_commitment_not_current');
  assert.equal(auditTemporalActRelease(current, prepared, facts({ controlEvidenceCurrent: false })).reason, 'control_evidence_not_current');
  assert.equal(auditTemporalActRelease(current, prepared, facts({ memoryReuseValid: false })).reason, 'memory_reuse_not_validated');
});

test('parent continuity and parent causal influence are separate release gates', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(auditTemporalActRelease(current, prepared, facts({ parentContinuityAllowsCandidate: false })).reason, 'parent_continuity_not_revalidated');
  assert.equal(auditTemporalActRelease(current, prepared, facts({ parentInfluenceAllowsCandidate: false })).reason, 'parent_influence_not_revalidated');
});

test('fatal replay rejection blocks and unresolved safety defers', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(
    auditTemporalActRelease(current, prepared, facts({ fatalReplayDisposition: 'reject_observed_fatal_replay' })).reason,
    'observed_fatal_replay',
  );
  const deferred = auditTemporalActRelease(current, prepared, facts({ fatalReplayDisposition: 'unresolved' }));
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.reason, 'fatal_replay_safety_unresolved');
});

test('endpoint contact blocks and unresolved endpoint safety defers', () => {
  const current = projection();
  const prepared = witness({ decisionFingerprint: current.decisionRef });
  assert.equal(auditTemporalActRelease(current, prepared, facts({ endpointDisposition: 'contact' })).reason, 'hostile_endpoint_contact');
  const deferred = auditTemporalActRelease(current, prepared, facts({ endpointDisposition: 'unresolved' }));
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.reason, 'endpoint_safety_unresolved');
});

test('not-applicable endpoint preservation is eligible like a clear endpoint', () => {
  const current = projection();
  const audited = auditTemporalActRelease(
    current,
    witness({ decisionFingerprint: current.decisionRef }),
    facts({ endpointDisposition: 'not_applicable' }),
  );
  assert.equal(audited.status, 'eligible');
});

test('audit evidence is detached, deduplicated and contains no action payload', () => {
  const current = projection();
  const audited = auditTemporalActRelease(
    current,
    witness({ decisionFingerprint: current.decisionRef }),
    facts(),
  );
  assert.equal(new Set(audited.evidenceRefs).size, audited.evidenceRefs.length);
  assert.equal('action' in audited, false);
  assert.equal(audited.actionPayloadPresent, false);
});
