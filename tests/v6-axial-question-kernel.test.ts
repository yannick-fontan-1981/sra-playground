import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { AxialQuestion } from '../src/logos-engine/v6-axial-question.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-axial-question-reference.json.gz', import.meta.url))).toString()) as R;
const ID = 'public_axial_question', OWNER = `family_state:${ID}`, ENTRY = 'axial_question';
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 };
function owner(runtime: NativeV6Runtime): AxialQuestion { return (runtime as unknown as R).acquisitionFamilies.axial; }
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
function instrument(axial: AxialQuestion) {
  const records: { action: R; selected: boolean; event: R | null }[] = [], calls = { select: 0 };
  const record = axial.recordObserved.bind(axial), select = axial.policy.select.bind(axial.policy);
  axial.recordObserved = (...args: Parameters<AxialQuestion['recordObserved']>) => {
    const event = record(...args); records.push({ action: copy(args[2]), selected: args[5] != null, event: copy(event) }); return event;
  };
  axial.policy.select = request => { calls.select++; return select(request); };
  return { records, calls };
}
async function coldSelection(runtime: NativeV6Runtime) {
  const f = fixture.kernelCold;
  const first = await runtime.initialize({ sessionId: 'axial:synthetic', observation: packet(f.initialRows, f.initialObservation), budgets }, execution);
  assert.equal(first.kind, 'action', first.reason); assert.equal(first.snapshot.lastDecision, 'observed_frontier');
  assert.deepEqual(first.command, f.selectionCommand);
  const returned = await runtime.advance({ command: first.command!, observation: packet(f.selectedRows, f.selectedObservation), executionMs: 0 }, execution);
  assert.equal(returned.kind, 'boundary'); assert.deepEqual(owner(runtime).state(), f.passive.afterState);
  return { first, returned };
}

test('Axial has one cold owner and its exact source entry after Recolor with a shared stored workflow', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const axial = owner(runtime), internals = runtime as unknown as R;
    assert.deepEqual(axial.state(), (await AxialQuestion.create()).state());
    assert.equal(internals.families.filter((f: R) => f.id === ID).length, 1);
    const configuration = { sourceDigest: 'axial-single-owner-contract', now: () => 0,
      families: internals.families, maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
      groups: [{ id: 'factored_material_return', families: [ID], entryPoints: [ENTRY] }],
      authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: internals.acquisitionFamilies };
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: internals.families.filter((f: R) => f.id !== ID) }),
      /Passive acquisition requires the registered common caller families/);
    const duplicate = await AxialQuestion.create();
    assert.throws(() => new NativeV6Runtime({ ...configuration,
      families: internals.families.map((f: R) => f.id === ID ? duplicate : f) }), /Axial passive acquisition requires its single registered owner/);
    const f = fixture.kernelCold;
    const first = await runtime.initialize({ sessionId: 'axial:synthetic', observation: packet(f.initialRows, f.initialObservation), budgets }, execution);
    const material = (first.snapshot.coverage as R).sourceGroups.find((g: R) => g.id === 'factored_material_return');
    const i = material.entryPoints.indexOf(ENTRY);
    assert.ok(i >= 0); assert.equal(material.families[i], ID);
    assert.equal(material.entryPoints[i - 1], 'topological_recolor');
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const named = material.entryPoints.filter((entry: string | null) => entry !== null);
    const order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    assert.deepEqual(named, [...named].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    const graph = runtime.inspectKnowledge();
    assert.ok(graph.nodes['program:v6.axial_question.choose']);
    assert.deepEqual(Object.values(graph.nodes).filter(n => n.kind === 'family_state' && n.family === ID).map(n => n.id), [OWNER]);
    assert.equal(value(runtime, OWNER).format, 'native.public_axial_question.v1');
    assert.equal(axial.selection, null, 'A registered/compiled family has no acquired selection');
  } finally { runtime.close('axial-registration-complete'); }
});

