/** Validated immutable JSON ownership for internal, incremental native state. */
import { assertUnicode, isJsonObject, isOwnedImmutableJson } from './canonical.ts';
import { isHydratedNativeJson } from './v6-native-state-graph.ts';

// A cached subtree has passed the full property/type check and cannot change.
// Store its height so insertion deeper in another object cannot bypass limits.
const retained = new WeakMap<object, number>();

function propertyIndex(name: string): number | null {
  const index = Number(name);
  return Number.isInteger(index) && index >= 0 && index < 0xffff_ffff && String(index) === name ? index : null;
}

/** The old descriptor record normalized integer property names even when a
 * Proxy reported a different own-key order. Preserve that order after taking
 * every descriptor, without creating the large intermediary record. */
function normalizeDescriptorOrder(fields: [string, PropertyDescriptor][]): void {
  let previous = -1, stringSeen = false;
  for (const [name] of fields) {
    const index = propertyIndex(name);
    if (index === null) stringSeen = true;
    else {
      if (stringSeen || index < previous) {
        fields.sort(([a], [b]) => {
          const ai = propertyIndex(a), bi = propertyIndex(b);
          return ai === null ? bi === null ? 0 : 1 : bi === null ? -1 : ai - bi;
        });
        return;
      }
      previous = index;
    }
  }
}

/** Detach an internally constructed JSON tree without the structured-clone
 * transport machinery. Only canonical ingress and validated graph hydration
 * can certify this path: Object.freeze and a prior retained-input validation
 * do not certify a foreign object. Keep the ordinary clone behavior for every
 * other object, including accessors, custom collections, proxies and cycles.
 * A per-copy map preserves repeated references just as structuredClone does;
 * no mutable result is retained or shared with another caller. */
export function copyNativeValue<T>(value: T): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function' && typeof value !== 'symbol')) return value;
  if (!isOwnedImmutableJson(value) && !isHydratedNativeJson(value)) return structuredClone(value);
  const copied = new Map<object, unknown>();
  function copy(input: any): any {
    if (input === null || typeof input !== 'object') return input;
    if (copied.has(input)) return copied.get(input);
    let result: any;
    if (Array.isArray(input)) {
      result = new Array(input.length);
      for (let index = 0; index < input.length; index++) result[index] = copy(input[index]);
    } else {
      // fromEntries creates own data properties, including a literal __proto__.
      const entries: [string, unknown][] = [];
      for (const key of Object.keys(input)) entries.push([key, copy(input[key])]);
      result = Object.fromEntries(entries);
    }
    copied.set(input, result);
    return result;
  }
  return copy(value) as T;
}

/**
 * Own mutable inputs, share only deeply immutable validated subtrees. This is
 * internal to native persistence; public source-compatible APIs still clone.
 * There is no aggregate size cap: the state graph fragments large histories.
 */
export function retainNativeJson<T>(value: T, previous?: T): T {
  // At the root, a retained value has already passed the complete depth and
  // property contract. Descendant reuse below still checks its stored height
  // against the insertion depth before accepting an existing immutable tree.
  if (previous === undefined && value !== null && typeof value === 'object' && retained.has(value)) return value;
  const ancestors = new WeakSet<object>();
  function visit(input: unknown, depth: number, previous?: unknown): { value: unknown; height: number; shared: boolean } {
    if (depth > 128) throw new TypeError('Native retained state nesting exceeds its contract');
    if (input === null || typeof input === 'boolean') return { value: input, height: 0, shared: true };
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new TypeError('Native retained numbers must be finite');
      return { value: input, height: 0, shared: true };
    }
    if (typeof input === 'string') { assertUnicode(input); return { value: input, height: 0, shared: true }; }
    if (typeof input !== 'object') throw new TypeError('Native retained state requires explicit JSON values');
    const array = Array.isArray(input);
    const prior = previous !== null && typeof previous === 'object' && retained.has(previous)
      && Array.isArray(previous) === array
      && Object.getPrototypeOf(previous) === (array ? Array.prototype : Object.prototype)
      ? previous as Record<string, unknown> : undefined;
    const known = retained.get(input);
    if (known !== undefined) {
      if (depth + known > 128) throw new TypeError('Native retained state nesting exceeds its contract');
      if (!prior || prior === input) return { value: input, height: known, shared: true };
    }
    if ((!array && !isJsonObject(input)) || Object.getOwnPropertySymbols(input).length) throw new TypeError('Native retained state requires plain JSON objects');
    if (ancestors.has(input)) throw new TypeError('Cyclic native retained state');
    ancestors.add(input);
    try {
      // Capture the entire parent before visiting children, as the original
      // descriptor snapshot did, without allocating an additional descriptor
      // object with thousands of indexed properties for every dense row.
      const fields: [string, PropertyDescriptor][] = [];
      for (const key of Object.getOwnPropertyNames(input)) {
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (descriptor && (!array || key !== 'length')) fields.push([key, descriptor]);
      }
      if (array) {
        if (fields.length !== input.length) throw new TypeError('Sparse or decorated native arrays are unsupported');
        if (fields.some(([key], i) => key !== String(i))) {
          normalizeDescriptorOrder(fields);
          if (fields.some(([key], i) => key !== String(i))) throw new TypeError('Sparse or decorated native arrays are unsupported');
        }
      } else normalizeDescriptorOrder(fields);
      const priorKeys = prior && Object.keys(prior);
      let unchanged = !!priorKeys && priorKeys.length === fields.length
        && fields.every(([key], index) => priorKeys[index] === key);
      let height = 0, shared = Object.isFrozen(input);
      const items = array ? new Array<unknown>(fields.length) : undefined;
      const entries: [string, unknown][] = [];
      for (let index = 0; index < fields.length; index++) {
        const [key, descriptor] = fields[index]!;
        // Array keys already matched the canonical decimal indices above.
        if (!array) assertUnicode(key);
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Native retained state requires enumerable data properties');
        if (items && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value)) {
          // Dense rasters and coordinate arrays need no leaf ownership record.
          // Preserve Float64 identity, including negative zero, on comparison.
          if (depth === 128) throw new TypeError('Native retained state nesting exceeds its contract');
          items[index] = descriptor.value;
          height = Math.max(height, 1);
          unchanged &&= Object.is(descriptor.value, prior![key]);
          continue;
        }
        const child = visit(descriptor.value, depth + 1, prior?.[key]);
        height = Math.max(height, child.height + 1); shared &&= child.shared;
        unchanged &&= Object.is(child.value, prior![key]);
        if (items) items[index] = child.value;
        else entries.push([key, child.value]);
      }
      const reuse = unchanged && (!shared || Object.getPrototypeOf(input) === Object.getPrototypeOf(prior));
      const result = reuse ? prior! : shared ? input
        : Object.freeze(items ?? Object.fromEntries(entries));
      retained.set(result, height);
      return { value: result, height, shared };
    } finally { ancestors.delete(input); }
  }
  return visit(value, 0, previous).value as T;
}
