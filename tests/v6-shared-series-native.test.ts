import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint, createNativeSharedSeriesFamily } from '../src/logos-engine/v6-shared-series.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { AuxiliarySupportMemory } from '../src/logos-engine/v6-auxiliary-support.ts';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { OccurrenceRecallAccess } from '../src/logos-engine/v6-occurrence-recall.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const oracle = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-coupled-pair-planning-reference.json.gz', import.meta.url))).toString());
const auxiliary = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-auxiliary-support-reference.json.gz', import.meta.url))).toString());
const panelSource = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-panel-service-parity.json.gz', import.meta.url))).toString());
const ID = 'family_state:public_occurrence_recall';
const CAUSE = { workflow: 'test.shared.native', step: 'checkpoint', statement: 'retain' };
const copy = <T>(value: T): T => structuredClone(value);

function initial(name = 'small'): SharedSeriesConstraint {
  const seed = new SharedSeriesConstraint(oracle.policy.recall);
  for (const event of oracle.states[name].events) {
    seed.pairs.applyEvent(copy(event)); seed.events.push(copy(event));
  }
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  family.restore(seed.state()); return family;
}

function counter(context: any): { total: () => number; reset: () => void } {
  let count = 0;
  for (const prototype of [CoupledPairEvidenceMemory.prototype, AuxiliarySupportMemory.prototype, PanelServiceMemory.prototype, OccurrenceRecallAccess.prototype]) {
    const original = prototype.applyEvent;
    context.mock.method(prototype, 'applyEvent', function (this: any, event: R): void { count++; original.call(this, event); });
  }
  return { total: () => count, reset: () => { count = 0; } };
}

function acquireHeld(family: SharedSeriesConstraint): R {
  const before = oracle.scenes['small:5'], after = oracle.scenes['held:0'];
  return family.record(before.observation, after.observation, { action_ref: 'ACTION4' }, before.rows, after.rows, {}, 0, after.public.frame_packet);
}

/** Controlled reducer evidence for checkpoint integrity, not a game receipt. */
const panelEvent = (): R => ({ kind: 'observed_panel_service',
  memory: { symbols: [], evidence: ['panel-before', 'panel-after'], selection_observed: true, effects: [], failed: [] },
  detail: { before: 'panel-before', after: 'panel-after', kind: 'configuration', command: { action_ref: 'ACTION6', data: { x: 3, y: 4 } },
    boundary: false, pixel_changed: true, prediction_matched: true, score_delta: 0 } });

function withPanel(): SharedSeriesConstraint {
  const family = initial(), event = panelEvent();
  family.panel.applyEvent(event); family.events.push(copy(event));
  family.restore(family.state()); return family;
}

test('pre-panel native checkpoints retain their exact digest and can replace later panel evidence', () => {
  // Captured from commit 3b5cb28a594e8570253371aeeb24444361df3cb0 using the same
  // controlled pair fixture. Empty new layers do not rewrite historical hashes.
  assert.equal(new SharedSeriesConstraint(oracle.policy.recall).state().digest,
    'b4d864f344c39137a51b10624f03e4e37b14c053c8799b5e6ee957648d679503');
  const legacy = initial().state();
  assert.equal(legacy.digest, '46077bcd09dec8c38c35a9e34e054ed6882b50b1bbd0244dd17ad5a26e935ff3');
  const family = withPanel();
  assert.equal(family.panel.eventCount, 1); assert.notEqual(family.state().digest, legacy.digest);
  family.restoreNative(legacy);
  assert.deepEqual(family.state(), legacy); assert.equal(family.panel.eventCount, 0);
});

test('the shared immutable panel checkpoint replays once from Kernel and then retains its certificate', async context => {
  const family = withPanel(), store = new NativeKnowledgeStore('shared-native-v37', 'panel-checkpoint'), calls = counter(context);
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const checkpoint = store.stateValue(ID) as R;
  calls.reset(); family.restoreNative(checkpoint);
  assert.equal(calls.total(), checkpoint.events.length);
  assert.equal(family.panel.eventCount, 1);
  calls.reset(); family.restoreNative(store.stateValue(ID) as R);
  assert.equal(calls.total(), 0, 'The panel layer participates in the same certified owner, without its own replay');
  const current = family.nativeState(), publicPanel = family.panel.currentState();
  publicPanel.panel_memory.evidence.push('edited-public-copy'); publicPanel.panel_events.pop();
  assert.equal(family.nativeState(), current, 'An independent panel projection cannot mutate the accepted owner');
  assert.deepEqual(family.state(), checkpoint);
});

