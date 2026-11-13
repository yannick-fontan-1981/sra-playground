import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = async (name: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(`./fixtures/${name}`, import.meta.url))).toString());
const probe = await fixture('v6-field-service-original-public.json.gz');
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const strategy = JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8'));
const policy = strategy.declarations[0]!.configuration.window_constraints;
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy,
} as NativeV6Declarations;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const OWNER = 'family_state:public_occurrence_recall';
const OWN = new Set(['nested_control_response', 'envelope_fill_context', 'field_service_context', 'field_service_transfer']);
const ownEvents = (events: R[]): R[] => events.filter(event => OWN.has(event.kind));
const layerCounts = (state: R): number[] => ['nested_events', 'fill_events', 'service_events', 'transfer_events'].map(key => state[key].length);

async function offer(family: SharedSeriesConstraint, packetIndex: number, remaining = 600): Promise<R | null> {
  const row = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  return family.servicePropose(row.observation, row.packet.frame_rows, domain.candidates(row.observation), remaining, policy.field_service_composition);
}

// This replay tests the translated component through the common acquired owner.
// It does not claim that the full caller selected the isolated source provider.
// At every step, the native proposal is calculated before consuming the recorded
// public return. The source action is an assertion, never a planning input.
type Timeline = { states: R[]; actionOffsets: number[]; proposals: R[]; ownStates: R[] };
let timelinePromise: Promise<Timeline> | undefined;
function timeline(): Promise<Timeline> {
  return timelinePromise ??= (async () => {
    const family = new SharedSeriesConstraint(policy.occurrence_recall);
    const states = [copy(family.nativeState())], ownStates = [family.service.currentState()], actionOffsets = [0], proposals: R[] = [];
    let packetIndex = 0;
    for (const [prefixIndex, prefix] of probe.prefixes.entries()) {
      const initial = probe.packets[packetIndex], checkpoint = copy(family.nativeState());
      const proposal = await offer(family, packetIndex);
      assert.ok(proposal, `Source component prefix ${prefixIndex} has a native current question`);
      assert.deepEqual(proposal.actions, prefix.proposal.actions, `Component prefix ${prefixIndex} independently chooses its point`);
      assert.equal(proposal.kind, prefix.proposal.kind);
      assert.deepEqual(family.nativeState(), checkpoint, 'A question cannot acquire its hypothesized service response');
      const domain = new ObservedInputDomain(4096); domain.candidates(initial.observation);
      family.bind(proposal, domain); proposals.push(copy(proposal));
      for (let index = 0; index < proposal.actions.length; index++) {
        const first = probe.packets[packetIndex], second = probe.packets[packetIndex + 1];
        assert.deepEqual(proposal.actions[index], second.command);
        assert.equal(family.before(proposal, index, first.packet, first.observation).admitted, true);
        const outcome = family.after(proposal, index, first.observation, second.observation, first.packet.frame_rows, second.packet.frame_rows);
        assert.equal(outcome.matched, null, 'Every service response remains unknown before its actual return');
        assert.equal(outcome.seal_prefix, true);
        assert.equal(outcome.official_progress, second.observation.levels_completed > first.observation.levels_completed);
        const acquired = family.record(first.observation, second.observation, copy(proposal.actions[index]),
          first.packet.frame_rows, second.packet.frame_rows, proposal, index, second.packet.frame_packet);
        assert.deepEqual(ownEvents(acquired.events).map(event => event.kind),
          ownEvents(prefix.steps[index].acquired.events).map(event => event.kind), `Source own-layer order at component prefix ${prefixIndex}`);
        assert.deepEqual(layerCounts(family.service.currentState()), layerCounts(prefix.steps[index].afterState.projection));
        assert.equal(family.service.requestedStopReason, prefix.steps[index].afterState.requestedStopReason);
        packetIndex++;
      }
      states.push(copy(family.nativeState())); ownStates.push(family.service.currentState()); actionOffsets.push(packetIndex);
    }
    assert.equal(packetIndex, probe.actions);
    assert.equal(probe.fullOriginalCaller, false, 'The independent probe explicitly limits its claim to the source component');
    return { states, ownStates, actionOffsets, proposals };
  })();
}
async function at(prefixCount: number): Promise<{ family: SharedSeriesConstraint; packetIndex: number }> {
  const recorded = await timeline(), family = new SharedSeriesConstraint(policy.occurrence_recall);
  family.restoreNative(copy(recorded.states[prefixCount]!));
  return { family, packetIndex: recorded.actionOffsets[prefixCount]! };
}

