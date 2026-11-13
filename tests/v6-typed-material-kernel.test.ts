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
import { proposedTypedMaterialInquiryWitness } from '../src/logos-engine/v6-typed-material-evidence.ts';
import { typedMaterialDigest } from '../src/logos-engine/v6-typed-material-observation.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = async (name: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(`./fixtures/${name}`, import.meta.url))).toString());
const probe = await fixture('v6-typed-material-original-public.json.gz');
const nativeTrace = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v50/life-public-trace-final.json.gz', import.meta.url))).toString()) as R;
const nativeCampaign = JSON.parse(await readFile(new URL('../docs/migration/native-campaigns-v50/life-three-levels-final.json', import.meta.url), 'utf8')) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const policy = declarations.strategy.declarations[0]!.configuration.window_constraints;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const OWNER = 'family_state:public_occurrence_recall';
const OWN = new Set(['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response']);
const FLAGS = ['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'];
const ownEvents = (events: R[]): R[] => events.filter(event => OWN.has(event.kind));

async function offer(family: SharedSeriesConstraint, packetIndex: number, remaining = 600): Promise<R | null> {
  const row = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  return family.materialPropose(row.observation, row.packet.frame_rows, domain.candidates(row.observation), remaining, policy.typed_material_flow);
}

// This component/common-owner replay is distinct from full-caller selection.
// Every native proposal is recalculated before its actual source public return
// is consumed; neither imported learned state nor a source action is proposed
// by the runtime. Source IDs are not equated with native numeric identities.
type Timeline = { states: R[]; actionOffsets: number[]; proposals: R[]; };
let timelinePromise: Promise<Timeline> | undefined;
function timeline(): Promise<Timeline> {
  return timelinePromise ??= (async () => {
    const family = new SharedSeriesConstraint(policy.occurrence_recall);
    const states = [copy(family.nativeState())], actionOffsets = [0], proposals: R[] = [];
    let packetIndex = 0;
    for (const prefix of probe.prefixes) {
      const initial = probe.packets[packetIndex], beforeState = copy(family.nativeState());
      const proposal = await offer(family, packetIndex); assert.ok(proposal);
      assert.deepEqual(proposal.actions, prefix.proposal.actions, 'The component chooses before receiving the recorded return');
      assert.deepEqual(family.nativeState(), beforeState, 'Planning cannot acquire a material transformation');
      const domain = new ObservedInputDomain(4096); domain.candidates(initial.observation);
      family.bind(proposal, domain); proposals.push(copy(proposal));
      for (let index = 0; index < proposal.actions.length; index++) {
        const first = probe.packets[packetIndex], second = probe.packets[packetIndex + 1];
        assert.deepEqual(proposal.actions[index], second.command);
        assert.equal(family.before(proposal, index, first.packet, first.observation).admitted, true);
        const response = family.record(first.observation, second.observation, copy(proposal.actions[index]),
          first.packet.frame_rows, second.packet.frame_rows, proposal, index, second.packet.frame_packet);
        assert.deepEqual(ownEvents(response.events).map(event => event.kind),
          ownEvents(prefix.steps[index].acquired.events).map(event => event.kind), 'Common-owner event order follows the source layers');
        packetIndex++;
      }
      states.push(copy(family.nativeState())); actionOffsets.push(packetIndex);
    }
    assert.equal(packetIndex, probe.actions);
    return { states, actionOffsets, proposals };
  })();
}
async function at(prefixCount: number): Promise<{ family: SharedSeriesConstraint; packetIndex: number }> {
  const recorded = await timeline(), family = new SharedSeriesConstraint(policy.occurrence_recall);
  family.restoreNative(copy(recorded.states[prefixCount]!));
  return { family, packetIndex: recorded.actionOffsets[prefixCount]! };
}

