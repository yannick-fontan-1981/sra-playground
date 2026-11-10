import assert from 'node:assert/strict';
import test from 'node:test';
import { captureWorkingWitness, matchesWorkingWitness } from '../src/logos-engine/v6-native-working-witness.ts';

test('working witnesses require the same containers and exact scalar values', () => {
  const state = { nested: { value: 0 as unknown } }, witness = captureWorkingWitness(state);
  assert.equal(matchesWorkingWitness(witness, state), true);
  assert.equal(matchesWorkingWitness(witness, structuredClone(state)), false);
  for (const replacement of [false, -0, 1, undefined]) {
    state.nested.value = replacement;
    assert.equal(matchesWorkingWitness(witness, state), false);
  }
  state.nested.value = 0;
  assert.equal(matchesWorkingWitness(witness, state), true);
  state.nested = { value: 0 };
  assert.equal(matchesWorkingWitness(witness, state), false);
});

test('Map keys, values and insertion order remain part of the working witness', () => {
  const key = { role: 'measured' }, value = { observations: 2 };
  const map = new Map<unknown, unknown>([[key, value], ['other', 3]]), witness = captureWorkingWitness(map);
  key.role = 'edited'; assert.equal(matchesWorkingWitness(witness, map), false);
  key.role = 'measured'; value.observations++;
  assert.equal(matchesWorkingWitness(witness, map), false);
  value.observations = 2; assert.equal(matchesWorkingWitness(witness, map), true);
  map.delete(key); map.set(key, value);
  assert.equal(matchesWorkingWitness(witness, map), false);
});

test('Set entries stay observed even when the Set object is frozen', () => {
  const first = { value: 'one' }, second = { value: 'two' };
  const set = Object.freeze(new Set([first, second])), witness = captureWorkingWitness(set);
  first.value = 'changed'; assert.equal(matchesWorkingWitness(witness, set), false);
  first.value = 'one'; assert.equal(matchesWorkingWitness(witness, set), true);
  set.delete(first); set.add(first);
  assert.equal(matchesWorkingWitness(witness, set), false);
});

test('shallow freezing cannot hide mutable descendants behind an identity leaf', () => {
  const child = { value: 1 }, state = Object.freeze({ child });
  const witness = captureWorkingWitness(state);
  child.value = 2; assert.equal(matchesWorkingWitness(witness, state), false);
  const owned = Object.freeze({ child: Object.freeze({ value: 1 }) });
  assert.equal(matchesWorkingWitness(captureWorkingWitness(owned), owned), true);
});

test('replacing a mutable container prototype invalidates its witness', () => {
  for (const value of [{ evidence: [] }, new Map([['row', 1]]), new Set(['observed'])]) {
    const witness = captureWorkingWitness(value), oldPrototype = Object.getPrototypeOf(value);
    Object.setPrototypeOf(value, Object.create(oldPrototype));
    assert.equal(matchesWorkingWitness(witness, value), false);
    Object.setPrototypeOf(value, oldPrototype);
    assert.equal(matchesWorkingWitness(witness, value), true);
  }
});

test('an enumeration change invalidates the witness even when the property value is unchanged', () => {
  const value = { evidence: { known: 3 } }, witness = captureWorkingWitness(value);
  Object.defineProperty(value.evidence, 'known', { enumerable: false });
  assert.deepEqual({ ...value.evidence }, {});
  assert.equal(matchesWorkingWitness(witness, value), false);
  Object.defineProperty(value.evidence, 'known', { enumerable: true });
  assert.equal(matchesWorkingWitness(witness, value), true);
});

test('field substitutions, hidden additions and array holes cannot preserve a working witness', () => {
  const record: Record<PropertyKey, unknown> = { first: 1, second: 2 }, witness = captureWorkingWitness(record);
  delete record.first; record.replacement = 1;
  assert.equal(matchesWorkingWitness(witness, record), false, 'The same number of fields is insufficient');
  delete record.replacement; record.first = 1;
  assert.equal(matchesWorkingWitness(witness, record), false, 'A changed field order is observable');
  const symbolic: Record<PropertyKey, unknown> = { value: 1 }, ordinary = captureWorkingWitness(symbolic);
  delete symbolic.value; symbolic[Symbol('value')] = 1;
  assert.equal(matchesWorkingWitness(ordinary, symbolic), false, 'A symbol cannot replace an ordinary field');
  const hidden = {}, empty = captureWorkingWitness(hidden);
  Object.defineProperty(hidden, 'evidence', { value: 1 });
  assert.equal(matchesWorkingWitness(empty, hidden), false, 'Non-enumerable additions remain observable');
  const sparse = [1, , 3], holes = captureWorkingWitness(sparse);
  sparse[1] = undefined;
  assert.equal(matchesWorkingWitness(holes, sparse), false, 'A missing index differs from an explicit undefined value');
  delete sparse[1]; assert.equal(matchesWorkingWitness(holes, sparse), true);
  sparse.length++;
  assert.equal(matchesWorkingWitness(holes, sparse), false, 'An added hole still changes the array length');
});

