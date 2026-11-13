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
  TemporalActionBoundaryUncertainError,
  createTemporalActionBoundaryJournal,
  dispatchTemporalActOutput,
  temporalEnvironmentActionResponseDigest,
  temporalEnvironmentDispatchFingerprint,
  type TemporalActionBoundaryCheckpoint,
  type TemporalActionBoundaryCurrentAuthority,
  type TemporalActionBoundaryJournal,
  type TemporalActionBoundaryPersistence,
  type TemporalEnvironmentActionRequest,
  type TemporalEnvironmentActionResponse,
  type TemporalEnvironmentDispatchReceipt,
  type TemporalEnvironmentTransport,
} from '../src/runtime/v6-temporal-action-boundary.ts';
import {
  TemporalCausalResumeError,
  TemporalCausalResumeRefusedError,
  TemporalCausalResumeUnknownOutcomeError,
  createTemporalCausalResumeCheckpoint,
  createTemporalCausalResumeJournal,
  restoreTemporalCausalResumeJournal,
  resumeTemporalWorkflowFromDispatch,
  type TemporalCausalResumeCheckpoint,
  type TemporalCausalResumeCurrentAuthority,
  type TemporalCausalResumeJournal,
} from '../src/runtime/v6-temporal-causal-resume.ts';
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
    reason: 'qualify one causal observation after a durable environment dispatch',
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

