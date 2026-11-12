import type { OperationResult } from './v6-operations.ts';
import { operationCacheKey, type OperationCacheIdentity } from './v6-operation-trace.ts';

export class OperationResultCache {
  readonly #capacity: number;
  readonly #entries = new Map<string, OperationResult>();

  constructor(capacity = 64) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1024) {
      throw new RangeError('Operation cache capacity must be an integer in [1, 1024].');
    }
    this.#capacity = capacity;
  }

  get(identity: OperationCacheIdentity): OperationResult | undefined {
    const key = operationCacheKey(identity);
    const result = this.#entries.get(key);
    if (!result) return undefined;
    this.#entries.delete(key);
    this.#entries.set(key, result);
    return structuredClone(result);
  }

  set(identity: OperationCacheIdentity, result: OperationResult): void {
    const key = operationCacheKey(identity);
    this.#entries.delete(key);
    this.#entries.set(key, structuredClone(result));
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#entries.delete(oldest);
    }
  }

  clear(): void { this.#entries.clear(); }
  get size(): number { return this.#entries.size; }
}
