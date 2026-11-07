import type { CallContext, JsonObject, JsonValue, Primitive } from './ir.ts';
import { arrayValue, canonical, compareUnicode, digest, equal, exactKeys, immutableJson, isJsonObject, objectValue, ownValue, stringValue } from './canonical.ts';

export { equal } from './canonical.ts';

export interface KnowledgeNode extends JsonObject {
  readonly id: string;
  readonly kind: string;
  readonly revision: number;
  readonly status: string;
  readonly scope: string;
  readonly origin: JsonObject;
  readonly evidence: readonly JsonValue[];
}

export interface DeltaCause extends JsonObject {
  readonly workflow: string;
  readonly step: string;
  readonly statement: string;
}

export interface KnowledgeDelta extends JsonObject {
  readonly sequence: number;
  readonly previous: string | null;
  readonly node: KnowledgeNode;
  readonly cause: DeltaCause;
  readonly source_digest: string;
  readonly digest: string;
}

export interface KnowledgeMemory extends JsonObject {
  readonly nodes: Readonly<Record<string, KnowledgeNode>>;
  readonly deltas: readonly KnowledgeDelta[];
  readonly chain: string | null;
}

export interface DependencyBlocker extends JsonObject {
  readonly node: string;
  readonly reason: 'missing_dependency' | 'disabled_node' | 'disabled_kind';
}

export function emptyMemory(): KnowledgeMemory {
  return immutableJson({ nodes: {}, deltas: [], chain: null }) as KnowledgeMemory;
}

/** Shallow bridge assertion; graphs created by Kernel are already recursively immutable. */
export function memoryValue(value: unknown): KnowledgeMemory {
  const memory = objectValue(value, 'memory');
  exactKeys(memory, ['nodes', 'deltas', 'chain'], 'memory');
  objectValue(memory.nodes, 'memory.nodes');
  arrayValue(memory.deltas, 'memory.deltas');
  if (memory.chain !== null && typeof memory.chain !== 'string') throw new TypeError('Malformed graph chain');
  return memory as KnowledgeMemory;
}

function strings(value: unknown, label: string): readonly string[] {
  return arrayValue(value, label).map(item => stringValue(item, label));
}

function bindingMap(bindings: JsonValue): JsonObject {
  if (isJsonObject(bindings)) return bindings;
  return Object.fromEntries(arrayValue(bindings, 'bindings').map(pair => {
    const entry = arrayValue(pair, 'binding');
    if (entry.length !== 2) throw new TypeError('A binding must contain a name and value');
    return [stringValue(entry[0], 'binding name'), entry[1]!];
  }));
}

export function resolve(pattern: JsonValue, bindings: JsonObject): JsonValue {
  if (typeof pattern === 'string' && pattern.startsWith('$')) {
    const path = pattern.slice(1).split('.');
    let result: JsonValue = ownValue(bindings, path[0]!);
    for (const key of path.slice(1)) result = ownValue(objectValue(result, 'binding path'), key);
    return result;
  }
  if (Array.isArray(pattern)) return pattern.map(item => resolve(item, bindings));
  if (isJsonObject(pattern)) return Object.fromEntries(Object.entries(pattern).map(([key, value]) => [key, resolve(value, bindings)]));
  return pattern;
}

export function substitute(pattern: JsonValue, bindings: JsonValue): JsonValue {
  return immutableJson(resolve(pattern, bindingMap(bindings)));
}

export function difference(before: JsonObject, after: JsonObject): JsonObject {
  const beforeKeys = Object.keys(before);
  if (beforeKeys.length !== Object.keys(after).length || beforeKeys.some(key => !Object.hasOwn(after, key))) {
    throw new TypeError('Changing observation field domain is unsupported, not a negative fact');
  }
  return immutableJson(Object.fromEntries(Object.entries(after).filter(([key, value]) => !equal(ownValue(before, key), value))));
}

