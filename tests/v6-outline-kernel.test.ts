import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-outline-service-reference.json.gz', import.meta.url))).toString()) as R;
const controlled = fixture.controlledAcquisition as R;
const hano = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8')) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'public_outline_service', OWNER = `family_state:${ID}`;
const SOURCE_FIELDS = ['attempts', 'control', 'epoch', 'last', 'last_event', 'methods', 'tracks'];
const empty = { epoch: null, control: null, tracks: {}, methods: [], attempts: {}, last: null, last_event: null };

function graphValue(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge();
  assert.ok(graph.nodes[id], `Missing real Kernel node ${id}`);
  const value = graph.nodes[id]!.value;
  return (isNativeStateGraph(value) ? hydrateNativeState(value, key => graph.nodes[key]!.value) : value) as R;
}

function actualOwners(runtime: NativeV6Runtime) {
  const registered = (runtime as unknown as R).families as NativeFamily[];
  const acquisition = (runtime as unknown as R).acquisitionFamilies;
  return { registered, acquisition, outline: acquisition.outline as OutlineService };
}

function controlledPacket(step = 0): NativePublicObservation {
  const current = controlled.snapshots.at(-1);
  return { frame_rows: copy(current.rows), frame_packet: [copy(current.rows)],
    frame_hash: current.observation.frame_hash, available_action_refs: copy(current.observation.available_action_refs),
    level: 1, levels_completed: 0, state: 'NOT_FINISHED', step_index: step };
}

async function acquiredOwner(owner: OutlineService): Promise<void> {
  assert.deepEqual(owner.state(), empty);
  for (const transition of controlled.transitions) {
    assert.deepEqual(await owner.recordSource(transition.before, transition.after, transition.command, transition.first, transition.second), transition.value);
    assert.deepEqual(owner.state(), transition.afterState, 'The controlled raster contract is acquired through the unchanged source transition method');
  }
  assert.deepEqual(owner.state(), controlled.acquiredState);
}

/** Isolated selection domain for a synthetic contract, never a cold game run.
 * All owners, programs, guards, common acquisition and WHY/ACT are production
 * implementations. The initial owner is acquired from the public fixture above.
 * No game, successful effect, score or future route is supplied by this test. */
async function selectedFixture() {
  assert.match(controlled.qualification, /synthetic/i);
  const production = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = actualOwners(production);
  await acquiredOwner(owners.outline);
  const runtime = new NativeV6Runtime({
    sourceDigest: 'outline-controlled-public-kernel-contract', now: () => 0,
    families: owners.registered, groups: [{ id: 'factored_material_return', families: [ID] }],
    maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
    authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
    acquisitionFamilies: owners.acquisition,
  });
  const released = await runtime.initialize({ sessionId: 'outline-controlled-kernel', observation: controlledPacket(),
    budgets: { targetLevels: 3, levelActionCaps: [20, 20, 20], maxActions: 60 } }, execution);
  assert.equal(released.kind, 'action', released.reason);
  assert.equal(released.snapshot.lastDecision, ID);
  assert.deepEqual(released.command, controlled.proposal.actions[0]);
  assert.equal(released.snapshot.levelsCompleted, 0);
  return { runtime, owner: owners.outline, released };
}

test('production installs one cold outline owner in the declared material order and common SRC store', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const { registered, outline } = actualOwners(runtime);
    assert.equal(registered.filter(family => family.id === ID).length, 1);
    assert.deepEqual(outline.state(), empty);
    const service = new V6AgentService(() => runtime);
    const result = await service.handle({ type: 'init', sequence: 0, sessionId: 'outline-production-registration',
      observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    assert.notEqual(result.snapshot.lastDecision, ID, 'A visible contour without acquired control is not an outline permission');
    assert.deepEqual(outline.state(), { ...empty, epoch: outline.epoch }, 'An earlier source family may preempt outline without even scoping it');
    assert.ok(outline.epoch === null || outline.epoch === 1);
    const groups = (result.snapshot.coverage as R).sourceGroups as R[];
    assert.equal(groups.flatMap(group => group.families).filter(id => id === ID).length, 1);
    const material = groups.find(group => group.id === 'factored_material_return')!;
    const declaredOrder = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions as string[];
    assert.ok(declaredOrder.indexOf('observed_outline_service') < declaredOrder.indexOf('ordered_support_transfer'));
    assert.ok(declaredOrder.indexOf('ordered_support_transfer') < declaredOrder.indexOf('observed_framed_transfer'));
    assert.ok(material.families.indexOf(ID) < material.families.indexOf('ordered_support_transfer'));
    assert.ok(material.families.indexOf('ordered_support_transfer') < material.families.indexOf('public_framed_transfer'));
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === ID).map(node => node.id), [OWNER]);
    assert.deepEqual(graphValue(runtime, `family_activation:${ID}`), { enabled: true });
    for (const workflow of ['v6.outline_service.choose', 'v6.outline_service.bind_control']) {
      assert.ok(graph.nodes[`program:${workflow}`], 'Both actual source workflows are executable common Kernel nodes');
    }
    assert.deepEqual(graphValue(runtime, OWNER).source_state, outline.state());
    const cold = await OutlineService.create(), current = controlled.snapshots.at(-1);
    assert.equal(await cold.propose(current.observation, current.rows, [], 16), null,
      'Even the exact-fit controlled fixture cannot propose before its two public acquisitions');
    assert.deepEqual(cold.state(), { ...empty, epoch: 1 });
  } finally { runtime.close('outline_registration_contract_complete'); }
});

