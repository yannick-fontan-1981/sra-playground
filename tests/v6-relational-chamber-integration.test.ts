import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { RelationalChamberMemory } from '../src/logos-engine/v6-relational-chamber-access.ts';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { AuxiliarySupportMemory } from '../src/logos-engine/v6-auxiliary-support.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const load = async (name: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL('./fixtures/' + name, import.meta.url))).toString());
const source = await load('v6-relational-chamber-parity.json.gz');
const pair = await load('v6-coupled-pair-planning-reference.json.gz');
const panel = await load('v6-panel-service-parity.json.gz');
const copy = <T>(value: T): T => structuredClone(value);
const stateId = 'family_state:public_occurrence_recall';

function empty(): SharedSeriesConstraint { return new SharedSeriesConstraint(pair.policy.recall); }
function seeded(events: R[]): SharedSeriesConstraint {
  const family = empty();
  for (const event of events) {
    if (event.kind === 'observed_chamber_relations') family.chamber.applyEvent(copy(event));
    else if (event.kind === 'observed_panel_service') family.panel.applyEvent(copy(event));
    else family.pairs.applyEvent(copy(event));
    family.events.push(copy(event));
  }
  family.restore(family.state());
  return family;
}
const chamberEvent = (): R => ({ kind: 'observed_chamber_relations',
  memory: { rows: { measured: { '["left"]': { value: '0', evidence: ['before', 'after'] } } },
    edges: {}, evidence: ['before', 'after'], conflicts: [], failed: [], boundaries: [] },
  detail: { before: 'before', after: 'after', command: { action_ref: 'ACTION6', data: { x: 2, y: 3 } } } });
const panelEvent = (): R => ({ kind: 'observed_panel_service',
  memory: { symbols: [], evidence: ['panel'], selection_observed: true, effects: [], failed: [] }, detail: {} });

test('historical pair and Panel checkpoints remain restorable after chamber acquisition', () => {
  const legacy = seeded([...pair.states.small.events, panelEvent()]).state();
  const family = seeded([...legacy.events, chamberEvent()]);
  assert.notEqual(family.state().digest, legacy.digest);
  assert.equal(family.chamber.eventCount, 1);
  family.restoreNative(legacy);
  assert.deepEqual(family.state(), legacy);
  assert.equal(family.chamber.eventCount, 0);
  assert.equal(family.panel.eventCount, 1);
  assert.deepEqual(family.pairs.currentState(), seeded(pair.states.small.events).pairs.currentState());
});