export function intersection(left: JsonObject, right: JsonObject): JsonObject {
  return immutableJson(Object.fromEntries(Object.keys(left).sort(compareUnicode)
    .filter(key => Object.hasOwn(right, key) && equal(ownValue(left, key), ownValue(right, key)))
    .map(key => [key, ownValue(left, key)])));
}

export function less(left: JsonValue, right: JsonValue): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
      if (!equal(left[index], right[index])) return less(left[index]!, right[index]!);
    }
    return left.length < right.length;
  }
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right) < 0;
  if (typeof left === 'number' && typeof right === 'number') { canonical(left); canonical(right); return left < right; }
  throw new TypeError('Ordering requires compatible measured scalars');
}

function selectorsMatch(item: JsonObject, selectors: readonly JsonValue[]): boolean {
  return selectors.every(selector => {
    const pair = arrayValue(selector, 'selector');
    if (pair.length !== 2) throw new TypeError('Selector requires a field and expected value');
    const key = stringValue(pair[0], 'selector field');
    return Object.hasOwn(item, key) && equal(item[key], pair[1]);
  });
}

export function matching(items: readonly JsonValue[], selectors: readonly JsonValue[]): readonly JsonObject[] {
  return immutableJson(items.map(item => objectValue(item, 'matching item')).filter(item => selectorsMatch(item, selectors)));
}

export function countMatching(items: readonly JsonValue[], selectors: readonly JsonValue[]): number {
  return items.reduce<number>((count, item) => count + Number(selectorsMatch(objectValue(item, 'matching item'), selectors)), 0);
}

/** Python min/max scalar order; equality for returned ties remains the typed V7 equality. */
function extremeOrder(left: JsonValue, right: JsonValue): number {
  if ((typeof left === 'number' || typeof left === 'boolean') && (typeof right === 'number' || typeof right === 'boolean')) {
    canonical(left); canonical(right);
    return Number(left) === Number(right) ? 0 : Number(left) < Number(right) ? -1 : 1;
  }
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right);
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
      if (equal(left[index], right[index])) continue;
      const order = extremeOrder(left[index]!, right[index]!);
      if (order !== 0) return order;
    }
    return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
  }
  throw new TypeError('Extrema require comparable measured scalars or sequences');
}

export function extreme(items: readonly JsonValue[], field: string, maximize: boolean): readonly JsonObject[] {
  if (!items.length) return immutableJson([]);
  const records = items.map(item => objectValue(item, 'extreme item'));
  let target = ownValue(records[0]!, field);
  for (const item of records.slice(1)) {
    const candidate = ownValue(item, field);
    const order = extremeOrder(candidate, target);
    if (maximize ? order > 0 : order < 0) target = candidate;
  }
  return immutableJson(records.filter(item => equal(ownValue(item, field), target)));
}

type Term = readonly ['variable', string] | readonly ['constant', string, JsonValue]
  | readonly ['sequence', readonly Term[]] | readonly ['mapping', readonly (readonly [string, Term])[]];

