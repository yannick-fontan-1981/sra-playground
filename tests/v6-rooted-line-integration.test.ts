import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { RootedLineMemory, freshRootedLineMemory } from '../src/logos-engine/v6-rooted-line-access.ts';
import { CoupledPairEvidenceMemory } from '../src/logos-engine/v6-coupled-pair-evidence.ts';
import { AuxiliarySupportMemory } from '../src/logos-engine/v6-auxiliary-support.ts';
import { ExposedReceptionMemory } from '../src/logos-engine/v6-exposed-reception-access.ts';
import { RelationalChamberMemory } from '../src/logos-engine/v6-relational-chamber-access.ts';
import { PanelServiceMemory } from '../src/logos-engine/v6-panel-service-access.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-rooted-line-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-rooted-line-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const stateId = 'family_state:public_occurrence_recall';
function empty(): SharedSeriesConstraint { return new SharedSeriesConstraint(legacy.policy); }
function event(): R {
  return { kind: 'observed_rooted_line', memory: { ...freshRootedLineMemory(), epoch: 1,
    evidence: ['before', 'after'], tried: ['ACTION1'],
    controls: { ACTION1: { effect_id: 'measured', action_ref: 'ACTION1', root_translation: [1, 0],
      extent_delta: 0, microsteps: 1, evidence: ['before', 'after'] } } },
  detail: { command: { action_ref: 'ACTION1' }, before: 'before', after: 'after', boundary: false,
    kind: 'calibrate', matched: null, observed_effect: { root_translation: [1, 0], extent_delta: 0 } } };
}
function acquired(): SharedSeriesConstraint {
  const family = empty(); family.restore(copy(legacy.cases.find((x: R) => x.id === 'combined').state));
  const own = event(); family.rootedLine.applyEvent(own); family.events.push(own);
  family.restore(family.state()); return family;
}

for (const value of legacy.cases as R[]) test(`published0.44 checkpoint remains exact after Rooted: ${value.id}`, () => {
  const family = acquired(); family.restoreNative(copy(value.state));
  assert.deepEqual(family.state(), value.state); assert.equal(family.rootedLine.eventCount, 0);
  const checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  assert.equal(family.nativeState(), checkpoint);
});

test('rooted state crosses Kernel and is detached publicly with certified reuse', async context => {
  const family = acquired(), store = new NativeKnowledgeStore('shared-rooted-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.rooted', step: 'checkpoint', statement: 'retain' });
  let reductions = 0; const original = RootedLineMemory.prototype.applyEvent;
  context.mock.method(RootedLineMemory.prototype, 'applyEvent', function (this: RootedLineMemory, value: R) {
    reductions++; original.call(this, value);
  });
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 1);
  const owner = family.rootedLine; reductions = 0;
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 0); assert.equal(family.rootedLine, owner);
  const checkpoint = family.nativeState(), external = family.rootedLine.currentState();
  external.line_memory.controls.ACTION1.root_translation[0] = 9; external.line_events.pop();
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.rootedLine.eventCount, 1);
  assert.deepEqual(family.rootedLine.currentState().line_memory.controls.ACTION1.root_translation, [1, 0]);
});

test('rooted owner mutations invalidate reuse and bad checkpoints reject atomically', context => {
  const mutations: [string, (family: SharedSeriesConstraint) => void][] = [
    ['reducer', family => family.rootedLine.applyEvent(event())],
    ['replacement', family => { const next = new RootedLineMemory(); next.applyEvent(event()); family.rootedLine = next; }],
    ['state', family => { (family.rootedLine as R).lineMemory = { ...family.rootedLine.currentState().line_memory, evidence: ['foreign'] }; }],
    ['journal', family => { (family.rootedLine as R).lineEvents.push(event()); }],
  ];
  let reductions = 0; const original = RootedLineMemory.prototype.applyEvent;
  context.mock.method(RootedLineMemory.prototype, 'applyEvent', function (this: RootedLineMemory, value: R) {
    reductions++; original.call(this, value);
  });
  for (const [name, mutate] of mutations) {
    const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
    mutate(family); reductions = 0; family.restoreNative(checkpoint);
    assert.equal(reductions, 1, name); assert.deepEqual(family.state(), checkpoint, name);
  }
  const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  const owners = [family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs];
  for (const mutate of [
    (value: R) => { value.events.at(-1).memory.controls.ACTION1.root_translation[0] = -1; },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).memory; },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => family.restoreNative(bad));
    assert.deepEqual([family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs], owners);
    assert.deepEqual(family.state(), checkpoint);
  }
});

