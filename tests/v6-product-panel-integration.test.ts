import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ProductPanelMemory } from '../src/logos-engine/v6-product-panel-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-product-panel-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const productPolicy = configuration.window_constraints.product_panel_composition;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.product.common', step: 'checkpoint', statement: 'retain' };
const originalProductState = (): R => {
  const { product_state, product_events } = probe.prefixes[0].steps[0].afterState.projection;
  return { product_state, product_events };
};

function firstReturn(family: SharedSeriesConstraint, selected = true): R {
  const before = probe.packets[0], after = probe.packets[1];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, selected ? copy(probe.prefixes[0].proposal) : {}, 0, after.packet.frame_packet);
}

function acquired(): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(recallPolicy);
  firstReturn(family); return family;
}

// Saved public packets exercise the real native caller and state graph. This
// replay is not a new live-game campaign or a claim about original caller parity.
test('a cold common caller releases a measured product question and acquires its actual return once in the Kernel', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1, 'The declared product entry shares one acquisition owner with existing series entries');
  const family = owners[0]!, empty = copy(family.state());
  let result = await runtime.initialize({ sessionId: 'product-common-public-replay',
    observation: copy(probe.packets[0].packet), budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.ok(result.authorization, 'WHY/ACT must release the physical point');
  const proposal = result.snapshot.proposal as R;
  assert.equal(proposal.kind, 'factor_product_experiment');
  assert.equal(proposal.field_subquestion, 'product_panel_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.equal(proposal.product_panel_plan.estimate, null, 'A cold question has no acquired cycle edge');
  assert.equal(proposal.steps[0].relation_observed, false);
  assert.deepEqual(result.command, probe.packets[1].command);
  assert.deepEqual(family.state(), empty, 'Read-only proposal and guards must not invent an effect');

  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const productIndex = window.entryPoints.indexOf('product_panel_composition');
  const cellIndex = window.entryPoints.indexOf('cell_patch_composition');
  assert.ok(productIndex >= 0 && cellIndex > productIndex);
  assert.equal(window.families[productIndex], family.id);
  assert.equal(window.families[cellIndex], family.id);

  result = await runtime.advance({ command: result.command!, executionMs: 1, observation: copy(probe.packets[1].packet) }, execution);
  assert.equal(result.kind, 'boundary', result.reason);
  assert.equal(result.snapshot.actions, 1);
  assert.equal((result.snapshot.caller as R).acquiredTransitions, 1);
  assert.deepEqual((result.snapshot.whyAct as R).analysis.map((entry: R) => entry.operation), ['OP29', 'OP30', 'OP31']);
  const graph = runtime.inspectKnowledge();
  const read = (id: string): R => hydrateNativeState(graph.nodes[id]!.value, key => graph.nodes[key]!.value) as R;
  assert.deepEqual(Object.values(graph.nodes).filter(node => node.kind === 'family_state' && node.family === family.id).map(node => node.id), [ID]);
  const retained = read(ID), events = retained.events.filter((event: R) => event.kind === 'observed_factor_product');
  assert.equal(events.length, 1);
  assert.equal(events[0].state.edges.length, 1);
  assert.deepEqual(events[0].state.edges[0].before, probe.prefixes[0].proposal.product_panel_plan.scene.current);
  assert.deepEqual(events[0].state.edges[0].after, originalProductState().product_state.edges[0].after);
  assert.equal(events[0].state.counterexamples.length, 0);
  assert.equal(retained.events.filter((event: R) => event.kind === 'coupled_pair_epoch_anchor').length, 1);
  assert.deepEqual(retained, family.state());
  const prefix = read(`prefix_evidence:${(result.snapshot.prefix as R).revision}`);
  assert.equal(prefix.transitions.length, 1);
  const transition = read(`reasoning:transition:${prefix.decision_revision}`);
  assert.ok(transition.caller_acquisition && transition.frontier_acquisition);
  const facts = (read('reasoning:memory').facts as string[]).map(read);
  assert.deepEqual(facts.find(fact => fact.key === 'repeated_series_state')!.value, retained);

  result = await runtime.resume(execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.deepEqual(result.command, probe.packets[2].command, 'The next unobserved factor is chosen from acquired history');
  assert.equal((result.snapshot.proposal as R).steps[0].factor, 1);
  assert.deepEqual(family.state(), retained, 'Preparing the next question retains, rather than duplicates, acquisition');
});

test('product measurement acquires passively under a foreign plan and persists through the same authoritative series node', async () => {
  const family = new SharedSeriesConstraint(recallPolicy);
  const result = firstReturn(family, false);
  const sourceEvent = probe.prefixes[0].steps[0].acquired.events.find((event: R) => event.kind === 'observed_factor_product');
  assert.deepEqual(result.events.map((event: R) => event.kind), ['observed_factor_product', 'coupled_pair_epoch_anchor']);
  assert.deepEqual(result.events[0], sourceEvent, 'The source layer measures an actual public return even without selecting its own plan');
  assert.deepEqual(family.product.currentState(), originalProductState());
  const after = probe.packets[1], domain = new ObservedInputDomain(4096), inputs = domain.candidates(after.observation);
  const next = await family.productPropose(after.observation, after.packet.frame_rows, inputs, 39, productPolicy, 360_000, () => 0);
  const store = new NativeKnowledgeStore('product-native-integration-v43', 'product-native-rehydrate');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const restored = new SharedSeriesConstraint(recallPolicy), retained = store.stateValue(ID) as R;
  restored.restoreNative(retained);
  assert.deepEqual(restored.product.currentState(), family.product.currentState());
  assert.deepEqual(restored.state(), retained);
  assert.deepEqual(await restored.productPropose(after.observation, after.packet.frame_rows, inputs, 39, productPolicy, 360_000, () => 0), next);
  const exposed = restored.product.currentState();
  exposed.product_state.edges[0].to = -999;
  exposed.product_events.length = 0;
  result.events[0].state.evidence.push('external-envelope-edit');
  assert.deepEqual(restored.state(), retained, 'Public projections and record envelopes cannot mutate retained evidence');
});

test('a changed product reducer invalidates cached checkpoint reuse and cannot certify an unjournaled state', context => {
  const family = acquired(), trusted = family.nativeState();
  const apply = ProductPanelMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(ProductPanelMemory.prototype, 'applyEvent', function (this: ProductPanelMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  family.restoreNative(trusted);
  assert.equal(replays, 0, 'Current owned checkpoints do not replay old acquired events');
  const injected = copy(trusted.events.find((event: R) => event.kind === 'observed_factor_product'));
  injected.state.counterexamples.push({ command: { action_ref: 'ACTION5' }, changed_factors: [0, 1], evidence: ['external-reducer-call'] });
  family.product.applyEvent(injected);
  const inconsistent = family.nativeState();
  assert.throws(() => family.restoreNative(inconsistent), /Shared series memory changed/,
    'Updating the reducer without its journal cannot grant a valid checkpoint');
  replays = 0;
  family.restoreNative(trusted);
  assert.equal(replays, 1, 'A changed product generation forces exact reconstruction from its authoritative event');
  assert.deepEqual(family.state(), trusted);
  assert.deepEqual(family.product.currentState(), originalProductState());
  replays = 0;
  family.restoreNative(trusted);
  assert.equal(replays, 0);
});

test('corrupt product journals reject atomically without discarding other shared layers or the last accepted checkpoint', context => {
  const family = acquired(), trusted = family.nativeState();
  family.restoreNative(trusted);
  const product = family.product.currentState(), pair = family.pairs.state(), rooted = family.rooted.currentState();
  const apply = ProductPanelMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(ProductPanelMemory.prototype, 'applyEvent', function (this: ProductPanelMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  for (const mutate of [
    (state: R) => { state.events.find((event: R) => event.kind === 'observed_factor_product').state.edges[0].to = -999; },
    (state: R) => { state.events = state.events.filter((event: R) => event.kind !== 'observed_factor_product'); },
    (state: R) => { state.events.push(copy(state.events.find((event: R) => event.kind === 'observed_factor_product'))); },
    (state: R) => { state.events.find((event: R) => event.kind === 'coupled_pair_epoch_anchor').frame_digest = 'forged'; },
    (state: R) => { state.digest = 'forged'; },
  ]) {
    const corrupt = copy(trusted); mutate(corrupt);
    assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
    assert.deepEqual(family.state(), trusted);
    assert.deepEqual(family.product.currentState(), product);
    assert.deepEqual(family.pairs.state(), pair);
    assert.deepEqual(family.rooted.currentState(), rooted);
    assert.equal(family.nativeState(), trusted);
    replays = 0;
    family.restoreNative(trusted);
    assert.equal(replays, 0, 'Rejected staging cannot invalidate an already accepted unchanged checkpoint');
  }
});
