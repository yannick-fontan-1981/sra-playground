import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { executeWorkflow, SrcExecutionError, validateCompiledModule } from '../src/logos-engine/interpreter.ts';
import { SRC_SCHEMA_VERSION } from '../src/logos-engine/ir.ts';
import type { CompiledModule, IrBinding, IrExpression, IrStatement, JsonObject, JsonValue, Primitive } from '../src/logos-engine/ir.ts';

const sourceBundle = JSON.parse(readFileSync(new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url), 'utf8'));
const reference = (value: string): IrExpression => ({ kind: 'reference', value });
const literal = (value: string | number | boolean | null): IrExpression => ({
  kind: value === null ? 'null' : typeof value === 'number' ? 'integer' : typeof value as 'string' | 'boolean', value,
});
const list = (...items: IrExpression[]): IrExpression => ({ kind: 'list', items });
const callExpression = (name: string, args: Record<string, IrExpression> = {}): IrExpression => ({
  kind: 'call', value: name, arguments: Object.entries(args).map(([name, value]) => ({ name, value })),
});
const call = (name: string, args: Record<string, IrExpression> = {}, result_binding?: string): IrStatement => ({
  id: '', kind: 'CALL', expression: callExpression(name, args), ...(result_binding ? { result_binding } : {}),
});
const stop = (expression: IrExpression): IrStatement => ({ id: '', kind: 'STOP', expression });
const next = (step: string): IrStatement => ({ id: '', kind: 'NEXT', expression: reference(step) });
const branch = (expression: IrExpression, body: IrStatement[], else_body: IrStatement[] = []): IrStatement => ({ id: '', kind: 'IF', expression, body, else_body });
const loop = (iterator: string, expression: IrExpression, body: IrStatement[]): IrStatement => ({ id: '', kind: 'FOR_EACH', iterator, expression, body });
const binding = (name: string, type = 'Any', extra: Partial<IrBinding> = {}): IrBinding => ({ name, type_spec: { name: type }, ...extra });

function moduleFor(steps: Record<string, IrStatement[]>, options: { inputs?: IrBinding[]; state?: IrBinding[] } = {}): CompiledModule {
  const id = 'test.program.run';
  const identify = (statements: readonly IrStatement[], parent: string): IrStatement[] => statements.map((item, index) => {
    const statementId = `${parent}.s${String(index).padStart(4, '0')}`;
    return { ...item, id: statementId, body: identify(item.body ?? [], `${statementId}.body`),
      else_body: identify(item.else_body ?? [], `${statementId}.else`) };
  });
  const compiledSteps = Object.entries(steps).map(([name, statements]) => ({ id: `${id}.${name}`, statements: identify(statements, `${id}.${name}`) }));
  return { module_id: 'test.program', source_name: 'test.src', source_hash: '0'.repeat(64), semantic_hash: '0'.repeat(64),
    schema_version: SRC_SCHEMA_VERSION, imports: [], source_map: [], workflows: [{ id, entry_step_id: compiledSteps[0]!.id,
      inputs: options.inputs ?? [], outputs: [binding('result')], state: options.state ?? [], steps: compiledSteps }] };
}
const run = (module: CompiledModule, inputs: JsonObject = {}, primitives: Readonly<Record<string, Primitive>> = {}, options = {}) =>
  executeWorkflow(module, 'test.program.run', inputs, primitives, options);
const errorCode = (code: string) => (error: unknown) => {
  assert.ok(error instanceof SrcExecutionError);
  assert.equal(error.code, code, error.message);
  return true;
};

test('accepts both real compiler outputs without dropping source maps or provenance', () => {
  for (const module of Object.values(sourceBundle.programs)) {
    const validated = validateCompiledModule(module);
    assert.deepEqual(validated, module);
    assert.equal(validated.schema_version, SRC_SCHEMA_VERSION);
    assert.ok(validated.source_map!.length > 10);
    assert.ok(Object.isFrozen(validated.workflows[0]!.steps));
  }
  assert.equal(sourceBundle.programs.generators.semantic_hash, '663563b4eb2d21d6e54b30068ddb32e651f916c9615e57f56e0470f8f3f16c06');
});

