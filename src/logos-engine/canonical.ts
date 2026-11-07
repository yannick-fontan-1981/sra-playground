import type { JsonObject, JsonValue } from './ir.ts';

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
const canonicalObjects = new WeakMap<object, { text: string; nodes: number; height: number }>();
const MAX_DEPTH = 128;
const MAX_NODES = 1_000_000;

function jsonDescriptors(item: object): readonly (readonly [string, PropertyDescriptor])[] {
  if (Object.getOwnPropertySymbols(item).length) throw new TypeError('JSON symbol properties are unsupported');
  const array = Array.isArray(item);
  if (!array && !isJsonObject(item)) throw new TypeError('Only plain JSON objects are accepted');
  const descriptors = Object.getOwnPropertyDescriptors(item);
  const entries = Object.entries(descriptors).filter(([key]) => !array || key !== 'length');
  for (const [key, descriptor] of entries) {
    assertUnicode(key);
    if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('JSON requires enumerable data properties');
  }
  if (array && (entries.length !== item.length || entries.some(([key], index) => key !== String(index)))) {
    throw new TypeError('Sparse or decorated arrays are unsupported');
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
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
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
    const descriptors = jsonDescriptors(item);
    let result: JsonValue;
    if (Array.isArray(item)) {
      result = descriptors.map(([, descriptor]) => visit(descriptor.value, depth + 1));
    } else {
      const entries = [...descriptors].sort(([a], [b]) => compareUnicode(a, b)).map(([key, descriptor]) => {
        return [key, visit(descriptor.value, depth + 1)] as const;
      });
      result = Object.fromEntries(entries) as JsonObject;
    }
    ancestors.delete(item);
    Object.freeze(result);
    immutableObjects.add(result as object);
    return result;
  }
  return visit(value, 0);
}

/** Python json.dumps(ensure_ascii=False, sort_keys=True, separators=(',', ':')) on the portable domain. */
export function canonical(value: unknown): string {
  const ancestors = new WeakSet<object>();
  let nodes = 0;
  let lastHeight = 0, lastImmutable = true;
  function encode(item: unknown, depth: number): string {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
    lastHeight = 0; lastImmutable = true;
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'number') { assertPortableNumber(item); return String(item); }
    if (typeof item === 'string') { assertUnicode(item); return JSON.stringify(item); }
    if (typeof item !== 'object') throw new TypeError('Only explicit JSON values can be canonicalized');
    const cached = canonicalObjects.get(item);
    if (cached) {
      nodes += cached.nodes - 1;
      if (nodes > MAX_NODES || depth + cached.height > MAX_DEPTH) throw new TypeError('JSON size/nesting limit exceeded');
      lastHeight = cached.height; return cached.text;
    }
    if (ancestors.has(item)) throw new TypeError('Cyclic JSON value');
    ancestors.add(item);
    const initialNodes = nodes;
    const descriptors = jsonDescriptors(item);
    let height = 0, deeplyImmutable = Object.isFrozen(item);
    const child = (value: unknown): string => {
      const text = encode(value, depth + 1);
      height = Math.max(height, lastHeight + 1); deeplyImmutable &&= lastImmutable;
      return text;
    };
    let encoded: string;
    if (Array.isArray(item)) {
      encoded = `[${descriptors.map(([, descriptor]) => child(descriptor.value)).join(',')}]`;
    } else {
      encoded = `{${[...descriptors].sort(([a], [b]) => compareUnicode(a, b)).map(([key, descriptor]) => {
        return `${JSON.stringify(key)}:${child(descriptor.value)}`;
      }).join(',')}}`;
    }
    ancestors.delete(item);
    lastHeight = height; lastImmutable = deeplyImmutable;
    if (deeplyImmutable) canonicalObjects.set(item, { text: encoded, nodes: nodes - initialNodes + 1, height });
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
