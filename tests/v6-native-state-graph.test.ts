import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { immutableJson } from '../src/logos-engine/canonical.ts';
import { sha256Bytes } from '../src/logos-engine/v6-hash.ts';
import { decodeNativeState, encodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph, splitNativeState, type SplitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

function restore(graph: SplitNativeState) {
  const fragments = new Map(graph.fragments.map(fragment => [fragment.id, decodeNativeState(encodeNativeState(fragment.value))]));
  return hydrateNativeState(decodeNativeState(encodeNativeState(graph.root)), id => fragments.get(id));
}
function nodes(value: unknown): number {
  return 1 + (Array.isArray(value) ? value.reduce((sum, item) => sum + nodes(item), 0) : value && typeof value === 'object' ? Object.values(value).reduce<number>((sum, item) => sum + nodes(item), 0) : 0);
}

test('native SHA-256 matches the standard at padding, block and multi-block boundaries', () => {
  for (const size of [0, 1, 55, 56, 63, 64, 65, 127, 1024, 4096, 100_000]) {
    const bytes = Uint8Array.from({ length: size }, (_, index) => (index * 137 + 23) % 256);
    assert.equal(sha256Bytes(bytes), createHash('sha256').update(bytes).digest('hex'), `length ${size}`);
  }
});

test('large full episodes exceed a single V7 value while lossless bounded fragments restore every observation', () => {
  const frame = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => (x + y) % 16));
  const episode = { snapshots: Array.from({ length: 300 }, (_, index) => ({ index, rows: frame, score: index / 7, action: { action_ref: 'ACTION1', data: {} } })) };
  assert.ok(nodes(episode) > 1_000_000);
  assert.throws(() => immutableJson(episode), /size\/nesting/);
  const graph = splitNativeState(episode, 'goal_access');
  assert.ok(isNativeStateGraph(graph.root));
  assert.ok(graph.fragments.length > 0 && graph.fragments.length < 20);
  for (const value of [graph.root, ...graph.fragments.map(fragment => fragment.value)]) assert.ok(nodes(value) <= 8192);
  const result = restore(graph) as typeof episode;
  assert.deepEqual(result, episode);
  assert.equal(result.snapshots.length, 300);
  assert.equal(result.snapshots[299]!.rows[63]![63], 14);
  assert.equal(result.snapshots[0]!.rows, result.snapshots[299]!.rows, 'identical immutable matrices are shared');
  assert.ok(Object.isFrozen(result.snapshots[299]!.rows[0]));
});

test('fragment identity is stable across component roots and a new episode keeps previous frame identities', () => {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(3));
  const left = splitNativeState({ observations: [rows] }, 'a');
  const right = splitNativeState({ observations: [rows, rows] }, 'b');
  assert.deepEqual(left.fragments, right.fragments);
  assert.notDeepEqual(left.root, right.root);
  assert.deepEqual(restore(right), { observations: [rows, rows] });
});

test('typed reference envelopes preserve reserved user fields, Unicode and Float64 bits', () => {
  const value = { kind: 'ref', id: `state_fragment:${'f'.repeat(64)}`, profile: 'logos-engine.v6.state-graph.v1',
    root: { kind: 'concat', parts: [{ kind: 'float64', bits: 'literal' }] },
    floats: [0.1, -0, Number.MIN_VALUE, Number.MAX_VALUE, 2 ** 60],
    '🙂': 'é漢字', literal: JSON.parse('{"__proto__":{"kind":"ref"},"$v6_float64":"literal"}') };
  const decoded = restore(splitNativeState(value, 'untrusted-input', { maxFragmentNodes: 32 })) as typeof value;
  assert.deepEqual(decoded, value);
  assert.ok(Object.is(decoded.floats[1], -0));
  assert.ok(Object.hasOwn(decoded.literal, '__proto__'));
  assert.equal(Object.getPrototypeOf(decoded.literal), Object.prototype);
});

test('oversized flat arrays and objects bound the reference fanout without dropping or reordering entries', () => {
  const input = { list: Array.from({ length: 4000 }, (_, i) => i), members: Object.fromEntries(Array.from({ length: 4000 }, (_, i) => [`k${i}`, i])) };
  const graph = splitNativeState(input, 'large-flat', { maxFragmentNodes: 32 });
  for (const value of [graph.root, ...graph.fragments.map(fragment => fragment.value)]) assert.ok(nodes(value) <= 32, `node count ${nodes(value)}`);
  assert.deepEqual(restore(graph), input);
});

test('missing and tampered persisted fragments cannot be hydrated', () => {
  const graph = splitNativeState(Array.from({ length: 100 }, (_, i) => i), 'integrity', { maxFragmentNodes: 32 });
  assert.throws(() => hydrateNativeState(graph.root, () => undefined), /digest mismatch|missing/);
  const fragments = new Map(graph.fragments.map(fragment => [fragment.id, fragment.value]));
  assert.throws(() => hydrateNativeState(graph.root, id => ({ ...fragments.get(id), node: null })), /digest mismatch/);
  assert.throws(() => hydrateNativeState({ ...graph.root, injected: true }, id => fragments.get(id)), /root/);
});

test('unsupported native values are rejected without invoking getters or accepting cycles', () => {
  const cyclic: unknown[] = []; cyclic.push(cyclic);
  let getterCalled = false;
  const accessor = { get data() { getterCalled = true; return 1; } };
  const decorated: unknown[] & { extra?: number } = [1]; decorated.extra = 2;
  for (const input of [undefined, NaN, Infinity, () => 1, 1n, new Date(), cyclic, accessor, [1, , 3], decorated, { [Symbol('x')]: 1 }]) {
    assert.throws(() => splitNativeState(input, 'invalid'));
  }
  assert.equal(getterCalled, false);
  for (const maxFragmentNodes of [0, 31, 1.5, 65_537]) assert.throws(() => splitNativeState({}, 'invalid', { maxFragmentNodes }), /bound/);
});
