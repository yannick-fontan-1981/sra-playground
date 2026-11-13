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
  type TemporalActConsumedReceipt,
  type TemporalActCurrentAuthority,
} from '../src/runtime/v6-temporal-act-consumption.ts';
import {
  TEMPORAL_ACTION_BOUNDARY_CHECKPOINT_SCHEMA_VERSION,
  TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION,
  TemporalActionBoundaryDispatchRefusedError,
  TemporalActionBoundaryError,
  TemporalActionBoundaryUncertainError,
  createTemporalActionBoundaryJournal,
  dispatchTemporalActOutput,
  restoreTemporalActionBoundaryJournal,
  temporalEnvironmentActionResponseDigest,
  type TemporalActionBoundaryCheckpoint,
  type TemporalActionBoundaryCurrentAuthority,
  type TemporalActionBoundaryJournal,
  type TemporalActionBoundaryPersistence,
  type TemporalEnvironmentActionRequest,
  type TemporalEnvironmentActionResponse,
  type TemporalEnvironmentTransport,
} from '../src/runtime/v6-temporal-action-boundary.ts';
import { fingerprintAgentObservation } from '../src/runtime/v6-temporal-decision-port.ts';

const sourceAuthority: TemporalSourceAuthority = {
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
  const request = selectionRequest();
  const state = createTemporalObservationState(request, sourceAuthority);
  const receipt = createTemporalSourceDecisionReceipt(
    request,
    sourceAuthority,
    ['drm:action-choice'],
    'candidate:a',
    ['evidence:a'],
  );
  return runTemporalSelectionBridge(state, sourceAuthority, receipt, {
    reason: 'dispatch one consumed ACT output through the durable environment boundary',
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
  projection = selectionProjection(),
): PreparedTemporalActionWitness {
  return {
    intentRef: 'intent:8',
    selectedRef: 'candidate:a',
    decisionFingerprint: projection.decisionRef,
    identity: structuredClone(projection.state.identity),
    currentFrameRef: 'observation:8',
    actionWitnessRef: 'action-witness:8',
    actionFamilyRef: 'action-family:move',
    expectationRefs: ['expectation:visible-delta'],
    groundingEvidenceRefs: ['evidence:a', 'grounding:current'],
  };
}

function candidate(
  point = false,
): TemporalPreparedActionCandidateSpec {
  return point
    ? {
      actionCandidateRef: 'action-candidate:point',
      targetRef: 'target:point:5:7',
      target: { kind: 'point', x: 5, y: 7 },
      candidateAction: { id: 6, data: { x: 5, y: 7 } },
      actionEvidenceRefs: ['action:6:available'],
      targetEvidenceRefs: ['target:point:5:7:current'],
    }
    : {
      actionCandidateRef: 'action-candidate:2',
      targetRef: 'target:action-2',
      target: { kind: 'action', actionId: 2 },
      candidateAction: { id: 2 },
      actionEvidenceRefs: ['action:2:available'],
      targetEvidenceRefs: ['target:action-2:current'],
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

function releaseFacts(): TemporalActReleaseGateFacts {
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
  };
}

function leaseAuthority(): TemporalConcentrationLeaseAuthority {
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
  };
}

function permitAuthority(): TemporalActionReleasePermitAuthority {
  return {
    permitRef: 'permit:8',
    viabilityAssessmentRef: 'viability:8',
    commitmentDecisionRef: 'commitment:8',
    validThroughObservationRevision: 8,
    evidenceRefs: ['permit:evidence'],
    concentrationLease: leaseAuthority(),
  };
}

interface ConsumedFixture {
  projection: ReturnType<typeof selectionProjection>;
  prepared: PreparedTemporalActionWitness;
  publicObservation: AgentObservation;
  binding: TemporalPreparedActionBindingReceipt;
  audit: TemporalActReleaseAuditResult;
  permit: TemporalActionReleasePermitReceipt;
  actReceipt: TemporalActConsumedReceipt;
}

function actAuthority(
  permit: TemporalActionReleasePermitReceipt,
  publicObservation: AgentObservation,
): TemporalActCurrentAuthority {
  const authority: TemporalActCurrentAuthority = {
    actRequestRef: 'act-request:8',
    workflowRef: permit.workflowRef,
    sourceHash: permit.sourceHash,
    runRef: publicObservation.sessionId,
    timelineRef: permit.temporalIdentity.episodeId,
    frameRef: permit.temporalIdentity.observationId,
    stateRevision: permit.stateRevision,
    temporalIdentity: structuredClone(permit.temporalIdentity),
    currentSnapshotDigest: fingerprintAgentObservation(publicObservation),
    currentAvailableActionRef: temporalAvailableActionRef(
      publicObservation,
      permit.actionId,
    ),
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
  authority.evidenceRefs = [
    authority.actRequestRef,
    authority.reasoningContextRef,
    authority.responsibilityRef,
    authority.goalConsumptionEvidenceRef,
    authority.parentContinuationRef,
    authority.contributionTransportRef,
    authority.canonicalExecutionContextRef,
    authority.canonicalPermitFingerprint,
    authority.canonicalLeaseFingerprint,
    authority.currentSnapshotDigest,
    authority.currentAvailableActionRef,
  ];
  return authority;
}

function consumedFixture(point = false): ConsumedFixture {
  const projection = selectionProjection();
  const prepared = witness(projection);
  const publicObservation = observation();
  const binding = createTemporalPreparedActionBindingReceipt(
    projection,
    prepared,
    publicObservation,
    candidate(point),
  );
  const audit = auditTemporalActRelease(
    projection,
    prepared,
    releaseFacts(),
  );
  const permit = createTemporalActionReleasePermitReceipt(
    projection,
    prepared,
    publicObservation,
    binding,
    audit,
    permitAuthority(),
  );
  const consumed = consumeTemporalActionReleasePermit({
    journal: createTemporalActConsumptionJournal(),
    projection,
    witness: prepared,
    observation: publicObservation,
    binding,
    audit,
    permit,
    currentAuthority: actAuthority(permit, publicObservation),
  });
  assert.equal(consumed.receipt.status, 'consumed');
  if (consumed.receipt.status !== 'consumed') {
    throw new Error('test fixture failed to consume ACT permit');
  }
  return {
    projection,
    prepared,
    publicObservation,
    binding,
    audit,
    permit,
    actReceipt: consumed.receipt,
  };
}

function uniqueRefs(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function checkpoint(
  fixture: ConsumedFixture,
  overrides: Partial<TemporalActionBoundaryCheckpoint> = {},
): TemporalActionBoundaryCheckpoint {
  const base: TemporalActionBoundaryCheckpoint = {
    schemaVersion: TEMPORAL_ACTION_BOUNDARY_CHECKPOINT_SCHEMA_VERSION,
    checkpointRef: 'checkpoint:suspended:8',
    status: 'suspended',
    environmentAdapterRef: 'environment-adapter:public-agent-action:v1',
    workflowRef: fixture.permit.workflowRef,
    workflowInstanceRef: 'workflow-instance:8',
    sourceHash: fixture.permit.sourceHash,
    runRef: fixture.permit.sessionId,
    timelineRef: fixture.permit.temporalIdentity.episodeId,
    frameRef: fixture.permit.temporalIdentity.observationId,
    stateRevision: fixture.permit.stateRevision,
    pendingIntentRef: fixture.permit.intentRef,
    pendingPermitRef: fixture.permit.permitRef,
    pendingActReceiptRef: fixture.actReceipt.receiptRef,
    pendingActReceiptFingerprint: fixture.actReceipt.receiptFingerprint,
    preActionSnapshotDigest: fixture.permit.preActionSnapshotDigest,
    worldContextRef: 'world-context:8',
    worldContextDigest: 'world-context-digest:8',
    responsibilityRef: 'responsibility:8',
    releasedLeaseTransitionRef: fixture.actReceipt.leaseTransition.transitionRef,
    evidenceRefs: [],
  };
  const merged = { ...base, ...overrides };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : uniqueRefs([
      merged.checkpointRef,
      merged.pendingIntentRef,
      merged.pendingPermitRef,
      merged.pendingActReceiptRef,
      merged.pendingActReceiptFingerprint,
      merged.preActionSnapshotDigest,
      merged.worldContextRef,
      merged.worldContextDigest,
      merged.responsibilityRef,
      merged.releasedLeaseTransitionRef,
    ]);
  return merged;
}

function boundaryAuthority(
  fixture: ConsumedFixture,
  currentCheckpoint = checkpoint(fixture),
  overrides: Partial<TemporalActionBoundaryCurrentAuthority> = {},
): TemporalActionBoundaryCurrentAuthority {
  const base: TemporalActionBoundaryCurrentAuthority = {
    boundaryRequestRef: 'boundary-request:8',
    workflowRef: currentCheckpoint.workflowRef,
    workflowInstanceRef: currentCheckpoint.workflowInstanceRef,
    sourceHash: currentCheckpoint.sourceHash,
    runRef: currentCheckpoint.runRef,
    timelineRef: currentCheckpoint.timelineRef,
    frameRef: currentCheckpoint.frameRef,
    stateRevision: currentCheckpoint.stateRevision,
    currentSnapshotDigest: fingerprintAgentObservation(fixture.publicObservation),
    currentAvailableActionRef: temporalAvailableActionRef(
      fixture.publicObservation,
      fixture.permit.actionId,
    ),
    environmentAdapterRef: currentCheckpoint.environmentAdapterRef,
    worldContextRef: currentCheckpoint.worldContextRef,
    worldContextDigest: currentCheckpoint.worldContextDigest,
    canonicalBindingFingerprint: fixture.binding.bindingFingerprint,
    canonicalPermitFingerprint: fixture.permit.permitFingerprint,
    canonicalActReceiptFingerprint: fixture.actReceipt.receiptFingerprint,
    canonicalLeaseTransitionFingerprint:
      fixture.actReceipt.leaseTransition.transitionFingerprint,
    currentLeaseState: 'released',
    checkpointCurrent: true,
    sourceCurrent: true,
    responsibilityCurrent: true,
    intentCurrent: true,
    bindingCurrent: true,
    permitCurrent: true,
    actReceiptCurrent: true,
    releasedLeaseCurrent: true,
    worldContextCurrent: true,
    environmentAdapterCurrent: true,
    evidenceRefs: [],
  };
  const merged = { ...base, ...overrides };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : uniqueRefs([
      merged.boundaryRequestRef,
      merged.currentSnapshotDigest,
      merged.currentAvailableActionRef,
      merged.environmentAdapterRef,
      merged.worldContextRef,
      merged.worldContextDigest,
      merged.canonicalBindingFingerprint,
      merged.canonicalPermitFingerprint,
      merged.canonicalActReceiptFingerprint,
      merged.canonicalLeaseTransitionFingerprint,
    ]);
  return merged;
}

function responseFor(
  request: TemporalEnvironmentActionRequest,
  overrides: Partial<Omit<TemporalEnvironmentActionResponse, 'responseDigest'>> = {},
): TemporalEnvironmentActionResponse {
  const pixels = new Uint8Array(64 * 64);
  pixels[0] = 3;
  const nextObservation = overrides.observation ?? observation({
    sequence: request.observationSequence + 1,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels,
    },
  });
  const base: Omit<TemporalEnvironmentActionResponse, 'responseDigest'> = {
    schemaVersion: TEMPORAL_ENVIRONMENT_ACTION_RESPONSE_SCHEMA_VERSION,
    dispatchRef: request.dispatchRef,
    environmentActionEventRef: `environment-event:${request.dispatchRef}`,
    actionIntentRef: request.actionIntentRef,
    actionReleasePermitRef: request.actionReleasePermitRef,
    actReceiptRef: request.actReceiptRef,
    observationIdentity: {
      episodeId: request.timelineRef,
      levelEpoch: 2,
      observationId: 'observation:9',
      observationRevision: request.stateRevision + 1,
    },
    observation: nextObservation,
    observationFingerprint: fingerprintAgentObservation(nextObservation),
    transportMetadata: { adapter: 'test', deterministic: true },
    ...overrides,
  };
  if (!overrides.observationFingerprint) {
    base.observationFingerprint = fingerprintAgentObservation(base.observation);
  }
  const { observation: _observation, ...digestBase } = base;
  return {
    ...base,
    responseDigest: temporalEnvironmentActionResponseDigest(digestBase),
  };
}

interface MemoryPersistenceState {
  journal: TemporalActionBoundaryJournal;
}

function memoryPersistence(
  state: MemoryPersistenceState,
  events: string[] = [],
): TemporalActionBoundaryPersistence {
  return {
    persistAttempt(journal) {
      events.push('persist-attempt');
      state.journal = structuredClone(journal);
      return structuredClone(state.journal);
    },
    persistDispatch(journal) {
      events.push('persist-dispatch');
      state.journal = structuredClone(journal);
      return structuredClone(state.journal);
    },
  };
}

function dispatchInput(
  fixture: ConsumedFixture,
  journal: TemporalActionBoundaryJournal,
  persistence: TemporalActionBoundaryPersistence,
  transport: TemporalEnvironmentTransport,
  options: {
    checkpoint?: TemporalActionBoundaryCheckpoint;
    authority?: TemporalActionBoundaryCurrentAuthority;
    hooks?: Parameters<typeof dispatchTemporalActOutput>[0]['qualificationHooks'];
  } = {},
): Parameters<typeof dispatchTemporalActOutput>[0] {
  const currentCheckpoint = options.checkpoint ?? checkpoint(fixture);
  return {
    journal,
    checkpoint: currentCheckpoint,
    currentAuthority: options.authority
      ?? boundaryAuthority(fixture, currentCheckpoint),
    observation: fixture.publicObservation,
    binding: fixture.binding,
    permit: fixture.permit,
    actReceipt: fixture.actReceipt,
    persistence,
    transport,
    qualificationHooks: options.hooks,
  };
}

test('ActionBoundary persists the attempt before transport and the dispatch after the response', async () => {
  const fixture = consumedFixture();
  const events: string[] = [];
  const state = { journal: createTemporalActionBoundaryJournal() };
  let transportedAction: unknown;
  const result = await dispatchTemporalActOutput(dispatchInput(
    fixture,
    state.journal,
    memoryPersistence(state, events),
    {
      execute(request) {
        events.push('transport');
        transportedAction = structuredClone(request.action);
        return responseFor(request);
      },
    },
  ));

  assert.deepEqual(events, ['persist-attempt', 'transport', 'persist-dispatch']);
  assert.deepEqual(transportedAction, { id: 2 });
  assert.equal(result.transportCalled, true);
  assert.equal(result.reused, false);
  assert.equal(result.observationAcquired, true);
  assert.equal(result.causalResumeAuthorized, false);
  assert.equal(result.workflowResumed, false);
  assert.equal(result.journal.attempts.length, 1);
  assert.equal(result.journal.dispatches.length, 1);
  assert.equal(result.dispatch.requestDigest, result.request.requestDigest);
  assert.equal(result.dispatch.redeliveryPermitted, false);
  assert.equal('candidateAction' in fixture.actReceipt, false);
  assert.equal('action' in result.dispatch, false);
});

test('a recorded dispatch is reused without a second persistence or transport call', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  let calls = 0;
  const first = await dispatchTemporalActOutput(dispatchInput(
    fixture,
    state.journal,
    memoryPersistence(state),
    {
      execute(request) {
        calls += 1;
        return responseFor(request);
      },
    },
  ));
  const second = await dispatchTemporalActOutput(dispatchInput(
    fixture,
    first.journal,
    {
      persistAttempt() {
        throw new Error('attempt persistence must not run on reuse');
      },
      persistDispatch() {
        throw new Error('dispatch persistence must not run on reuse');
      },
    },
    {
      execute() {
        calls += 1;
        throw new Error('transport must not run on reuse');
      },
    },
  ));

  assert.equal(calls, 1);
  assert.equal(second.reused, true);
  assert.equal(second.transportCalled, false);
  assert.equal(second.dispatch.dispatchFingerprint, first.dispatch.dispatchFingerprint);
  assert.equal(second.response.responseDigest, first.response.responseDigest);
});

test('an attempt without a dispatch is unknown and forbids automatic redelivery', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  let calls = 0;
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          calls += 1;
          throw new Error('transport connection lost');
        },
      },
    )),
    (error: unknown) => {
      assert.ok(error instanceof TemporalActionBoundaryUncertainError);
      assert.equal(error.outcomeStatus, 'unknown');
      assert.equal(error.redeliveryPermitted, false);
      assert.equal(error.reconciliationRequired, true);
      assert.equal(error.journal.attempts.length, 1);
      assert.equal(error.journal.dispatches.length, 0);
      return true;
    },
  );
  assert.equal(calls, 1);

  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          calls += 1;
          throw new Error('redelivery must not occur');
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(calls, 1);
});

