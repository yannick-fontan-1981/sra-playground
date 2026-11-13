import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { CrossedPrefixMemory } from '../src/logos-engine/v6-crossed-prefix-access.ts';
import { OccurrenceRecallAccess, OccurrenceRecallConstraint } from '../src/logos-engine/v6-occurrence-recall.ts';
import { RootedQuotaMemory } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { FramedWindowMemory } from '../src/logos-engine/v6-framed-window-access.ts';
import { OccludedCatalogueMemory } from '../src/logos-engine/v6-occluded-catalogue-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-crossed-prefix-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-crossed-prefix-reference.json.gz', import.meta.url))).toString());
const original = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', original), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', original), 'utf8')),
};
const copy = <T>(value: T): T => structuredClone(value);
const fresh = (): SharedSeriesConstraint => new SharedSeriesConstraint(legacy.policy);
const stateId = 'family_state:public_occurrence_recall';
const own = (events: R[]): R[] => events.filter(event => event.kind.startsWith('crossed_prefix_'));
const packet = (rows: number[][], observation: R): NativePublicObservation => ({ frame_rows: rows,
  level: observation.level_epoch, levels_completed: observation.levels_completed,
  available_action_refs: observation.available_action_refs, state: observation.state } as NativePublicObservation);
function seed(owner: SharedSeriesConstraint, events: R[]): void {
  for (const event of copy(events)) { owner.memory.applyEvent(event); owner.events.push(event); }
}
function acquired(): SharedSeriesConstraint {
  const owner = fresh(); owner.restore(copy(legacy.cases.find((item: R) => item.id === 'combined').state));
  seed(owner, source.chains.find((item: R) => item.id === 'compatible_pair').events);
  owner.restore(owner.state()); return owner;
}

test('legacy checkpoints originate only from the published 0.48 checkout', () => {
  assert.equal(legacy.source.siteVersion, 76);
  assert.equal(legacy.source.commit, 'fbbc3fb6b796c0ba359654da7234008767090e1f');
  assert.equal(legacy.source.nativeDigest, 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26');
  assert.equal(legacy.source.fileCount, 266); assert.equal(legacy.source.unchanged, true);
  assert.equal(legacy.cases.length, 11);
  assert.ok(legacy.cases.some((item: R) => item.id === 'framed'));
  assert.ok(legacy.cases.some((item: R) => item.id === 'legacy_crossed'));
});

for (const item of legacy.cases as R[]) test(`actual published 0.48 checkpoint keeps its exact digest: ${item.id}`, () => {
  const owner = acquired(); owner.restoreNative(copy(item.state));
  assert.deepEqual(owner.state(), item.state);
  assert.equal(owner.crossedPrefix, owner.memory.crossedPrefix);
  assert.equal(owner.crossedPrefix.eventCount, own(item.state.events).length);
  assert.deepEqual((owner.memory as R).crossEvents, [], 'The old ancestor fields are not a second authoritative reducer');
  assert.equal((owner.memory as R).crossState, null);
  const checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  assert.equal(owner.nativeState(), checkpoint);
});

test('historical sparse crossed pair is retained without inventing missing planning evidence', () => {
  const owner = fresh(), retained = legacy.cases.find((item: R) => item.id === 'legacy_crossed').state;
  owner.restore(copy(retained));
  assert.deepEqual(owner.crossedPrefix.currentState().cross_pairs, [{ kind: 'crossed_prefix_pair', owner: 0 }]);
  assert.deepEqual(owner.crossedPrefix.currentState().cross_state, { epoch: 1 });
  assert.deepEqual(owner.state(), retained);
  const c = source.accessCases.find((item: R) => item.id === 'fresh_select');
  assert.throws(() => owner.crossedPrefix.crossQuestion(c.observation, c.rows, c.inputs),
    'Historical opaque events do not silently acquire the dependencies required for planning');
});

test('single crossed-prefix owner crosses Kernel persistence with detached exports and certified reuse', async context => {
  const owner = acquired(), count = owner.crossedPrefix.eventCount;
  assert.equal(count, 7);
  const store = new NativeKnowledgeStore('crossed-prefix-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: owner.id, value: owner.nativeState() }],
    { workflow: 'test.crossed_prefix', step: 'checkpoint', statement: 'retain measured crossing responses' });
  const originalApply = CrossedPrefixMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(CrossedPrefixMemory.prototype, 'applyEvent', function (this: CrossedPrefixMemory, event: R) {
    reductions++; originalApply.call(this, event);
  });
  owner.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, count);
  const memory = owner.crossedPrefix; reductions = 0;
  owner.restoreNative(store.stateValue(stateId) as R);
  assert.equal(reductions, 0); assert.equal(owner.crossedPrefix, memory);
  const exported = memory.currentState(), checkpoint = owner.nativeState();
  exported.cross_events.pop(); exported.cross_pairs[0]!.evidence.push('foreign'); exported.cross_state!.progress['0:0:-1'] = 99;
  assert.equal(memory.eventCount, count); assert.equal(memory.currentState().cross_state!.progress['0:0:-1'], 1);
  assert.equal(memory.currentState().cross_pairs[0]!.evidence.includes('foreign'), false);
  assert.equal(owner.nativeState(), checkpoint);
});