test('material witnesses separate a current cold measurement from context acquired by actual component returns', async context => {
  for (const prefixCount of [0, 1, 2, 3, 7, 14, 34, 42]) await context.test(`after ${prefixCount} recorded component prefixes`, async () => {
    const { family, packetIndex } = await at(prefixCount), row = probe.packets[packetIndex], proposal = await offer(family, packetIndex);
    assert.ok(proposal);
    const state = family.material.currentState(), checkpoint = copy(family.nativeState());
    const witness = proposedTypedMaterialInquiryWitness(state, proposal, row.observation, row.packet.frame_rows);
    assert.ok(witness, `The actual current component question has a witness at prefix ${prefixCount}`);
    assert.equal(witness.proposal_ref, proposal.proposal_id);
    assert.equal(witness.observation_ref, row.observation.observation_ref);
    assert.equal(witness.effect_requires_actual_return, true);
    if (prefixCount === 0) {
      assert.equal(witness.status, 'current_measured_relation_for_unknown_effect');
      assert.deepEqual(witness.acquisition_event_refs, []); assert.deepEqual(witness.context_model_ids, []);
      assert.equal(witness.supportBoxes.length, 4);
      assert.equal(witness.measured_relation.selection_and_production_unconfirmed, true);
      const forged = copy(state); forged.carrier_context = { kind: 'local_marking', evidence: ['unacquired'] };
      assert.equal(proposedTypedMaterialInquiryWitness(forged, proposal, row.observation, row.packet.frame_rows), null);
    } else {
      assert.equal(witness.status, 'acquired_context_for_unknown_effect');
      assert.ok(witness.acquisition_event_refs.length > 0); assert.ok(witness.context_model_ids.length > 0);
      const events = [...state.carrier_events, ...state.flow_events, ...state.pose_events];
      const refs = new Set(events.map(event => 'typed-material-event:' + typedMaterialDigest(event)));
      assert.ok(witness.acquisition_event_refs.every((ref: string) => refs.has(ref)), 'Every acquisition ref identifies a retained own event');
      const unacquired = { ...copy(state), carrier_events: [], flow_events: [], pose_events: [] };
      assert.equal(proposedTypedMaterialInquiryWitness(unacquired, proposal, row.observation, row.packet.frame_rows), null,
        'Copied contexts, children, associations or pose rules cannot substitute for acquired event witnesses');
    }
    const stopped = { ...copy(state), requested_stop_reason: 'controlled_contradiction' };
    assert.equal(proposedTypedMaterialInquiryWitness(stopped, proposal, row.observation, row.packet.frame_rows), null);
    assert.equal(proposedTypedMaterialInquiryWitness(state, proposal, { ...row.observation, observation_ref: 'stale-view' }, row.packet.frame_rows), null);
    const stalePoint = copy(proposal); stalePoint.steps[0].point_support.projected_rows_digest = 'stale-support';
    assert.equal(proposedTypedMaterialInquiryWitness(state, stalePoint, row.observation, row.packet.frame_rows), null);
    assert.deepEqual(family.nativeState(), checkpoint, 'Witness inspection cannot turn a current relation into learned material state');
  });
});

test('cold common caller acquires the first material level through one graph owner and real WHY/ACT', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, initial = copy(family.state());
  assert.deepEqual((initial as R).events, []);
  let result = await runtime.initialize({ sessionId: 'anonymous-typed-material-common-cold', observation: copy(nativeTrace.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.equal(result.kind, 'action', result.reason);
  assert.deepEqual(family.state(), initial);
  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const order: string[] = window.entryPoints;
  assert.ok(order.indexOf('observed_program_composition') < order.indexOf('typed_material_flow'));
  assert.ok(order.indexOf('typed_material_flow') < order.indexOf('radial_port_composition'));
  let eventCount = 0;
  const firstBoundary = nativeCampaign.boundaries[0].totalActions;
  assert.equal(firstBoundary, 15);
  for (let index = 0; index < firstBoundary; index++) {
    if (result.kind === 'boundary') {
      const retained = copy(family.state()); result = await runtime.resume(execution);
      assert.deepEqual(family.state(), retained, 'Resuming a prefix cannot duplicate material acquisition');
    }
    assert.equal(result.kind, 'action', result.reason);
    assert.deepEqual(result.command, nativeTrace.packets[index + 1].command,
      `Action ${index + 1}: native provider ${result.snapshot.lastDecision}`);
    const recordedPrefix = nativeCampaign.prefixes[index];
    assert.equal(result.snapshot.lastDecision, recordedPrefix.family);
    const proposal = result.snapshot.proposal as R;
    assert.ok(result.authorization, 'A material hypothesis cannot bypass WHY/ACT');
    if (index === 0) {
      assert.equal(result.snapshot.lastDecision, 'animated_contact');
      assert.equal(proposal.kind, 'measured_animated_contact');
      assert.equal(proposal.strategy_receipt.native_coordination, undefined);
    } else {
      assert.equal(result.snapshot.lastDecision, family.id);
      assert.equal(proposal.field_subquestion, 'typed_material_flow');
      assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
      assert.ok(FLAGS.some(key => proposal[key]));
      assert.deepEqual(proposal.steps[0].point_binding.point, [result.command!.data!.x, result.command!.data!.y]);
      assert.equal(proposal.steps[0].point_binding.palette_value,
        nativeTrace.packets[index].packet.frame_rows[result.command!.data!.y][result.command!.data!.x]);
      assert.equal(proposal.steps[0].expected_after, null, 'Initial material interactions remain experiments');
      assert.equal(proposal.strategy_receipt.native_coordination[0].rule, 'returned_unlearned_contact_refusal_is_local');
      assert.equal(proposal.strategy_receipt.native_coordination[0].current_inquiry.status,
        index === 1 ? 'current_measured_relation_for_unknown_effect' : 'acquired_context_for_unknown_effect');
    }
    result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(nativeTrace.packets[index + 1].packet) }, execution);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    const graph = runtime.inspectKnowledge();
    const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
    const state = read(OWNER); assert.deepEqual(state, family.state());
    eventCount += recordedPrefix.sharedSeries.typedMaterialAcquiredEvents.length;
    assert.equal(ownEvents(state.events).length, eventCount);
    assert.equal(eventCount, recordedPrefix.sharedSeries.typedMaterialEventCount);
    const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
    assert.equal(prefix.transitions.length, 1);
    const transition = read(`reasoning:transition:${prefix.decision_revision}`);
    assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    if (index === 0) {
      assert.deepEqual(ownEvents(state.events), [], 'The foreign invitation supplies no learned material fact');
    } else if (index === 1) {
      const own = ownEvents(state.events);
      assert.deepEqual(own.map(event => event.kind), ['typed_carrier_response', 'typed_pose_scope']);
      assert.equal(own[0]!.contact_context.kind, 'local_marking');
      assert.equal(own[0]!.official_progress, false);
    }
  }
  assert.equal(result.kind, 'boundary'); assert.equal(result.reason, null);
  assert.equal(result.snapshot.actions, firstBoundary); assert.equal(result.snapshot.levelsCompleted, 1);
  assert.equal(result.snapshot.level, 2); assert.equal((result.snapshot.caller as R).boundaryReplays, 1);
});

