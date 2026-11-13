import assert from 'node:assert/strict';
import test from 'node:test';
import { createTemporalSourceDecisionReceipt } from '../src/logos-engine/v6-temporal-decision-receipt.ts';
import { createTemporalObservationState } from '../src/logos-engine/v6-temporal-observation-state.ts';
import { runTemporalSelectionBridge } from '../src/logos-engine/v6-temporal-selection-bridge.ts';
import type {
  TemporalSelectionRequest,
  TemporalSourceAuthority,
} from '../src/logos-engine/v6-temporal-selection-contract.ts';
import type { AgentObservation } from '../src/runtime/contracts.ts';
import {
  auditTemporalActRelease,
  type PreparedTemporalActionWitness,
  type TemporalActReleaseAuditResult,
  type TemporalActReleaseGateFacts,
} from '../src/runtime/v6-temporal-act-release-audit.ts';
import {
  createTemporalPreparedActionBindingReceipt,
  type TemporalPreparedActionBindingReceipt,
  type TemporalPreparedActionCandidateSpec,
} from '../src/runtime/v6-temporal-action-binding.ts';
import {
  createTemporalActionReleasePermitReceipt,
  temporalAvailableActionRef,
  type TemporalActionReleasePermitAuthority,
  type TemporalActionReleasePermitReceipt,
  type TemporalConcentrationLeaseAuthority,
} from '../src/runtime/v6-temporal-action-release-permit.ts';
import {
  consumeTemporalActionReleasePermit,
  createTemporalActConsumptionJournal,
  restoreTemporalActConsumptionJournal,
  temporalActLeaseTransitionFingerprint,
  temporalActTerminalReceiptFingerprint,
  type TemporalActConsumptionJournal,
  type TemporalActCurrentAuthority,
  type TemporalActConsumptionResult,
} from '../src/runtime/v6-temporal-act-consumption.ts';
import { fingerprintAgentObservation } from '../src/runtime/v6-temporal-decision-port.ts';

const sourceAuthority: TemporalSourceAuthority = {
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
      episodeId: 'timeline:episode:1',
      levelEpoch: 2,
      observationId: 'observation:8',
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

function selectionProjection() {
  const current = request();
  const state = createTemporalObservationState(current, sourceAuthority);
  const receipt = createTemporalSourceDecisionReceipt(
    current,
    sourceAuthority,
    ['drm:action-choice'],
    'candidate:a',
    ['evidence:a'],
  );
  return runTemporalSelectionBridge(state, sourceAuthority, receipt, {
    reason: 'consume a qualified ordinary ACT permit without dispatching the environment',
  });
}

function observation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return {
    protocolVersion: 1,
    sessionId: 'session:1',
    sequence: 8,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [2, 6],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
    ...overrides,
  };
}

function witness(
  current = selectionProjection(),
  overrides: Partial<PreparedTemporalActionWitness> = {},
): PreparedTemporalActionWitness {
  return {
    intentRef: 'intent:8',
    selectedRef: 'candidate:a',
    decisionFingerprint: current.decisionRef,
    identity: structuredClone(current.state.identity),
    currentFrameRef: 'observation:8',
    actionWitnessRef: 'action-witness:8',
    actionFamilyRef: 'action-family:move',
    expectationRefs: ['expectation:visible-delta'],
    groundingEvidenceRefs: ['evidence:a', 'grounding:current'],
    ...overrides,
  };
}

function candidate(
  overrides: Partial<TemporalPreparedActionCandidateSpec> = {},
): TemporalPreparedActionCandidateSpec {
  return {
    actionCandidateRef: 'action-candidate:2',
    targetRef: 'target:action-2',
    target: { kind: 'action', actionId: 2 },
    candidateAction: { id: 2 },
    actionEvidenceRefs: ['action:2:available'],
    targetEvidenceRefs: ['target:action-2:current'],
    ...overrides,
  };
}

