import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-framed-transfer-original-public.json.gz', import.meta.url))).toString()) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const OWNER = 'family_state:public_framed_transfer';
const empty = { epoch: null, spans: [], receipts: [], attempts: {}, portable: [], last: null };

async function cold() {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = (runtime as unknown as { families: NativeFamily[] }).families.filter(family => family.id === 'public_framed_transfer');
  assert.equal(owners.length, 1);
  const family = owners[0] as FramedTransfer;
  assert.deepEqual(family.state(), empty, 'No component proof or learned state initializes the common caller');
  const result = await runtime.initialize({ sessionId: 'anonymous-framed-common', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  const read = (id: string): R => {
    const graph = runtime.inspectKnowledge();
    assert.ok(graph.nodes[id], `Missing actual Kernel node ${id}`);
    return hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  };
  return { runtime, family, result, read };
}

test('two declared framed entries share one activated owner and the real common SRC program store', async () => {
  const { runtime, family, result, read } = await cold();
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.deepEqual(result.command, probe.packets[1].command, 'The cold native caller calculates its own first command');
  assert.ok(result.authorization, 'The component does not bypass common WHY/ACT');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.material_access_subquestion, 'observed_framed_transfer');
  assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
  assert.equal(proposal.strategy_receipt.native_coordination, undefined);
  assert.equal(proposal.steps[0].expected_after, null, 'A proposed point effect is still unknown');
  const groups = (result.snapshot.coverage as R).sourceGroups as R[];
  const declared = declarations.strategy.declarations[0]!.configuration;
  for (const [groupId, entry] of [['window_constraints', 'observed_framed_analogy'], ['factored_material_return', 'observed_framed_transfer']]) {
    const group = groups.find(value => value.id === groupId)!;
    const index = group.entryPoints.indexOf(entry);
    assert.ok(index >= 0); assert.equal(group.families[index], family.id);
    const present = group.entryPoints.filter((value: unknown) => value !== null);
    const original = (declared[groupId!] as R).ordered_subquestions;
    assert.deepEqual(present, original.filter((value: string) => present.includes(value)), 'Each retained source entry keeps its declaration order');
  }
  const graph = runtime.inspectKnowledge();
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === family.id).map(node => node.id), [OWNER]);
  assert.deepEqual(graph.nodes['family_activation:public_framed_transfer']!.value, { enabled: true });
  const workflow = proposal.framed_transfer_plan.workflow;
  assert.ok(graph.nodes[`program:${workflow.workflow}`], 'The actual selected choose program is an executable Kernel node');
  assert.equal(typeof workflow.native_execution_hash, 'string'); assert.equal(workflow.edited, false);
  assert.deepEqual(family.state(), { ...empty, epoch: 1 }, 'Planning scopes the current epoch without inventing observations');
});

