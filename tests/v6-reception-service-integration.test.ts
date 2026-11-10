import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ReceptionServiceMemory, freshReceptionServiceMemory } from '../src/logos-engine/v6-reception-service-access.ts';
import { ExposedReceptionMemory } from '../src/logos-engine/v6-exposed-reception-access.ts';
import { RootedLineMemory } from '../src/logos-engine/v6-rooted-line-access.ts';
import { RelationalChamberMemory } from '../src/logos-engine/v6-relational-chamber-access.ts';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { AuxiliarySupportMemory } from '../src/logos-engine/v6-auxiliary-support.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reception-service-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const stateId = 'family_state:public_occurrence_recall';
function empty(): SharedSeriesConstraint { return new SharedSeriesConstraint(legacy.policy); }
function event(): R {
  return { kind: 'observed_reception_service', memory: { ...freshReceptionServiceMemory(), epoch: 1,
    evidence: ['before', 'after'], trials: { ACTION1: 1 }, wait_spent: 3,
    controls: { ACTION1: { delta: [0, -4], evidence: ['before', 'after'], status: 'provisional_observed_control' } } },
  detail: { command: { action_ref: 'ACTION1' }, before: 'before', after: 'after', boundary: false,
    kind: 'control_probe', matched: null, carrier_delta: [0, -4] } };
}
function acquired(): SharedSeriesConstraint {
  const family = empty(); family.restore(copy(legacy.cases.find((item: R) => item.id === 'combined').state));
  const own = event(); family.reception.applyEvent(own); family.events.push(own);
  family.restore(family.state()); return family;
}

for (const value of legacy.cases as R[]) test(`published0.45 checkpoint remains exact before Reception acquisition: ${value.id}`, () => {
  const family = acquired(); family.restoreNative(copy(value.state));
  assert.deepEqual(family.state(), value.state); assert.equal(family.reception.eventCount, 0);
  const checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  assert.equal(family.nativeState(), checkpoint);
});

test('Reception state and cumulative wait cross Kernel with detached public exports', async context => {
  const family = acquired(), store = new NativeKnowledgeStore('shared-reception-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.reception', step: 'checkpoint', statement: 'retain' });
  let reductions = 0; const original = ReceptionServiceMemory.prototype.applyEvent;
  context.mock.method(ReceptionServiceMemory.prototype, 'applyEvent', function (this: ReceptionServiceMemory, value: R) {
    reductions++; original.call(this, value);
  });
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 1);
  const owner = family.reception; reductions = 0;
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 0); assert.equal(family.reception, owner);
  const checkpoint = family.nativeState(), exported = family.reception.currentState();
  exported.reception_memory.controls.ACTION1.delta[0] = 99;
  exported.reception_memory.wait_spent = 0; exported.reception_events.pop();
  assert.equal(family.nativeState(), checkpoint);
  assert.equal(family.reception.eventCount, 1); assert.equal(family.reception.currentState().reception_memory.wait_spent, 3);
  assert.deepEqual(family.reception.currentState().reception_memory.controls.ACTION1.delta, [0, -4]);
});

test('Reception identity, revision, private state and journal edits invalidate certified reuse', context => {
  const mutations: [string, (family: SharedSeriesConstraint) => void][] = [
    ['reducer', family => family.reception.applyEvent(event())],
    ['replacement', family => { const next = new ReceptionServiceMemory({ currentEpochAcquisition: true }); next.applyEvent(event()); family.reception = next; }],
    ['state', family => { (family.reception as R).receptionMemory = { ...family.reception.currentState().reception_memory, wait_spent: 0 }; }],
    ['journal', family => { (family.reception as R).receptionEvents.push(event()); }],
    ['native policy', family => { (family.reception as R).currentEpochAcquisition = false; }],
  ];
  let reductions = 0; const original = ReceptionServiceMemory.prototype.applyEvent;
  context.mock.method(ReceptionServiceMemory.prototype, 'applyEvent', function (this: ReceptionServiceMemory, value: R) {
    reductions++; original.call(this, value);
  });
  for (const [name, mutate] of mutations) {
    const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
    mutate(family); reductions = 0; family.restoreNative(checkpoint);
    assert.equal(reductions, 1, name); assert.deepEqual(family.state(), checkpoint, name);
    assert.equal((family.reception as R).currentEpochAcquisition, true);
  }
});

test('Rejected Reception checkpoint edits preserve every existing shared owner atomically', () => {
  const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  const owners = [family.reception, family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs];
  for (const mutate of [
    (value: R) => { value.events.at(-1).memory.wait_spent = 0; },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).memory; },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => family.restoreNative(bad));
    assert.deepEqual([family.reception, family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs], owners);
    assert.deepEqual(family.state(), checkpoint);
  }
});