test('a crash after transport but before dispatch persistence remains unknown', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  let calls = 0;
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute(request) {
          calls += 1;
          return responseFor(request);
        },
      },
      {
        hooks: {
          afterTransportBeforeDispatchPersistence() {
            throw new Error('simulated crash after external effect');
          },
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(calls, 1);
  assert.equal(state.journal.attempts.length, 1);
  assert.equal(state.journal.dispatches.length, 0);

  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          calls += 1;
          throw new Error('must not redeliver');
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(calls, 1);
});

test('a response that changes dispatch identity becomes unknown after the attempt', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute(request) {
          return responseFor(request, { dispatchRef: 'dispatch:tampered' });
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(state.journal.attempts.length, 1);
  assert.equal(state.journal.dispatches.length, 0);
});

test('dispatch persistence failure after transport is uncertain and retains the durable attempt', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  let calls = 0;
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      {
        persistAttempt(journal) {
          state.journal = structuredClone(journal);
          return structuredClone(journal);
        },
        persistDispatch() {
          throw new Error('durable dispatch store unavailable');
        },
      },
      {
        execute(request) {
          calls += 1;
          return responseFor(request);
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(calls, 1);
  assert.equal(state.journal.attempts.length, 1);
  assert.equal(state.journal.dispatches.length, 0);
});

test('current authority refusal happens before persistence and transport', async () => {
  const fixture = consumedFixture();
  const currentCheckpoint = checkpoint(fixture);
  const state = { journal: createTemporalActionBoundaryJournal() };
  let persisted = false;
  let transported = false;
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      {
        persistAttempt() {
          persisted = true;
          return state.journal;
        },
        persistDispatch() {
          persisted = true;
          return state.journal;
        },
      },
      {
        execute() {
          transported = true;
          throw new Error('must not execute');
        },
      },
      {
        checkpoint: currentCheckpoint,
        authority: boundaryAuthority(fixture, currentCheckpoint, {
          responsibilityCurrent: false,
        }),
      },
    )),
    (error: unknown) => {
      assert.ok(error instanceof TemporalActionBoundaryDispatchRefusedError);
      assert.equal(error.reason, 'responsibility_not_current');
      assert.equal(error.transportAttempted, false);
      return true;
    },
  );
  assert.equal(persisted, false);
  assert.equal(transported, false);
});

