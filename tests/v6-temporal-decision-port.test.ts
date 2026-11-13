import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';
import { createTemporalSourceDecisionReceipt } from '../src/logos-engine/v6-temporal-decision-receipt.ts';
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
import {
  PassiveTemporalDecisionPort,
  bindTemporalDecisionPortEnvelope,
  fingerprintAgentObservation,
  type TemporalDecisionPortEnvelope,
} from '../src/runtime/v6-temporal-decision-port.ts';
import { PROTOCOL_VERSION, type AgentObservation } from '../src/runtime/contracts.ts';
import { AgentWorkerCore } from '../src/runtime/v6-agent-worker-core.ts';

const authority: TemporalSourceAuthority = {
  workflowRef: 'arc3.temporal_selection',
  sourceHash: 'source-hash',
  authorizedWorkflowRefs: ['arc3.temporal_selection'],
  authorizedSourceHash: 'source-hash',
};

function observation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return {
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    sequence: 8,
    image: {
      width: 64,
      height: 64,
      pixelFormat: 'palette-index-u8',
      pixels: new Uint8Array(64 * 64),
    },
    availableActionIds: [1, 6],
    state: 'NOT_FINISHED',
    level: 2,
    levelsCompleted: 1,
    ...overrides,
  };
}

function requestFor(obs: AgentObservation): TemporalSelectionRequest {
  return {
    workflowRef: 'arc3.temporal_selection',
    sourceHash: 'source-hash',
    identity: {
      episodeId: `episode:${obs.sessionId}`,
      levelEpoch: obs.level,
      observationId: `public:${obs.sessionId}:${obs.sequence}`,
      observationRevision: obs.sequence,
    },
    alternatives: [
      { ref: 'candidate:a', facts: { locus: [1, 2] }, evidenceRefs: ['return:a'] },
      { ref: 'candidate:b', facts: { locus: [3, 4] }, evidenceRefs: ['return:b'] },
    ],
    requirementRefs: ['requirement.current_evidence'],
    preserveRefs: ['candidate:a', 'candidate:b'],
  };
}

function envelopeFor(
  obs: AgentObservation,
  selectedRef: string | null,
  options: {
    state?: ReturnType<typeof createTemporalObservationState>;
    consumeReturn?: ReturnType<typeof measuredReturn>;
  } = {},
): TemporalDecisionPortEnvelope {
  const request = requestFor(obs);
  const state = options.state ?? createTemporalObservationState(request, authority);
  const receipt = createTemporalSourceDecisionReceipt(
    request,
    authority,
    ['drm:temporal'],
    selectedRef,
    selectedRef === null ? ['return:refusal'] : [`return:${selectedRef.split(':')[1]}`],
  );
  return bindTemporalDecisionPortEnvelope({
    observation: obs,
    state,
    authority,
    decisionReceipt: receipt,
    consumeReturn: options.consumeReturn,
    reason: 'consume an explicitly attributed TemporalSelection result',
  });
}