test('direct panel reduction, layer replacement and container edits invalidate the shared certificate', context => {
  const changes: [string, (family: SharedSeriesConstraint) => void][] = [
    ['panel reducer', family => family.panel.applyEvent(panelEvent())],
    ['panel layer replacement', family => { family.panel = new PanelServiceMemory(); }],
    ['panel memory replacement', family => { (family.panel as R).panelMemory = { ...copy(family.panel.currentState().panel_memory), evidence: ['unacquired'] }; }],
    ['panel journal append', family => { (family.panel as R).panelEvents.push(panelEvent()); }],
    ['panel journal replacement', family => { (family.panel as R).panelEvents[0] = panelEvent(); }],
  ];
  const calls = counter(context);
  for (const [label, change] of changes) {
    const family = withPanel(), trusted = family.nativeState(); family.restoreNative(trusted);
    change(family); calls.reset(); family.restoreNative(trusted);
    assert.equal(calls.total(), trusted.events.length, label);
    assert.deepEqual(family.state(), trusted, label);
    assert.deepEqual(family.panel.currentState().panel_events, [panelEvent()], label);
  }
});

test('invalid panel restoration is atomic for all shared layers and keeps the previous certificate', context => {
  const family = withPanel(), trusted = family.nativeState(); family.restoreNative(trusted);
  const retained = family.state(), panel = family.panel, pairs = family.pairs, calls = counter(context);
  for (const mutate of [
    (value: R) => { value.events.at(-1).memory.evidence.push('unwitnessed'); },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).memory; },
    (value: R) => { value.digest = 'forged-panel-digest'; },
  ]) {
    const invalid = copy(retained); mutate(invalid);
    assert.throws(() => family.restoreNative(invalid));
    assert.deepEqual(family.state(), retained);
    assert.equal(family.panel, panel); assert.equal(family.pairs, pairs);
    calls.reset(); family.restoreNative(trusted); assert.equal(calls.total(), 0);
  }
});

test('panel reduction outside the common journal cannot certify a fresh native checkpoint', () => {
  const family = withPanel(), trusted = family.nativeState();
  family.panel.applyEvent(panelEvent());
  const inconsistent = family.nativeState();
  assert.throws(() => family.restoreNative(inconsistent), /Shared series memory changed/);
  family.restoreNative(trusted); assert.deepEqual(family.state(), trusted);
});

for (const item of panelSource.commons as R[]) test(`shared observed wrapper and point binding match original ${item.id}`, async () => {
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  for (const event of item.seedEvents) { family.panel.applyEvent(copy(event)); family.events.push(copy(event)); }
  family.restore(family.state());
  const args = item.arguments, checkpoint = family.nativeState();
  const propose = () => family.observedPropose(args.obs, args.rows, args.inputs, args.remaining, args.config, args.levelDeadline);
  if (item.error) await assert.rejects(propose, { message: item.error.message });
  else {
    const proposal = await propose();
    assert.deepEqual(proposal, item.unboundProposal, 'Complete source envelope before physical point binding');
    if (proposal?.status === 'proposed') family.bind(proposal, new ObservedInputDomain(256));
    assert.deepEqual(proposal, item.proposal, 'Complete source envelope including current measured point binding');
  }
  assert.equal(family.nativeState(), checkpoint, 'A proposal or a refusal never acquires panel evidence');
});

