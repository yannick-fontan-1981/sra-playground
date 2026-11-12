import assert from 'node:assert/strict';
import test from 'node:test';
import type { CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { runOperationCycle } from '../src/logos-engine/v6-operation-cycle.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

function bundle(): CompositionBundle {
  return {
    id: 'probe', operation_key: 'OP18', composition_ref: 'B', objective_ref: 'G', preserve_refs: ['A'],
    observation_revision: 1, kind: 'probe', actions: ['ACTION1'], purpose: 'measure unknown mechanism',
    preconditions: { free: true }, evidence: ['obs-1'], preservation_evidence: { A: 'proof' },
    outcome_guard: { path: ['value'], contains: 'B' },
  };
}

function before() {
  return {
    compositions: [{ id: 'A', observed: true }, { id: 'B', observed: false, open_question: 'mechanism?' }, { id: 'G', observed: true }],
    facts: { free: true },
  };
}

function after() {
  return {
    compositions: [{ id: 'B' }], observation_revision: 2, observation_ref: 'obs-2',
    expected_properties: { color: 'blue', door: 'open' },
    observed_properties: { color: 'red' },
    knowledge_updates: [{ composition_ref: 'B', property: 'color', value: 'red', revision: 2, evidence: 'obs-2' }],
    objective_assessments: [{ composition_ref: 'G', satisfied: false, feasible: 'unknown', new_evidence: ['obs-2'] }],
  };
}

const identity = { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 1 };

test('C2 full chain keeps one need identity through release and OP29/30/31 return analysis', () => {
  const trace = new OperationTraceSink(32);
  const cycle = runOperationCycle(bundle(), before(), identity, after(), { trace });
  assert.equal(cycle.released, true);
  assert.deepEqual(cycle.postAnalysis.map(receipt => [receipt.op, receipt.disposition]), [
    ['OP29', 'information_only'], ['OP30', 'persisted_only'], ['OP31', 'information_only'],
  ]);
  assert.deepEqual(cycle.knowledge.get('knowledge:B:color'), { value: 'red', evidence: 'obs-2', revision: 2 });
  const events = trace.snapshot().events;
  assert.equal(new Set(events.map(event => event.needId)).size, 1);
  assert.equal(events.some(event => event.kind === 'consumption' && event.op === 'OP18' && event.effectKind === 'guard'), true);
  assert.equal(events.some(event => event.kind === 'consumption' && event.op === 'OP30' && event.effectKind === 'persisted_only'), true);
});

test('no return observation means no post-analysis calls', () => {
  const trace = new OperationTraceSink();
  const cycle = runOperationCycle(bundle(), before(), identity, undefined, { trace });
  assert.equal(cycle.released, true);
  assert.deepEqual(cycle.postAnalysis, []);
  assert.equal(trace.snapshot().events.some(event => event.kind === 'operation' && ['OP29', 'OP30', 'OP31'].includes(event.op)), false);
});

test('denied release does not execute post-analysis', () => {
  const state = before();
  state.compositions[1] = { id: 'B', observed: true, open_question: '' };
  const trace = new OperationTraceSink();
  const cycle = runOperationCycle(bundle(), state, identity, after(), { trace });
  assert.equal(cycle.released, false);
  assert.deepEqual(cycle.postAnalysis, []);
});
