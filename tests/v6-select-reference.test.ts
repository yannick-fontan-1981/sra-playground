import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { declaredSelectionResult, projectSelectionOutput, createDrmSelectPrimitive, DrmSelectionBlockedError, validateSelectionInput, validateSelectRequest } from '../src/logos-engine/v6-drm-selection.ts';
import { NativeDrmRegistry } from '../src/logos-engine/v6-drm-projector.ts';
import { executeWorkflow, validateCompiledModule, SrcExecutionError } from '../src/logos-engine/interpreter.ts';
import { NativeSrcProgram } from '../src/logos-engine/v6-src-program.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { SRC_SCHEMA_VERSION } from '../src/logos-engine/ir.ts';
import type { CompiledModule, IrExpression, JsonObject, Primitive } from '../src/logos-engine/ir.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-select-reference.json.gz', import.meta.url))).toString());
const builderFixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-select-builder-reference.json.gz', import.meta.url))).toString());
const bundle = JSON.parse(readFileSync(new URL('../src/logos-engine/v6/programs.json', import.meta.url), 'utf8'));
const selectedCase = fixture.cases.find((row: any) => row.name === 'source_single');
const blockedCase = fixture.cases.find((row: any) => row.name === 'source_hashed_reference_unresolved');
const policyRef = selectedCase.policy.id;
const ref = (value: string): IrExpression => ({ kind: 'reference', value });
const lit = (value: string): IrExpression => ({ kind: 'string', value });
const list = (...items: IrExpression[]): IrExpression => ({ kind: 'list', items });

test('SELECT comparison fixture records exact original source bytes', () => {
  for (const original of [fixture, builderFixture]) {
    for (const [path, hash] of Object.entries(original.sourceHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL('../reference/v6/' + original.referenceCommit + '/source/' + path, import.meta.url))).digest('hex'), hash);
  }
});

for (const row of fixture.cases) test('SELECT unchanged source evaluator and output ' + row.name, () => {
  const input = structuredClone(row.input), policy = structuredClone(row.policy);
  if (row.error) { assert.throws(() => declaredSelectionResult(input, policy)); return; }
  const result = declaredSelectionResult(input, policy);
  assert.deepEqual(result, row.result);
  assert.deepEqual(input, row.input); assert.deepEqual(policy, row.policy);
  if (row.blocked) assert.throws(() => projectSelectionOutput(input.alternative_refs, result), (error: any) => {
    assert.ok(error instanceof DrmSelectionBlockedError); assert.equal(error.code, 'selection_blocked');
    assert.deepEqual(error.selectionRefusal, row.result); return true;
  });
  else assert.deepEqual(projectSelectionOutput(input.alternative_refs, result), row.output);
});

async function authority(policy: any = selectedCase.policy) {
  const registry = new NativeDrmRegistry();
  const text = JSON.stringify({ module_id: 'test.original.select', declarations: [policy] });
  await registry.registerSource(text, createHash('sha256').update(text).digest('hex')); registry.seal();
  return createDrmSelectPrimitive(registry, policy.id);
}

function selectModule(): CompiledModule {
  return { module_id: 'test.select', source_name: 'test-select.src', source_hash: '0'.repeat(64), semantic_hash: '0'.repeat(64), schema_version: SRC_SCHEMA_VERSION, imports: [], source_map: [],
    workflows: [{ id: 'test.select.run', entry_step_id: 'test.select.run.start', inputs: [{ name: 'request', type_spec: { name: 'Any' } }], outputs: [{ name: 'result', type_spec: { name: 'Any' } }], state: [{ name: 'assessed', type_spec: { name: 'Any' } }], steps: [{ id: 'test.select.run.start', statements: [
      { id: 'test.select.run.start.s0000', kind: 'SELECT', target: 'assessed', clauses: [
        { name: 'FOR', value: ref('request.goal_ref') }, { name: 'FROM', value: ref('request.alternative_refs') }, { name: 'UNDER', value: lit(policyRef) },
        { name: 'REQUIRE', value: ref('request.requirement_refs') }, { name: 'PRESERVE', value: ref('request.preserve_refs') },
        { name: 'FACTS', value: ref('request.alternative_facts') }, { name: 'CONTEXT', value: ref('request.context_facts') }, { name: 'DOMINANCE', value: ref('request.dominance_witnesses') } ] },
      { id: 'test.select.run.start.s0001', kind: 'STOP', expression: ref('assessed') },
    ] }] }] };
}

