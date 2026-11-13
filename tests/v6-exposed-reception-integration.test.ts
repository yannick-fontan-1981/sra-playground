import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ExposedReceptionMemory } from '../src/logos-engine/v6-exposed-reception-access.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { AuxiliarySupportMemory } from '../src/logos-engine/v6-auxiliary-support.ts';
import { RelationalChamberMemory } from '../src/logos-engine/v6-relational-chamber-access.ts';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { receptionRaster } from './helpers/v6-exposed-reception-raster.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-exposed-reception-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-exposed-reception-parity.json.gz', import.meta.url))).toString());
const strategy = JSON.parse(await readFile(new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', import.meta.url), 'utf8'));
const config = strategy.declarations[0].configuration.observed_composition_services;
const copy = <T>(value: T): T => structuredClone(value);
const stateId = 'family_state:public_occurrence_recall';
function empty(): SharedSeriesConstraint { return new SharedSeriesConstraint(legacy.policy); }
function event(): R { return { kind: 'observed_exposed_reception',
  state: { epoch: 1, layout: 'measured-layout', evidence: ['before', 'after'], probed: [], dial_tried: [] },
  controls: { ACTION4: { delta: [1, 0], evidence: ['before', 'after'] } },
  models: { coupled: {}, attached: {}, color_edges: [], repulsion: {} },
  detail: { command: { action_ref: 'ACTION4' }, before: 'before', after: 'after' } }; }
function acquired(): SharedSeriesConstraint {
  const family = empty(); family.restore(copy(legacy.cases.find((x: R) => x.id === 'combined').state));
  const own = event(); family.exposed.applyEvent(own); family.events.push(own);
  family.restore(family.state()); return family;
}
function sourceSeeded(events: R[]): SharedSeriesConstraint {
  const family = empty();
  for (const value of copy(events)) {
    assert.equal(value.kind, 'observed_exposed_reception');
    family.exposed.applyEvent(value); family.events.push(value);
  }
  family.restore(family.state()); return family;
}

for (const value of legacy.cases as R[]) test(`published0.42 checkpoint remains exact after adding Exposed: ${value.id}`, () => {
  const family = acquired();
  family.restoreNative(copy(value.state));
  assert.deepEqual(family.state(), value.state);
  assert.equal(family.exposed.eventCount, 0);
  const checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  assert.equal(family.nativeState(), checkpoint);
});

test('exposed state crosses Kernel once, is detached publicly and reuses only its certified owner', async context => {
  const family = acquired(), store = new NativeKnowledgeStore('shared-exposed-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.exposed', step: 'checkpoint', statement: 'retain' });
  let reductions = 0; const original = ExposedReceptionMemory.prototype.applyEvent;
  context.mock.method(ExposedReceptionMemory.prototype, 'applyEvent', function (this: ExposedReceptionMemory, value: R) {
    reductions++; original.call(this, value);
  });
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 1);
  const owner = family.exposed; reductions = 0;
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 0); assert.equal(family.exposed, owner);
  const checkpoint = family.nativeState(), external = family.exposed.currentState();
  external.reception_controls.ACTION4.delta[0] = 9; external.reception_events.pop();
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.exposed.eventCount, 1);
  assert.deepEqual(family.exposed.currentState().reception_controls.ACTION4.delta, [1, 0]);
});

test('exposed owner edits and replacement invalidate reuse without weakening atomic rejection', context => {
  const mutations: [string, (family: SharedSeriesConstraint) => void][] = [
    ['reducer', family => family.exposed.applyEvent(event())],
    ['replacement', family => { const next = new ExposedReceptionMemory(); next.applyEvent(event()); family.exposed = next; }],
    ['state', family => { (family.exposed as R).receptionState = { ...family.exposed.currentState().reception_state, evidence: ['foreign'] }; }],
    ['controls', family => { (family.exposed as R).receptionControls = { ACTION4: { delta: [-1, 0] } }; }],
    ['journal', family => { (family.exposed as R).receptionEvents.push(event()); }],
  ];
  let reductions = 0; const original = ExposedReceptionMemory.prototype.applyEvent;
  context.mock.method(ExposedReceptionMemory.prototype, 'applyEvent', function (this: ExposedReceptionMemory, value: R) {
    reductions++; original.call(this, value);
  });
  for (const [name, mutate] of mutations) {
    const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
    mutate(family); reductions = 0; family.restoreNative(checkpoint);
    assert.equal(reductions, 1, name); assert.deepEqual(family.state(), checkpoint, name);
  }
  const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  const owners = [family.exposed, family.chamber, family.panel, family.pairs];
  for (const mutate of [
    (value: R) => { value.events.at(-1).controls.ACTION4.delta[0] = -1; },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).models; },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => family.restoreNative(bad));
    assert.deepEqual([family.exposed, family.chamber, family.panel, family.pairs], owners);
    assert.deepEqual(family.state(), checkpoint);
  }
});

