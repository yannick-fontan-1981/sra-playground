import assert from 'node:assert/strict';
import test from 'node:test';
import { compareUnicode, immutableJson, isOwnedImmutableJson } from '../src/logos-engine/canonical.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { NATIVE_STATE_GRAPH_PROFILE, hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { JsonObject } from '../src/logos-engine/ir.ts';

const ref = (id: string) => ({ kind: 'ref', id });
const root = (node: unknown, component = 'hydration-contract') => ({ profile: NATIVE_STATE_GRAPH_PROFILE, component, root: node });
function fragment(node: unknown, owned = true) {
  const raw = { profile: NATIVE_STATE_GRAPH_PROFILE, node };
  const value = (owned ? immutableJson(raw) : raw) as JsonObject;
  return { id: `state_fragment:${symbolicDigest(value, false)}`, value };
}
function nested(node: unknown, depth: number): unknown {
  for (let i = 0; i < depth; i++) node = { kind: 'array', items: [node] };
  return node;
}

test('the canonical ownership predicate cannot certify foreign shallow or deep freezes', () => {
  const external = Object.freeze({ rows: Object.freeze([Object.freeze([1, 2])]) });
  assert.equal(isOwnedImmutableJson(external), false);
  assert.equal(isOwnedImmutableJson(Object.freeze({ rows: [[1, 2]] })), false);
  for (const scalar of [null, true, 1, 'literal', undefined]) assert.equal(isOwnedImmutableJson(scalar), false);
  const owned = immutableJson(external);
  assert.equal(isOwnedImmutableJson(owned), true);
  assert.equal(isOwnedImmutableJson(owned.rows), true);
  assert.deepEqual(owned, external);
});

test('a real Kernel state change retains a validated leaf while rebuilding the current root', async () => {
  const rows = Object.freeze(Array.from({ length: 32 }, (_, y) => Object.freeze(Array.from({ length: 32 }, (_, x) => (x + y) % 16))));
  const store = new NativeKnowledgeStore('leaf-hydration-contract', 'leaf-hydration-contract');
  const cause = { workflow: 'test.hydration', step: 'commit', statement: 'retain' };
  const write = { id: 'observed', kind: 'component_state' as const, component: 'observed', value: { rows, revision: 1 } };
  await store.commit([write], cause);
  const first = store.stateValue(write.id) as { rows: readonly (readonly number[])[]; revision: number };
  const oldRoot = store.node(write.id);
  await store.commit([{ ...write, value: { rows, revision: 2 } }], cause);
  const second = store.stateValue(write.id) as typeof first;
  assert.notEqual(store.node(write.id), oldRoot);
  assert.notEqual(second, first);
  assert.equal(second.rows, first.rows, 'unchanged content-addressed raster is decoded once across roots');
  assert.equal(second.revision, 2); assert.equal(first.revision, 1);
  assert.deepEqual(second.rows, rows);
  assert.throws(() => { (second.rows as number[][])[0]![0] = 99; }, TypeError);
});

test('every hydration resolves a retained leaf once per id before reusing it', () => {
  const leaf = fragment({ kind: 'array', items: [17, 23, 'two-roots'] });
  const source = root({ kind: 'array', items: [ref(leaf.id), ref(leaf.id)] });
  const reads: string[] = [];
  const resolve = (id: string) => { reads.push(id); return leaf.value; };
  const first = hydrateNativeState(source, resolve) as readonly unknown[];
  assert.deepEqual(reads, [leaf.id]);
  reads.length = 0;
  const second = hydrateNativeState({ ...source, component: 'another-root' }, resolve) as readonly unknown[];
  assert.deepEqual(reads, [leaf.id]);
  assert.equal(first[0], first[1]); assert.equal(first[0], second[0]); assert.equal(second[0], second[1]);
  assert.notEqual(first, second);
});

test('a retained leaf cannot bypass a resolver rejecting the current fragment authority', () => {
  const leaf = fragment({ kind: 'array', items: ['authority', 41] });
  hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
  assert.throws(() => hydrateNativeState(root(ref(leaf.id)), () => { throw new TypeError('Current fragment has the wrong kind or scope'); }), /wrong kind or scope/);
  assert.throws(() => hydrateNativeState(root(ref(leaf.id)), () => undefined), /digest mismatch|missing/);
});

test('composite fragments keep reading all transitive dependencies across root changes', () => {
  const leaf = fragment({ kind: 'array', items: [53, 'transitive'] });
  const parent = fragment({ kind: 'object', members: { left: ref(leaf.id), right: ref(leaf.id) } });
  const outer = fragment({ kind: 'array', items: [ref(parent.id)] });
  const fragments = new Map([leaf, parent, outer].map(item => [item.id, item.value]));
  const reads: string[] = [];
  const resolve = (id: string) => { reads.push(id); return fragments.get(id); };
  const first = hydrateNativeState(root(ref(outer.id)), resolve) as any;
  assert.deepEqual(reads, [outer.id, parent.id, leaf.id]);
  reads.length = 0;
  const second = hydrateNativeState(root(ref(outer.id), 'changed-root'), resolve) as any;
  assert.deepEqual(reads, [outer.id, parent.id, leaf.id]);
  assert.notEqual(second, first); assert.notEqual(second[0], first[0]);
  assert.equal(second[0].left, first[0].left);
  fragments.delete(leaf.id);
  assert.throws(() => hydrateNativeState(root(ref(outer.id)), resolve), /digest mismatch|missing/);
  fragments.set(leaf.id, fragment({ kind: 'array', items: ['tampered'] }).value);
  assert.throws(() => hydrateNativeState(root(ref(outer.id)), resolve), /digest mismatch/);
});

