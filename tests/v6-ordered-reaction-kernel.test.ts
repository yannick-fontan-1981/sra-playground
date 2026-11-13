import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import type { OrderedReaction } from '../src/logos-engine/v6-ordered-reaction.ts';
type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const referenceRoot = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', referenceRoot), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', referenceRoot), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-ordered-reaction-family-reference.json.gz', import.meta.url))).toString()) as R;
const hano = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8')) as R;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'public_ordered_reaction', OWNER = `family_state:${ID}`;
const empty = { epoch: null, control: [], packets: [], attempts: {}, progress: null, history: [] };
function owners(runtime: NativeV6Runtime) {
  const r = runtime as unknown as R;
  return { registered: r.families as NativeFamily[], acquisition: r.acquisitionFamilies,
    reaction: r.acquisitionFamilies.reaction as OrderedReaction };
}
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common Kernel node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : raw) as R;
}
function packet(step = 0): NativePublicObservation {
  const f = fixture.kernelControlled;
  return { frame_rows: copy(f.rows), frame_packet: step ? copy(f.frames) : [copy(f.rows)], frame_hash: f.observation.frame_hash,
    available_action_refs: copy(f.observation.available_action_refs), level: 1, levels_completed: 0,
    state: 'NOT_FINISHED', step_index: step };
}

test('ordered reaction occupies its exact source entry with one cold owner and registered SRC', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime); assert.equal(o.registered.filter(f => f.id === ID).length, 1); assert.deepEqual(o.reaction.state(), empty);
    const service = new V6AgentService(() => runtime), result = await service.handle({ type: 'init', sequence: 0,
      sessionId: 'reaction-registration', observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    assert.equal(result.snapshot.lastDecision, 'ordered_support_transfer');
    const groups = (result.snapshot.coverage as R).sourceGroups as R[], material = groups.find(g => g.id === 'factored_material_return')!;
    const index = material.entryPoints.indexOf('ordered_reaction'); assert.ok(index >= 0);
    assert.equal(material.families[index], ID); assert.equal(material.entryPoints[index - 1], 'reactive_contact');
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === ID).map(node => node.id), [OWNER]);
    assert.ok(graph.nodes['program:v6.ordered_reaction.choose']); assert.deepEqual(value(runtime, OWNER).source_state.control, []);
  } finally { runtime.close('reaction-registration-complete'); }
});