test('foreign actual returns acquire outline once per transition only after a multi-action prefix seals', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const { outline, acquisition } = actualOwners(runtime), calls: R[] = [], order: string[] = [];
    const record = outline.recordSource.bind(outline), framedRecord = acquisition.framed.recordPublicTransition.bind(acquisition.framed);
    (outline as R).recordSource = async (...args: any[]) => {
      order.push('outline'); calls.push({ before: args[0], after: args[1], command: args[2], first: args[3], second: args[4], proposal: args[5] });
      return (record as (...args: any[]) => Promise<R | null>)(...args);
    };
    acquisition.framed.recordPublicTransition = async (...args: any[]) => { order.push('framed'); return framedRecord(...args); };
    const captured = (reference: R): R => hano.objects[reference.$object];
    const sessionId = captured(hano.snapshots[0].observation).observation_ref.split(':epoch:')[0];
    const service = new V6AgentService(() => runtime);
    let result = await service.handle({ type: 'init', sequence: 0, sessionId,
      observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    assert.equal(result.snapshot.lastDecision, 'ordered_support_transfer');
    const initialCheckpoint = graphValue(runtime, OWNER);
    for (const [index, returned] of hano.publicProtocol.events.slice(1).entries()) {
      assert.equal(result.kind, 'action'); assert.deepEqual(result.command, returned.command);
      result = await service.handle({ type: 'advance', sequence: index + 1, sessionId,
        ticketId: result.ticket!.id, observation: copy(returned.observation), executionMs: 0 });
      if (index === 0) {
        assert.equal(calls.length, 0, 'An unfinished prefix must not acquire passive evidence');
        assert.deepEqual(graphValue(runtime, OWNER), initialCheckpoint);
      }
    }
    assert.equal(result.kind, 'boundary'); assert.equal(calls.length, 2);
    assert.deepEqual(order, ['framed', 'outline', 'framed', 'outline'], 'Source passive order is retained for each actual return');
    for (const [index, call] of calls.entries()) {
      assert.ok(call.proposal === null || call.proposal === undefined, 'Foreign commands cannot become selected local-operator experiments');
      assert.deepEqual(call.first, hano.publicProtocol.events[index].observation.frame);
      assert.deepEqual(call.second, hano.publicProtocol.events[index + 1].observation.frame);
      const command = hano.publicProtocol.events[index + 1].command;
      assert.deepEqual(call.command, { action_ref: command.actionRef, data: command.data });
    }
    assert.deepEqual(Object.keys(outline.state()).sort(), SOURCE_FIELDS);
    assert.deepEqual(outline.methods, []); assert.deepEqual(outline.attempts, {});
    assert.deepEqual(graphValue(runtime, OWNER).source_state, outline.state());
    assert.equal((result.snapshot.caller as R).acquiredTransitions, 2);
    await runtime.resume(execution);
    assert.equal(calls.length, 2, 'Planning again cannot reacquire either sealed return');
  } finally { runtime.close('outline_passive_contract_complete'); }
});