test('panel guards retain priority over every older plan in mixed envelopes', () => {
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  for (const item of panelSource.guards as R[]) {
    const args = item.arguments, proposal = { ...copy(args.proposal),
      support_preparation_plan: { unexpected_ancestor: true }, pair_access_plan: { unexpected_ancestor: true },
      graph_access_plan: { unexpected_ancestor: true }, occurrence_recall_plan: { unexpected_ancestor: true } };
    const actual = item.operation === 'before'
      ? family.before(proposal, args.index, { frame_rows: args.rows, level: args.meta.epoch,
        levels_completed: args.meta.score, available_action_refs: args.meta.available } as NativePublicObservation,
      { observation_ref: args.meta.observation_ref })
      : family.after(proposal, args.index, {}, { level_epoch: args.meta.epoch, levels_completed: args.meta.score, state: args.meta.state }, args.rows, args.later);
    assert.deepEqual(actual, item.expected, item.id);
  }
  const original = panelSource.commons.find((item: R) => item.id === 'public_initial').unboundProposal;
  const proposal = { ...copy(original), panel_service_plan: {}, graph_access_plan: { unexpected_ancestor: true } };
  family.bind(proposal, new ObservedInputDomain(256));
  assert.deepEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support,
    'The wrapper uses key presence, including an empty panel key, before considering a lower binding');
  proposal.actions[0].data.x++;
  assert.throws(() => family.bind(proposal, new ObservedInputDomain(256)), /Current point changed/);
});

test('an empty panel plan delegates inherited before and after guards by Python truthiness', () => {
  const family = initial(), scene = oracle.scenes['small:5'], proposal = copy(oracle.plans.common);
  const expectedBefore = family.before(proposal, 0, scene.public, scene.observation);
  const expectedAfter = family.after(proposal, 0, scene.observation, scene.observation, scene.rows, scene.rows);
  assert.equal(expectedBefore.admitted, true);
  proposal.panel_service_plan = {};
  assert.deepEqual(family.before(proposal, 0, scene.public, scene.observation), expectedBefore);
  assert.deepEqual(family.after(proposal, 0, scene.observation, scene.observation, scene.rows, scene.rows), expectedAfter);
});

test('all three source adapters preserve a blocking panel refusal from their one shared planner', async () => {
  const item = panelSource.cases.find((item: R) => item.id === 'propose:pointing_unavailable'), args = item.arguments;
  const family = new SharedSeriesConstraint(oracle.policy.recall), retained = family.nativeState();
  assert.deepEqual(await family.observedPropose(args.obs, args.rows, args.inputs, args.limit, args.config, 1_000_000), item.expected);
  assert.deepEqual(await family.coupledPropose(args.obs, args.rows, args.inputs, args.limit, args.config, 1_000_000), item.expected);
  assert.deepEqual(family.graphPropose(args.obs, args.rows, args.inputs, args.limit, args.config, 1_000_000), item.expected);
  assert.equal(family.nativeState(), retained);
});

test('shared acquisition calls inherited and panel records once and certifies their one journal', context => {
  const family = new SharedSeriesConstraint(oracle.policy.recall), item = panelSource.cases.find((item: R) => item.id === 'record:observed_selection');
  const args = item.arguments, recordCalls = { pair: 0, auxiliary: 0, panel: 0 };
  for (const [key, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['auxiliary', AuxiliarySupportMemory.prototype],
    ['panel', PanelServiceMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      recordCalls[key]++; return (original as Function).apply(this, values);
    });
  }
  const result = family.record(args.before, args.after, args.command, args.rows, args.later, args.proposal, args.index, [args.later]);
  assert.deepEqual(recordCalls, { pair: 1, auxiliary: 1, panel: 1 });
  assert.deepEqual(result.events.filter((event: R) => event.kind === 'observed_panel_service'), item.expected);
  assert.equal(family.events.filter(event => event.kind === 'observed_panel_service').length, 1);
  assert.deepEqual(family.panel.currentState(), item.afterState.projection);
  const checkpoint = family.nativeState(), calls = counter(context);
  family.restoreNative(checkpoint); assert.equal(calls.total(), 0);
  result.events.find((event: R) => event.kind === 'observed_panel_service').memory.evidence.push('edited-public-envelope');
  assert.deepEqual(family.state(), checkpoint);
  assert.equal(family.nativeState(), checkpoint);
});