test('foreign returns acquire ordered reaction once after sealing and before reactive contact', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(runtime), calls: R[] = [], order: string[] = [];
  const record = o.reaction.recordSource.bind(o.reaction), outlineRecord = o.acquisition.outline.recordPublicTransition.bind(o.acquisition.outline),
    reactiveRecord = o.acquisition.reactive.recordSource.bind(o.acquisition.reactive);
  (o.reaction as unknown as R).recordSource = (...args: any[]) => {
    order.push('reaction'); calls.push({ before: args[0], after: args[1], command: args[2], first: args[3], second: args[4], proposal: args[5], frames: args[7] });
    return (record as (...args: any[]) => R | null)(...args);
  };
  o.acquisition.outline.recordPublicTransition = async (...args: any[]) => { order.push('outline'); return outlineRecord(...args); };
  o.acquisition.reactive.recordSource = async (...args: any[]) => { order.push('reactive'); return reactiveRecord(...args); };
  try {
    const service = new V6AgentService(() => runtime), captured = (reference: R): R => hano.objects[reference.$object],
      sessionId = captured(hano.snapshots[0].observation).observation_ref.split(':epoch:')[0];
    let result = await service.handle({ type: 'init', sequence: 0, sessionId,
      observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    const initial = value(runtime, OWNER);
    for (const [i, returned] of hano.publicProtocol.events.slice(1).entries()) {
      assert.equal(result.kind, 'action'); assert.deepEqual(result.command, returned.command);
      result = await service.handle({ type: 'advance', sequence: i + 1, sessionId, ticketId: result.ticket!.id,
        observation: copy(returned.observation), executionMs: 0 });
      if (i === 0) { assert.equal(calls.length, 0); assert.deepEqual(value(runtime, OWNER), initial); }
    }
    assert.equal(result.kind, 'boundary'); assert.equal(calls.length, 2);
    assert.deepEqual(order, ['outline', 'reaction', 'reactive', 'outline', 'reaction', 'reactive']);
    for (const [i, call] of calls.entries()) {
      assert.equal(call.proposal, null); assert.deepEqual(call.first, hano.publicProtocol.events[i].observation.frame);
      assert.deepEqual(call.second, hano.publicProtocol.events[i + 1].observation.frame);
      assert.ok(Array.isArray(call.frames));
    }
    assert.deepEqual(o.reaction.state().attempts, {}); assert.deepEqual(value(runtime, OWNER).source_state, o.reaction.state());
    await runtime.resume(execution); assert.equal(calls.length, 2, 'Resume cannot reacquire either returned primitive');
  } finally { runtime.close('reaction-passive-complete'); }
});

test('selected ordered process uses WHY/ACT and acquires the complete restored animation packet exactly once', async () => {
  const f = fixture.kernelControlled; assert.match(f.qualification, /synthetic/);
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  o.reaction.restore(copy(f.seedState));
  const runtime = new NativeV6Runtime({ sourceDigest: 'reaction-controlled-kernel-contract', now: () => 0,
    families: o.registered, groups: [{ id: 'factored_material_return', families: [ID], entryPoints: ['ordered_reaction'] }],
    maxPointOccurrences: declarations.common.input_domain.max_point_occurrences, authorityPolicy: declarations.common,
    callerStrategy: declarations.strategy.declarations[0]!.configuration, acquisitionFamilies: o.acquisition });
  try {
    let calls = 0; const record = o.reaction.recordSource.bind(o.reaction);
    (o.reaction as unknown as R).recordSource = (...args: any[]) => { calls++; return (record as (...args: any[]) => R | null)(...args); };
    const released = await runtime.initialize({ sessionId: 'reaction:synthetic', observation: packet(),
      budgets: { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 } }, execution);
    assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
    assert.deepEqual(released.command, f.proposal.actions[0]); assert.ok(released.authorization); assert.equal(calls, 0);
    const p = released.snapshot.proposal as R, revision = (released.snapshot.prefix as R).revision;
    assert.equal(p.material_access_subquestion, 'ordered_reaction'); assert.equal(p.reaction_plan.offer.kind, 'probe');
    assert.deepEqual(p.reaction_plan.workflow, f.proposal.reaction_plan.workflow);
    assert.equal(p.compositions[0].observed, false); assert.ok(p.compositions[0].properties.unknown.includes('phase_laws'));
    const returned = await runtime.advance({ command: released.command!, observation: packet(1), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(calls, 1); assert.equal(returned.snapshot.actions, 1);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((row: R) => row.operation), ['OP29', 'OP30', 'OP31']);
    assert.deepEqual(o.reaction.state(), f.afterState); assert.deepEqual(value(runtime, OWNER).source_state, f.afterState);
    const facts = (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
    const events = facts.filter(fact => fact.key === `reaction_event:${revision}`); assert.equal(events.length, 1);
    assert.deepEqual(events[0]!.value, f.record); assert.deepEqual(facts.find(fact => fact.key === 'reaction_state')!.value, f.afterState);
    assert.deepEqual(value(runtime, `reasoning:transition:${revision}`).caller_acquisition.selected_result.events, [f.record]);
    assert.equal(f.record.restored, true); assert.equal(o.reaction.packets.length, 1);
    o.reaction.restore(copy(f.seedState)); await runtime.resume(execution);
    assert.equal(calls, 1); assert.deepEqual(o.reaction.state(), f.afterState, 'Actual acquired animation restores instead of a mutable pre-trial copy');
  } finally { runtime.close('reaction-selected-complete'); production.close('reaction-owner-contract-complete'); }
});
