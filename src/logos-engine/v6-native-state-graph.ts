/** Lossless native state graphs; immutable fragments are ordinary versioned V7 nodes. */
import { assertUnicode, compareUnicode, immutableJson, isJsonObject } from './canonical.ts';
import { sha256Bytes, symbolicDigest } from './v6-hash.ts';
import type { JsonObject, JsonValue } from './ir.ts';
import { BoundedWeakCache } from './bounded-weak-cache.ts';

export const NATIVE_STATE_GRAPH_PROFILE = 'logos-engine.v6.state-graph.v1';
export const NATIVE_STATE_FRAGMENT_PREFIX = 'state_fragment:';
const DEFAULT_BOUND = 8192;
type Scalar = null | boolean | number | string;
type Encoded = Scalar | { kind: 'float64'; bits: string } | { kind: 'ref'; id: string }
  | { kind: 'array'; items: readonly Encoded[] } | { kind: 'object'; members: Readonly<Record<string, Encoded>> }
  | { kind: 'concat' | 'merge'; parts: readonly Encoded[] };
export interface NativeStateGraphRoot extends JsonObject {
  profile: typeof NATIVE_STATE_GRAPH_PROFILE;
  component: string;
  root: JsonValue;
}
export interface NativeStateFragment { readonly id: string; readonly value: JsonObject }
export interface SplitNativeState { readonly root: NativeStateGraphRoot; readonly fragments: readonly NativeStateFragment[] }
interface Sized { node: Encoded; cost: number }
// Entries are installed only after the ordinary encoder has validated a deeply
// frozen input subtree. Mutable descendants disqualify the entire container.
// Height and all referenced fragments accompany the cached representation so
// reuse preserves both the nesting bound and a complete export to a new store.
const frozenStateNodes = new WeakMap<object, { limit: number; value: Sized; height: number; fragments: readonly NativeStateFragment[] }>();
const NO_FRAGMENTS: readonly NativeStateFragment[] = Object.freeze([]);

// Own the closed AST when each node is built. Its children are then recognized
// at the ordinary V7 ingress boundary, so persisting the next root preserves
// their identities instead of recopying every unchanged encoded descendant.
// Raw caller values still go through visitRaw; the complete canonical digest
// before a Kernel commit still checks full size, depth and portable scalars.
function ownedEncoded<T extends Encoded>(node: T): T { return immutableJson(node) as T; }

/**
 * The encoder below has already checked every raw value and creates this closed
 * immutable AST itself. Revalidating its thousands of tiny envelope objects in
 * the generic JSON canonicalizer on every checkpoint is redundant. Preserve
 * exactly the same canonical bytes, including Unicode key order, here. This
 * fast path never accepts stored or caller-created ASTs; hydration still checks
 * untrusted fragments through the full canonical/hash boundary.
 */
const encodedText = new BoundedWeakCache<string>(4 * 1024 * 1024, 2048);
function encodedCanonical(node: Encoded): string {
  if (node === null || typeof node !== 'object') return JSON.stringify(node);
  const cached = encodedText.get(node); if (cached !== undefined) return cached;
  let result: string;
  switch (node.kind) {
    case 'float64': result = `{"bits":${JSON.stringify(node.bits)},"kind":"float64"}`; break;
    case 'ref': result = `{"id":${JSON.stringify(node.id)},"kind":"ref"}`; break;
    case 'array': result = `{"items":[${node.items.map(encodedCanonical).join(',')}],"kind":"array"}`; break;
    case 'object': result = `{"kind":"object","members":{${Object.keys(node.members).sort(compareUnicode)
      .map(key => `${JSON.stringify(key)}:${encodedCanonical(node.members[key]!)}`).join(',')}}}`; break;
    case 'concat': case 'merge': result = `{"kind":"${node.kind}","parts":[${node.parts.map(encodedCanonical).join(',')}]}`; break;
  }
  encodedText.set(node, result, 2 * result.length + 96); return result;
}

/**
 * Typed envelopes distinguish graph references from user data. Even a user
 * object whose fields imitate a reference is represented as a literal object.
 * Pixel matrices receive their own reusable fragments; oversized objects and
 * arrays become ordered groups. No entry, frame or history is truncated.
 */
