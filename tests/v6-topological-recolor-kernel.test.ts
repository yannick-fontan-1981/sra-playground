import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { TopologicalRecolor } from '../src/logos-engine/v6-topological-recolor.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-topological-recolor-reference.json.gz', import.meta.url))).toString()) as R;
const hano = JSON.parse(await readFile(new URL('./fixtures/v6-native-caller/hano-first-prefix.json', import.meta.url), 'utf8')) as R;
const ID = 'public_topological_recolor', OWNER = `family_state:${ID}`;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
function owners(runtime: NativeV6Runtime) {
  const r = runtime as unknown as R;
  return { registered: r.families as NativeFamily[], acquisition: r.acquisitionFamilies,
    recolor: r.acquisitionFamilies.recolor as TopologicalRecolor };
}
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : raw) as R;
}
function packet(step: R, after = false): NativePublicObservation {
  const obs = after ? step.afterObservation : step.observation, rows = after ? step.afterRows : step.rows;
  return { frame_rows: copy(rows), frame_packet: [copy(rows)], frame_hash: obs.frame_hash,
    available_action_refs: copy(obs.available_action_refs), level: obs.level_epoch, levels_completed: obs.levels_completed,
    state: obs.state, step_index: obs.revision - 1 };
}

test('recolor has one cold owner at its declared material position and uses the existing source program', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime), cold = await TopologicalRecolor.create();
    assert.equal(o.registered.filter(f => f.id === ID).length, 1); assert.deepEqual(o.recolor.state(), cold.state());
    const service = new V6AgentService(() => runtime), result = await service.handle({ type: 'init', sequence: 0,
      sessionId: 'recolor-registration', observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    const material = (result.snapshot.coverage as R).sourceGroups.find((g: R) => g.id === 'factored_material_return');
    const index = material.entryPoints.indexOf('topological_recolor'); assert.ok(index > 0);
    assert.equal(material.families[index], ID); assert.equal(material.entryPoints[index - 1], 'observed_framed_transfer');
    assert.equal(material.entryPoints[index + 1], 'reactive_contact'); assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(n => n.kind === 'family_state' && n.family === ID).map(n => n.id), [OWNER]);
    assert.ok(graph.nodes['program:v6.topological_recolor.choose']);
    assert.deepEqual(Object.keys(value(runtime, OWNER).source_state).sort(), ['attempts', 'epoch', 'last', 'portable', 'selection', 'writes']);
  } finally { runtime.close('recolor-registration-complete'); }
});

test('foreign public returns never become recolor records or selected recolor events', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(runtime);
  let records = 0; const record = o.recolor.recordSource.bind(o.recolor);
  (o.recolor as unknown as R).recordSource = (...args: any[]) => { records++; return (record as (...values: any[]) => R | null)(...args); };
  try {
    const service = new V6AgentService(() => runtime), captured = (reference: R): R => hano.objects[reference.$object],
      sessionId = captured(hano.snapshots[0].observation).observation_ref.split(':epoch:')[0];
    let result = await service.handle({ type: 'init', sequence: 0, sessionId,
      observation: copy(hano.publicProtocol.events[0].observation), budgets: copy(hano.budgets) });
    for (const [i, returned] of hano.publicProtocol.events.slice(1).entries()) {
      assert.deepEqual(result.command, returned.command);
      result = await service.handle({ type: 'advance', sequence: i + 1, sessionId,
        ticketId: result.ticket!.id, observation: copy(returned.observation), executionMs: 0 });
      assert.equal(records, 0);
    }
    assert.equal(result.kind, 'boundary'); assert.deepEqual(o.recolor.selection, []); assert.deepEqual(o.recolor.writes, []);
    assert.deepEqual(o.recolor.attempts, {}); assert.deepEqual(value(runtime, OWNER).source_state, o.recolor.state());
    const facts = (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
    assert.equal(facts.filter(f => f.key.startsWith('topological_recolor_event:')).length, 0);
    await runtime.resume(execution); assert.equal(records, 0, 'Restoration does not synthesize foreign recolor acquisitions');
  } finally { runtime.close('recolor-foreign-return-complete'); }
});

test('four synthetic source selections and paints pass common WHY/ACT, acquire once and restore complete evidence', async () => {
  const f = fixture.kernelControlled, steps = f.sequence as R[];
  assert.equal(steps.length, 4); assert.deepEqual(f.seedState.selection, []); assert.equal(f.seedState.epoch, null);
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  // This is a controlled public-return contract, not a game campaign. No
  // learned family state is supplied, and every action is elected by Recolor.
  const runtime = new NativeV6Runtime({ sourceDigest: 'recolor-synthetic-kernel-contract', now: () => 0,
    families: o.registered, groups: [{ id: 'factored_material_return', families: [ID], entryPoints: ['topological_recolor'] }],
    maxPointOccurrences: declarations.common.input_domain.max_point_occurrences, authorityPolicy: declarations.common,
    callerStrategy: declarations.strategy.declarations[0]!.configuration, acquisitionFamilies: o.acquisition });
  let records = 0; const record = o.recolor.recordSource.bind(o.recolor);
  (o.recolor as unknown as R).recordSource = (...args: any[]) => { records++; return (record as (...values: any[]) => R | null)(...args); };
  try {
    let released = await runtime.initialize({ sessionId: 'recolor:synthetic', observation: packet(steps[0]!),
      budgets: { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 } }, execution);
    for (const [i, step] of steps.entries()) {
      assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
      assert.deepEqual(released.command, step.proposal.actions[0]); assert.ok(released.authorization); assert.equal(records, i);
      const proposal = released.snapshot.proposal as R, revision = (released.snapshot.prefix as R).revision;
      assert.equal(proposal.material_access_subquestion, 'topological_recolor'); assert.deepEqual(proposal.recolor_plan, step.proposal.recolor_plan);
      assert.equal(proposal.compositions[0].observed, false); assert.equal(proposal.recolor_plan.choice.release_authority, false);
      const returned = await runtime.advance({ command: released.command!, observation: packet(step, true), executionMs: 0 }, execution);
      assert.equal(returned.kind, 'boundary'); assert.equal(records, i + 1); assert.equal(returned.snapshot.actions, i + 1);
      assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((r: R) => r.operation), ['OP29', 'OP30', 'OP31']);
      assert.deepEqual(o.recolor.state(), step.afterState); assert.deepEqual(value(runtime, OWNER).source_state, step.afterState);
      const facts = (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
      const events = facts.filter(fact => fact.key === `topological_recolor_event:${revision}`);
      assert.equal(events.length, 1); assert.deepEqual(events[0]!.value, step.record);
      assert.deepEqual(facts.find(fact => fact.key === 'topological_recolor_state')!.value, step.afterState);
      assert.deepEqual(value(runtime, `reasoning:transition:${revision}`).caller_acquisition.selected_result.events, [step.record]);
      assert.equal(step.after.matched, null, 'Paint completion is not an official goal confirmation');
      if (i + 1 < steps.length) {
        o.recolor.restore(copy(f.seedState));
        released = await runtime.resume(execution);
        assert.equal(records, i + 1, 'Resume restores acquired evidence without recording again');
      }
    }
    assert.equal(o.recolor.selection.length, 2); assert.equal(o.recolor.writes.length, 2);
    assert.equal(Object.keys(o.recolor.attempts).length, 4); assert.ok(o.recolor.writes.every(w => w.goal_confirmed === false));
    assert.equal((runtime.snapshot().caller as R).acquiredTransitions, 4);
  } finally { runtime.close('recolor-synthetic-complete'); production.close('recolor-owner-contract-complete'); }
});