test('crossed owner identity, reducer revision and private-state edits invalidate reuse', context => {
  const extra = { kind: 'crossed_prefix_input', axis: 0, action: 'ACTION5', evidence: 'new-return', epoch: 1 };
  const mutations: [string, (owner: SharedSeriesConstraint) => void][] = [
    ['reducer', owner => owner.crossedPrefix.applyEvent(extra)],
    ['replacement', owner => { const replacement = new CrossedPrefixMemory();
      for (const event of owner.crossedPrefix.currentState().cross_events) replacement.applyEvent(event);
      owner.memory.crossedPrefix = replacement; }],
    ['events', owner => { (owner.crossedPrefix as R).events.push(extra); }],
    ['state', owner => { (owner.crossedPrefix as R).crossState = { epoch: 999 }; }],
    ['axis set', owner => { (owner.crossedPrefix as R).axisInputs['0'].add('ACTION5'); }],
  ];
  const originalApply = CrossedPrefixMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(CrossedPrefixMemory.prototype, 'applyEvent', function (this: CrossedPrefixMemory, event: R) {
    reductions++; originalApply.call(this, event);
  });
  for (const [name, mutate] of mutations) {
    const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
    mutate(owner); reductions = 0; owner.restoreNative(checkpoint);
    assert.equal(reductions, 7, name); assert.deepEqual(owner.state(), checkpoint, name);
  }
});

test('failed crossed restores preserve all owner identities and the accepted journal atomically', () => {
  const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  const owners = () => [owner.memory, owner.crossedPrefix, owner.rooted, owner.framedWindow, owner.catalogue, owner.population, owner.reception];
  const identities = owners();
  for (const mutate of [
    (value: R) => { value.events.at(-1).state.selected = 'forged'; },
    (value: R) => { delete value.events.at(-1).state; },
    (value: R) => { value.events.pop(); },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => owner.restoreNative(bad));
    owners().forEach((current, index) => assert.equal(current, identities[index]));
    assert.deepEqual(owner.state(), checkpoint);
  }
});

test('current point and nonpoint proposals match source without acquiring during planning', async () => {
  for (const id of ['common_fresh', 'common_selected_advance']) {
    const c = source.accessCases.find((item: R) => item.id === id), owner = fresh(); seed(owner, c.initialEvents);
    const before = owner.nativeState();
    const proposal = await owner.crossedPrefixPropose(c.observation, c.rows, c.inputs, c.remaining, 1000, () => 0);
    assert.deepEqual(proposal, c.expected); assert.equal(owner.nativeState(), before);
    const domain = new ObservedInputDomain(4096); domain.candidates(c.observation as NativeObservation);
    owner.bind(proposal!, domain);
    assert.equal(owner.before(proposal!, 0, packet(c.rows, c.observation), c.observation).admitted, true);
    assert.equal(owner.before(proposal!, 0, packet(c.rows, c.observation), { ...c.observation, observation_ref: 'foreign' }).admitted, false);
    if (proposal!.actions[0].action_ref === 'ACTION6') {
      const changed = copy(proposal!); changed.actions[0].data.x++;
      assert.throws(() => owner.bind(changed, domain), /address changed/);
      assert.throws(() => owner.bind(proposal!, new ObservedInputDomain(4096)), /not been observed/);
    } else {
      owner.bind(proposal!, new ObservedInputDomain(4096));
      assert.equal(owner.before(proposal!, 0, packet(c.rows, { ...c.observation, available_action_refs: ['ACTION6'] }), c.observation).admitted, false);
    }
  }
});

test('occurrence descendant guard dispatch retains priority over an accompanying crossed plan', context => {
  const owner = fresh(), c = source.accessCases.find((item: R) => item.id === 'common_fresh');
  const mixed = { ...copy(c.expected), occurrence_recall_plan: { current: true } };
  context.mock.method(OccurrenceRecallConstraint.prototype, 'before', () => ({ admitted: false, reason: 'controlled_descendant_before' }));
  context.mock.method(OccurrenceRecallConstraint.prototype, 'after', () => ({ matched: false, seal_prefix: true, reason: 'controlled_descendant_after' }));
  assert.equal(owner.before(mixed, 0, packet(c.rows, c.observation), c.observation).reason, 'controlled_descendant_before');
  assert.equal(owner.after(mixed, 0, c.observation, c.observation, c.rows, c.rows).reason, 'controlled_descendant_after');
});