export function splitNativeState(value: unknown, component: string, options: { maxFragmentNodes?: number } = {}): SplitNativeState {
  assertUnicode(component);
  if (!component) throw new TypeError('A native state component identity is required');
  const limit = options.maxFragmentNodes ?? DEFAULT_BOUND;
  if (!Number.isSafeInteger(limit) || limit < 32 || limit > 65_536) throw new RangeError('Native fragment bound must be between 32 and 65536');
  // Reserve the three scalar/container nodes used by the outer root envelope.
  const bound = limit - 3;
  const fragments = new Map<string, NativeStateFragment>(), ancestors = new WeakSet<object>();
  const emitted: NativeStateFragment[] = [];
  const measured = new WeakMap<object, { value: Sized; height: number; immutable: boolean; start: number; end: number }>();
  const metrics: { height: number; immutable: boolean }[] = [];
  const note = (height: number, immutable: boolean): void => {
    const parent = metrics.at(-1);
    if (parent) { parent.height = Math.max(parent.height, height + 1); parent.immutable &&= immutable; }
  };
  const emit = (fragment: NativeStateFragment): void => {
    if (!fragments.has(fragment.id)) fragments.set(fragment.id, fragment);
    emitted.push(fragment);
  };
  const fragment = (node: Encoded): Sized => {
    const value = immutableJson({ profile: NATIVE_STATE_GRAPH_PROFILE, node }) as JsonObject;
    const bytes = new TextEncoder().encode(`{"node":${encodedCanonical(node)},"profile":${JSON.stringify(NATIVE_STATE_GRAPH_PROFILE)}}`);
    const id = `${NATIVE_STATE_FRAGMENT_PREFIX}${sha256Bytes(bytes)}`;
    emit(fragments.get(id) ?? Object.freeze({ id, value }));
    return { node: ownedEncoded({ kind: 'ref', id }), cost: 3 };
  };
  const combine = (kind: 'concat' | 'merge', children: Sized[]): Sized => {
    // A flat collection can itself be enormous: bound the reference fanout too.
    let parts = children;
    while (3 + parts.reduce((n, part) => n + part.cost, 0) > bound) {
      const next: Sized[] = []; let group: Sized[] = [], cost = 3;
      for (const part of parts) {
        if (cost + part.cost > bound && group.length) { next.push(fragment(ownedEncoded({ kind, parts: Object.freeze(group.map(p => p.node)) }))); group = []; cost = 3; }
        group.push(part); cost += part.cost;
      }
      if (group.length) next.push(fragment(ownedEncoded({ kind, parts: Object.freeze(group.map(p => p.node)) })));
      parts = next;
    }
    return { node: ownedEncoded({ kind, parts: Object.freeze(parts.map(p => p.node)) }), cost: 3 + parts.reduce((n, p) => n + p.cost, 0) };
  };
  const visitRaw = (input: unknown, depth: number): Sized => {
    if (depth > 128) throw new TypeError('Native state nesting exceeds the V7 structural contract');
    if (input === null || typeof input === 'boolean') return { node: input, cost: 1 };
    if (typeof input === 'string') { assertUnicode(input); return { node: input, cost: 1 }; }
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new TypeError('Native state numbers must be finite');
      if (Number.isSafeInteger(input) && !Object.is(input, -0)) return { node: input, cost: 1 };
      const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, input, false);
      return { node: ownedEncoded({ kind: 'float64', bits: [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('') }), cost: 3 };
    }
    if (typeof input !== 'object') throw new TypeError('Native state requires explicit JSON values');
    if (!Array.isArray(input) && !isJsonObject(input)) throw new TypeError('Native state requires plain objects and arrays');
    if (Object.getOwnPropertySymbols(input).length) throw new TypeError('Symbolic native state members are unsupported');
    if (ancestors.has(input)) throw new TypeError('Cyclic native state is unsupported');
    ancestors.add(input);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input), names = Object.keys(descriptors).filter(name => !Array.isArray(input) || name !== 'length');
      for (const name of names) {
        assertUnicode(name); const descriptor = descriptors[name]!;
        if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Native state requires enumerable data properties');
      }
      if (Array.isArray(input) && (names.length !== input.length || names.some((name, index) => name !== String(index)))) throw new TypeError('Sparse or decorated native arrays are unsupported');
      if (Array.isArray(input)) {
        const children = names.map(name => visit(descriptors[name]!.value, depth + 1));
        const cost = 3 + children.reduce((n, child) => n + child.cost, 0);
        if (cost <= bound) {
          const node = ownedEncoded({ kind: 'array' as const, items: Object.freeze(children.map(child => child.node)) });
          const pixelMatrix = input.length > 0 && input.every(row => Array.isArray(row) && row.length > 0 && row.every(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 255));
          if (pixelMatrix && cost >= 512) {
            return fragment(node);
          }
          return { node, cost };
        }
        const groups: Sized[] = []; let group: Sized[] = [], groupCost = 3;
        for (let child of children) {
          if (child.cost + 3 > bound) child = fragment(child.node);
          if (groupCost + child.cost > bound && group.length) { groups.push(fragment(ownedEncoded({ kind: 'array', items: Object.freeze(group.map(c => c.node)) }))); group = []; groupCost = 3; }
          group.push(child); groupCost += child.cost;
        }
        if (group.length) groups.push(fragment(ownedEncoded({ kind: 'array', items: Object.freeze(group.map(c => c.node)) })));
        return combine('concat', groups);
      }
      const entries = names.sort(compareUnicode).map(name => [name, visit(descriptors[name]!.value, depth + 1)] as const);
      const cost = 3 + entries.reduce((n, [, child]) => n + child.cost, 0);
      if (cost <= bound) return { node: ownedEncoded({ kind: 'object', members: Object.freeze(Object.fromEntries(entries.map(([name, child]) => [name, child.node]))) }), cost };
      const groups: Sized[] = []; let group: (readonly [string, Sized])[] = [], groupCost = 3;
      for (const [name, original] of entries) {
        const child = original.cost + 3 > bound ? fragment(original.node) : original;
        if (groupCost + child.cost > bound && group.length) { groups.push(fragment(ownedEncoded({ kind: 'object', members: Object.freeze(Object.fromEntries(group.map(([name, child]) => [name, child.node]))) }))); group = []; groupCost = 3; }
        group.push([name, child]); groupCost += child.cost;
      }
      if (group.length) groups.push(fragment(ownedEncoded({ kind: 'object', members: Object.freeze(Object.fromEntries(group.map(([name, child]) => [name, child.node]))) })));
      return combine('merge', groups);
    } finally { ancestors.delete(input); }
  };
  const visit = (input: unknown, depth: number): Sized => {
    if (input !== null && typeof input === 'object') {
      const cached = frozenStateNodes.get(input);
      if (cached?.limit === limit) {
        if (depth + cached.height > 128) throw new TypeError('Native state nesting exceeds the V7 structural contract');
        for (const fragment of cached.fragments) emit(fragment);
        note(cached.height, true); return cached.value;
      }
      const known = measured.get(input);
      if (known) {
        if (depth + known.height > 128) throw new TypeError('Native state nesting exceeds the V7 structural contract');
        for (let i = known.start; i < known.end; i++) emit(emitted[i]!);
        note(known.height, known.immutable); return known.value;
      }
      const start = emitted.length, measure = { height: 0, immutable: Object.isFrozen(input) };
      metrics.push(measure);
      let value: Sized;
      try { value = visitRaw(input, depth); } finally { metrics.pop(); }
      const end = emitted.length;
      measured.set(input, { value, ...measure, start, end });
      // Small tuple leaves are cheaper to encode than to retain independently;
      // their enclosing immutable object/array still reuses them as a whole.
      if (measure.immutable && (value.cost >= 32 || end > start)) {
        const refs = end === start ? NO_FRAGMENTS : Object.freeze([...new Map(emitted.slice(start, end).map(fragment => [fragment.id, fragment])).values()]);
        frozenStateNodes.set(input, { limit, value, height: measure.height, fragments: refs });
      }
      note(measure.height, measure.immutable); return value;
    }
    const value = visitRaw(input, depth); note(0, true); return value;
  };
  const encoded = visit(value, 0);
  return Object.freeze({ root: immutableJson({ profile: NATIVE_STATE_GRAPH_PROFILE, component, root: encoded.node as JsonValue }) as NativeStateGraphRoot,
    fragments: Object.freeze([...fragments.values()]) });
}

