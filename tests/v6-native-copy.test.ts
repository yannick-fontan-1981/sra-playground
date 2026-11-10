import assert from 'node:assert/strict';
import test from 'node:test';
import { immutableJson } from '../src/logos-engine/canonical.ts';
import { copyNativeValue, retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { hydrateNativeState, splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

function hydrated<T>(value: T): T {
  const split = splitNativeState(value, 'synthetic:copy');
  const fragments = new Map(split.fragments.map(fragment => [fragment.id, fragment.value]));
  return hydrateNativeState(split.root, id => fragments.get(id)) as T;
}

test('trusted detached copies preserve scalar representation, member order and literal special keys', context => {
  const input = Object.fromEntries([
    ['__proto__', { evidence: [-0, 0.5, 1e30, 'é𝄞'] }],
    ['constructor', { toString: 'literal' }], ['later', [true, null, false]],
  ]);
  const values = [immutableJson(input), hydrated(input)];
  for (const value of values) {
    const expected = structuredClone(value);
    const fallback = context.mock.method(globalThis, 'structuredClone', () => { throw new Error('Unexpected generic clone'); });
    let output: any;
    try { output = copyNativeValue(value); } finally { fallback.mock.restore(); }
    assert.deepEqual(output, expected);
    assert.deepEqual(Object.keys(output), Object.keys(value));
    assert.ok(Object.is(output.__proto__.evidence[0], -0));
    assert.ok(Object.hasOwn(output, '__proto__'));
    assert.equal(Object.getPrototypeOf(output), Object.prototype);
    assert.equal(Object.isFrozen(output), false);
    assert.equal(Object.isFrozen(output.__proto__.evidence), false);
    output.__proto__.evidence[1] = 99;
    assert.equal((value as any).__proto__.evidence[1], 0.5);
  }
});

test('copying trusted canonical and hydrated DAGs preserves aliases only within one detached copy', () => {
  const leaf = immutableJson({ evidence: [1, 2] });
  const canonical = immutableJson({ first: leaf, second: [leaf] });
  const rows = Array.from({ length: 24 }, (_, y) => Array.from({ length: 24 }, (_, x) => (x + y) % 16));
  const graph = hydrated({ first: rows, second: [rows] });
  for (const value of [canonical, graph]) {
    assert.equal(value.first, value.second[0]);
    const first = copyNativeValue(value), second = copyNativeValue(value);
    assert.deepEqual(first, structuredClone(value));
    assert.equal(first.first, first.second[0]);
    assert.notEqual(first.first, value.first);
    assert.notEqual(first.first, second.first);
    assert.notEqual(first.second, second.second);
  }
});

test('foreign, shallow-frozen and retained-only objects keep the ordinary clone path', context => {
  const shallow = Object.freeze({ child: { count: 1 } });
  const foreignFrozen = Object.freeze({ rows: Object.freeze([1, 2]) });
  const retained = retainNativeJson({ rows: [1, 2] });
  const nullPrototype = Object.assign(Object.create(null), { value: 1 });
  let reads = 0;
  const accessor = { get value() { reads++; return 7; } };
  let inheritedReads = 0;
  const inherited = Object.assign(Object.create({ get evidence() { inheritedReads++; return 8; } }), { value: 1 });
  const cycle: any = { value: 1 }; cycle.self = cycle;
  const custom = { date: new Date(0), map: new Map([['key', { value: 1 }]]), set: new Set([1, 2]) };
  const original = globalThis.structuredClone;
  const fallback = context.mock.method(globalThis, 'structuredClone', original);
  for (const value of [shallow, foreignFrozen, retained, nullPrototype, accessor, inherited, cycle, custom]) {
    const before = fallback.mock.callCount();
    const output = copyNativeValue(value);
    assert.equal(fallback.mock.callCount(), before + 1);
    assert.notEqual(output, value);
  }
  assert.equal(reads, 1, 'The foreign getter is observed once by structuredClone');
  assert.equal(inheritedReads, 0, 'An inherited getter remains outside structuredClone own-property projection');
  assert.deepEqual(copyNativeValue(inherited), { value: 1 });
  const cycleCopy = copyNativeValue(cycle);
  assert.equal(cycleCopy.self, cycleCopy);
  assert.notEqual(cycleCopy.self, cycle);
});

test('foreign proxies, functions and symbols keep structuredClone rejection', () => {
  const foreign = Object.freeze({ value: 1 });
  for (const value of [new Proxy(foreign, {}), () => 1, Symbol('foreign')]) {
    assert.throws(() => copyNativeValue(value), { name: 'DataCloneError' });
  }
});

test('all cloneable primitive source values remain exact without JSON coercion', () => {
  for (const value of [null, undefined, true, false, 0, -0, 1.25, NaN, Infinity, -Infinity, 17n, '', 'measured', '\ud800']) {
    assert.ok(Object.is(copyNativeValue(value), value));
  }
});

test('retained validation snapshots every parent descriptor before visiting a child', () => {
  const input: any = { child: null, later: 1 };
  input.child = new Proxy({ value: 1 }, { ownKeys(target) { input.later = 2; return Reflect.ownKeys(target); } });
  const value = retainNativeJson(input);
  assert.equal(input.later, 2);
  assert.equal(value.later, 1, 'A child traversal cannot replace a previously captured sibling');
  assert.deepEqual(value.child, { value: 1 });
});

test('retained per-key validation still rejects non-data, hidden, symbolic and decorated members', () => {
  let reads = 0;
  const accessor = { get evidence() { reads++; return 1; } };
  const hidden = Object.defineProperty({}, 'evidence', { value: 1, enumerable: false });
  const decorated = Object.assign([1, 2], { evidence: 1 });
  for (const value of [accessor, hidden, decorated, [1, , 3], { [Symbol('foreign')]: 1 }]) assert.throws(() => retainNativeJson(value));
  assert.equal(reads, 0);
  const leaf = retainNativeJson({ value: 1 });
  let deep: any = leaf;
  for (let index = 0; index < 128; index++) deep = { next: deep };
  assert.throws(() => retainNativeJson(deep), /nesting/);
});

test('retained validation preserves integer-key normalization for valid reordered Proxy descriptors', () => {
  const array = new Proxy([11, 22], { ownKeys: () => ['1', 'length', '0'] });
  assert.deepEqual(retainNativeJson(array), [11, 22]);
  const observed: string[] = [];
  const child = (id: string) => new Proxy({ value: id }, { ownKeys(target) { observed.push(id); return Reflect.ownKeys(target); } });
  const object = new Proxy({ '0': child('first'), '1': child('second'), later: child('last') }, { ownKeys: () => ['later', '1', '0'] });
  assert.deepEqual(retainNativeJson(object), { '0': { value: 'first' }, '1': { value: 'second' }, later: { value: 'last' } });
  assert.equal(observed[0], 'first');
  assert.ok(observed.indexOf('second') > observed.lastIndexOf('first'));
  assert.ok(observed.indexOf('last') > observed.lastIndexOf('second'));
});