function candidate(point = false): TemporalPreparedActionCandidateSpec {
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

function boundaryCheckpoint(
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
  checkpoint = boundaryCheckpoint(fixture),
): TemporalActionBoundaryCurrentAuthority {
  const authority: TemporalActionBoundaryCurrentAuthority = {
    boundaryRequestRef: 'boundary-request:8',
    workflowRef: checkpoint.workflowRef,
    workflowInstanceRef: checkpoint.workflowInstanceRef,
    sourceHash: checkpoint.sourceHash,
    runRef: checkpoint.runRef,
    timelineRef: checkpoint.timelineRef,
    frameRef: checkpoint.frameRef,
    stateRevision: checkpoint.stateRevision,
    currentSnapshotDigest: fingerprintAgentObservation(fixture.publicObservation),
    currentAvailableActionRef: temporalAvailableActionRef(
      fixture.publicObservation,
      fixture.permit.actionId,
    ),
    environmentAdapterRef: checkpoint.environmentAdapterRef,
    worldContextRef: checkpoint.worldContextRef,
    worldContextDigest: checkpoint.worldContextDigest,
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
  authority.evidenceRefs = uniqueRefs([
    authority.boundaryRequestRef,
    authority.currentSnapshotDigest,
    authority.currentAvailableActionRef,
    authority.environmentAdapterRef,
    authority.worldContextRef,
    authority.worldContextDigest,
    authority.canonicalBindingFingerprint,
    authority.canonicalPermitFingerprint,
    authority.canonicalActReceiptFingerprint,
    authority.canonicalLeaseTransitionFingerprint,
  ]);
  return authority;
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
): TemporalActionBoundaryPersistence {
  return {
    persistAttempt(journal) {
      state.journal = structuredClone(journal);
      return structuredClone(state.journal);
    },
    persistDispatch(journal) {
      state.journal = structuredClone(journal);
      return structuredClone(state.journal);
    },
  };
}

interface DurableFixture extends ConsumedFixture {
  boundaryCheckpoint: TemporalActionBoundaryCheckpoint;
  causalCheckpoint: TemporalCausalResumeCheckpoint;
  boundaryJournal: TemporalActionBoundaryJournal;
  dispatch: TemporalEnvironmentDispatchReceipt;
  causalAuthority: TemporalCausalResumeCurrentAuthority;
}

function causalAuthority(
  fixture: ConsumedFixture,
  checkpoint: TemporalCausalResumeCheckpoint,
  dispatch: TemporalEnvironmentDispatchReceipt,
  overrides: Partial<TemporalCausalResumeCurrentAuthority> = {},
): TemporalCausalResumeCurrentAuthority {
  const boundary = checkpoint.boundaryCheckpoint;
  const base: TemporalCausalResumeCurrentAuthority = {
    resumeRequestRef: 'causal-resume-request:9',
    currentCheckpointRef: boundary.checkpointRef,
    currentCheckpointFingerprint: checkpoint.checkpointFingerprint,
    currentSourceHash: boundary.sourceHash,
    currentRunRef: boundary.runRef,
    currentTimelineRef: boundary.timelineRef,
    currentFrameRef: boundary.frameRef,
    currentStateRevision: dispatch.observationIdentity.observationRevision,
    currentSemanticSnapshotDigest: boundary.preActionSnapshotDigest,
    canonicalDispatchFingerprint: dispatch.dispatchFingerprint,
    canonicalActReceiptFingerprint: fixture.actReceipt.receiptFingerprint,
    canonicalLeaseTransitionFingerprint:
      fixture.actReceipt.leaseTransition.transitionFingerprint,
    canonicalResponsibleIntentRef: boundary.pendingIntentRef,
    operationalReturnBindingRef: 'operational-return:observation:9',
    checkpointCurrent: true,
    sourceCurrent: true,
    responsibilityCurrent: true,
    responsibleIntentCurrent: true,
    observedConsequenceBindingCurrent: true,
    evidenceRefs: [],
  };
  const merged = { ...base, ...overrides };
  merged.evidenceRefs = overrides.evidenceRefs
    ? [...overrides.evidenceRefs]
    : uniqueRefs([
      merged.resumeRequestRef,
      merged.currentCheckpointFingerprint,
      merged.currentSemanticSnapshotDigest,
      merged.canonicalDispatchFingerprint,
      merged.canonicalActReceiptFingerprint,
      merged.canonicalLeaseTransitionFingerprint,
      merged.canonicalResponsibleIntentRef,
      merged.operationalReturnBindingRef,
    ]);
  return merged;
}

async function durableFixture(point = false): Promise<DurableFixture> {
  const fixture = consumedFixture(point);
  const currentCheckpoint = boundaryCheckpoint(fixture);
  const state = { journal: createTemporalActionBoundaryJournal() };
  const boundaryResult = await dispatchTemporalActOutput({
    journal: state.journal,
    checkpoint: currentCheckpoint,
    currentAuthority: boundaryAuthority(fixture, currentCheckpoint),
    observation: fixture.publicObservation,
    binding: fixture.binding,
    permit: fixture.permit,
    actReceipt: fixture.actReceipt,
    persistence: memoryPersistence(state),
    transport: {
      execute(request) {
        return responseFor(request);
      },
    },
  });
  const causalCheckpoint = createTemporalCausalResumeCheckpoint(
    currentCheckpoint,
    8,
    'binding:next-frame',
  );
  return {
    ...fixture,
    boundaryCheckpoint: currentCheckpoint,
    causalCheckpoint,
    boundaryJournal: boundaryResult.journal,
    dispatch: boundaryResult.dispatch,
    causalAuthority: causalAuthority(
      fixture,
      causalCheckpoint,
      boundaryResult.dispatch,
    ),
  };
}

function resumeInput(
  fixture: DurableFixture,
  overrides: {
    journal?: TemporalCausalResumeJournal;
    boundaryJournal?: TemporalActionBoundaryJournal;
    dispatchRef?: string;
    checkpoint?: TemporalCausalResumeCheckpoint;
    permit?: TemporalActionReleasePermitReceipt;
    actReceipt?: TemporalActConsumedReceipt;
    authority?: TemporalCausalResumeCurrentAuthority;
  } = {},
): Parameters<typeof resumeTemporalWorkflowFromDispatch>[0] {
  return {
    journal: overrides.journal ?? createTemporalCausalResumeJournal(),
    boundaryJournal: overrides.boundaryJournal ?? fixture.boundaryJournal,
    dispatchRef: overrides.dispatchRef ?? fixture.dispatch.dispatchRef,
    checkpoint: overrides.checkpoint ?? fixture.causalCheckpoint,
    permit: overrides.permit ?? fixture.permit,
    actReceipt: overrides.actReceipt ?? fixture.actReceipt,
    currentAuthority: overrides.authority ?? fixture.causalAuthority,
  };
}

function dispatchWithoutObservationId(
  dispatch: TemporalEnvironmentDispatchReceipt,
  observationId: string,
): TemporalEnvironmentDispatchReceipt {
  const changed = structuredClone(dispatch);
  changed.observationIdentity = {
    ...changed.observationIdentity,
    observationId,
  };
  const {
    dispatchFingerprint: _fingerprint,
    observation: _observation,
    ...base
  } = changed;
  changed.dispatchFingerprint = temporalEnvironmentDispatchFingerprint(base);
  return changed;
}

test('durable dispatch observation resumes one checkpoint and moves the lease released to observed', async () => {
  const fixture = await durableFixture();
  const result = resumeTemporalWorkflowFromDispatch(resumeInput(fixture));

  assert.equal(result.reused, false);
  assert.equal(result.receipt.observationConsumed, true);
  assert.equal(result.receipt.checkpointResumed, true);
  assert.equal(result.receipt.workflowResumed, true);
  assert.equal(result.receipt.observation.dispatchRef, fixture.dispatch.dispatchRef);
  assert.equal(
    result.receipt.observation.environmentActionEventRef,
    fixture.dispatch.environmentActionEventRef,
  );
  assert.equal(result.receipt.actionObserved.actionIntentRef, fixture.permit.intentRef);
  assert.equal(result.receipt.actionObserved.actionReleasePermitRef, fixture.permit.permitRef);
  assert.equal(result.receipt.leaseTransition.fromState, 'released');
  assert.equal(result.receipt.leaseTransition.toState, 'observed');
  assert.equal(result.receipt.resumedCheckpoint.status, 'active');
  assert.equal(result.receipt.resumedCheckpoint.checkpointSequence, 9);
  assert.equal(result.receipt.resumedCheckpoint.previousFrameRef, 'observation:8');
  assert.equal(result.receipt.resumedCheckpoint.frameRef, 'observation:9');
  assert.equal(result.receipt.resumedCheckpoint.awaitingFrameBindingRef, 'binding:next-frame');
  assert.equal(result.receipt.resumedCheckpoint.pendingActionLineageCleared, true);
  assert.equal(result.journal.receipts.length, 1);
});

test('resumed checkpoint binds the acquired raw input and consumes the observation exactly once', async () => {
  const fixture = await durableFixture();
  const first = resumeTemporalWorkflowFromDispatch(resumeInput(fixture));
  const observationRef = first.receipt.observation.observationReceiptRef;
  assert.equal(
    first.receipt.resumedCheckpoint.boundRawInputRef,
    `temporal-raw-input:${fixture.dispatch.observationFingerprint}`,
  );
  assert.deepEqual(
    first.receipt.resumedCheckpoint.consumedObservationRefs,
    [observationRef],
  );

  const second = resumeTemporalWorkflowFromDispatch(resumeInput(fixture, {
    journal: first.journal,
  }));
  assert.equal(second.reused, true);
  assert.equal(second.emittedResumedCheckpoint, null);
  assert.equal(second.journal.receipts.length, 1);
  assert.equal(second.receipt.receiptFingerprint, first.receipt.receiptFingerprint);
});

test('an unknown attempt cannot be converted into causal success', async () => {
  const fixture = consumedFixture();
  const currentCheckpoint = boundaryCheckpoint(fixture);
  const state = { journal: createTemporalActionBoundaryJournal() };
  let unknownJournal: TemporalActionBoundaryJournal | null = null;
  await assert.rejects(
    dispatchTemporalActOutput({
      journal: state.journal,
      checkpoint: currentCheckpoint,
      currentAuthority: boundaryAuthority(fixture, currentCheckpoint),
      observation: fixture.publicObservation,
      binding: fixture.binding,
      permit: fixture.permit,
      actReceipt: fixture.actReceipt,
      persistence: memoryPersistence(state),
      transport: {
        execute() {
          throw new Error('external result is unknown');
        },
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof TemporalActionBoundaryUncertainError);
      unknownJournal = error.journal;
      return true;
    },
  );
  assert.ok(unknownJournal);
  const causalCheckpoint = createTemporalCausalResumeCheckpoint(
    currentCheckpoint,
    8,
    'binding:next-frame',
  );
  const attempt = unknownJournal.attempts[0]!;
  const authority: TemporalCausalResumeCurrentAuthority = {
    resumeRequestRef: 'causal-resume-request:unknown',
    currentCheckpointRef: currentCheckpoint.checkpointRef,
    currentCheckpointFingerprint: causalCheckpoint.checkpointFingerprint,
    currentSourceHash: currentCheckpoint.sourceHash,
    currentRunRef: currentCheckpoint.runRef,
    currentTimelineRef: currentCheckpoint.timelineRef,
    currentFrameRef: currentCheckpoint.frameRef,
    currentStateRevision: currentCheckpoint.stateRevision,
    currentSemanticSnapshotDigest: currentCheckpoint.preActionSnapshotDigest,
    canonicalDispatchFingerprint: 'dispatch:unknown',
    canonicalActReceiptFingerprint: fixture.actReceipt.receiptFingerprint,
    canonicalLeaseTransitionFingerprint:
      fixture.actReceipt.leaseTransition.transitionFingerprint,
    canonicalResponsibleIntentRef: currentCheckpoint.pendingIntentRef,
    operationalReturnBindingRef: 'operational-return:unknown',
    checkpointCurrent: true,
    sourceCurrent: true,
    responsibilityCurrent: true,
    responsibleIntentCurrent: true,
    observedConsequenceBindingCurrent: true,
    evidenceRefs: [],
  };
  authority.evidenceRefs = uniqueRefs([
    authority.resumeRequestRef,
    authority.currentCheckpointFingerprint,
    authority.currentSemanticSnapshotDigest,
    authority.canonicalDispatchFingerprint,
    authority.canonicalActReceiptFingerprint,
    authority.canonicalLeaseTransitionFingerprint,
    authority.canonicalResponsibleIntentRef,
    authority.operationalReturnBindingRef,
  ]);

  assert.throws(
    () => resumeTemporalWorkflowFromDispatch({
      journal: createTemporalCausalResumeJournal(),
      boundaryJournal: unknownJournal!,
      dispatchRef: attempt.dispatchRef,
      checkpoint: causalCheckpoint,
      permit: fixture.permit,
      actReceipt: fixture.actReceipt,
      currentAuthority: authority,
    }),
    (error: unknown) => {
      assert.ok(error instanceof TemporalCausalResumeUnknownOutcomeError);
      assert.equal(error.outcomeStatus, 'unknown');
      assert.equal(error.redeliveryPermitted, false);
      assert.equal(error.reconciliationRequired, true);
      assert.equal(error.observationConsumed, false);
      assert.equal(error.checkpointResumed, false);
      return true;
    },
  );
});

test('absence of both attempt and dispatch is not a causal observation', async () => {
  const fixture = await durableFixture();
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, {
      boundaryJournal: createTemporalActionBoundaryJournal(),
    })),
    /requires a durable dispatch receipt/,
  );
});