const releaseEvidenceRefs = [
  'release:current',
  'viability:8',
  'commitment:8',
  'drm:focus:8',
  'src:focus:8',
  'focus:selected',
  'principle:bounded-focus',
  'expectation:visible-delta',
  'premise:current',
  'falsifier:no-delta',
  'permit:evidence',
  'lease:evidence',
] as const;

function facts(
  overrides: Partial<TemporalActReleaseGateFacts> = {},
): TemporalActReleaseGateFacts {
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
    evidenceRefs: [...releaseEvidenceRefs],
    ...overrides,
  };
}

function leaseAuthority(
  overrides: Partial<TemporalConcentrationLeaseAuthority> = {},
): TemporalConcentrationLeaseAuthority {
  return {
    leaseRef: 'lease:8',
    drmDecisionRef: 'drm:focus:8',
    srcDecisionRef: 'src:focus:8',
    acquisitionReasonRef: 'focus:selected',
    genericPrincipleRef: 'principle:bounded-focus',
    expectedEffectRef: 'expectation:visible-delta',
    premiseEvidenceRefs: ['premise:current'],
    falsifierRefs: ['falsifier:no-delta'],
    evidenceRefs: ['lease:evidence'],
    expiresAfterObservationRevision: 8,
    ...overrides,
  };
}

function permitAuthority(
  overrides: Partial<Omit<TemporalActionReleasePermitAuthority, 'concentrationLease'>> = {},
  leaseOverrides: Partial<TemporalConcentrationLeaseAuthority> = {},
): TemporalActionReleasePermitAuthority {
  return {
    permitRef: 'permit:8',
    viabilityAssessmentRef: 'viability:8',
    commitmentDecisionRef: 'commitment:8',
    validThroughObservationRevision: 8,
    evidenceRefs: ['permit:evidence'],
    concentrationLease: leaseAuthority(leaseOverrides),
    ...overrides,
  };
}

interface Fixture {
  current: ReturnType<typeof selectionProjection>;
  prepared: PreparedTemporalActionWitness;
  publicObservation: AgentObservation;
  binding: TemporalPreparedActionBindingReceipt;
  audit: TemporalActReleaseAuditResult;
  permit: TemporalActionReleasePermitReceipt;
}

function fixture(options: {
  publicObservation?: AgentObservation;
  permitAuthority?: TemporalActionReleasePermitAuthority;
} = {}): Fixture {
  const current = selectionProjection();
  const prepared = witness(current);
  const publicObservation = options.publicObservation ?? observation();
  const binding = createTemporalPreparedActionBindingReceipt(
    current,
    prepared,
    publicObservation,
    candidate(),
  );
  const audit = auditTemporalActRelease(current, prepared, facts());
  const permit = createTemporalActionReleasePermitReceipt(
    current,
    prepared,
    publicObservation,
    binding,
    audit,
    options.permitAuthority ?? permitAuthority(),
  );
  return { current, prepared, publicObservation, binding, audit, permit };
}

