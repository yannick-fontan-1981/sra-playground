import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeStoreWrite } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { GoalAccessAdapter } from '../src/logos-engine/v6-goal-access.ts';
import { ProspectiveContactAdapter } from '../src/logos-engine/v6-prospective-contact.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';

const CAUSE = { workflow: 'test.native.persistence', step: 'write', statement: 'retain' };
const raster = () => Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => (x + y) % 16));

test('immutable hydration observes root revisions and ignores a rolled-back write', async () => {
  const store = new NativeKnowledgeStore('revision-test', 'revision-test');
  const write = { id: 'state:observed', kind: 'component_state' as const, component: 'observed', value: { rows: raster(), score: 0 } };
  await store.commit([write], CAUSE);
  const first = store.stateValue(write.id);
  assert.ok(Object.isFrozen(first));
  assert.equal(store.stateValue(write.id), first);
  await assert.rejects(store.commit([{ ...write, value: { rows: raster(), score: 99 } },
    { id: 'invalid', kind: 'family_state', value: {} }], CAUSE), /Logos contract/);
  assert.equal(store.stateValue(write.id), first);
  await store.commit([{ ...write, value: { rows: raster(), score: 1 } }], CAUSE);
  const second = store.stateValue(write.id);
  assert.notEqual(second, first);
  assert.equal((second as { score: number }).score, 1);
  assert.equal((first as { score: number }).score, 0);
});

test('a cached root never hides a changed content-addressed fragment', async () => {
  const store = new NativeKnowledgeStore('fragment-integrity', 'fragment-integrity');
  await store.commit([{ id: 'observed', kind: 'component_state', component: 'observed', value: { rows: raster() } }], CAUSE);
  const root = store.node('observed');
  store.stateValue('observed');
  const fragment = Object.values(store.memory.nodes).find(node => node.kind === 'state_fragment')!;
  // An external graph writer can bypass the TS write union. The read boundary
  // must still verify the fragment, including after a previous successful read.
  await store.commit([{ id: fragment.id, kind: 'state_fragment', component: 'native_state_fragments',
    value: { profile: 'logos-engine.v6.state-graph.v1', node: null } } as unknown as NativeStoreWrite], CAUSE);
  assert.equal(store.node('observed'), root);
  assert.throws(() => store.stateValue('observed'), /digest mismatch/);
});

test('shared frozen rasters still export complete fragments into another store', async () => {
  const rows = Object.freeze(raster().map(row => Object.freeze(row)));
  splitNativeState({ rows }, 'first');
  const graph = splitNativeState({ rows }, 'second');
  const fragments = new Map(graph.fragments.map(fragment => [fragment.id, fragment.value]));
  assert.deepEqual(hydrateNativeState(graph.root, id => fragments.get(id)), { rows });
  const store = new NativeKnowledgeStore('another-source', 'another-store');
  await store.commit([{ id: 'state', kind: 'component_state', component: 'observed', value: { rows } }], CAUSE);
  assert.deepEqual(store.stateValue('state'), { rows });
  let nested: unknown = rows;
  for (let depth = 0; depth < 127; depth += 1) nested = { nested };
  assert.throws(() => splitNativeState(nested, 'too-deep'), /nesting/);
});

test('a frozen raster container does not conceal a mutable row change', () => {
  const rows = Object.freeze(raster());
  splitNativeState({ rows }, 'before');
  rows[0]![0] = 255;
  const graph = splitNativeState({ rows }, 'after');
  const fragments = new Map(graph.fragments.map(fragment => [fragment.id, fragment.value]));
  const retained = hydrateNativeState(graph.root, id => fragments.get(id)) as { rows: number[][] };
  assert.equal(retained.rows[0]![0], 255);
});

for (const Adapter of [GoalAccessAdapter, ProspectiveContactAdapter]) {
  test(`${Adapter.name} native checkpoints share only immutable observation data`, () => {
    const adapter = new Adapter();
    const before = new Snapshot(raster(), { role: [0, 0, 1, 1] }, 1, 0, 'before', 'before-hash');
    const after = new Snapshot(raster(), { role: [1, 0, 1, 1] }, 1, 0, 'after', 'after-hash');
    adapter.memory.episode.push([before, 'ACTION1', after]);
    adapter.memory.last = after;
    adapter.memory.transfers.push({ witness: { retained: true } });
    const native = adapter.nativeState(), publicState = adapter.state();
    assert.deepEqual(native, publicState);
    assert.equal(native.episode[0][0].rows, before.rows);
    assert.equal(native.last.rows, after.rows);
    assert.ok(Object.isFrozen(native.episode[0][0].rows[0]));
    publicState.episode[0][0].rows[0][0] = 255;
    publicState.last.roles.role[0] = 99;
    native.transfers[0].witness.retained = false;
    assert.equal(before.rows[0]![0], 0);
    assert.equal(after.roles.role![0], 1);
    assert.equal(adapter.memory.transfers[0]!.witness.retained, true);
    const restored = new Adapter(); restored.restore(adapter.nativeState());
    assert.deepEqual(restored.state(), adapter.state());
  });
}
