import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { FramedWindowMemory } from '../src/logos-engine/v6-framed-window-access.ts';
import { RootedQuotaMemory } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { OccludedCatalogueMemory } from '../src/logos-engine/v6-occluded-catalogue-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-framed-window-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-framed-window-reference.json.gz', import.meta.url))).toString());
const original = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', original), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', original), 'utf8')),
};
const copy = <T>(value: T): T => structuredClone(value);
const fresh = (): SharedSeriesConstraint => new SharedSeriesConstraint(legacy.policy);
const stateId = 'family_state:public_occurrence_recall';
const event = (): R => ({ kind: 'framed_window_response', trial_key: 'actual-observed-trial', epoch: 1, after_epoch: 1,
  evidence: ['before', 'after'], reference_box: [2, 2, 5, 5], window: [1, 2], point: [12, 15],
  command: { action_ref: 'ACTION6', data: { x: 12, y: 15 } }, official_progress: false,
  canonical_changed: false, scope: 'One actual point outcome; no universal reference, transport, or acceptance law inferred.' });
function acquired(): SharedSeriesConstraint {
  const owner = fresh(); owner.restore(copy(legacy.cases.find((item: R) => item.id === 'combined').state));
  const value = event(); owner.framedWindow.applyEvent(value); owner.events.push(value);
  owner.restore(owner.state()); return owner;
}

for (const item of legacy.cases as R[]) test(`actual published 0.47 checkpoint survives an empty framed-window layer: ${item.id}`, () => {
  const owner = acquired(); owner.restoreNative(copy(item.state));
  assert.deepEqual(owner.state(), item.state);
  assert.equal(owner.framedWindow.eventCount, 0);
  const checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  assert.equal(owner.nativeState(), checkpoint);
});

test('framed-window knowledge crosses the Kernel with detached exports and certified replay', async context => {
  const owner = acquired(), store = new NativeKnowledgeStore('framed-window-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: owner.id, value: owner.nativeState() }],
    { workflow: 'test.framed_window', step: 'checkpoint', statement: 'retain actual response' });
  const original = FramedWindowMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(FramedWindowMemory.prototype, 'applyEvent', function (this: FramedWindowMemory, value: R) {
    reductions++; original.call(this, value);
  });
  owner.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 1);
  const memory = owner.framedWindow; reductions = 0;
  owner.restoreNative(store.stateValue(stateId) as R);
  assert.equal(reductions, 0); assert.equal(owner.framedWindow, memory);
  const exported = memory.currentState(), checkpoint = owner.nativeState();
  exported.window_events[0]!.evidence.push('foreign'); exported.window_blocked.pop();
  assert.deepEqual(memory.currentState().window_blocked, ['actual-observed-trial']);
  assert.deepEqual(memory.currentState().window_events[0]!.evidence, ['before', 'after']);
  assert.equal(owner.nativeState(), checkpoint);
});

test('owner replacement, private state edits and reducer revisions invalidate framed-window reuse', context => {
  const mutations: [string, (owner: SharedSeriesConstraint) => void][] = [
    ['reducer', owner => owner.framedWindow.applyEvent(event())],
    ['replacement', owner => { const next = new FramedWindowMemory(); next.applyEvent(event()); owner.framedWindow = next; }],
    ['events', owner => { (owner.framedWindow as R).events.push(event()); }],
    ['blocked', owner => { (owner.framedWindow as R).blocked = ['different']; }],
  ];
  const original = FramedWindowMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(FramedWindowMemory.prototype, 'applyEvent', function (this: FramedWindowMemory, value: R) {
    reductions++; original.call(this, value);
  });
  for (const [name, mutate] of mutations) {
    const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
    mutate(owner); reductions = 0; owner.restoreNative(checkpoint);
    assert.equal(reductions, 1, name); assert.deepEqual(owner.state(), checkpoint, name);
  }
});

test('invalid framed-window restores preserve all acquired owners atomically', () => {
  const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  const identities = [owner.memory, owner.rooted, owner.framedWindow, owner.catalogue, owner.population, owner.reception];
  for (const mutate of [
    (value: R) => { value.events.at(-1).trial_key = 'forged'; },
    (value: R) => { delete value.events.at(-1).official_progress; },
    (value: R) => { value.events.pop(); },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => owner.restoreNative(bad));
    for (const [i, current] of [owner.memory, owner.rooted, owner.framedWindow, owner.catalogue, owner.population, owner.reception].entries()) {
      assert.equal(current, identities[i], 'Rejected recall must preserve existing owner identity');
    }
    assert.deepEqual(owner.state(), checkpoint);
  }
});

