import { SRC_SCHEMA_VERSION } from './ir.ts';
import { immutableJson } from './canonical.ts';
import type {
  CallContext, CompiledModule, ExecutionOptions, ExecutionResult, IrExpression,
  IrStatement, IrStep, JsonObject, JsonValue, Primitive, TraceEvent, TypeSpec,
} from './ir.ts';

/** Transport validation covers the transferred SRC subset, not the full V5 authority gate. */
export class SrcExecutionError extends Error {
  readonly code: string;
  trace: readonly TraceEvent[] = [];
  instructions = 0;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SrcExecutionError';
    this.code = code;
  }
}

/** The original scheduler's DEFERRED checkpoint must never authorize an action. */
export class SrcDeferredError extends SrcExecutionError {
  readonly result: string;
  readonly bindings: JsonObject;
  constructor(result: string, bindings: JsonObject) {
    super('deferred', result);
    this.name = 'SrcDeferredError';
    this.result = result;
    this.bindings = bindings;
  }
}

const EMPTY: readonly never[] = Object.freeze([]);
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function fail(code: string, message: string): never { throw new SrcExecutionError(code, message); }
const pathPattern = /^[\p{L}_][\p{L}\p{N}_-]*(?:\.[\p{L}\p{N}_-]+)*$/u;
const namePattern = /^[\p{L}_][\p{L}\p{N}_-]*$/u;
const supported = new Set(['CALL', 'IF', 'FOR_EACH', 'WHILE', 'NEXT', 'STOP']);

/** The kernel and interpreter share one immutable-value registry. */
function snapshotJson(value: unknown, location: string): JsonValue {
  try { return immutableJson(value); }
  catch (error) { fail('invalid_json', `${location}: ${error instanceof Error ? error.message : String(error)}`); }
}

function record(value: unknown, location: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('invalid_ir', `${location}: expected an object`);
  }
  return value as Record<string, unknown>;
}
function sequence(value: unknown, location: string, optional = false): readonly unknown[] {
  if (value === undefined && optional) return EMPTY;
  if (!Array.isArray(value)) fail('invalid_ir', `${location}: expected an array`);
  return value;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], location: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('invalid_ir', `${location}: unknown field ${key}`);
}
function nonempty(value: unknown, location: string): string {
  if (typeof value !== 'string' || !value.length) fail('invalid_ir', `${location}: expected a nonempty string`);
  return value;
}
function ref(value: unknown, location: string, local = false): string {
  const text = nonempty(value, location);
  if (!(local ? namePattern : pathPattern).test(text)) fail('invalid_ir', `${location}: malformed reference ${text}`);
  return text;
}
function digest(value: unknown, location: string): void {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('invalid_ir', `${location}: expected a SHA-256 digest`);
}
function unique(value: string, seen: Set<string>, location: string): void {
  if (seen.has(value)) fail('invalid_ir', `${location}: duplicate identity ${value}`);
  seen.add(value);
}
function typeSpec(value: unknown, location: string): void {
  const spec = record(value, location);
  keys(spec, ['name', 'arguments', 'optional'], location);
  ref(spec.name, `${location}.name`);
  if (spec.optional !== undefined && typeof spec.optional !== 'boolean') fail('invalid_ir', `${location}.optional: expected a boolean`);
  sequence(spec.arguments, `${location}.arguments`, true).forEach((arg, i) => typeSpec(arg, `${location}.arguments[${i}]`));
}

