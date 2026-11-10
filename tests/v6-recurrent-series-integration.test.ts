import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint, createNativeSharedSeriesFamily } from '../src/logos-engine/v6-shared-series.ts';
import { RecurrentSeriesMemory } from '../src/logos-engine/v6-recurrent-series-access.ts';
import { CrossedPrefixMemory } from '../src/logos-engine/v6-crossed-prefix-access.ts';
import { OccurrenceRecallAccess, OccurrenceRecallConstraint } from '../src/logos-engine/v6-occurrence-recall.ts';
import { RootedQuotaMemory } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { FramedWindowMemory } from '../src/logos-engine/v6-framed-window-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-recurrent-series-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-recurrent-series-reference.json.gz', import.meta.url))).toString());
const crossed = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-crossed-prefix-reference.json.gz', import.meta.url))).toString());
const original = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', original), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', original), 'utf8')),
};
const copy = <T>(value: T): T => structuredClone(value);
const fresh = (): SharedSeriesConstraint => new SharedSeriesConstraint(legacy.policy);
const own = (events: R[]): R[] => events.filter(event => /^(repeated_line_|supported_)/.test(event.kind));
const stateId = 'family_state:public_occurrence_recall';
const packet = (rows: number[][], observation: R): NativePublicObservation => ({ frame_rows: rows,
  level: observation.level_epoch, levels_completed: observation.levels_completed,
  available_action_refs: observation.available_action_refs, state: observation.state } as NativePublicObservation);
function seed(owner: SharedSeriesConstraint, events: R[]): void {
  for (const event of copy(events)) {
    if (event.kind === 'coupled_pair_epoch_anchor' || event.kind === 'coupled_pair_evidence') owner.pairs.applyEvent(event);
    else owner.memory.applyEvent(event);
    owner.events.push(event);
  }
}
function acquired(): SharedSeriesConstraint {
  const owner = fresh(); owner.restore(copy(legacy.cases.find((item: R) => item.id === 'combined_with_series').state)); return owner;
}
function sourceProjection(state: R): R {
  const { digest: _digest, repeated_digest: _repeated, ...projection } = state; return projection;
}

