import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { SymbolTransactions } from '../src/logos-engine/v6-symbol-transactions.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const reference = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = { common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')) } as NativeV6Declarations;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-symbol-transactions-reference.json.gz', import.meta.url))).toString()) as R;
const publicFixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-symbol-kernel-reference.json.gz', import.meta.url))).toString()) as R;
const workshopFixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-ranked-workshop-reference.json.gz', import.meta.url))).toString()) as R;
const ID = 'public_symbol_transaction', OWNER = `family_state:${ID}`, ENTRY = 'observed_symbol_transaction';
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [16, 16, 16], maxActions: 48 };
function owners(runtime: NativeV6Runtime): { registered: NativeFamily[]; symbols: SymbolTransactions } {
  const r = runtime as unknown as R;
  return { registered: r.families, symbols: r.acquisitionFamilies.symbols };
}
function value(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(); assert.ok(graph.nodes[id], `Missing common node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function facts(runtime: NativeV6Runtime): R[] {
  return (value(runtime, 'reasoning:memory').facts as string[]).map(id => value(runtime, id));
}
function packet(rows: NativeRows, obs: R): NativePublicObservation {
  return { frame_rows: copy(rows), frame_packet: [copy(rows)], frame_hash: obs.frame_hash,
    available_action_refs: copy(obs.available_action_refs), level: obs.level_epoch, levels_completed: obs.levels_completed,
    state: obs.state, step_index: obs.revision - 1 };
}
function session(obs: R): string { return obs.observation_ref.split(':epoch:')[0]; }
function instrument(owner: SymbolTransactions) {
  const records: { action: R; selected: boolean }[] = [], calls = { measure: 0, select: 0 };
  const record = owner.recordSource.bind(owner), measure = owner.measure.bind(owner), select = owner.select.bind(owner);
  owner.recordSource = (...args: Parameters<SymbolTransactions['recordSource']>) => {
    records.push({ action: copy(args[2]), selected: args[5] != null }); return record(...args);
  };
  owner.measure = request => { calls.measure++; return measure(request); };
  owner.select = measured => { calls.select++; return select(measured); };
  return { records, calls };
}

test('symbol state retention requires the same single owner registered for selection', async () => {
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  try {
    const configuration = { sourceDigest: 'symbol-single-owner-contract', now: () => 0,
      families: o.registered, maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
      groups: [{ id: 'factored_material_return', families: [ID], entryPoints: [ENTRY] }],
      authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: (production as unknown as R).acquisitionFamilies };
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: o.registered.filter(f => f.id !== ID) }),
      /Passive acquisition requires the registered common caller families/);
    const second = await SymbolTransactions.create();
    assert.notEqual(second, o.symbols); assert.equal(second.id, o.symbols.id);
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: o.registered.map(f => f.id === ID ? second : f) }),
      /Symbol transaction state retention requires its single registered owner/);
  } finally { production.close('symbol-single-owner-complete'); }
});

test('the production factory registers Symbols once at its declared position after Workshop and before Inventory', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime), cold = await SymbolTransactions.create(), f = fixture.kernelControlled;
    assert.equal(o.registered.filter(family => family.id === ID).length, 1);
    assert.deepEqual(o.symbols.state(), cold.state());
    const first = await runtime.initialize({ sessionId: session(f.observation), observation: packet(f.rows, f.observation), budgets }, execution);
    const material = (first.snapshot.coverage as R).sourceGroups.find((g: R) => g.id === 'factored_material_return');
    const index = material.entryPoints.indexOf(ENTRY), order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    assert.ok(index >= 0); assert.equal(material.families[index], ID);
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    assert.ok(index > material.entryPoints.indexOf('observed_ranked_workshop'));
    assert.ok(index < material.entryPoints.indexOf('observed_inventory_composition'));
    const named = material.entryPoints.filter((entry: string | null) => entry !== null);
    assert.deepEqual(named, [...named].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(n => n.kind === 'family_state' && n.family === ID).map(n => n.id), [OWNER]);
    assert.ok(graph.nodes['program:v6.symbol_transactions.choose']);
    assert.deepEqual(Object.keys(value(runtime, OWNER).source_state).sort(),
      ['epoch', 'events', 'interface_state', 'rejected', 'transition_count']);
    assert.equal(first.snapshot.levelsCompleted, 0, 'Synthetic source geometry establishes no official game success');
  } finally { runtime.close('symbol-registration-complete'); }
});

test('the complete production caller selects a measured guide through SRC and acquires its ineffective action exactly once', async () => {
  // These public rasters are a controlled source contract, not a game trace.
  // The normal factory, strategy and WHY/ACT choose and bind the action from
  // cold state; no proposal, acquired method or family replacement is supplied.
  const f = publicFixture.kernelPublic, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owner = owners(runtime).symbols, instrumentation = instrument(owner), cold = owner.state();
  try {
    const first = await runtime.initialize({ sessionId: session(f.observation), observation: packet(f.rows, f.observation), budgets }, execution);
    const proposal = first.snapshot.proposal as R;
    assert.equal(first.kind, 'action', first.reason); assert.equal(first.snapshot.lastDecision, ID);
    assert.deepEqual(first.command, f.proposal.actions[0]);
    assert.deepEqual(proposal.symbol_transaction_plan, f.proposal.symbol_transaction_plan);
    assert.notEqual(proposal.symbol_transaction_plan.entity_ref, proposal.steps[0].point_binding.entity_ref,
      'The measured outer frame and the actual pixel owner remain distinct through common binding');
    assert.deepEqual(proposal.steps[0].point_binding.point, [first.command!.data!.x, first.command!.data!.y]);
    assert.equal(proposal.material_access_subquestion, ENTRY);
    assert.equal(proposal.strategy_receipt.selected, 'factored_material_return');
    assert.equal(proposal.symbol_transaction_plan.workflow.workflow, 'v6.symbol_transactions.choose');
    assert.equal(proposal.bundle_template.operation_key, 'OP18');
    assert.equal((first.snapshot.whyAct as R).decision.decision.status, 'action_set_released');
    assert.ok(first.authorization); assert.equal(proposal.steps[0].expected_after, null);
    assert.equal(instrumentation.calls.measure, 1); assert.equal(instrumentation.calls.select, 1);
    assert.equal(instrumentation.records.length, 0);
    assert.deepEqual(owner.before(proposal, 0, packet(f.rows, f.observation), f.observation), f.beforeCurrent);
    assert.equal(owner.before(proposal, 0, packet(f.rows, f.noEffectObservation), f.noEffectObservation).admitted, false);
    const returned = await runtime.advance({ command: first.command!, observation: packet(f.rows, f.noEffectObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(returned.snapshot.actions, 1);
    assert.deepEqual(instrumentation.records, [{ action: first.command, selected: true }]);
    assert.deepEqual(owner.state(), f.noEffectState);
    assert.deepEqual(value(runtime, OWNER).source_state, f.noEffectState);
    const event = facts(runtime).filter(fact => fact.key === `symbol_transaction_event:${f.observation.revision}`);
    assert.equal(event.length, 1); assert.deepEqual(event[0]!.value, f.noEffectReturn);
    assert.deepEqual(facts(runtime).find(fact => fact.key === 'observed_symbol_transactions_state')!.value, f.noEffectState);
    assert.deepEqual(value(runtime, `reasoning:transition:${f.observation.revision}`).caller_acquisition.selected_result.events, [f.noEffectReturn]);
    assert.deepEqual((returned.snapshot.whyAct as R).analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
    assert.equal(owner.events.length, 1); assert.equal(owner.rejected.length, 1);
    assert.equal(owner.events[0]!.universal_law_confirmed, false);
    assert.equal(f.postRefutationProposal, null);
    owner.restore(cold);
    const later = await runtime.resume(execution);
    assert.notEqual(later.snapshot.lastDecision, ID);
    assert.deepEqual(owner.state(), f.noEffectState, 'The graph restores the actual acquired rejection before the next choice');
    assert.equal(instrumentation.records.length, 1, 'Restore and selection must not record the prior transition again');
  } finally { runtime.close('symbol-production-loop-complete'); }
});

test('a foreign actual return can teach Workshop while Symbols has no active or passive acquisition', async () => {
  const f = workshopFixture.kernelControlled, runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owner = owners(runtime).symbols, instrumentation = instrument(owner);
  try {
    const first = await runtime.initialize({ sessionId: session(f.observation), observation: packet(f.rows, f.observation), budgets }, execution);
    assert.equal(first.kind, 'action'); assert.equal(first.snapshot.lastDecision, 'observed_frontier');
    const returned = await runtime.advance({ command: first.command!, observation: packet(f.heldRows, f.heldObservation), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.deepEqual(instrumentation.records, []);
    assert.deepEqual(owner.events, []); assert.deepEqual(owner.interface.state().contrasts, []);
    assert.deepEqual(owner.interface.state().methods, []);
    assert.equal(facts(runtime).some(fact => fact.key.startsWith('symbol_transaction_event:') || fact.key === 'observed_symbol_transactions_state'), false);
    assert.equal(facts(runtime).filter(fact => fact.key === 'ranked_workshop_event:1').length, 1);
    const next = await runtime.resume(execution);
    assert.equal(next.snapshot.lastDecision, 'public_ranked_workshop');
    assert.deepEqual(instrumentation.records, [], 'A useful foreign contrast still gives Symbols no selected return');
  } finally { runtime.close('symbol-foreign-acquisition-contract-complete'); }
});
