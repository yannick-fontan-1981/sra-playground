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

test('invalid replacement does not promote the old entry or disturb its eviction priority', () => {
  const cache = new BoundedWeakCache<string>(9, 3), a = {}, b = {}, c = {}, d = {};
  cache.set(a, 'a', 3); cache.set(b, 'b', 3); cache.set(c, 'c', 3);
  assert.throws(() => cache.set(a, 'invalid', Infinity), RangeError);
  cache.set(d, 'd', 3);
  assert.equal(cache.get(a), undefined);
  assert.equal(cache.get(b), 'b'); assert.equal(cache.get(c), 'c'); assert.equal(cache.get(d), 'd');
  assert.equal(cache.retainedWeight, 9); assert.equal(cache.entryCount, 3);
});

test('stored undefined still has recency and replacement can evict several older entries', () => {
  const cache = new BoundedWeakCache<string | undefined>(12, 4), a = {}, b = {}, c = {}, d = {};
  cache.set(a, 'a', 3); cache.set(b, undefined, 3); cache.set(c, 'c', 3); cache.set(d, 'd', 3);
  assert.equal(cache.get(b), undefined); // A hit, despite the API's missing-value spelling.
  cache.set(c, 'large', 9);
  assert.equal(cache.get(a), undefined); assert.equal(cache.get(d), undefined);
  assert.equal(cache.get(c), 'large');
  assert.equal(cache.entryCount, 2); assert.equal(cache.retainedWeight, 12);
  cache.set(b, 'too large', 13);
  assert.equal(cache.entryCount, 1); assert.equal(cache.retainedWeight, 9);
  cache.set(c, 'too large', 13);
  assert.equal(cache.entryCount, 0); assert.equal(cache.retainedWeight, 0);
  cache.set(a, 'new single entry', 12);
  for (let index = 0; index < 10_000; index++) assert.equal(cache.get(a), 'new single entry');
  assert.equal(cache.entryCount, 1); assert.equal(cache.retainedWeight, 12);
});

/** Simple ordered-array specification, independent of the cache's data structure. */
class LruSpecification {
  entries: { key: object; value: unknown; weight: number }[] = [];
  readonly maxWeight: number;
  readonly maxEntries: number;
  constructor(maxWeight: number, maxEntries: number) { this.maxWeight = maxWeight; this.maxEntries = maxEntries; }
  get weight(): number { return this.entries.reduce((sum, entry) => sum + entry.weight, 0); }
  get(key: object): unknown {
    const index = this.entries.findIndex(entry => entry.key === key);
    if (index < 0) return undefined;
    const [entry] = this.entries.splice(index, 1); this.entries.push(entry!); return entry!.value;
  }
  set(key: object, value: unknown, weight: number): void {
    this.entries = this.entries.filter(entry => entry.key !== key);
    if (weight > this.maxWeight) return;
    this.entries.push({ key, value, weight });
    while (this.weight > this.maxWeight || this.entries.length > this.maxEntries) this.entries.shift();
  }
}

test('bounded live-key stress matches independent LRU semantics after hits, churn and weighted replacements', () => {
  const keys = Array.from({ length: 73 }, () => ({}));
  const bounds = [[1, 1], [7, 2], [37, 9], [128, 64], [4096, 64]] as const;
  let seed = 0x5a17c0de;
  const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (const [maxWeight, maxEntries] of bounds) {
    const cache = new BoundedWeakCache<unknown>(maxWeight, maxEntries), specification = new LruSpecification(maxWeight, maxEntries);
    for (let index = 0; index < 30_000; index++) {
      const key = keys[next() % keys.length]!;
      if ((next() % 11) < 5) assert.equal(cache.get(key), specification.get(key));
      else {
        const weight = 1 + next() % (Math.min(maxWeight, 80) + 3);
        const value = index % 5 === 0 ? undefined : { revision: index };
        cache.set(key, value, weight); specification.set(key, value, weight);
      }
      assert.equal(cache.retainedWeight, specification.weight);
      assert.equal(cache.entryCount, specification.entries.length);
      assert.ok(cache.retainedWeight <= maxWeight); assert.ok(cache.entryCount <= maxEntries);
      if (index % 997 === 0) for (const key of keys) assert.equal(cache.get(key), specification.get(key));
    }
    for (const key of keys) assert.equal(cache.get(key), specification.get(key));
  }
});