export function isNativeStateGraph(value: unknown): value is NativeStateGraphRoot {
  return isJsonObject(value) && value.profile === NATIVE_STATE_GRAPH_PROFILE && typeof value.component === 'string' && Object.hasOwn(value, 'root');
}

/** Read the actual V7 fragments, verify content identity, and restore immutable values. */
export function hydrateNativeState(root: unknown, readFragment: (id: string) => unknown): JsonValue {
  if (!isNativeStateGraph(root) || Object.keys(root).length !== 3) throw new TypeError('Invalid native state graph root');
  const visiting = new Set<string>(), cache = new Map<string, JsonValue>();
  const exact = (object: JsonObject, fields: readonly string[]): void => {
    if (Object.keys(object).length !== fields.length || fields.some(field => !Object.hasOwn(object, field))) throw new TypeError('Malformed native state graph node');
  };
  const decode = (value: unknown, depth: number): JsonValue => {
    if (depth > 512) throw new TypeError('Native state reference nesting exceeds the structural contract');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') { assertUnicode(value); return value; }
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError('Unencoded native graph number'); return value;
    }
    if (!isJsonObject(value)) throw new TypeError('Invalid native state graph node');
    if (value.kind === 'float64') {
      exact(value, ['kind', 'bits']); if (typeof value.bits !== 'string' || !/^[0-9a-f]{16}$/.test(value.bits)) throw new TypeError('Invalid native Float64 encoding');
      const bytes = Uint8Array.from(value.bits.match(/../g)!, pair => Number.parseInt(pair, 16)), number = new DataView(bytes.buffer).getFloat64(0, false);
      if (!Number.isFinite(number)) throw new TypeError('Nonfinite native Float64 encoding'); return number;
    }
    if (value.kind === 'ref') {
      exact(value, ['kind', 'id']); const id = value.id;
      if (typeof id !== 'string' || !/^state_fragment:[a-f0-9]{64}$/.test(id)) throw new TypeError('Invalid native fragment reference');
      if (visiting.has(id)) throw new TypeError('Cyclic native fragment reference');
      const found = cache.get(id); if (found !== undefined) return found;
      const fragment = readFragment(id);
      if (!isJsonObject(fragment) || fragment.profile !== NATIVE_STATE_GRAPH_PROFILE || !Object.hasOwn(fragment, 'node') || Object.keys(fragment).length !== 2 ||
          `${NATIVE_STATE_FRAGMENT_PREFIX}${symbolicDigest(fragment, false)}` !== id) throw new TypeError('Native state fragment digest mismatch or missing fragment');
      visiting.add(id);
      try { const result = decode(fragment.node, depth + 1); cache.set(id, result); return result; } finally { visiting.delete(id); }
    }
    if (value.kind === 'array') {
      exact(value, ['kind', 'items']); if (!Array.isArray(value.items)) throw new TypeError('Invalid native array items');
      return Object.freeze(value.items.map(item => decode(item, depth + 1)));
    }
    if (value.kind === 'object') {
      exact(value, ['kind', 'members']); if (!isJsonObject(value.members)) throw new TypeError('Invalid native object members');
      return Object.freeze(Object.fromEntries(Object.entries(value.members).map(([name, item]) => { assertUnicode(name); return [name, decode(item, depth + 1)]; })));
    }
    if (value.kind === 'concat' || value.kind === 'merge') {
      exact(value, ['kind', 'parts']); if (!Array.isArray(value.parts) || !value.parts.length) throw new TypeError('Invalid native state groups');
      const parts = value.parts.map(part => decode(part, depth + 1));
      if (value.kind === 'concat') {
        if (parts.some(part => !Array.isArray(part))) throw new TypeError('Native array group contains a non-array');
        return Object.freeze((parts as (readonly JsonValue[])[]).flat());
      }
      const output: Record<string, JsonValue> = Object.create(null);
      for (const part of parts) {
        if (!isJsonObject(part)) throw new TypeError('Native object group contains a non-object');
        for (const [name, item] of Object.entries(part)) { if (Object.hasOwn(output, name)) throw new TypeError('Duplicate native object member across groups'); output[name] = item; }
      }
      return Object.freeze({ ...output });
    }
    throw new TypeError('Unknown native graph node kind');
  };
  return decode(root.root, 0);
}
