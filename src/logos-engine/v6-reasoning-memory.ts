/** Native transfer of catalog.py / memory.py, ready for common V7 state persistence. */
import transferred from './v6/catalog.json' with { type: 'json' };
import { compareUnicode } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';

export interface CatalogOperation {
  readonly key: string; readonly name: string; readonly description: string;
  readonly authority_refs: readonly string[]; readonly scope: string;
}
export interface CatalogNode { key: string; address: string; line: number; text: string }
export interface CatalogEdge { src: string; relation: string; dst: string }
export interface ReasoningFact { episode: string; key: string; value: any; evidence: string; revision: number }
export interface ReasoningTrace { id: number; episode: string; kind: string; body: any; created: number }
export interface ReasoningMemoryState {
  schema: 'logos-engine.v6.reasoning-memory.v1';
  meta: Record<string, string>; nodes: CatalogNode[]; edges: CatalogEdge[];
  operations: CatalogOperation[]; facts: ReasoningFact[]; traces: ReasoningTrace[];
  archive: { key: string; body: string; tokens: number }[];
}
export type ReasoningDynamicState = Pick<ReasoningMemoryState, 'facts' | 'traces'>;
export interface ReasoningNativeCheckpoint {
  readonly revision: number;
  readonly facts: readonly { readonly version: number; readonly record: ReasoningFact }[];
  readonly traces: readonly { readonly version: number; readonly record: ReasoningTrace }[];
}
export interface NavigationExcerpt { key: string; address: string; line: number; navigation_excerpt: string; excerpt_only: boolean }
export interface ReasoningWindow {
  current: NavigationExcerpt;
  neighbors: (NavigationExcerpt & { relation: string })[];
  remaining_neighbors: number; adjacency_is_not_permission: true;
}
const copy = <T>(value: T): T => structuredClone(value);
function freezeOwned<T>(value: T, seen = new WeakSet<object>()): T {
  if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value); for (const child of Object.values(value)) freezeOwned(child, seen); Object.freeze(value);
  }
  return value;
}
export const TREE_SHA256 = transferred.treeSha256;
export const RECONCILIATION_SHA256 = transferred.reconciliationSha256;
export const OPERATIONS: Readonly<Record<string, CatalogOperation>> = Object.freeze(Object.fromEntries(
  Object.entries(transferred.operations).map(([key, value]) => [key, Object.freeze({ ...value, authority_refs: Object.freeze([...value.authority_refs]) })])));
export const V6_CATALOG_SOURCE_HASHES: Readonly<Record<string, string>> = Object.freeze({ ...transferred.sourceHashes });

/**
 * The storage boundary replaces SQLite, not its reasoning semantics. State is
 * explicit so the V7 runtime can restore it before execution and commit it as
 * revisioned knowledge afterwards. No game, Python interpreter or hidden files
 * are reachable from this class. All reads return owned copies.
 */
export class NativeReasoningMemory {
  private meta: Record<string, string> = {};
  private nodes = new Map<string, CatalogNode>();
  private edges = new Map<string, CatalogEdge>();
  private operations = new Map<string, CatalogOperation>();
  private facts = new Map<string, ReasoningFact>();
  private traces: ReasoningTrace[] = [];
  private archive = new Map<string, { key: string; body: string; tokens: number }>();
  private closed = false;
  private readonly clock: () => number;
  private nativeRevision = 0;
  private factVersions = new Map<string, number>();
  private traceVersions = new Map<number, number>();
  constructor(options: { clock?: () => number } = {}) { this.clock = options.clock ?? (() => Date.now() / 1000); }
  private available(): void { if (this.closed) throw new Error('Reasoning memory is closed'); }
  close(): void { this.closed = true; }

  importCatalog(): { nodes: number; operations: number; tree_sha256: string } {
    this.available();
    for (const node of transferred.nodes) this.nodes.set(node.key, copy(node));
    for (const edge of transferred.edges) this.edges.set(JSON.stringify([edge.src, edge.relation, edge.dst]), copy(edge));
    for (const operation of Object.values(OPERATIONS)) this.operations.set(operation.key, copy(operation));
    this.meta.tree_sha = TREE_SHA256; this.meta.reconciliation_sha = RECONCILIATION_SHA256;
    return { nodes: transferred.nodes.length, operations: Object.keys(OPERATIONS).length, tree_sha256: TREE_SHA256 };
  }