function currentAuthority(
  currentFixture: Fixture,
  overrides: Partial<TemporalActCurrentAuthority> = {},
): TemporalActCurrentAuthority {
  const permit = currentFixture.permit;
  const publicObservation = currentFixture.publicObservation;
  const base: TemporalActCurrentAuthority = {
    actRequestRef: 'act-request:8',
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    runRef: publicObservation.sessionId,
    timelineRef: permit.temporalIdentity.episodeId,
    frameRef: permit.temporalIdentity.observationId,
    stateRevision: permit.stateRevision,
    temporalIdentity: structuredClone(permit.temporalIdentity),
    currentSnapshotDigest: fingerprintAgentObservation(publicObservation),
    currentAvailableActionRef: temporalAvailableActionRef(publicObservation, permit.actionId),
    canonicalPermitFingerprint: permit.permitFingerprint,
    canonicalLeaseFingerprint: permit.concentrationLease.leaseFingerprint,
    currentLeaseState: 'validated',
    supportsWithdrawnRefs: [],
    sourceCurrent: true,
    responsibilityCurrent: true,
    goalConsumptionEvidenceCurrent: true,
    parentContinuationCurrent: true,
    contributionTransportCurrent: true,
    canonicalExecutionContextCurrent: true,
    reasoningContextRef: 'reasoning-context:8',
    responsibilityRef: 'responsibility:8',
    goalConsumptionEvidenceRef: 'goal-consumption:8',
    parentContinuationRef: 'parent-continuation:8',
    contributionTransportRef: 'contribution-transport:8',
    canonicalExecutionContextRef: 'execution-context:8',
    evidenceRefs: [],
  };
  const merged: TemporalActCurrentAuthority = {
    ...base,
    ...overrides,
    temporalIdentity: structuredClone(overrides.temporalIdentity ?? base.temporalIdentity),
    supportsWithdrawnRefs: [...(overrides.supportsWithdrawnRefs ?? base.supportsWithdrawnRefs)],
    evidenceRefs: [],
  };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : [
      merged.actRequestRef,
      merged.reasoningContextRef,
      merged.responsibilityRef,
      merged.goalConsumptionEvidenceRef,
      merged.parentContinuationRef,
      merged.contributionTransportRef,
      merged.canonicalExecutionContextRef,
      merged.canonicalPermitFingerprint,
      merged.canonicalLeaseFingerprint,
      merged.currentSnapshotDigest,
      merged.currentAvailableActionRef,
      ...merged.supportsWithdrawnRefs,
    ];
  return merged;
}

function consume(
  currentFixture = fixture(),
  options: {
    journal?: TemporalActConsumptionJournal;
    observation?: AgentObservation;
    authority?: TemporalActCurrentAuthority;
  } = {},
): TemporalActConsumptionResult {
  return consumeTemporalActionReleasePermit({
    journal: options.journal ?? createTemporalActConsumptionJournal(),
    projection: currentFixture.current,
    witness: currentFixture.prepared,
    observation: options.observation ?? currentFixture.publicObservation,
    binding: currentFixture.binding,
    audit: currentFixture.audit,
    permit: currentFixture.permit,
    currentAuthority: options.authority ?? currentAuthority(currentFixture),
  });
}

test('ACT consumption moves the validated lease to released and emits only a pending-boundary identity', () => {
  const result = consume();
  assert.equal(result.reused, false);
  assert.equal(result.receipt.status, 'consumed');
  assert.equal(result.receipt.leaseTransition.fromState, 'validated');
  assert.equal(result.receipt.leaseTransition.toState, 'released');
  assert.equal(result.receipt.permitConsumed, true);
  assert.equal(result.receipt.actionReleased, true);
  assert.equal(result.receipt.environmentDispatchAuthorized, false);
  assert.equal(result.receipt.actionPayloadPresent, false);
  assert.equal(result.receipt.actAuthorized, false);
  assert.deepEqual(result.emittedActOutput, {
    outputKind: 'action_dispatch',
    actionRef: 'action-candidate:2',
    actionIntentRef: 'intent:8',
    actionReleasePermitRef: 'permit:8',
    dispatchStatus: 'pending_environment_boundary',
  });
  assert.equal('candidateAction' in result.receipt, false);
  assert.equal('target' in result.receipt, false);
});

test('the ACT output remains separate from AgentAction payload and environment dispatch', () => {
  const result = consume();
  assert.equal(result.receipt.status, 'consumed');
  if (result.receipt.status !== 'consumed') return;
  assert.equal(result.receipt.actOutput.dispatchStatus, 'pending_environment_boundary');
  assert.equal('id' in result.receipt.actOutput, false);
  assert.equal('data' in result.receipt.actOutput, false);
  assert.equal(result.receipt.environmentDispatchAuthorized, false);
});

test('replaying the same permit is idempotent and emits no second ActOutput', () => {
  const currentFixture = fixture();
  const first = consume(currentFixture);
  const second = consume(currentFixture, { journal: first.journal });
  assert.equal(first.journal.terminalReceipts.length, 1);
  assert.equal(second.journal.terminalReceipts.length, 1);
  assert.equal(second.reused, true);
  assert.equal(second.emittedActOutput, null);
  assert.equal(second.receipt.receiptFingerprint, first.receipt.receiptFingerprint);
});