test('source service questions acquire four own layers only through actual dated public returns', async () => {
  const recorded = await timeline(), states = recorded.ownStates;
  assert.deepEqual(layerCounts(states[0]!), [0, 0, 0, 0]);
  assert.equal(states[0]!.fill_context, null); assert.equal(states[0]!.transfer_model, null);
  assert.deepEqual(layerCounts(states[1]!), [1, 1, 0, 0]);
  assert.equal(states[1]!.fill_context.phase, 'repeat');
  assert.equal(states[2]!.fill_context.repeatable_extent_change, false, 'The opaque replacement prevents a quantitative repeatability conclusion');
  assert.equal(states[2]!.fill_context.phase, 'contrast');
  assert.equal(states[3]!.fill_context.observed_previous_field_state_restored, true);
  assert.equal(states[3]!.fill_context.phase, 'repeat_contrast');
  assert.equal(states[4]!.fill_context.restored_measured_fields, true);
  assert.equal(states[4]!.fill_context.phase, 'service_choice_required');
  assert.equal(states[4]!.service_context.phase, 'isolate');
  assert.equal(states[4]!.requested_stop_reason, null, 'Actual acquisition supplies the next source service question');
  assert.deepEqual(layerCounts(states[5]!), [5, 4, 2, 1]);
  assert.equal(states[5]!.service_context.phase, 'serve');
  assert.equal(states[5]!.service_context.field_contents_preserved, true);
  assert.equal(states[5]!.service_context.paired_control_orientation_changed, true);
  assert.equal(states[5]!.service_context.nonlocal_appearance_effect_unknown, true);
  assert.deepEqual(states[5]!.fill_context, states[4]!.fill_context, 'Isolating a paired control cannot be recorded as another fill pulse');
  assert.equal(states[5]!.transfer_model.receiver, null);
  assert.equal(states[5]!.transfer_model.official_boundary_witness, undefined);
  assert.equal(states[10]!.service_context.phase, 'boundary_revalidation_required');
  assert.equal(states[10]!.transfer_model.official_boundary_witness.length, 2);
  assert.equal(states[10]!.transfer_context, null);
  assert.equal(states[11]!.transfer_context.source_revalidated, false);
  assert.equal(states[12]!.transfer_context.source_revalidated, true);
  assert.equal(states[20]!.transfer_context, null, 'A boundary clears the current binding while retaining the geometric hypothesis');
  assert.deepEqual(states[20]!.transfer_model, states[10]!.transfer_model);
  assert.equal(states[21]!.transfer_context.unknown_intermediate, true);
  assert.equal(states[23]!.transfer_context.new_field_observations.length, 1);
  assert.deepEqual(layerCounts(states[28]!), [28, 4, 7, 24]);
  assert.equal(states[28]!.transfer_context, null);
  assert.equal(probe.levelsCompleted, 3);
});

