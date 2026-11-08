import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-queued-field-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const config = declarations.strategy.declarations[0]!.configuration;
const recallPolicy = config.window_constraints.occurrence_recall;
const queuePolicy = config.window_constraints.queued_field_composition;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.queue.common', step: 'checkpoint', statement: 'retain' };

function recordSourceReturn(family: SharedSeriesConstraint, prefixIndex = 0, stepIndex = 0): R {
  const prefix = probe.prefixes[prefixIndex], step = prefix.steps[stepIndex];
  const before = probe.packets[step.actionIndex - 1], after = probe.packets[step.actionIndex];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, copy(prefix.proposal), step.index, after.packet.frame_packet);
}
function proposeAt(family: SharedSeriesConstraint, packetIndex: number): R | null {
  const entry = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  return family.queuedPropose(entry.observation, entry.packet.frame_rows, domain.candidates(entry.observation),
    600, queuePolicy, 360_000, () => 0);
}

test('cold common selection releases a scalar queue experiment and acquires its public response once in the Kernel', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = (runtime as unknown as { families: NativeFamily[] }).families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, empty = copy(family.state());
  let result = await runtime.initialize({ sessionId: 'queue-common-public-replay', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.ok(result.authorization, 'The finite queue estimate does not replace WHY/ACT authorization');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'queued_field_experiment');
  assert.equal(proposal.field_subquestion, 'queued_field_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.equal(proposal.queued_field_plan.mode, 'control_experiment');
  assert.equal(proposal.queued_field_plan.estimate, null);
  assert.deepEqual(proposal.queued_field_plan.active_control_model, {});
  assert.equal(proposal.steps[0].point_binding, undefined, 'A scalar command needs no fabricated pixel binding');
  assert.deepEqual(result.command, probe.packets[1].command);
  assert.deepEqual(family.state(), empty, 'Planning cannot acquire its own projected effect');
  const group = (result.snapshot.coverage as R).sourceGroups.find((row: R) => row.id === 'window_constraints');
  const positions = ['queued_field_composition', 'product_panel_composition', 'linked_packet_composition', 'cell_patch_composition']
    .map(entry => group.entryPoints.indexOf(entry));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || positions[index - 1] < position)));
  assert.ok(positions.every(position => group.families[position] === family.id));

  result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(probe.packets[1].packet) }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  const retained = read(ID), events = retained.events.filter((event: R) => event.kind === 'observed_queue_field_model');
  assert.equal(events.length, 1);
  assert.equal(events[0].packet_images_consumed, probe.packets[1].packet.frame_packet.length);
  assert.equal(events[0].state.controls.ACTION1.kind, 'reorder');
  assert.deepEqual(retained, family.state());
  const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
  assert.equal(prefix.transitions.length, 1);
  const transition = read(`reasoning:transition:${prefix.decision_revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);
  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.deepEqual(result.command, probe.packets[2].command);
  assert.deepEqual(family.state(), retained, 'A second inquiry must not duplicate the first actual acquisition');
});

test('dated queue models retain their source state through the shared owner and real Kernel hydration', async () => {
  const family = new SharedSeriesConstraint(recallPolicy);
  const response = recordSourceReturn(family);
  assert.deepEqual(family.queued.currentState(), probe.prefixes[0].steps[0].afterState.projection);
  const next = proposeAt(family, 1);
  assert.ok(next);
  const store = new NativeKnowledgeStore('queue-native-integration-v48', 'queue-hydrate');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const state = store.stateValue(ID) as R, restored = new SharedSeriesConstraint(recallPolicy);
  restored.restoreNative(state);
  assert.deepEqual(restored.state(), state);
  assert.deepEqual(restored.queued.currentState(), family.queued.currentState());
  assert.deepEqual(proposeAt(restored, 1), next);
  const exposed = restored.queued.currentState();
  exposed.queue_state.controls.ACTION1.kind = 'unacquired_edit';
  exposed.queue_events.length = 0;
  response.events.find((event: R) => event.kind === 'observed_queue_field_model').state.controls.ACTION1.kind = 'unacquired_edit';
  assert.deepEqual(restored.state(), state, 'Public event and state projections cannot edit acquired memory');
});

test('an acquired composed prefix preserves the fractional estimate through the existing Float64 graph codec', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  let result = await runtime.initialize({ sessionId: 'queue-fractional-prefix', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  for (let index = 1; index <= 7; index++) {
    if (result.kind === 'boundary') result = await runtime.resume(execution);
    assert.equal(result.kind, 'action', result.reason);
    assert.deepEqual(result.command, probe.packets[index].command);
    if (index === 6) {
      const plan = (result.snapshot.proposal as R).queued_field_plan;
      assert.equal(plan.mode, 'prepare_and_receive');
      assert.equal(plan.estimate.rank[1], 12.75);
      assert.equal(plan.estimate.mechanical_receipt.request.mode, 'CONDITIONAL_CLOSURE');
      assert.equal(plan.estimate.mechanical_receipt.request.event_owner_ref, 'SRC');
      assert.ok(result.authorization, 'The conditional mechanics receipt still requires current WHY/ACT authorization');
    }
    result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(probe.packets[index].packet) }, execution);
  }
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.actions, 7);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 7);
  const graph = runtime.inspectKnowledge();
  const prefix = hydrateNativeState(graph.nodes[`prefix_evidence:${(result.snapshot.prefix as R).revision}`]!.value,
    key => graph.nodes[key]!.value) as R;
  assert.equal(prefix.transitions.length, 2);
  assert.equal(prefix.proposal.queued_field_plan.estimate.rank[1], 12.75);
  assert.ok(JSON.stringify(graph.nodes).includes('4029800000000000'), 'The actual acquired prefix stores the IEEE-754 bits for 12.75');
});

test('corrupt queue journals are rejected atomically and stale checkpoints cannot hide working-memory edits', () => {
  const family = new SharedSeriesConstraint(recallPolicy);
  recordSourceReturn(family);
  const clean = family.nativeState(), corrupted = copy(clean);
  const event = corrupted.events.find((value: R) => value.kind === 'observed_queue_field_model');
  event.state.controls.ACTION1.kind = 'unacquired_edit';
  assert.throws(() => family.restore(corrupted), /Shared series memory changed/);
  assert.deepEqual(family.nativeState(), clean);
  const modified = copy(event);
  family.queued.applyEvent(modified);
  assert.notDeepEqual(family.nativeState(), clean, 'A reducer mutation must invalidate the accepted checkpoint');
  family.restoreNative(clean);
  assert.deepEqual(family.nativeState(), clean);
  assert.deepEqual(family.queued.currentState(), probe.prefixes[0].steps[0].afterState.projection);
});

test('queue composition rechecks current scalar payload, public grid and epoch before dispatch', () => {
  const family = new SharedSeriesConstraint(recallPolicy), entry = probe.packets[0];
  const proposal = proposeAt(family, 0)!;
  assert.ok(proposal);
  const domain = new ObservedInputDomain(4096); domain.candidates(entry.observation);
  family.bind(proposal, domain);
  assert.equal(family.before(proposal, 0, entry.packet, entry.observation).admitted, true);
  const alteredCommand = copy(proposal);
  alteredCommand.actions[0].action_ref = 'ACTION7';
  assert.equal(family.before(alteredCommand, 0, entry.packet, entry.observation).admitted, false);
  const withPoint = copy(proposal); withPoint.actions[0].data = { x: 3, y: 3 };
  assert.throws(() => family.bind(withPoint, domain));
  const changedGrid = copy(entry.packet), [x, y] = proposal.queued_field_plan.geometry.origin;
  changedGrid.frame_rows[y][x] = (changedGrid.frame_rows[y][x] + 1) % 16;
  assert.equal(family.before(proposal, 0, changedGrid, entry.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...entry.packet, level: 2 }, entry.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...entry.packet, available_action_refs: [] }, entry.observation).admitted, false);
});