test('an attempt cannot be rebound to a changed world-context digest', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          throw new Error('create attempt-only state');
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  const changedCheckpoint = checkpoint(fixture, {
    worldContextDigest: 'world-context-digest:changed',
  });
  const changedAuthority = boundaryAuthority(fixture, changedCheckpoint);
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          throw new Error('must not execute');
        },
      },
      {
        checkpoint: changedCheckpoint,
        authority: changedAuthority,
      },
    )),
    /prior dispatch attempt exists with different request lineage/,
  );
});

test('point-action payload is rehydrated only for the transport request', async () => {
  const fixture = consumedFixture(true);
  const state = { journal: createTemporalActionBoundaryJournal() };
  let transportedAction: unknown;
  const result = await dispatchTemporalActOutput(dispatchInput(
    fixture,
    state.journal,
    memoryPersistence(state),
    {
      execute(request) {
        transportedAction = structuredClone(request.action);
        return responseFor(request);
      },
    },
  ));
  assert.deepEqual(transportedAction, { id: 6, data: { x: 5, y: 7 } });
  assert.equal('action' in result.dispatch, false);
  assert.equal('candidateAction' in fixture.actReceipt, false);
});

test('response digest is canonical across transport metadata key ordering', () => {
  const fixture = consumedFixture();
  const currentCheckpoint = checkpoint(fixture);
  const authority = boundaryAuthority(fixture, currentCheckpoint);
  assert.equal(authority.currentLeaseState, 'released');
  const state = { journal: createTemporalActionBoundaryJournal() };
  const persistence = memoryPersistence(state);
  const transport: TemporalEnvironmentTransport = {
    execute() {
      throw new Error('not used');
    },
  };
  const input = dispatchInput(
    fixture,
    state.journal,
    persistence,
    transport,
    { checkpoint: currentCheckpoint, authority },
  );
  const request = {
    schemaVersion: 'sra.temporal_environment_action_request.v1' as const,
    dispatchRef: 'dispatch:canonical',
    environmentAdapterRef: input.checkpoint.environmentAdapterRef,
    checkpointRef: input.checkpoint.checkpointRef,
    workflowRef: input.checkpoint.workflowRef,
    workflowInstanceRef: input.checkpoint.workflowInstanceRef,
    sourceHash: input.checkpoint.sourceHash,
    runRef: input.checkpoint.runRef,
    timelineRef: input.checkpoint.timelineRef,
    frameRef: input.checkpoint.frameRef,
    stateRevision: input.checkpoint.stateRevision,
    actionIntentRef: input.permit.intentRef,
    actionReleasePermitRef: input.permit.permitRef,
    actReceiptRef: input.actReceipt.receiptRef,
    actionRef: input.permit.actionCandidateRef,
    action: { id: 2 } as const,
    observationSequence: input.permit.observationSequence,
    preActionSnapshotDigest: input.permit.preActionSnapshotDigest,
    worldContextRef: input.checkpoint.worldContextRef,
    worldContextDigest: input.checkpoint.worldContextDigest,
    requestDigest: 'request:canonical',
  };
  const first = responseFor(request, {
    transportMetadata: { adapter: 'test', deterministic: true },
  });
  const second = responseFor(request, {
    transportMetadata: { deterministic: true, adapter: 'test' },
  });
  assert.equal(first.responseDigest, second.responseDigest);
});