test('custom collection iteration never receives a reusable structural certificate', () => {
  let output = 'first', reads = 0;
  for (const collection of [new Map([['kept', 1]]), new Set([1])]) {
    const ordinary = captureWorkingWitness(collection);
    Object.defineProperty(collection, Symbol.iterator, { configurable: true, value: function* () { reads++; yield output; } });
    assert.equal(matchesWorkingWitness(ordinary, collection), false, 'An override added after capture invalidates reuse');
    const customized = captureWorkingWitness(collection);
    assert.equal(reads, 0, 'A structural certificate does not execute an untrusted iterator');
    assert.equal(matchesWorkingWitness(customized, collection), false);
    output = 'later'; assert.equal(matchesWorkingWitness(customized, collection), false);
    delete (collection as any)[Symbol.iterator];
    assert.equal(matchesWorkingWitness(ordinary, collection), true);
    Object.defineProperty(collection, 'metadata', { value: 'custom', configurable: true });
    assert.equal(matchesWorkingWitness(captureWorkingWitness(collection), collection), false);
  }
  class CustomMap extends Map<string, number> {}
  class CustomSet extends Set<number> {}
  for (const collection of [new CustomMap([['kept', 1]]), new CustomSet([1])]) {
    assert.equal(matchesWorkingWitness(captureWorkingWitness(collection), collection), false);
  }
});

test('callable fields and customized array prototypes cannot hide changing projection closures', () => {
  let projected = 1, calls = 0;
  const project = () => { calls++; return [projected]; };
  const values = [1];
  Object.defineProperty(values, 'map', { value: project, configurable: true });
  const state = { values }, witness = captureWorkingWitness(state);
  assert.equal(calls, 0, 'Capture does not execute a callable field');
  projected = 2;
  assert.equal(matchesWorkingWitness(witness, state), false);
  const ownState = { toJSON: project }, ownWitness = captureWorkingWitness(ownState);
  assert.equal(matchesWorkingWitness(ownWitness, ownState), false);
  const inherited = [1];
  Object.setPrototypeOf(inherited, Object.assign(Object.create(Array.prototype), { map: project }));
  assert.equal(matchesWorkingWitness(captureWorkingWitness(inherited), inherited), false);
  assert.equal(calls, 0);
});

test('an inherited iterator invalidates capture and reuse without invoking its getter', () => {
  let reads = 0;
  const prototype = {}, value = Object.assign(Object.create(prototype), { evidence: 1 });
  const ordinary = captureWorkingWitness(value);
  assert.equal(matchesWorkingWitness(ordinary, value), true);
  Object.defineProperty(prototype, Symbol.iterator, { configurable: true, get: () => {
    reads++; return function* () { yield value.evidence; };
  } });
  assert.equal(matchesWorkingWitness(ordinary, value), false, 'An inherited iterator added later invalidates the witness');
  assert.equal(matchesWorkingWitness(captureWorkingWitness(value), value), false,
    'An initially iterable ordinary object cannot certify a hidden closure');
  assert.equal(reads, 0, 'Presence checks never execute an inherited iterator getter');
});

test('unsupported structure does not execute getters or silently certify cycles and symbols', () => {
  let reads = 0;
  const accessed = Object.defineProperty({}, 'value', { enumerable: true, get: () => { reads++; return 1; } });
  assert.throws(() => captureWorkingWitness(accessed), /Accessor/);
  assert.equal(reads, 0);
  const value = { value: 1 }, witness = captureWorkingWitness(value);
  Object.defineProperty(value, 'value', { enumerable: true, get: () => { reads++; return 1; } });
  assert.equal(matchesWorkingWitness(witness, value), false); assert.equal(reads, 0);
  const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
  assert.throws(() => captureWorkingWitness(cyclic), /Cyclic/);
  assert.throws(() => captureWorkingWitness({ [Symbol('unobserved')]: 1 }), /Symbolic/);
});
