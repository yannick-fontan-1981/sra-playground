import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { LabeledSequenceMemory } from '../src/logos-engine/v6-labeled-sequence-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const probe = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-labeled-sequence-original-public.json.gz', import.meta.url))).toString()) as R;
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const configuration = declarations.strategy.declarations[0]!.configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;
const labeledPolicy = configuration.window_constraints.labeled_sequence_composition;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.labeled.common', step: 'checkpoint', statement: 'retain' };

function firstReturn(family: SharedSeriesConstraint, selected = true): R {
  const before = probe.packets[0], after = probe.packets[1];
  return family.record(before.observation, after.observation, copy(after.command), before.packet.frame_rows,
    after.packet.frame_rows, selected ? copy(probe.prefixes[0].proposal) : {}, 0, after.packet.frame_packet);
}
function acquired(): SharedSeriesConstraint {
  const family = new SharedSeriesConstraint(recallPolicy); firstReturn(family); return family;
}
function originalLabeledState(): R {
  const { labeled_cache, labeled_events } = probe.prefixes[0].steps[0].afterState.projection;
  return { labeled_cache, labeled_events };
}

// These are saved public packets, not a new live-game campaign or a replay of
// source private state. The cold native caller must independently choose them.
test('the cold common caller classifies the current query, acquires once and reuses only measured training in the Kernel', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const families = (runtime as unknown as { families: NativeFamily[] }).families;
  const owners = families.filter(family => family.id === 'public_occurrence_recall');
  assert.equal(owners.length, 1);
  const family = owners[0]!, empty = copy(family.state());
  let result = await runtime.initialize({ sessionId: 'labeled-common-public-replay',
    observation: copy(probe.packets[0].packet), budgets: { targetLevels: 1, levelActionCaps: [40], maxActions: 40 } }, execution);
  assert.equal(result.kind, 'action', result.reason ?? JSON.stringify(result.snapshot.trace));
  assert.equal(result.snapshot.lastDecision, family.id);
  assert.ok(result.authorization, 'The current label control still needs actual WHY/ACT release');
  const proposal = result.snapshot.proposal as R, plan = proposal.labeled_sequence_plan;
  assert.equal(proposal.kind, 'labeled_sequence_experiment');
  assert.equal(proposal.field_subquestion, 'labeled_sequence_composition');
  assert.equal(proposal.strategy_receipt.selected, 'window_constraints');
  assert.equal(plan.inference.training_reused, false);
  assert.equal(plan.inference.induction.values.robust_answer_and_submission_agreement, true);
  assert.equal(plan.inference.induction.values.unique_law_proved, false);
  assert.equal(plan.inference.induction.values.classification_submission_authorized, false,
    'A mechanical result itself never grants physical authorization');
  assert.deepEqual(result.command, probe.packets[1].command);
  assert.deepEqual(family.state(), empty, 'Readonly inference cannot acquire its own predicted training example');
  assert.deepEqual(proposal.steps[0].point_binding.point, [result.command!.data!.x, result.command!.data!.y]);
  assert.equal(proposal.steps[0].point_binding.observation_ref, plan.observation_ref);
  const window = (result.snapshot.coverage as R).sourceGroups.find((group: R) => group.id === 'window_constraints');
  const indices = ['product_panel_composition', 'labeled_sequence_composition', 'cell_patch_composition']
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
  const retained = read(ID), events = retained.events.filter((event: R) => event.kind === 'labeled_sequence_submission');
  assert.equal(events.length, 1);
  assert.equal(events[0].label, plan.label);
  assert.deepEqual(events[0].query, plan.scene.query.words[0].values);
  assert.equal(events[0].law_uniqueness_claimed, false);
  assert.equal(events[0].physical_receipt_status, 'changed_public_context');
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
  const next = (result.snapshot.proposal as R).labeled_sequence_plan;
  assert.equal(next.inference.training_reused, true);
  assert.equal(next.inference.training_cache.context_ref, plan.scene.context_ref);
  assert.deepEqual(next.inference.training_cache.training_features, plan.inference.training_cache.training_features);
  assert.deepEqual(family.state(), retained, 'Preparing the new visible query does not duplicate prior acquisition');
});