test('SELECT interpreter binds the complete declared assessment and emits its statement trace', async () => {
  const select = await authority(), calls: any[] = [], original = structuredClone(selectedCase.input);
  const result = await executeWorkflow(selectModule(), 'test.select.run', { request: original }, { [policyRef]: (args, context) => { calls.push(structuredClone(args)); return select(args, context); } });
  assert.equal(calls.length, 1); assert.equal(calls[0].request.selection_policy_ref, policyRef);
  assert.deepEqual(result.value, selectedCase.output); assert.deepEqual(result.bindings.assessed, selectedCase.output);
  assert.deepEqual(original, selectedCase.input);
  assert.deepEqual(result.trace.map(row => row.kind), ['SELECT', 'STOP']);
  assert.equal(result.trace[0]?.resultBinding, 'assessed'); assert.equal(result.trace[0]?.target, policyRef);
});

test('SELECT unresolved equality retains the exact refusal without continuing the workflow', async () => {
  const select = await authority(); let next = 0;
  const module = selectModule(); (module.workflows[0]!.steps[0]!.statements as any[]).splice(1, 0, { id: 'test.select.run.start.after', kind: 'CALL', expression: { kind: 'call', value: 'test.after', arguments: [] } });
  await assert.rejects(executeWorkflow(module, 'test.select.run', { request: blockedCase.input }, { [policyRef]: select, 'test.after': () => { next++; return null; } }), (error: any) => {
    assert.ok(error instanceof DrmSelectionBlockedError); assert.deepEqual(error.selectionRefusal, blockedCase.result); return true;
  }); assert.equal(next, 0);
});

const malformed: [string, (statement: any) => void][] = [
  ['missing clause', s => { s.clauses = s.clauses.filter((c: any) => c.name !== 'UNDER'); }],
  ['duplicate clause', s => { s.clauses.push(structuredClone(s.clauses[0])); }],
  ['unknown clause', s => { s.clauses.push({ name: 'EXECUTE', value: lit('none') }); }],
  ['undefined clause expression', s => { delete s.clauses[0].value; }],
  ['malformed clause expression', s => { s.clauses[0].value = { kind: 'string' }; }],
  ['callback inside clause', s => { s.clauses[0].value = { kind: 'call', value: 'test.side', arguments: [] }; }],
  ['missing target', s => { delete s.target; }],
  ['expression alongside SELECT', s => { s.expression = lit('unexpected'); }],
  ['CALL-style result binding', s => { s.result_binding = 'alias'; }],
  ['unexpected body', s => { s.body = [{ id: 'test.select.run.start.nested', kind: 'STOP', expression: lit('bad') }]; }],
];
for (const [name, mutate] of malformed) test('SELECT malformed IR fails before callbacks: ' + name, async () => {
  const module = selectModule(); mutate(module.workflows[0]!.steps[0]!.statements[0]); let calls = 0;
  const primitives = { [policyRef]: () => { calls++; return null; }, 'test.side': () => { calls++; return null; } };
  assert.throws(() => validateCompiledModule(module, primitives), SrcExecutionError);
  await assert.rejects(executeWorkflow(module, 'test.select.run', { request: selectedCase.input }, primitives), SrcExecutionError);
  assert.equal(calls, 0);
});

test('SELECT absent authority and authority rebinding cannot call an evaluator', async () => {
  let calls = 0; const select = await authority();
  await assert.rejects(executeWorkflow(selectModule(), 'test.select.run', { request: selectedCase.input }, { 'other.authority': () => { calls++; return null; } }), (error: any) => error.code === 'unknown_selection_authority');
  assert.equal(calls, 0);
  assert.throws(() => select({ request: { ...selectedCase.input, selection_policy_ref: 'other.authority' } }, {} as any), /authority binding mismatch/);
});

test('SelectionInput preserves source data while SelectRequest enforces request-only uniqueness and witness scope', async () => {
  const primitive = await authority();
  for (const field of ['requirement_refs', 'preserve_refs']) {
    const input = { ...selectedCase.input, [field]: ['same', 'same'] };
    assert.deepEqual(declaredSelectionResult(input, selectedCase.policy), selectedCase.result);
    assert.throws(() => primitive({ request: { ...input, selection_policy_ref: policyRef } }, {} as any));
  }
  const direct = fixture.cases.find((row: any) => row.name === 'dominance_undeclared_error');
  assert.deepEqual(declaredSelectionResult(direct.input, direct.policy), direct.result);
  const partialOrder = await authority(direct.policy);
  assert.throws(() => partialOrder({ request: { ...direct.input, selection_policy_ref: direct.policy.id } }, {} as any));
});

