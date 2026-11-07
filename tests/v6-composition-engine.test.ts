import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CompositionEngine, NativeEngine, NativeModelUnavailableError, NativeSrcBridge, NeutralEngine,
  operationAdmission, validateBundle } from '../src/logos-engine/v6-composition-engine.ts';
import { NativeReasoningMemory, TREE_SHA256 } from '../src/logos-engine/v6-reasoning-memory.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-composition-engine-reference.json', import.meta.url), 'utf8'));
const constructors = { Engine: NativeEngine, CompositionEngine, NeutralEngine };
type Sample = Record<string, any>;

function setup(sample: Sample) {
  const memory = new NativeReasoningMemory({ clock: () => 1234 }); memory.importCatalog();
  for (const fact of sample.seed) memory.put(fact.episode, fact.key, fact.value, fact.evidence, fact.revision);
  const Engine = constructors[sample.engine as keyof typeof constructors];
  return { memory, engine: new Engine(memory) };
}
function normalizeMemory(memory: NativeReasoningMemory, episode: string) {
  const state = memory.state();
  return { facts: state.facts.filter(fact => fact.episode === episode).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
    traces: state.traces.filter(trace => trace.episode === episode).map(({ episode, kind, body }) => ({ episode, kind, body })) };
}
function checkOutcome(call: () => unknown, expected: Sample) {
  if (expected.accepted) assert.deepEqual(call(), expected.value);
  else assert.throws(call, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, expected.error.message);
    return true;
  });
}
const withoutTime = (report: Sample) => { const { total_ms: _time, ...value } = report; return value; };

for (const sample of fixture.bridgeCases) test(`V6 original WHY/ACT bridge parity: ${sample.id}`, async () => {
  const { memory, engine } = setup(sample), input = structuredClone(sample.request);
  assert.deepEqual(engine.prepare(input), sample.prepared, 'state/source/revision must be recalled exactly');
  const bridge = new NativeSrcBridge(engine, { continuous: true, clock: () => 0 });
  assert.equal(sample.outcome.accepted, true, 'fixture case must execute the original bridge successfully');
  const report = await bridge.run(input);
  assert.deepEqual(withoutTime(report), sample.outcome.value);
  assert.deepEqual(input, sample.request, 'prepared recall must not mutate the caller request');
  assert.deepEqual(normalizeMemory(memory, input.episode), sample.memory, 'persistent facts and SRC trace must match original');
  assert.equal(bridge.sequence, sample.sequence);
  assert.equal(bridge.last_execution!.receipt.execution_engine, 'logos-engine.typescript');
  assert.equal(bridge.last_execution!.receipt.reference_commit, fixture.commit);
  assert.equal(bridge.last_execution!.run_id, 'run:laya-continuous');
  assert.ok(!('total_ms' in sample.memory.traces.at(-1).body), 'wall-clock measurement is appended after persistence');
});

for (const sample of fixture.prepareCases) test(`V6 prepare/source/epoch admission parity: ${sample.id}`, () => {
  const { engine } = setup(sample), request = structuredClone(sample.request);
  checkOutcome(() => engine.prepare(request), sample.outcome);
  assert.deepEqual(request, sample.request);
});

for (const sample of fixture.callbackCases) test(`V6 pure callback/negative guard parity: ${sample.id}`, () => {
  const { engine, memory } = setup(sample); engine.prepare(sample.request);
  const args = structuredClone(sample.arguments), before = memory.state();
  const method = (engine as unknown as Record<string, (...args: any[]) => unknown>)[sample.method]!;
  checkOutcome(() => method.apply(engine, args), sample.outcome);
  assert.deepEqual(args, sample.arguments, 'source callbacks must not mutate supplied session or choice');
  assert.deepEqual(memory.state(), before, 'pure callbacks have no memory or game write boundary');
});

for (const sample of fixture.validationCases) test(`V6 composition contract validation parity: ${sample.id}`, () => {
  const bundle = structuredClone(sample.bundle), state = structuredClone(sample.state);
  checkOutcome(() => validateBundle(bundle, state, sample.revision), sample.outcome);
  assert.deepEqual(bundle, sample.bundle); assert.deepEqual(state, sample.state);
});

for (const sample of fixture.admissionCases) test(`V6 physical operation admission parity: ${sample.id}`, () => {
  assert.deepEqual(operationAdmission(sample.bundle, sample.result), sample.expected);
});

test('all 31 operations are reached through the real transferred SRC router with native callbacks', () => {
  assert.equal(fixture.bridgeCases.filter((sample: Sample) => sample.id.startsWith('analysis-OP')).length, 31);
  for (const sample of fixture.bridgeCases.filter((sample: Sample) => sample.id.startsWith('analysis-OP'))) {
    assert.equal(sample.outcome.value.decision.operation_result.operation, sample.id.slice('analysis-'.length));
    assert.equal(sample.outcome.value.decision.status, 'composition_analysis');
    assert.deepEqual(sample.outcome.value.decision.model_calls, []);
  }
  const changed = fixture.bridgeCases.find((sample: Sample) => sample.id === 'analysis-OP30');
  assert.ok(changed.memory.facts.some((fact: Sample) => fact.key === 'knowledge:B:color' && fact.value === 'red' && fact.evidence === 'obs1'));
});