test('runs the actual generators IR through its observation, availability and curiosity paths', async () => {
  const compiled = sourceBundle.programs.generators as CompiledModule;
  const primitives: Record<string, Primitive> = {};
  const register = (statements: readonly IrStatement[]) => statements.forEach(statement => {
    if (statement.kind === 'CALL') primitives[String(statement.expression.value)] = () => { throw new Error('Unexpected branch'); };
    register(statement.body ?? []);
    register(statement.else_body ?? []);
  });
  compiled.workflows[0]!.steps.forEach(step => register(step.statements));
  const calls: string[] = [];
  primitives['v7.value'] = args => args.value!;
  primitives['v7.identity'] = () => 'observation-0';
  primitives['v7.contains'] = args => (args.items as readonly JsonValue[]).includes(args.value!);
  primitives['v7.emit'] = (args, context) => {
    calls.push(`${context.statementId}:${args.template}`);
    return [...args.memory as readonly JsonValue[], { template: args.template!, bindings: args.bindings! }];
  };
  const result = await executeWorkflow(compiled, 'prototype.v7.cycle', {
    request: { memory: [], has_transition: false, after: { scope: 'test', values: { x: 0 } },
      availability: { selection: { disabled_kinds: ['composition'] } } },
    interactions: ['EAST', 'WEST'],
  }, primitives);
  assert.deepEqual((result.value as JsonObject[]).map(item => item.template), ['observation', 'question', 'question']);
  assert.equal(calls.length, 3);
  assert.equal(result.trace.at(-1)?.kind, 'STOP');
  assert.equal(result.instructions, result.trace.length);
  assert.ok(result.trace.some(event => event.statementId.includes('.else.')));
  const sourceIds = new Set(compiled.source_map!.map(item => item.node_id));
  assert.ok(result.trace.every(event => sourceIds.has(event.statementId)));
  assert.ok(result.trace.every(event => !('args' in event) && !('value' in event) && !('bindings' in event)));
});

test('nested branches and loops preserve evaluation order and restore loop bindings', async () => {
  const visited: string[] = [];
  const module = moduleFor({ begin: [
    loop('outer', list(list(literal(0), literal(1)), list(literal(2))), [
      loop('inner', reference('outer'), [
        call('test.positive', { value: reference('inner') }, 'positive'),
        branch(reference('positive'), [call('test.record', { value: reference('inner'), tag: literal('yes') })],
          [call('test.record', { value: reference('inner'), tag: literal('no') })]),
      ]),
    ]),
    stop(list(reference('outer'), reference('inner'))),
  ] }, { state: [binding('outer', 'Integer', { default: literal(99) })] });
  const result = await run(module, {}, {
    'test.positive': args => Number(args.value) > 0,
    'test.record': args => { visited.push(`${args.tag}:${args.value}`); return null; },
  });
  assert.deepEqual(visited, ['no:0', 'yes:1', 'yes:2']);
  assert.deepEqual(result.value, [99, 'inner']); // Unbound SRC references stay symbolic.
  assert.equal(result.bindings.outer, 99);
  assert.equal(Object.hasOwn(result.bindings, 'inner'), false);
  assert.ok(result.trace.some(event => event.depth === 3));
  assert.ok(result.trace.some(event => event.summary === 'false → else'));
});

test('FOR EACH snapshots its collection and NEXT discards nested frames like Python', async () => {
  const seen: JsonValue[] = [];
  const module = moduleFor({
    begin: [loop('item', reference('items'), [
      call('test.keep', { value: reference('item') }),
      call('test.value', { value: list(literal(9)) }, 'items'),
    ]), next('transfer')],
    transfer: [loop('selected', list(literal(7), literal(8)), [branch(literal(true), [next('finish')])]), stop(literal('unreachable'))],
    finish: [stop(list(reference('items'), reference('selected')))],
  }, { inputs: [binding('items', 'List')] });
  const result = await run(module, { items: [1, 2] }, {
    'test.keep': args => { seen.push(args.value!); return null; },
    'test.value': args => args.value!,
  });
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(result.value, [[9], 7]);
  assert.equal(Object.hasOwn(result.bindings, 'item'), false);
  assert.equal(result.bindings.selected, 7);
  assert.equal(result.trace.filter(event => event.kind === 'NEXT').length, 2);
  assert.equal(result.trace.at(-1)?.stepId, 'test.program.run.finish');
});

test('STOP inside a loop returns immediately and keeps the current iterator', async () => {
  const result = await run(moduleFor({ begin: [loop('item', list(literal(3), literal(4)), [stop(reference('item'))]), stop(literal(9))] }));
  assert.equal(result.value, 3);
  assert.equal(result.bindings.item, 3);
  assert.equal(result.instructions, 2);
});

test('nested expression calls evaluate named arguments left to right with genuine compiled context', async () => {
  const events: string[] = [];
  const module = moduleFor({ begin: [call('test.collect', {
    first: callExpression('test.value', { value: literal('first') }),
    second: callExpression('test.value', { value: literal('second') }),
  }, 'value'), stop(reference('value'))] });
  const result = await run(module, {}, {
    'test.value': async (args, context) => { events.push(String(args.value)); assert.equal(context.statementId, 'test.program.run.begin.s0000'); return args.value!; },
    'test.collect': args => [args.first!, args.second!],
  });
  assert.deepEqual(events, ['first', 'second']);
  assert.deepEqual(result.value, ['first', 'second']);
});

