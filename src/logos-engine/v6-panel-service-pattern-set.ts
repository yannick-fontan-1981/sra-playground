/**
 * CPython 3.12 / 64-bit sets of finite nested integer tuples.
 *
 * panel_service_projection.py unions two sets of measured silhouettes. Their
 * iteration order is observable in the service list and the proposal digest.
 * This helper preserves construction, copying and union without supplying a
 * silhouette, palette role or game-specific order. It is independent of the
 * panel grammar and can be extracted when another source needs nested tuples.
 */
import { pointHash } from './v6-point-set.ts';

export type IntegerTuple = readonly (number | IntegerTuple)[];
const MASK64 = (1n << 64n) - 1n, HASH_MODULUS = (1n << 61n) - 1n;
const PRIME1 = 11400714785074694791n, PRIME2 = 14029467366897019727n, PRIME5 = 2870177450012600261n;

export function nestedIntegerTupleHash(tuple: IntegerTuple): bigint {
  if (tuple.length === 2 && typeof tuple[0] === 'number' && typeof tuple[1] === 'number') return pointHash([tuple[0], tuple[1]]);
  let accumulator = PRIME5;
  for (const item of tuple) {
    let lane: bigint;
    if (typeof item === 'number') {
      if (!Number.isSafeInteger(item)) throw new TypeError('Tuple members must be safe integers');
      lane = BigInt(item) % HASH_MODULUS;
      if (lane === -1n) lane = -2n;
    } else lane = nestedIntegerTupleHash(item);
    accumulator = (accumulator + (lane & MASK64) * PRIME2) & MASK64;
    accumulator = ((accumulator << 31n) | (accumulator >> 33n)) & MASK64;
    accumulator = accumulator * PRIME1 & MASK64;
  }
  accumulator = (accumulator + (BigInt(tuple.length) ^ (PRIME5 ^ 3527539n))) & MASK64;
  return accumulator === MASK64 ? 1546275796n : BigInt.asIntN(64, accumulator);
}

type Entry<T> = { value: T; key: string; hash: bigint };

/** Only the source's add/copy/union operations are admitted; no deletion state. */
export class NestedIntegerTupleSet<T extends IntegerTuple> implements Iterable<T> {
  private table: (Entry<T> | null)[] = Array(8).fill(null);
  private used = 0;

  constructor(values: Iterable<T> = []) { this.update(values); }
  get size(): number { return this.used; }
  *[Symbol.iterator](): IterableIterator<T> { for (const entry of this.table) if (entry) yield entry.value; }

  private locate(hash: bigint, key: string): number {
    const mask = this.table.length - 1;
    let perturb = hash & MASK64, index = Number(perturb & BigInt(mask));
    for (;;) {
      const probes = index + 9 <= mask ? 9 : 0;
      for (let step = 0; step <= probes; step++) {
        const slot = index + step, entry = this.table[slot];
        if (!entry || entry.hash === hash && entry.key === key) return slot;
      }
      perturb >>= 5n;
      index = Number((BigInt(index) * 5n + 1n + perturb) & BigInt(mask));
    }
  }

  private clean(entry: Entry<T>): void { this.table[this.locate(entry.hash, entry.key)] = entry; }
  private resize(minimum: number): void {
    let capacity = 8;
    while (capacity <= minimum) capacity *= 2;
    if (capacity === 8 && this.table.length === 8) return;
    const previous = this.table;
    this.table = Array(capacity).fill(null);
    for (const entry of previous) if (entry) this.clean(entry);
  }

  add(value: T): this {
    const hash = nestedIntegerTupleHash(value), key = JSON.stringify(value), slot = this.locate(hash, key);
    if (this.table[slot]) return this;
    this.table[slot] = { value: structuredClone(value), key, hash };
    this.used++;
    if (this.used * 5 >= (this.table.length - 1) * 3) this.resize(this.used > 50_000 ? this.used * 2 : this.used * 4);
    return this;
  }

  update(values: Iterable<T>): this {
    if (!(values instanceof NestedIntegerTupleSet)) { for (const value of values) this.add(value); return this; }
    if (values === this || !values.size) return this;
    if ((this.used + values.size) * 5 >= (this.table.length - 1) * 3) this.resize((this.used + values.size) * 2);
    if (!this.used && this.table.length === values.table.length) {
      this.table = [...values.table]; this.used = values.used; return this;
    }
    if (!this.used) {
      for (const entry of values.table) if (entry) this.clean(entry);
      this.used = values.used; return this;
    }
    for (const value of values) this.add(value);
    return this;
  }

  copy(): NestedIntegerTupleSet<T> { return new NestedIntegerTupleSet(this); }
  union(other: NestedIntegerTupleSet<T>): NestedIntegerTupleSet<T> { return this.copy().update(other); }
}
