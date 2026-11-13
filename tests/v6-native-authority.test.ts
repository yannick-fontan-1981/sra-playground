import assert from 'node:assert/strict';
import test from 'node:test';
import { type CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

const identity = { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 1 };

function baseState() {
  return {
    compositions: [
      { id: 'A', observed: true },
      { id: 'B', observed: false, open_question: 'what does this do?' },
      { id: 'G', observed: true },
    ],
    facts: { free: true },
    bundles: [{ id: 'bundle', composition_ref: 'B', admitted: true, actions: ['ACTION1'] }],
  };
}

function bundle(op: 'OP14' | 'OP18' | 'OP28'): CompositionBundle {
  return {
    id: 'bundle', operation_key: op, composition_ref: 'B', objective_ref: 'G', preserve_refs: ['A'],
    observation_revision: 1, kind: op === 'OP18' ? 'probe' : 'realize', actions: ['ACTION1'],
    purpose: 'current release need', preconditions: { free: true }, evidence: ['obs-1'],
    preservation_evidence: { A: 'proof' }, outcome_guard: { path: ['value'], contains: op === 'OP28' ? 'bundle' : 'B' },
  };
}

test('OP18 emits the need before execution and carries one needId through release consumption', () => {
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP18'), baseState(), identity, trace);
  assert.equal(outcome.need.status, 'needed');
  assert.equal(outcome.releaseAllowed, true);
  const events = trace.snapshot().events;
  assert.deepEqual(events.map(event => event.kind), ['need', 'operation', 'consumption']);
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
});

test('OP18 with no unresolved question is not called', () => {
  const state = baseState();
  state.compositions[1] = { id: 'B', observed: true, open_question: '' };
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP18'), state, identity, trace);
  assert.equal(outcome.need.status, 'not_required');
  assert.equal(outcome.releaseAllowed, false);
  const events = trace.snapshot().events;
  assert.equal(events.some(event => event.kind === 'operation' && event.mode === 'executed'), false);
});

test('OP28 blocks before execute when the runtime bundle is not admitted', () => {
  const state = baseState();
  state.bundles[0]!.admitted = false;
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP28'), state, identity, trace);
  assert.equal(outcome.need.status, 'blocked');
  assert.equal(outcome.releaseAllowed, false);
  const operations = trace.snapshot().events.filter(event => event.kind === 'operation');
  assert.equal(operations.length, 1);
  assert.equal(operations[0]?.kind === 'operation' && operations[0].mode, 'blocked');
});

test('OP28 admitted bundle reaches operation admission and release', () => {
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP28'), baseState(), identity, trace);
  assert.equal(outcome.need.status, 'needed');
  assert.equal(outcome.releaseAllowed, true);
  assert.equal(outcome.result?.operationAdmission?.accepted, true);
});


test('OP18 treats an empty container question as absent like the Python donor', () => {
  const state: any = baseState();
  state.compositions[1] = { id: 'B', observed: false, open_question: [] };
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP18'), state, identity, trace);
  assert.equal(outcome.need.status, 'not_required');
  assert.equal(trace.snapshot().events.some(event => event.kind === 'operation' && event.mode === 'executed'), false);
});


test('OP14 admission exists at bridge level but native authority does not route it yet', () => {
  const trace = new OperationTraceSink();
  const outcome = releaseBundle(bundle('OP14'), baseState(), identity, trace);
  assert.equal(outcome.need.status, 'not_required');
  assert.equal(outcome.releaseAllowed, false);
  assert.equal(outcome.result, undefined);
  const operations = trace.snapshot().events.filter(event => event.kind === 'operation');
  assert.equal(operations.length, 1);
  assert.equal(operations[0]?.kind === 'operation' && operations[0].mode, 'not_required');
  assert.equal(operations[0]?.kind === 'operation' && operations[0].op, 'OP14');
});
