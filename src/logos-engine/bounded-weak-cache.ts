/** Disposable computed values; neither cache keys nor old evicted values are retained. */
export class BoundedWeakCache<V> {
  private readonly values = new WeakMap<object, { value: V; token: object }>();
  private readonly order = new Map<object, { key: WeakRef<object>; weight: number }>();
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
  get entryCount(): number { return this.order.size; }

  get(key: object): V | undefined {
    const found = this.values.get(key);
    if (!found) return undefined;
    // The ordering table contains only weak keys and integer weights. In
    // particular it must not contain the computed value: a dead key releases
    // its value even while this conservative accounting entry remains queued.
    const accounting = this.order.get(found.token)!;
    this.order.delete(found.token); this.order.set(found.token, accounting);
    return found.value;
  }

  set(key: object, value: V, weight: number): void {
    if (!Number.isSafeInteger(weight) || weight < 1) throw new RangeError('Invalid computed-value cache weight');
    const previous = this.values.get(key);
    if (previous) {
      this.weight -= this.order.get(previous.token)!.weight;
      this.order.delete(previous.token); this.values.delete(key);
    }
    // An individual result larger than the entire cache remains a valid
    // computed result; it is simply recomputed if it is requested again.
    if (weight > this.maxWeight) return;
    const token = {};
    this.values.set(key, { value, token });
    this.order.set(token, { key: new WeakRef(key), weight }); this.weight += weight;
    while (this.weight > this.maxWeight || this.order.size > this.maxEntries) {
      const [oldToken, old] = this.order.entries().next().value!;
      this.order.delete(oldToken); this.weight -= old.weight;
      const oldKey = old.key.deref();
      if (oldKey && this.values.get(oldKey)?.token === oldToken) this.values.delete(oldKey);
    }
  }
}