test('a certificate binds the exact content address as well as the immutable fragment identity', () => {
  const leaf = fragment({ kind: 'array', items: [67, 'identity'] });
  hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
  const wrongId = `state_fragment:${'0'.repeat(64)}`;
  assert.notEqual(wrongId, leaf.id);
  assert.throws(() => hydrateNativeState(root(ref(wrongId)), () => leaf.value), /digest mismatch/);
  const changed = fragment({ kind: 'array', items: [68, 'changed'] });
  assert.throws(() => hydrateNativeState(root(ref(leaf.id)), () => changed.value), /digest mismatch/);
});

test('a mutable or shallow frozen fragment is always revalidated and decoded', () => {
  for (const shallowFreeze of [false, true]) {
    const leaf = fragment({ kind: 'array', items: [79, 'mutable'] }, false);
    if (shallowFreeze) Object.freeze(leaf.value);
    const first = hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
    const second = hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
    assert.notEqual(second, first);
    (leaf.value.node as any).items[0] = 80;
    assert.throws(() => hydrateNativeState(root(ref(leaf.id)), () => leaf.value), /digest mismatch/);
    const revisedId = `state_fragment:${symbolicDigest(leaf.value, false)}`;
    assert.deepEqual(hydrateNativeState(root(ref(revisedId)), () => leaf.value), [80, 'mutable']);
    assert.deepEqual(first, [79, 'mutable']);
  }
});

test('deeply frozen foreign JSON remains outside the owned-fragment cache', () => {
  const value = Object.freeze({ profile: NATIVE_STATE_GRAPH_PROFILE, node: Object.freeze({ kind: 'array', items: Object.freeze([83, 'foreign']) }) });
  const id = `state_fragment:${symbolicDigest(value, false)}`;
  const first = hydrateNativeState(root(ref(id)), () => value);
  const second = hydrateNativeState(root(ref(id)), () => value);
  assert.notEqual(second, first); assert.deepEqual(second, first);
});

test('cross-root reuse reapplies the complete decoded height at the new insertion depth', () => {
  const leaf = fragment(nested(89, 10));
  hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
  assert.doesNotThrow(() => hydrateNativeState(root(nested(ref(leaf.id), 501)), () => leaf.value));
  assert.throws(() => hydrateNativeState(root(nested(ref(leaf.id), 502)), () => leaf.value), /nesting/);
});

test('local repeated references also retain transitive height at a deeper occurrence', () => {
  const leaf = fragment(nested(97, 10));
  const parent = fragment({ kind: 'array', items: [ref(leaf.id)] });
  const fragments = new Map([leaf, parent].map(item => [item.id, item.value]));
  const source = root({ kind: 'array', items: [ref(parent.id), nested(ref(parent.id), 500)] });
  assert.throws(() => hydrateNativeState(source, id => fragments.get(id)), /nesting/);
});

test('cached leaves preserve typed Float64 bits, literal tag keys, Unicode order and null', () => {
  const members = Object.fromEntries([
    ['\u{1D11E}', 'music'], ['\ufffd', 'replacement'], ['signed', { kind: 'float64', bits: '8000000000000000' }],
    ['fraction', { kind: 'float64', bits: '3fc0000000000000' }], ['nothing', null],
    ['literal', { kind: 'object', members: { $v6_float64: 'literal', kind: 'ref', id: 'ordinary data' } }],
    ['__proto__', { kind: 'array', items: [true, 101] }],
  ]);
  const leaf = fragment({ kind: 'object', members });
  const first = hydrateNativeState(root(ref(leaf.id)), () => leaf.value) as any;
  const second = hydrateNativeState(root(ref(leaf.id), 'typed-second-root'), () => leaf.value) as any;
  assert.equal(second, first); assert.ok(Object.is(second.signed, -0)); assert.equal(second.fraction, 0.125);
  assert.equal(second.nothing, null); assert.deepEqual(second.literal, { $v6_float64: 'literal', kind: 'ref', id: 'ordinary data' });
  assert.deepEqual(second.__proto__, [true, 101]); assert.equal(Object.getPrototypeOf(second), Object.prototype);
  assert.deepEqual(Object.keys(second), Object.keys(members).sort(compareUnicode));
});

test('bounded leaf eviction changes only reusable identity, not values or fragment validation', () => {
  const leaves = Array.from({ length: 257 }, (_, i) => fragment({ kind: 'array', items: [i, 'bounded-hydration'] }));
  const firstLeaf = leaves[0]!;
  const first = hydrateNativeState(root(ref(firstLeaf.id)), () => firstLeaf.value);
  assert.equal(hydrateNativeState(root(ref(firstLeaf.id)), () => firstLeaf.value), first);
  for (const leaf of leaves.slice(1)) hydrateNativeState(root(ref(leaf.id)), () => leaf.value);
  const later = hydrateNativeState(root(ref(firstLeaf.id)), () => firstLeaf.value);
  assert.notEqual(later, first); assert.deepEqual(later, first);
  assert.throws(() => hydrateNativeState(root(ref(firstLeaf.id)), () => undefined), /digest mismatch|missing/);
});
