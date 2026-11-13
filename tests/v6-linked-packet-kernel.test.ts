import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { canonical } from '../src/logos-engine/canonical.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { LinkedPacketMemory } from '../src/logos-engine/v6-linked-packet-access.ts';
import { TraceFieldMemory } from '../src/logos-engine/v6-trace-field-access.ts';
import { CellPlacementMemory } from '../src/logos-engine/v6-cell-placement.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-linked-packet-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const linkedPolicy = configuration.window_constraints.linked_packet_composition;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.linked.common', step: 'checkpoint', statement: 'retain' };

/** Compare native values to their retained copy, never to Python/libm spelling. */
function floatBits(value: unknown, path = '$', result: Record<string, string> = {}): Record<string, string> {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
    assert.ok(Number.isFinite(value));
    const bytes = new Uint8Array(8); new DataView(bytes.buffer).setFloat64(0, value, false);
    result[path] = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) floatBits(child, `${path}[${JSON.stringify(key)}]`, result);
  }
  return result;
}
function recordSourceReturn(family: SharedSeriesConstraint, actionIndex: number, selected = true): R {
  const prefix = probe.prefixes[actionIndex - 1], step = prefix.steps[0];
  const before = probe.packets[actionIndex - 1], after = probe.packets[actionIndex];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, selected ? copy(prefix.proposal) : {}, step.index, after.packet.frame_packet);
}
function acquiredThrough(actionIndex = 6): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(recallPolicy);
  for (let index = 1; index <= actionIndex; index++) recordSourceReturn(family, index);
  return family;
}
async function proposeAt(family: SharedSeriesConstraint, packetIndex: number, remaining = 600): Promise<R | null> {
  const entry = probe.packets[packetIndex], domain = new ObservedInputDomain(4096);
  return family.linkedPropose(entry.observation, entry.packet.frame_rows, domain.candidates(entry.observation),
    remaining, linkedPolicy, 360_000, () => 0);
}

