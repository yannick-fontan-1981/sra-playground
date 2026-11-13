import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { immutableJson } from '../src/logos-engine/canonical.ts';
import { sha256Bytes } from '../src/logos-engine/v6-hash.ts';
import { decodeNativeState, encodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isHydratedNativeJson, isNativeStateGraph, splitNativeState, type SplitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

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

test('native state property snapshots precede child traversal', () => {
  const input: Record<string, unknown> = {};
  input.first = new Proxy({ count: 1 }, {
    getPrototypeOf(target) { input.last = 9; return Reflect.getPrototypeOf(target); },
  });
  input.last = 2;
  const graph = splitNativeState(input, 'snapshot');
  assert.equal(input.last, 9);
  assert.deepEqual(restore(graph), { first: { count: 1 }, last: 2 });
});

test('native state snapshots acquire array length descriptors and normalize proxy key order', () => {
  const target = [1, 2], descriptors: PropertyKey[] = [];
  const input = new Proxy(target, {
    ownKeys() { return ['length', '1', '0']; },
    getOwnPropertyDescriptor(array, key) {
      descriptors.push(key);
      if (key === 'length') array[0] = 7;
      return Reflect.getOwnPropertyDescriptor(array, key);
    },
  });
  assert.deepEqual(restore(splitNativeState(input, 'proxy-keys')), [7, 2]);
  assert.deepEqual(descriptors, ['length', '1', '0']);
});

test('native state reuses only private immutable ingress property validation', context => {
  const input = immutableJson({ '\u{10000}': Array.from({ length: 40 }, (_, index) => [index, index / 3, -0]), '\ue000': { observed: true } });
  const trusted = new Set<object>();
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    trusted.add(value); for (const child of Object.values(value)) collect(child);
  };
  collect(input);
  const original = Object.getOwnPropertyDescriptor;
  let trustedReads = 0;
  context.mock.method(Object, 'getOwnPropertyDescriptor', (value: object, key: PropertyKey) => {
    if (trusted.has(value)) trustedReads++;
    return original(value, key);
  });
  const trustedGraph = splitNativeState(input, 'owned', { maxFragmentNodes: 32 });
  assert.equal(trustedReads, 0);
  assert.deepEqual(trustedGraph, splitNativeState(structuredClone(input), 'owned', { maxFragmentNodes: 32 }));
  assert.deepEqual(restore(trustedGraph), input);
  const mutable = { value: 3 }, shallow = Object.freeze({ mutable });
  assert.deepEqual(restore(splitNativeState(shallow, 'foreign')), { mutable: { value: 3 } });
  mutable.value = 4;
  assert.deepEqual(restore(splitNativeState(shallow, 'foreign')), { mutable: { value: 4 } });
});

test('hydration ownership marks only closed decoder outputs, including assembled groups', () => {
  const input = { values: Array.from({ length: 100 }, (_, index) => ({ value: index })),
    members: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`k${index}`, [index, -0]])) };
  const graph = splitNativeState(input, 'hydrated-ownership', { maxFragmentNodes: 32 });
  const restored = restore(graph);
  const check = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    assert.equal(isHydratedNativeJson(value), true);
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) check(child);
  };
  check(restored);
  assert.deepEqual(restored, input);
  for (const unowned of [input, graph.root, graph.fragments[0]!.value, Object.freeze({ child: {} }), immutableJson({ child: [1] }), null, 1]) {
    assert.equal(isHydratedNativeJson(unowned), false);
  }
});

test('raw graph collection methods and species cannot supply a hydration-owned container', () => {
  let callerCalls = 0;
  const foreign = { child: { mutable: true } };
  const items = Object.assign([1, 2], { map() { callerCalls++; return foreign; } });
  const root = (node: unknown) => ({ profile: 'logos-engine.v6.state-graph.v1', component: 'raw', root: node });
  const decoded = hydrateNativeState(root({ kind: 'array', items }), () => undefined);
  assert.deepEqual(decoded, [1, 2]);
  assert.equal(isHydratedNativeJson(decoded), true);
  assert.equal(isHydratedNativeJson(foreign), false);
  assert.equal(Object.isFrozen(foreign), false);
  class CallerArray extends Array {
    static get [Symbol.species]() { callerCalls++; throw new Error('Caller species must not run'); }
  }
  const subclass = new CallerArray(); subclass.push(3, 4);
  const decodedSubclass = hydrateNativeState(root({ kind: 'array', items: subclass }), () => undefined);
  assert.deepEqual(decodedSubclass, [3, 4]);
  assert.equal(Object.getPrototypeOf(decodedSubclass), Array.prototype);
  const parts = Object.assign([{ kind: 'array', items: [5] }, { kind: 'array', items: [6] }], {
    map() { callerCalls++; return [foreign]; },
  });
  assert.deepEqual(hydrateNativeState(root({ kind: 'concat', parts }), () => undefined), [5, 6]);
  assert.throws(() => hydrateNativeState(root({ kind: 'array', items: [, 1] }), () => undefined), /Invalid native state graph node/);
  assert.equal(callerCalls, 0);
});

test('raw hydration snapshots collection length before decoding children', () => {
  const items: unknown[] = [], parts: unknown[] = [];
  items.push(new Proxy({ kind: 'object', members: { value: 1 } }, {
    getPrototypeOf(target) { items.push(9); return Reflect.getPrototypeOf(target); },
  }));
  parts.push(new Proxy({ kind: 'array', items: [2] }, {
    getPrototypeOf(target) { parts.push({ kind: 'array', items: [9] }); return Reflect.getPrototypeOf(target); },
  }));
  const root = (node: unknown) => ({ profile: 'logos-engine.v6.state-graph.v1', component: 'raw', root: node });
  assert.deepEqual(hydrateNativeState(root({ kind: 'array', items }), () => undefined), [{ value: 1 }]);
  assert.deepEqual(hydrateNativeState(root({ kind: 'concat', parts }), () => undefined), [2]);
  assert.equal(items.length, 2); assert.equal(parts.length, 2);
});