test('the same permit ref cannot acquire a second fingerprint after terminal consumption', () => {
  const firstFixture = fixture();
  const first = consume(firstFixture);
  const conflicting = fixture({
    permitAuthority: permitAuthority(
      { validThroughObservationRevision: 9 },
      { expiresAfterObservationRevision: 9 },
    ),
  });
  assert.equal(conflicting.permit.permitRef, firstFixture.permit.permitRef);
  assert.notEqual(conflicting.permit.permitFingerprint, firstFixture.permit.permitFingerprint);
  assert.throws(
    () => consume(conflicting, { journal: first.journal }),
    /identity conflicts with an existing terminal receipt/,
  );
});

test('source, run, timeline and frame changes revoke the permit before ACT', () => {
  const cases: Array<[Partial<TemporalActCurrentAuthority>, string]> = [
    [{ sourceCurrent: false }, 'source_changed'],
    [{ runRef: 'session:other' }, 'run_changed'],
    [{ timelineRef: 'timeline:other' }, 'timeline_changed'],
    [{ frameRef: 'observation:other' }, 'frame_changed'],
  ];
  for (const [overrides, expected] of cases) {
    const currentFixture = fixture();
    const result = consume(currentFixture, {
      authority: currentAuthority(currentFixture, overrides),
    });
    assert.equal(result.receipt.status, 'revoked');
    assert.equal(result.receipt.reason, expected);
    assert.equal(result.receipt.leaseTransition.toState, 'invalidated');
    assert.equal(result.emittedActOutput, null);
  }
});

test('expired permit and lease receive an expired terminal transition', () => {
  const currentFixture = fixture();
  const expiredPermit = consume(currentFixture, {
    authority: currentAuthority(currentFixture, { stateRevision: 9 }),
  });
  assert.equal(expiredPermit.receipt.status, 'revoked');
  assert.equal(expiredPermit.receipt.reason, 'permit_expired');
  assert.equal(expiredPermit.receipt.leaseTransition.toState, 'expired');

  const expiredLease = consume(currentFixture, {
    authority: currentAuthority(currentFixture, { currentLeaseState: 'expired' }),
  });
  assert.equal(expiredLease.receipt.status, 'revoked');
  assert.equal(expiredLease.receipt.reason, 'lease_expired');
  assert.equal(expiredLease.receipt.leaseTransition.toState, 'expired');
});

test('ordinary ACT requires the exact current revision and temporal identity', () => {
  const currentFixture = fixture({
    permitAuthority: permitAuthority(
      { validThroughObservationRevision: 9 },
      { expiresAfterObservationRevision: 9 },
    ),
  });
  const changedRevision = consume(currentFixture, {
    authority: currentAuthority(currentFixture, { stateRevision: 9 }),
  });
  assert.equal(changedRevision.receipt.status, 'revoked');
  assert.equal(changedRevision.receipt.reason, 'state_revision_changed');

  const changedIdentity = consume(currentFixture, {
    authority: currentAuthority(currentFixture, {
      temporalIdentity: {
        ...currentFixture.permit.temporalIdentity,
        levelEpoch: 3,
      },
    }),
  });
  assert.equal(changedIdentity.receipt.status, 'revoked');
  assert.equal(changedIdentity.receipt.reason, 'temporal_identity_changed');
});

test('observation sequence and snapshot changes revoke before ACT', () => {
  const currentFixture = fixture();
  const changedSequence = observation({ sequence: 9 });
  const sequenceResult = consume(currentFixture, {
    observation: changedSequence,
    authority: currentAuthority(currentFixture, {
      runRef: changedSequence.sessionId,
      currentSnapshotDigest: fingerprintAgentObservation(changedSequence),
      currentAvailableActionRef: temporalAvailableActionRef(changedSequence, 2),
    }),
  });
  assert.equal(sequenceResult.receipt.status, 'revoked');
  assert.equal(sequenceResult.receipt.reason, 'observation_sequence_changed');

  const changedPixels = observation();
  changedPixels.image.pixels[0] = 1;
  const snapshotResult = consume(currentFixture, {
    observation: changedPixels,
    authority: currentAuthority(currentFixture, {
      currentSnapshotDigest: fingerprintAgentObservation(changedPixels),
      currentAvailableActionRef: temporalAvailableActionRef(changedPixels, 2),
    }),
  });
  assert.equal(snapshotResult.receipt.status, 'revoked');
  assert.equal(snapshotResult.receipt.reason, 'observation_snapshot_changed');
});