// A cold replay receives only the saved public packets. Source programs, plans
// and expected outcomes are assertions, never inputs to the runtime's memory.
test('the cold common caller releases and acquires all 44 linked public actions through the real Kernel', async context => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, empty = copy(family.state()), stages: string[] = [];
  const traceRecord = TraceFieldMemory.prototype.record, linkedRecord = LinkedPacketMemory.prototype.record;
  const cellRecord = CellPlacementMemory.prototype.record, packetRecord = LinkedPacketMemory.prototype.recordPacket;
  context.mock.method(TraceFieldMemory.prototype, 'record', function (this: TraceFieldMemory, ...args: Parameters<TraceFieldMemory['record']>) {
    stages.push('trace'); return traceRecord.apply(this, args);
  });
  context.mock.method(LinkedPacketMemory.prototype, 'record', function (this: LinkedPacketMemory, ...args: Parameters<LinkedPacketMemory['record']>) {
    stages.push('linked'); return linkedRecord.apply(this, args);
  });
  context.mock.method(CellPlacementMemory.prototype, 'record', function (this: CellPlacementMemory, ...args: Parameters<CellPlacementMemory['record']>) {
    stages.push('cell'); return cellRecord.apply(this, args);
  });
  context.mock.method(LinkedPacketMemory.prototype, 'recordPacket', function (this: LinkedPacketMemory, ...args: Parameters<LinkedPacketMemory['recordPacket']>) {
    stages.push('packet'); return packetRecord.apply(this, args);
  });
  let result = await runtime.initialize({ sessionId: 'linked-common-public-replay', observation: copy(probe.packets[0].packet),
    budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600], maxActions: 1800 } }, execution);
  assert.deepEqual(family.state(), empty, 'Planning does not acquire its own projected packet');
  assert.deepEqual(stages, []);
  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const entries = ['labeled_sequence_composition', 'linked_packet_composition', 'trace_field_composition', 'cell_patch_composition'];
  const indices = entries.map(entry => window.entryPoints.indexOf(entry));
  assert.ok(indices.every((index, position) => index >= 0 && (position === 0 || index > indices[position - 1]!)));
  assert.ok(indices.every(index => window.families[index] === family.id), 'Declared entries share one acquired owner');
  let ownEvents = 0, previousFamilyRevision = 0, checkedFloatingPlan = false, checkedFloatingTransition = false;
  const boundaries: R[] = [];
  for (let actionIndex = 1; actionIndex < probe.packets.length; actionIndex++) {
    assert.equal(result.kind, 'action', `action ${actionIndex}: ${result.reason}`);
    assert.equal(result.snapshot.lastDecision, family.id);
    assert.ok(result.authorization, 'The inquiry must pass ordinary WHY/ACT release');
    const proposal = copy(result.snapshot.proposal as R), revision = (result.snapshot.prefix as R).revision;
    assert.equal(proposal.kind, 'linked_packet_experiment');
    assert.equal(proposal.field_subquestion, 'linked_packet_composition');
    assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
    assert.equal(proposal.facts.terminal_role_hypothesis_only, true);
    assert.equal(proposal.actions.length, 1);
    assert.deepEqual(result.command, probe.packets[actionIndex].command, `public command ${actionIndex}`);
    assert.equal(proposal.linked_packet_plan.reason, probe.prefixes[actionIndex - 1].proposal.linked_packet_plan.reason);
    stages.length = 0;
    result = await runtime.advance({ command: result.command!, executionMs: 1,
      observation: copy(probe.packets[actionIndex].packet) }, execution);
    assert.deepEqual(stages, ['trace', 'linked', 'cell', 'packet'], 'The inherited record chain precedes one dated-packet acquisition');
    assert.equal(result.snapshot.actions, actionIndex);
    assert.equal((result.snapshot.caller as R).acquiredTransitions, actionIndex);
    assert.equal(result.snapshot.acquiredRecords, actionIndex);
    ownEvents += probe.prefixes[actionIndex - 1].steps[0].acquired.events.filter((event: R) => event.kind === 'linked_packet_evidence').length;
    const retained = family.nativeState!() as R;
    assert.equal(retained.events.filter((event: R) => event.kind === 'linked_packet_evidence').length, ownEvents);
    if (actionIndex === 4 || actionIndex === 7 || actionIndex === 44) {
      const graph = runtime.inspectKnowledge();
      const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
      assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === family.id).map(node => node.id), [ID]);
      assert.ok(graph.nodes[ID]!.revision > previousFamilyRevision); previousFamilyRevision = graph.nodes[ID]!.revision;
      const saved = read(ID), prefix = read(`prefix_evidence:${revision}`);
      assert.deepEqual(saved, retained);
      assert.deepEqual(floatBits(saved), floatBits(retained));
      assert.ok(Object.keys(floatBits(saved)).length > 0, 'Actual packet geometry contains finite noninteger evidence');
      assert.throws(() => canonical(saved), /safe integers/, 'The V7 canonical scalar domain remains unchanged');
      assert.deepEqual(prefix.proposal, proposal);
      assert.deepEqual(floatBits(prefix.proposal), floatBits(proposal));
      checkedFloatingPlan ||= Object.keys(floatBits(proposal)).length > 0;
      assert.equal(prefix.transitions.length, 1);
      const transition = read(`reasoning:transition:${revision}`);
      if (actionIndex === 4) {
        const acquired = transition.caller_acquisition.selected_result.events.filter((event: R) => event.kind === 'linked_packet_evidence');
        const recent = retained.events.filter((event: R) => event.kind === 'linked_packet_evidence').slice(-acquired.length);
        assert.equal(acquired.length, 2, 'One canonical outcome plus one actual dated packet');
        assert.deepEqual(acquired, recent);
        assert.deepEqual(floatBits(acquired), floatBits(recent));
        checkedFloatingTransition = Object.keys(floatBits(acquired)).length > 0;
        assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
      }
      const facts = (read('reasoning:memory').facts as string[]).map(read);
      assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);
    }
    if (probe.packets[actionIndex].packet.levels_completed > probe.packets[actionIndex - 1].packet.levels_completed) {
      boundaries.push({ actions: actionIndex, levelsCompleted: result.snapshot.levelsCompleted });
    }
    if (actionIndex < probe.packets.length - 1) {
      assert.equal(result.kind, 'boundary', result.reason);
      result = await runtime.resume(execution);
      assert.deepEqual(family.nativeState!(), retained, 'Restoring and planning cannot acquire the last packet twice');
    }
  }
  assert.equal(result.kind, 'stopped');
  assert.equal(result.snapshot.levelsCompleted, 3);
  assert.deepEqual(boundaries, [{ actions: 8, levelsCompleted: 1 }, { actions: 18, levelsCompleted: 2 }, { actions: 44, levelsCompleted: 3 }]);
  assert.equal(ownEvents, 53);
  assert.ok(checkedFloatingPlan && checkedFloatingTransition);
});

