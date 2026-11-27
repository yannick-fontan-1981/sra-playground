/** Lossless native state graphs; immutable fragments are ordinary versioned V7 nodes. */
import { assertUnicode, compareUnicode, denseIntegerText, immutableJson, immutableJsonArray, immutableJsonRecord, isJsonObject, isOwnedImmutableJson } from './canonical.ts';
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
type EncodedCollection<K extends 'array' | 'object'> = Extract<Encoded, { kind: K }>;
type GroupKind = 'concat' | 'merge';

function sameEncoded(left: Encoded, right: Encoded | undefined): boolean {
  return left === right || (left !== null && typeof left === 'object' && left.kind === 'ref'
    && right != null && typeof right === 'object' && right.kind === 'ref' && left.id === right.id);
}

export interface NativeStateGraphRoot extends JsonObject {
  profile: typeof NATIVE_STATE_GRAPH_PROFILE;
  component: string;
  root: JsonValue;
}
export interface NativeStateFragment { readonly id: string; readonly value: JsonObject }
export interface SplitNativeState { readonly root: NativeStateGraphRoot; readonly fragments: readonly NativeStateFragment[] }
interface Sized { node: Encoded; cost: number }
interface PriorNativeState {
  root: NativeStateGraphRoot;
  readFragment(id: string): unknown;
}
type SplitOptions = { maxFragmentNodes?: number; prior?: PriorNativeState };
const ownedRoots = new WeakSet<NativeStateGraphRoot>();
const ownedFragments = new WeakMap<object, NativeStateFragment>();
const fragmentsByNode = new WeakMap<object, { fragment: NativeStateFragment; reference: Sized }>();
// Entries are installed only after the ordinary encoder has validated a deeply
// frozen input subtree. Mutable descendants disqualify the entire container.
// Height and all referenced fragments accompany the cached representation so
// reuse preserves both the nesting bound and a complete export to a new store.
const frozenStateNodes = new WeakMap<object, { limit: number; value: Sized; height: number; fragments: readonly NativeStateFragment[] }>();
const validatedFrozenSources = new WeakSet<object>();
const NO_FRAGMENTS: readonly NativeStateFragment[] = Object.freeze([]);

/** A complete encode, including a check of every descendant, certified this source. */
export function isValidatedFrozenNativeState(input: unknown): input is object {
  return input !== null && typeof input === 'object' && validatedFrozenSources.has(input);
}

interface HydratedFragment { readonly value: JsonValue; readonly height: number }
// Reuse only terminal fragments: composite references still traverse the actual
// store on every hydration. Keys are deeply validated immutable V7 JSON values,
// not caller-frozen envelopes. The disposable cache retains at most 256 results
// and 8 MiB of conservative structural weight; no graph revision is discarded.
const hydratedLeaves = new BoundedWeakCache<HydratedFragment & { readonly id: string }>(8 * 1024 * 1024, 256);
// Read-only provenance for closed values built by this decoder. A caller's
// frozen graph envelope or shallowly frozen JSON value never enters this set.
// Consumers can copy these plain immutable trees without re-inspecting their
// property descriptors; no decoder validation or fragment lookup is skipped.
const hydratedObjects = new WeakSet<object>();
export function isHydratedNativeJson(value: unknown): boolean {
  return value !== null && typeof value === 'object' && hydratedObjects.has(value);
}
function freezeHydrated<T extends object>(value: T): T {
  Object.freeze(value); hydratedObjects.add(value); return value;
}

// Own the closed AST when each node is built. Its children are then recognized
// at the ordinary V7 ingress boundary, so persisting the next root preserves
// their identities instead of recopying every unchanged encoded descendant.
// Raw caller values still go through visitRaw; the complete canonical digest
// before a Kernel commit still checks full size, depth and portable scalars.
type EncodedEnvelope = Exclude<Encoded, Scalar | EncodedCollection<'object'>>;