test('a selected controlled outline question passes WHY/ACT and records an unknown unchanged return exactly once', async () => {
  const { runtime, owner, released } = await selectedFixture();
  try {
    const proposal = released.snapshot.proposal as R, revision = (released.snapshot.prefix as R).revision;
    assert.ok(released.authorization, 'A family binding is not a physical authorization');
    assert.equal(proposal.material_access_subquestion, 'observed_outline_service');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal(proposal.steps[0].expected_after, null);
    assert.equal(proposal.compositions[0].observed, false);
    assert.ok(proposal.compositions[0].properties.unknown.includes('terminal_rule'));
    assert.equal(typeof proposal.outline_plan.workflow.native_execution_hash, 'string');
    assert.equal(proposal.outline_plan.workflow.edited, false);
    const beforeState = owner.state(); let calls = 0;
    const record = owner.recordSource.bind(owner);
    (owner as R).recordSource = async (...args: any[]) => { calls++; return (record as (...args: any[]) => Promise<R | null>)(...args); };
    assert.equal(calls, 0); assert.deepEqual(beforeState, controlled.acquiredState);
    await assert.rejects(runtime.edit({ expectedGraphChain: runtime.inspectKnowledge().chain!, reason: 'No edits during an action',
      changes: [{ type: 'set_family_enabled', familyId: ID, enabled: false }] }, execution), error => (error as R).code === 'busy_edit');
    const boundary = await runtime.advance({ command: released.command!, observation: controlledPacket(1), executionMs: 0 }, execution);
    assert.equal(boundary.kind, 'boundary', boundary.reason); assert.equal(calls, 1);
    assert.equal(boundary.snapshot.actions, 1); assert.equal(boundary.snapshot.levelsCompleted, 0);
    assert.equal((boundary.snapshot.caller as R).acquiredTransitions, 1);
    assert.deepEqual((boundary.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    const state = owner.state(), checkpoint = graphValue(runtime, OWNER);
    assert.deepEqual(Object.keys(state).sort(), SOURCE_FIELDS);
    assert.equal(state.methods.length, 1); assert.equal(Object.keys(state.attempts).length, 1);
    assert.equal(state.methods[0]!.status, 'no_visible_local_change');
    assert.equal(state.methods[0]!.local_count, 0); assert.equal(state.methods[0]!.remote_change_count, 0);
    assert.deepEqual(state.control, beforeState.control);
    assert.deepEqual(checkpoint, owner.nativeState()); assert.deepEqual(checkpoint.source_state, state);
    const facts = (graphValue(runtime, 'reasoning:memory').facts as string[]).map(id => graphValue(runtime, id));
    const acquired = facts.filter(fact => fact.key === `outline_service_event:${revision}`);
    assert.equal(acquired.length, 1); assert.deepEqual(acquired[0]!.value, state.methods[0]);
    assert.deepEqual(facts.find(fact => fact.key === 'outline_service_state')!.value, state);
    assert.deepEqual(graphValue(runtime, `reasoning:transition:${revision}`).caller_acquisition.selected_result.events, [state.methods[0]]);
    assert.equal(graphValue(runtime, `prefix_evidence:${revision}`).transitions.length, 1);
    owner.restore({ attempts: {}, methods: [] });
    const resumed = await runtime.resume(execution);
    assert.equal(calls, 1); assert.deepEqual(owner.state(), state, 'Authoritative graph restores the acquired refusal instead of a mutable working-copy reset');
    assert.notEqual(resumed.kind, 'action', 'The unchanged context cannot become a second local experiment');
  } finally { runtime.close('outline_selected_contract_complete'); }
});

test('outline revalidates current public geometry and rejects stale or mismatched commands without acquiring anything', async () => {
  const owner = await OutlineService.create(); await acquiredOwner(owner);
  const observation = controlled.snapshots.at(-1).observation as NativeObservation, packet = controlledPacket();
  const proposal = await owner.propose(observation, packet.frame_rows, [], 16); assert.ok(proposal);
  assert.deepEqual(await owner.before(proposal, 0, packet, observation), controlled.beforeGuard);
  const checkpoint = owner.nativeState(), revision = owner.nativeRevision;
  for (const changed of [{ ...observation, level_epoch: observation.level_epoch + 1 },
    { ...observation, frame_hash: 'changed-public-frame' },
    { ...observation, available_action_refs: observation.available_action_refs.filter(action => action !== proposal.actions[0].action_ref) }]) {
    assert.equal((await owner.before(proposal, 0, packet, changed)).admitted, false);
  }
  const pixels = copy(packet.frame_rows) as number[][], [left, top] = proposal.steps[0].body_before;
  pixels[top]![left] = pixels[top]![left]! + 1;
  assert.equal((await owner.before(proposal, 0, { ...packet, frame_rows: pixels }, observation)).admitted, false);
  const mismatch = copy(proposal); mismatch.steps[0].action = { action_ref: 'ACTION1' };
  assert.equal((await owner.before(mismatch, 0, packet, observation)).admitted, false);
  assert.equal((await owner.before(proposal, 1, packet, observation)).admitted, false);
  assert.equal(owner.nativeState(), checkpoint); assert.equal(owner.nativeRevision, revision);
});

test('outline source state and immutable Kernel checkpoint restore atomically without promoting historical control', async () => {
  const owner = await OutlineService.create(); await acquiredOwner(owner);
  const store = new NativeKnowledgeStore('outline-checkpoint-contract', 'controlled-fixture');
  await store.commit([{ id: OWNER, kind: 'family_state', family: ID, value: owner.nativeState() }],
    { workflow: 'test.outline', step: 'checkpoint', statement: 'retain' });
  const restored = await OutlineService.create(); restored.restoreNative(store.stateValue(OWNER) as R);
  assert.deepEqual(restored.state(), controlled.acquiredState);
  const current = restored.nativeState(), revision = restored.nativeRevision;
  assert.ok(Object.isFrozen(current)); assert.ok(Object.isFrozen((current.source_state as R).tracks));
  const detached = restored.state(); detached.control!.evidence.length = 0; detached.methods.push({ status: 'forged' });
  assert.deepEqual(restored.state(), controlled.acquiredState);
  for (const malformed of [{ format: 'foreign', source_state: restored.state() },
    { ...copy(current), source_state: { ...restored.state(), epoch: NaN } },
    { ...copy(current), source_state: { ...restored.state(), methods: {} } },
    { ...copy(current), source_state: { ...restored.state(), control: { ...restored.control, transitions: 'invalid' } } }]) {
    assert.throws(() => restored.restoreNative(malformed));
    assert.equal(restored.nativeState(), current); assert.equal(restored.nativeRevision, revision);
  }
  assert.throws(() => restored.restore({ last: { action_ref: 'ACTION5' }, tracks: [] }));
  assert.equal(restored.nativeState(), current);
  await restored.scope({ level_epoch: 2 }, controlledPacket().frame_rows);
  assert.equal(restored.control!.status, 'recalled_outline_hypothesis_current_unique');
  assert.deepEqual(restored.control!.controls, {}); assert.deepEqual(restored.control!.transitions, []);
  assert.deepEqual(restored.control!.evidence, []); assert.deepEqual(restored.tracks, {});
  assert.deepEqual(restored.control!.recalled_method.evidence, controlled.acquiredState.control.evidence);
});

test('outline activation edits are atomic and affect actual common selection while preserving acquired evidence', async () => {
  const { runtime, owner, released } = await selectedFixture();
  try {
    const boundary = await runtime.advance({ command: released.command!, observation: controlledPacket(1), executionMs: 0 }, execution);
    assert.equal(boundary.kind, 'boundary');
    const graph = runtime.inspectKnowledge(), state = owner.state();
    await assert.rejects(runtime.edit({ expectedGraphChain: graph.chain!, reason: 'Invalid second change must not disable the owner',
      changes: [{ type: 'set_family_enabled', familyId: ID, enabled: false },
        { type: 'replace_program', programId: 'v6.outline_service.choose', module: {} }] }, execution), error => (error as R).code === 'invalid_edit');
    assert.equal(runtime.inspectKnowledge(), graph);
    const edited = await runtime.edit({ expectedGraphChain: graph.chain!, reason: 'Disable the retained outline provider at a sealed boundary',
      changes: [{ type: 'set_family_enabled', familyId: ID, enabled: false }] }, execution);
    assert.equal(edited.snapshot.actions, 1); assert.notEqual(runtime.inspectKnowledge().chain, graph.chain);
    assert.deepEqual(runtime.inspectKnowledge().nodes[OWNER], graph.nodes[OWNER]);
    assert.deepEqual(graphValue(runtime, `family_activation:${ID}`), { enabled: false });
    const resumed = await runtime.resume(execution);
    assert.notEqual(resumed.kind, 'action'); assert.equal(resumed.snapshot.actions, 1);
    assert.deepEqual(owner.state(), state);
  } finally { runtime.close('outline_activation_contract_complete'); }
});