test('chamber checkpoint crosses Kernel once and keeps the common restoration certificate', async context => {
  const family = seeded([panelEvent(), chamberEvent()]);
  const store = new NativeKnowledgeStore('shared-native-chamber', 'restore-proof');
  await store.commit([{ id: stateId, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.chamber', step: 'checkpoint', statement: 'retain' });
  let reductions = 0;
  const original = RelationalChamberMemory.prototype.applyEvent;
  context.mock.method(RelationalChamberMemory.prototype, 'applyEvent', function (this: RelationalChamberMemory, event: R) {
    reductions++; original.call(this, event);
  });
  family.restoreNative(store.stateValue(stateId) as R);
  assert.equal(reductions, 1);
  reductions = 0; family.restoreNative(store.stateValue(stateId) as R);
  assert.equal(reductions, 0);
  const checkpoint = family.nativeState(), external = family.chamber.currentState();
  external.relation_memory.evidence.push('external'); external.relation_events.pop();
  assert.equal(family.nativeState(), checkpoint);
  assert.equal(family.chamber.eventCount, 1);
  assert.equal(family.panel.eventCount, 1);
});

test('direct chamber changes invalidate restoration reuse and all layers recover atomically', context => {
  const mutations: [string, (family: SharedSeriesConstraint) => void][] = [
    ['reducer', family => family.chamber.applyEvent(chamberEvent())],
    ['layer', family => { family.chamber = new RelationalChamberMemory(); }],
    ['memory', family => { (family.chamber as R).relationMemory = { ...family.chamber.currentState().relation_memory, evidence: ['unacquired'] }; }],
    ['journal', family => { (family.chamber as R).relationEvents.push(chamberEvent()); }],
  ];
  let reductions = 0;
  const original = RelationalChamberMemory.prototype.applyEvent;
  context.mock.method(RelationalChamberMemory.prototype, 'applyEvent', function (this: RelationalChamberMemory, event: R) {
    reductions++; original.call(this, event);
  });
  for (const [label, mutate] of mutations) {
    const family = seeded([panelEvent(), chamberEvent()]), checkpoint = family.nativeState();
    family.restoreNative(checkpoint); mutate(family); reductions = 0;
    family.restoreNative(checkpoint);
    assert.equal(reductions, 1, label); assert.deepEqual(family.state(), checkpoint, label);
  }
  const family = seeded([panelEvent(), chamberEvent()]), trusted = family.nativeState();
  family.restoreNative(trusted);
  const chamber = family.chamber, panelLayer = family.panel;
  for (const mutate of [
    (value: R) => { value.events.at(-1).memory.rows.measured['["left"]'].value = '1'; },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).memory; },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const invalid = copy(trusted); mutate(invalid);
    assert.throws(() => family.restoreNative(invalid));
    assert.equal(family.chamber, chamber); assert.equal(family.panel, panelLayer);
    assert.deepEqual(family.state(), trusted);
    reductions = 0; family.restoreNative(trusted); assert.equal(reductions, 0);
  }
});

test('a chamber event outside the common journal cannot certify a new checkpoint', () => {
  const family = seeded([chamberEvent()]), trusted = family.nativeState();
  family.chamber.applyEvent(chamberEvent());
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  family.restoreNative(trusted); assert.deepEqual(family.state(), trusted);
});

for (const item of source.commons as R[]) test(`common chamber envelope matches source ${item.id}`, async () => {
  const family = seeded(item.seedEvents), args = item.arguments, checkpoint = family.nativeState();
  const propose = () => family.observedPropose(args.obs, args.rows, args.inputs, args.remaining, args.config, args.levelDeadline);
  if (item.error) await assert.rejects(propose, { message: item.error.message });
  else {
    const result = await propose(); assert.deepEqual(result, item.unboundProposal);
    if (result?.status === 'proposed') family.bind(result, new ObservedInputDomain(256));
    assert.deepEqual(result, item.proposal);
  }
  assert.equal(family.nativeState(), checkpoint, 'Proposing does not acquire a relation');
});

test('chamber guards precede ancestors and Panel retains its source priority', () => {
  const family = empty();
  for (const item of source.guards as R[]) {
    if (item.error) continue;
    const a = item.arguments, proposal = { ...copy(a.proposal), panel_service_plan: {},
      support_preparation_plan: { unexpected: true }, graph_access_plan: { unexpected: true } };
    const actual = item.operation === 'before'
      ? family.before(proposal, a.index, { frame_rows: a.rows, level: a.meta.epoch,
        levels_completed: a.meta.score, available_action_refs: a.meta.available } as NativePublicObservation,
      { observation_ref: a.meta.observation_ref })
      : family.after(proposal, a.index, {}, { level_epoch: a.meta.epoch, levels_completed: a.meta.score, state: a.meta.state }, a.rows, a.later);
    assert.deepEqual(actual, item.expected, item.id);
  }
  for (const item of panel.guards as R[]) {
    const a = item.arguments, proposal = { ...copy(a.proposal), chamber_relation_plan: { unexpected: true } };
    const actual = item.operation === 'before'
      ? family.before(proposal, a.index, { frame_rows: a.rows, level: a.meta.epoch,
        levels_completed: a.meta.score, available_action_refs: a.meta.available } as NativePublicObservation,
      { observation_ref: a.meta.observation_ref })
      : family.after(proposal, a.index, {}, { level_epoch: a.meta.epoch, levels_completed: a.meta.score, state: a.meta.state }, a.rows, a.later);
    assert.deepEqual(actual, item.expected, item.id);
  }
  const first = source.commons.find((item: R) => item.proposal?.status === 'proposed');
  const proposal = copy(first.unboundProposal); proposal.chamber_relation_plan = {};
  family.bind(proposal, new ObservedInputDomain(256));
  assert.deepEqual(proposal.steps[0].point_binding, proposal.steps[0].point_support);
  assert.deepEqual(family.before(proposal, 0, { frame_rows: first.arguments.rows,
    level: first.arguments.obs.level_epoch, levels_completed: first.arguments.obs.levels_completed,
    available_action_refs: first.arguments.obs.available_action_refs } as NativePublicObservation, first.arguments.obs),
  { admitted: false, reason: 'relation_binding_changed' });
});

test('shared acquisition invokes each inherited reducer once and owns one chamber event', context => {
  const item = source.cases.find((item: R) => item.operation === 'record' && !item.error);
  assert.ok(item, 'A source-recorded actual or controlled response is required');
  const a = item.arguments, family = seeded(item.seedEvents ?? []), counts = { pair: 0, support: 0, chamber: 0, panel: 0 };
  for (const [name, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['support', AuxiliarySupportMemory.prototype],
    ['chamber', RelationalChamberMemory.prototype], ['panel', PanelServiceMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      counts[name]++; return (original as (...v: any[]) => R[]).apply(this, values);
    });
  }
  const result = family.record(a.before, a.after, a.command, a.rows, a.later, a.proposal, a.index, [a.later]);
  assert.deepEqual(counts, { pair: 1, support: 1, chamber: 1, panel: 1 });
  assert.deepEqual(result.events.filter((event: R) => event.kind === 'observed_chamber_relations'), item.expected);
  assert.equal(family.chamber.eventCount, (item.seedEvents ?? []).length + 1);
  const restored = empty(); restored.restore(family.state());
  assert.deepEqual(restored.state(), family.state());
  assert.deepEqual(restored.chamber.currentState(), family.chamber.currentState());
});