test('missing real model is explicitly unavailable, never silently replaced or treated as success', async () => {
  const neutral = fixture.bridgeCases.find((sample: Sample) => sample.id === 'release-OP18');
  for (const mode of ['model_only', 'hybrid']) {
    const sample = mode === 'hybrid' ? fixture.bridgeCases.find((row: Sample) => row.id === 'ambiguous-code-only-abstains') : neutral;
    const { memory, engine } = setup(sample), bridge = new NativeSrcBridge(engine), before = memory.state();
    const request = { ...structuredClone(sample.request), policy: mode };
    await assert.rejects(bridge.run(request), (error: unknown) => {
      assert.ok(error instanceof NativeModelUnavailableError); assert.equal(error.code, 'native_model_unavailable');
      assert.equal(error.capability, 'laya.system_one'); return true;
    });
    assert.deepEqual(memory.state(), before, 'unavailable model must not persist a decision or authorize an action');
    assert.equal(engine.last_result, null); assert.equal(bridge.last_execution, null);
  }
  const base = fixture.bridgeCases.find((sample: Sample) => sample.id === 'base-operation-only');
  const { memory, engine } = setup(base), bridge = new NativeSrcBridge(engine);
  await assert.rejects(bridge.run({ ...base.request, policy: 'model_only' }), NativeModelUnavailableError);
  assert.equal(memory.state().traces.length, 0);
});

test('bridge restores its actual sequence/cache/result alongside the same reasoning memory revision', async () => {
  const sample = fixture.bridgeCases.find((sample: Sample) => sample.id === 'release-OP18');
  const { memory, engine } = setup(sample), first = new NativeSrcBridge(engine, { continuous: true, clock: () => 0 });
  await first.run(sample.request);
  const snapshot = first.state(), remembered = memory.state();
  const nextMemory = new NativeReasoningMemory({ clock: () => 1234 }); nextMemory.restore(remembered);
  const next = new NativeSrcBridge(new NeutralEngine(nextMemory), { continuous: true, clock: () => 0 }); next.restore(snapshot);
  assert.deepEqual(next.state(), snapshot);
  const originalReport = await first.run(sample.request), restoredReport = await next.run(sample.request);
  assert.deepEqual(restoredReport, originalReport); assert.deepEqual(nextMemory.state(), memory.state());
  assert.equal(next.sequence, 2); assert.equal(next.last_execution!.workflow_instance_id, 'instance:laya-2');
  const before = next.state();
  assert.throws(() => next.restore({ ...before, engine: { ...before.engine, tree_sha: 'wrong-source' } }), /not bound/);
  assert.deepEqual(next.state(), before, 'invalid restore cannot partially change the sequence or cache');
  assert.throws(() => next.restore({ ...before, sequence: -1 }), /checkpoint/);
  const external = next.state(); external.engine.windows.splice(0); external.engine.last_result!.status = 'forged';
  assert.deepEqual(next.state(), before, 'checkpoint values are owned snapshots');
});

test('shared V7 program edits change the actual WHY/ACT routing at the next call', async () => {
  const sample = fixture.bridgeCases.find((sample: Sample) => sample.id === 'release-OP18');
  const { memory, engine } = setup(sample), store = new NativeKnowledgeStore('native-why-act-test', 'synthetic-test');
  const bridge = new NativeSrcBridge(engine, { clock: () => 0, continuous: true }); await bridge.attachPrograms(store);
  assert.deepEqual(withoutTime(await bridge.run(sample.request)), sample.outcome.value);
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === 'prototype.laya_router.route')!.module);
  let replacements = 0;
  function replace(value: unknown) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(replace); return; }
    const record = value as Record<string, unknown>;
    if (record.kind === 'call' && record.value === 'prototype.unique') { record.value = 'prototype.abstain'; replacements++; }
    Object.values(record).forEach(replace);
  }
  replace(module); assert.equal(replacements, 1);
  const write = await store.programReplacement('prototype.laya_router.route', module);
  await store.commit([write], { workflow: 'test.why_act', step: 'edit', statement: 'unique_to_abstain' });
  const report = await bridge.run(sample.request);
  assert.equal(report.decision.status, 'abstained'); assert.equal(report.decision.action, null);
  assert.equal(report.decision.action_set, undefined); assert.notEqual(report.src_hash, sample.outcome.value.src_hash);
  assert.equal(bridge.last_execution!.receipt.edited, true);
  assert.equal(store.node('program:prototype.laya_router.route').revision, 2);
  assert.equal(memory.state().traces.at(-1)!.body.decision.status, 'abstained');
});

test('edited IR cannot return an old or fabricated decision by skipping the result callback', async () => {
  const sample = fixture.bridgeCases.find((sample: Sample) => sample.id === 'release-OP18');
  const { memory, engine } = setup(sample), store = new NativeKnowledgeStore('native-why-act-test', 'synthetic-test');
  const bridge = new NativeSrcBridge(engine, { programHost: store }); await bridge.run(sample.request);
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === 'prototype.laya_router.route')!.module);
  const next = module.workflows[0]!.steps[0]!.statements[1]! as unknown as Record<string, unknown>;
  next.kind = 'STOP'; next.expression = { kind: 'reference', value: 'session', arguments: [], items: [] };
  await store.commit([await store.programReplacement('prototype.laya_router.route', module)], { workflow: 'test.why_act', step: 'edit', statement: 'skip_result' });
  const before = memory.state();
  await assert.rejects(bridge.run(sample.request), /not bound to the completed composition callback/);
  assert.deepEqual(memory.state(), before, 'unbound result cannot cross the persistence boundary');
});

test('composition engines and router remain bound to exact original source bytes', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
  const prepared = fixture.bridgeCases[0].prepared;
  assert.equal(prepared.tree_sha, TREE_SHA256);
});