test('framed-window owner remains separate from nonempty Population and Reception knowledge', () => {
  const owner = acquired(), checkpoint = owner.nativeState(), population = owner.population.currentState(), reception = owner.reception.currentState();
  const restored = fresh(); restored.restore(checkpoint);
  assert.equal(restored.framedWindow.eventCount, 1); assert.equal(restored.population.eventCount, 1); assert.equal(restored.reception.eventCount, 1);
  assert.deepEqual(restored.population.currentState(), population); assert.deepEqual(restored.reception.currentState(), reception);
  assert.throws(() => owner.framedWindow.applyEvent(population.population_events[0]), /Outside framed-window/);
  owner.framedWindow.applyEvent(event());
  assert.throws(() => owner.restoreNative(owner.nativeState()), /Shared series memory changed/);
  owner.restoreNative(checkpoint); assert.deepEqual(owner.state(), checkpoint);
});

test('framed-window entry retains its original DRM position and shared owner', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), coverage = runtime.snapshot().coverage as R;
  const group = coverage.sourceGroups.find((item: R) => item.id === 'window_constraints');
  const index = group.entryPoints.indexOf('framed_window_composition');
  assert.equal(index, group.entryPoints.indexOf('rooted_quota_composition') + 1);
  assert.equal(group.families[index], 'public_occurrence_recall');
  assert.equal(group.entryPoints.filter((entry: string) => entry === 'framed_window_composition').length, 1);
  assert.equal(coverage.fullV6Parity, false);
  assert.ok(coverage.nativeCallerExtensions.includes('native_temporal_fragment_interrupted_pixel_frontier'));
  assert.ok(coverage.nativeCallerExtensions.includes('atomic_framed_window_response_validation'));
});

test('common framed-window proposal is source-exact and current point authority is revalidated', async () => {
  const c = source.cases.find((item: R) => item.id === 'common:fresh'), a = c.arguments;
  const owner = fresh(), beforeState = owner.nativeState();
  const proposal = await owner.framedWindowPropose(a.observation, a.rows, a.inputs, a.remaining, a.config, a.deadlineMs, () => a.nowMs);
  assert.deepEqual(proposal, c.expected); assert.equal(owner.nativeState(), beforeState);
  const domain = new ObservedInputDomain(4096); domain.candidates(a.observation as NativeObservation);
  owner.bind(proposal!, domain);
  const packet = { frame_rows: a.rows, level: a.observation.level_epoch, levels_completed: a.observation.levels_completed,
    available_action_refs: a.observation.available_action_refs } as NativePublicObservation;
  assert.equal(owner.before(proposal!, 0, packet, a.observation).admitted, true);
  const changed = copy(proposal!); changed.actions[0].data.x++;
  assert.throws(() => owner.bind(changed, domain), /point payload changed/);
  assert.equal(owner.before(changed, 0, packet, a.observation).admitted, false);
  assert.equal(owner.before(proposal!, 0, packet, { ...a.observation, observation_ref: 'foreign' }).admitted, false);
  assert.throws(() => owner.bind(proposal!, new ObservedInputDomain(4096)), /not currently observed/);
  const mixed = { ...copy(proposal!), rooted_quota_plan: { unexpected: true } };
  assert.deepEqual(owner.before(mixed, 0, packet, a.observation), owner.before(proposal!, 0, packet, a.observation));
});

test('actual no-progress return is acquired once between RootedQuota and Catalogue and changes the next question', async context => {
  const c = source.cases.find((item: R) => item.id === 'record:no_progress'), a = c.arguments;
  const freshCase = source.cases.find((item: R) => item.id === 'common:fresh').arguments;
  const owner = fresh(), calls: string[] = [];
  for (const [name, prototype] of [['rooted', RootedQuotaMemory.prototype], ['framed', FramedWindowMemory.prototype], ['catalogue', OccludedCatalogueMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      calls.push(name); return (original as (...values: any[]) => R[]).apply(this, values);
    });
  }
  const proposal = await owner.framedWindowPropose(freshCase.observation, freshCase.rows, freshCase.inputs, freshCase.remaining,
    freshCase.config, freshCase.deadlineMs, () => freshCase.nowMs);
  assert.ok(proposal?.framed_window_plan);
  const result = owner.record(a.before, a.after, a.command, a.rows, a.later, proposal!, a.index, [a.rows]);
  assert.deepEqual(calls, ['rooted', 'framed', 'catalogue']);
  const own = result.events.filter((value: R) => value.kind === 'framed_window_response');
  assert.deepEqual(own, c.expectedOwnEvents); assert.equal(owner.framedWindow.eventCount, 1);
  const restored = fresh(); restored.restore(owner.nativeState());
  assert.deepEqual(restored.framedWindow.currentState(), owner.framedWindow.currentState());
  const next = (family: SharedSeriesConstraint) => family.framedWindowPropose(a.after, a.later, freshCase.inputs, freshCase.remaining,
    freshCase.config, freshCase.deadlineMs, () => freshCase.nowMs);
  assert.equal(await next(owner), null); assert.equal(await next(restored), null);
  assert.ok((await next(fresh()))?.framed_window_plan, 'Removing the acquired negative return changes the next decision');
  own[0]!.evidence.push('foreign mutation');
  assert.deepEqual(restored.framedWindow.currentState(), owner.framedWindow.currentState());
});