test('journal restoration detects attempt fingerprint tampering', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute() {
          throw new Error('leave attempt pending');
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  const tampered = structuredClone(state.journal);
  tampered.attempts[0] = {
    ...tampered.attempts[0],
    worldContextDigest: 'world-context-digest:tampered',
  };
  assert.throws(
    () => restoreTemporalActionBoundaryJournal(tampered),
    /attempt receipt is invalid/,
  );
});

test('journal restoration detects a mutated acquired observation', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  const result = await dispatchTemporalActOutput(dispatchInput(
    fixture,
    state.journal,
    memoryPersistence(state),
    {
      execute(request) {
        return responseFor(request);
      },
    },
  ));
  const tampered = structuredClone(result.journal);
  tampered.dispatches[0].observation.image.pixels[0] = 9;
  assert.throws(
    () => restoreTemporalActionBoundaryJournal(tampered),
    /dispatch receipt is invalid/,
  );
});

test('attempt persistence must return the exact durable pre-transport journal', async () => {
  const fixture = consumedFixture();
  let transported = false;
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      createTemporalActionBoundaryJournal(),
      {
        persistAttempt() {
          return createTemporalActionBoundaryJournal();
        },
        persistDispatch(journal) {
          return journal;
        },
      },
      {
        execute() {
          transported = true;
          throw new Error('must not execute');
        },
      },
    )),
    /attempt persistence did not preserve the exact pre-transport record/,
  );
  assert.equal(transported, false);
});