test('checkpoint, Source, run, timeline and frame remain independent current gates', async () => {
  const fixture = await durableFixture();
  const cases: Array<[
    Partial<TemporalCausalResumeCurrentAuthority>,
    string,
  ]> = [
    [{ checkpointCurrent: false }, 'checkpoint_not_current'],
    [{ sourceCurrent: false }, 'source_changed'],
    [{ currentRunRef: 'session:other' }, 'run_changed'],
    [{ currentTimelineRef: 'timeline:other' }, 'timeline_changed'],
    [{ currentFrameRef: 'observation:other' }, 'frame_changed'],
  ];
  for (const [changes, reason] of cases) {
    const authority = causalAuthority(
      fixture,
      fixture.causalCheckpoint,
      fixture.dispatch,
      changes,
    );
    assert.throws(
      () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { authority })),
      (error: unknown) => {
        assert.ok(error instanceof TemporalCausalResumeRefusedError);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  }
});

test('current revision and semantic snapshot are revalidated before observation consumption', async () => {
  const fixture = await durableFixture();
  for (const [changes, reason] of [
    [
      { currentStateRevision: fixture.causalAuthority.currentStateRevision + 1 },
      'state_revision_changed',
    ],
    [
      { currentSemanticSnapshotDigest: 'snapshot:changed' },
      'semantic_snapshot_changed',
    ],
  ] as const) {
    const authority = causalAuthority(
      fixture,
      fixture.causalCheckpoint,
      fixture.dispatch,
      changes,
    );
    assert.throws(
      () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { authority })),
      (error: unknown) => {
        assert.ok(error instanceof TemporalCausalResumeRefusedError);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  }
});

