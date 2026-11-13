/** Accounting nodes contain neither strong keys nor computed values. */
interface CacheEntry {
  readonly key: WeakRef<object>;
  weight: number;
  older: CacheEntry | null;
  newer: CacheEntry | null;
}

/** Disposable computed values; neither cache keys nor old evicted values are retained. */
export class BoundedWeakCache<V> {
  private readonly values = new WeakMap<object, { value: V; entry: CacheEntry }>();
  private oldest: CacheEntry | null = null;
  private newest: CacheEntry | null = null;
  private count = 0;
  private weight = 0;
  readonly maxWeight: number;
  readonly maxEntries: number;

  constructor(maxWeight: number, maxEntries: number) {
    if (!Number.isSafeInteger(maxWeight) || maxWeight < 1 || !Number.isSafeInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError('A computed-value cache requires positive finite bounds');
    }
    this.maxWeight = maxWeight; this.maxEntries = maxEntries;
  }
  get retainedWeight(): number { return this.weight; }
  get entryCount(): number { return this.count; }

  private detach(entry: CacheEntry): void {
    if (entry.older) entry.older.newer = entry.newer;
    else this.oldest = entry.newer;
    if (entry.newer) entry.newer.older = entry.older;
    else this.newest = entry.older;
    entry.older = null; entry.newer = null;
  }

  private append(entry: CacheEntry): void {
    entry.older = this.newest;
    if (this.newest) this.newest.newer = entry;
    else this.oldest = entry;
    this.newest = entry;
  }

  get(key: object): V | undefined {
    const found = this.values.get(key);
    if (!found) return undefined;
    // Hits relink one existing accounting node. They do not allocate tokens or
    // churn an insertion-ordered Map, whose oldest iterator can otherwise scan
    // deleted slots. The list has weak keys only: a dead key still releases its
    // computed value while this conservative accounting node remains queued.
    if (found.entry !== this.newest) { this.detach(found.entry); this.append(found.entry); }
    return found.value;
  }

  set(key: object, value: V, weight: number): void {
    if (!Number.isSafeInteger(weight) || weight < 1) throw new RangeError('Invalid computed-value cache weight');
    const previous = this.values.get(key);
    if (previous) {
      this.weight -= previous.entry.weight; this.count--;
      this.detach(previous.entry); this.values.delete(key);
    }
    // An individual result larger than the entire cache remains a valid
    // computed result; it is simply recomputed if it is requested again.
    if (weight > this.maxWeight) return;
    const entry = previous?.entry ?? { key: new WeakRef(key), weight, older: null, newer: null };
    entry.weight = weight;
    this.values.set(key, { value, entry });
    this.append(entry); this.count++; this.weight += weight;
    while (this.weight > this.maxWeight || this.count > this.maxEntries) {
      const old = this.oldest!;
      this.detach(old); this.count--; this.weight -= old.weight;
      const oldKey = old.key.deref();
      if (oldKey && this.values.get(oldKey)?.entry === old) this.values.delete(oldKey);
    }
  }
}