for (const field of ['requirement_refs', 'preserve_refs', 'dominance_witnesses']) test('SelectionInput rejects explicit null instead of defaulting sequence ' + field, () => {
  // Pinned operators/contracts.py SelectionInput defaults omitted tuples; an
  // explicit None fails Pydantic validation and cannot erase a supplied clause.
  assert.throws(() => validateSelectionInput({ ...selectedCase.input, [field]: null }));
});

for (const row of builderFixture.cases) test('SELECT unchanged source builder admission ' + row.name, async () => {
  const module = selectModule(), original = structuredClone(row.clauses); let calls = 0;
  (module.workflows[0]!.steps[0]!.statements[0] as any).clauses = Object.keys(row.clauses).map(name => ({ name, value: ref('request.' + name) }));
  const callbacks = { [row.request?.selection_policy_ref ?? 'test.policy']: (args: JsonObject) => { calls++; return args.request!; } };
  const execution = executeWorkflow(module, 'test.select.run', { request: original }, callbacks);
  if (row.error) {
    await assert.rejects(execution, (error: any) => error instanceof SrcExecutionError && error.code === 'invalid_selection_request');
    assert.equal(calls, 0, 'Invalid evaluated clauses must fail before the declared authority callback');
  } else {
    const result = await execution;
    assert.deepEqual(result.value, row.request); assert.equal(calls, 1);
  }
  assert.deepEqual(original, row.clauses);
});

test('direct SelectRequest accepts empty requirements and null fact maps while the source builder rejects those clauses', () => {
  const request = validateSelectRequest({ ...selectedCase.input, selection_policy_ref: policyRef,
    requirement_refs: [], preserve_refs: [], alternative_facts: null, context_facts: null });
  assert.deepEqual(request.requirement_refs, []); assert.deepEqual(request.preserve_refs, []);
  assert.deepEqual(request.alternative_facts, {}); assert.deepEqual(request.context_facts, {});
});

test('SELECT refuses unsupported Python container repr and nonexact scalar references before callbacks', async () => {
  for (const [name, value] of [['FOR', {}], ['UNDER', []], ['FROM', [{}]], ['REQUIRE', [[]]], ['PRESERVE', [1.5]]] as const) {
    const module = selectModule(); let calls = 0;
    const base = builderFixture.cases.find((row: any) => row.name === 'explicit_empty_optionals').clauses;
    const clauses = { ...base, [name]: value };
    (module.workflows[0]!.steps[0]!.statements[0] as any).clauses = Object.keys(clauses).map(name => ({ name, value: ref('request.' + name) }));
    await assert.rejects(executeWorkflow(module, 'test.select.run', { request: clauses }, { 'test.policy': () => { calls++; return null; } }),
      (error: any) => error instanceof SrcExecutionError && error.code === 'invalid_selection_request');
    assert.equal(calls, 0);
  }
});

test('actual Source81 compiled SELECT executes unchanged through the common native program store', async () => {
  const select = await authority(); let selectedCalls = 0, finishCalls = 0;
  const callbacks: Record<string, Primitive> = {
    [policyRef]: (args, context) => { selectedCalls++; return select(args, context); },
    'source81.project_candidates': () => ({ has_eligible: true, goal_ref: selectedCase.input.goal_ref, alternative_refs: selectedCase.input.alternative_refs, alternative_facts: selectedCase.input.alternative_facts }),
    'source81.finish_selection': args => { finishCalls++; return args.assessment!; },
    'source81.abstain': () => ({ status: 'abstain' }),
    'source81.publish': args => args.request!,
    'source81.publish_continuation': args => args.request!,
    'source81.publish_target_revision': args => args.request!,
  };
  const referenceModule = bundle.programs['v6.source81.prepare'].module;
  assert.deepEqual(validateCompiledModule(referenceModule, callbacks), referenceModule);
  const standalone = await NativeSrcProgram.create('v6.source81.prepare', callbacks);
  const first = await standalone.run({ request: {} }); assert.deepEqual(first.result, selectedCase.output);
  assert.ok(first.receipt.trace.some(row => row.kind === 'SELECT'));
  const store = new NativeKnowledgeStore('select-reference', 'select-store');
  const stored = await store.registerProgram('v6.source81.prepare', callbacks), result = await stored.run({ request: {} });
  assert.deepEqual(result.result, first.result); assert.equal(result.receipt.src_hash, first.receipt.src_hash); assert.equal(result.receipt.edited, false);
  assert.deepEqual(result.receipt.executed_statements, first.receipt.executed_statements);
  assert.equal(selectedCalls, 2); assert.equal(finishCalls, 2);
  assert.equal(store.node('program:v6.source81.prepare').kind, 'program');
});