function expression(value: unknown, location: string, primitives?: Readonly<Record<string, Primitive>>, allowCalls = true): void {
  const expr = record(value, location);
  keys(expr, ['kind', 'value', 'items', 'arguments'], location);
  const items = sequence(expr.items, `${location}.items`, true);
  const args = sequence(expr.arguments, `${location}.arguments`, true);
  const kind = expr.kind;
  if (kind !== 'list' && items.length) fail('invalid_ir', `${location}: ${String(kind)} cannot have items`);
  if (kind !== 'call' && args.length) fail('invalid_ir', `${location}: ${String(kind)} cannot have arguments`);
  if (kind === 'reference') ref(expr.value, `${location}.value`);
  else if (kind === 'string') {
    if (typeof expr.value !== 'string') fail('invalid_ir', `${location}: string expression requires a string`);
  } else if (kind === 'integer') {
    if (typeof expr.value !== 'number' || !Number.isSafeInteger(expr.value)) fail('invalid_ir', `${location}: integer exceeds the exact JavaScript integer range`);
  } else if (kind === 'boolean') {
    if (typeof expr.value !== 'boolean') fail('invalid_ir', `${location}: boolean expression requires a boolean`);
  } else if (kind === 'null' || kind === 'empty_set' || kind === 'list') {
    if (expr.value !== undefined && expr.value !== null) fail('invalid_ir', `${location}: ${kind} cannot have a scalar value`);
    items.forEach((item, index) => expression(item, `${location}.items[${index}]`, primitives, allowCalls));
  } else if (kind === 'call') {
    if (!allowCalls) fail('unsupported_ir', `${location}: calls in binding defaults are unsupported by the Python evaluator`);
    const callee = ref(expr.value, `${location}.value`);
    if (primitives && (!own(primitives, callee) || typeof primitives[callee] !== 'function')) {
      fail('unknown_primitive', `${location}: unregistered primitive ${callee}`);
    }
    const names = new Set<string>();
    args.forEach((argument, index) => {
      const path = `${location}.arguments[${index}]`;
      const arg = record(argument, path);
      keys(arg, ['name', 'value'], path);
      // The host API supplies named JSON arguments. Positional calls require a
      // symbol parameter schema and are explicitly outside this V7 milestone.
      if (arg.name === undefined || arg.name === null) fail('unsupported_ir', `${path}: positional call arguments are not supported`);
      unique(ref(arg.name, `${path}.name`, true), names, path);
      expression(arg.value, `${path}.value`, primitives, allowCalls);
    });
  } else fail('unsupported_ir', `${location}: unsupported expression kind ${String(kind)}`);
}

/**
 * Validate every branch/workflow before running any primitive. This checks the
 * supported IR shape, not compiler authority attestations or hash authenticity.
 * The unchanged provenance fields and source map remain in the returned module.
 */