test('responsibility, canonical intent and observed consequence binding are separate gates', async () => {
  const fixture = await durableFixture();
  const cases: Array<[
    Partial<TemporalCausalResumeCurrentAuthority>,
    string,
  ]> = [
    [{ responsibilityCurrent: false }, 'responsibility_not_current'],
    [{ responsibleIntentCurrent: false }, 'responsible_intent_not_current'],
    [
      { canonicalResponsibleIntentRef: 'intent:other' },
      'responsible_intent_not_current',
    ],
    [
      { observedConsequenceBindingCurrent: false },
      'observed_consequence_binding_not_current',
    ],
  ];
  for (const [changes, reason] of cases) {
    const authority = causalAuthority(
      fixture,
      fixture.causalCheckpoint,
      fixture.dispatch,
      changes,
    );
    assert.throws(
      () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { authority })),
      (error: unknown) => {
        assert.ok(error instanceof TemporalCausalResumeRefusedError);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  }
});

test('canonical dispatch, ACT receipt and released transition are revalidated independently', async () => {
  const fixture = await durableFixture();
  const cases: Array<[
    Partial<TemporalCausalResumeCurrentAuthority>,
    string,
  ]> = [
    [
      { canonicalDispatchFingerprint: 'dispatch:fingerprint:other' },
      'canonical_dispatch_changed',
    ],
    [
      { canonicalActReceiptFingerprint: 'act-receipt:fingerprint:other' },
      'canonical_act_receipt_changed',
    ],
    [
      { canonicalLeaseTransitionFingerprint: 'lease-transition:fingerprint:other' },
      'canonical_lease_transition_changed',
    ],
  ];
  for (const [changes, reason] of cases) {
    const authority = causalAuthority(
      fixture,
      fixture.causalCheckpoint,
      fixture.dispatch,
      changes,
    );
    assert.throws(
      () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { authority })),
      (error: unknown) => {
        assert.ok(error instanceof TemporalCausalResumeRefusedError);
        assert.equal(error.reason, reason);
        return true;
      },
    );
  }
});

