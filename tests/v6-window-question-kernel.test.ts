import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { WindowQuestion } from '../src/logos-engine/v6-window-question.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-window-question-reference.json.gz', import.meta.url))).toString()) as R;
const ID = 'public_window_question', OWNER = `family_state:${ID}`, ENTRY = 'window_question';
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [9, 9, 9], maxActions: 27 };
function owner(runtime: NativeV6Runtime): WindowQuestion { return (runtime as unknown as R).acquisitionFamilies.window; }
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function facts(runtime: NativeV6Runtime): R[] {
  return (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
}
function packet(rows: NativeRows, obs: R, frames: readonly NativeRows[] = [rows]): NativePublicObservation {
  return { frame_rows: copy(rows), frame_packet: copy(frames), frame_hash: obs.frame_hash,
    available_action_refs: copy(obs.available_action_refs), level: obs.level_epoch, levels_completed: obs.levels_completed,
    state: obs.state, step_index: obs.revision - 1 };
}
function instrument(window: WindowQuestion) {
  const records: { action: R; selected: boolean; event: R | null }[] = [], calls = { select: 0 };
  const record = window.recordSource.bind(window), select = window.policy.select.bind(window.policy);
  window.recordSource = (...args: Parameters<WindowQuestion['recordSource']>) => {
    const event = record(...args); records.push({ action: copy(args[2]), selected: args[5] != null, event: copy(event) }); return event;
  };
  window.policy.select = request => { calls.select++; return select(request); };
  return { records, calls };
}
async function coldEdit(runtime: NativeV6Runtime, activeExecution = execution) {
  const f = fixture.kernelCold;
  const first = await runtime.initialize({ sessionId: 'window:synthetic', observation: packet(f.initialRows, f.initialObservation), budgets }, activeExecution);
  assert.equal(first.kind, 'action', first.reason); assert.equal(first.snapshot.lastDecision, 'observed_frontier');
  assert.deepEqual(first.command, f.foreignCommand);
  const returned = await runtime.advance({ command: first.command!, observation: packet(f.editedRows, f.editedObservation), executionMs: 0 }, activeExecution);
  assert.equal(returned.kind, 'boundary'); assert.deepEqual(owner(runtime).state(), f.passive.afterState);
  return { first, returned };
}

test('Window has one cold owner, its exact DRM entry and the common stored workflow', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const window = owner(runtime), internal = runtime as unknown as R;
    assert.deepEqual(window.state(), (await WindowQuestion.create()).state());
    assert.equal(internal.families.filter((family: R) => family.id === ID).length, 1);
    const configuration = { sourceDigest: 'window-single-owner-contract', now: () => 0,
      families: internal.families, maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
      groups: [{ id: 'factored_material_return', families: [ID], entryPoints: [ENTRY] }],
      authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: internal.acquisitionFamilies };
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: internal.families.filter((family: R) => family.id !== ID) }),
      /Passive acquisition requires the registered common caller families/);
    const duplicate = await WindowQuestion.create();
    assert.throws(() => new NativeV6Runtime({ ...configuration,
      families: internal.families.map((family: R) => family.id === ID ? duplicate : family) }), /Window passive acquisition requires its single registered owner/);
    const f = fixture.kernelCold;
    const first = await runtime.initialize({ sessionId: 'window:synthetic', observation: packet(f.initialRows, f.initialObservation), budgets }, execution);
    const material = (first.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'factored_material_return');
    const i = material.entryPoints.indexOf(ENTRY);
    assert.ok(i >= 0); assert.equal(material.families[i], ID);
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const named = material.entryPoints.filter((entry: string | null) => entry !== null);
    const order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    assert.deepEqual(named, [...named].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    const graph = runtime.inspectKnowledge();
    assert.ok(graph.nodes['program:v6.window_question.choose']);
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === ID).map(node => node.id), [OWNER]);
    assert.equal(value(runtime, OWNER).format, 'native.public_window_question.v1');
    assert.deepEqual(window.edits, [], 'Registration and compilation do not acquire a control law');
  } finally { runtime.close('window-registration-complete'); }
});

