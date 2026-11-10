import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { RankedWorkshop } from '../src/logos-engine/v6-ranked-workshop.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-ranked-workshop-reference.json.gz', import.meta.url))).toString()) as R;
const ID = 'public_ranked_workshop', OWNER = `family_state:${ID}`, ENTRY = 'observed_ranked_workshop';
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 };
function owners(runtime: NativeV6Runtime): { registered: NativeFamily[]; workshop: RankedWorkshop } {
  const r = runtime as unknown as R;
  return { registered: r.families, workshop: r.acquisitionFamilies.workshop };
}
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function facts(runtime: NativeV6Runtime): R[] {
  return (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
}
function packet(rows: NativeRows, obs: R, available: string[] = obs.available_action_refs): NativePublicObservation {
  return { frame_rows: copy(rows), frame_packet: [copy(rows)], frame_hash: obs.frame_hash,
    available_action_refs: copy(available), level: obs.level_epoch, levels_completed: obs.levels_completed,
    state: obs.state, step_index: obs.revision - 1 };
}
function instrument(owner: RankedWorkshop) {
  const records: { action: R; selected: boolean }[] = [], calls = { measure: 0, select: 0 };
  const record = owner.recordSource.bind(owner), measure = owner.measure.bind(owner), select = owner.select.bind(owner);
  owner.recordSource = (...args: Parameters<RankedWorkshop['recordSource']>) => {
    records.push({ action: copy(args[2]), selected: args[5] != null }); return record(...args);
  };
  owner.measure = request => { calls.measure++; return measure(request); };
  owner.select = measured => { calls.select++; return select(measured); };
  return { records, calls };
}

test('passive workshop acquisition rejects an omitted owner and a second object with the same family id', async () => {
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  try {
    const configuration = { sourceDigest: 'workshop-single-owner-contract', now: () => 0,
      families: o.registered, maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
      groups: [{ id: 'factored_material_return', families: [ID], entryPoints: [ENTRY] }],
      authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: (production as unknown as R).acquisitionFamilies };
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: o.registered.filter(f => f.id !== ID) }),
      /Passive acquisition requires the registered common caller families/);
    const second = await RankedWorkshop.create();
    assert.notEqual(second, o.workshop); assert.equal(second.id, o.workshop.id);
    assert.throws(() => new NativeV6Runtime({ ...configuration,
      families: o.registered.map(f => f.id === ID ? second : f) }),
    /Ranked workshop passive acquisition requires its single registered owner/);
  } finally { production.close('workshop-single-owner-complete'); }
});

test('workshop has a single cold owner in the source material order and its program lives in the common store', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime), cold = await RankedWorkshop.create(), f = fixture.kernelControlled;
    assert.equal(o.registered.filter(family => family.id === ID).length, 1);
    assert.deepEqual(o.workshop.state(), cold.state());
    const first = await runtime.initialize({ sessionId: 'workshop:synthetic', observation: packet(f.rows, f.observation), budgets }, execution);
    const material = (first.snapshot.coverage as R).sourceGroups.find((g: R) => g.id === 'factored_material_return');
    const index = material.entryPoints.indexOf(ENTRY), order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    assert.ok(index >= 0); assert.equal(material.families[index], ID);
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const actualNamed = material.entryPoints.filter((entry: string | null) => entry !== null);
    assert.deepEqual(actualNamed, [...actualNamed].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    assert.ok(index < material.entryPoints.indexOf('observed_inventory_composition'));
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(n => n.kind === 'family_state' && n.family === ID).map(n => n.id), [OWNER]);
    assert.ok(graph.nodes['program:v6.ranked_workshop.choose']);
    assert.deepEqual(Object.keys(value(runtime, OWNER).source_state).sort(),
      ['epoch', 'events', 'input_effects', 'method_refutations', 'mode_evidence', 'mode_methods', 'operator_observations', 'rejected']);
    assert.equal(first.kind, 'action'); assert.equal(first.snapshot.lastDecision, 'observed_frontier');
    assert.deepEqual(first.command, { action_ref: 'ACTION1' });
    assert.equal(o.workshop.src_calls, 0, 'A compiled workflow alone is not an active workshop decision');
    assert.deepEqual(o.workshop.mode_evidence, []);
    assert.equal(first.snapshot.levelsCompleted, 0);
  } finally { runtime.close('workshop-registration-complete'); }
});