export function unify(left: JsonValue, right: JsonValue): JsonObject {
  const bindings = new Map<string, Term>();
  function term(value: JsonValue, namespace: string): Term {
    if (isJsonObject(value)) {
      if (Object.keys(value).length === 1 && Object.hasOwn(value, 'variable')) return ['variable', `${namespace}.${stringValue(value.variable, 'variable name')}`];
      return ['mapping', Object.keys(value).sort(compareUnicode).map(key => [key, term(ownValue(value, key), namespace)] as const)];
    }
    if (Array.isArray(value)) return ['sequence', value.map(item => term(item, namespace))];
    canonical(value);
    return ['constant', value === null ? 'NoneType' : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'str', value];
  }
  function walk(value: Term): Term {
    while (value[0] === 'variable' && bindings.has(value[1])) value = bindings.get(value[1])!;
    return value;
  }
  function occurs(name: string, value: Term): boolean {
    value = walk(value);
    if (value[0] === 'variable') return value[1] === name;
    if (value[0] === 'sequence') return value[1].some(item => occurs(name, item));
    if (value[0] === 'mapping') return value[1].some(([, item]) => occurs(name, item));
    return false;
  }
  function join(first: Term, second: Term): boolean {
    const a = walk(first), b = walk(second);
    if (equal(a, b)) return true;
    if (a[0] === 'variable') {
      if (occurs(a[1], b)) return false;
      bindings.set(a[1], b);
      return true;
    }
    if (b[0] === 'variable') return join(b, a);
    if (a[0] === 'sequence' && b[0] === 'sequence') {
      return a[1].length === b[1].length && a[1].every((item, index) => join(item, b[1][index]!));
    }
    if (a[0] === 'mapping' && b[0] === 'mapping') {
      return a[1].length === b[1].length && a[1].every((pair, index) => pair[0] === b[1][index]![0])
        && a[1].every(([, item], index) => join(item, b[1][index]![1]));
    }
    return false;
  }
  const matched = join(term(left, 'first'), term(right, 'second'));
  return immutableJson({ matched, bindings: matched ? [...bindings.entries()].sort(([a], [b]) => compareUnicode(a, b)).map(([key, value]) => [key, walk(value)]) : [] });
}

export function blockers(memory: KnowledgeMemory, identity: string, selection: JsonObject, dependencyFields: JsonObject): readonly DependencyBlocker[] {
  const disabledNodes = new Set(strings(selection.disabled_nodes, 'disabled_nodes'));
  const disabledKinds = new Set(strings(selection.disabled_kinds, 'disabled_kinds'));
  const pending = [identity], visited = new Set<string>(), result: DependencyBlocker[] = [];
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const node = Object.hasOwn(memory.nodes, current) ? memory.nodes[current] : undefined;
    const reason = node === undefined ? 'missing_dependency' : disabledNodes.has(current) ? 'disabled_node'
      : disabledKinds.has(node.kind) ? 'disabled_kind' : null;
    if (reason) { result.push({ node: current, reason }); continue; }
    const fields = Object.hasOwn(dependencyFields, node!.kind) ? strings(dependencyFields[node!.kind], 'dependency fields') : [];
    for (const field of fields) {
      const references = ownValue(node!, field);
      pending.push(...(typeof references === 'string' ? [references] : strings(references, 'declared node dependencies')));
    }
  }
  return immutableJson(result.sort((a, b) => compareUnicode(a.node, b.node) || compareUnicode(a.reason, b.reason)));
}

export class Kernel {
  readonly logos: JsonObject;
  readonly drm: JsonObject;
  readonly sourceDigest: string;
  readonly primitives: Readonly<Record<string, Primitive>>;

  constructor(logos: unknown, drm: unknown, sourceDigest: string, profile: { maxDeclaredNodes?: number } = {}) {
    this.logos = objectValue(immutableJson(logos), 'Logos declaration');
    this.drm = objectValue(immutableJson(drm), 'DRM declaration');
    this.sourceDigest = stringValue(sourceDigest, 'source digest');
    objectValue(this.logos.kinds, 'Logos kinds');
    strings(this.logos.node_fields, 'Logos fields');
    strings(this.logos.statuses, 'Logos statuses');
    objectValue(this.drm.templates, 'DRM templates');
    const nodeLimit = ownValue(objectValue(this.drm.limits, 'DRM limits'), 'nodes');
    const ceiling = profile.maxDeclaredNodes ?? 512;
    if (!Number.isSafeInteger(ceiling) || ceiling < 1 || ceiling > 1_000_000) throw new TypeError('Invalid explicit kernel node ceiling');
    if (typeof nodeLimit !== 'number' || !Number.isSafeInteger(nodeLimit) || nodeLimit < 1 || nodeLimit > ceiling) throw new TypeError(`Invalid declared node budget (1..${ceiling})`);
    this.primitives = this.createPrimitives();
  }