test('an observation already listed on the suspended checkpoint cannot be consumed again', async () => {
  const fixture = await durableFixture();
  const observationRef = `temporal-observation-acquired:${fixture.dispatch.dispatchRef}`;
  const checkpoint = createTemporalCausalResumeCheckpoint(
    fixture.boundaryCheckpoint,
    8,
    'binding:next-frame',
    [observationRef],
  );
  const authority = causalAuthority(
    fixture,
    checkpoint,
    fixture.dispatch,
  );
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, {
      checkpoint,
      authority,
    })),
    /already consumed/,
  );
});

test('causal resume requires a genuinely new frame identity', async () => {
  const fixture = await durableFixture();
  const changedDispatch = dispatchWithoutObservationId(
    fixture.dispatch,
    fixture.boundaryCheckpoint.frameRef,
  );
  const boundaryJournal = structuredClone(fixture.boundaryJournal);
  boundaryJournal.dispatches = [changedDispatch];
  const authority = causalAuthority(
    fixture,
    fixture.causalCheckpoint,
    changedDispatch,
  );
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, {
      boundaryJournal,
      authority,
    })),
    /observation identity or chronology is invalid/,
  );
});

test('tampered acquired observation is rejected by the durable ActionBoundary journal', async () => {
  const fixture = await durableFixture();
  const boundaryJournal = structuredClone(fixture.boundaryJournal);
  boundaryJournal.dispatches[0]!.observation.image.pixels[0] = 12;
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, {
      boundaryJournal,
    })),
    /environment dispatch receipt is invalid/,
  );
});