test('the complete production caller acquires a foreign contrast, selects workshop through SRC and rejects its ineffective experiment exactly once', async () => {
  // The raster changes below are deliberately synthetic source contracts.
  // No family, action, proposal, learned mode or acquired state is injected;
  // the production factory and original strategy own both selections.
  const f = fixture.kernelControlled, expected = f.expectedActionVariants.ACTION1;
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), owner = owners(runtime).workshop;
  const instrumentation = instrument(owner), cold = owner.state();
  try {
    const first = await runtime.initialize({ sessionId: 'workshop:synthetic', observation: packet(f.rows, f.observation), budgets }, execution);
    assert.equal(first.kind, 'action'); assert.equal(first.snapshot.lastDecision, 'observed_frontier');
    assert.deepEqual(first.command, expected.passiveAction); assert.equal(instrumentation.records.length, 0);
    assert.deepEqual(owner.mode_evidence, []); assert.equal(instrumentation.calls.measure, 0);
    const returned = await runtime.advance({ command: first.command!, observation: packet(f.heldRows, f.heldObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(returned.snapshot.actions, 1);
    assert.deepEqual(instrumentation.records, [{ action: expected.passiveAction, selected: false }]);
    assert.deepEqual(owner.state(), expected.acquiredState);
    assert.deepEqual(value(runtime, OWNER).source_state, expected.acquiredState);
    const passive = facts(runtime).filter(fact => fact.key === 'ranked_workshop_event:1');
    assert.equal(passive.length, 1); assert.deepEqual(passive[0]!.value, expected.passiveReturn);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'observed_ranked_workshop_state')!.value, expected.acquiredState);

    // Erasing only the non-authoritative object cannot erase graph knowledge.
    owner.restore(cold); assert.deepEqual(owner.mode_evidence, []);
    const released = await runtime.resume(execution), proposal = released.snapshot.proposal as R;
    assert.equal(released.kind, 'action', released.reason); assert.equal(released.snapshot.lastDecision, ID);
    assert.deepEqual(released.command, expected.proposal.actions[0]);
    assert.deepEqual(proposal.workshop_plan, expected.proposal.workshop_plan);
    assert.deepEqual(owner.state(), expected.acquiredState);
    assert.equal(instrumentation.records.length, 1, 'Restore and selection must not re-acquire the foreign return');
    assert.equal(instrumentation.calls.measure, 1); assert.equal(instrumentation.calls.select, 1);
    assert.equal(proposal.material_access_subquestion, ENTRY);
    assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
    assert.equal(proposal.workshop_plan.workflow.workflow, 'v6.ranked_workshop.choose');
    assert.deepEqual(proposal.workshop_plan.workflow.executed_statements, expected.proposal.workshop_plan.workflow.executed_statements);
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal((released.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.ok(released.authorization); assert.equal(proposal.steps[0].expected_after, null);
    assert.equal(proposal.compositions[0].properties.receipts_are_not_occupancy, true);
    assert.equal(owner.before(proposal, 0, packet(f.heldRows, f.heldObservation), f.heldObservation).admitted, true);
    assert.equal(owner.before(proposal, 0, packet(f.heldRows, f.noEffectObservation), f.noEffectObservation).admitted, false,
      'A new observation invalidates the old authorization even when its pixels are unchanged');

    const sealed = await runtime.advance({ command: released.command!, observation: packet(f.heldRows, f.noEffectObservation), executionMs: 0 }, execution);
    assert.equal(sealed.kind, 'boundary'); assert.equal(sealed.snapshot.actions, 2);
    assert.deepEqual(instrumentation.records, [{ action: expected.passiveAction, selected: false },
      { action: expected.proposal.actions[0], selected: true }]);
    assert.deepEqual(owner.state(), expected.noEffectState);
    assert.deepEqual(value(runtime, OWNER).source_state, expected.noEffectState);
    assert.deepEqual((sealed.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    const events = facts(runtime).filter(fact => fact.key === 'ranked_workshop_event:2');
    assert.equal(events.length, 1); assert.deepEqual(events[0]!.value, expected.noEffectReturn);
    assert.deepEqual(value(runtime, 'reasoning:transition:2').caller_acquisition.selected_result.events, [expected.noEffectReturn]);
    assert.equal(owner.events.length, 1); assert.equal(owner.rejected.length, 1);
    assert.equal(owner.events[0]!.universal_law_confirmed, false);
    assert.equal(expected.postRefutationProposal, null);
    owner.restore(cold);
    const afterRefusal = await runtime.resume(execution);
    assert.equal(afterRefusal.kind, 'action'); assert.equal(afterRefusal.snapshot.lastDecision, 'observed_frontier');
    assert.deepEqual(afterRefusal.command, { action_ref: 'ACTION3' });
    assert.deepEqual(owner.state(), expected.noEffectState);
    assert.equal(instrumentation.records.length, 2, 'The selected return has one acquisition, never a second passive record');
    assert.equal(afterRefusal.snapshot.levelsCompleted, 0, 'This controlled contrast makes no game success claim');
  } finally { runtime.close('workshop-production-loop-complete'); }
});

test('two real common returns preserve a portable method through graph restoration and a new scope revalidates then refutes it', async () => {
  const f = fixture.kernelPortable, steps = f.sequence as R[];
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), owner = owners(runtime).workshop;
  const instrumentation = instrument(owner), cold = owner.state();
  try {
    let released = await runtime.initialize({ sessionId: 'workshop:synthetic',
      observation: packet(steps[0]!.first, steps[0]!.before), budgets }, execution);
    for (const [i, step] of steps.entries()) {
      assert.equal(released.kind, 'action', released.reason);
      assert.equal(released.snapshot.lastDecision, 'observed_frontier'); assert.deepEqual(released.command, step.command);
      // A public availability change supplies a distinct frontier context for
      // the third synthetic return. The caller still elects ACTION5 itself.
      const available = i === 1 ? ['ACTION5', 'ACTION7'] : step.after.available_action_refs;
      const returned = await runtime.advance({ command: released.command!, observation: packet(step.second, step.after, available), executionMs: 0 }, execution);
      assert.equal(returned.kind, 'boundary'); assert.equal(instrumentation.records.length, i + 1);
      assert.deepEqual(owner.state(), step.afterState);
      assert.deepEqual(value(runtime, OWNER).source_state, step.afterState);
      assert.deepEqual(instrumentation.records.map(item => item.selected), Array(i + 1).fill(false));
      owner.restore(cold);
      released = await runtime.resume(execution);
    }
    assert.equal(owner.mode_evidence.length, 0, 'Historical methods do not preserve current-scope authorization');
    assert.equal(owner.mode_methods.length, 1); assert.equal(owner.mode_methods[0]!.contrasts.length, 2);
    assert.equal(released.kind, 'action'); assert.equal(released.snapshot.lastDecision, ID);
    const proposal = released.snapshot.proposal as R;
    assert.deepEqual(released.command, f.newScopeProposal.actions[0]);
    assert.deepEqual(proposal.workshop_plan, f.newScopeProposal.workshop_plan);
    assert.equal(proposal.workshop_plan.extension.kind, 'revalidate_mode');
    assert.equal(proposal.workshop_plan.control_status, 'portable_method_to_revalidate');
    assert.equal(proposal.facts.observed_control_mode_contrast_bound, false);
    assert.equal(instrumentation.records.length, 3);
    assert.equal(owner.before(proposal, 0, packet(steps[0]!.first, f.failedObservation), f.failedObservation).admitted, false);
    const returned = await runtime.advance({ command: released.command!,
      observation: packet(steps[0]!.first, f.failedObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(instrumentation.records.length, 4);
    assert.equal(instrumentation.records.at(-1)!.selected, true);
    assert.deepEqual(owner.state(), f.noEffectState); assert.deepEqual(value(runtime, OWNER).source_state, f.noEffectState);
    assert.equal(owner.method_refutations.length, 1); assert.equal(owner.method_refutations[0]![1], 2);
    assert.equal(owner.mode_methods.length, 1, 'A local refutation preserves the transportable hypothesis with its scope');
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'ranked_workshop_event:4')!.value, f.noEffectReturn);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    assert.equal(f.postRefutationProposal, null);
    owner.restore(cold);
    const resumed = await runtime.resume(execution);
    assert.ok(resumed.kind !== 'action' || resumed.snapshot.lastDecision !== ID);
    assert.deepEqual(owner.state(), f.noEffectState); assert.equal(instrumentation.records.length, 4);
    // The protocol boundary above belongs solely to this controlled fixture.
    assert.equal(resumed.snapshot.levelsCompleted, 1);
  } finally { runtime.close('workshop-portable-common-loop-complete'); }
});