export function validateCompiledModule(value: unknown, primitives?: Readonly<Record<string, Primitive>>): CompiledModule {
  const snapshot = snapshotJson(value, 'module');
  const module = record(snapshot, 'module');
  keys(module, ['module_id', 'source_name', 'source_hash', 'semantic_hash', 'imports', 'workflows',
    'authority_attestations', 'source_map', 'schema_version'], 'module');
  const moduleId = ref(module.module_id, 'module.module_id');
  nonempty(module.source_name, 'module.source_name');
  digest(module.source_hash, 'module.source_hash');
  digest(module.semantic_hash, 'module.semantic_hash');
  if (module.schema_version !== undefined && module.schema_version !== SRC_SCHEMA_VERSION) {
    fail('unsupported_ir', `Unsupported SRC schema version ${String(module.schema_version)}`);
  }
  const importIds = new Set<string>(), aliases = new Set<string>();
  sequence(module.imports, 'module.imports').forEach((item, index) => {
    const path = `module.imports[${index}]`, entry = record(item, path);
    keys(entry, ['module_id', 'alias'], path);
    const imported = ref(entry.module_id, `${path}.module_id`);
    unique(imported, importIds, path);
    unique(entry.alias == null ? imported : ref(entry.alias, `${path}.alias`), aliases, path);
  });
  const workflows = sequence(module.workflows, 'module.workflows');
  if (!workflows.length) fail('invalid_ir', 'A compiled module requires a workflow');
  const workflowIds = new Set<string>(), allStatementIds = new Set<string>();
  workflows.forEach((value, workflowIndex) => {
    const path = `module.workflows[${workflowIndex}]`, workflow = record(value, path);
    keys(workflow, ['id', 'entry_step_id', 'inputs', 'outputs', 'state', 'steps'], path);
    const workflowId = ref(workflow.id, `${path}.id`);
    if (!workflowId.startsWith(`${moduleId}.`)) fail('invalid_ir', `${path}: workflow ID is outside its module`);
    unique(workflowId, workflowIds, path);
    const bindingNames = new Set<string>();
    for (const group of ['inputs', 'outputs', 'state']) {
      const bindings = sequence(workflow[group], `${path}.${group}`);
      if (group === 'outputs' && !bindings.length) fail('invalid_ir', `${path}: a workflow requires an output`);
      bindings.forEach((value, i) => {
        const where = `${path}.${group}[${i}]`, binding = record(value, where);
        keys(binding, ['name', 'type_spec', 'default'], where);
        unique(ref(binding.name, `${where}.name`, true), bindingNames, where);
        typeSpec(binding.type_spec, `${where}.type_spec`);
        if (binding.default != null) expression(binding.default, `${where}.default`, primitives, false);
      });
    }
    const steps = sequence(workflow.steps, `${path}.steps`);
    if (!steps.length) fail('invalid_ir', `${path}: a workflow requires a step`);
    const stepIds = new Set<string>();
    steps.forEach((value, i) => {
      const where = `${path}.steps[${i}]`, step = record(value, where);
      keys(step, ['id', 'statements'], where);
      const stepId = ref(step.id, `${where}.id`);
      if (!stepId.startsWith(`${workflowId}.`)) fail('invalid_ir', `${where}: step ID is outside its workflow`);
      unique(stepId, stepIds, where);
    });
    if (workflow.entry_step_id !== record(steps[0], path).id) fail('invalid_ir', `${path}: entry must be the first declared step`);
    const statements = (values: readonly unknown[], stepId: string, location: string): void => {
      values.forEach((value, index) => {
        const where = `${location}[${index}]`, statement = record(value, where);
        keys(statement, ['id', 'kind', 'target', 'expression', 'type_annotation', 'result_binding',
          'clauses', 'body', 'else_body', 'match_arms', 'iterator', 'loop_contract'], where);
        const statementId = ref(statement.id, `${where}.id`);
        if (!statementId.startsWith(`${stepId}.`)) fail('invalid_ir', `${where}: statement ID is outside its step`);
        unique(statementId, allStatementIds, where);
        const kind = String(statement.kind);
        if (!supported.has(kind)) fail('unsupported_ir', `${statementId}: unsupported statement ${kind}`);
        for (const field of ['target', 'type_annotation']) {
          if (statement[field] != null) fail('unsupported_ir', `${statementId}: ${kind} cannot use ${field}`);
        }
        for (const field of ['clauses', 'match_arms']) {
          if (sequence(statement[field], `${where}.${field}`, true).length) fail('unsupported_ir', `${statementId}: ${field} is outside the supported subset`);
        }
        expression(statement.expression, `${where}.expression`, primitives);
        if (kind === 'WHILE') {
          const loop = record(statement.loop_contract, `${where}.loop_contract`);
          keys(loop, ['progress_witness', 'stop_condition', 'maximum_symbolic_depth', 'limit_result'], `${where}.loop_contract`);
          const maximum = loop.maximum_symbolic_depth;
          if (typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum < 1) fail('invalid_ir', `${statementId}: WHILE requires a positive symbolic depth`);
          for (const field of ['progress_witness', 'stop_condition', 'limit_result']) expression(loop[field], `${where}.loop_contract.${field}`, primitives);
        } else if (statement.loop_contract != null) fail('unsupported_ir', `${statementId}: only WHILE can use a loop contract`);
        const expr = record(statement.expression, `${where}.expression`);
        const body = sequence(statement.body, `${where}.body`, true);
        const otherwise = sequence(statement.else_body, `${where}.else_body`, true);
        if (kind !== 'IF' && kind !== 'FOR_EACH' && kind !== 'WHILE' && body.length) fail('invalid_ir', `${statementId}: unexpected body`);
        if (kind !== 'IF' && otherwise.length) fail('invalid_ir', `${statementId}: unexpected else_body`);
        if ((kind === 'IF' || kind === 'FOR_EACH' || kind === 'WHILE') && !body.length) fail('invalid_ir', `${statementId}: ${kind} requires a body`);
        if (kind === 'CALL') {
          if (expr.kind !== 'call') fail('invalid_ir', `${statementId}: CALL requires a call expression`);
          if (statement.result_binding != null) ref(statement.result_binding, `${where}.result_binding`, true);
        } else if (statement.result_binding != null) fail('invalid_ir', `${statementId}: only CALL can bind a result`);
        if (kind === 'FOR_EACH') ref(statement.iterator, `${where}.iterator`, true);
        else if (statement.iterator != null) fail('invalid_ir', `${statementId}: unexpected iterator`);
        if (kind === 'NEXT' && (expr.kind !== 'reference' || !stepIds.has(`${workflowId}.${String(expr.value)}`))) {
          fail('invalid_ir', `${statementId}: NEXT requires an existing step reference`);
        }
        statements(body, stepId, `${where}.body`);
        statements(otherwise, stepId, `${where}.else_body`);
      });
    };
    steps.forEach((value, index) => {
      const step = record(value, path), where = `${path}.steps[${index}].statements`;
      const body = sequence(step.statements, where);
      if (!body.length) fail('invalid_ir', `${where}: a step requires statements`);
      statements(body, String(step.id), where);
    });
  });
  const authorities = new Set<string>();
  sequence(module.authority_attestations, 'module.authority_attestations', true).forEach((value, index) => {
    const path = `module.authority_attestations[${index}]`, entry = record(value, path);
    keys(entry, ['authority_id', 'kind', 'effect_class', 'source_unit', 'source_hash'], path);
    unique(ref(entry.authority_id, `${path}.authority_id`), authorities, path);
    for (const field of ['kind', 'effect_class', 'source_unit']) nonempty(entry[field], `${path}.${field}`);
    digest(entry.source_hash, `${path}.source_hash`);
  });
  const sources = new Set<string>();
  sequence(module.source_map, 'module.source_map', true).forEach((value, index) => {
    const path = `module.source_map[${index}]`, entry = record(value, path);
    keys(entry, ['node_id', 'construct_kind', 'span'], path);
    unique(ref(entry.node_id, `${path}.node_id`), sources, path);
    nonempty(entry.construct_kind, `${path}.construct_kind`);
    const span = record(entry.span, `${path}.span`);
    keys(span, ['source_name', 'start', 'end'], `${path}.span`);
    nonempty(span.source_name, `${path}.span.source_name`);
    for (const end of ['start', 'end']) {
      const position = record(span[end], `${path}.span.${end}`);
      keys(position, ['line', 'column', 'offset'], `${path}.span.${end}`);
      for (const field of ['line', 'column', 'offset']) {
        const n = position[field];
        if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < (field === 'offset' ? 0 : 1)) {
          fail('invalid_ir', `${path}.span.${end}.${field}: invalid source position`);
        }
      }
    }
    if (Number(record(span.end, path).offset) < Number(record(span.start, path).offset)) fail('invalid_ir', `${path}: reversed source span`);
  });
  return snapshot as unknown as CompiledModule;
}