test('unchanged actual V7 hydration skips replay but public restore still validates every event', async context => {
  const family = initial(), store = new NativeKnowledgeStore('shared-native-v35', 'unchanged'), calls = counter(context);
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const authoritative = store.stateValue(ID) as R;
  calls.reset(); family.restoreNative(authoritative);
  assert.equal(calls.total(), authoritative.events.length, 'A previously unseen authoritative value receives a full replay');
  calls.reset(); family.restoreNative(store.stateValue(ID) as R);
  assert.equal(calls.total(), 0, 'Unchanged validated hydration does not replay its journal');
  assert.equal(store.stateValue(ID), authoritative);
  await store.commit([{ id: 'family_state:other', kind: 'family_state', family: 'other', value: { count: 1 } }], CAUSE);
  family.restoreNative(store.stateValue(ID) as R);
  assert.equal(calls.total(), 0, 'An unrelated graph edit does not invalidate this unchanged hydrated value');
  calls.reset(); family.restore(authoritative);
  assert.equal(calls.total(), authoritative.events.length, 'The public restore contract retains complete validation');
  assert.deepEqual(family.state(), authoritative);
});

test('native retained-fact roundtrip shares old immutable entries and performs no journal replay', context => {
  const family = initial(), first = family.nativeState(), memory = new NativeReasoningMemory(), calls = counter(context);
  assert.equal(family.nativeState(), first);
  const result = acquireHeld(family), second = family.nativeState();
  assert.notEqual(first, second);
  assert.equal(second.events.length, first.events.length + result.events.length);
  for (let index = 0; index < first.events.length; index++) assert.equal(second.events[index], first.events[index]);
  assert.equal(Object.isFrozen(second), true); assert.equal(Object.isFrozen(second.events), true);
  assert.equal(Object.isFrozen(second.events.at(-1).state), true);
  calls.reset();
  memory.nativePut('common-observation-frontier', 'repeated_series_state', second, 'observed-response', 7);
  const retained = memory.nativeGet('common-observation-frontier', 'repeated_series_state').value;
  assert.equal(retained, second);
  family.restoreNative(retained);
  assert.equal(calls.total(), 0, 'The exact current owned checkpoint is already certified by its event acquisition');
  assert.deepEqual(family.state(), second);
  result.events.at(-1).state.evidence.push('changed-external-envelope');
  assert.deepEqual(family.state(), second, 'The public record envelope does not alias retained events');
});

test('public snapshots remain independently mutable despite internal journal and model sharing', () => {
  const family = initial(), native = family.nativeState(), first = family.state(), second = family.state();
  assert.notEqual(first, second); assert.notEqual(first.events[0], second.events[0]);
  first.events.at(-1).state.samples.ACTION4[0].deltas[0][1] = 999;
  first.events.pop(); first.digest = 'edited';
  assert.deepEqual(family.state(), second); assert.deepEqual(family.nativeState(), native);
  const pair = family.pairs.state() as R;
  pair.pair_state.refused.push('projection-only-edit');
  assert.deepEqual(pair.pair_events, family.pairs.state().pair_events,
    'Current-state and journal fields must not become mutable aliases inside the public projection');
  assert.throws(() => family.pairs.restore(pair), /complete event journal/);
});

test('the same old authoritative object rolls back after a new local acquisition', async context => {
  const family = initial(), store = new NativeKnowledgeStore('shared-native-v35', 'rollback');
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: family.nativeState() }], CAUSE);
  const old = store.stateValue(ID) as R; family.restoreNative(old);
  const response = acquireHeld(family), later = family.state(), calls = counter(context);
  family.restoreNative(old);
  assert.equal(calls.total(), old.events.length, 'Changed working generation overrides cached authoritative identity');
  assert.deepEqual(family.state(), old);
  assert.deepEqual(acquireHeld(family), response);
  assert.deepEqual(family.state(), later);
});

test('mutable and shallow-frozen input identities never bypass later corruption validation', () => {
  for (const shallowFreeze of [false, true]) {
    const family = initial(), value = copy(family.state());
    if (shallowFreeze) Object.freeze(value);
    family.restoreNative(value);
    const retained = family.state(), native = family.nativeState();
    value.events.at(-1).state.pair.boxes[0][0] = 999;
    assert.throws(() => family.restoreNative(value), /Shared series memory changed/);
    assert.deepEqual(family.state(), retained); assert.equal(family.nativeState(), native);
  }
});

