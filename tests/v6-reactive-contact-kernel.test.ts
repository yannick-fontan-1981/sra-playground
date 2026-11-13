import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import type { ReactiveContact } from '../src/logos-engine/v6-reactive-contact.ts';
type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const referenceRoot = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', referenceRoot), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', referenceRoot), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reactive-contact-family-reference.json.gz', import.meta.url))).toString()) as R;
const hano = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8')) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'public_reactive_contact', OWNER = `family_state:${ID}`;
const empty = { epoch: null, control: null, peer: null, floor: null, observations: [], question: null,
  trials: {}, pending: null, recipe: null, last: null, input_trials: {}, source81_plan: null, prepared_source81: null };
function owners(runtime: NativeV6Runtime) {
  const r = runtime as unknown as R;
  return { registered: r.families as NativeFamily[], acquisition: r.acquisitionFamilies,
    reactive: r.acquisitionFamilies.reactive as ReactiveContact };
}
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common Kernel node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : raw) as R;
}
function packet(step = 0): NativePublicObservation {
  const f = fixture.kernelControlled;
  return { frame_rows: copy(f.rows), frame_packet: [copy(f.rows)], frame_hash: f.observation.frame_hash,
    available_action_refs: copy(f.observation.available_action_refs), level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', step_index: step };
}

test('both reactive source entries occupy their exact declared order with one cold owner', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime); assert.equal(o.registered.filter(f => f.id === ID).length, 1); assert.deepEqual(o.reactive.state(), empty);
    const service = new V6AgentService(() => runtime), result = await service.handle({ type: 'init', sequence: 0,
      sessionId: 'reactive-registration', observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    assert.equal(result.snapshot.lastDecision, 'ordered_support_transfer', 'The newly registered cold family does not override earlier source selection');
    const groups = (result.snapshot.coverage as R).sourceGroups as R[], material = groups.find(g => g.id === 'factored_material_return')!;
    const entries = material.entryPoints.map((entry: string | null, i: number) => ({ entry, id: material.families[i] })).filter((row: R) => row.id === ID);
    assert.deepEqual(entries.map((row: R) => row.entry), ['reactive_contact_continuation', 'reactive_contact']);
    assert.equal(material.families[0], ID); assert.equal(material.entryPoints[0], 'reactive_contact_continuation');
    const declared = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    const present = material.entryPoints.filter((q: string | null) => q !== null);
    assert.deepEqual(present, declared.filter(q => present.includes(q)));
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === ID).map(node => node.id), [OWNER]);
    for (const name of ['choose', 'bind_control', 'reconcile_contact', 'reconcile_binding', 'project_source81_entry', 'admit_ready_operator']) {
      assert.ok(graph.nodes[`program:v6.reactive_contact.${name}`]);
    }
    for (const name of ['prepare', 'project', 'continue_target', 'revise_target']) {
      assert.ok(graph.nodes[`program:v6.source81.${name}`]);
    }
    assert.equal(value(runtime, OWNER).source_state.control, null); assert.equal(value(runtime, OWNER).source_state.question, null);
  } finally { runtime.close('reactive-registration-complete'); }
});

