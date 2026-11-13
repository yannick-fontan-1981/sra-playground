/** Exact structural witnesses for mutable native working containers. */
import { retainNativeJson } from './v6-native-owned.ts';

/**
 * Identity or a revision alone cannot detect direct edits to a mutable working
 * object, Map or Set. Keep their container structure while treating only deeply
 * validated immutable JSON subtrees as identity leaves. Public snapshots remain
 * independently mutable; this witness grants no authority to a journal by itself.
 */
export type NativeWorkingWitness = { kind: 'leaf'; value: unknown }
  | { kind: 'untracked'; value: object }
  | { kind: 'object'; value: object; prototype: object | null; fields: readonly (readonly [string, boolean, NativeWorkingWitness])[] }
  | { kind: 'map'; value: Map<unknown, unknown>; prototype: object | null; entries: readonly (readonly [NativeWorkingWitness, NativeWorkingWitness])[] }
  | { kind: 'set'; value: Set<unknown>; prototype: object | null; entries: readonly NativeWorkingWitness[] };

/**
 * Customized collections and callable fields can depend on mutable closures
 * that no structural witness sees. Preserve their ordinary execution without
 * certifying reuse. Arrays with a custom prototype are likewise not certified.
 * Other unsupported structures retain the existing cycle/accessor/symbol errors;
 * an optional cache may catch those errors and fall back to its source projection.
 */
export function captureWorkingWitness(value: unknown, ancestors = new WeakSet<object>()): NativeWorkingWitness {
  if (typeof value === 'function') return { kind: 'untracked', value };
  if (value === null || typeof value !== 'object') return { kind: 'leaf', value };
  if (ancestors.has(value)) throw new TypeError('Cyclic shared-series working memory');
  ancestors.add(value);
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (Array.isArray(value) && prototype !== Array.prototype) return { kind: 'untracked', value };
    if (value instanceof Map) {
      if (prototype !== Map.prototype || Reflect.ownKeys(value).length) return { kind: 'untracked', value };
      const entries: [NativeWorkingWitness, NativeWorkingWitness][] = [];
      for (const [key, item] of value.entries()) entries.push([captureWorkingWitness(key, ancestors), captureWorkingWitness(item, ancestors)]);
      return { kind: 'map', value, prototype, entries };
    }
    if (value instanceof Set) {
      if (prototype !== Set.prototype || Reflect.ownKeys(value).length) return { kind: 'untracked', value };
      const entries: NativeWorkingWitness[] = [];
      for (const item of value.values()) entries.push(captureWorkingWitness(item, ancestors));
      return { kind: 'set', value, prototype, entries };
    }
    // A collection detached from its native prototype no longer passes
    // instanceof. Its inherited iterator can still project changing closure
    // state, so only the standard collections above may certify iteration.
    if (!Array.isArray(value) && Symbol.iterator in value) return { kind: 'untracked', value };
    // Object.isFrozen alone is not a trust boundary: descendants must also
    // pass the existing ownership validator before identity can be sufficient.
    if (Object.isFrozen(value) && retainNativeJson(value) === value) return { kind: 'leaf', value };
    const fields: [string, boolean, NativeWorkingWitness][] = [];
    // Inspect every own key and descriptor without constructing a second
    // object containing all descriptors, including each index of dense rows.
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw new TypeError('Symbolic shared-series working memory');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if (!('value' in descriptor)) throw new TypeError('Accessor shared-series working memory');
      fields.push([key, descriptor.enumerable === true, captureWorkingWitness(descriptor.value, ancestors)]);
    }
    return { kind: 'object', value, prototype, fields };
  } finally { ancestors.delete(value); }
}

export function matchesWorkingWitness(witness: NativeWorkingWitness, value: unknown): boolean {
  if (witness.kind === 'leaf') return Object.is(value, witness.value);
  if (witness.kind === 'untracked') return false;
  if (value !== witness.value || Object.getPrototypeOf(value) !== witness.prototype) return false;
  if (witness.kind === 'map') {
    // The prototype comparison above already checked the standard prototype
    // captured for this collection; own customizations still invalidate it.
    if (Reflect.ownKeys(witness.value).length || witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.entries();
    for (const [key, child] of witness.entries) {
      const next = entries.next().value;
      if (next === undefined || !matchesWorkingWitness(key, next[0]) || !matchesWorkingWitness(child, next[1])) return false;
    }
    return true;
  }
  if (witness.kind === 'set') {
    if (Reflect.ownKeys(witness.value).length || witness.value.size !== witness.entries.length) return false;
    const entries = witness.value.values();
    for (const child of witness.entries) if (!matchesWorkingWitness(child, entries.next().value)) return false;
    return true;
  }
  if (!Array.isArray(witness.value) && Symbol.iterator in witness.value) return false;
  const keys = Reflect.ownKeys(witness.value);
  if (keys.length !== witness.fields.length) return false;
  for (let index = 0; index < keys.length; index++) {
    const [key, enumerable, child] = witness.fields[index]!;
    if (key !== keys[index]) return false;
    const descriptor = Object.getOwnPropertyDescriptor(witness.value, key);
    if (!descriptor || !('value' in descriptor) || descriptor.enumerable !== enumerable
      || !matchesWorkingWitness(child, descriptor.value)) return false;
  }
  return true;
}