test('tampered permit or consumed ACT receipt is rejected before causal semantics', async () => {
  const fixture = await durableFixture();
  const permit = { ...fixture.permit, sourceHash: 'source:tampered' };
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { permit })),
    /static fingerprint chain is invalid/,
  );

  const actReceipt = { ...fixture.actReceipt, sourceHash: 'source:tampered' };
  assert.throws(
    () => resumeTemporalWorkflowFromDispatch(resumeInput(fixture, { actReceipt })),
    /static fingerprint chain is invalid/,
  );
});

test('resume journal restoration preserves detached data and rejects tampering or duplicates', async () => {
  const fixture = await durableFixture();
  const result = resumeTemporalWorkflowFromDispatch(resumeInput(fixture));
  const restored = restoreTemporalCausalResumeJournal(result.journal);
  restored.receipts[0]!.resumedCheckpoint.consumedObservationRefs.push?.('mutated');
  assert.equal(result.journal.receipts[0]!.resumedCheckpoint.consumedObservationRefs.length, 1);

  const tampered = structuredClone(result.journal);
  tampered.receipts[0]!.receiptFingerprint = 'tampered';
  assert.throws(
    () => restoreTemporalCausalResumeJournal(tampered),
    /receipt is invalid/,
  );

  const duplicate = structuredClone(result.journal);
  duplicate.receipts = [duplicate.receipts[0]!, duplicate.receipts[0]!];
  assert.throws(
    () => restoreTemporalCausalResumeJournal(duplicate),
    /duplicate causal identity/,
  );
});

test('checkpoint and journal bounds fail closed', async () => {
  const fixture = await durableFixture();
  assert.throws(
    () => createTemporalCausalResumeCheckpoint(
      fixture.boundaryCheckpoint,
      8,
      'binding:next-frame',
      ['observation:duplicate', 'observation:duplicate'],
    ),
    /checkpoint envelope is invalid/,
  );
  assert.throws(() => createTemporalCausalResumeJournal(0), /journal envelope is invalid/);
  assert.throws(() => createTemporalCausalResumeJournal(1025), /journal envelope is invalid/);
});

test('point-action payload is not retained in causal observation or resume receipts', async () => {
  const fixture = await durableFixture(true);
  const result = resumeTemporalWorkflowFromDispatch(resumeInput(fixture));
  assert.equal('action' in result.receipt, false);
  assert.equal('candidateAction' in result.receipt, false);
  assert.equal('target' in result.receipt, false);
  assert.equal('action' in result.receipt.observation, false);
  assert.equal('observation' in result.receipt.observation, false);
  assert.equal(result.receipt.workflowResumed, true);
});