test('own events cannot escape the common journal or alias the future reception service owner', () => {
  const family = acquired(), checkpoint = family.nativeState();
  family.exposed.applyEvent(event());
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  family.restoreNative(checkpoint); assert.deepEqual(family.state(), checkpoint);
  assert.throws(() => family.exposed.applyEvent({ kind: 'observed_reception_service', state: {} }), /Outside exposed reception/);
  assert.deepEqual(family.state(), checkpoint);
});

const rows = receptionRaster();
const observation: R = { level_epoch: 1, levels_completed: 0, observation_ref: 'synthetic:before',
  frame_hash: symbolicDigest(rows).slice(0, 16), state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'] };
const packet = { frame_rows: rows, level: 1, levels_completed: 0, available_action_refs: observation.available_action_refs } as NativePublicObservation;

test('the common entry emits and binds an Exposed proposal without acquiring future effects', async () => {
  const family = empty(), checkpoint = family.nativeState();
  const proposal = await family.observedPropose(observation, rows, [], 16, config, 1e12, () => 0);
  assert.equal(proposal?.status, 'proposed'); assert.ok(proposal?.exposed_reception_plan);
  assert.equal(proposal?.field_subquestion, 'observed_composition_services');
  family.bind(proposal!, new ObservedInputDomain(256));
  assert.equal(family.before(proposal!, 0, packet, observation).admitted, true);
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.exposed.eventCount, 0);
  const edited = copy(proposal!); edited.actions[0].action_ref = 'ACTION5';
  assert.equal(family.before(edited, 0, packet, observation).admitted, false);
  assert.equal(family.before(proposal!, 0, packet, { ...observation, observation_ref: 'different' }).admitted, false);
});

test('the shared adapter preserves an incomplete reception computation and its current deadline', async () => {
  const family = empty();
  const expired = await family.observedPropose(observation, rows, [], 16, config, 10, () => 11);
  assert.equal(expired?.status, 'unknown'); assert.equal(expired?.block_unrelated_probe, true);
  assert.equal(expired?.reason, 'reception_computation_incomplete');
  assert.equal(family.exposed.eventCount, 0);
  assert.equal(await family.observedPropose(observation, rows, [], 0, config, 10, () => 11), null);
});

for (const value of source.commons as R[]) test(`common exposed envelope and binding match unchanged source: ${value.id}`, async () => {
  const family = sourceSeeded(value.seedEvents), a = value.arguments, checkpoint = family.nativeState();
  const propose = () => family.observedPropose(a.obs, a.rows, a.inputs, a.remaining, a.config, a.levelDeadline);
  if (value.error) await assert.rejects(propose, { message: value.error.message });
  else {
    const result = await propose(); assert.deepEqual(result, value.unboundProposal);
    if (result?.status === 'proposed') family.bind(result, new ObservedInputDomain(256));
    assert.deepEqual(result, value.proposal);
  }
  assert.equal(family.nativeState(), checkpoint, 'A proposition cannot acquire a future response');
});

test('exposed guard dispatch precedes Coupled and Auxiliary inherited envelopes', () => {
  const family = empty();
  for (const value of source.guards as R[]) {
    if (value.error) continue;
    const a = value.arguments, proposal = { ...copy(a.proposal), panel_service_plan: {},
      support_preparation_plan: { unexpected: true }, pair_access_plan: { unexpected: true } };
    const actual = value.operation === 'before'
      ? family.before(proposal, a.index, { frame_rows: a.rows, level: a.meta.epoch,
        levels_completed: a.meta.score, available_action_refs: a.meta.available } as NativePublicObservation,
      { observation_ref: a.meta.observation_ref })
      : family.after(proposal, a.index, {}, { level_epoch: a.meta.epoch, levels_completed: a.meta.score, state: a.meta.state }, a.rows, a.later);
    assert.deepEqual(actual, value.expected, value.id);
  }
});

test('common acquisition follows source layer order once and restores exact exposed effects', context => {
  const value = source.cases.find((item: R) => item.id === 'record:unit_control');
  const a = value.arguments, family = sourceSeeded(value.seedEvents), order: string[] = [];
  for (const [name, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['support', AuxiliarySupportMemory.prototype],
    ['exposed', ExposedReceptionMemory.prototype], ['chamber', RelationalChamberMemory.prototype], ['panel', PanelServiceMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      order.push(name); return (original as (...v: any[]) => R[]).apply(this, values);
    });
  }
  const result = family.record(a.before, a.after, a.command, a.rows, a.later, a.proposal, a.index, [a.later]);
  assert.deepEqual(order, ['pair', 'support', 'exposed', 'chamber', 'panel']);
  assert.deepEqual(result.events.filter((e: R) => e.kind === 'observed_exposed_reception'), value.expected);
  assert.equal(family.exposed.eventCount, value.seedEvents.length + 1);
  const restored = empty(); restored.restore(family.state());
  assert.deepEqual(restored.state(), family.state());
  assert.deepEqual(restored.exposed.currentState(), family.exposed.currentState());
  result.events.find((e: R) => e.kind === 'observed_exposed_reception').controls[a.command.action_ref].delta[0] = 99;
  assert.deepEqual(restored.exposed.currentState(), family.exposed.currentState(), 'Returned event cannot edit retained ownership');
});
