import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeStoreWrite } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { GoalAccessAdapter } from '../src/logos-engine/v6-goal-access.ts';
import { ProspectiveContactAdapter } from '../src/logos-engine/v6-prospective-contact.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { immutableJson } from '../src/logos-engine/canonical.ts';
import type { KnowledgeMemory } from '../src/logos-engine/kernel.ts';

const CAUSE = { workflow: 'test.native.persistence', step: 'write', statement: 'retain' };
const raster = () => Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => (x + y) % 16));

test('unchanged encoded subtrees stay shared across real historical commits with the same canonical chains', async () => {
  const branch = retainNativeJson(Array.from({ length: 60 }, (_, i) => ({ occurrence: i, evidence: ['frame:a', 'frame:b'], condition: { x: i, y: 3 } })));
  const store = new NativeKnowledgeStore('delta-owned-ast-test', 'delta-owned-ast-test');
  const write = { id: 'state:shared', kind: 'component_state' as const, component: 'shared', value: { branch, revision: 1 } };
  await store.commit([write], CAUSE);
  const before = store.memory, first = before.nodes[write.id]!.value as any;
  await store.commit([{ ...write, value: { branch, revision: 2 } }], CAUSE);
  const second = store.node(write.id).value as any;
  assert.equal(first.root.members.branch, second.root.members.branch, 'the V7 boundary preserves the immutable AST identity');
  assert.notEqual(first, second);
  // Captured from the same two writes before owning AST nodes at construction.
  assert.equal(before.chain, 'b41a96157b298fb37362c27044e29fa66440502865b498567ce8a0221a8915e2');
  assert.equal(store.graphChain, '86ad3dce38d20dd7f0812d97701191bfc8ab1ee953402a642688338fc9f21671');
  assert.equal(store.revision, 2); assert.equal(store.nodeCount, 1);
  assert.equal(store.memory.deltas[0], before.deltas[0]);
  assert.deepEqual(hydrateNativeState(first, () => undefined), { branch, revision: 1 });
  assert.deepEqual(store.stateValue(write.id), { branch, revision: 2 });
  assert.throws(() => { first.root.members.branch.items[0].members.occurrence = 99; }, TypeError);
});

test('owned encoded children do not bypass complete canonical nesting validation or publish partial writes', async () => {
  const store = new NativeKnowledgeStore('bounded-ast-test', 'bounded-ast-test');
  await store.commit([{ id: 'safe', kind: 'component_state', component: 'bounded', value: { retained: true } }], CAUSE);
  const before = store.memory;
  let deep: unknown = 1;
  for (let i = 0; i < 70; i++) deep = Object.freeze([deep]);
  // Raw depth is valid, but the explicit typed AST is too deeply nested for
  // one V7 payload; even a warmed encoder must not bypass the final boundary.
  splitNativeState(deep, 'too-deep');
  await assert.rejects(store.commit([{ id: 'invalid', kind: 'component_state', component: 'bounded', value: deep }], CAUSE), /size\/nesting/);
  assert.equal(store.memory, before); assert.deepEqual(store.stateValue('safe'), { retained: true });
});

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

test('metadata-only revisions retain exact chains and one immutable hydration without losing evidence', async () => {
  const store = new NativeKnowledgeStore('metadata-payload-identity', 'metadata-payload-identity');
  const write = { id: 'state:metadata', kind: 'component_state' as const, component: 'metadata',
    value: { rows: raster(), count: 2, fraction: 0.125, negative: -0, literal: { $v6_float64: 'literal' } } };
  await store.commit([write], CAUSE);
  const first = store.memory, root = store.node(write.id), value = store.stateValue(write.id);
  await store.commit([{ ...write, value: structuredClone(write.value), evidence: ['prefix:1'],
    relations: [{ relation: 'observes', target: 'observed:1' }], status: 'observed' }], CAUSE);
  const updated = store.node(write.id);
  assert.notEqual(updated, root); assert.equal(updated.revision, 2);
  assert.deepEqual(updated.evidence, ['prefix:1']);
  assert.deepEqual(updated.relations, [{ relation: 'observes', target: 'observed:1' }]);
  assert.equal(updated.status, 'observed');
  assert.equal(updated.value, root.value, 'Only the canonical payload is shared, not the revised node');
  assert.equal(store.stateValue(write.id), value, 'Metadata alone does not force decoding the same immutable payload');
  assert.deepEqual(value, write.value); assert.ok(Object.is((value as any).negative, -0));
  assert.equal(store.revision, 3); assert.equal(store.nodeCount, 2);
  assert.equal(store.memory.deltas[0], first.deltas[0]);
  // Captured from these same writes on published V63 before this optimization.
  assert.equal(first.chain, '8f132ff7d6a1c13c0659153c3f95fcb9c4feade76164da9e7485f77802ab13ec');
  assert.equal(store.graphChain, '4bb15e06ec0058cd6564941d22029b507784ff7b9c7ce33fd4e6bff90d0ec78a');
  const working = structuredClone(value) as typeof write.value;
  working.rows[0]![0] = 255; working.count = 99; working.negative = 0;
  assert.equal(store.stateValue(write.id), value); assert.equal((value as any).rows[0][0], 0);
  assert.ok(Object.is((value as any).negative, -0));
});

