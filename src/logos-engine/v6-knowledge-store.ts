/** Versioned native state/program storage backed by the actual V7 Kernel. */
import { emptyMemory, Kernel } from './kernel.ts';
import type { DeltaCause, KnowledgeMemory, KnowledgeNode } from './kernel.ts';
import { arrayValue, compareUnicode, digest, immutableJson, objectValue, stringValue } from './canonical.ts';
import { executeWorkflow, validateCompiledModule } from './interpreter.ts';
import type { CompiledModule, ExecutionOptions, JsonObject, JsonValue, Primitive } from './ir.ts';
import { NativeSrcProgram, V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import type { NativeSrcReceipt } from './v6-src-program.ts';
import { hydrateNativeState, isNativeStateGraph, splitNativeState } from './v6-native-state-graph.ts';

const FLOAT = '$v6_float64';
const OBJECT = '$v6_object';
export const NATIVE_STORE_PROFILE = 'v6.native-state.v2/fragmented-float64-be';
const GRAPH_STATE_KINDS = new Set(['family_state', 'prefix_evidence', 'component_state', 'reasoning_catalog', 'transition_evidence']);

/**
 * Keep V7 canonical integers unchanged. Fractional numbers and negative zero
 * become explicitly typed IEEE754 leaves; objects with reserved keys are escaped.
 * This preserves native family state without changing V7 scalar/hash semantics.
 */
export function encodeNativeState(input: unknown): JsonValue {
  const value = immutableJson(input);
  const encode = (item: JsonValue): JsonValue => {
    if (typeof item === 'number' && (!Number.isSafeInteger(item) || Object.is(item, -0))) {
      if (!Number.isFinite(item)) throw new TypeError('Native stored numbers must be finite');
      const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, item, false);
      return { [FLOAT]: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
    }
    if (Array.isArray(item)) return item.map(encode);
    if (item && typeof item === 'object') {
      const entries = Object.keys(item).sort(compareUnicode).map(key => [key, encode((item as JsonObject)[key]!)] as const);
      if (Object.hasOwn(item, FLOAT) || Object.hasOwn(item, OBJECT)) return { [OBJECT]: entries };
      return Object.fromEntries(entries);
    }
    return item;
  };
  return immutableJson(encode(value));
}

export function decodeNativeState(input: JsonValue): JsonValue {
  const decode = (item: JsonValue): JsonValue => {
    if (Array.isArray(item)) return item.map(decode);
    if (item && typeof item === 'object') {
      const record = item as JsonObject;
      if (Object.hasOwn(record, FLOAT)) {
        const hex = record[FLOAT];
        if (Object.keys(record).length !== 1 || typeof hex !== 'string' || !/^[a-f0-9]{16}$/.test(hex)) throw new TypeError('Invalid native Float64 leaf');
        const bytes = Uint8Array.from(hex.match(/../g)!, pair => Number.parseInt(pair, 16));
        const number = new DataView(bytes.buffer).getFloat64(0, false);
        if (!Number.isFinite(number)) throw new TypeError('Nonfinite Float64 state is unsupported');
        return number;
      }
      if (Object.hasOwn(record, OBJECT)) {
        if (Object.keys(record).length !== 1) throw new TypeError('Invalid escaped native object');
        const entries = arrayValue(record[OBJECT]);
        const result: Record<string, JsonValue> = Object.create(null);
        for (const entry of entries) {
          const pair = arrayValue(entry);
          if (pair.length !== 2) throw new TypeError('Invalid escaped native member');
          const key = stringValue(pair[0]);
          if (Object.hasOwn(result, key)) throw new TypeError('Duplicate native state member');
          result[key] = decode(pair[1]!);
        }
        return result;
      }
      return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, decode(value)]));
    }
    return item;
  };
  return immutableJson(decode(immutableJson(input)));
}

export interface NativeStoreWrite {
  id: string;
  kind: 'program' | 'family_state' | 'family_activation' | 'prefix_evidence' | 'component_state' | 'reasoning_catalog' | 'transition_evidence';
  value: unknown;
  family?: string;
  component?: string;
  definition?: JsonObject;
  evidence?: readonly string[];
  relations?: readonly JsonValue[];
  status?: 'active' | 'retained' | 'observed';
}