test('rooted acquisition cannot escape the common journal or alias quota/reception service', () => {
  const family = acquired(), checkpoint = family.nativeState();
  family.rootedLine.applyEvent(event());
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  family.restoreNative(checkpoint); assert.deepEqual(family.state(), checkpoint);
  for (const kind of ['observed_reception_service', 'rooted_quota_state']) {
    assert.throws(() => family.rootedLine.applyEvent({ kind, memory: {} }), /Outside rooted-line/);
  }
  assert.deepEqual(family.state(), checkpoint);
});

const rows = source.rasters.base;
const observation: R = { level_epoch: 1, levels_completed: 0, observation_ref: 'synthetic:before',
  frame_hash: symbolicDigest(rows).slice(0, 16), state: 'NOT_FINISHED',
  available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'] };
const packet = { frame_rows: rows, level: 1, levels_completed: 0,
  available_action_refs: observation.available_action_refs } as NativePublicObservation;

test('common entry selects, binds and guards Rooted without acquiring a future response', async () => {
  const family = empty(), checkpoint = family.nativeState();
  const proposal = await family.observedPropose(observation, rows, [], 16, source.config, 1e12, () => 0);
  assert.equal(proposal?.status, 'proposed'); assert.ok(proposal?.rooted_line_plan);
  assert.equal(proposal?.field_subquestion, 'observed_composition_services');
  family.bind(proposal!, new ObservedInputDomain(256));
  assert.equal(family.before(proposal!, 0, packet, observation).admitted, true);
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.rootedLine.eventCount, 0);
  const edited = copy(proposal!); edited.actions[0].action_ref = 'FOREIGN';
  assert.equal(family.before(edited, 0, packet, observation).admitted, false);
  assert.equal(family.before(proposal!, 0, packet, { ...observation, observation_ref: 'different' }).admitted, false);
  const inherited = { ...copy(proposal!), panel_service_plan: { unexpected: true },
    chamber_relation_plan: { unexpected: true }, exposed_reception_plan: { unexpected: true } };
  assert.deepEqual(family.before(inherited, 0, packet, observation), family.before(proposal!, 0, packet, observation));
});

test('common Rooted refusal respects the current deadline and remaining action budget', async () => {
  const family = empty();
  const expired = await family.observedPropose(observation, rows, [], 16, source.config, 10, () => 11);
  assert.deepEqual(expired, { status: 'unknown', reason: 'rooted_line_level_deadline', block_unrelated_probe: true });
  assert.equal(family.rootedLine.eventCount, 0);
  assert.equal(await family.observedPropose(observation, rows, [], 0, source.config, 10, () => 11), null);
});

test('common acquisition calls source owners once in order and restores the Rooted return', async context => {
  const family = empty();
  const proposal = await family.observedPropose(observation, rows, [], 16, source.config, 1e12, () => 0);
  assert.ok(proposal?.rooted_line_plan);
  const order: string[] = [];
  for (const [name, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['support', AuxiliarySupportMemory.prototype],
    ['exposed', ExposedReceptionMemory.prototype], ['chamber', RelationalChamberMemory.prototype],
    ['panel', PanelServiceMemory.prototype], ['rooted', RootedLineMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      order.push(name); return (original as (...v: any[]) => R[]).apply(this, values);
    });
  }
  const after = { ...observation, observation_ref: 'synthetic:after' };
  const result = family.record(observation, after, proposal!.actions[0], rows, rows, proposal!, 0, [rows]);
  assert.deepEqual(order, ['pair', 'support', 'exposed', 'chamber', 'panel', 'rooted']);
  const own = result.events.filter((e: R) => e.kind === 'observed_rooted_line');
  assert.equal(own.length, 1); assert.equal(family.rootedLine.eventCount, 1);
  assert.deepEqual(family.rootedLine.currentState().line_memory.controls, {}, 'An unchanged return acquires no displacement');
  assert.deepEqual(family.rootedLine.currentState().line_memory.tried, [proposal!.actions[0].action_ref]);
  const restored = empty(); restored.restore(family.state());
  assert.deepEqual(restored.state(), family.state());
  assert.deepEqual(restored.rootedLine.currentState(), family.rootedLine.currentState());
  const next = await restored.observedPropose(after, rows, [], 16, source.config, 1e12, () => 0);
  assert.notDeepEqual(next?.actions, proposal!.actions, 'The acquired unsuccessful control is consumed by the next decision');
  own[0].memory.evidence.push('foreign');
  assert.deepEqual(restored.rootedLine.currentState(), family.rootedLine.currentState(), 'Returned events cannot edit retained ownership');
});