test('legacy checkpoints and generator are rooted in the published native 0.49 checkout', async () => {
  assert.equal(legacy.source.siteVersion, 78);
  assert.equal(legacy.source.commit, '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f');
  assert.equal(legacy.source.nativeDigest, 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054');
  assert.equal(legacy.source.fileCount, 268); assert.equal(legacy.source.unchanged, true);
  assert.equal(legacy.cases.length, 19);
  assert.equal(createHash('sha256').update(await readFile(new URL('../' + legacy.generator.path, import.meta.url))).digest('hex'), legacy.generator.sha256);
  assert.deepEqual(legacy.sparseEvents.map((event: R) => event.kind), ['repeated_line_trial', 'repeated_line_scored',
    'supported_insertion_observation', 'supported_insertion_order', 'supported_line_refutation']);
});

for (const item of legacy.cases as R[]) test(`actual published 0.49 checkpoint keeps both original series digest slots: ${item.id}`, () => {
  const owner = acquired(); owner.restoreNative(copy(item.state));
  assert.deepEqual(owner.state(), item.state);
  assert.equal(owner.recurrentSeries, owner.memory.recurrentSeries);
  assert.equal(owner.recurrentSeries.eventCount, own(item.state.events).length);
  for (const key of ['lineTrials', 'lineGoals', 'insertSamples', 'insertOrders', 'insertRejections', 'insertRefutedEpochs']) {
    assert.equal((owner.memory as R)[key], (owner.recurrentSeries as R)[key], 'Historical projection aliases one authoritative owner: ' + key);
    assert.equal(Object.hasOwn(owner.memory, key), false, 'No second own reducer projection: ' + key);
  }
  const checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  assert.equal(owner.nativeState(), checkpoint);
});

test('sparse historical events remain opaque instead of acquiring invented planning dependencies', () => {
  const owner = fresh(), state = legacy.cases.find((item: R) => item.id === 'legacy_series').state;
  owner.restore(copy(state));
  assert.deepEqual(owner.recurrentSeries.lineTrials.trial, { kind: 'repeated_line_trial', trial: 'trial', epoch: 1 });
  assert.deepEqual(owner.recurrentSeries.lineGoals, [{ kind: 'repeated_line_scored', epoch: 1 }]);
  assert.deepEqual(owner.recurrentSeries.insertSamples, [{ kind: 'supported_insertion_observation', source: 'source', epoch: 1 }]);
  assert.deepEqual(owner.recurrentSeries.insertOrders, { source: { kind: 'supported_insertion_order', source: 'source', epoch: 1 } });
  assert.deepEqual(owner.state(), state);
});

test('shared legacy UTF-16 digest ordering remains distinct from source Unicode ordering for opaque keys', () => {
  const owner = fresh(), state = legacy.cases.find((item: R) => item.id === 'opaque_unicode_rejections').state;
  owner.restore(copy(state));
  assert.deepEqual(owner.recurrentSeries.currentState().insert_rejections, ['\uE000', '\u{10000}']);
  assert.deepEqual(owner.state(), state, 'Historical shared checkpoint identity keeps its published ordering');
});

test('single recurrent owner crosses Kernel persistence with detached exports and certified reuse', async context => {
  const owner = acquired(), count = owner.recurrentSeries.eventCount;
  assert.equal(count, 5);
  const store = new NativeKnowledgeStore('recurrent-series-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: owner.id, value: owner.nativeState() }],
    { workflow: 'test.recurrent_series', step: 'checkpoint', statement: 'retain public line and insertion evidence' });
  const originalApply = RecurrentSeriesMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(RecurrentSeriesMemory.prototype, 'applyEvent', function (this: RecurrentSeriesMemory, event: R) {
    reductions++; originalApply.call(this, event);
  });
  owner.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, count);
  const memory = owner.recurrentSeries; reductions = 0;
  owner.restoreNative(store.stateValue(stateId) as R);
  assert.equal(reductions, 0); assert.equal(owner.recurrentSeries, memory);
  const exported = memory.currentState(), checkpoint = owner.nativeState();
  exported.line_trials.trial.epoch = 99; exported.line_goals.pop(); exported.insert_samples.push({ foreign: true });
  exported.insert_orders.source.epoch = 99; exported.insert_rejections.push('foreign'); exported.insert_refuted_epochs.push(99);
  assert.equal(memory.eventCount, count); assert.equal(memory.lineTrials.trial.epoch, 1); assert.equal(memory.lineGoals.length, 1);
  assert.equal(memory.insertSamples.length, 1); assert.equal(memory.insertOrders.source.epoch, 1);
  assert.equal(memory.insertRejections.has('foreign'), false); assert.equal(memory.insertRefutedEpochs.has(99), false);
  assert.equal(owner.nativeState(), checkpoint);
});

test('owner replacement, reducer revisions and every direct historical projection edit invalidate reuse', context => {
  const extra = { kind: 'repeated_line_trial', trial: 'new-return' };
  const mutations: [string, (owner: SharedSeriesConstraint) => void][] = [
    ['reducer', owner => owner.recurrentSeries.applyEvent(extra)],
    ['replacement', owner => { const replacement = new RecurrentSeriesMemory();
      replacement.restore(owner.recurrentSeries.state()); (owner.memory as R).recurrentSeriesProjection = replacement; }],
    ['private journal', owner => { (owner.recurrentSeries as R).events.push(extra); }],
    ['line trials', owner => { owner.recurrentSeries.lineTrials.extra = extra; }],
    ['line goals', owner => { owner.recurrentSeries.lineGoals.push({ kind: 'repeated_line_scored' }); }],
    ['insertion samples', owner => { owner.recurrentSeries.insertSamples.push({ kind: 'supported_insertion_observation' }); }],
    ['insertion orders', owner => { owner.recurrentSeries.insertOrders.foreign = { kind: 'supported_insertion_order', source: 'foreign' }; }],
    ['rejections', owner => { owner.recurrentSeries.insertRejections.add('foreign'); }],
    ['refuted epochs', owner => { owner.recurrentSeries.insertRefutedEpochs.add(99); }],
    ['historical alias', owner => { owner.memory.lineTrials.extra = extra; }],
    ['historical replacement', owner => { owner.memory.insertOrders = {}; }],
  ];
  const originalApply = RecurrentSeriesMemory.prototype.applyEvent; let reductions = 0;
  context.mock.method(RecurrentSeriesMemory.prototype, 'applyEvent', function (this: RecurrentSeriesMemory, event: R) {
    reductions++; originalApply.call(this, event);
  });
  for (const [name, mutate] of mutations) {
    const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
    mutate(owner); reductions = 0; owner.restoreNative(checkpoint);
    assert.equal(reductions, 5, name); assert.deepEqual(owner.state(), checkpoint, name);
  }
});