test('the cold common caller acquires the actual native service campaign through one owner and ordinary WHY/ACT', async () => {
  const nativeTrace = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v51/valv-public-trace.json.gz', import.meta.url))).toString()) as R;
  const nativeCampaign = JSON.parse(await readFile(new URL('../docs/migration/native-campaigns-v51/valv-three-levels.json', import.meta.url), 'utf8')) as R;
  assert.equal(nativeCampaign.status, 'passed'); assert.equal(nativeCampaign.pythonAgentModules.length, 0);
  assert.equal(nativeCampaign.final.actions, nativeTrace.packets.length - 1);
  assert.ok(nativeCampaign.prefixes.every((prefix: R) => prefix.acquiredActions === 1), 'This actual campaign sealed each unknown return');
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owners = (runtime as unknown as { families: NativeFamily[] }).families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, empty = copy(family.state());
  assert.deepEqual(empty.events, []);
  let result = await runtime.initialize({ sessionId: 'anonymous-field-service-common-cold', observation: copy(nativeTrace.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.deepEqual(family.state(), empty, 'The caller starts without imported component state');
  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const entries = ['radial_port_composition', 'field_service_composition', 'rooted_quota_composition'];
  const indices = entries.map(entry => window.entryPoints.indexOf(entry));
  assert.ok(indices.every((index, position) => index >= 0 && (position === 0 || index > indices[position - 1]!)));
  assert.ok(indices.every(index => window.families[index] === family.id));
  let eventCount = 0, priorRevision = 0;
  const boundaries: R[] = [];
  for (let index = 0; index < nativeCampaign.final.actions; index++) {
    if (result.kind === 'boundary') {
      const retained = copy(family.state()); result = await runtime.resume(execution);
      assert.deepEqual(family.state(), retained, 'Resuming never duplicates the previous service return');
    }
    assert.equal(result.kind, 'action', result.reason);
    const recordedPrefix = nativeCampaign.prefixes[index], before = nativeTrace.packets[index], after = nativeTrace.packets[index + 1];
    assert.deepEqual(result.command, after.command, `Native campaign action ${index + 1} is recalculated before its public return`);
    assert.equal(result.snapshot.lastDecision, recordedPrefix.family, 'The actual native provider is preserved; the source component is not forced');
    assert.ok(result.authorization, 'A service hypothesis must pass the common WHY/ACT authorization');
    const proposal = copy(result.snapshot.proposal as R), prefixRevision = (result.snapshot.prefix as R).revision;
    assert.equal(proposal.kind, recordedPrefix.proposalKind);
    if (recordedPrefix.fieldService) {
      assert.equal(result.snapshot.lastDecision, family.id);
      assert.equal(proposal.field_subquestion, 'field_service_composition');
      assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
      assert.equal(proposal.strategy_receipt.native_coordination, undefined, 'Source-order service selection needs no added priority rule');
      assert.ok(proposal.nested_control_plan);
      assert.deepEqual(proposal.steps[0].point_binding.point, [result.command!.data!.x, result.command!.data!.y]);
      assert.equal(proposal.steps[0].point_binding.palette_value, before.packet.frame_rows[result.command!.data!.y][result.command!.data!.x]);
      assert.equal(proposal.steps[0].expected_after, null);
    }
    result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(after.packet) }, execution);
    assert.equal(result.snapshot.actions, index + 1);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, index + 1);
    const graph = runtime.inspectKnowledge();
    const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === family.id).map(node => node.id), [OWNER]);
    assert.ok(graph.nodes[OWNER]!.revision > priorRevision); priorRevision = graph.nodes[OWNER]!.revision;
    const state = read(OWNER), prefix = read(`prefix_evidence:${prefixRevision}`);
    assert.deepEqual(state, family.state());
    assert.deepEqual(prefix.proposal, proposal); assert.equal(prefix.transitions.length, 1);
    const currentOwn = ownEvents(state.events), newlyAcquired = currentOwn.slice(eventCount);
    assert.deepEqual(newlyAcquired.map(event => event.kind), recordedPrefix.sharedSeries.fieldServiceAcquiredEvents.map((event: R) => event.kind));
    eventCount += newlyAcquired.length;
    assert.equal(eventCount, recordedPrefix.sharedSeries.fieldServiceEventCount);
    const transition = read(`reasoning:transition:${prefix.decision_revision}`);
    assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
    assert.deepEqual(ownEvents(transition.caller_acquisition.selected_result.events).map(event => event.kind), newlyAcquired.map(event => event.kind));
    assert.deepEqual((result.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    if (after.packet.levels_completed > before.packet.levels_completed) boundaries.push({ actions: index + 1, levelsCompleted: after.packet.levels_completed });
  }
  assert.deepEqual(boundaries, nativeCampaign.boundaries.map((boundary: R) => ({ actions: boundary.totalActions, levelsCompleted: boundary.levelsCompleted })));
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'target_levels_completed');
  assert.equal(result.snapshot.levelsCompleted, 3); assert.equal(result.snapshot.level, 4);
  assert.equal(nativeTrace.packets.at(-1).packet.state, 'NOT_FINISHED');
  assert.equal((result.snapshot.caller as R).boundaryReplays, nativeCampaign.final.caller.boundaryReplays);
  assert.equal(eventCount, nativeCampaign.prefixes.at(-1).sharedSeries.fieldServiceEventCount);
});

