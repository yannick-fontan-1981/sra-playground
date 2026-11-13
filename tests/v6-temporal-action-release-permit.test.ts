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
  projectTemporalActionReleasePermit,
  temporalActionReleasePermitFingerprint,
  temporalAvailableActionRef,
  temporalConcentrationLeaseFingerprint,
  validateTemporalActionReleasePermitReceipt,
  type TemporalActionReleasePermitAuthority,
  type TemporalActionReleasePermitReceipt,
  type TemporalConcentrationLeaseAuthority,
} from '../src/runtime/v6-temporal-action-release-permit.ts';

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
      episodeId: 'episode:1',
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

function selectionProjection(selectedRef: string | null = 'candidate:a') {
  const current = request();
  const state = createTemporalObservationState(current, authority);
  const receipt = createTemporalSourceDecisionReceipt(
    current,
    authority,
    ['drm:action-choice'],
    selectedRef,
    selectedRef === null ? ['evidence:refusal'] : ['evidence:a'],
  );
  return runTemporalSelectionBridge(state, authority, receipt, {
    reason: 'qualify an ordinary single-action permit without dispatching it',
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

function binding(
  current = selectionProjection(),
  prepared = witness(current),
  publicObservation = observation(),
  spec = candidate(),
): TemporalPreparedActionBindingReceipt {
  return createTemporalPreparedActionBindingReceipt(
    current,
    prepared,
    publicObservation,
    spec,
  );
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

function releaseAudit(
  current = selectionProjection(),
  prepared = witness(current),
  overrides: Partial<TemporalActReleaseGateFacts> = {},
): TemporalActReleaseAuditResult {
  return auditTemporalActRelease(current, prepared, facts(overrides));
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

function permitFixture(options: {
  publicObservation?: AgentObservation;
  authority?: TemporalActionReleasePermitAuthority;
  audit?: TemporalActReleaseAuditResult;
} = {}): {
  current: ReturnType<typeof selectionProjection>;
  prepared: PreparedTemporalActionWitness;
  publicObservation: AgentObservation;
  preparedBinding: TemporalPreparedActionBindingReceipt;
  audit: TemporalActReleaseAuditResult;
  permit: TemporalActionReleasePermitReceipt;
} {
  const current = selectionProjection();
  const prepared = witness(current);
  const publicObservation = options.publicObservation ?? observation();
  const preparedBinding = binding(current, prepared, publicObservation);
  const qualifiedAudit = options.audit ?? releaseAudit(current, prepared);
  const permit = createTemporalActionReleasePermitReceipt(
    current,
    prepared,
    publicObservation,
    preparedBinding,
    qualifiedAudit,
    options.authority ?? permitAuthority(),
  );
  return {
    current,
    prepared,
    publicObservation,
    preparedBinding,
    audit: qualifiedAudit,
    permit,
  };
}

test('validated ordinary permit authorizes ACT but contains no action payload or dispatch authority', () => {
  const fixture = permitFixture();
  const projected = projectTemporalActionReleasePermit(
    fixture.permit,
    fixture.current,
    fixture.prepared,
    fixture.publicObservation,
    fixture.preparedBinding,
    fixture.audit,
  );
  assert.equal(fixture.permit.concentrationLease.state, 'validated');
  assert.equal(projected.actionPermitPresent, true);
  assert.equal(projected.releaseEligible, true);
  assert.equal(projected.actAuthorized, true);
  assert.equal(projected.actionPayloadPresent, false);
  assert.equal(projected.actionReleased, false);
  assert.equal(projected.environmentDispatchAuthorized, false);
  assert.equal('candidateAction' in fixture.permit, false);
});

test('permit seals the exact current public action availability identity', () => {
  const fixture = permitFixture();
  assert.equal(
    fixture.permit.availableActionRef,
    temporalAvailableActionRef(fixture.publicObservation, 2),
  );
  assert.equal(fixture.permit.actionId, 2);
  assert.equal(fixture.permit.concentrationLease.allowedActionRef, fixture.permit.availableActionRef);
});

test('blocked or deferred release audit cannot mint an ACT permit', () => {
  const current = selectionProjection();
  const prepared = witness(current);
  const publicObservation = observation();
  const preparedBinding = binding(current, prepared, publicObservation);
  const qualified = releaseAudit(current, prepared);
  const blocked: TemporalActReleaseAuditResult = {
    ...qualified,
    status: 'blocked',
    reason: 'action_grounding_invalid',
    releaseEligible: false,
  };
  const deferred: TemporalActReleaseAuditResult = {
    ...qualified,
    status: 'deferred',
    reason: 'viability_undetermined',
    releaseEligible: false,
  };
  for (const audit of [blocked, deferred]) {
    assert.throws(
      () => createTemporalActionReleasePermitReceipt(
        current,
        prepared,
        publicObservation,
        preparedBinding,
        audit,
        permitAuthority(),
      ),
      /eligible release audit/,
    );
  }
});

test('release audit and action binding must preserve one exact intent identity', () => {
  const current = selectionProjection();
  const prepared = witness(current);
  const publicObservation = observation();
  const preparedBinding = binding(current, prepared, publicObservation);
  const qualified = releaseAudit(current, prepared);
  assert.throws(
    () => createTemporalActionReleasePermitReceipt(
      current,
      prepared,
      publicObservation,
      preparedBinding,
      { ...qualified, intentRef: 'intent:other' },
      permitAuthority(),
    ),
    /identity mismatch/,
  );
});

test('expected effect must already belong to the frozen prepared intent', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({}, { expectedEffectRef: 'expectation:other' }),
    }),
    /expected effect differs/,
  );
});

test('permit authority refs must be present in the qualified causal evidence', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({ viabilityAssessmentRef: 'viability:unseen' }),
    }),
    /absent from the qualified evidence/,
  );
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({}, { srcDecisionRef: 'src:unseen' }),
    }),
    /absent from the qualified evidence/,
  );
});