function ownedEncoded<T extends EncodedEnvelope>(node: T): T {
  let fields: readonly (readonly [string, JsonValue])[];
  switch (node.kind) {
    case 'float64': fields = [['kind', node.kind], ['bits', node.bits]]; break;
    case 'ref': fields = [['kind', node.kind], ['id', node.id]]; break;
    case 'array': fields = [['kind', node.kind], ['items', immutableJsonArray(node.items as readonly JsonValue[])]]; break;
    case 'concat': case 'merge': fields = [['kind', node.kind], ['parts', immutableJsonArray(node.parts as readonly JsonValue[])]]; break;
  }
  return immutableJsonRecord(fields) as T;
}

function encodedMembers(children: readonly (readonly [string, Sized])[]): EncodedCollection<'object'> {
  const members = immutableJsonRecord(children.map(([name, child]) => [name, child.node as JsonValue] as const));
  return immutableJsonRecord([['kind', 'object'], ['members', members]]) as EncodedCollection<'object'>;
}

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
  if (typeof node === 'number') return String(node);
  if (node === null || typeof node !== 'object') return JSON.stringify(node);
  // Scalar envelopes have short fixed layouts. Their strings do not need
  // separate weak-cache entries as part of a larger cached collection.
  if (node.kind === 'float64') return `{"bits":${JSON.stringify(node.bits)},"kind":"float64"}`;
  if (node.kind === 'ref') return `{"id":${JSON.stringify(node.id)},"kind":"ref"}`;
  const cached = encodedText.get(node); if (cached !== undefined) return cached;
  let result: string;
  switch (node.kind) {
    case 'array': {
      const fields = denseIntegerText(node.items) ?? node.items.map(encodedCanonical).join(',');
      result = `{"items":[${fields}],"kind":"array"}`; break;
    }
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
export function splitNativeState(value: unknown, component: string, options: SplitOptions = {}): SplitNativeState {
  assertUnicode(component);
  if (!component) throw new TypeError('A native state component identity is required');
  const limit = options.maxFragmentNodes ?? DEFAULT_BOUND;
  if (!Number.isSafeInteger(limit) || limit < 32 || limit > 65_536) throw new RangeError('Native fragment bound must be between 32 and 65536');
  // Reserve the three scalar/container nodes used by the outer root envelope.
  const bound = limit - 3;
  // The prior graph supplies comparison candidates. Each new raw subtree still
  // passes the surface checks, traversal bounds, and lossless scalar encoding.
  const prior = options.prior && ownedRoots.has(options.prior.root) ? options.prior : undefined;
  const priorNode = (node: Encoded | undefined): Encoded | undefined => {
    if (!node || typeof node !== 'object' || node.kind !== 'ref') return node;
    const found = prior?.readFragment(node.id);
    const fragment = found && typeof found === 'object' ? ownedFragments.get(found) : undefined;
    return fragment?.id === node.id ? fragment.value.node as Encoded : undefined;
  };
  // Follow only the packing structure of this collection. A fragment missing
  // from the current store cannot establish the positions of later chunks.
  const priorChunks = <K extends 'array' | 'object'>(node: Encoded | undefined, group: GroupKind, leaf: K): EncodedCollection<K>[] | undefined => {
    if (node == null || typeof node !== 'object' || node.kind !== group) return;
    const chunks: EncodedCollection<K>[] = [];
    const collect = (part: Encoded): boolean => {
      const resolved = priorNode(part);
      if (resolved == null || typeof resolved !== 'object') return false;
      if (resolved.kind === leaf) {
        chunks.push(resolved as EncodedCollection<K>); return true;
      }
      return resolved.kind === group && resolved.parts.every(collect);
    };
    return node.parts.every(collect) ? chunks : undefined;
  };
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
    const cached = node !== null && typeof node === 'object' ? fragmentsByNode.get(node) : undefined;
    if (cached) { emit(cached.fragment); return cached.reference; }
    const value = immutableJson({ profile: NATIVE_STATE_GRAPH_PROFILE, node }) as JsonObject;
    const bytes = new TextEncoder().encode(`{"node":${encodedCanonical(node)},"profile":${JSON.stringify(NATIVE_STATE_GRAPH_PROFILE)}}`);
    const id = `${NATIVE_STATE_FRAGMENT_PREFIX}${sha256Bytes(bytes)}`;
    const evidence = fragments.get(id) ?? Object.freeze({ id, value });
    const reference: Sized = { node: ownedEncoded({ kind: 'ref', id }), cost: 3 };
    emit(evidence);
    ownedFragments.set(evidence.value, evidence);
    if (node !== null && typeof node === 'object') fragmentsByNode.set(node, { fragment: evidence, reference });
    return reference;
  };
  const combine = (kind: GroupKind, children: Sized[], previous: Encoded | undefined): Sized => {
    // A flat collection can itself be enormous: bound the reference fanout too.
    let parts = children;
    while (3 + parts.reduce((n, part) => n + part.cost, 0) > bound) {
      const next: Sized[] = []; let group: Sized[] = [], cost = 3;
      for (const part of parts) {
        if (cost + part.cost > bound && group.length) { next.push(fragment(ownedEncoded({ kind, parts: group.map(p => p.node) }))); group = []; cost = 3; }
        group.push(part); cost += part.cost;
      }
      if (group.length) next.push(fragment(ownedEncoded({ kind, parts: group.map(p => p.node) })));
      parts = next;
    }
    const reusable = previous != null && typeof previous === 'object' && previous.kind === kind
      && previous.parts.length === parts.length && parts.every((part, index) => sameEncoded(part.node, previous.parts[index]));
    return { node: reusable ? previous : ownedEncoded({ kind, parts: parts.map(p => p.node) }),
      cost: 3 + parts.reduce((n, p) => n + p.cost, 0) };
  };
  const visitRaw = (input: unknown, depth: number, previous?: Encoded): Sized => {
    if (depth > 128) throw new TypeError('Native state nesting exceeds the V7 structural contract');
    if (input === null || typeof input === 'boolean') return { node: input, cost: 1 };
    if (typeof input === 'string') { assertUnicode(input); return { node: input, cost: 1 }; }
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new TypeError('Native state numbers must be finite');
      if (Number.isSafeInteger(input) && !Object.is(input, -0)) return { node: input, cost: 1 };
      const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, input, false);
      const bits = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const before = priorNode(previous);
      return { node: before && typeof before === 'object' && before.kind === 'float64' && before.bits === bits
        ? before : ownedEncoded({ kind: 'float64', bits }), cost: 3 };
    }
    if (typeof input !== 'object') throw new TypeError('Native state requires explicit JSON values');
    if (!Array.isArray(input) && !isJsonObject(input)) throw new TypeError('Native state requires plain objects and arrays');
    if (ancestors.has(input)) throw new TypeError('Cyclic native state is unsupported');
    ancestors.add(input);
    try {
      const array = Array.isArray(input);
      let entries: [string, unknown][];
      if (isOwnedImmutableJson(input)) {
        // A private immutableJson identity already certifies the complete own
        // property domain. Raw numbers and nesting still pass visit below.
        entries = Object.entries(input);
      } else {
        if (Object.getOwnPropertySymbols(input).length) throw new TypeError('Symbolic native state members are unsupported');
        entries = [];
        for (const name of Object.getOwnPropertyNames(input)) {
          const descriptor = Object.getOwnPropertyDescriptor(input, name);
          if (!descriptor) continue;
          if (array && name === 'length') continue;
          entries.push([name, descriptor]);
        }
        let orderedArray = true;
        for (let index = 0; index < entries.length; index++) {
          const entry = entries[index]!, name = entry[0], descriptor = entry[1] as PropertyDescriptor;
          assertUnicode(name);
          if (!('value' in descriptor) || !descriptor.enumerable) throw new TypeError('Native state requires enumerable data properties');
          entry[1] = descriptor.value;
          if (array && name !== String(index)) orderedArray = false;
        }
        if (array) {
          if (entries.length !== input.length) throw new TypeError('Sparse or decorated native arrays are unsupported');
          if (!orderedArray) {
            entries.sort(([a], [b]) => Number(a) - Number(b));
            if (entries.some(([name], index) => name !== String(index))) throw new TypeError('Sparse or decorated native arrays are unsupported');
          }
        }
      }
      const before = priorNode(previous);
      if (array) {
        const priorArray = before && typeof before === 'object' && before.kind === 'array' ? before : undefined;
        const chunks = priorChunks(before, 'concat', 'array');
        const priorAt = chunks && new Map<number, EncodedCollection<'array'>>();
        let offset = 0;
        const priorItems = priorArray?.items ?? chunks?.flatMap(chunk => {
          priorAt!.set(offset, chunk);
          offset += chunk.items.length;
          return chunk.items;
        });
        // Portable integers contribute one node and no fragment each. Dense
        // raster rows can be encoded without allocating a Sized leaf per pixel.
        // The property snapshot above remains the only source of input values.
        const flatCost = 3 + entries.length;
        if (flatCost <= bound && entries.every(([, value]) => typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0))) {
          if (entries.length) {
            if (depth === 128) throw new TypeError('Native state nesting exceeds the V7 structural contract');
            note(0, true);
          }
          const node = priorArray?.items.length === entries.length && entries.every(([, value], index) => value === priorArray.items[index])
            ? priorArray : ownedEncoded({ kind: 'array', items: entries.map(([, value]) => value as number) });
          return { node, cost: flatCost };
        }
        const children = entries.map(([, value], index) => visit(value, depth + 1, priorItems?.[index]));
        const cost = 3 + children.reduce((n, child) => n + child.cost, 0);
        if (cost <= bound) {
          const node = priorArray?.items.length === children.length && children.every((child, i) => sameEncoded(child.node, priorArray.items[i]))
            ? priorArray : ownedEncoded({ kind: 'array' as const, items: children.map(child => child.node) });
          const pixelMatrix = input.length > 0 && input.every(row => Array.isArray(row) && row.length > 0 && row.every(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 255));
          if (pixelMatrix && cost >= 512) {
            return fragment(node);
          }
          return { node, cost };
        }
        const groups: Sized[] = []; let group: Sized[] = [], groupCost = 3, start = 0;
        const appendGroup = (): void => {
          const candidate = priorAt?.get(start);
          const reusable = candidate?.items.length === group.length && group.every((child, i) => sameEncoded(child.node, candidate.items[i]));
          groups.push(fragment(reusable ? candidate : ownedEncoded({ kind: 'array', items: group.map(child => child.node) })));
          start += group.length;
          group = []; groupCost = 3;
        };
        for (let child of children) {
          if (child.cost + 3 > bound) child = fragment(child.node);
          if (groupCost + child.cost > bound && group.length) appendGroup();
          group.push(child); groupCost += child.cost;
        }
        if (group.length) appendGroup();
        return combine('concat', groups, before);
      }
      const priorObject = before && typeof before === 'object' && before.kind === 'object' ? before : undefined;
      const chunks = priorChunks(before, 'merge', 'object');
      const priorAt = chunks && new Map<string, EncodedCollection<'object'>>();
      if (priorAt) {
        for (const chunk of chunks!) for (const name of Object.keys(chunk.members)) priorAt.set(name, chunk);
      }
      const children = entries.sort(([a], [b]) => compareUnicode(a, b)).map(([name, value]) => {
        const candidate = priorObject ?? priorAt?.get(name);
        return [name, visit(value, depth + 1, candidate && Object.hasOwn(candidate.members, name) ? candidate.members[name] : undefined)] as const;
      });
      const cost = 3 + children.reduce((n, [, child]) => n + child.cost, 0);
      if (cost <= bound) {
        const node = priorObject && Object.keys(priorObject.members).length === children.length
          && children.every(([name, child]) => Object.hasOwn(priorObject.members, name) && sameEncoded(child.node, priorObject.members[name]))
          ? priorObject : encodedMembers(children);
        return { node, cost };
      }
      const groups: Sized[] = []; let group: (readonly [string, Sized])[] = [], groupCost = 3;
      const appendGroup = (): void => {
        const candidate = priorAt?.get(group[0]![0]);
        const reusable = candidate && Object.keys(candidate.members).length === group.length
          && group.every(([name, child]) => Object.hasOwn(candidate.members, name) && sameEncoded(child.node, candidate.members[name]));
        groups.push(fragment(reusable ? candidate : encodedMembers(group)));
        group = []; groupCost = 3;
      };
      for (const [name, original] of children) {
        const child = original.cost + 3 > bound ? fragment(original.node) : original;
        if (groupCost + child.cost > bound && group.length) appendGroup();
        group.push([name, child]); groupCost += child.cost;
      }
      if (group.length) appendGroup();
      return combine('merge', groups, before);
    } finally { ancestors.delete(input); }
  };
  const visit = (input: unknown, depth: number, previous?: Encoded): Sized => {
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
      try { value = visitRaw(input, depth, previous); } finally { metrics.pop(); }
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
    const value = visitRaw(input, depth, previous); note(0, true); return value;
  };
  const encoded = visit(value, 0, prior?.root.root as Encoded | undefined);
  const root = prior?.root.component === component && encoded.node === prior.root.root ? prior.root
    : immutableJson({ profile: NATIVE_STATE_GRAPH_PROFILE, component, root: encoded.node as JsonValue }) as NativeStateGraphRoot;
  ownedRoots.add(root);
  if (value !== null && typeof value === 'object'
      && (measured.get(value)?.immutable || frozenStateNodes.get(value)?.limit === limit)) {
    validatedFrozenSources.add(value);
  }
  return Object.freeze({ root, fragments: Object.freeze([...fragments.values()]) });
}