export interface StoredNativeProgram {
  readonly workflowId: string;
  run(inputs: JsonObject, options?: ExecutionOptions): Promise<{ result: JsonValue; receipt: NativeSrcReceipt & { native_execution_hash: string; source_definition_hash: string; edited: boolean } }>;
}

export class NativeKnowledgeStore {
  readonly kernel: Kernel;
  readonly scope: string;
  private state: KnowledgeMemory = emptyMemory();
  private busy = false;
  private callbacks = new Map<string, Readonly<Record<string, Primitive>>>();

  constructor(sourceDigest: string, scope: string, maxNodes = 16_384) {
    this.scope = scope;
    this.kernel = new Kernel({
      node_fields: ['id', 'kind', 'revision', 'status', 'scope', 'origin', 'evidence', 'relations', 'value'],
      kinds: { program: ['definition'], family_state: ['family'], family_activation: ['family'], prefix_evidence: ['family'],
        component_state: ['component'], reasoning_catalog: ['component'], transition_evidence: ['component'], state_fragment: ['component'] },
      statuses: ['active', 'retained', 'observed'],
    }, { limits: { nodes: maxNodes }, templates: {} }, sourceDigest, { maxDeclaredNodes: maxNodes });
  }
  get memory(): KnowledgeMemory { return this.state; }
  get graphChain(): string | null { return this.state.chain; }
  get revision(): number { return this.state.deltas.length; }
  get nodeCount(): number { return Object.keys(this.state.nodes).length; }
  node(id: string): KnowledgeNode {
    const node = this.state.nodes[id]; if (!node) throw new TypeError(`Unknown native store node: ${id}`); return node;
  }
  /** Read retained state from its actual lossless fragment nodes, never a cache. */
  stateValue(id: string): JsonValue {
    const value = this.node(id).value!;
    return isNativeStateGraph(value) ? hydrateNativeState(value, fragmentId => {
      const fragment = this.node(fragmentId);
      if (fragment.kind !== 'state_fragment') throw new TypeError('Native state reference must bind a state fragment');
      return fragment.value;
    }) : decodeNativeState(value);
  }
  value(id: string): JsonValue { return this.stateValue(id); }

  async commit(writes: readonly NativeStoreWrite[], cause: DeltaCause, expectedChain = this.graphChain): Promise<void> {
    if (this.busy) throw new Error('Native knowledge transaction already active');
    if (expectedChain !== this.graphChain) throw new Error('Native knowledge graph changed');
    this.busy = true;
    try {
      let staged = this.state;
      for (const write of writes) {
        // Fragment before the ordinary V7 JSON boundary: a complete observed
        // episode can exceed one million values without any individual node
        // exceeding the declared structural limit. Old fragments are immutable
        // and content-addressed, so repeated frames/evidence are shared.
        let storedValue: JsonValue;
        if (GRAPH_STATE_KINDS.has(write.kind)) {
          const graph = splitNativeState(write.value, write.id);
          for (const fragment of graph.fragments) {
            const existing = staged.nodes[fragment.id];
            if (existing) {
              if (existing.kind !== 'state_fragment' || existing.scope !== this.scope) throw new TypeError('Native fragment identity is already bound to another kind or scope');
              continue;
            }
            staged = await this.kernel.commit(staged, immutableJson({
              id: fragment.id, kind: 'state_fragment', revision: 0, status: 'retained', scope: this.scope,
              origin: { source_digest: this.kernel.sourceDigest, store_profile: NATIVE_STORE_PROFILE, ...cause },
              evidence: [], relations: [], component: 'native_state_fragments', value: fragment.value,
            }) as JsonObject, cause);
          }
          storedValue = immutableJson(graph.root);
        } else storedValue = encodeNativeState(write.value);
        const previous = staged.nodes[write.id];
        if (previous && (previous.kind !== write.kind || previous.scope !== this.scope)) throw new TypeError('Native node identity cannot change kind or scope');
        const definition = previous?.definition ?? write.definition;
        const node = {
          id: write.id, kind: write.kind, revision: previous?.revision ?? 0, status: write.status ?? previous?.status ?? 'retained', scope: this.scope,
          origin: previous?.origin ?? { source_digest: this.kernel.sourceDigest, store_profile: NATIVE_STORE_PROFILE, ...cause },
          evidence: [...(write.evidence ?? previous?.evidence ?? [])], relations: [...(write.relations ?? arrayValue(previous?.relations ?? []))],
          value: storedValue, ...(write.family === undefined ? previous?.family === undefined ? {} : { family: previous.family } : { family: write.family }),
          ...(write.component === undefined ? previous?.component === undefined ? {} : { component: previous.component } : { component: write.component }),
          ...(definition === undefined ? {} : { definition }),
        };
        staged = await this.kernel.commit(staged, immutableJson(node) as JsonObject, cause);
      }
      this.state = staged;
    } finally { this.busy = false; }
  }

