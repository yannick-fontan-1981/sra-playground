import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, compareUnicode, immutableJson } from '../src/logos-engine/canonical.ts';
import { digest } from '../src/logos-engine/canonical.ts';

test('canonical reuse sees changed mutable descendants of shallowly frozen parents', () => {
  const member = { count: 1 }, shallow = Object.freeze({ member });
  assert.equal(canonical(shallow), '{"member":{"count":1}}');
  member.count = 2;
  assert.equal(canonical(shallow), '{"member":{"count":2}}');
  Object.freeze(member);
  assert.equal(canonical(shallow), '{"member":{"count":2}}');
  assert.equal(canonical(shallow), '{"member":{"count":2}}');
});

test('cached immutable subtrees still count toward the full structural size limit', () => {
  const block = immutableJson(Array<number>(1000).fill(7));
  canonical(block);
  assert.doesNotThrow(() => canonical(Array(999).fill(block)));
  assert.throws(() => canonical(Array(1000).fill(block)), /size\/nesting/);
});

test('cached immutable subtrees retain their actual nesting depth', () => {
  let subtree: any = 1;
  for (let depth = 0; depth < 128; depth++) subtree = Object.freeze([subtree]);
  assert.doesNotThrow(() => canonical(subtree));
  assert.throws(() => canonical(Object.freeze([subtree])), /size\/nesting/);
  assert.doesNotThrow(() => canonical({ small: immutableJson([1, 2]) }));
});

test('cached scalars and tree encodings preserve Python Unicode code-point order', () => {
  const names = ['a', 'z', 'é', '漢', '\ue000', '\u{10000}', '\u{1f600}', 'a\u{10000}', 'a\ue000'];
  const expected = [...names].sort((a, b) => {
    const x = [...a].map(c => c.codePointAt(0)!), y = [...b].map(c => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
    return x.length - y.length;
  });
  assert.deepEqual([...names].sort(compareUnicode), expected);
  const value = immutableJson(Object.fromEntries(names.map((name, index) => [name, index])));
  assert.equal(canonical(value), canonical(structuredClone(value)));
  assert.equal(canonical(value), canonical(value));
});

test('frozen accessor objects, symbols and sparse arrays are never cached as valid JSON', () => {
  let calls = 0;
  const accessor = Object.freeze({ get field() { calls++; return 1; } });
  for (const input of [accessor, Object.freeze({ [Symbol('secret')]: 1 }), Object.freeze([, 1])]) {
    assert.throws(() => canonical(input)); assert.throws(() => canonical(input));
  }
  assert.equal(calls, 0);
});

test('new canonical encodings reuse validated ingress properties without repeating descriptor acquisition', context => {
  const raw = { '\u{10000}': [{ count: 7, label: 'observed' }, { count: 8, label: 'retained' }], '\ue000': [true, null] };
  const owned = immutableJson(raw);
  const trusted = new Set<object>();
  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    trusted.add(value); for (const child of Object.values(value)) collect(child);
  };
  collect(owned);
  let trustedDescriptors = 0, externalDescriptors = 0;
  const original = Object.getOwnPropertyDescriptors;
  context.mock.method(Object, 'getOwnPropertyDescriptors', (value: object) => {
    if (trusted.has(value)) trustedDescriptors++; else externalDescriptors++;
    return original(value);
  });
  // owned is newly created and has never entered the canonical text cache.
  assert.equal(canonical(owned), canonical(raw));
  assert.equal(trustedDescriptors, 0, 'Only this private, already validated ingress identity may skip descriptors');
  assert.ok(externalDescriptors > 0, 'Caller-created objects still acquire their own property descriptors');
  assert.ok([...trusted].every(value => Object.isFrozen(value)));
});

test('foreign frozen trees and mutable descendants are not promoted to trusted ingress identities', context => {
  const member = { value: 1 }, shallow = Object.freeze({ member });
  const foreignMember = Object.freeze({ value: 2 }), foreign = Object.freeze([foreignMember]);
  const watched = new Set<object>([shallow, member, foreign, foreignMember]);
  const seen = new Set<object>(), original = Object.getOwnPropertyDescriptors;
  context.mock.method(Object, 'getOwnPropertyDescriptors', (value: object) => {
    if (watched.has(value)) seen.add(value);
    return original(value);
  });
  assert.equal(canonical(shallow), '{"member":{"value":1}}');
  assert.equal(canonical(foreign), '[{"value":2}]');
  assert.deepEqual(seen, watched);
  let reads = 0;
  Object.defineProperty(member, 'value', { enumerable: true, get: () => { reads++; return 3; } });
  assert.throws(() => canonical(shallow), /enumerable data properties/);
  assert.equal(reads, 0, 'A shallow freeze cannot authorize invoking a changed accessor');
});

test('trusted ingress preserves metadata numbers but canonical still enforces the portable scalar domain', () => {
  for (const value of [0.5, -0, Number.MAX_SAFE_INTEGER + 1]) {
    const owned = immutableJson({ nested: [value] });
    assert.ok(Object.is(owned.nested[0], value));
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.throws(() => canonical(owned), /safe integers, without negative zero/);
    }
  }
  const raw = Object.assign(Object.create(null), { '10': 1, '2': 2, '\u{10000}': 3, '\ue000': 4 });
  Object.defineProperty(raw, '__proto__', { value: { witnessed: true }, enumerable: true });
  const owned = immutableJson(raw);
  assert.equal(Object.getPrototypeOf(owned), Object.prototype);
  assert.equal(canonical(owned), canonical(raw));
  assert.equal(canonical(owned), '{"10":1,"2":2,"__proto__":{"witnessed":true},"":4,"𐀀":3}');
});

test('evicted historical encodings preserve canonical bytes, hashes and warmed structural limits', async () => {
  const first = immutableJson({ '\u{10000}': [1, true], '\ue000': { revision: 1, text: 'retained evidence' } });
  const expected = canonical(first), hash = await digest(first), retained: unknown[] = [];
  // Keep keys live, as the revision journal does. Weak references alone cannot
  // release these cached strings; this crosses both configured cache bounds.
  for (let i = 0; i < 4200; i++) {
    const value = immutableJson({ index: i, text: String(i).padStart(6, '0') + 'é'.repeat(2200) });
    retained.push(value); canonical(value);
  }
  assert.equal(retained.length, 4200);
  assert.equal(canonical(first), expected); assert.equal(await digest(first), hash);
  const block = immutableJson(Array<number>(1000).fill(7)); canonical(block);
  assert.throws(() => canonical(Array(1000).fill(block)), /size\/nesting/);
  let subtree: any = 1;
  for (let depth = 0; depth < 128; depth++) subtree = Object.freeze([subtree]);
  canonical(subtree); assert.throws(() => canonical(Object.freeze([subtree])), /size\/nesting/);
});