test('measured bands retain unknown physical quantity, capacity, completeness and passage laws', async () => {
  const { ownStates } = await timeline();
  for (const state of ownStates.slice(1)) {
    for (const field of state.fill_context.fields) for (const appearance of [field.initial_state, field.observed_state]) {
      assert.deepEqual(appearance.physical_quantity_interval, [0, null]);
      assert.equal(appearance.capacity, null); assert.equal(appearance.calibration, 'unknown');
      assert.equal(appearance.envelope_complete, false);
    }
    for (const history of state.fill_context.history) for (const appearance of Object.values(history) as R[]) {
      assert.equal(appearance.capacity, null); assert.equal(appearance.envelope_complete, false);
      if (appearance.opaque_replacement) {
        assert.deepEqual(appearance.pixel_extent_interval, [0, null]);
        assert.equal(appearance.pixel_extent_profiles, null);
      }
    }
    for (const measured of state.transfer_context?.new_field_observations ?? []) {
      assert.match(measured.service_dependency, /passage, duration and release relation unconfirmed/i);
    }
  }
  assert.ok(ownStates[2]!.fill_context.history.some((history: R) => Object.values(history).some((value: any) => value.opaque_replacement)),
    'The original public return includes an opaque replacement rather than a known capacity');
});

test('service graph hydration preserves journal order, detached views and current re-proposals', async context => {
  for (const prefixCount of [1, 4, 5, 10, 12, 23]) await context.test(`after ${prefixCount} component prefixes`, async () => {
    const { family, packetIndex } = await at(prefixCount), checkpoint = copy(family.nativeState()), own = family.service.currentState();
    const store = new NativeKnowledgeStore('field-service-native-integration-v51', `service-hydrate-${prefixCount}`);
    await store.commit([{ id: OWNER, kind: 'family_state', family: family.id, value: family.nativeState() }],
      { workflow: 'test.service.common', step: 'checkpoint', statement: 'retain' });
    const restored = new SharedSeriesConstraint(policy.occurrence_recall);
    restored.restoreNative(store.stateValue(OWNER) as R);
    assert.deepEqual(restored.nativeState(), checkpoint);
    assert.deepEqual(restored.service.currentState(), own);
    assert.deepEqual(await offer(restored, packetIndex), await offer(family, packetIndex));
    assert.deepEqual(restored.nativeState(), checkpoint, 'Re-proposal cannot append evidence or refresh learned roles');
    const exposed = restored.service.currentState();
    exposed.nested_events.length = 0; exposed.fill_context.fields[0].bbox[0] += 999;
    if (exposed.transfer_model) exposed.transfer_model.evidence.length = 0;
    if (exposed.transfer_context) exposed.transfer_context.targets.length = 0;
    assert.deepEqual(restored.service.currentState(), own, 'Current component views are detached from the retained owner');
  });
});

