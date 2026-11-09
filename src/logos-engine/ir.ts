/**
 * Transport types for the existing Python SRC compiler, not a new authoring DSL.
 * Compiled IDs are source locations; a future editor must own its stable IDs.
 */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
export interface JsonObject { readonly [key: string]: JsonValue }

export const SRC_SCHEMA_VERSION = 'yf_arc3_v5.src_ir.v0_1' as const;

export interface TypeSpec {
  readonly name: string;
  readonly arguments?: readonly TypeSpec[];
  readonly optional?: boolean;
}

export type ExpressionKind = 'reference' | 'string' | 'integer' | 'boolean' | 'null' | 'empty_set' | 'list' | 'call';
export interface IrCallArgument {
  readonly name?: string | null;
  readonly value: IrExpression;
}
export interface IrExpression {
  readonly kind: ExpressionKind;
  readonly value?: string | number | boolean | null;
  readonly items?: readonly IrExpression[];
  readonly arguments?: readonly IrCallArgument[];
}
export interface IrBinding {
  readonly name: string;
  readonly type_spec: TypeSpec;
  readonly default?: IrExpression | null;
}
export interface IrLoopContract {
  readonly progress_witness: IrExpression;
  readonly stop_condition: IrExpression;
  readonly maximum_symbolic_depth: number;
  readonly limit_result: IrExpression;
}
export type StatementKind = 'CALL' | 'SELECT' | 'IF' | 'FOR_EACH' | 'WHILE' | 'NEXT' | 'STOP';
export interface IrClause { readonly name: string; readonly value: IrExpression }
export interface IrStatement {
  readonly id: string;
  readonly kind: StatementKind;
  readonly expression: IrExpression | null;
  readonly target?: string | null;
  readonly type_annotation?: TypeSpec | null;
  readonly result_binding?: string | null;
  readonly body?: readonly IrStatement[];
  readonly else_body?: readonly IrStatement[];
  readonly iterator?: string | null;
  // SELECT uses the original compiler's named clauses. Other authority
  // operators and MATCH arms remain outside the transferred subset.
  readonly clauses?: readonly IrClause[];
  readonly match_arms?: readonly JsonValue[];
  readonly loop_contract?: IrLoopContract | null;
}
export interface IrStep {
  readonly id: string;
  readonly statements: readonly IrStatement[];
}
export interface IrWorkflow {
  readonly id: string;
  readonly entry_step_id: string;
  readonly inputs: readonly IrBinding[];
  readonly outputs: readonly IrBinding[];
  readonly state: readonly IrBinding[];
  readonly steps: readonly IrStep[];
}
export interface SourcePosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}
export interface SourceMapEntry {
  readonly node_id: string;
  readonly construct_kind: string;
  readonly span: {
    readonly source_name: string;
    readonly start: SourcePosition;
    readonly end: SourcePosition;
  };
}
export interface CompiledModule {
  readonly module_id: string;
  readonly source_name: string;
  readonly source_hash: string;
  readonly semantic_hash: string;
  readonly imports: readonly { readonly module_id: string; readonly alias?: string | null }[];
  readonly workflows: readonly IrWorkflow[];
  readonly authority_attestations?: readonly {
    readonly authority_id: string;
    readonly kind: string;
    readonly effect_class: string;
    readonly source_unit: string;
    readonly source_hash: string;
  }[];
  readonly source_map?: readonly SourceMapEntry[];
  readonly schema_version?: typeof SRC_SCHEMA_VERSION;
}

export interface CallContext {
  readonly workflowId: string;
  readonly stepId: string;
  readonly statementId: string;
  /** Cancellation is cooperative: primitives must observe this during long work. */
  readonly signal?: AbortSignal;
}
export type Primitive = (args: JsonObject, context: CallContext) => JsonValue | Promise<JsonValue>;

/**
 * A compact scheduler event, never a graph snapshot. Python also charges one
 * instruction for every completed control frame, using its compiled owner ID.
 */
export interface TraceEvent {
  readonly index: number;
  readonly workflowId: string;
  readonly stepId: string;
  readonly statementId: string;
  readonly kind: StatementKind | 'STEP';
  readonly phase: 'statement' | 'frame_complete';
  readonly depth: number;
  readonly status: 'running' | 'completed' | 'deferred' | 'failed';
  readonly target?: string;
  readonly resultBinding?: string;
  readonly summary?: string;
}
export interface ExecutionOptions {
  readonly maxInstructions?: number;
  readonly maxCollectionItems?: number;
  readonly yieldEvery?: number;
  readonly signal?: AbortSignal;
  /** Elapsed-time limit in milliseconds, measured from executeWorkflow entry. */
  readonly deadlineMs?: number;
}
export interface ExecutionResult {
  readonly value: JsonValue;
  readonly bindings: JsonObject;
  readonly trace: TraceEvent[];
  readonly instructions: number;
}