  async registerProgram(id: string, callbacks: Readonly<Record<string, Primitive>>): Promise<StoredNativeProgram> {
    const registered = await NativeSrcProgram.create(id, callbacks);
    this.callbacks.set(id, Object.freeze({ ...callbacks }));
    const nodeId = `program:${id}`;
    if (!this.state.nodes[nodeId]) {
      const executionHash = await digest({ profile: 'native-stored-ir.v1', module: registered.module });
      await this.commit([{ id: nodeId, kind: 'program', status: 'active', value: { module: registered.module, executionHash, edited: false },
        definition: { reference_commit: V6_NATIVE_PROGRAM_REFERENCE, source_hash: registered.module.source_hash,
          semantic_hash: registered.module.semantic_hash, transitive_source_hash: registered.transitiveSourceHash },
      }], { workflow: id, step: 'native_store', statement: 'program.install' });
    }
    return { workflowId: id, run: async (inputs, options = {}) => {
      const node = this.node(nodeId), value = objectValue(this.value(nodeId));
      const module = validateCompiledModule(value.module, this.callbacks.get(id)!);
      const result = await executeWorkflow(module, id, inputs, this.callbacks.get(id)!, { maxInstructions: 1024, yieldEvery: 128, ...options });
      const definition = objectValue(node.definition), executionHash = stringValue(value.executionHash), edited = value.edited === true;
      const executed = result.trace.map(event => event.statementId);
      const finalSliceLength = executed.length % 128 || Math.min(executed.length, 128);
      return { result: result.value, receipt: {
        workflow: id, src_hash: edited ? executionHash : stringValue(definition.transitive_source_hash), src_status: 'completed',
        executed_statements: executed.slice(-finalSliceLength), all_executed_statements: executed,
        instruction_quantum: 128, instructions: result.instructions, trace: result.trace,
        execution_engine: 'logos-engine.typescript', reference_commit: V6_NATIVE_PROGRAM_REFERENCE,
        reference_semantic_hash: stringValue(definition.semantic_hash),
        native_execution_hash: executionHash, source_definition_hash: stringValue(definition.transitive_source_hash), edited,
      } };
    } };
  }

  /** Validate a replacement without mutating the graph or executing callbacks. */
  async programReplacement(id: string, replacement: unknown): Promise<NativeStoreWrite> {
    const callbacks = this.callbacks.get(id);
    if (!callbacks) throw new TypeError('Only a program with actual native callbacks can be edited');
    const current = objectValue(this.value(`program:${id}`));
    const module = validateCompiledModule(immutableJson(replacement), callbacks);
    const previous = current.module as unknown as CompiledModule;
    if (module.module_id !== previous.module_id || !module.workflows.some(workflow => workflow.id === id)) throw new TypeError('The edited program must preserve its executable workflow identity');
    const executionHash = await digest({ profile: 'native-stored-ir.v1', module });
    if (executionHash === current.executionHash) return { id: `program:${id}`, kind: 'program', value: current };
    return { id: `program:${id}`, kind: 'program', status: 'active', value: { module, executionHash, edited: true } };
  }

  async executionDigest(writes: readonly NativeStoreWrite[] = []): Promise<string> {
    const overrides = new Map(writes.map(write => [write.id, encodeNativeState(write.value)]));
    const nodes = Object.values(this.state.nodes).filter(node => node.kind === 'program' || node.kind === 'family_activation')
      .sort((a, b) => compareUnicode(a.id, b.id)).map(node => ({ id: node.id, value: overrides.get(node.id) ?? node.value! }));
    return digest({ profile: NATIVE_STORE_PROFILE, source_digest: this.kernel.sourceDigest, nodes });
  }
}