export function isNativeStateGraph(value: unknown): value is NativeStateGraphRoot {
  return isJsonObject(value) && value.profile === NATIVE_STATE_GRAPH_PROFILE && typeof value.component === 'string' && Object.hasOwn(value, 'root');
}

/** Read the actual V7 fragments, verify content identity, and restore immutable values. */
export function hydrateNativeState(root: unknown, readFragment: (id: string) => unknown): JsonValue {
  if (!isNativeStateGraph(root) || Object.keys(root).length !== 3) throw new TypeError('Invalid native state graph root');
  const visiting = new Set<string>(), cache = new Map<string, HydratedFragment>();
  let measure: { base: number; height: number; weight: number; terminal: boolean } | null = null;
  const exact = (object: JsonObject, fields: readonly string[]): void => {
    if (Object.keys(object).length !== fields.length || fields.some(field => !Object.hasOwn(object, field))) throw new TypeError('Malformed native state graph node');
  };
  const referenced = (entry: HydratedFragment, depth: number): JsonValue => {
    if (depth + 1 + entry.height > 512) throw new TypeError('Native state reference nesting exceeds the structural contract');
    if (measure) measure.height = Math.max(measure.height, depth + 1 + entry.height - measure.base);
    return entry.value;
  };
  const decode = (value: unknown, depth: number): JsonValue => {
    if (depth > 512) throw new TypeError('Native state reference nesting exceeds the structural contract');
    if (measure) {
      measure.height = Math.max(measure.height, depth - measure.base);
      measure.weight += 64 + (typeof value === 'string' ? 2 * value.length : 0);
    }
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
      if (measure) measure.terminal = false;
      // A resolver is called once per id in this hydration, as before. A cached
      // cross-root leaf still requires this authoritative read. Its deeply
      // immutable identity and the same id certify the previously checked
      // profile/content hash; every other object/id takes the full boundary.
      const found = cache.get(id); if (found !== undefined) return referenced(found, depth);
      const fragment = readFragment(id);
      if (!isJsonObject(fragment)) throw new TypeError('Native state fragment digest mismatch or missing fragment');
      const retained = hydratedLeaves.get(fragment);
      if (retained?.id === id) { cache.set(id, retained); return referenced(retained, depth); }
      // The encoder hashed the exact immutable payload of an owned fragment.
      // The resolver still supplies it and must resolve each descendant below.
      const owned = ownedFragments.get(fragment);
      if (owned ? owned.id !== id : fragment.profile !== NATIVE_STATE_GRAPH_PROFILE
        || !Object.hasOwn(fragment, 'node') || Object.keys(fragment).length !== 2
        || `${NATIVE_STATE_FRAGMENT_PREFIX}${symbolicDigest(fragment, false)}` !== id) {
        throw new TypeError('Native state fragment digest mismatch or missing fragment');
      }
      const parent = measure;
      const current = { base: depth + 1, height: 0, weight: 256, terminal: true };
      measure = current;
      visiting.add(id);
      let result: HydratedFragment;
      try {
        result = { value: decode(fragment.node, depth + 1), height: current.height };
        cache.set(id, result);
        if (current.terminal && isOwnedImmutableJson(fragment)) hydratedLeaves.set(fragment, { id, ...result }, current.weight);
      } finally { visiting.delete(id); measure = parent; }
      return referenced(result, depth);
    }
    if (value.kind === 'array') {
      exact(value, ['kind', 'items']); const items = value.items;
      if (!Array.isArray(items)) throw new TypeError('Invalid native array items');
      // A raw graph may supply an Array subclass or an own `map` method. Build
      // our own dense container; neither caller methods nor Symbol.species may
      // choose the object whose deep immutability is certified below.
      const output: JsonValue[] = [], length = items.length;
      for (let index = 0; index < length; index++) output.push(decode(items[index], depth + 1));
      return freezeHydrated(output);
    }
    if (value.kind === 'object') {
      exact(value, ['kind', 'members']); if (!isJsonObject(value.members)) throw new TypeError('Invalid native object members');
      return freezeHydrated(Object.fromEntries(Object.entries(value.members).map(([name, item]) => {
        assertUnicode(name); if (measure) measure.weight += 2 * name.length;
        return [name, decode(item, depth + 1)];
      })));
    }
    if (value.kind === 'concat' || value.kind === 'merge') {
      exact(value, ['kind', 'parts']); const encodedParts = value.parts;
      if (!Array.isArray(encodedParts) || !encodedParts.length) throw new TypeError('Invalid native state groups');
      const parts: JsonValue[] = [], length = encodedParts.length;
      for (let index = 0; index < length; index++) parts.push(decode(encodedParts[index], depth + 1));
      if (value.kind === 'concat') {
        if (parts.some(part => !Array.isArray(part))) throw new TypeError('Native array group contains a non-array');
        const output: JsonValue[] = [];
        for (const part of parts as (readonly JsonValue[])[]) {
          for (let index = 0; index < part.length; index++) output.push(part[index]!);
        }
        return freezeHydrated(output);
      }
      const output: Record<string, JsonValue> = Object.create(null);
      for (const part of parts) {
        if (!isJsonObject(part)) throw new TypeError('Native object group contains a non-object');
        for (const [name, item] of Object.entries(part)) { if (Object.hasOwn(output, name)) throw new TypeError('Duplicate native object member across groups'); output[name] = item; }
      }
      return freezeHydrated({ ...output });
    }
    throw new TypeError('Unknown native graph node kind');
  };
  return decode(root.root, 0);
}
