import type { JsonObject, JsonValue } from './ir.ts';
import { BoundedWeakCache } from './bounded-weak-cache.ts';

/**
 * Portable V7 scalar contract for this first browser port.
 *
 * Python distinguishes 1 from 1.0, whereas a JavaScript Number cannot preserve
 * that distinction after JSON parsing. Hashing and measured facts therefore
 * admit safe integers (excluding -0), strings, booleans and JSON null only.
 * Null is allowed structurally, but the observation boundary rejects it as an
 * unknown fact. Unused source metadata may contain finite fractional numbers;
 * immutableJson preserves it, while canonical deliberately rejects hashing it.
 * Keys use Python's Unicode code-point ordering, not UTF-16 code-unit ordering.
 */
export const PORTABLE_SCALAR_DOMAIN = 'strings, booleans and safe integers (no negative zero); structural null';

const immutableObjects = new WeakSet<object>();
// Only deeply immutable, fully validated trees enter this cache. Size and
// height are retained so reuse cannot evade the original structural limits.
// Historical V7 nodes deliberately remain alive. Weak keys alone therefore do
// not bound the redundant text of every historical descendant/ancestor. This
// cache holds at most 16 MiB of UTF-16 text plus an allowance for each entry;
// eviction only removes a recomputable encoding, never a knowledge revision.
const canonicalObjects = new BoundedWeakCache<{ text: string; nodes: number; height: number }>(16 * 1024 * 1024, 4096);
const MAX_DEPTH = 128;
export const MAX_JSON_NODES = 1_000_000;
const validUnicode = new Set<string>();
const unicodeCacheUnits = 4 * 1024 * 1024;
const unicodeCacheEntries = 4096;
let validatedUnicodeUnits = 0;
const surrogateUnits = /[\ud800-\udfff]/;

/** Read-only ownership test; a foreign or merely frozen object is not certified. */
export function isOwnedImmutableJson(value: unknown): boolean {
  return value !== null && typeof value === 'object' && immutableObjects.has(value);
}

function jsonEntries(item: object): [string, unknown][] {
  if (Object.getOwnPropertySymbols(item).length) throw new TypeError('JSON symbol properties are unsupported');
  const array = Array.isArray(item);
  if (!array && !isJsonObject(item)) throw new TypeError('Only plain JSON objects are accepted');
  // Snapshot each own descriptor directly. Building a second descriptor record
  // and then enumerating/filtering it creates several temporary collections for
  // every persisted array or mapping. The values below still come exclusively
  // from descriptors: foreign accessors are rejected without being invoked.
  const entries: [string, unknown][] = [];
  for (const key of Object.getOwnPropertyNames(item)) {
    const descriptor = Object.getOwnPropertyDescriptor(item, key);
    // Like Object.getOwnPropertyDescriptors, ignore a key removed between the
    // own-key enumeration and descriptor acquisition (possible for a Proxy).
    if (!descriptor) continue;
    if (array && key === 'length') continue;
    entries.push([key, descriptor]);
  }
  let orderedArray = true;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]!, key = entry[0], descriptor = entry[1] as PropertyDescriptor;
    assertUnicode(key);
    if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('JSON requires enumerable data properties');
    entry[1] = descriptor.value;
    if (array && key !== String(index)) orderedArray = false;
  }
  if (array) {
    if (entries.length !== item.length) throw new TypeError('Sparse or decorated arrays are unsupported');
    // Object.getOwnPropertyDescriptors used a plain record, whose numeric keys
    // enumerate in index order even for a Proxy returning reordered ownKeys.
    if (!orderedArray) {
      entries.sort(([a], [b]) => Number(a) - Number(b));
      if (entries.some(([key], index) => key !== String(index))) throw new TypeError('Sparse or decorated arrays are unsupported');
    }
  }
  return entries;
}

export function compareUnicode(left: string, right: string): number {
  if (left === right) return 0;
  if (!/[\ud800-\udbff]/.test(left) && !/[\ud800-\udbff]/.test(right)) return left < right ? -1 : 1;
  const a = Array.from(left, character => character.codePointAt(0)!);
  const b = Array.from(right, character => character.codePointAt(0)!);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index]! < b[index]! ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
}

