import assert from 'node:assert/strict';
import test from 'node:test';
import { canonical, compareUnicode, immutableJson } from '../src/logos-engine/canonical.ts';

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
