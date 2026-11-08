import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedWeakCache } from '../src/logos-engine/bounded-weak-cache.ts';

test('computed text retention obeys both byte and entry bounds, including replacement and oversized results', () => {
  const cache = new BoundedWeakCache<string>(12, 2), a = {}, b = {}, c = {}, d = {};
  cache.set(a, 'first', 5); cache.set(b, 'second', 5);
  assert.equal(cache.get(a), 'first');
  cache.set(c, 'third', 5);
  assert.equal(cache.get(b), undefined); assert.equal(cache.get(a), 'first'); assert.equal(cache.get(c), 'third');
  assert.equal(cache.retainedWeight, 10); assert.equal(cache.entryCount, 2);
  cache.set(a, 'replacement', 9);
  assert.equal(cache.get(c), undefined); assert.equal(cache.get(a), 'replacement');
  assert.equal(cache.retainedWeight, 9); assert.equal(cache.entryCount, 1);
  cache.set(a, 'too large', 13);
  assert.equal(cache.get(a), undefined); assert.equal(cache.retainedWeight, 0); assert.equal(cache.entryCount, 0);
  for (let i = 0; i < 100; i++) { cache.set(i % 2 ? d : {}, String(i), 4); assert.ok(cache.retainedWeight <= 12); assert.ok(cache.entryCount <= 2); }
});

test('invalid cache accounting cannot silently remove a valid computed value', () => {
  for (const [bytes, count] of [[0, 1], [1, 0], [Infinity, 2], [2, 0.5]]) assert.throws(() => new BoundedWeakCache(bytes!, count!), RangeError);
  const cache = new BoundedWeakCache<string>(10, 2), key = {};
  cache.set(key, 'valid', 4);
  for (const weight of [0, -1, NaN, Infinity, 0.5]) assert.throws(() => cache.set(key, 'bad', weight), RangeError);
  assert.equal(cache.get(key), 'valid'); assert.equal(cache.retainedWeight, 4);
});