  async identity(template: string, bindings: JsonValue): Promise<string> {
    const declaration = objectValue(ownValue(objectValue(this.drm.templates), template), 'node template');
    return `node:${await digest(resolve(ownValue(declaration, 'identity'), bindingMap(bindings)))}`;
  }

  validateNode(node: JsonObject): void {
    const kind = stringValue(node.kind, 'node kind');
    const kinds = objectValue(this.logos.kinds);
    if (!Object.hasOwn(kinds, kind)) throw new TypeError('Undeclared node kind');
    const required = [...strings(this.logos.node_fields, 'common node fields'), ...strings(kinds[kind], 'kind fields')];
    if (required.some(field => !Object.hasOwn(node, field)) || !strings(this.logos.statuses, 'statuses').includes(stringValue(node.status, 'node status'))) {
      throw new TypeError('Node violates the declared Logos contract');
    }
    stringValue(node.id, 'node identity');
    if (typeof node.revision !== 'number' || !Number.isSafeInteger(node.revision) || node.revision < 0) throw new TypeError('Invalid node revision');
  }

  async commit(memory: KnowledgeMemory, node: JsonObject, cause: DeltaCause): Promise<KnowledgeMemory> {
    memory = memoryValue(immutableJson(memory));
    this.validateNode(node);
    const identity = stringValue(node.id);
    const old = Object.hasOwn(memory.nodes, identity) ? memory.nodes[identity] : undefined;
    if (old !== undefined && equal(old, node)) return memory;
    const nodeLimit = objectValue(this.drm.limits).nodes as number;
    if (old === undefined && Object.keys(memory.nodes).length >= nodeLimit) throw new RangeError('Declared node budget exhausted');
    const updated = immutableJson({ ...node, revision: old === undefined ? 1 : old.revision + 1 }) as KnowledgeNode;
    const delta = immutableJson({ sequence: memory.deltas.length + 1, previous: memory.chain, node: updated, cause, source_digest: this.sourceDigest });
    const chain = await digest(delta);
    return immutableJson({ nodes: { ...memory.nodes, [identity]: updated }, deltas: [...memory.deltas, { ...delta, digest: chain }], chain }) as KnowledgeMemory;
  }

  async emit(memory: KnowledgeMemory, template: string, bindings: JsonValue, cause: DeltaCause): Promise<KnowledgeMemory> {
    memory = memoryValue(immutableJson(memory));
    bindings = immutableJson(bindings);
    const identity = await this.identity(template, bindings);
    if (Object.hasOwn(memory.nodes, identity)) return memory;
    const declaration = objectValue(ownValue(objectValue(this.drm.templates), template));
    const body = objectValue(resolve(ownValue(declaration, 'body'), bindingMap(bindings)), 'template body');
    return this.commit(memory, { ...body, id: identity, revision: 0, origin: { template, source_digest: this.sourceDigest, ...cause } }, cause);
  }

  async assign(memory: KnowledgeMemory, identity: string, field: string, value: JsonValue, cause: DeltaCause): Promise<KnowledgeMemory> {
    if (['id', 'kind', 'origin', 'revision', 'scope'].includes(field)) throw new TypeError('Immutable identity/provenance field');
    const node = objectValue(ownValue(memory.nodes, identity), 'node');
    if (!Object.hasOwn(node, field)) throw new TypeError('Undeclared field');
    return this.commit(memory, { ...node, [field]: value }, cause);
  }

  async appendUnique(memory: KnowledgeMemory, identity: string, field: string, value: JsonValue, cause: DeltaCause): Promise<KnowledgeMemory> {
    const items = arrayValue(ownValue(objectValue(ownValue(memory.nodes, identity)), field), 'append_unique field');
    if (items.some(item => equal(item, value))) return memory;
    return this.assign(memory, identity, field, [...items, value], cause);
  }