test('canonical permit and lease fingerprints are independently revalidated', () => {
  const currentFixture = fixture();
  const permitMismatch = consume(currentFixture, {
    authority: currentAuthority(currentFixture, {
      canonicalPermitFingerprint: 'permit:fingerprint:other',
    }),
  });
  assert.equal(permitMismatch.receipt.status, 'revoked');
  assert.equal(permitMismatch.receipt.reason, 'permit_not_canonical');

  const leaseMismatch = consume(currentFixture, {
    authority: currentAuthority(currentFixture, {
      canonicalLeaseFingerprint: 'lease:fingerprint:other',
    }),
  });
  assert.equal(leaseMismatch.receipt.status, 'revoked');
  assert.equal(leaseMismatch.receipt.reason, 'lease_not_canonical');
});

test('a non-validated current lease cannot cross ACT', () => {
  const currentFixture = fixture();
  for (const currentLeaseState of ['released', 'invalidated'] as const) {
    const result = consume(currentFixture, {
      authority: currentAuthority(currentFixture, { currentLeaseState }),
    });
    assert.equal(result.receipt.status, 'revoked');
    assert.equal(result.receipt.reason, 'lease_not_validated');
  }
});

test('current action availability is revalidated independently from the frozen permit', () => {
  const currentFixture = fixture();
  const result = consume(currentFixture, {
    authority: currentAuthority(currentFixture, {
      currentAvailableActionRef: 'available-action:other',
    }),
  });
  assert.equal(result.receipt.status, 'revoked');
  assert.equal(result.receipt.reason, 'action_unavailable');
});

test('withdrawn support persists a revocation and emits no ActOutput', () => {
  const currentFixture = fixture();
  const result = consume(currentFixture, {
    authority: currentAuthority(currentFixture, {
      supportsWithdrawnRefs: ['support:withdrawn'],
    }),
  });
  assert.equal(result.receipt.status, 'revoked');
  assert.equal(result.receipt.reason, 'support_withdrawn');
  assert.equal(result.receipt.leaseTransition.toState, 'invalidated');
  assert.equal(result.emittedActOutput, null);
  assert.equal(result.receipt.actionReleased, false);
  assert.equal(result.receipt.environmentDispatchAuthorized, false);
});

test('responsibility, goal consumption, parent continuation, contribution and execution context are distinct current gates', () => {
  const cases: Array<[Partial<TemporalActCurrentAuthority>, string]> = [
    [{ responsibilityCurrent: false }, 'responsibility_not_current'],
    [{ goalConsumptionEvidenceCurrent: false }, 'goal_consumption_not_current'],
    [{ parentContinuationCurrent: false }, 'parent_continuation_not_current'],
    [{ contributionTransportCurrent: false }, 'contribution_transport_not_current'],
    [{ canonicalExecutionContextCurrent: false }, 'execution_context_not_current'],
  ];
  for (const [overrides, expected] of cases) {
    const currentFixture = fixture();
    const result = consume(currentFixture, {
      authority: currentAuthority(currentFixture, overrides),
    });
    assert.equal(result.receipt.status, 'revoked');
    assert.equal(result.receipt.reason, expected);
  }
});

test('a persisted revocation is terminal even if a later caller presents current facts', () => {
  const currentFixture = fixture();
  const revoked = consume(currentFixture, {
    authority: currentAuthority(currentFixture, { sourceCurrent: false }),
  });
  const retried = consume(currentFixture, {
    journal: revoked.journal,
    authority: currentAuthority(currentFixture),
  });
  assert.equal(retried.reused, true);
  assert.equal(retried.receipt.status, 'revoked');
  assert.equal(retried.receipt.reason, 'source_changed');
  assert.equal(retried.emittedActOutput, null);
  assert.equal(retried.journal.terminalReceipts.length, 1);
});