test('a response whose sequence did not advance is retained as an unknown outcome', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  await assert.rejects(
    dispatchTemporalActOutput(dispatchInput(
      fixture,
      state.journal,
      memoryPersistence(state),
      {
        execute(request) {
          return responseFor(request, {
            observation: observation({ sequence: request.observationSequence }),
          });
        },
      },
    )),
    TemporalActionBoundaryUncertainError,
  );
  assert.equal(state.journal.attempts.length, 1);
  assert.equal(state.journal.dispatches.length, 0);
});

test('a tampered consumed ACT receipt is rejected before any attempt', async () => {
  const fixture = consumedFixture();
  const state = { journal: createTemporalActionBoundaryJournal() };
  const tampered: TemporalActConsumedReceipt = {
    ...structuredClone(fixture.actReceipt),
    actionRef: 'action-candidate:tampered',
  };
  let persisted = false;
  let transported = false;
  await assert.rejects(
    dispatchTemporalActOutput({
      ...dispatchInput(
        fixture,
        state.journal,
        {
          persistAttempt(journal) {
            persisted = true;
            return journal;
          },
          persistDispatch(journal) {
            persisted = true;
            return journal;
          },
        },
        {
          execute() {
            transported = true;
            throw new Error('must not execute');
          },
        },
      ),
      actReceipt: tampered,
    }),
    TemporalActionBoundaryError,
  );
  assert.equal(persisted, false);
  assert.equal(transported, false);
});