export function assertUnicode(value: string): void {
  if (validUnicode.has(value)) return;
  if (surrogateUnits.test(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(++index);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError('Lone Unicode surrogate is outside the portable JSON domain');
      } else if (unit >= 0xdc00 && unit <= 0xdfff) {
        throw new TypeError('Lone Unicode surrogate is outside the portable JSON domain');
      }
    }
  }
  if (value.length <= unicodeCacheUnits) {
    if (validUnicode.size >= unicodeCacheEntries || validatedUnicodeUnits + value.length > unicodeCacheUnits) {
      validUnicode.clear();
      validatedUnicodeUnits = 0;
    }
    validUnicode.add(value);
    validatedUnicodeUnits += value.length;
  }
}

export function assertPortableNumber(value: number): void {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new TypeError('Portable V7 numbers must be safe integers, without negative zero');
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function objectValue(value: unknown, label = 'value'): JsonObject {
  if (!isJsonObject(value)) throw new TypeError(`${label} must be a JSON object`);
  return value;
}

export function arrayValue(value: unknown, label = 'value'): readonly JsonValue[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value as readonly JsonValue[];
}

export function stringValue(value: unknown, label = 'value'): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  assertUnicode(value);
  return value;
}

export function ownValue(object: JsonObject, key: string): JsonValue {
  if (!Object.hasOwn(object, key)) throw new TypeError(`Missing JSON member: ${key}`);
  return object[key]!;
}

export function exactKeys(object: JsonObject, keys: readonly string[], label: string): void {
  const present = Object.keys(object);
  if (present.length !== keys.length || keys.some(key => !Object.hasOwn(object, key))) {
    throw new TypeError(`${label} requires exactly: ${keys.join(', ')}`);
  }
}

/**
 * Clone at ingress, sharing trusted subtrees and sorting record keys. JavaScript
 * still enumerates integer-like keys numerically; operations exposing semantic
 * map iteration sort explicitly instead of relying on Object.keys order.
 */
export function immutableJson<T extends JsonValue>(value: T): T;
export function immutableJson(value: unknown): JsonValue;
export function immutableJson(value: unknown): JsonValue {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  function visit(item: unknown, depth: number): JsonValue {
    if (++nodes > MAX_JSON_NODES || depth > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
    if (item === null || typeof item === 'boolean') return item;
    if (typeof item === 'string') { assertUnicode(item); return item; }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Non-finite JSON number');
      return item;
    }
    if (typeof item !== 'object') throw new TypeError('Only explicit JSON values are accepted');
    if (immutableObjects.has(item)) return item as JsonValue;
    if (ancestors.has(item)) throw new TypeError('Cyclic JSON value');
    ancestors.add(item);
    const entries = jsonEntries(item);
    let result: JsonValue;
    if (Array.isArray(item)) {
      result = entries.map(([, child]) => visit(child, depth + 1));
    } else {
      const members = entries.sort(([a], [b]) => compareUnicode(a, b)).map(([key, child]) => {
        return [key, visit(child, depth + 1)] as const;
      });
      result = Object.fromEntries(members) as JsonObject;
    }
    ancestors.delete(item);
    Object.freeze(result);
    immutableObjects.add(result as object);
    return result;
  }
  return visit(value, 0);
}

/** Constructors for encoder-owned containers. Children must be scalars or
 * already closed by this module: this is not an alternative raw JSON ingress. */
function closedJsonChild(value: JsonValue): JsonValue {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') { assertUnicode(value); return value; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value !== null && typeof value === 'object' && immutableObjects.has(value)) return value;
  throw new TypeError('A constructed JSON container requires validated children');
}

export function immutableJsonArray(children: Iterable<JsonValue>): readonly JsonValue[] {
  const result: JsonValue[] = [];
  for (const value of children) {
    if (result.length + 2 > MAX_JSON_NODES) throw new TypeError('JSON size/nesting limit exceeded');
    result.push(closedJsonChild(value));
  }
  Object.freeze(result); immutableObjects.add(result); return result;
}

export function immutableJsonRecord(children: Iterable<readonly [string, JsonValue]>): JsonObject {
  const entries: [string, JsonValue][] = [];
  for (const [name, value] of children) {
    if (entries.length + 2 > MAX_JSON_NODES) throw new TypeError('JSON size/nesting limit exceeded');
    entries.push([stringValue(name, 'JSON member'), closedJsonChild(value)]);
  }
  entries.sort(([a], [b]) => compareUnicode(a, b));
  if (entries.some(([name], index) => index > 0 && name === entries[index - 1]![0])) throw new TypeError('Duplicate constructed JSON member');
  const result = Object.fromEntries(entries) as JsonObject;
  Object.freeze(result); immutableObjects.add(result); return result;
}

/** Only the new entries require ingress validation. The record and its keys
 * were already closed by this module. Build one fresh canonical-order index. */