test('cold common caller learns a foreign edit, executes window.select and uses its actual return at the next decision', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const window = owner(runtime), probe = instrument(window), cold = window.state();
  const oldController = new AbortController(), oldExecution = { ...execution, signal: oldController.signal };
  const guardContexts: (NativeExecution | undefined)[] = [], guard = window.before.bind(window);
  window.before = async (...args: Parameters<WindowQuestion['before']>) => { guardContexts.push(args[4]); return guard(...args); };
  try {
    await coldEdit(runtime, oldExecution);
    assert.deepEqual(probe.records.map(row => row.selected), [false]);
    assert.deepEqual(probe.records[0]!.event, f.passive.value);
    assert.deepEqual(value(runtime, OWNER).source_state, f.passive.afterState);
    assert.equal(facts(runtime).filter(fact => fact.key === 'window_question_event:1').length, 1);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'window_question_state')!.value, f.passive.afterState);
    // Only the common graph restores learned state. Cancelling the completed
    // request must not poison a later guard through a cached execution context.
    window.restore(cold); oldController.abort();
    const released = await runtime.resume(execution), proposal = released.snapshot.proposal as R;
    assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
    assert.deepEqual(released.command, f.proposal.value.actions[0]);
    assert.deepEqual(proposal.window_question_plan, f.proposal.value.window_question_plan);
    assert.equal(probe.calls.select, 1); assert.equal(probe.records.length, 1);
    assert.equal(guardContexts.at(-1)!.signal, execution.signal, 'Authorization must use the current request signal');
    assert.equal(guardContexts.at(-1)!.deadlineMs, 360_000, 'Authorization must carry its current level deadline');
    assert.equal(proposal.material_access_subquestion, ENTRY); assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
    assert.equal(proposal.window_question_plan.workflow.workflow, 'v6.window_question.choose');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal((released.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.ok(released.authorization); assert.equal(proposal.steps[0].expected_after, null);
    assert.equal(window.beforeSource(proposal, 0, packet(f.editedRows, f.editedObservation), f.editedObservation).admitted, true);
    assert.equal(window.beforeSource(proposal, 0, packet(f.readyRows, f.readyObservation), f.readyObservation).admitted, false);
    const returned = await runtime.advance({ command: released.command!, observation: packet(f.readyRows, f.readyObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.deepEqual(window.state(), f.active.afterState);
    assert.deepEqual(probe.records.map(row => row.selected), [false, true]);
    assert.deepEqual(probe.records[1]!.event, f.active.value);
    assert.deepEqual(value(runtime, OWNER).source_state, f.active.afterState);
    assert.deepEqual(value(runtime, 'reasoning:transition:2').caller_acquisition.selected_result.events, [f.active.value]);
    assert.equal(facts(runtime).filter(fact => fact.key === 'window_question_event:2').length, 1);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    window.restore(cold);
    const next = await runtime.resume(execution), nextProposal = next.snapshot.proposal as R;
    assert.equal(next.kind, 'action', next.reason); assert.equal(next.snapshot.lastDecision, ID);
    assert.deepEqual(next.command, f.launch.value.actions[0]);
    assert.deepEqual(nextProposal.window_question_plan, f.launch.value.window_question_plan);
    assert.equal(nextProposal.window_question_plan.offer.kind, 'traversal_question');
    assert.equal(nextProposal.window_question_plan.offer.method_revalidation.release_authority, false);
    assert.equal(probe.records.length, 2, 'Restoration and proposal cannot acquire the same return again');
    const without = await WindowQuestion.create(); without.restore({ ...window.state(), edits: [], portable: [] });
    assert.equal(await without.proposeSource((runtime as unknown as R).observation, f.readyRows, [], 7), null);
    assert.equal(next.snapshot.levelsCompleted, 0, 'Synthetic controls do not prove an official game success');
  } finally { runtime.close('window-production-loop-complete'); }
});

test('an acquired no-effect setting is retained as an attempt and cannot immediately repeat', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const window = owner(runtime), probe = instrument(window);
  try {
    await coldEdit(runtime);
    const released = await runtime.resume(execution); assert.equal(released.snapshot.lastDecision, ID);
    const obs = f.noEffect.arguments[1];
    await runtime.advance({ command: released.command!, observation: packet(f.editedRows, obs), executionMs: 0 }, execution);
    assert.deepEqual(window.state(), f.noEffect.afterState);
    assert.equal(Object.keys(window.attempts).length, 1);
    assert.deepEqual(probe.records.map(row => row.selected), [false, true]);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'window_question_state')!.value, f.noEffect.afterState);
    const retained = copy(window.state()), current = (runtime as unknown as R).observation;
    const next = await runtime.resume(execution);
    assert.ok(next.kind !== 'action' || next.snapshot.lastDecision !== ID || JSON.stringify(next.command) !== JSON.stringify(released.command));
    const without = await WindowQuestion.create(); without.restore({ ...retained, attempts: {} });
    const ablated = await without.proposeSource(current, f.editedRows, [], 7);
    assert.deepEqual(ablated!.actions[0], released.command, 'Only removal of the actual attempt makes the repeated setting available');
  } finally { runtime.close('window-no-effect-complete'); }
});

test('launch packets and last alone survive the native checkpoint without inventing a source state publication', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const window = owner(runtime), probe = instrument(window), cold = window.state();
  try {
    const first = await runtime.initialize({ sessionId: 'window:synthetic', observation: packet(f.initialRows, f.initialObservation), budgets }, execution);
    assert.equal(first.kind, 'action'); assert.notEqual(first.snapshot.lastDecision, ID);
    const after = { ...f.editedObservation, frame_hash: f.initialObservation.frame_hash };
    await runtime.advance({ command: first.command!, observation: packet(f.initialRows, after, [f.initialRows, f.initialRows]), executionMs: 0 }, execution);
    assert.deepEqual(window.edits, []); assert.deepEqual(window.portable, []); assert.deepEqual(window.attempts, {});
    assert.equal(window.launches.length, 1); assert.ok(window.last);
    assert.equal(window.sourceStateShouldPersist(), false);
    assert.equal(facts(runtime).some(fact => fact.key === 'window_question_state'), false);
    const retained = window.state(); assert.deepEqual(value(runtime, OWNER).source_state, retained);
    window.restore(cold); await runtime.resume(execution);
    assert.deepEqual(window.state(), retained);
    assert.deepEqual(probe.records.map(row => row.selected), [false]);
  } finally { runtime.close('window-complete-checkpoint-complete'); }
});