  select(memory: KnowledgeMemory, kind: string): readonly KnowledgeNode[] {
    return immutableJson(Object.keys(memory.nodes).sort(compareUnicode).map(id => memory.nodes[id]!).filter(node => node.kind === kind));
  }

  selectActive(memory: KnowledgeMemory, kind: string, selection: JsonObject, dependencyFields: JsonObject): readonly KnowledgeNode[] {
    return immutableJson(this.select(memory, kind).filter(node => !blockers(memory, node.id, selection, dependencyFields).length));
  }

  private createPrimitives(): Readonly<Record<string, Primitive>> {
    const registry: Record<string, Primitive> = {};
    const cause = (context: CallContext): DeltaCause => ({ workflow: context.workflowId, step: context.stepId, statement: context.statementId });
    const add = (name: string, parameters: readonly string[], implementation: Primitive) => {
      registry[`v7.${name}`] = (arguments_, context) => {
        exactKeys(arguments_, parameters, `v7.${name}`);
        if (context.signal?.aborted) throw new DOMException('Execution cancelled', 'AbortError');
        return implementation(arguments_, context);
      };
    };
    add('identity', ['template', 'bindings'], a => this.identity(stringValue(a.template), a.bindings!));
    add('emit', ['memory', 'template', 'bindings'], (a, c) => this.emit(memoryValue(a.memory), stringValue(a.template), a.bindings!, cause(c)));
    add('assign', ['memory', 'identity', 'field', 'value'], (a, c) => this.assign(memoryValue(a.memory), stringValue(a.identity), stringValue(a.field), a.value!, cause(c)));
    add('append_unique', ['memory', 'identity', 'field', 'value'], (a, c) => this.appendUnique(memoryValue(a.memory), stringValue(a.identity), stringValue(a.field), a.value!, cause(c)));
    add('select', ['memory', 'kind'], a => this.select(memoryValue(a.memory), stringValue(a.kind)));
    add('select_active', ['memory', 'kind', 'selection', 'dependency_fields'], a => this.selectActive(memoryValue(a.memory), stringValue(a.kind), objectValue(a.selection), objectValue(a.dependency_fields)));
    add('absent', ['memory', 'identity'], a => !Object.hasOwn(memoryValue(a.memory).nodes, stringValue(a.identity)));
    add('contains', ['items', 'value'], a => arrayValue(a.items).some(item => equal(item, a.value)));
    add('nonempty', ['items'], a => Array.isArray(a.items) || typeof a.items === 'string' ? a.items.length > 0 : Object.keys(objectValue(a.items)).length > 0);
    add('equal', ['left', 'right'], a => equal(a.left, a.right));
    add('distinct', ['left', 'right'], a => !equal(a.left, a.right));
    add('value', ['value'], a => a.value!);
    add('difference', ['before', 'after'], a => difference(objectValue(a.before), objectValue(a.after)));
    add('intersection', ['left', 'right'], a => intersection(objectValue(a.left), objectValue(a.right)));
    add('get', ['mapping', 'key'], a => ownValue(objectValue(a.mapping), stringValue(a.key)));
    add('count_matching', ['items', 'selectors'], a => countMatching(arrayValue(a.items), arrayValue(a.selectors)));
    add('less', ['left', 'right'], a => less(a.left!, a.right!));
    add('substitute', ['pattern', 'bindings'], a => substitute(a.pattern!, a.bindings!));
    add('concatenate', ['left', 'right'], a => immutableJson([...arrayValue(a.left), ...arrayValue(a.right)]));
    add('matching', ['items', 'selectors'], a => matching(arrayValue(a.items), arrayValue(a.selectors)));
    add('extreme', ['items', 'field', 'maximize'], a => {
      if (typeof a.maximize !== 'boolean') throw new TypeError('maximize must be a Boolean');
      return extreme(arrayValue(a.items), stringValue(a.field), a.maximize);
    });
    add('unify', ['left', 'right'], a => unify(a.left!, a.right!));
    return Object.freeze(registry);
  }
}