function validateType(value: JsonValue, spec: TypeSpec, location: string): void {
  if (value === null) {
    if (spec.optional) return;
    fail('invalid_type', `${location}: ${spec.name} does not accept null`);
  }
  const object = typeof value === 'object' && !Array.isArray(value);
  let valid = true;
  if (spec.name === 'Any') return;
  if (spec.name === 'Boolean') valid = typeof value === 'boolean';
  else if (spec.name === 'Integer') valid = typeof value === 'number' && Number.isSafeInteger(value);
  else if (spec.name === 'String' || spec.name === 'Ref') valid = typeof value === 'string';
  else if (spec.name === 'Map') valid = object;
  else if (spec.name === 'List' || spec.name === 'Set') {
    valid = Array.isArray(value);
    if (Array.isArray(value)) {
      const element = spec.arguments?.[0];
      if (element) value.forEach((item, index) => validateType(item, element, `${location}[${index}]`));
      if (spec.name === 'Set') {
        const identities = value.map(canonicalIdentity);
        valid = new Set(identities).size === identities.length;
      }
    }
  } else valid = typeof value === 'string' || object;
  if (!valid) fail('invalid_type', `${location}: expected ${spec.name}`);
}
function canonicalIdentity(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalIdentity).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalIdentity((value as JsonObject)[key]!)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function summary(value: JsonValue): string {
  if (Array.isArray(value)) return `list(${value.length})`;
  if (value !== null && typeof value === 'object') return `object(${Object.keys(value).length} fields)`;
  const text = JSON.stringify(value);
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

function pythonString(value: JsonValue): string {
  // All transferred V6 ON LIMIT clauses return symbolic/string references.
  // Python scalar spellings remain explicit; unsupported container repr must
  // fail instead of inventing a completed or differently worded checkpoint.
  if (typeof value === 'string') return value;
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0)) return String(value);
  return fail('unsupported_defer_value', 'The transferred SRC ON LIMIT result must be a string or exact scalar');
}

interface Frame {
  readonly step: IrStep;
  readonly body: readonly IrStatement[];
  readonly owner?: IrStatement;
  readonly blockKind?: 'body' | 'else';
  index: number;
  readonly loop?: {
    readonly iterator: string;
    readonly items: readonly JsonValue[];
    next: number;
    readonly hadPrevious: boolean;
    readonly previous: JsonValue | undefined;
  };
  readonly whileLoop?: { iteration: number; progressIdentity: string };
}