test('a rejected native restore leaves the accepted checkpoint and all working layers intact', context => {
  const family = initial(), trusted = family.nativeState(); family.restoreNative(trusted);
  const retained = family.state(), pair = family.pairs.state(), aux = family.auxiliary.state(), calls = counter(context);
  for (const mutate of [
    (value: R) => { value.events.at(-1).state.refused.push('unwitnessed'); },
    (value: R) => { value.events.pop(); },
    (value: R) => { value.digest = 'forged'; },
    (value: R) => { value.events.push({ kind: 'unported-event' }); },
  ]) {
    const invalid = copy(retained); mutate(invalid);
    assert.throws(() => family.restoreNative(invalid));
    assert.deepEqual(family.state(), retained); assert.deepEqual(family.pairs.state(), pair); assert.deepEqual(family.auxiliary.state(), aux);
    calls.reset(); family.restoreNative(trusted);
    assert.equal(calls.total(), 0, 'Failed staging must not discard the last valid checkpoint certificate');
  }
});

test('direct public reducers and mutable containers invalidate reuse of an accepted immutable state', context => {
  const changes: [string, (family: SharedSeriesConstraint) => void][] = [
    ['pair applyEvent', family => family.pairs.applyEvent({ kind: 'coupled_pair_evidence', state: family.pairs.currentState(), evidence: [] })],
    ['auxiliary applyEvent', family => family.auxiliary.applyEvent({ kind: 'coupled_support_preparation', state: { phase: 'unresolved' }, evidence: [] })],
    ['recall applyEvent', family => family.memory.applyEvent({ kind: 'repeated_line_trial', trial: 'public-reducer-change' })],
    ['journal append', family => { family.events.push(copy(family.events.at(-1)!)); }],
    ['journal same-length replacement', family => { family.events[0] = copy(family.events[0]!); }],
    ['public dictionary', family => { family.memory.lineTrials.extra = { kind: 'repeated_line_trial', trial: 'direct-edit' }; }],
    ['public Set', family => { family.memory.insertRefutedEpochs.add(99); }],
    ['nested public Map/Set', family => { family.memory.crossAxisInputs.get(0)!.add('ACTION9'); }],
    ['public scalar', family => { family.memory.requestedStopReason = 'external-edit'; }],
    ['public mutable context', family => { family.memory.recallContext = { chosen: 'unwitnessed-context' }; }],
  ];
  const calls = counter(context);
  for (const [label, change] of changes) {
    const family = initial(), authoritative = family.nativeState(); family.restoreNative(authoritative);
    change(family); calls.reset(); family.restoreNative(authoritative);
    assert.equal(calls.total(), authoritative.events.length, label);
    assert.deepEqual(family.state(), authoritative, label);
  }
});

test('an inconsistent direct reducer change cannot certify its own freshly generated checkpoint', () => {
  const family = initial(), retained = family.state();
  family.pairs.applyEvent({ kind: 'coupled_pair_evidence', state: family.pairs.currentState(), evidence: [] });
  const inconsistent = family.nativeState();
  assert.throws(() => family.restoreNative(inconsistent), /Shared series memory changed/,
    'A new digest alone is not proof that the journal and its projections agree');
  family.restoreNative(retained); assert.deepEqual(family.state(), retained);
});

test('partial record failure invalidates reuse before any recovery restoration', context => {
  const family = initial(), trusted = family.nativeState(), calls = counter(context), scene = oracle.scenes['small:5'];
  const original = family.pairs.record;
  context.mock.method(family.pairs, 'record', function (this: CoupledPairEvidenceMemory, ...args: Parameters<typeof original>): R[] {
    original.apply(this, args); throw new Error('controlled-post-acquisition-failure');
  });
  assert.throws(() => family.record(scene.observation, scene.observation, { action_ref: 'ACTION4' },
    scene.rows, scene.rows, {}, 0, []), /controlled-post-acquisition-failure/);
  calls.reset(); family.restoreNative(trusted);
  assert.equal(calls.total(), trusted.events.length);
  assert.deepEqual(family.state(), trusted);
});