test('cold common caller learns a foreign selection, runs axial.select, acquires one rotation and recalls it at its next decision', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const axial = owner(runtime), probe = instrument(axial), cold = axial.state();
  try {
    await coldSelection(runtime);
    assert.equal(probe.records.length, 1); assert.equal(probe.records[0]!.selected, false);
    assert.deepEqual(probe.records[0]!.event, f.passive.value);
    assert.deepEqual(value(runtime, OWNER).source_state, f.passive.afterState);
    assert.equal(facts(runtime).filter(fact => fact.key === 'axial_question_event:1').length, 1);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'axial_question_state')!.value, f.passive.afterState);
    axial.restore(cold);
    const released = await runtime.resume(execution), proposal = released.snapshot.proposal as R;
    assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
    assert.deepEqual(released.command, f.proposal.value.actions[0]); assert.deepEqual(proposal.axial_plan, f.proposal.value.axial_plan);
    assert.equal(probe.calls.select, 1); assert.equal(probe.records.length, 1);
    assert.equal(proposal.material_access_subquestion, ENTRY); assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
    assert.equal(proposal.axial_plan.workflow.workflow, 'v6.axial_question.choose');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal((released.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.ok(released.authorization); assert.equal(proposal.steps[0].expected_after, null);
    assert.equal(axial.before(proposal, 0, packet(f.selectedRows, f.selectedObservation), f.selectedObservation).admitted, true);
    assert.equal(axial.before(proposal, 0, packet(f.selectedRows, f.contraryObservation), f.contraryObservation).admitted, false);
    const returned = await runtime.advance({ command: released.command!, observation: packet(f.contraryRows, f.contraryObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.deepEqual(axial.state(), f.active.afterState);
    assert.deepEqual(probe.records.map(item => item.selected), [false, true]);
    assert.deepEqual(probe.records[1]!.event, f.active.value);
    assert.equal(axial.rotations.length, 1);
    assert.deepEqual(value(runtime, OWNER).source_state, f.active.afterState);
    assert.deepEqual(value(runtime, 'reasoning:transition:2').caller_acquisition.selected_result.events, [f.active.value]);
    assert.equal(facts(runtime).filter(fact => fact.key === 'axial_question_event:2').length, 1);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    axial.restore(cold);
    const next = await runtime.resume(execution), nextProposal = next.snapshot.proposal as R;
    assert.equal(next.kind, 'action', next.reason); assert.equal(next.snapshot.lastDecision, ID);
    assert.deepEqual(next.command, f.next.value.actions[0]);
    assert.deepEqual(nextProposal.axial_plan, f.next.value.axial_plan);
    assert.equal(nextProposal.axial_plan.offer.method_revalidation.status, 'current_support_and_command_match');
    assert.equal(nextProposal.axial_plan.offer.method_revalidation.release_authority, false);
    assert.equal(probe.records.length, 2, 'Restoration and recall cannot re-record the return');
    // A separate native family receives only the actual acquired state with
    // its rotation receipts removed. This read-only diagnostic dispatches no
    // action and does not edit the production caller's authoritative graph.
    const without = await AxialQuestion.create(); without.restore({ ...axial.state(), rotations: [] });
    const ablated = await without.proposeSource((runtime as unknown as R).observation, f.contraryRows, [], 8);
    assert.deepEqual(ablated!.actions, fixture.kernelControlled.withoutRotationMemory.value.actions);
    assert.notDeepEqual(next.command, ablated!.actions[0]);
    assert.equal(next.snapshot.levelsCompleted, 0, 'Synthetic control evidence is not an official game success');
  } finally { runtime.close('axial-production-loop-complete'); }
});

test('two real sealed no-effect inputs exhaust the source context attempts without blind rotation repetition', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const axial = owner(runtime), probe = instrument(axial);
  try {
    await coldSelection(runtime);
    const first = await runtime.resume(execution); assert.equal(first.snapshot.lastDecision, ID);
    const obs2 = f.noEffect.arguments[1];
    await runtime.advance({ command: first.command!, observation: packet(f.selectedRows, obs2), executionMs: 0 }, execution);
    assert.deepEqual(axial.state(), f.noEffect.afterState); assert.equal(Object.keys(axial.attempts).length, 1);
    const second = await runtime.resume(execution); assert.equal(second.snapshot.lastDecision, ID);
    const expected = fixture.cases.find((c: R) => c.id === 'no_effect_prevents_same_control_repetition');
    assert.deepEqual(second.command, expected.value.actions[0]); assert.notDeepEqual(first.command, second.command);
    const obs3 = { ...obs2, revision: obs2.revision + 1, observation_ref: obs2.observation_ref.replace(/:3$/, ':4') };
    await runtime.advance({ command: second.command!, observation: packet(f.selectedRows, obs3), executionMs: 0 }, execution);
    assert.equal(Object.keys(axial.attempts).length, 2); assert.equal(axial.rotations.length, 0);
    const current = (runtime as unknown as R).observation;
    assert.deepEqual(axial.offers(current, f.selectedRows)[0], []);
    assert.deepEqual(probe.records.map(item => item.selected), [false, true, true]);
    const next = await runtime.resume(execution);
    assert.ok(next.kind !== 'action' || next.snapshot.lastDecision !== ID);
    assert.equal(probe.records.length, 3);
  } finally { runtime.close('axial-no-effect-complete'); }
});

test('an old-scene intermediate frame supports rotation at a natural boundary and only methods survive restoration', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const axial = owner(runtime), probe = instrument(axial), cold = axial.state();
  try {
    await coldSelection(runtime); const released = await runtime.resume(execution);
    const newObs = { ...f.newObservation, revision: 3 };
    const returned = await runtime.advance({ command: released.command!,
      observation: packet(f.newRows, newObs, [f.selectedRows, f.contraryRows, f.newRows]), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(returned.snapshot.levelsCompleted, 1);
    assert.equal(axial.epoch, 2); assert.equal(axial.selection, null); assert.deepEqual(axial.rotations, []);
    assert.deepEqual(axial.attempts, {}); assert.equal(axial.last, null); assert.equal(axial.portable.length, 1);
    const method = axial.portable[0]!.methods[0];
    assert.equal(method.boundary, true); assert.equal(method.frame_ordinal, 1);
    assert.equal(method.source_epoch, 1); assert.equal(axial.portable[0]!.authority, 'revisable_method_not_current_permit');
    const event = probe.records[1]!.event!;
    assert.equal(event.goal_supported_only_by_official_score, true);
    assert.deepEqual(event.native_packet_attribution.accepted_frame_ordinals, [0, 1]);
    assert.equal(event.native_packet_attribution.new_scene_is_old_effect_evidence, false);
    const retained = copy(axial.state()); assert.deepEqual(value(runtime, OWNER).source_state, retained);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'axial_question_state')!.value, retained);
    axial.restore(cold); await runtime.resume(execution);
    assert.deepEqual(axial.state(), retained); assert.equal(probe.records.length, 2);
    assert.equal(await axial.proposeSource((runtime as unknown as R).observation, f.newRows, [], 8), null,
      'The transported method is insufficient without a newly acquired current selection');
  } finally { runtime.close('axial-boundary-complete'); }
});