export async function executeWorkflow(
  module: unknown,
  workflowId: string,
  inputs: JsonObject,
  primitives: Readonly<Record<string, Primitive>>,
  options: ExecutionOptions = {},
): Promise<ExecutionResult> {
  const started = performance.now();
  const positive = (value: number | undefined, fallback: number, name: string) => {
    const result = value ?? fallback;
    if (!Number.isSafeInteger(result) || result < 1) fail('invalid_options', `${name} must be a positive safe integer`);
    return result;
  };
  const maximum = positive(options.maxInstructions, 10_000, 'maxInstructions');
  const collectionLimit = positive(options.maxCollectionItems, 1_024, 'maxCollectionItems');
  const yieldEvery = positive(options.yieldEvery, 128, 'yieldEvery');
  if (options.deadlineMs !== undefined && (!Number.isFinite(options.deadlineMs) || options.deadlineMs < 0 || options.deadlineMs > 2_147_483_647)) {
    fail('invalid_options', 'deadlineMs must be a finite duration from 0 through 2147483647');
  }
  const deadline = options.deadlineMs === undefined ? Infinity : started + options.deadlineMs;
  const cancellation = new AbortController();
  const forwardAbort = () => cancellation.abort();
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) cancellation.abort();
  let timedOut = false;
  const timer = options.deadlineMs === undefined ? undefined : setTimeout(() => {
    timedOut = true;
    cancellation.abort();
  }, options.deadlineMs);
  const trace: TraceEvent[] = [];
  let instructions = 0;
  const check = () => {
    if (timedOut || performance.now() >= deadline) fail('deadline', 'SRC execution reached its elapsed-time limit');
    if (cancellation.signal.aborted) fail('aborted', 'SRC execution was cancelled');
  };
  const wait = async (pending: JsonValue | Promise<JsonValue>): Promise<JsonValue> => {
    check();
    let listener: (() => void) | undefined;
    try {
      return await Promise.race([Promise.resolve(pending), new Promise<never>((_, reject) => {
        listener = () => { try { check(); } catch (error) { reject(error); } };
        cancellation.signal.addEventListener('abort', listener, { once: true });
      })]);
    } finally {
      if (listener) cancellation.signal.removeEventListener('abort', listener);
    }
  };
  try {
    check();
    // Snapshot the registry as well: later host edits cannot swap a checked call.
    const registry = Object.freeze(Object.fromEntries(Object.entries(primitives)));
    const compiled = validateCompiledModule(module, registry);
    const workflow = compiled.workflows.find(item => item.id === workflowId);
    if (!workflow) fail('unknown_workflow', `No workflow ${workflowId} in ${compiled.module_id}`);
    const inputSnapshot = snapshotJson(inputs, 'inputs');
    if (inputSnapshot === null || typeof inputSnapshot !== 'object' || Array.isArray(inputSnapshot)) fail('invalid_input', 'Workflow inputs must be a JSON object');
    const supplied = inputSnapshot as JsonObject;
    const declaredInputs = new Set(workflow.inputs.map(item => item.name));
    for (const key of Object.keys(supplied)) if (!declaredInputs.has(key)) fail('invalid_input', `Unexpected workflow input ${key}`);
    const bindings: Record<string, JsonValue> = Object.create(null);
    const types = new Map([...workflow.inputs, ...workflow.outputs, ...workflow.state].map(binding => [binding.name, binding.type_spec]));
    const evaluate = async (expr: IrExpression, context?: CallContext): Promise<JsonValue> => {
      switch (expr.kind) {
        case 'reference': {
          const reference = String(expr.value);
          if (own(bindings, reference)) return bindings[reference]!;
          const [root, ...members] = reference.split('.');
          if (!root || !own(bindings, root)) return reference; // SRC symbolic reference.
          let current = bindings[root]!;
          for (const member of members) {
            if (current === null || typeof current !== 'object' || Array.isArray(current) || !own(current, member)) {
              fail('invalid_reference', `Runtime reference ${reference} has no member ${member}`);
            }
            current = (current as JsonObject)[member]!;
          }
          return current;
        }
        case 'string': case 'integer': case 'boolean': return expr.value as JsonValue;
        case 'null': return null;
        case 'empty_set': return EMPTY;
        case 'list': {
          const items: JsonValue[] = [];
          for (const item of expr.items ?? EMPTY) items.push(await evaluate(item, context));
          return immutableJson(items);
        }
        case 'call': {
          check();
          if (!context) fail('unsupported_ir', 'Calls are unavailable in binding defaults');
          const callee = String(expr.value), args: [string, JsonValue][] = [];
          for (const argument of expr.arguments ?? EMPTY) args.push([argument.name!, await evaluate(argument.value, context)]);
          let value: JsonValue;
          try { value = await wait(registry[callee]!(immutableJson(Object.fromEntries(args)), context)); }
          catch (error) {
            if (error instanceof SrcExecutionError) throw error;
            fail('primitive_failed', `${callee}: ${error instanceof Error ? error.message : String(error)}`);
          }
          check();
          return snapshotJson(value, `Result of ${callee}`);
        }
      }
    };
    for (const binding of [...workflow.inputs].sort((a, b) => a.name.localeCompare(b.name))) {
      if (!own(supplied, binding.name) && !binding.type_spec.optional) fail('invalid_input', `Missing workflow input ${binding.name}`);
      const value = supplied[binding.name] ?? null;
      validateType(value, binding.type_spec, `Input ${binding.name}`);
      bindings[binding.name] = value;
    }
    for (const binding of [...workflow.outputs, ...workflow.state]) {
      if (binding.default == null) bindings[binding.name] = null;
      else {
        const value = await evaluate(binding.default);
        validateType(value, binding.type_spec, `Default ${binding.name}`);
        bindings[binding.name] = value;
      }
    }
    const steps = new Map(workflow.steps.map(step => [step.id, step]));
    const first = steps.get(workflow.entry_step_id)!;
    let stack: Frame[] = [{ step: first, body: first.statements, index: 0 }];
    for (;;) {
      check();
      if (instructions >= maximum) fail('instruction_limit', `SRC execution reached its ${maximum}-instruction limit`);
      if (instructions > 0 && instructions % yieldEvery === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        check();
      }
      const frame = stack.at(-1)!;
      if (frame.index === frame.body.length) {
        // WorkflowScheduler.run charges _complete_frame as an instruction and
        // appends its owner_id. A completion does not re-evaluate the IF or FOR.
        instructions++;
        const event: TraceEvent = {
          index: instructions, workflowId, stepId: frame.step.id,
          statementId: frame.owner?.id ?? frame.step.id,
          kind: frame.owner?.kind ?? 'STEP', phase: 'frame_complete',
          depth: stack.length - 1, status: 'completed',
          summary: frame.loop ? `iteration ${frame.loop.next}/${frame.loop.items.length} complete`
            : `${frame.blockKind ?? 'step'} complete`,
        };
        trace.push(Object.freeze(event));
        if (frame.whileLoop) {
          // Exact Python order: STOP and PROGRESS are evaluated first; STOP
          // wins, then no-progress, then depth, and only then WHILE condition.
          const owner = frame.owner!, contract = owner.loop_contract!;
          const context: CallContext = Object.freeze({ workflowId, stepId: frame.step.id,
            statementId: owner.id, signal: cancellation.signal });
          const stop = await evaluate(contract.stop_condition, context);
          const witness = await evaluate(contract.progress_witness, context);
          if (stop === true) stack.pop();
          else {
            const identity = canonicalIdentity(witness);
            const defer = (result: string): never => {
              trace[trace.length - 1] = Object.freeze({ ...event, status: 'deferred', summary: result });
              throw new SrcDeferredError(result, Object.freeze({ ...bindings }));
            };
            if (identity === frame.whileLoop.progressIdentity) defer(`unresolved:no_progress:${owner.id}`);
            const next = frame.whileLoop.iteration + 1;
            if (next >= contract.maximum_symbolic_depth) {
              const result = await evaluate(contract.limit_result, context);
              defer(pythonString(result));
            }
            const condition = await evaluate(owner.expression, context);
            if (condition !== true) stack.pop();
            else { frame.index = 0; frame.whileLoop.iteration = next; frame.whileLoop.progressIdentity = identity; }
          }
          continue;
        }
        if (frame.loop && frame.loop.next < frame.loop.items.length) {
          bindings[frame.loop.iterator] = frame.loop.items[frame.loop.next++]!;
          frame.index = 0;
        } else {
          if (stack.length === 1) {
            trace[trace.length - 1] = Object.freeze({ ...event, status: 'failed', summary: 'step_without_transfer' });
            fail('step_without_transfer', `${frame.step.id} ended without NEXT or STOP`);
          }
          if (frame.loop) {
            if (frame.loop.hadPrevious) bindings[frame.loop.iterator] = frame.loop.previous!;
            else delete bindings[frame.loop.iterator];
          }
          stack.pop();
        }
        continue;
      }
      const statement = frame.body[frame.index++]!;
      const context: CallContext = Object.freeze({ workflowId, stepId: frame.step.id,
        statementId: statement.id, signal: cancellation.signal });
      instructions++;
      const event: TraceEvent = { index: instructions, workflowId, stepId: frame.step.id,
        statementId: statement.id, kind: statement.kind, phase: 'statement', depth: stack.length - 1, status: 'running' };
      const traceIndex = trace.length;
      trace.push(event);
      const complete = (details: Partial<TraceEvent>) => {
        trace[traceIndex] = Object.freeze({ ...event, ...details, status: 'completed' });
      };
      switch (statement.kind) {
        case 'CALL': {
          const value = await evaluate(statement.expression, context);
          if (statement.result_binding != null) {
            const type = types.get(statement.result_binding);
            if (type) validateType(value, type, `Result binding ${statement.result_binding}`);
            bindings[statement.result_binding] = value;
          }
          complete({ target: String(statement.expression.value),
            ...(statement.result_binding == null ? {} : { resultBinding: statement.result_binding }), summary: summary(value) });
          break;
        }
        case 'IF': {
          const condition = await evaluate(statement.expression, context);
          if (typeof condition !== 'boolean') fail('invalid_condition', `${statement.id}: IF requires a Boolean`);
          const body = condition ? statement.body! : statement.else_body ?? EMPTY;
          complete({ summary: condition ? 'true → body' : 'false → else' });
          if (body.length) stack.push({ step: frame.step, body, index: 0, owner: statement, blockKind: condition ? 'body' : 'else' });
          break;
        }
        case 'FOR_EACH': {
          const items = await evaluate(statement.expression, context);
          if (!Array.isArray(items)) fail('invalid_collection', `${statement.id}: FOR EACH requires a finite list`);
          if (items.length > collectionLimit) fail('collection_limit', `${statement.id}: collection exceeds ${collectionLimit} items`);
          complete({ summary: `${items.length} items` });
          if (items.length) {
            const iterator = statement.iterator!;
            const loop = { iterator, items, next: 1, hadPrevious: own(bindings, iterator), previous: bindings[iterator] };
            bindings[iterator] = items[0]!;
            stack.push({ step: frame.step, body: statement.body!, index: 0, owner: statement, loop });
          }
          break;
        }
        case 'WHILE': {
          const contract = statement.loop_contract!;
          const stop = await evaluate(contract.stop_condition, context);
          const condition = await evaluate(statement.expression, context);
          if (typeof stop !== 'boolean' || typeof condition !== 'boolean') fail('invalid_condition', `${statement.id}: WHILE condition/stop must be Boolean`);
          complete({ summary: condition && !stop ? 'while → body' : 'while → complete' });
          if (condition && !stop) {
            const witness = await evaluate(contract.progress_witness, context);
            stack.push({ step: frame.step, body: statement.body!, index: 0, owner: statement,
              whileLoop: { iteration: 0, progressIdentity: canonicalIdentity(witness) } });
          }
          break;
        }
        case 'NEXT': {
          const target = `${workflow.id}.${String(statement.expression.value)}`, step = steps.get(target)!;
          complete({ target, summary: `next → ${String(statement.expression.value)}` });
          // Python NEXT discards frames without unwinding loop bindings.
          stack = [{ step, body: step.statements, index: 0 }];
          break;
        }
        case 'STOP': {
          const value = await evaluate(statement.expression, context);
          complete({ summary: summary(value) });
          check();
          return { value, bindings: Object.freeze({ ...bindings }), trace, instructions };
        }
      }
    }
  } catch (error) {
    const failure = error instanceof SrcExecutionError ? error : new SrcExecutionError('execution_error', error instanceof Error ? error.message : String(error));
    const last = trace.at(-1);
    if (last?.status === 'running') trace[trace.length - 1] = Object.freeze({ ...last, status: 'failed', summary: failure.code });
    failure.trace = trace;
    failure.instructions = instructions;
    throw failure;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}