test('every service question requires current public epoch, observation, exact raster and point binding', async context => {
  for (const prefixCount of [0, 1, 4, 10, 22]) await context.test(`question at component prefix ${prefixCount}`, async () => {
    const { family, packetIndex } = await at(prefixCount), row = probe.packets[packetIndex], proposal = await offer(family, packetIndex);
    assert.ok(proposal);
    assert.throws(() => family.bind(copy(proposal), new ObservedInputDomain(4096)), /domain.*currently observed|current observed (input )?domain|binding|bound/i);
    const domain = new ObservedInputDomain(4096); domain.candidates(row.observation); family.bind(proposal, domain);
    assert.equal(proposal.steps[0].expected_after, null);
    assert.deepEqual(proposal.steps[0].point_binding.point, [proposal.actions[0].data.x, proposal.actions[0].data.y]);
    assert.equal(family.before(proposal, 0, row.packet, row.observation).admitted, true);
    assert.equal(family.before(proposal, 1, row.packet, row.observation).admitted, false);
    assert.equal(family.before(proposal, 0, { ...row.packet, level: 99 }, row.observation).admitted, false);
    assert.equal(family.before(proposal, 0, { ...row.packet, levels_completed: 99 }, row.observation).admitted, false);
    assert.equal(family.before(proposal, 0, row.packet, { ...row.observation, observation_ref: 'stale-service-observation' }).admitted, false);
    assert.equal(family.before(proposal, 0, { ...row.packet, available_action_refs: [] }, row.observation).admitted, false);
    const changed = copy(row.packet); changed.frame_rows[0][0] = (changed.frame_rows[0][0] + 1) % 16;
    assert.equal(family.before(proposal, 0, changed, row.observation).admitted, false);
    const wrongPoint = copy(proposal); wrongPoint.actions[0].data.x++;
    assert.throws(() => family.bind(wrongPoint, domain), /point|payload/i);
    assert.equal(family.before(wrongPoint, 0, row.packet, row.observation).admitted, false);
    assert.equal(await offer(family, packetIndex, 0), null);
    assert.equal(await family.servicePropose({ ...row.observation, available_action_refs: [] }, row.packet.frame_rows, [], 600,
      policy.field_service_composition), null);
  });
});

test('controlled no-effect returns cannot become selection, impossibility, restoration or service facts', async context => {
  await context.test('nested refusal stays local to the unchanged measured offer', async () => {
    const { family, packetIndex } = await at(0), row = probe.packets[packetIndex], proposal = await offer(family, packetIndex);
    assert.ok(proposal);
    const after = { ...copy(row.observation), observation_ref: 'controlled-no-effect-return' };
    const acquired = family.record(row.observation, after, copy(proposal.actions[0]), row.packet.frame_rows, row.packet.frame_rows, proposal, 0);
    const own = ownEvents(acquired.events);
    assert.deepEqual(own.map(event => event.kind), ['nested_control_response']);
    assert.equal(own[0]!.changed_pixels, 0); assert.equal(own[0]!.official_progress, false);
    assert.equal(own[0]!.disposition, 'local_no_visible_effect');
    assert.equal(own[0]!.selection_acquired, false); assert.equal(own[0]!.impossibility_acquired, false);
    assert.equal(family.service.currentState().fill_context, null);
    assert.equal(family.service.currentState().service_context, null);
    assert.equal(await offer(family, packetIndex), null, 'The same exact unproductive probe is declined without a global impossibility claim');
  });
  for (const [prefixCount, stop] of [[4, 'field_service_no_effect'], [10, 'transferred_service_no_effect']] as const) {
    await context.test(stop, async () => {
      const { family, packetIndex } = await at(prefixCount), row = probe.packets[packetIndex], proposal = await offer(family, packetIndex);
      assert.ok(proposal); const before = family.service.currentState();
      const after = { ...copy(row.observation), observation_ref: 'controlled-service-no-effect-return' };
      const acquired = family.record(row.observation, after, copy(proposal.actions[0]), row.packet.frame_rows, row.packet.frame_rows, proposal, 0);
      assert.equal(family.service.requestedStopReason, stop);
      assert.deepEqual(family.service.currentState().fill_context, before.fill_context);
      assert.equal(ownEvents(acquired.events).some(event => event.kind === 'envelope_fill_context'), false);
      if (prefixCount === 10) {
        assert.deepEqual(family.service.currentState().service_context, before.service_context);
        assert.deepEqual(family.service.currentState().transfer_model, before.transfer_model);
      }
    });
  }
});