function measuredReturn(obs: AgentObservation, evidenceRef = 'return:b', productRef = 'product:b') {
  const request: TemporalContributionRequest = {
    requestRef: `request:${productRef}`,
    recipientWorkflowRef: 'arc3.temporal_selection',
    timelineRef: `timeline:${obs.sessionId}`,
    requestedAtRevision: obs.sequence - 1,
    expectedProducerDefinitionRef: 'producer:def',
    expectedProducerSourceHash: 'producer:source',
    scopeRefs: [`timeline:${obs.sessionId}`, `public:${obs.sessionId}:${obs.sequence}`],
  };
  const returned: TemporalContributionReturn = {
    request,
    producerDefinitionRef: 'producer:def',
    producerSourceHash: 'producer:source',
    returnedAtRevision: obs.sequence,
    productRefs: [productRef],
    evidenceRefs: [evidenceRef],
    requiresCurrentRevalidation: true,
    returnDigest: `digest:${productRef}`,
  };
  return measureTemporalReturnIdentity({
    request,
    returned,
    consumerRef: 'arc3.temporal_selection',
    timelineRef: `timeline:${obs.sessionId}`,
    currentScopeRefs: [`timeline:${obs.sessionId}`, `public:${obs.sessionId}:${obs.sequence}`],
    currentRevision: obs.sequence,
    productRevisions: { [productRef]: obs.sequence },
    productDigests: { [productRef]: `seal:${productRef}` },
    producerMatches: true,
    sourceTerminalMatches: true,
    requestOriginMatches: true,
  });
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

test('public observation fingerprint is deterministic and changes with transport identity', () => {
  const first = observation();
  const same = observation();
  const changedPixel = observation();
  changedPixel.image.pixels[0] = 1;

  assert.equal(fingerprintAgentObservation(first), fingerprintAgentObservation(same));
  assert.notEqual(fingerprintAgentObservation(first), fingerprintAgentObservation(changedPixel));
  assert.notEqual(
    fingerprintAgentObservation(first),
    fingerprintAgentObservation(observation({ sequence: first.sequence + 1 })),
  );
});

test('missing envelope fails closed and produces no action', () => {
  const trace = new OperationTraceSink();
  const port = new PassiveTemporalDecisionPort(trace);
  port.initialize('session-1', 1);

  assert.equal(port.decide(observation(), 20, signal()), undefined);
  assert.equal(port.latestProjection(), null);
  assert.equal(port.snapshot().lastResolution?.status, 'missing_envelope');
  assert.equal(trace.snapshot().counters['capability:temporal-decision-port:refused'], 1);
  assert.equal(trace.snapshot().counters['capability_consumption:temporal-decision-port:refuse'], 1);
});

test('accepted temporal selection is projected but action remains withheld without ACT', () => {
  const trace = new OperationTraceSink();
  const port = new PassiveTemporalDecisionPort(trace);
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  port.submit(envelopeFor(obs, 'candidate:b'));

  assert.equal(port.decide(obs, 20, signal()), undefined);
  const projection = port.latestProjection();
  assert.equal(projection?.decision.status, 'accepted');
  assert.equal(projection?.decision.status === 'accepted' ? projection.decision.selectedRef : null, 'candidate:b');
  assert.equal(projection?.actAuthorized, false);
  assert.deepEqual(port.snapshot().lastResolution, {
    status: 'action_withheld',
    sessionId: 'session-1',
    observationSequence: 8,
    reason: 'selection projected, but action withheld because no separate ACT authorization exists',
    decisionRef: projection?.decisionRef,
    selectedRef: 'candidate:b',
    consumedReturn: false,
    actionReleased: false,
  });
  assert.equal(trace.snapshot().counters['capability:temporal-selection:accepted'], 1);
  assert.equal(trace.snapshot().counters['capability:temporal-decision-port:accepted'], 1);
  assert.equal(trace.snapshot().counters['capability_consumption:temporal-decision-port:refuse'], 1);
});

test('verified selection refusal is preserved without fallback action', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  port.submit(envelopeFor(obs, null));

  assert.equal(port.decide(obs, 20, signal()), undefined);
  assert.equal(port.latestProjection()?.decision.status, 'refused');
  assert.equal(port.snapshot().lastResolution?.status, 'selection_refused');
  assert.equal(port.snapshot().lastResolution?.actionReleased, false);
});

test('public observation mismatch blocks and consumes the stale envelope', () => {
  const port = new PassiveTemporalDecisionPort();
  const submitted = observation();
  const changed = observation();
  changed.image.pixels[10] = 9;
  port.initialize(submitted.sessionId, 1);
  port.submit(envelopeFor(submitted, 'candidate:a'));

  assert.equal(port.decide(changed, 20, signal()), undefined);
  assert.equal(port.latestProjection(), null);
  assert.equal(port.snapshot().lastResolution?.status, 'blocked');
  assert.match(port.snapshot().lastResolution?.reason ?? '', /fingerprint mismatch/);
  assert.equal(port.snapshot().pendingEnvelopeCount, 0);
});

test('tampered temporal binding is blocked before projection', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  const envelope = envelopeFor(obs, 'candidate:a');
  envelope.binding.temporalObservationRevision += 1;
  port.submit(envelope);

  assert.equal(port.decide(obs, 20, signal()), undefined);
  assert.equal(port.latestProjection(), null);
  assert.match(port.snapshot().lastResolution?.reason ?? '', /binding no longer matches/);
});

test('stale decision receipt is blocked without propagating an action', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  const envelope = envelopeFor(obs, 'candidate:a');
  envelope.decisionReceipt = {
    ...envelope.decisionReceipt,
    identity: {
      ...envelope.decisionReceipt.identity,
      observationId: 'public:session-1:9',
      observationRevision: 9,
    },
  };
  port.submit(envelope);

  assert.doesNotThrow(() => assert.equal(port.decide(obs, 20, signal()), undefined));
  assert.equal(port.latestProjection(), null);
  assert.equal(port.snapshot().lastResolution?.status, 'blocked');
  assert.match(port.snapshot().lastResolution?.reason ?? '', /observation identity mismatch/);
});

test('receipt domain divergence is blocked without fallback selection', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  const envelope = envelopeFor(obs, 'candidate:a');
  envelope.state = {
    ...envelope.state,
    alternatives: [envelope.state.alternatives[0]!],
    preserveRefs: ['candidate:a'],
  };
  port.submit(envelope);

  assert.equal(port.decide(obs, 20, signal()), undefined);
  assert.equal(port.latestProjection(), null);
  assert.equal(port.snapshot().lastResolution?.status, 'blocked');
  assert.match(port.snapshot().lastResolution?.reason ?? '', /alternative domain mismatch/);
});