  window(key: string): ReasoningWindow {
    this.available(); const current = this.nodes.get(key);
    if (!current) throw new RangeError(`Unknown reasoning node: ${key}`);
    const view = (record: CatalogNode): NavigationExcerpt => {
      // Python string slices/counts Unicode code points, not UTF-16 units.
      const characters = [...record.text];
      return { key: record.key, address: record.address, line: record.line, navigation_excerpt: characters.slice(0, 180).join(''), excerpt_only: characters.length > 180 };
    };
    const edges = [...this.edges.values()].filter(edge => edge.src === key)
      .sort((a, b) => compareUnicode(a.relation, b.relation) || compareUnicode(a.dst, b.dst));
    return { current: view(current), neighbors: edges.slice(0, 6).map(edge => {
      const target = this.nodes.get(edge.dst);
      if (!target) throw new Error(`Reasoning edge has no target: ${edge.dst}`);
      return { relation: edge.relation, ...view(target) };
    }), remaining_neighbors: Math.max(0, edges.length - 6), adjacency_is_not_permission: true };
  }

  jump(episode: string, sourceKey: string, targetKey: string, observationRevision: number): ReasoningWindow {
    const target = this.window(targetKey);
    this.trace(episode, 'cognitive_jump', { from: sourceKey, to: targetKey, observation_revision: observationRevision, game_undo: false });
    return target;
  }