test('duplicate authority evidence is rejected before fingerprint canonicalization', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({ evidenceRefs: ['permit:evidence', 'permit:evidence'] }),
    }),
    /identity or evidence domain is invalid/,
  );
});

test('permit is stale when its validity ends before the current observation revision', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({ validThroughObservationRevision: 7 }),
    }),
    /stale at creation/,
  );
});

test('validated concentration lease cannot already be expired', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority({}, { expiresAfterObservationRevision: 7 }),
    }),
    /revision window is invalid/,
  );
});

test('permit cannot outlive its validated concentration lease', () => {
  assert.throws(
    () => permitFixture({
      authority: permitAuthority(
        { validThroughObservationRevision: 9 },
        { expiresAfterObservationRevision: 8 },
      ),
    }),
    /outlives its concentration lease/,
  );
});

test('future validity inside the same lease window remains explicitly bounded', () => {
  const fixture = permitFixture({
    authority: permitAuthority(
      { validThroughObservationRevision: 9 },
      { expiresAfterObservationRevision: 9 },
    ),
  });
  assert.equal(fixture.permit.validThroughObservationRevision, 9);
  assert.equal(fixture.permit.concentrationLease.expiresAfterObservationRevision, 9);
});

test('removing the action from the public observation invalidates the binding before permit creation', () => {
  const fixture = permitFixture();
  const unavailable = observation({ availableActionIds: [6] });
  assert.throws(
    () => validateTemporalActionReleasePermitReceipt(
      fixture.permit,
      fixture.current,
      fixture.prepared,
      unavailable,
      fixture.preparedBinding,
      fixture.audit,
    ),
    /public observation mismatch|currently available|no longer available/,
  );
});

test('changed public session, sequence or image invalidates the permit snapshot', () => {
  const fixture = permitFixture();
  const changedImage = observation();
  changedImage.image.pixels[0] = 1;
  for (const changed of [
    observation({ sessionId: 'session:2' }),
    observation({ sequence: 9 }),
    changedImage,
  ]) {
    assert.throws(
      () => validateTemporalActionReleasePermitReceipt(
        fixture.permit,
        fixture.current,
        fixture.prepared,
        changed,
        fixture.preparedBinding,
        fixture.audit,
      ),
      /public observation mismatch|snapshot mismatch/,
    );
  }
});

test('concentration lease fingerprint rejects semantic tampering', () => {
  const fixture = permitFixture();
  const tampered = structuredClone(fixture.permit);
  tampered.concentrationLease.drmDecisionRef = 'drm:other';
  assert.throws(
    () => validateTemporalActionReleasePermitReceipt(
      tampered,
      fixture.current,
      fixture.prepared,
      fixture.publicObservation,
      fixture.preparedBinding,
      fixture.audit,
    ),
    /fingerprint mismatch/,
  );
});

test('permit fingerprint rejects lineage tampering', () => {
  const fixture = permitFixture();
  const tampered = structuredClone(fixture.permit);
  tampered.commitmentDecisionRef = 'commitment:other';
  assert.throws(
    () => validateTemporalActionReleasePermitReceipt(
      tampered,
      fixture.current,
      fixture.prepared,
      fixture.publicObservation,
      fixture.preparedBinding,
      fixture.audit,
    ),
    /fingerprint mismatch|lost required evidence/,
  );
});

test('lease and permit fingerprints canonicalize evidence-set ordering', () => {
  const fixture = permitFixture();
  const reversed = structuredClone(fixture.permit);
  reversed.evidenceRefs = [...reversed.evidenceRefs].reverse();
  reversed.concentrationLease.evidenceRefs = [
    ...reversed.concentrationLease.evidenceRefs,
  ].reverse();
  reversed.concentrationLease.premiseEvidenceRefs = [
    ...reversed.concentrationLease.premiseEvidenceRefs,
  ].reverse();

  const { permitFingerprint: _firstPermit, ...firstPermit } = fixture.permit;
  const { permitFingerprint: _secondPermit, ...secondPermit } = reversed;
  assert.equal(
    temporalActionReleasePermitFingerprint(firstPermit),
    temporalActionReleasePermitFingerprint(secondPermit),
  );

  const { leaseFingerprint: _firstLease, ...firstLease } = fixture.permit.concentrationLease;
  const { leaseFingerprint: _secondLease, ...secondLease } = reversed.concentrationLease;
  assert.equal(
    temporalConcentrationLeaseFingerprint(firstLease),
    temporalConcentrationLeaseFingerprint(secondLease),
  );
});

test('ordinary permit excludes series and deferred acquisition paths', () => {
  const fixture = permitFixture();
  assert.equal(fixture.permit.declaredSeriesRef, null);
  assert.deepEqual(fixture.permit.declaredSeriesIntentRefs, []);
  assert.deepEqual(fixture.permit.declaredSeriesActionRefs, []);
  assert.equal(fixture.permit.concentrationAcquisitionDeferred, false);
});

test('permit projection is detached and still contains no AgentAction payload', () => {
  const fixture = permitFixture();
  const projected = projectTemporalActionReleasePermit(
    fixture.permit,
    fixture.current,
    fixture.prepared,
    fixture.publicObservation,
    fixture.preparedBinding,
    fixture.audit,
  );
  const original = fixture.permit.evidenceRefs[0];
  (projected.evidenceRefs as string[])[0] = 'changed';
  assert.equal(fixture.permit.evidenceRefs[0], original);
  assert.equal('candidateAction' in projected, false);
  assert.equal('target' in projected, false);
});