test('JSON ingress is detached and immutable while successive identity calls share their graph', async () => {
  const original = { nested: { values: [1, 2, 3] } };
  let first: JsonValue | undefined;
  const result = await run(moduleFor({ begin: [call('test.value', { value: reference('request') }, 'one'),
    call('test.value', { value: reference('one') }, 'two'), stop(reference('two'))] }, { inputs: [binding('request')] }), { request: original }, {
    'test.value': args => {
      assert.ok(Object.isFrozen(args));
      assert.ok(Object.isFrozen((args.value as JsonObject).nested));
      if (first) assert.equal(args.value, first);
      else first = args.value;
      return args.value!;
    },
  });
  original.nested.values[0] = 999;
  assert.deepEqual(result.value, { nested: { values: [1, 2, 3] } });
  assert.equal(result.value, result.bindings.one);
  assert.equal(result.bindings.one, result.bindings.two);
});

test('validates unreachable branches and workflows before allowing any primitive effect', async () => {
  let calls = 0;
  const module = moduleFor({ begin: [call('test.effect'), branch(literal(false), [{ id: '', kind: 'WHILE', expression: literal(true) } as unknown as IrStatement]), stop(literal(0))] });
  await assert.rejects(run(module, {}, { 'test.effect': () => { calls++; return null; } }), errorCode('unsupported_ir'));
  assert.equal(calls, 0);
  const unused = structuredClone(moduleFor({ begin: [stop(literal(1))] }));
  const invalidWorkflow = structuredClone(unused.workflows[0]!);
  (invalidWorkflow as { id: string }).id = 'test.program.other';
  (unused.workflows as unknown[]).push(invalidWorkflow);
  await assert.rejects(run(unused), errorCode('invalid_ir'));
});

test('rejects malformed references, calls, transfer targets, fields and schema versions', async () => {
  const cases: [CompiledModule, string][] = [
    [moduleFor({ begin: [stop(reference('request..value'))] }), 'invalid_ir'],
    [moduleFor({ begin: [call('test.bad()'), stop(literal(0))] }), 'invalid_ir'],
    [moduleFor({ begin: [call('test.value', {}, 'request.value'), stop(literal(0))] }), 'invalid_ir'],
    [moduleFor({ begin: [next('absent')] }), 'invalid_ir'],
    [moduleFor({ begin: [{ ...next('begin'), expression: literal('begin') }] }), 'invalid_ir'],
    [moduleFor({ begin: [{ ...call('test.value'), expression: { kind: 'call', value: 'test.value', arguments: [{ value: literal(1) }] } }] }), 'unsupported_ir'],
    [moduleFor({ begin: [{ ...call('test.value'), expression: { kind: 'call', value: 'test.value', arguments: [{ name: 'a', value: literal(1) }, { name: 'a', value: literal(2) }] } }] }), 'invalid_ir'],
    [moduleFor({ begin: [branch(literal(false), [call('missing.primitive')]), stop(literal(1))] }), 'unknown_primitive'],
    [{ ...moduleFor({ begin: [stop(literal(1))] }), schema_version: 'unsupported' } as unknown as CompiledModule, 'unsupported_ir'],
    [moduleFor({ begin: [{ ...stop(literal(0)), target: 'secret' }] }), 'unsupported_ir'],
  ];
  for (const [module, code] of cases) await assert.rejects(run(module, {}, { 'test.value': () => 1 }), errorCode(code));
  await assert.rejects(run(moduleFor({ begin: [call('toString'), stop(literal(1))] })), errorCode('unknown_primitive'));
});

test('input types, exact booleans, member paths and collection bounds match the scoped runtime', async () => {
  const input = moduleFor({ begin: [stop(reference('request.value'))] }, { inputs: [binding('request')] });
  await assert.rejects(run(input), errorCode('invalid_input'));
  await assert.rejects(run(input, { request: {}, extra: true }), errorCode('invalid_input'));
  await assert.rejects(run(input, { request: null }), errorCode('invalid_type'));
  await assert.rejects(run(input, { request: {} }), errorCode('invalid_reference'));
  await assert.rejects(run(moduleFor({ begin: [stop(reference('request.toString'))] }, { inputs: [binding('request')] }), { request: {} }), errorCode('invalid_reference'));
  await assert.rejects(run(moduleFor({ begin: [branch(literal(1), [stop(literal(2))]), stop(literal(3))] })), errorCode('invalid_condition'));
  await assert.rejects(run(moduleFor({ begin: [loop('item', literal('abc'), [stop(literal(1))]), stop(literal(0))] })), errorCode('invalid_collection'));
  await assert.rejects(run(moduleFor({ begin: [loop('item', list(literal(1), literal(2)), [stop(reference('item'))]), stop(literal(0))] }), {}, {}, { maxCollectionItems: 1 }), errorCode('collection_limit'));
  const optional = moduleFor({ begin: [stop(reference('maybe'))] }, { inputs: [binding('maybe', 'Any', { type_spec: { name: 'Any', optional: true } })] });
  assert.equal((await run(optional)).value, null);
});

