import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { TraceFieldMemory } from '../src/logos-engine/v6-trace-field-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-trace-field-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const tracePolicy = configuration.window_constraints.trace_field_composition;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.trace.common', step: 'checkpoint', statement: 'retain' };

function recordSourceReturn(family: SharedSeriesConstraint, prefixIndex = 0, stepIndex = 0, selected = true): R {
  const prefix = probe.prefixes[prefixIndex], step = prefix.steps[stepIndex];
  const before = probe.packets[step.actionIndex - 1], after = probe.packets[step.actionIndex];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, selected ? copy(prefix.proposal) : {}, step.index, after.packet.frame_packet);
}
function acquired(): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(recallPolicy); recordSourceReturn(family); return family;
}
function originalState(prefixIndex = 0, stepIndex = 0): R {
  return copy(probe.prefixes[prefixIndex].steps[stepIndex].afterState.projection);
}
async function proposeAt(family: SharedSeriesConstraint, packetIndex: number, remaining = 600): Promise<R | null> {
  const entry = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  return family.tracePropose(entry.observation, entry.packet.frame_rows, domain.candidates(entry.observation),
    remaining, tracePolicy, 360_000, () => 0);
}

// This is a cold common-caller replay of saved public observations. It proves
// integration and acquisition; it is not another live environment campaign.
test('a cold common caller selects the declared trace entry and acquires its real return once in the Kernel', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1, 'The added entry shares the existing acquisition owner');
  const family = owners[0]!, empty = copy(family.state());
  let result = await runtime.initialize({ sessionId: 'trace-common-public-replay', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.ok(result.authorization, 'The bounded graph result must still pass ordinary WHY/ACT release');
  const proposal = result.snapshot.proposal as R, plan = proposal.trace_field_plan;
  assert.equal(proposal.kind, 'trace_field_experiment');
  assert.equal(proposal.field_subquestion, 'trace_field_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.equal(plan.estimate.receipt.status, 'COMPLETE');
  assert.equal(plan.estimate.receipt.descriptive_facts.primitive_release_authorized, false);
  assert.equal(plan.estimate.receipt.values.covering_suffix_witness_present, false,
    'Residual necessities are not themselves a covering path or a terminal proof');
  assert.equal(proposal.facts.official_terminal_law_unknown, true);
  assert.equal(proposal.steps[0].relation_observed, false);
  assert.equal(proposal.actions.length, 1, 'No point effect is acquired before its actual return');
  assert.deepEqual(result.command, probe.packets[1].command);
  assert.deepEqual(family.state(), empty, 'Planning cannot acquire its own projected trace');
  assert.deepEqual(proposal.steps[0].point_binding.point, [result.command!.data!.x, result.command!.data!.y]);
  assert.equal(proposal.steps[0].point_binding.observation_ref, plan.observation_ref);
  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const indices = ['labeled_sequence_composition', 'trace_field_composition', 'cell_patch_composition']
    .map(entry => window.entryPoints.indexOf(entry));
  assert.ok(indices[0] >= 0 && indices[0] < indices[1] && indices[1] < indices[2]);
  assert.ok(indices.every(index => window.families[index] === family.id));

  result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(probe.packets[1].packet) }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === family.id).map(node => node.id), [ID]);
  const retained = read(ID), events = retained.events.filter((event: R) => event.kind === 'observed_trace_extension');
  assert.equal(events.length, 1);
  assert.equal(events[0].transition.outcome, 'local_extension_observed');
  assert.equal(events[0].transition.outside_support_effect_role, 'unknown');
  assert.deepEqual(events[0].transition.command, proposal.actions[0]);
  assert.deepEqual(retained, family.state());
  const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
  assert.equal(prefix.transitions.length, 1);
  const transition = read(`reasoning:transition:${prefix.decision_revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);

  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.deepEqual(result.command, probe.packets[2].command);
  assert.equal((result.snapshot.proposal as R).steps[0].relation_observed, false,
    'One local extension does not meet the source threshold of two distinct transitions');
  assert.deepEqual(family.state(), retained, 'The next inquiry does not duplicate prior acquisition');
});

test('a trace return survives real Kernel hydration while foreign returns cannot create trace evidence', async () => {
  const family = new SharedSeriesConstraint(recallPolicy);
  recordSourceReturn(family, 0, 0, false);
  assert.deepEqual(family.trace.currentState(), { trace_state: null, trace_events: [] });
  const response = recordSourceReturn(family);
  assert.equal(response.events.filter((event: R) => event.kind === 'observed_trace_extension').length, 1);
  assert.deepEqual(family.trace.currentState(), originalState());
  const next = await proposeAt(family, 1);
  assert.ok(next);
  const store = new NativeKnowledgeStore('trace-native-integration-v46', 'trace-rehydrate');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const restored = new SharedSeriesConstraint(recallPolicy), retained = store.stateValue(ID) as R;
  restored.restoreNative(retained);
  assert.deepEqual(restored.state(), retained);
  assert.deepEqual(restored.trace.currentState(), originalState());
  assert.deepEqual(await proposeAt(restored, 1), next);
  const exposed = restored.trace.currentState();
  exposed.trace_state!.successes.length = 0;
  exposed.trace_events[0]!.state.geometry.bbox[0] = -99;
  response.events.find((event: R) => event.kind === 'observed_trace_extension').state.failures.push({ unacquired: true });
  assert.deepEqual(restored.state(), retained, 'Public projections and response envelopes cannot edit acquired state');
});

test('only two distinct acquired extensions permit a conditional prefix, and a new epoch needs new effects', async () => {
  const family = acquired();
  const one = await proposeAt(family, 1);
  assert.ok(one);
  assert.equal(one.actions.length, 1);
  assert.equal(one.steps[0].relation_observed, false);
  recordSourceReturn(family, 1);
  const retained = family.state(), two = await proposeAt(family, 2);
  assert.ok(two);
  assert.ok(two.actions.length > 1 && two.actions.length <= 16);
  assert.ok(two.steps.every((step: R) => step.relation_observed === true));
  assert.equal(two.facts.official_terminal_law_unknown, true);
  assert.deepEqual(family.state(), retained);
  const current = probe.packets[2], newEpoch = { ...current.observation, level_epoch: current.observation.level_epoch + 1,
    observation_ref: 'controlled-new-epoch:current-public-raster' };
  const reset = await family.tracePropose(newEpoch, current.packet.frame_rows, [], 600, tracePolicy, 360_000, () => 0);
  assert.ok(reset);
  assert.equal(reset.actions.length, 1);
  assert.equal(reset.steps[0].relation_observed, false);
  assert.deepEqual(reset.trace_field_plan.state.successes, []);
  assert.deepEqual(reset.trace_field_plan.state.failures, []);
  assert.deepEqual(family.state(), retained, 'Replanning an epoch does not acquire or erase its predecessor');
});

test('current bindings and physical budgets reject stale, changed or unavailable trace actions', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), first = probe.packets[0], next = probe.packets[1];
  const proposal = await proposeAt(family, 0);
  assert.ok(proposal);
  assert.equal(family.before(proposal, 0, first.packet, first.observation).admitted, true);
  for (const change of [
    (p: R, packet: R, observation: R) => { observation.observation_ref = 'stale-observation'; },
    (p: R, packet: R) => { packet.level++; },
    (p: R, packet: R) => { packet.levels_completed++; },
    (p: R, packet: R) => { packet.available_action_refs = packet.available_action_refs.filter((ref: string) => ref !== 'ACTION6'); },
    (p: R, packet: R) => { packet.frame_rows[0][0] += 1; },
    (p: R) => { p.actions[0].data.x++; },
    (p: R) => { p.bundle_template.actions[0].data.y++; },
    (p: R) => { p.steps[0].target = [...p.steps[0].source]; },
  ]) {
    const changed = copy(proposal), packet = copy(first.packet), observation = copy(first.observation);
    change(changed, packet, observation);
    assert.equal(family.before(changed, 0, packet, observation).admitted, false);
  }
  assert.equal(family.before(proposal, proposal.steps.length, first.packet, first.observation).admitted, false);
  assert.equal(family.before(proposal, 0, next.packet, next.observation).admitted, false);
  const changedPoint = copy(proposal); changedPoint.steps[0].point_support.point[0]++;
  assert.throws(() => family.bind(changedPoint, new ObservedInputDomain(4096)), /point|payload/i);
  assert.equal(await proposeAt(family, 0, 0), null);
  assert.equal(await proposeAt(family, 0, proposal.trace_field_plan.estimate.path.length - 2), null,
    'An otherwise valid graph witness cannot exceed remaining physical actions');
  await assert.rejects(family.tracePropose(first.observation, first.packet.frame_rows, [], 600, tracePolicy, null, () => 0), /deadline/i);
  assert.equal(await family.tracePropose(first.observation, first.packet.frame_rows, [], 600, tracePolicy, 0, () => 1), null);
  const unmoved = family.after(proposal, 0, first.observation, first.observation, first.packet.frame_rows, first.packet.frame_rows);
  assert.equal(unmoved.matched, false); assert.equal(unmoved.seal_prefix, true);
  const observed = family.after(proposal, 0, first.observation, next.observation, first.packet.frame_rows, next.packet.frame_rows);
  assert.equal(observed.matched, true); assert.equal(observed.seal_prefix, true);
  assert.equal(observed.official_progress, false);
});

test('trace reducer mutations invalidate native checkpoint reuse and recover from the authoritative journal', context => {
  const family = acquired(), trusted = family.nativeState();
  const apply = TraceFieldMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(TraceFieldMemory.prototype, 'applyEvent', function (this: TraceFieldMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  family.restoreNative(trusted);
  assert.equal(replays, 0, 'Unchanged acquired checkpoints do not replay cumulative trace events');
  const injected = copy(trusted.events.find((event: R) => event.kind === 'observed_trace_extension'));
  injected.state.evidence.push('unjournaled-trace-reducer-edit');
  family.trace.applyEvent(injected);
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, 1);
  assert.deepEqual(family.state(), trusted);
  assert.deepEqual(family.trace.currentState(), originalState());
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, 0);
});

test('corrupt trace journals reject atomically without discarding sibling layers or the accepted checkpoint', context => {
  const family = acquired(), trusted = family.nativeState(); family.restoreNative(trusted);
  const originalTrace = family.trace.currentState(), labeled = family.labeled.currentState(), pair = family.pairs.state();
  const apply = TraceFieldMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(TraceFieldMemory.prototype, 'applyEvent', function (this: TraceFieldMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  const traceEvent = (state: R): R => state.events.find((event: R) => event.kind === 'observed_trace_extension');
  for (const mutate of [
    (state: R) => { traceEvent(state).state.geometry.pitch++; },
    (state: R) => { traceEvent(state).transition.command.data.x++; },
    (state: R) => { traceEvent(state).state.successes.length = 0; },
    (state: R) => { state.events = state.events.filter((event: R) => event.kind !== 'observed_trace_extension'); },
    (state: R) => { state.events.push(copy(traceEvent(state))); },
    (state: R) => { state.digest = 'forged'; },
  ]) {
    const corrupt = copy(trusted); mutate(corrupt);
    assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
    assert.deepEqual(family.state(), trusted);
    assert.deepEqual(family.trace.currentState(), originalTrace);
    assert.deepEqual(family.labeled.currentState(), labeled);
    assert.deepEqual(family.pairs.state(), pair);
    assert.equal(family.nativeState(), trusted);
    replays = 0; family.restoreNative(trusted);
    assert.equal(replays, 0, 'Rejected staging preserves the last accepted unchanged checkpoint');
  }
});