test('invalid restored proof envelope returns undefined instead of leaking an action', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  const envelope = envelopeFor(obs, 'candidate:a');
  envelope.state = { ...envelope.state, memoryProofRefs: ['ghost-proof'] };
  port.submit(envelope);

  assert.doesNotThrow(() => assert.equal(port.decide(obs, 20, signal()), undefined));
  assert.equal(port.latestProjection(), null);
  assert.equal(port.snapshot().lastResolution?.status, 'blocked');
  assert.match(port.snapshot().lastResolution?.reason ?? '', /proof refs without a memory contract/);
});

test('stale envelopes are pruned while a future exact envelope remains queued', () => {
  const port = new PassiveTemporalDecisionPort();
  port.initialize('session-1', 1);
  port.submit(envelopeFor(observation({ sequence: 7 }), 'candidate:a'));
  port.submit(envelopeFor(observation({ sequence: 9 }), 'candidate:b'));

  assert.equal(port.decide(observation({ sequence: 8 }), 20, signal()), undefined);
  assert.deepEqual(port.snapshot().pendingSequences, [9]);
  assert.equal(port.snapshot().lastResolution?.status, 'missing_envelope');
});

test('duplicate observation envelope and embedded ACT authorization are refused at submit', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  const envelope = envelopeFor(obs, 'candidate:a');
  port.submit(envelope);
  assert.throws(() => port.submit(envelope), /already queued/);

  const next = envelopeFor(observation({ sequence: 9 }), 'candidate:a') as unknown as Record<string, unknown>;
  next.actAuthorization = { action: { id: 1 } };
  assert.throws(
    () => port.submit(next as unknown as TemporalDecisionPortEnvelope),
    /cannot carry ACT authorization/,
  );
});

test('exact qualified return consumption is exposed through the latest projection', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  const measured = measuredReturn(obs);
  const state = attachQualifiedTemporalReturn(
    createTemporalObservationState(requestFor(obs), authority),
    measured,
  );
  port.initialize(obs.sessionId, 1);
  port.submit(envelopeFor(obs, 'candidate:b', { state, consumeReturn: measured }));

  assert.equal(port.decide(obs, 20, signal()), undefined);
  assert.equal(port.snapshot().lastResolution?.consumedReturn, true);
  assert.equal(port.latestProjection()?.state.consumedReturnIdentityKeys.length, 1);
});

test('counters-only trace records the passive chain without retaining event payloads', () => {
  const trace = new OperationTraceSink(8, 'counters');
  const port = new PassiveTemporalDecisionPort(trace);
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  port.submit(envelopeFor(obs, 'candidate:a'));
  port.decide(obs, 20, signal());

  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.events, []);
  assert.equal(snapshot.counters['need:temporal-decision-port'], 1);
  assert.equal(snapshot.counters['capability:temporal-decision-port:accepted'], 1);
  assert.equal(snapshot.counters['capability_consumption:temporal-decision-port:refuse'], 1);
});

test('worker integration remains stopped rather than returning an action without ACT authority', async () => {
  const port = new PassiveTemporalDecisionPort();
  const core = new AgentWorkerCore(port, { implementationRevision: 'lot10d-passive-temporal-port' });
  const obs = observation();

  assert.equal((await core.handle({
    type: 'initialize', protocolVersion: PROTOCOL_VERSION, sessionId: obs.sessionId, seed: 4,
  })).type, 'ready');
  port.submit(envelopeFor(obs, 'candidate:b'));

  assert.deepEqual(await core.handle({ type: 'observe', observation: obs, budgetMs: 50 }), {
    type: 'stopped',
    sessionId: obs.sessionId,
    reason: 'budget',
  });
  assert.equal(port.latestProjection()?.decision.status, 'accepted');
  assert.equal(port.snapshot().lastResolution?.status, 'action_withheld');
});

test('cancel clears pending envelopes and projection state', () => {
  const port = new PassiveTemporalDecisionPort();
  const obs = observation();
  port.initialize(obs.sessionId, 1);
  port.submit(envelopeFor(obs, 'candidate:a'));
  port.cancel(obs.sessionId);

  assert.deepEqual(port.snapshot(), {
    activeSessionId: null,
    pendingEnvelopeCount: 0,
    pendingSequences: [],
    lastResolution: null,
  });
  assert.equal(port.latestProjection(), null);
  assert.equal(port.decide(obs, 20, signal()), undefined);
  assert.equal(port.snapshot().lastResolution?.status, 'blocked');
});
