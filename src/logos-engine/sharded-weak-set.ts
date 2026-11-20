/** Retain weak identity membership without growing a single ephemeron table.
 * Every shard is bounded by insertions, so garbage collection cannot make
 * the bound inaccurate. Older still-live identities remain recognizable. */
export class ShardedWeakSet {
  private readonly shards: WeakSet<object>[] = [new WeakSet()];
  private inserts = 0;
  private lastHit = 0;
  private readonly capacity: number;

  constructor(capacity = 262_144) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('Invalid weak identity shard capacity');
    this.capacity = capacity;
  }

  add(value: object): void {
    if (this.inserts === this.capacity) {
      this.shards.push(new WeakSet());
      this.inserts = 0;
    }
    this.shards.at(-1)!.add(value);
    this.inserts++;
  }

  has(value: object): boolean {
    const newest = this.shards.length - 1;
    if (this.shards[newest]!.has(value)) return true;
    if (this.lastHit !== newest && this.shards[this.lastHit]!.has(value)) return true;
    for (let index = newest - 1; index >= 0; index--) {
      if (index !== this.lastHit && this.shards[index]!.has(value)) {
        this.lastHit = index;
        return true;
      }
    }
    return false;
  }
}