test('shared record acquires Crossed before Occurrence and keeps Rooted cutoff semantics', context => {
  const c = source.recordCases.find((item: R) => item.id === 'selection_no_visible_change'), calls: string[] = [];
  for (const [name, prototype] of [['crossed', CrossedPrefixMemory.prototype], ['occurrence', OccurrenceRecallAccess.prototype],
    ['rooted', RootedQuotaMemory.prototype], ['framed', FramedWindowMemory.prototype], ['catalogue', OccludedCatalogueMemory.prototype]] as const) {
    const originalRecord = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...args: any[]): R[] {
      calls.push(name);
      if (name === 'rooted' && args[5]?.rooted_quota_plan) return [];
      return (originalRecord as (...values: any[]) => R[]).apply(this, args);
    });
  }
  const owner = fresh();
  const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, [c.later]);
  assert.deepEqual(calls, ['crossed', 'occurrence', 'rooted', 'framed', 'catalogue']);
  assert.deepEqual(own(result.events), c.expectedOwnEvents); assert.equal(owner.crossedPrefix.eventCount, 1);
  assert.deepEqual((owner.memory as R).crossEvents, []);
  calls.length = 0;
  const cutoff = fresh();
  const resultCutoff = cutoff.record(c.before, c.after, c.command, c.rows, c.later,
    { ...copy(c.proposal), rooted_quota_plan: { controlled_cutoff: true } }, c.index, [c.later]);
  assert.deepEqual(calls, ['rooted', 'framed', 'catalogue']);
  assert.deepEqual(own(resultCutoff.events), []); assert.equal(cutoff.crossedPrefix.eventCount, 0);
});

test('shared acquisition calls the actual descendant outcome dispatcher', context => {
  const c = source.recordCases.find((item: R) => item.id === 'advance_no_effect'), owner = fresh(); seed(owner, c.initialEvents);
  let calls = 0;
  context.mock.method(owner, 'after', () => { calls++; return { matched: true, seal_prefix: true, reason: 'controlled_descendant_outcome' }; });
  const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, [c.later]);
  const events = own(result.events);
  assert.equal(calls, 1); assert.equal(events[0]!.kind, 'crossed_prefix_input');
  assert.equal(events.at(-1)!.outcome.reason, 'controlled_descendant_outcome');
  assert.equal(owner.crossedPrefix.currentState().cross_state!.progress[c.proposal.crossed_prefix_plan.controller.key], 1);
});

for (const chain of source.chains as R[]) test(`cold source chain through shared acquisition and restoration: ${chain.id}`, async () => {
  let owner = fresh(); assert.deepEqual(chain.initialEvents, []);
  let acquiredCount = 0;
  for (const step of chain.steps as R[]) {
    const checkpoint = owner.nativeState();
    const proposal = await owner.crossedPrefixPropose(step.before, step.rows, [], 16, 1000, () => 0);
    assert.ok(proposal); assert.deepEqual(proposal.crossed_prefix_plan, step.proposal.crossed_prefix_plan);
    assert.deepEqual(proposal.actions, step.proposal.actions); assert.equal(owner.nativeState(), checkpoint);
    const domain = new ObservedInputDomain(4096); domain.candidates(step.before as NativeObservation); owner.bind(proposal, domain);
    assert.equal(owner.before(proposal, step.index, packet(step.rows, step.before), step.before).admitted, true);
    const result = owner.record(step.before, step.after, step.command, step.rows, step.later, proposal, step.index, [step.later]);
    assert.deepEqual(own(result.events), step.expectedOwnEvents);
    acquiredCount += step.expectedOwnEvents.length;
    assert.equal(owner.crossedPrefix.eventCount, acquiredCount);
    assert.deepEqual(owner.crossedPrefix.currentState(), step.afterState.projection);
    const saved = owner.nativeState(); owner = fresh(); owner.restoreNative(saved);
    assert.deepEqual(owner.crossedPrefix.currentState(), step.restoredState.projection);
  }
  const last = chain.steps.at(-1);
  assert.deepEqual(owner.crossedPrefix.crossQuestion(last.after, last.later, []), chain.following);
  assert.deepEqual(owner.crossedPrefix.currentState(), chain.finalState.projection);
});

test('Crossed source entry follows Framed once and retains one shared provider', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), coverage = runtime.snapshot().coverage as R;
  const group = coverage.sourceGroups.find((item: R) => item.id === 'window_constraints');
  const index = group.entryPoints.indexOf('coupled_prefix_reference');
  assert.equal(index, group.entryPoints.indexOf('framed_window_composition') + 1);
  assert.equal(group.families[index], 'public_occurrence_recall');
  assert.equal(group.entryPoints.filter((entry: string) => entry === 'coupled_prefix_reference').length, 1);
  assert.equal(coverage.fullV6Parity, false);
  assert.ok(coverage.nativeCallerExtensions.includes('native_crossed_prefix_assignment_bounds'));
  assert.ok(coverage.nativeCallerExtensions.includes('native_atomic_crossed_prefix_event_validation'));
});