test('auxiliary selection/model/return journals retain source projections through native checkpoints', async context => {
  const journal = auxiliary.journals.find((row: R) => row.id === 'selection_parking_return_and_physical_group_verification');
  const supported = new Set(['coupled_pair_epoch_anchor', 'coupled_pair_evidence', 'coupled_support_preparation', 'coupled_support_control_model']);
  const family = new SharedSeriesConstraint(oracle.policy.recall);
  family.pairs.restore(journal.initial.pair); family.auxiliary.restore(journal.initial.auxiliary);
  family.events = copy(journal.initial.pair.pair_events); family.restore(family.state());
  const facts = new NativeReasoningMemory(), calls = counter(context);
  for (const [index, step] of journal.steps.entries()) {
    const operation = step.operation, before = auxiliary.scenes[operation.before], after = auxiliary.scenes[operation.after];
    const previous = family.nativeState();
    const result = family.record(before.observation, after.observation, operation.command, before.rows, after.rows,
      operation.proposal, operation.index, after.public.frame_packet);
    assert.deepEqual(result.events, step.expected.rawSourceEvents.filter((event: R) => supported.has(event.kind)),
      'This is the declared transferred-layer projection; unported ancestral events remain outside it');
    assert.deepEqual(family.pairs.state(), step.expected.pair); assert.deepEqual(family.auxiliary.state(), step.expected.auxiliary);
    const current = family.nativeState();
    for (let i = 0; i < previous.events.length; i++) assert.equal(current.events[i], previous.events[i]);
    facts.nativePut('common-observation-frontier', 'repeated_series_state', current, after.observation.observation_ref, index + 1);
    calls.reset(); family.restoreNative(facts.nativeGet('common-observation-frontier', 'repeated_series_state').value);
    assert.equal(calls.total(), 0);
    assert.deepEqual(family.state(), current);
  }
  assert.equal(family.auxiliary.state().support_state!.phase, 'group');
  assert.ok(Object.keys(family.auxiliary.state().support_models).length > 0);
});

test('same root with a revised fragment revalidates hydration, and corrupted fragment content is rejected', async context => {
  const family = initial('many_evidence');
  // Repeated original events exercise storage/reducer reconstruction only.
  // They are not attributed to extra physical actions or a solved game.
  const event = family.state().events.at(-1);
  for (let index = 0; index < 24; index++) { family.pairs.applyEvent(copy(event)); family.events.push(copy(event)); }
  family.restore(family.state());
  const store = new NativeKnowledgeStore('shared-native-v35', 'fragment-revision'), checkpoint = family.nativeState();
  await store.commit([{ id: ID, kind: 'family_state', family: family.id, value: checkpoint }], CAUSE);
  const first = store.stateValue(ID) as R; family.restoreNative(first);
  const root = store.node(ID), fragment = Object.values(store.memory.nodes).find(node => node.kind === 'state_fragment');
  assert.ok(fragment, 'The controlled journal must actually exercise fragment hydration');
  const calls = counter(context);
  // The low-level store accepts its actual Kernel fragment kind. This test
  // deliberately revises metadata beneath an unchanged family root.
  await store.commit([{ id: fragment.id, kind: 'state_fragment', component: fragment.component,
    value: fragment.value, evidence: ['fragment-metadata-revision'] } as any], CAUSE);
  assert.equal(store.node(ID), root); assert.notEqual(store.node(fragment.id), fragment);
  const revised = store.stateValue(ID) as R;
  assert.notEqual(revised, first); assert.deepEqual(revised, first);
  family.restoreNative(revised);
  assert.equal(calls.total(), revised.events.length, 'A root identity alone must never authorize the hydration shortcut');
  calls.reset(); family.restoreNative(store.stateValue(ID) as R); assert.equal(calls.total(), 0);
  const retained = family.state();
  await store.commit([{ id: fragment.id, kind: 'state_fragment', component: fragment.component,
    value: { ...(fragment.value as R), node: null } } as any], CAUSE);
  assert.equal(store.node(ID), root);
  assert.throws(() => family.restoreNative(store.stateValue(ID) as R), /fragment digest mismatch/);
  assert.deepEqual(family.state(), retained);
});

test('the native shared factory exposes both internal hooks while preserving public copies', () => {
  const family = createNativeSharedSeriesFamily(oracle.policy.recall, oracle.policy.coupled);
  assert.equal(typeof family.nativeState, 'function'); assert.equal(typeof family.restoreNative, 'function');
  family.restore(initial().state());
  const retained = family.nativeState!(); family.restoreNative!(retained);
  assert.equal(family.nativeState!(), retained);
  const publicState = family.state() as R; publicState.events.pop();
  assert.deepEqual(family.state(), retained);
});