test('malformed current authority evidence is rejected instead of journaled as semantic revocation', () => {
  const currentFixture = fixture();
  const malformed = currentAuthority(currentFixture, { evidenceRefs: ['act-request:8'] });
  assert.throws(
    () => consume(currentFixture, { authority: malformed }),
    /evidence is incomplete/,
  );
});

test('tampered permit and lease payloads are rejected before revocation logic', () => {
  const permitTampered = fixture();
  permitTampered.permit.commitmentDecisionRef = 'commitment:tampered';
  assert.throws(
    () => consume(permitTampered),
    /permit fingerprint mismatch/,
  );

  const leaseTampered = fixture();
  leaseTampered.permit.concentrationLease.srcDecisionRef = 'src:tampered';
  assert.throws(
    () => consume(leaseTampered),
    /lease fingerprint mismatch/,
  );
});

test('journal restoration preserves one terminal identity and detached data', () => {
  const first = consume();
  const restored = restoreTemporalActConsumptionJournal(first.journal);
  assert.deepEqual(restored, first.journal);
  assert.notEqual(restored, first.journal);
  const original = first.journal.terminalReceipts[0]!.evidenceRefs[0];
  (restored.terminalReceipts[0]!.evidenceRefs as string[])[0] = 'changed';
  assert.equal(first.journal.terminalReceipts[0]!.evidenceRefs[0], original);
});

test('journal restoration rejects duplicate identities and fingerprint tampering', () => {
  const first = consume();
  const duplicate: TemporalActConsumptionJournal = {
    ...first.journal,
    terminalReceipts: [
      first.journal.terminalReceipts[0]!,
      structuredClone(first.journal.terminalReceipts[0]!),
    ],
  };
  assert.throws(
    () => restoreTemporalActConsumptionJournal({ ...duplicate, maxTerminalReceipts: 2 }),
    /duplicate terminal identity/,
  );

  const tampered = structuredClone(first.journal);
  tampered.terminalReceipts[0]!.leaseTransition.reasonRef = 'reason:tampered';
  assert.throws(
    () => restoreTemporalActConsumptionJournal(tampered),
    /transition fingerprint mismatch|terminal receipt fingerprint mismatch/,
  );
});

test('transition and receipt fingerprints are canonical across evidence ordering', () => {
  const first = consume();
  const receipt = structuredClone(first.receipt);
  receipt.evidenceRefs = [...receipt.evidenceRefs].reverse();
  receipt.leaseTransition.evidenceRefs = [
    ...receipt.leaseTransition.evidenceRefs,
  ].reverse();

  const { transitionFingerprint: _firstTransition, ...firstTransition }
    = first.receipt.leaseTransition;
  const { transitionFingerprint: _secondTransition, ...secondTransition }
    = receipt.leaseTransition;
  assert.equal(
    temporalActLeaseTransitionFingerprint(firstTransition),
    temporalActLeaseTransitionFingerprint(secondTransition),
  );

  const { receiptFingerprint: _firstReceipt, ...firstReceipt } = first.receipt;
  const { receiptFingerprint: _secondReceipt, ...secondReceipt } = receipt;
  assert.equal(
    temporalActTerminalReceiptFingerprint(firstReceipt),
    temporalActTerminalReceiptFingerprint(secondReceipt),
  );
});

test('bounded terminal journal fails closed rather than dropping exactly-once history', () => {
  const firstFixture = fixture();
  const first = consume(firstFixture, {
    journal: createTemporalActConsumptionJournal(1),
  });
  const secondFixture = fixture({
    permitAuthority: permitAuthority({ permitRef: 'permit:second' }),
  });
  assert.throws(
    () => consume(secondFixture, { journal: first.journal }),
    /journal capacity reached/,
  );
});