test('service journal corruption is rejected atomically and old checkpoints cannot mask changed reducers', async context => {
  for (const kind of OWN) await context.test(`corrupt ${kind}`, async () => {
    const { family } = await at(12), checkpoint = copy(family.nativeState()), own = family.service.currentState(), corrupt = copy(checkpoint);
    const event = corrupt.events.find((value: R) => value.kind === kind);
    assert.ok(event); event.scope = 'controlled-unacquired-change';
    assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
    assert.deepEqual(family.nativeState(), checkpoint);
    assert.deepEqual(family.service.currentState(), own);
  });
  const { family } = await at(4), checkpoint = family.nativeState(), own = family.service.currentState();
  family.restoreNative(checkpoint);
  const revision = family.service.nativeRevision;
  const injected = copy(own.nested_events[0]); injected.interpretation = 'controlled-out-of-journal-return';
  family.service.applyEvent(injected);
  assert.ok(family.service.nativeRevision > revision);
  assert.notDeepEqual(family.service.currentState(), own);
  family.restoreNative(checkpoint);
  assert.deepEqual(family.service.currentState(), own, 'A previously accepted checkpoint must reconstruct after a reducer revision changes');
  assert.deepEqual(family.nativeState(), checkpoint);
});

test('the common owner preserves source ancestor order and service-plan cutoffs', async context => {
  for (const prefixCount of [4, 10]) await context.test(`record at component prefix ${prefixCount}`, async ctx => {
    const { family, packetIndex } = await at(prefixCount), first = probe.packets[packetIndex], second = probe.packets[packetIndex + 1];
    const proposal = await offer(family, packetIndex); assert.ok(proposal);
    const order: string[] = [];
    for (const key of ['memory', 'material', 'radial', 'service', 'rooted'] as const) {
      const memory = family[key], original = memory.record.bind(memory);
      ctx.mock.method(memory, 'record', (...args: any[]) => { order.push(key); return (original as (...args: any[]) => any)(...args); });
    }
    const response = family.record(first.observation, second.observation, copy(proposal.actions[0]),
      first.packet.frame_rows, second.packet.frame_rows, proposal, 0, second.packet.frame_packet);
    assert.deepEqual(order, ['memory', 'material', 'radial', 'service', 'rooted']);
    assert.deepEqual(ownEvents(response.events).map(event => event.kind), prefixCount === 4
      ? ['nested_control_response', 'field_service_context', 'field_service_transfer']
      : ['nested_control_response', 'field_service_transfer']);
  });
  await context.test('Rooted cuts off older service ancestors', async ctx => {
    const rooted = await fixture('v6-rooted-quota-original-public.json.gz');
    const family = new SharedSeriesConstraint(policy.occurrence_recall), own = family.service.currentState();
    ctx.mock.method(family.service, 'record', () => { throw new Error('Rooted must cut off its older service ancestors'); });
    const first = rooted.packets[0], next = rooted.packets[1], proposal = rooted.prefixes[0].proposal;
    const response = family.record(first.observation, next.observation, copy(next.command), first.packet.frame_rows,
      next.packet.frame_rows, copy(proposal), 0, next.packet.frame_packet);
    assert.ok(response.events.some((event: R) => event.kind === 'rooted_quota_state'));
    assert.deepEqual(ownEvents(response.events), []);
    assert.deepEqual(family.service.currentState(), own);
  });
});