test('failed recurrent restores preserve every acquired owner and accepted journal atomically', () => {
  const owner = acquired(), checkpoint = owner.nativeState(); owner.restoreNative(checkpoint);
  const owners = () => [owner.memory, owner.recurrentSeries, owner.crossedPrefix, owner.rooted, owner.framedWindow,
    owner.catalogue, owner.population, owner.reception];
  const identities = owners();
  for (const mutate of [
    (value: R) => { value.events.push({ kind: 'repeated_line_trial' }); },
    (value: R) => { value.events.at(-1).epoch = 99; },
    (value: R) => { value.events.pop(); },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => owner.restoreNative(bad));
    owners().forEach((current, index) => assert.equal(current, identities[index]));
    assert.deepEqual(owner.state(), checkpoint);
  }
});

test('higher occurrence guard dispatch remains authoritative over both recurrent plan keys', context => {
  const owner = fresh(), c = crossed.accessCases.find((item: R) => item.id === 'common_fresh');
  const mixed = { ...copy(c.expected), occurrence_recall_plan: { current: true },
    line_plan: { must_not_be_read: true }, supported_line_plan: { must_not_be_read: true } };
  context.mock.method(OccurrenceRecallConstraint.prototype, 'before', () => ({ admitted: false, reason: 'controlled_descendant_before' }));
  context.mock.method(OccurrenceRecallConstraint.prototype, 'after', () => ({ matched: false, seal_prefix: true, reason: 'controlled_descendant_after' }));
  assert.equal(owner.before(mixed, 0, packet(c.rows, c.observation), c.observation).reason, 'controlled_descendant_before');
  assert.equal(owner.after(mixed, 0, c.observation, c.observation, c.rows, c.rows).reason, 'controlled_descendant_after');
});

test('crossed guards and binding retain their prior behavior with lower recurrent plan keys', () => {
  const owner = fresh(), c = crossed.accessCases.find((item: R) => item.id === 'common_fresh');
  const original = copy(c.expected), mixed = { ...copy(c.expected), line_plan: { must_not_be_read: true }, supported_line_plan: { must_not_be_read: true } };
  assert.deepEqual(owner.before(mixed, 0, packet(c.rows, c.observation), c.observation),
    owner.before(original, 0, packet(c.rows, c.observation), c.observation));
  assert.deepEqual(owner.after(mixed, 0, c.observation, c.observation, c.rows, c.rows),
    owner.after(original, 0, c.observation, c.observation, c.rows, c.rows));
  const domain = new ObservedInputDomain(4096); domain.candidates(c.observation as NativeObservation);
  owner.bind(mixed, domain); owner.bind(original, domain);
  assert.deepEqual(mixed.steps, original.steps);
});

test('recurrent source entry has one shared provider while the measured strategy order is retained', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 }), coverage = runtime.snapshot().coverage as R;
  const group = coverage.sourceGroups.find((item: R) => item.id === 'window_constraints');
  const index = group.entryPoints.indexOf('recurrent_series');
  assert.ok(index >= 0); assert.equal(group.families[index], 'public_occurrence_recall');
  assert.equal(group.entryPoints.filter((entry: string) => entry === 'recurrent_series').length, 1);
  assert.ok(index > group.entryPoints.indexOf('coupled_prefix_reference'));
  assert.equal(coverage.fullV6Parity, false);
});

for (const id of ['adapter:supported_repeated', 'adapter:supported_preparation',
  'adapter:actual_observed_repeated', 'adapter:actual_observed_preparation']) {
  test(`the consumed common proposal and current binding match original source: ${id}`, async () => {
    const c = source.accessCases.find((item: R) => item.id === id), owner = fresh(); seed(owner, c.initialEvents);
    const retained = owner.nativeState();
    const proposal = await owner.recurrentSeriesPropose(c.observation, c.rows, c.inputs, c.remaining, c.config, 1000, () => 0);
    assert.deepEqual(proposal, c.expected); assert.equal(owner.nativeState(), retained, 'Planning does not acquire retained evidence');
    const domain = new ObservedInputDomain(1); domain.candidates(c.observation as NativeObservation);
    owner.bind(proposal!, domain);
    assert.equal(owner.before(proposal!, 0, packet(c.rows, c.observation), c.observation).admitted, true);
    assert.equal(owner.before(proposal!, 0, packet(c.rows, c.observation), { ...c.observation, observation_ref: 'foreign' }).admitted, false);
    assert.equal(owner.before(proposal!, 0, packet(c.rows, { ...c.observation, available_action_refs: ['ACTION1'] }), c.observation).admitted, false);
    assert.deepEqual(proposal!.steps[0].point_binding.point, proposal!.point_support.point);
    assert.throws(() => owner.bind(proposal!, new ObservedInputDomain(1)), /not been observed/);
    const changed = copy(proposal!); changed.actions[0].data.x++;
    assert.throws(() => owner.bind(changed, domain), /address changed/);
  });
}