test('material graph hydration preserves three acquired layers, detached views and source re-proposal context', async () => {
  const { family, packetIndex } = await at(3), original = copy(family.nativeState());
  const own = family.material.currentState();
  assert.equal(own.carrier_calibration.length, 1); assert.equal(own.flow_children.length, 2);
  assert.equal(own.carrier_context, null); assert.equal(Object.keys(own.flow_models).length, 0);
  assert.equal(own.pose_events.length, 1);
  const store = new NativeKnowledgeStore('typed-material-native-integration-v50', 'material-hydrate');
  await store.commit([{ id: OWNER, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.material.common', step: 'checkpoint', statement: 'retain' });
  const retained = store.stateValue(OWNER) as R, restored = new SharedSeriesConstraint(policy.occurrence_recall);
  restored.restoreNative(retained);
  assert.deepEqual(restored.nativeState(), original);
  assert.deepEqual(restored.material.currentState(), own);
  assert.deepEqual(await offer(restored, packetIndex), await offer(family, packetIndex));
  assert.deepEqual(restored.nativeState(), original, 'Restoring then setting proposal config does not acquire anything');
  const detached = restored.material.currentState();
  detached.flow_children[0]!.marks[0]![1] = 12345;
  detached.carrier_events.length = 0;
  assert.deepEqual(restored.material.currentState(), own, 'Exposed currentState never aliases retained material state');
  const { family: later } = await at(14), laterOwn = later.material.currentState();
  assert.equal(Object.keys(laterOwn.flow_models).length, 4);
  assert.equal(Object.keys(laterOwn.pose_models).length, 4);
  assert.deepEqual(laterOwn.flow_children, []);
  assert.equal(laterOwn.pose_rule, null, 'Official boundary retains associations but clears local pose law');
});

test('current material support, public epoch and exact point remain required before dispatch', async () => {
  const { family, packetIndex } = await at(3), row = probe.packets[packetIndex], proposal = await offer(family, packetIndex);
  assert.ok(proposal); assert.equal(proposal.material_flow_plan.mode, 'select');
  assert.throws(() => family.bind(copy(proposal), new ObservedInputDomain(4096)), /current observed (input )?domain|binding|bound/i);
  const domain = new ObservedInputDomain(4096); domain.candidates(row.observation); family.bind(proposal, domain);
  assert.equal(family.before(proposal, 0, row.packet, row.observation).admitted, true);
  assert.equal(family.before(proposal, 1, row.packet, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, level: 99 }, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, levels_completed: 99 }, row.observation).admitted, false);
  assert.equal(family.before(proposal, 0, row.packet, { ...row.observation, observation_ref: 'unacquired-observation' }).admitted, false);
  assert.equal(family.before(proposal, 0, { ...row.packet, available_action_refs: [] }, row.observation).admitted, false);
  const changed = copy(row.packet); changed.frame_rows[0][0] = (changed.frame_rows[0][0] + 1) % 16;
  assert.equal(family.before(proposal, 0, changed, row.observation).admitted, false);
  const point = copy(proposal); point.actions[0].data.x++;
  assert.throws(() => family.bind(point, domain), /point|payload/i);
  assert.equal(family.before(point, 0, row.packet, row.observation).admitted, false);
  const next = probe.packets[packetIndex + 1];
  const outcome = family.after(proposal, 0, row.observation, next.observation, row.packet.frame_rows, next.packet.frame_rows);
  assert.equal(outcome.matched, null); assert.equal(outcome.seal_prefix, true);
  assert.equal(outcome.official_progress, false, 'Selection marking is not individual correctness');
});

test('an acquired pose path is conditional on marks, preserved exterior and the current observed control', async () => {
  const first = await at(34), unknown = await offer(first.family, first.packetIndex);
  assert.ok(unknown); assert.equal(unknown.material_pose_plan.reason, 'probe_new_control_with_selected_role');
  assert.equal(unknown.actions.length, 1); assert.deepEqual(unknown.material_pose_plan.expected_after, []);
  assert.equal(first.family.material.currentState().pose_rule, null);
  const actualFirst = probe.packets[first.packetIndex], actualNext = probe.packets[first.packetIndex + 1];
  const uncharacterized = first.family.after(unknown, 0, actualFirst.observation, actualNext.observation,
    actualFirst.packet.frame_rows, actualNext.packet.frame_rows);
  assert.equal(uncharacterized.matched, null); assert.equal(uncharacterized.seal_prefix, true);
  const { family, packetIndex } = await at(42), proposal = await offer(family, packetIndex);
  assert.ok(proposal); assert.equal(proposal.material_pose_plan.reason, 'conditional_typed_pose_path');
  assert.equal(proposal.actions.length, 3);
  const before = probe.packets[packetIndex], after = probe.packets[packetIndex + 1];
  const domain = new ObservedInputDomain(4096); domain.candidates(before.observation); family.bind(proposal, domain);
  assert.equal(family.before(proposal, 0, before.packet, before.observation).admitted, true);
  const result = family.after(proposal, 0, before.observation, after.observation, before.packet.frame_rows, after.packet.frame_rows);
  assert.equal(result.matched, true); assert.equal(result.seal_prefix, false);
  assert.equal(family.before(proposal, 1, after.packet, after.observation).admitted, true);
  const outside = copy(after.packet);
  const boxes = [proposal.material_pose_plan.child.bbox, proposal.material_pose_plan.control.bbox];
  assert.ok(boxes.every(([x, y, r, b]: number[]) => !(x! <= 0 && 0 <= r! && y! <= 0 && 0 <= b!)));
  outside.frame_rows[0][0] = (outside.frame_rows[0][0] + 1) % 16;
  assert.equal(family.before(proposal, 1, outside, after.observation).admitted, false);
  const refuted = family.after(proposal, 0, before.observation, after.observation, before.packet.frame_rows, outside.frame_rows);
  assert.equal(refuted.matched, false); assert.equal(refuted.seal_prefix, true);
  const capped = await offer(family, packetIndex, 1); assert.ok(capped); assert.equal(capped.actions.length, 1);
});

test('material journals reject corruption atomically and retained checkpoints cannot hide later changes', async () => {
  const { family } = await at(3), clean = copy(family.nativeState()), corrupt = copy(clean);
  corrupt.events.find((event: R) => event.kind === 'typed_material_flow').added_children[0].marks[0][1] += 1;
  assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
  assert.deepEqual(family.nativeState(), clean);
  const recorded = await timeline(); family.restoreNative(copy(recorded.states[14]!));
  assert.notDeepEqual(family.nativeState(), clean);
  family.restoreNative(clean);
  assert.deepEqual(family.nativeState(), clean, 'Accepted old checkpoint is checked against the present reducer revisions');
  assert.equal(family.material.currentState().flow_children.length, 2);
});

test('the source Rooted ancestor cutoff does not invent material acquisition from another provider', async context => {
  const rooted = await fixture('v6-rooted-quota-original-public.json.gz');
  const family = new SharedSeriesConstraint(policy.occurrence_recall), own = copy(family.material.currentState());
  context.mock.method(family.material, 'record', () => { throw new Error('Rooted must cut off its older material ancestors'); });
  const first = rooted.packets[0], next = rooted.packets[1], p = rooted.prefixes[0].proposal;
  const response = family.record(first.observation, next.observation, copy(next.command), first.packet.frame_rows,
    next.packet.frame_rows, copy(p), 0, next.packet.frame_packet);
  assert.ok(response.events.some((event: R) => event.kind === 'rooted_quota_state'));
  assert.deepEqual(ownEvents(response.events), []);
  assert.deepEqual(family.material.currentState(), own);
});