test('changed payloads, including Float64 bits and mutable inputs, invalidate metadata-only sharing', async () => {
  const store = new NativeKnowledgeStore('changed-payload', 'changed-payload');
  const input = { rows: raster(), fraction: 0.125, signed: -0 };
  const write = { id: 'observed', kind: 'component_state' as const, component: 'observed', value: input };
  await store.commit([write], CAUSE);
  const original = store.stateValue(write.id), root = store.node(write.id);
  input.rows[0]![0] = 255; input.fraction = 0.25; input.signed = 0;
  await store.commit([{ ...write, evidence: ['prefix:2'] }], CAUSE);
  const changed = store.stateValue(write.id) as typeof input;
  assert.notEqual(store.node(write.id).value, root.value); assert.notEqual(changed, original);
  assert.equal(changed.rows[0]![0], 255); assert.equal(changed.fraction, 0.25);
  assert.ok(Object.is(changed.signed, 0)); assert.ok(!Object.is(changed.signed, -0));
  assert.equal((original as any).rows[0][0], 0); assert.ok(Object.is((original as any).signed, -0));
});

test('a failed metadata transaction leaves its node, cache and subsequent exact write intact', async () => {
  const store = new NativeKnowledgeStore('metadata-rollback', 'metadata-rollback');
  const write = { id: 'observed', kind: 'component_state' as const, component: 'observed', value: { rows: raster(), score: 0 } };
  await store.commit([write], CAUSE);
  const before = store.memory, root = store.node(write.id), value = store.stateValue(write.id);
  await assert.rejects(store.commit([{ ...write, evidence: ['uncommitted'] },
    { id: 'invalid', kind: 'family_state', value: {} }], CAUSE), /Logos contract/);
  assert.equal(store.memory, before); assert.equal(store.node(write.id), root); assert.equal(store.stateValue(write.id), value);
  await store.commit([{ ...write, evidence: ['committed'] }], CAUSE);
  assert.deepEqual(store.node(write.id).evidence, ['committed']);
  assert.equal(store.node(write.id).revision, root.revision + 1);
  assert.equal(store.stateValue(write.id), value);
});

for (const fault of ['changed', 'profile', 'kind', 'missing'] as const) {
  test(`metadata-only hydration still rejects a ${fault} fragment under an unchanged root`, async () => {
    const store = new NativeKnowledgeStore(`metadata-fragment-${fault}`, `metadata-fragment-${fault}`);
    // Distinct rasters force two read dependencies, so checking only the first
    // fragment would incorrectly allow a stale hydration of the second one.
    const second = raster(); second[0]![0] = 255;
    const write = { id: 'observed', kind: 'component_state' as const, component: 'observed', value: { first: raster(), second } };
    await store.commit([write], CAUSE);
    const value = store.stateValue(write.id);
    await store.commit([{ ...write, evidence: ['prefix:1'] }], CAUSE);
    const root = store.node(write.id); assert.equal(store.stateValue(write.id), value);
    const fragments = Object.values(store.memory.nodes).filter(node => node.kind === 'state_fragment');
    assert.equal(fragments.length, 2);
    const fragment = fragments[1]!;
    if (fault === 'changed' || fault === 'profile') {
      await store.commit([{ id: fragment.id, kind: 'state_fragment', component: 'native_state_fragments',
        value: { profile: fault === 'profile' ? 'invalid-profile' : 'logos-engine.v6.state-graph.v1', node: null } } as unknown as NativeStoreWrite], CAUSE);
    } else {
      // Fault injection at the persisted graph boundary. Ordinary store writes
      // already forbid kind replacement and provide no node deletion API.
      const nodes = { ...store.memory.nodes };
      if (fault === 'missing') delete nodes[fragment.id];
      else nodes[fragment.id] = immutableJson({ ...fragment, kind: 'component_state' }) as typeof fragment;
      (store as unknown as { state: KnowledgeMemory }).state = immutableJson({ ...store.memory, nodes }) as KnowledgeMemory;
    }
    assert.equal(store.node(write.id), root);
    assert.throws(() => store.stateValue(write.id), fault === 'kind' ? /must bind a state fragment/
      : fault === 'missing' ? /Unknown native store node/ : /digest mismatch/);
  });
}

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