test('a selected actual framed return is acquired once through OP29/30/31 and the authoritative family graph', async () => {
  const { runtime, family, result: released, read } = await cold();
  const revision = (released.snapshot.prefix as R).revision;
  const result = await runtime.advance({ command: released.command!, executionMs: 0, observation: copy(probe.packets[1].packet) }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 1); assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
  const checkpoint = read(OWNER), state = family.state(), sourceAfter = probe.prefixes[0].steps[0].afterState;
  assert.deepEqual(checkpoint, family.nativeState()); assert.deepEqual(checkpoint.source_state, state);
  assert.equal(state.spans.length, sourceAfter.spans.length); assert.equal(state.receipts.length, sourceAfter.receipts.length);
  assert.equal(Object.keys(state.attempts).length, 1);
  const transition = read(`reasoning:transition:${revision}`), prefix = read(`prefix_evidence:${revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  assert.equal(prefix.transitions.length, 1); assert.deepEqual(prefix.proposal, released.snapshot.proposal);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  const events = facts.filter(fact => fact.key === `framed_transfer_event:${revision}`);
  assert.equal(events.length, 1);
  assert.deepEqual(events[0]!.value, transition.caller_acquisition.selected_result.events[0]);
  assert.equal(events[0]!.value.status, 'public_transition_acquired');
  assert.deepEqual(events[0]!.value.source_result, state.last,
    'The original acquisition remains a separately retained exact result');
  assert.ok(events[0]!.value.native_result, 'Additional public-packet measurement has an explicit result');
  assert.deepEqual(facts.find(fact => fact.key === 'framed_transfer_state')!.value, state,
    'The original reasoning fact contains source fields, while only the native owner has a checkpoint envelope');
  const beforeResume = family.state(); await runtime.resume(execution);
  assert.deepEqual(family.state(), beforeResume, 'The next question does not reacquire the previous physical return');
});

test('foreign multi-action prefixes teach framed observations only after sealing, in original source order', async () => {
  const oracle = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8')) as R;
  const original = (reference: R): R => oracle.objects[reference.$object];
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime);
  const sessionId = original(oracle.snapshots[0].observation).observation_ref.split(':epoch:')[0];
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: oracle.publicProtocol.events[0].observation, budgets: oracle.budgets });
  assert.equal(result.kind, 'action'); assert.equal(result.snapshot.lastDecision, 'ordered_support_transfer');
  const read = (id: string): R => {
    const graph = runtime.inspectKnowledge();
    return hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  };
  const before = copy(read(OWNER));
  for (const [index, row] of oracle.publicProtocol.events.slice(1).entries()) {
    assert.deepEqual(result.command, row.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1,
      ticketId: result.ticket!.id, observation: row.observation, executionMs: 0 });
    if (index === 0) assert.deepEqual(read(OWNER), before, 'An unfinished prefix cannot become learned evidence');
  }
  assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.cycles, 1);
  const nativeFacts = (read('reasoning:memory').facts as string[]).map(read);
  const sourceFacts = original(oracle.snapshots.find((row: R) => row.stage === 'prefix_analyzed').memory).facts;
  const select = (facts: R[]) => facts.filter(fact => /^framed_transfer_event:\d+$/.test(fact.key));
  assert.equal(select(sourceFacts).length, 2);
  const acquired = select(nativeFacts);
  assert.ok(acquired.every(fact => fact.value.status === 'public_transition_acquired'));
  assert.deepEqual(acquired.map(fact => ({ ...fact, value: fact.value.source_result })), select(sourceFacts),
    'The independent complete original caller observed these two passive source events');
  assert.ok(acquired.every(fact => fact.value.native_result.derived.length === 0),
    'These foreign returns do not invent a public-packet reception');
  assert.deepEqual(read(OWNER).source_state.attempts, {}, 'A foreign command is not relabeled as a selected framed experiment');
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 2);
});

test('the cold common caller retains the current binding proof before releasing the source-refused thirteenth point', async () => {
  // The independent original campaign stopped after twelve actual returns.
  // This read-only replay releases one new question; it does not supply that
  // question's future return or assert a second completed level.
  const { runtime, family, result: first, read } = await cold();
  let result = first;
  for (let index = 0; index < probe.actions; index++) {
    if (result.kind === 'boundary') result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.deepEqual(result.command, probe.packets[index + 1].command);
    result = await runtime.advance({ command: result.command!, executionMs: 0, observation: copy(probe.packets[index + 1].packet) }, execution);
  }
  assert.equal(result.kind, 'boundary'); assert.equal(result.snapshot.actions, 12);
  assert.equal(result.snapshot.levelsCompleted, 1);
  const acquired = family.state(); result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.equal(result.snapshot.actions, 12, 'A released question is not counted as a physical action');
  assert.deepEqual(family.state(), acquired, 'Rebinding a description cannot acquire a future result');
  const proposal = result.snapshot.proposal as R;
  assert.deepEqual(result.command, probe.prefixes.at(-1).proposal.actions[0]);
  assert.equal(proposal.steps[0].expected_after, null);
  const revision = (result.snapshot.prefix as R).revision, graph = runtime.inspectKnowledge();
  assert.equal(graph.nodes[`reasoning:transition:${revision}`], undefined);
  const binding = read(`reasoning:binding:${revision}`);
  assert.equal(binding.guard.admitted, true);
  assert.equal(binding.guard.native_binding_receipt.source_guard.admitted, false);
  assert.equal(binding.guard.native_binding_receipt.current_description_count, 2);
  assert.equal(binding.guard.native_binding_receipt.selected_current_bindings, 1);
  assert.equal(binding.guard.native_binding_receipt.same_physical_point, true);
  assert.equal(binding.guard.native_binding_receipt.point_binding_current, true);
  assert.equal(binding.guard.native_binding_receipt.release_authority, false);
  assert.equal(binding.guard.native_binding_receipt.expected_effect_status, 'unknown');
  assert.deepEqual(binding.command, result.command);
  assert.equal(binding.observation_ref, proposal.binding.observation_ref);
  assert.equal(binding.frame_hash, proposal.binding.frame_hash);
  assert.ok(result.authorization, 'A binding witness still passes through ordinary common WHY/ACT');
});

test('scoped component checkpoints preserve historical records without turning them into a current permit', async () => {
  // This is a component hydration contract using an independent recorded state,
  // not a cold game campaign or a common caller initialized from learned data.
  const boundary = probe.prefixes.find((prefix: R) => prefix.steps.some((step: R) => step.acquired?.status === 'boundary'));
  assert.ok(boundary);
  const state = boundary.steps.at(-1).afterState, family = await FramedTransfer.create();
  family.restore(copy(state));
  assert.ok(family.portable.length > 0);
  assert.ok(family.portable.every(item => item.authority === 'historical_not_current_permit'));
  assert.deepEqual(family.spans, []); assert.deepEqual(family.receipts, []); assert.deepEqual(family.attempts, {});
  const store = new NativeKnowledgeStore('framed-native-integration-v52', 'framed-hydration');
  await store.commit([{ id: OWNER, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.framed', step: 'checkpoint', statement: 'retain' });
  const restored = await FramedTransfer.create(); restored.restoreNative(store.stateValue(OWNER) as R);
  assert.deepEqual(restored.state(), state);
  const detached = restored.state(); detached.portable[0]!.spans.length = 0; detached.epoch = 999;
  assert.deepEqual(restored.state(), state, 'Public state is detached from authoritative historical evidence');
  const current = restored.nativeState();
  assert.ok(Object.isFrozen(current) && Object.isFrozen((current.source_state as R).portable));
  assert.equal(restored.nativeState(), current, 'Unchanged checkpoints retain their immutable identity');
  const revision = restored.nativeRevision;
  for (const malformed of [{ format: 'foreign', source_state: state }, { ...copy(current), source_state: { ...state, epoch: NaN } },
    { ...copy(current), source_state: { ...state, portable: [{ source_epoch: 1, spans: [], receipts: [], authority: 'current_permit' }] } }]) {
    assert.throws(() => restored.restoreNative(malformed));
    assert.equal(restored.nativeState(), current); assert.equal(restored.nativeRevision, revision);
  }
});