test('Supported guard priority survives a mixed lower Repeated plan at the shared boundary', () => {
  const c = source.accessCases.find((item: R) => item.id === 'adapter:supported_preparation'), owner = fresh();
  const proposal = copy(c.expected), mixed = { ...copy(c.expected), line_plan: { must_not_be_read: true } };
  assert.deepEqual(owner.before(mixed, 0, packet(c.rows, c.observation), c.observation),
    owner.before(proposal, 0, packet(c.rows, c.observation), c.observation));
  assert.deepEqual(owner.after(mixed, 0, c.observation, c.observation, c.rows, c.rows),
    owner.after(proposal, 0, c.observation, c.observation, c.rows, c.rows));
});

test('the declared recurrent adapter consumes its own configuration and leaves other entry selection untouched', async () => {
  const c = source.accessCases.find((item: R) => item.id === 'adapter:supported_preparation'), owner = fresh(); seed(owner, c.initialEvents);
  const provider = createNativeSharedSeriesFamily(legacy.policy, undefined, undefined, undefined, {},
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, c.config);
  provider.restoreNative!(owner.nativeState());
  const before = provider.nativeState!();
  const actual = await provider.proposeInSubquestion!('window_constraints', 'recurrent_series', c.observation,
    c.rows, c.inputs, c.remaining, { deadlineMs: 1000, now: () => 0 });
  assert.deepEqual(actual, { ...c.expected, field_subquestion: 'recurrent_series' });
  assert.equal(provider.nativeState!(), before);
  for (const entry of ['coupled_prefix_reference', 'framed_window_composition', 'field_service_composition']) {
    assert.equal(await provider.proposeInSubquestion!('window_constraints', entry, c.observation,
      c.rows, c.inputs, c.remaining, { deadlineMs: 1000, now: () => 0 }), null, entry);
    assert.equal(provider.nativeState!(), before);
  }
});

for (const c of source.adapterCases.filter((item: R) => item.method === 'record' && item.wrapper === 'supported') as R[]) {
  test(`common passive acquisition and persistent packet order match the source: ${c.id}`, () => {
    const owner = fresh(); seed(owner, c.initialEvents); owner.restore(owner.state());
    const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, c.frames);
    assert.deepEqual(own(result.events), c.expected.events);
    assert.equal(result.status, c.expected.status);
    assert.deepEqual(owner.recurrentSeries.currentState(), sourceProjection(c.afterState));
    assert.deepEqual(owner.recurrentSeries.state(), c.snapshot);
    const checkpoint = owner.nativeState();
    own(result.events)[0]!.source = 'edited-returned-envelope';
    assert.equal(owner.nativeState(), checkpoint, 'Returned evidence envelopes are detached from acquired memory');
    const cold = fresh(); cold.restoreNative(checkpoint);
    assert.deepEqual(cold.recurrentSeries.state(), c.snapshot);
  });
}

const observedRecords = source.adapterCases.filter((item: R) => item.method === 'record' && item.wrapper === 'observed') as R[];
test('the actual Observed inherited record chain has independent source cases for both passive returns', () => {
  assert.equal(observedRecords.length, 2);
});
for (const c of observedRecords) {
  test(`actual Observed record preserves own and intervening inherited evidence: ${c.id}`, () => {
    const owner = fresh(); seed(owner, c.initialEvents);
    const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, c.frames);
    assert.deepEqual(own(result.events), c.expectedOwnEvents);
    assert.deepEqual(result.events, c.expected.events, 'This declared return has exact own and intervening coupled-pair source evidence');
    assert.deepEqual(result.events.filter((event: R) => !own([event]).length).map((event: R) => event.kind), c.parentKinds);
    assert.deepEqual(owner.recurrentSeries.currentState(), sourceProjection(c.expectedOwnState));
    const checkpoint = owner.nativeState(), cold = fresh(); cold.restoreNative(checkpoint);
    assert.deepEqual(cold.state(), checkpoint);
    assert.deepEqual(cold.recurrentSeries.currentState(), sourceProjection(c.expectedOwnState));
  });
}