test('Exposed and Reception journals have distinct owners despite the source attribute collision', () => {
  const family = acquired(), checkpoint = family.nativeState();
  const exposed = family.exposed.currentState(), rooted = family.rootedLine.currentState();
  assert.equal(family.reception.eventCount, 1);
  assert.equal(family.exposed.eventCount, 1);
  assert.equal(family.reception.currentState().reception_events[0]!.kind, 'observed_reception_service');
  assert.equal(exposed.reception_events[0].kind, 'observed_exposed_reception');
  const restored = empty(); restored.restore(checkpoint);
  assert.deepEqual(restored.exposed.currentState(), exposed); assert.deepEqual(restored.rootedLine.currentState(), rooted);
  assert.deepEqual(restored.reception.currentState(), family.reception.currentState());
  assert.throws(() => family.reception.applyEvent(exposed.reception_events[0]!), /Outside reception-service/);
  assert.throws(() => new ExposedReceptionMemory().applyEvent(event()), /Outside exposed/);
  family.reception.applyEvent(event());
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  family.restoreNative(checkpoint); assert.deepEqual(family.state(), checkpoint);
});

const controlCase = source.cases.find((item: R) => item.id === 'record:observed_control_and_residual');
const { before: observation, after: laterObservation, rows, later } = controlCase.arguments;
const inputs = observation.available_action_refs.map((action_ref: string) => ({ action_ref }));
const packet = { frame_rows: rows, level: observation.level_epoch, levels_completed: observation.levels_completed,
  available_action_refs: observation.available_action_refs } as NativePublicObservation;

test('Reception common entry selects, binds, guards and leaves unacquired memory unchanged', async () => {
  const family = empty(), checkpoint = family.nativeState();
  const proposal = await family.observedPropose(observation, rows, inputs, 600, source.config, 1e12, () => 0);
  assert.equal(proposal?.status, 'proposed'); assert.ok(proposal?.reception_service_plan);
  assert.equal(proposal?.field_subquestion, 'observed_composition_services');
  family.bind(proposal!, new ObservedInputDomain(256));
  assert.equal(family.before(proposal!, 0, packet, observation).admitted, true);
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.reception.eventCount, 0);
  const edited = copy(proposal!); edited.actions[0].action_ref = 'FOREIGN';
  assert.equal(family.before(edited, 0, packet, observation).admitted, false);
  assert.equal(family.before(proposal!, 0, packet, { ...observation, observation_ref: 'different' }).admitted, false);
  const mixed = { ...copy(proposal!), rooted_line_plan: { unexpected: true }, panel_service_plan: { unexpected: true },
    chamber_relation_plan: { unexpected: true }, exposed_reception_plan: { unexpected: true } };
  assert.deepEqual(family.before(mixed, 0, packet, observation), family.before(proposal!, 0, packet, observation));
});

test('Common reception deadline and zero action budget preserve a blocking or absent proposal', async () => {
  const family = empty();
  assert.deepEqual(await family.observedPropose(observation, rows, inputs, 16, source.config, 10, () => 11),
    { status: 'unknown', reason: 'reception_level_deadline', block_unrelated_probe: true });
  assert.equal(family.reception.eventCount, 0);
  assert.equal(await family.observedPropose(observation, rows, inputs, 0, source.config, 10, () => 0), null);
});

test('Reception return acquires once after all older source owners and survives common restoration', async context => {
  const family = empty();
  const proposal = await family.observedPropose(observation, rows, inputs, 600, source.config, 1e12, () => 0);
  assert.ok(proposal?.reception_service_plan);
  const order: string[] = [];
  for (const [name, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['support', AuxiliarySupportMemory.prototype],
    ['exposed', ExposedReceptionMemory.prototype], ['chamber', RelationalChamberMemory.prototype],
    ['panel', PanelServiceMemory.prototype], ['rooted', RootedLineMemory.prototype], ['reception', ReceptionServiceMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      order.push(name); return (original as (...values: any[]) => R[]).apply(this, values);
    });
  }
  const result = family.record(observation, laterObservation, proposal!.actions[0], rows, later, proposal!, 0, [rows]);
  assert.deepEqual(order, ['pair', 'support', 'exposed', 'chamber', 'panel', 'rooted', 'reception']);
  const own = result.events.filter((item: R) => item.kind === 'observed_reception_service');
  assert.equal(own.length, 1); assert.equal(family.reception.eventCount, 1);
  assert.deepEqual(own, controlCase.expected, 'The actual response produces the independent original own event');
  assert.deepEqual(family.reception.currentState().reception_memory.controls.ACTION1.delta, [0, -4]);
  assert.ok(family.reception.currentState().reception_memory.residual_events.length > 0);
  const restored = empty(); restored.restore(family.state());
  assert.deepEqual(restored.state(), family.state());
  assert.deepEqual(restored.reception.currentState(), family.reception.currentState());
  const next = await restored.observedPropose(laterObservation, later, inputs, 599, source.config, 1e12, () => 0);
  assert.equal(next?.reception_service_plan.kind, 'access');
  assert.equal(next?.reception_service_plan.memory.controls.ACTION1.status, 'provisional_observed_control');
  const cold = await empty().observedPropose(laterObservation, later, inputs, 599, source.config, 1e12, () => 0);
  assert.equal(cold?.reception_service_plan.kind, 'control_probe');
  own[0].memory.controls.ACTION1.delta[0] = 99;
  assert.deepEqual(restored.reception.currentState(), family.reception.currentState(), 'Returned mutable events cannot edit either retained owner');
});
