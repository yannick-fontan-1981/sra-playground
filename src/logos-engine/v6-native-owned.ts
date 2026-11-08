/** Validated immutable JSON ownership for internal, incremental native state. */
import { assertUnicode, isJsonObject } from './canonical.ts';

// A cached subtree has passed the full property/type check and cannot change.
// Store its height so insertion deeper in another object cannot bypass limits.
const retained = new WeakMap<object, number>();

/**
 * Own mutable inputs, share only deeply immutable validated subtrees. This is
 * internal to native persistence; public source-compatible APIs still clone.
 * There is no aggregate size cap: the state graph fragments large histories.
 */
export function retainNativeJson<T>(value: T): T {
  const ancestors = new WeakSet<object>();
  function visit(input: unknown, depth: number): { value: unknown; height: number; shared: boolean } {
    if (depth > 128) throw new TypeError('Native retained state nesting exceeds its contract');
    if (input === null || typeof input === 'boolean') return { value: input, height: 0, shared: true };
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new TypeError('Native retained numbers must be finite');
      return { value: input, height: 0, shared: true };
    }
    if (typeof input === 'string') { assertUnicode(input); return { value: input, height: 0, shared: true }; }
    if (typeof input !== 'object') throw new TypeError('Native retained state requires explicit JSON values');
    const known = retained.get(input);
    if (known !== undefined) {
      if (depth + known > 128) throw new TypeError('Native retained state nesting exceeds its contract');
      return { value: input, height: known, shared: true };
    }
    const array = Array.isArray(input);
    if ((!array && !isJsonObject(input)) || Object.getOwnPropertySymbols(input).length) throw new TypeError('Native retained state requires plain JSON objects');
    if (ancestors.has(input)) throw new TypeError('Cyclic native retained state');
    ancestors.add(input);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      const names = Object.keys(descriptors).filter(key => !array || key !== 'length');
      if (array && (names.length !== input.length || names.some((key, i) => key !== String(i)))) throw new TypeError('Sparse or decorated native arrays are unsupported');
      let height = 0, shared = Object.isFrozen(input);
      const entries = names.map(key => {
        assertUnicode(key); const descriptor = descriptors[key]!;
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Native retained state requires enumerable data properties');
        const child = visit(descriptor.value, depth + 1);
        height = Math.max(height, child.height + 1); shared &&= child.shared;
        return [key, child.value] as const;
      });
      const result = shared ? input : Object.freeze(array ? entries.map(([, item]) => item) : Object.fromEntries(entries));
      retained.set(result, height);
      return { value: result, height, shared };
    } finally { ancestors.delete(input); }
  }
  return visit(value, 0).value as T;
}