test('native linked numerical evidence and plans survive Kernel hydration without changing any Float64 bit', async () => {
  const foreign = new SharedSeriesConstraint(recallPolicy);
  recordSourceReturn(foreign, 1, false);
  assert.deepEqual(foreign.linked.currentState(), new LinkedPacketMemory().currentState(), 'A foreign selected plan cannot invent linked acquisition');
  const family = acquiredThrough(), original = family.linked.currentState(), proposal = await proposeAt(family, 6);
  assert.ok(proposal);
  assert.ok(Object.keys(floatBits(original)).length > 0);
  assert.ok(Object.keys(floatBits(proposal)).length > 0);
  const store = new NativeKnowledgeStore('linked-native-integration-v47', 'linked-rehydrate');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() },
    { id: 'linked-proof', kind: 'prefix_evidence', family: family.id, value: { proposal } }], CAUSE);
  const restored = new SharedSeriesConstraint(recallPolicy), retained = store.stateValue(ID) as R;
  restored.restoreNative(retained);
  assert.deepEqual(restored.linked.currentState(), original);
  assert.deepEqual(floatBits(restored.linked.currentState()), floatBits(original));
  assert.deepEqual((store.stateValue('linked-proof') as R).proposal, proposal);
  assert.deepEqual(await proposeAt(restored, 6), proposal, 'The restored numerical hypotheses drive the same next question');
  const exposed = restored.linked.currentState();
  exposed.linked_events.length = 0; exposed.linked_state!.evidence.push('unacquired-public-edit');
  assert.deepEqual(restored.state(), retained, 'Mutable public views cannot edit the retained evidence');
});

test('linked guards reject stale packets, unavailable inputs and altered point payloads', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), first = probe.packets[0], proposal = await proposeAt(family, 0);
  assert.ok(proposal);
  assert.equal(family.before(proposal, 0, first.packet, first.observation).admitted, true);
  for (const mutate of [
    (_p: R, _packet: R, observation: R) => { observation.observation_ref = 'stale-observation'; },
    (_p: R, packet: R) => { packet.level++; },
    (_p: R, packet: R) => { packet.levels_completed++; },
    (_p: R, packet: R) => { packet.available_action_refs = packet.available_action_refs.filter((ref: string) => ref !== 'ACTION6'); },
    (_p: R, packet: R) => { packet.frame_rows[0][0] = (packet.frame_rows[0][0] + 1) % 16; },
    (p: R) => { p.actions[0].data.x++; },
    (p: R) => { p.bundle_template.actions[0].data.y++; },
    (p: R) => { p.linked_packet_plan.control.point[0]++; },
  ]) {
    const changed = copy(proposal), packet = copy(first.packet), observation = copy(first.observation);
    mutate(changed, packet, observation);
    assert.equal(family.before(changed, 0, packet, observation).admitted, false);
  }
  assert.equal(family.before(proposal, 1, first.packet, first.observation).admitted, false);
  const changedPoint = copy(proposal); changedPoint.steps[0].point_support.point[0]++;
  assert.throws(() => family.bind(changedPoint, new ObservedInputDomain(4096)), /point|payload/i);
  assert.equal(await proposeAt(family, 0, 0), null);
  await assert.rejects(family.linkedPropose(first.observation, first.packet.frame_rows, [], 600, linkedPolicy, null, () => 0), /deadline/i);
});

test('linked reducer revisions invalidate cached checkpoints and corrupt float journals reject atomically', context => {
  const family = acquiredThrough(), trusted = family.nativeState(); family.restoreNative(trusted);
  const original = family.linked.currentState(), sibling = family.trace.currentState(), pairs = family.pairs.state();
  const apply = LinkedPacketMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(LinkedPacketMemory.prototype, 'applyEvent', function (this: LinkedPacketMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  family.restoreNative(trusted); assert.equal(replays, 0);
  const packetEvent = (state: R): R => state.events.find((event: R) => event.kind === 'linked_packet_evidence' && event.detail.packet_measurement);
  for (const mutate of [
    (state: R) => { const event = packetEvent(state), output = Object.values(event.outputs)[0] as R; output.angle += 0.125; },
    (state: R) => { packetEvent(state).detail.packet_measurement.segments[0].direction[0] += 0.125; },
    (state: R) => { state.events.splice(state.events.indexOf(packetEvent(state)), 1); },
    (state: R) => { state.events.push(copy(packetEvent(state))); },
    (state: R) => { state.digest = 'forged'; },
  ]) {
    const corrupt = copy(trusted); mutate(corrupt);
    assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
    assert.deepEqual(family.state(), trusted);
    assert.deepEqual(family.linked.currentState(), original);
    assert.deepEqual(family.trace.currentState(), sibling);
    assert.deepEqual(family.pairs.state(), pairs);
    assert.equal(family.nativeState(), trusted);
    replays = 0; family.restoreNative(trusted); assert.equal(replays, 0, 'Failed staging retains the accepted checkpoint');
  }
  const injected = copy(packetEvent(trusted)); injected.state.evidence.push('unjournaled-linked-reducer-edit');
  family.linked.applyEvent(injected);
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, original.linked_events.length);
  assert.deepEqual(family.linked.currentState(), original);
  assert.deepEqual(floatBits(family.linked.currentState()), floatBits(original));
  replays = 0; family.restoreNative(trusted); assert.equal(replays, 0);
});