test('one labeled submission survives a real Kernel checkpoint while foreign actions do not create labeled receipts', async () => {
  const family = new SharedSeriesConstraint(recallPolicy);
  firstReturn(family, false);
  assert.deepEqual(family.labeled.currentState(), { labeled_cache: null, labeled_events: [] });
  const result = firstReturn(family);
  assert.equal(result.events.filter((event: R) => event.kind === 'labeled_sequence_submission').length, 1);
  assert.deepEqual(family.labeled.currentState(), originalLabeledState());
  const after = probe.packets[1], domain = new ObservedInputDomain(4096), inputs = domain.candidates(after.observation);
  const next = await family.labeledPropose(after.observation, after.packet.frame_rows, inputs, 39, labeledPolicy, 360_000, () => 0);
  assert.ok(next);
  assert.equal(next.labeled_sequence_plan.inference.training_reused, true);
  const store = new NativeKnowledgeStore('labeled-native-integration-v44', 'labeled-native-rehydrate');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const restored = new SharedSeriesConstraint(recallPolicy), retained = store.stateValue(ID) as R;
  restored.restoreNative(retained);
  assert.deepEqual(restored.state(), retained);
  assert.deepEqual(restored.labeled.currentState(), family.labeled.currentState());
  assert.deepEqual(await restored.labeledPropose(after.observation, after.packet.frame_rows, inputs, 39, labeledPolicy, 360_000, () => 0), next);
  const exposed = restored.labeled.currentState();
  exposed.labeled_cache.context_ref = 'external-edit';
  exposed.labeled_events.length = 0;
  result.events.find((event: R) => event.kind === 'labeled_sequence_submission').label = -999;
  assert.deepEqual(restored.state(), retained, 'Public projections and result envelopes cannot alter retained cache or journal');
  const stale = probe.prefixes[0].proposal;
  assert.equal(restored.before(stale, 0, after.packet, after.observation).admitted, false,
    'The same visible control cannot authorize an old query after a public change');
});

test('labeled reducer changes invalidate checkpoint reuse and corrupt journals reject atomically', context => {
  const family = acquired(), trusted = family.nativeState();
  const apply = LabeledSequenceMemory.prototype.applyEvent;
  let replays = 0;
  context.mock.method(LabeledSequenceMemory.prototype, 'applyEvent', function (this: LabeledSequenceMemory, event: R): void {
    replays++; apply.call(this, event);
  });
  family.restoreNative(trusted);
  assert.equal(replays, 0, 'An unchanged acquired checkpoint does not replay cumulative events');
  const injected = copy(trusted.events.find((event: R) => event.kind === 'labeled_sequence_submission'));
  injected.cache.context_ref = 'unjournaled-reducer-edit';
  family.labeled.applyEvent(injected);
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  replays = 0; family.restoreNative(trusted);
  assert.equal(replays, 1);
  assert.deepEqual(family.labeled.currentState(), originalLabeledState());
  const acceptedCheckpoint = family.nativeState();
  const current = family.labeled.currentState(), product = family.product.currentState(), pair = family.pairs.state();
  for (const mutate of [
    (state: R) => { state.events.find((event: R) => event.kind === 'labeled_sequence_submission').label = -999; },
    (state: R) => { state.events = state.events.filter((event: R) => event.kind !== 'labeled_sequence_submission'); },
    (state: R) => { state.events.push(copy(state.events.find((event: R) => event.kind === 'labeled_sequence_submission'))); },
    (state: R) => { state.digest = 'forged'; },
  ]) {
    const corrupt = copy(trusted); mutate(corrupt);
    assert.throws(() => family.restoreNative(corrupt), /Shared series memory changed/);
    assert.deepEqual(family.state(), trusted);
    assert.deepEqual(family.labeled.currentState(), current);
    assert.deepEqual(family.product.currentState(), product);
    assert.deepEqual(family.pairs.state(), pair);
    assert.equal(family.nativeState(), acceptedCheckpoint);
    replays = 0; family.restoreNative(trusted);
    assert.equal(replays, 0, 'Rejected staging preserves the last accepted unchanged checkpoint');
  }
});