test('acquisition precedes Crossed and Occurrence, while Rooted cuts only the inherited record chain', context => {
  const c = source.adapterCases.find((item: R) => item.id === 'adapter:passive_packet_0'), calls: string[] = [];
  for (const [name, prototype] of [['recurrent', RecurrentSeriesMemory.prototype], ['crossed', CrossedPrefixMemory.prototype],
    ['occurrence', OccurrenceRecallAccess.prototype], ['rooted', RootedQuotaMemory.prototype], ['framed', FramedWindowMemory.prototype]] as const) {
    const originalRecord = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...args: any[]): R[] {
      calls.push(name);
      if (name === 'rooted' && args[5]?.rooted_quota_plan) return [];
      return (originalRecord as (...values: any[]) => R[]).apply(this, args);
    });
  }
  const originalPacket = RecurrentSeriesMemory.prototype.recordPacket;
  context.mock.method(RecurrentSeriesMemory.prototype, 'recordPacket', function (this: RecurrentSeriesMemory, ...args: any[]): R[] {
    calls.push('packet'); return (originalPacket as (...values: any[]) => R[]).apply(this, args);
  });
  const owner = fresh(); seed(owner, c.initialEvents);
  const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, c.frames);
  assert.deepEqual(calls, ['recurrent', 'crossed', 'occurrence', 'rooted', 'framed', 'packet']);
  assert.deepEqual(own(result.events), c.expected.events);
  calls.length = 0;
  const cutoff = fresh(); seed(cutoff, [...c.initialEvents, c.expected.events[0]]);
  const cutResult = cutoff.record(c.before, c.after, c.command, c.rows, c.later,
    { rooted_quota_plan: { controlled_cutoff: true }, line_plan: { must_not_be_read: true } }, c.index, c.frames);
  assert.deepEqual(calls, ['rooted', 'framed', 'packet']);
  assert.deepEqual(own(cutResult.events), [c.expected.events[1]], 'The retained matching sample still consumes the complete public packet');
  assert.equal(cutoff.recurrentSeries.insertSamples.length, 1, 'The cutoff does not acquire a duplicate insertion observation');
});

test('shared repeated acquisition asks the complete current outcome dispatcher', context => {
  const c = source.recordCases.find((item: R) => item.id === 'repeated:matched'), owner = fresh(); seed(owner, c.initialEvents);
  let calls = 0;
  context.mock.method(owner, 'after', () => { calls++; return { matched: false, seal_prefix: true, reason: 'controlled_descendant_outcome' }; });
  const result = owner.record(c.before, c.after, c.command, c.rows, c.later, c.proposal, c.index, [c.later]);
  assert.equal(calls, 1); assert.equal(own(result.events)[0]!.result, 'refuted');
  assert.equal(owner.recurrentSeries.lineTrials[c.proposal.line_plan.trial].result, 'refuted');
});

test('a source-produced scored witness and two continuous ordered insertions survive cold shared checkpoints', async () => {
  const chain = source.chains.find((item: R) => item.id === 'scored_witness_then_ordered_passive_insertions');
  let owner = fresh();
  const first = chain.scoredTransition;
  const scored = owner.record(first.before, first.after, first.command, first.rows, first.later, first.proposal, first.index, [first.later]);
  assert.deepEqual(own(scored.events), first.expected);
  let checkpoint = owner.nativeState(); owner = fresh(); owner.restoreNative(checkpoint);
  for (const step of chain.steps as R[]) {
    const result = owner.record(step.before, step.after, step.command, step.rows, step.later, step.proposal, step.index, step.frames);
    assert.deepEqual(own(result.events), step.expected.events);
    assert.deepEqual(owner.recurrentSeries.currentState(), sourceProjection(step.afterState));
    checkpoint = owner.nativeState(); owner = fresh(); owner.restoreNative(checkpoint);
    assert.deepEqual(owner.recurrentSeries.state(), step.snapshot);
  }
  const c = source.accessCases.find((item: R) => item.id === 'adapter:actual_observed_preparation');
  assert.deepEqual(await owner.recurrentSeriesPropose(c.observation, c.rows, c.inputs, c.remaining, c.config, 1000, () => 0), c.expected);
  assert.deepEqual(owner.recurrentSeries.currentState(), sourceProjection(chain.finalState));
  assert.equal(owner.recurrentSeries.eventCount, chain.events.length);
});
