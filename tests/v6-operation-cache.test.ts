import assert from 'node:assert/strict';
import test from 'node:test';
import { type CompositionBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { releaseBundle } from '../src/logos-engine/v6-native-authority.ts';
import { OperationResultCache } from '../src/logos-engine/v6-operation-cache.ts';
import { OperationTraceSink } from '../src/logos-engine/v6-operation-trace.ts';

function bundle(revision = 1): CompositionBundle {
  return {
    id: 'bundle', operation_key: 'OP18', composition_ref: 'B', objective_ref: 'G', preserve_refs: ['A'],
    observation_revision: revision, kind: 'probe', actions: ['ACTION1'], purpose: 'measure unknown effect',
    preconditions: { free: true }, evidence: ['obs'], preservation_evidence: { A: 'proof' },
    outcome_guard: { path: ['value'], contains: 'B' },
  };
}

function state() {
  return {
    compositions: [{ id: 'A', observed: true }, { id: 'B', observed: false, open_question: 'effect?' }, { id: 'G', observed: true }],
    facts: { free: true },
  };
}

test('same dependency identity reuses cached pure operation result while revalidating release', () => {
  const cache = new OperationResultCache();
  const trace = new OperationTraceSink();
  const identity = { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 1 };
  const first = releaseBundle(bundle(), state(), identity, trace, cache);
  const second = releaseBundle(bundle(), state(), identity, trace, cache);
  assert.equal(first.releaseAllowed, true);
  assert.equal(second.releaseAllowed, true);
  const modes = trace.snapshot().events.filter(event => event.kind === 'operation').map(event => event.kind === 'operation' ? event.mode : '');
  assert.deepEqual(modes, ['executed', 'cache_reused']);
});

test('observation revision change invalidates reuse and executes again', () => {
  const cache = new OperationResultCache();
  const trace = new OperationTraceSink();
  releaseBundle(bundle(1), state(), { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 1 }, trace, cache);
  releaseBundle(bundle(2), state(), { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-2', observationRevision: 2 }, trace, cache);
  const modes = trace.snapshot().events.filter(event => event.kind === 'operation').map(event => event.kind === 'operation' ? event.mode : '');
  assert.deepEqual(modes, ['executed', 'executed']);
  assert.equal(cache.size, 2);
});

test('cache is bounded', () => {
  const cache = new OperationResultCache(1);
  const trace = new OperationTraceSink();
  releaseBundle(bundle(1), state(), { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-1', observationRevision: 1 }, trace, cache);
  releaseBundle(bundle(2), state(), { episodeId: 'ep', levelEpoch: 1, observationId: 'obs-2', observationRevision: 2 }, trace, cache);
  assert.equal(cache.size, 1);
});
