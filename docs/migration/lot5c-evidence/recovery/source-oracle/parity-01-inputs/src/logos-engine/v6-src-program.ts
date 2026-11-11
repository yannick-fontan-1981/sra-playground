/** V6 declarative programs executed by the same native SRC interpreter as V7. */
import transferred from './v6/programs.json' with { type: 'json' };
import { executeWorkflow, validateCompiledModule } from './interpreter.ts';
import { immutableJson } from './canonical.ts';
import { v6Digest } from './v6-native-observer.ts';
import type { CompiledModule, ExecutionOptions, ExecutionResult, JsonObject, Primitive, TraceEvent } from './ir.ts';

interface TransferredProgram {
  entry: string;
  module: CompiledModule;
  transitiveSourceHash: string;
}
export interface NativeSrcReceipt {
  workflow: string;
  src_hash: string;
  src_status: 'completed';
  executed_statements: string[];
  all_executed_statements: string[];
  instruction_quantum: 128;
  instructions: number;
  trace: readonly TraceEvent[];
  execution_engine: 'logos-engine.typescript';
  reference_commit: string;
  reference_semantic_hash: string;
}
export interface NativeProgramDescription {
  readonly id: string;
  readonly sourceHash: string;
  readonly semanticHash: string;
  readonly transitiveSourceHash: string;
  readonly callbackRefs: readonly string[];
  readonly module: CompiledModule;
}
const bundle = transferred as unknown as {
  referenceCommit: string; programs: Record<string, TransferredProgram>;
  sources: Record<string, { bytes: number; sha256: string; text: string }>;
  strategy: Record<string, unknown>;
};
export const V6_NATIVE_PROGRAM_REFERENCE = bundle.referenceCommit;
export const V6_STRATEGY_DECLARATION = immutableJson(bundle.strategy);
export const V6_DECLARATIVE_SOURCES = immutableJson(bundle.sources);

export function nativeProgramDescriptions(): readonly NativeProgramDescription[] {
  return Object.values(bundle.programs).map(program => ({ id: program.entry,
    sourceHash: program.module.source_hash, semanticHash: program.module.semantic_hash,
    transitiveSourceHash: program.transitiveSourceHash,
    callbackRefs: (program.module.authority_attestations ?? []).map(a => a.authority_id),
    module: immutableJson(program.module) as unknown as CompiledModule,
  }));
}

/**
 * Loading a program is not registering its missing capabilities. Every callback
 * must be present and callable before its tree can execute. Source callbacks are
 * native TS functions; no Python code, VM, subprocess or engine handle is used.
 */
export class NativeSrcProgram {
  readonly workflowId: string;
  readonly module: CompiledModule;
  readonly transitiveSourceHash: string;
  private readonly callbacks: Readonly<Record<string, Primitive>>;
  private constructor(program: TransferredProgram, callbacks: Readonly<Record<string, Primitive>>) {
    this.workflowId = program.entry;
    this.callbacks = Object.freeze({ ...callbacks });
    this.module = validateCompiledModule(immutableJson(program.module), this.callbacks);
    this.transitiveSourceHash = program.transitiveSourceHash;
  }
  static async create(id: string, callbacks: Readonly<Record<string, Primitive>>): Promise<NativeSrcProgram> {
    const program = bundle.programs[id];
    if (!program) throw new Error(`No transferred V6 SRC program: ${id}`);
    const m = program.module;
    const source = Object.entries(bundle.sources).find(([relative]) => m.source_name === relative || m.source_name.endsWith(`/${relative}`));
    if (!source) throw new Error(`Original SRC source is absent: ${id}`);
    const bytes = new TextEncoder().encode(source[1].text);
    const sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (sourceHash !== m.source_hash || sourceHash !== source[1].sha256 || bytes.length !== source[1].bytes) {
      throw new Error(`V6 SRC source digest mismatch: ${id}`);
    }
    const semantic = { module_id: m.module_id, imports: m.imports, workflows: m.workflows,
      authority_attestations: m.authority_attestations ?? [], schema_version: m.schema_version };
    if (await v6Digest(semantic) !== m.semantic_hash) throw new Error(`V6 SRC semantic digest mismatch: ${id}`);
    const transitive = { module_id: m.module_id, source_hash: m.source_hash, imports: [] };
    if (m.imports.length || await v6Digest(transitive) !== program.transitiveSourceHash) {
      throw new Error(`V6 SRC transitive source binding mismatch: ${id}`);
    }
    for (const declaration of m.authority_attestations ?? []) {
      if (declaration.effect_class !== 'pure' || !Object.hasOwn(callbacks, declaration.authority_id) || typeof callbacks[declaration.authority_id] !== 'function') {
        throw new Error(`Native callback is unavailable or not pure: ${declaration.authority_id}`);
      }
    }
    return new NativeSrcProgram(program, callbacks);
  }
  async run(inputs: JsonObject, options: ExecutionOptions = {}): Promise<{ result: ExecutionResult['value']; receipt: NativeSrcReceipt }> {
    const result = await executeWorkflow(this.module, this.workflowId, inputs, this.callbacks,
      { maxInstructions: 1024, yieldEvery: 128, ...options });
    const executed = result.trace.map(event => event.statementId);
    // Python advance_bounded retains only the final SchedulerRunResult slice.
    // Keep that original receipt field and expose the complete native trace
    // separately, so an audit cannot mistake a last-slice count for total work.
    const finalSliceLength = executed.length % 128 || Math.min(executed.length, 128);
    return { result: result.value, receipt: { workflow: this.workflowId, src_hash: this.transitiveSourceHash,
      src_status: 'completed', executed_statements: executed.slice(-finalSliceLength),
      all_executed_statements: executed, instruction_quantum: 128,
      instructions: result.instructions, trace: result.trace,
      execution_engine: 'logos-engine.typescript', reference_commit: V6_NATIVE_PROGRAM_REFERENCE,
      reference_semantic_hash: this.module.semantic_hash } };
  }
}