export function updateImmutableJsonRecord<T extends JsonValue>(base: Readonly<Record<string, T>>,
  changes: ReadonlyMap<string, T>): Readonly<Record<string, T>> {
  if (!isOwnedImmutableJson(base) || Array.isArray(base)) throw new TypeError('Expected a validated immutable JSON record');
  const updates = new Map<string, T>();
  const keys = Object.keys(base);
  for (const [name, value] of changes) {
    const key = stringValue(name, 'JSON member');
    if (!Object.hasOwn(base, key) && !updates.has(key)) keys.push(key);
    updates.set(key, immutableJson(value));
  }
  if (keys.length + 1 > MAX_JSON_NODES) throw new TypeError('JSON size/nesting limit exceeded');
  const result = Object.fromEntries<T>(keys.sort(compareUnicode).map(key => [key, updates.has(key) ? updates.get(key)! : base[key]!] as const));
  Object.freeze(result);
  immutableObjects.add(result);
  return result;
}

/** Extend a validated dense array without enumerating the old entries again. */
export function appendImmutableJsonArray<T extends JsonValue>(base: readonly T[], tail: readonly T[]): readonly T[] {
  if (!isOwnedImmutableJson(base) || !Array.isArray(base)) throw new TypeError('Expected a validated immutable JSON array');
  const added = immutableJson(tail);
  if (!Array.isArray(added)) throw new TypeError('Expected a JSON array to append');
  if (base.length + added.length + 1 > MAX_JSON_NODES) throw new TypeError('JSON size/nesting limit exceeded');
  const result = Object.freeze([...base, ...added]) as readonly T[];
  immutableObjects.add(result);
  return result;
}

/** Python json.dumps(ensure_ascii=False, sort_keys=True, separators=(',', ':')) on the portable domain. */
export function canonical(value: unknown): string {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let lastHeight = 0, lastImmutable = true;
  function encode(item: unknown, depth: number, closedValue = false): string {
    if (++nodes > MAX_JSON_NODES || depth > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
    lastHeight = 0; lastImmutable = true;
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'number') { assertPortableNumber(item); return String(item); }
    if (typeof item === 'string') {
      if (!closedValue) assertUnicode(item);
      return JSON.stringify(item);
    }
    if (typeof item !== 'object') throw new TypeError('Only explicit JSON values can be canonicalized');
    const cached = canonicalObjects.get(item);
    if (cached) {
      nodes += cached.nodes - 1;
      if (nodes > MAX_JSON_NODES || depth + cached.height > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
      lastHeight = cached.height; return cached.text;
    }
    const owned = immutableObjects.has(item);
    if (!owned) {
      if (ancestors.has(item)) throw new TypeError('Cyclic JSON value');
      ancestors.add(item);
    }
    const initialNodes = nodes;
    let height = 0, deeplyImmutable = owned || Object.isFrozen(item);
    const child = (value: unknown): string => {
      const text = encode(value, depth + 1, owned);
      height = Math.max(height, lastHeight + 1);
      if (!owned) deeplyImmutable &&= lastImmutable;
      return text;
    };
    let encoded: string;
    if (owned) {
      // Ingress already validated shape, keys and strings and owns every
      // descendant. Numbers still need the narrower portable-number check.
      if (Array.isArray(item)) {
        encoded = `[${item.map(child).join(',')}]`;
      } else {
        const record = item as JsonObject;
        const keys = Object.keys(record);
        // All owned records were built in code-point order. JavaScript moves
        // array-index keys to the front, which is the only exception to it.
        if (keys[0] !== undefined && /^[0-9]/.test(keys[0])) keys.sort(compareUnicode);
        encoded = `{${keys.map(key => `${JSON.stringify(key)}:${child(record[key])}`).join(',')}}`;
      }
    } else {
      const entries = jsonEntries(item);
      if (Array.isArray(item)) {
        encoded = `[${entries.map(([, value]) => child(value)).join(',')}]`;
      } else {
        encoded = `{${entries.sort(([a], [b]) => compareUnicode(a, b)).map(([key, value]) =>
          `${JSON.stringify(key)}:${child(value)}`).join(',')}}`;
      }
      ancestors.delete(item);
    }
    lastHeight = height; lastImmutable = deeplyImmutable;
    if (deeplyImmutable) canonicalObjects.set(item, { text: encoded, nodes: nodes - initialNodes + 1, height }, 2 * encoded.length + 128);
    return encoded;
  }
  return encode(value, 0);
}

export async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(value));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function equal(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}