  put(episode: string, key: string, value: any, evidence = 'fixture', revision = 1): void {
    this.available(); const id = JSON.stringify([episode, key]);
    this.facts.set(id, freezeOwned({ episode, key, value: copy(value), evidence, revision }));
    this.factVersions.set(id, ++this.nativeRevision);
  }
  get(episode: string, key: string): { value: any; evidence: string; revision: number } {
    this.available(); const fact = this.facts.get(JSON.stringify([episode, key]));
    if (!fact) throw new RangeError(`Unknown reasoning fact: ${episode}/${key}`);
    return { value: copy(fact.value), evidence: fact.evidence, revision: fact.revision };
  }
  /** Read-only native view; source get() continues to return an independent copy. */
  nativeGet(episode: string, key: string): Readonly<ReasoningFact> {
    this.available(); const fact = this.facts.get(JSON.stringify([episode, key]));
    if (!fact) throw new RangeError(`Unknown reasoning fact: ${episode}/${key}`);
    return retainNativeJson(fact);
  }
  /** Preserve unchanged immutable branches when a native fact receives a delta. */
  nativePut(episode: string, key: string, value: any, evidence = 'fixture', revision = 1): void {
    this.available(); const id = JSON.stringify([episode, key]);
    this.facts.set(id, retainNativeJson({ episode, key, value, evidence, revision }));
    this.factVersions.set(id, ++this.nativeRevision);
  }
  trace(episode: string, kind: string, value: any): void {
    this.available(); const id = (this.traces[this.traces.length - 1]?.id ?? 0) + 1;
    this.traces.push(freezeOwned({ id, episode, kind, body: copy(value), created: this.clock() }));
    this.traceVersions.set(id, ++this.nativeRevision);
  }
  seedArchive(tokenizer: { encode(text: string, options: { add_special_tokens: false }): readonly unknown[] }, minimumTokens = 100_000): { records: number; tokens: number; synthetic: true } {
    this.available(); let count = 0;
    for (let i = 0; i < 10_000; i++) {
      const text = `Archive synthétique ${i}: observation conservée, mécanisme supposé, contrainte à vérifier. ` +
        'Les faits confirmés, les exceptions et les dépendances ont une provenance explicite. ' +
        "Ce document ne constitue pas une preuve de résolution d'un jeu.";
      const tokens = tokenizer.encode(text, { add_special_tokens: false }).length;
      this.archive.set(`record-${String(i).padStart(5, '0')}`, { key: `record-${String(i).padStart(5, '0')}`, body: text, tokens });
      count += tokens;
      if (count >= minimumTokens) return { records: i + 1, tokens: count, synthetic: true };
    }
    throw new Error('Archive construction bound exhausted');
  }
  stats(): Record<string, number> {
    this.available(); return { nodes: this.nodes.size, edges: this.edges.size, operations: this.operations.size,
      facts: this.facts.size, traces: this.traces.length, archive: this.archive.size };
  }
  state(): ReasoningMemoryState {
    this.available(); return copy({ schema: 'logos-engine.v6.reasoning-memory.v1', meta: this.meta,
      nodes: [...this.nodes.values()], edges: [...this.edges.values()], operations: [...this.operations.values()],
      facts: [...this.facts.values()], traces: this.traces, archive: [...this.archive.values()] });
  }
  /** Exact mutable tables, without copying the unchanged normative catalog. */
  dynamicState(): ReasoningDynamicState {
    this.available(); return copy({ facts: [...this.facts.values()], traces: this.traces });
  }
  /**
   * Stable, deeply immutable native entries for incremental V7 persistence.
   * The source get/state APIs still return independent mutable copies.
   */
  nativeCheckpoint(): ReasoningNativeCheckpoint {
    this.available();
    return Object.freeze({ revision: this.nativeRevision,
      facts: Object.freeze([...this.facts].map(([id, record]) => Object.freeze({ version: this.factVersions.get(id)!, record }))),
      traces: Object.freeze(this.traces.map(record => Object.freeze({ version: this.traceVersions.get(record.id)!, record }))),
    });
  }
  private markRestoredTables(): void {
    this.factVersions.clear(); this.traceVersions.clear(); ++this.nativeRevision;
    for (const [id, fact] of this.facts) { freezeOwned(fact); this.factVersions.set(id, ++this.nativeRevision); }
    for (const trace of this.traces) { freezeOwned(trace); this.traceVersions.set(trace.id, ++this.nativeRevision); }
  }
  /** Restore both mutable tables atomically from the authoritative V7 nodes. */
  restoreDynamic(state: ReasoningDynamicState): void {
    this.available(); const input = copy(state);
    if (!Array.isArray(input.facts)) throw new TypeError('Reasoning memory collection must be an array');
    const facts = new Map<string, ReasoningFact>();
    for (const fact of input.facts) {
      const id = JSON.stringify([fact.episode, fact.key]);
      if (facts.has(id)) throw new TypeError('Duplicate reasoning memory identity');
      facts.set(id, fact);
    }
    if (!Array.isArray(input.traces) || input.traces.some((trace, i) => !Number.isSafeInteger(trace.id) || trace.id <= (input.traces[i - 1]?.id ?? 0))) throw new TypeError('Invalid reasoning trace sequence');
    this.facts = facts; this.traces = input.traces; this.markRestoredTables();
  }
  /** Restore atomically; corrupted topology or duplicate identities cannot enter the live state. */
  restore(state: ReasoningMemoryState): void {
    this.available(); const input = copy(state);
    if (input.schema !== 'logos-engine.v6.reasoning-memory.v1') throw new TypeError('Unknown reasoning memory schema');
    const index = <T>(values: T[], key: (value: T) => string): Map<string, T> => {
      if (!Array.isArray(values)) throw new TypeError('Reasoning memory collection must be an array');
      const map = new Map<string, T>();
      for (const value of values) { const id = key(value); if (typeof id !== 'string' || map.has(id)) throw new TypeError('Duplicate reasoning memory identity'); map.set(id, value); }
      return map;
    };
    const nodes = index(input.nodes, n => n.key), edges = index(input.edges, e => JSON.stringify([e.src, e.relation, e.dst]));
    for (const node of nodes.values()) if (typeof node.text !== 'string' || typeof node.address !== 'string' || !Number.isSafeInteger(node.line)) throw new TypeError('Invalid reasoning node');
    for (const edge of edges.values()) if (!nodes.has(edge.src) || !nodes.has(edge.dst) || typeof edge.relation !== 'string') throw new TypeError('Unbound reasoning edge');
    const operations = index(input.operations, op => op.key), facts = index(input.facts, f => JSON.stringify([f.episode, f.key]));
    const archive = index(input.archive, a => a.key);
    if (!Array.isArray(input.traces) || input.traces.some((trace, i) => !Number.isSafeInteger(trace.id) || trace.id <= (input.traces[i - 1]?.id ?? 0))) throw new TypeError('Invalid reasoning trace sequence');
    this.meta = input.meta; this.nodes = nodes; this.edges = edges; this.operations = operations;
    this.facts = facts; this.traces = input.traces; this.archive = archive;
    this.markRestoredTables();
  }
}