test('a new level with identical attribution anchors never becomes evidence for the preceding rotation', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const axial = owner(runtime), probe = instrument(axial);
  try {
    await coldSelection(runtime); const released = await runtime.resume(execution);
    const newObs = { ...f.contraryObservation, level_epoch: 2, levels_completed: 1 };
    const returned = await runtime.advance({ command: released.command!,
      observation: packet(f.contraryRows, newObs, [f.selectedRows, f.contraryRows]), executionMs: 0 }, execution);
    assert.equal(returned.snapshot.levelsCompleted, 1); assert.equal(axial.epoch, 2);
    assert.equal(axial.selection, null); assert.deepEqual(axial.rotations, []); assert.deepEqual(axial.portable, []);
    const event = probe.records[1]!.event!;
    assert.deepEqual(event.events, []); assert.equal(event.goal_supported_only_by_official_score, true);
    assert.equal(event.native_packet_attribution.status, 'ambiguous_old_and_new_scene_anchors_no_physical_contrast');
    assert.deepEqual(event.native_packet_attribution.accepted_frame_ordinals, []);
    assert.deepEqual(probe.records.map(item => item.selected), [false, true]);
  } finally { runtime.close('axial-collision-boundary-complete'); }
});

test('a transported rotation becomes useful only after the common caller reacquires selection in the new epoch', async () => {
  const f = fixture.kernelCold, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const axial = owner(runtime), probe = instrument(axial), cold = axial.state();
  try {
    await coldSelection(runtime); const first = await runtime.resume(execution);
    await runtime.advance({ command: first.command!, observation: packet(f.contraryRows, f.contraryObservation), executionMs: 0 }, execution);
    const next = await runtime.resume(execution);
    assert.equal(next.snapshot.lastDecision, ID); assert.equal(axial.rotations.length, 1);
    const unselected = { ...f.initialObservation, revision: 4, level_epoch: 2, levels_completed: 1 };
    await runtime.advance({ command: next.command!, observation: packet(f.initialRows, unselected), executionMs: 0 }, execution);
    assert.equal(axial.selection, null); assert.equal(axial.portable.length, 1);
    assert.equal(axial.portable[0]!.methods.length, 1, 'An ambiguous boundary adds no new physical rotation receipt');
    const transported = copy(axial.portable);
    axial.restore(cold);
    const foreign = await runtime.resume(execution);
    assert.equal(foreign.kind, 'action', foreign.reason); assert.notEqual(foreign.snapshot.lastDecision, ID);
    assert.deepEqual(foreign.command, f.selectionCommand); assert.deepEqual(axial.portable, transported);
    assert.equal(axial.selection, null, 'Restoration does not restore the old selection permit');
    assert.equal(axial.before(next.snapshot.proposal as R, 0, packet(f.initialRows, unselected),
      (runtime as unknown as R).observation).admitted, false);
    const selected = { ...f.selectedObservation, revision: 5, level_epoch: 2, levels_completed: 1 };
    await runtime.advance({ command: foreign.command!, observation: packet(f.selectedRows, selected), executionMs: 0 }, execution);
    assert.equal(axial.selection!.epoch, 2); assert.deepEqual(axial.portable, transported);
    assert.deepEqual(probe.records.map(row => row.selected), [false, true, true, false]);
    assert.equal(facts(runtime).filter(fact => fact.key === 'axial_question_event:4').length, 1);
    axial.restore(cold);
    const revalidated = await runtime.resume(execution), proposal = revalidated.snapshot.proposal as R;
    const expected = fixture.cases.find((row: R) => row.id === 'portable_method_current_signature_revalidated');
    assert.equal(revalidated.kind, 'action', revalidated.reason); assert.equal(revalidated.snapshot.lastDecision, ID);
    assert.deepEqual(revalidated.command, expected.value.actions[0]);
    assert.deepEqual(proposal.axial_plan.offer.method_revalidation.method, transported[0]!.methods[0]);
    assert.equal(proposal.axial_plan.offer.method_revalidation.current_epoch, 2);
    assert.equal(proposal.axial_plan.offer.method_revalidation.release_authority, false);
    assert.ok(revalidated.authorization); assert.equal(probe.records.length, 4);
    assert.deepEqual(value(runtime, OWNER).source_state, axial.state());
  } finally { runtime.close('axial-new-epoch-reacquisition-complete'); }
});
