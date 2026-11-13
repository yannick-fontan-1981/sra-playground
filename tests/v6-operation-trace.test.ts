import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationTraceSink, operationCacheKey } from '../src/logos-engine/v6-operation-trace.ts';

test('C1 trace distinguishes need, execution and semantic consumption', () => {
  const trace = new OperationTraceSink(8);
  trace.record({
    kind: 'need', needId: 'need-1', needKind: 'open-question', reason: 'effect unknown', producer: 'frontier',
    episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 3,
    focusRef: 'C1', objectiveRef: 'G1', dependencyRefs: ['obs-1'], completeness: 'complete',
  });
  trace.record({
    kind: 'operation', needId: 'need-1', op: 'OP18', caller: 'release', mode: 'executed', reason: 'open question',
    inputRefs: ['C1', 'obs-1'], dependencyRevisions: { observation: 3 }, resultStatus: 'complete', resultSummary: ['C1'],
  });
  trace.record({
    kind: 'consumption', needId: 'need-1', op: 'OP18', consumer: 'operationAdmission', decisionRef: 'release-1',
    effectKind: 'guard', semanticEffect: true, reason: 'selected composition required for release',
  });
  const snapshot = trace.snapshot();
  assert.equal(snapshot.events.length, 3);
  assert.equal(snapshot.counters['operation:OP18:executed'], 1);
  assert.equal(snapshot.counters['consumption:OP18:guard'], 1);
});

test('C1 trace supports explicit no-need and blocked cases without invoking an operation', () => {
  const trace = new OperationTraceSink();
  trace.record({
    kind: 'operation', needId: 'need-none', op: 'OP18', caller: 'frontier', mode: 'not_required',
    reason: 'no open question', inputRefs: [], dependencyRevisions: {}, resultStatus: 'not_produced',
  });
  trace.record({
    kind: 'operation', needId: 'need-unknown', op: 'OP29', caller: 'postAnalysis', mode: 'blocked',
    reason: 'expected properties unavailable', inputRefs: ['obs-2'], dependencyRevisions: { observation: 4 }, resultStatus: 'unknown',
  });
  const snapshot = trace.snapshot();
  assert.equal(snapshot.counters['operation:OP18:not_required'], 1);
  assert.equal(snapshot.counters['operation:OP29:blocked'], 1);
});

test('cache identity invalidates on observation revision and preserves exact restoration identity', () => {
  const base = {
    op: 'OP18' as const, focusRef: 'C1', levelEpoch: 1, observationId: 'obs-1', observationRevision: 3,
    inputRefs: ['C1', 'Q1'], dependencyRevisions: { model: 7, observation: 3 }, objectiveRef: 'G1',
  };
  const first = operationCacheKey(base);
  assert.equal(operationCacheKey({ ...base }), first);
  assert.notEqual(operationCacheKey({ ...base, observationRevision: 4 }), first);
  assert.notEqual(operationCacheKey({ ...base, dependencyRevisions: { model: 8, observation: 3 } }), first);
});

test('trace remains bounded and reports dropped events', () => {
  const trace = new OperationTraceSink(2);
  for (let index = 0; index < 3; index += 1) {
    trace.record({
      kind: 'operation', needId: `n${index}`, op: 'OP28', caller: 'release', mode: 'executed', reason: 'test',
      inputRefs: [], dependencyRevisions: {}, resultStatus: 'complete',
    });
  }
  const snapshot = trace.snapshot();
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.dropped, 1);
  assert.equal(snapshot.counters['operation:OP28:executed'], 3);
});

test('trace records a non-OP capability without polluting OP counters', () => {
  const trace = new OperationTraceSink();
  trace.record({
    kind: 'need', needId: 'need-temporal', needKind: 'temporal-selection',
    reason: 'current Source domain requires an attributed selection', producer: 'temporalSelectionBridge',
    episodeId: 'ep', levelEpoch: 2, observationId: 'obs-8', observationRevision: 8,
    dependencyRefs: ['candidate:a', 'candidate:b'], completeness: 'complete',
  });
  trace.record({
    kind: 'capability', needId: 'need-temporal', capability: 'temporal-selection',
    caller: 'temporalSelectionBridge', mode: 'accepted', reason: 'Source/DRM receipt verified',
    inputRefs: ['receipt:abc'], dependencyRevisions: { observation: 8 }, resultStatus: 'complete',
    resultSummary: { selectedRef: 'candidate:b', actAuthorized: false },
  });
  trace.record({
    kind: 'capability_consumption', needId: 'need-temporal', capability: 'temporal-selection',
    consumer: 'temporalSelectionBridge', decisionRef: 'receipt:abc', effectKind: 'project',
    semanticEffect: true, reason: 'verified external selection projected into the current domain',
  });

  const snapshot = trace.snapshot();
  assert.deepEqual(snapshot.events.map(event => event.kind), [
    'need', 'capability', 'capability_consumption',
  ]);
  assert.equal(snapshot.counters['capability:temporal-selection:accepted'], 1);
  assert.equal(snapshot.counters['capability_consumption:temporal-selection:project'], 1);
  assert.equal(Object.keys(snapshot.counters).some(key => key.includes('OP')), false);
});