test('foreign returns acquire reactive state once after sealing, after outline, without selected-contact attribution', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(runtime), calls: R[] = [], order: string[] = [];
  const reactiveRecord = o.reactive.recordSource.bind(o.reactive), outlineRecord = o.acquisition.outline.recordPublicTransition.bind(o.acquisition.outline);
  (o.reactive as unknown as R).recordSource = async (...args: any[]) => {
    order.push('reactive'); calls.push({ before: args[0], after: args[1], command: args[2], first: args[3], second: args[4], proposal: args[5] });
    return (reactiveRecord as (...args: any[]) => Promise<R | null>)(...args);
  };
  o.acquisition.outline.recordPublicTransition = async (...args: any[]) => { order.push('outline'); return outlineRecord(...args); };
  try {
    const service = new V6AgentService(() => runtime), captured = (reference: R): R => hano.objects[reference.$object],
      sessionId = captured(hano.snapshots[0].observation).observation_ref.split(':epoch:')[0];
    let result = await service.handle({ type: 'init', sequence: 0, sessionId,
      observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    const initialCheckpoint = value(runtime, OWNER);
    for (const [i, returned] of hano.publicProtocol.events.slice(1).entries()) {
      assert.equal(result.kind, 'action'); assert.deepEqual(result.command, returned.command);
      result = await service.handle({ type: 'advance', sequence: i + 1, sessionId, ticketId: result.ticket!.id,
        observation: copy(returned.observation), executionMs: 0 });
      if (i === 0) { assert.equal(calls.length, 0); assert.deepEqual(value(runtime, OWNER), initialCheckpoint); }
    }
    assert.equal(result.kind, 'boundary'); assert.equal(calls.length, 2);
    assert.deepEqual(order, ['outline', 'reactive', 'outline', 'reactive']);
    for (const [i, call] of calls.entries()) {
      assert.equal(call.proposal, null); assert.deepEqual(call.first, hano.publicProtocol.events[i].observation.frame);
      assert.deepEqual(call.second, hano.publicProtocol.events[i + 1].observation.frame);
    }
    assert.equal(Object.values(o.reactive.input_trials).flat().length, 2);
    assert.equal(o.reactive.pending, null); assert.equal(o.reactive.recipe, null);
    assert.deepEqual(value(runtime, OWNER).source_state, o.reactive.state());
    await runtime.resume(execution); assert.equal(calls.length, 2, 'A subsequent decision does not reacquire either returned primitive');
  } finally { runtime.close('reactive-passive-complete'); }
});

test('selected reactive continuation passes ordinary WHY/ACT, acquires once and restores the actual refusal', async () => {
  const f = fixture.kernelControlled; assert.match(f.qualification, /synthetic/);
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  o.reactive.restore(copy(f.seedState));
  const runtime = new NativeV6Runtime({ sourceDigest: 'reactive-controlled-kernel-contract', now: () => 0,
    families: o.registered, groups: [{ id: 'factored_material_return', families: [ID], entryPoints: ['reactive_contact_continuation'] }],
    maxPointOccurrences: declarations.common.input_domain.max_point_occurrences, authorityPolicy: declarations.common,
    callerStrategy: declarations.strategy.declarations[0]!.configuration, acquisitionFamilies: o.acquisition });
  try {
    let calls = 0; const record = o.reactive.recordSource.bind(o.reactive);
    (o.reactive as unknown as R).recordSource = async (...args: any[]) => { calls++; return (record as (...args: any[]) => Promise<R | null>)(...args); };
    const released = await runtime.initialize({ sessionId: 'reactive:synthetic', observation: packet(),
      budgets: { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 } }, execution);
    assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
    assert.deepEqual(released.command, f.proposal.actions[0]); assert.ok(released.authorization); assert.equal(calls, 0);
    const p = released.snapshot.proposal as R, revision = (released.snapshot.prefix as R).revision;
    assert.equal(p.material_access_subquestion, 'reactive_contact_continuation'); assert.equal(p.reactive_plan.offer.kind, 'binding_followup');
    assert.equal(p.compositions[0].observed, false); assert.ok(p.compositions[0].properties.unknown.includes('capture_law'));
    assert.deepEqual(p.reactive_plan.workflow, f.proposal.reactive_plan.workflow);
    const returned = await runtime.advance({ command: released.command!, observation: packet(1), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(calls, 1); assert.equal(returned.snapshot.actions, 1);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    assert.deepEqual(o.reactive.state(), f.afterState);
    const graphState = value(runtime, OWNER); assert.deepEqual(graphState.source_state, f.afterState);
    const facts = (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
    const events = facts.filter(fact => fact.key === `reactive_event:${revision}`); assert.equal(events.length, 1);
    assert.deepEqual(events[0]!.value, f.record); assert.deepEqual(facts.find(fact => fact.key === 'reactive_state')!.value, f.afterState);
    assert.deepEqual(value(runtime, `reasoning:transition:${revision}`).caller_acquisition.selected_result.events, [f.record]);
    o.reactive.restore(copy(f.seedState)); await runtime.resume(execution);
    assert.equal(calls, 1); assert.equal(o.reactive.pending, null, 'Authoritative acquisition restores the actual refutation instead of a mutable pre-trial state');
  } finally { runtime.close('reactive-selected-complete'); production.close('reactive-owner-contract-complete'); }
});