test('invalid JSON and getters cannot be smuggled through primitive returns', async () => {
  let reads = 0;
  const getter = Object.defineProperty({}, 'value', { enumerable: true, get() { reads++; return 1; } });
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  for (const invalid of [undefined, Number.NaN, Infinity, 1n, new Date(), getter, cycle, [undefined]]) {
    await assert.rejects(run(moduleFor({ begin: [call('test.invalid'), stop(literal(0))] }), {}, { 'test.invalid': () => invalid as JsonValue }), errorCode('invalid_json'));
  }
  assert.equal(reads, 0);
});

test('step fallthrough fails and a cycle stops exactly at its instruction budget', async () => {
  await assert.rejects(run(moduleFor({ begin: [call('test.value')] }), {}, { 'test.value': () => 1 }), errorCode('step_without_transfer'));
  await assert.rejects(run(moduleFor({ begin: [next('begin')] }), {}, {}, { maxInstructions: 11, yieldEvery: 3 }), error => {
    assert.ok(errorCode('instruction_limit')(error));
    assert.equal(error.instructions, 11);
    assert.equal(error.trace.length, 11);
    assert.ok(error.trace.every(event => event.status === 'completed'));
    return true;
  });
});

test('Python instruction accounting includes each completed IF body and FOR iteration', async () => {
  const module = moduleFor({ begin: [
    loop('item', list(literal(1), literal(2)), [branch(literal(true), [call('test.value', { value: reference('item') })])]),
    stop(literal('done')),
  ] });
  const result = await run(module, {}, { 'test.value': args => args.value! }, { maxInstructions: 10 });
  assert.equal(result.value, 'done');
  assert.equal(result.instructions, 10);
  assert.deepEqual(result.trace.filter(event => event.phase === 'frame_complete').map(event => event.kind),
    ['IF', 'FOR_EACH', 'IF', 'FOR_EACH']);
  assert.deepEqual(result.trace.map(event => event.statementId), [
    'test.program.run.begin.s0000',
    'test.program.run.begin.s0000.body.s0000',
    'test.program.run.begin.s0000.body.s0000.body.s0000',
    'test.program.run.begin.s0000.body.s0000',
    'test.program.run.begin.s0000',
    'test.program.run.begin.s0000.body.s0000',
    'test.program.run.begin.s0000.body.s0000.body.s0000',
    'test.program.run.begin.s0000.body.s0000',
    'test.program.run.begin.s0000',
    'test.program.run.begin.s0001',
  ]);
  await assert.rejects(run(module, {}, { 'test.value': args => args.value! }, { maxInstructions: 9 }), error => {
    assert.ok(errorCode('instruction_limit')(error));
    assert.equal(error.instructions, 9);
    assert.equal(error.trace.at(-1).phase, 'frame_complete');
    assert.equal(error.trace.some(event => event.kind === 'STOP'), false);
    return true;
  });
});

test('cooperative yielding allows a real AbortSignal to interrupt a NEXT cycle', async () => {
  const controller = new AbortController();
  const pending = run(moduleFor({ begin: [next('begin')] }), {}, {}, { signal: controller.signal, yieldEvery: 4, maxInstructions: 10_000 });
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(pending, error => {
    assert.ok(errorCode('aborted')(error));
    assert.ok(error.instructions > 0 && error.instructions < 10_000);
    return true;
  });
});

test('cancellation and deadlines can release the caller while an async primitive is pending', async () => {
  const module = moduleFor({ begin: [call('test.pending'), stop(literal(0))] });
  const controller = new AbortController();
  let signal: AbortSignal | undefined;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const pending = run(module, {}, { 'test.pending': (_, context) => { signal = context.signal; started(); return new Promise(() => {}); } }, { signal: controller.signal });
  await entered;
  controller.abort();
  await assert.rejects(pending, error => {
    assert.ok(errorCode('aborted')(error));
    assert.equal(error.trace[0].status, 'failed');
    return true;
  });
  assert.equal(signal?.aborted, true);
  await assert.rejects(run(module, {}, { 'test.pending': () => new Promise(() => {}) }, { deadlineMs: 15 }), errorCode('deadline'));
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(run(module, {}, { 'test.pending': () => { throw new Error('must not be called'); } }, { signal: alreadyAborted.signal }), errorCode('aborted'));
});
