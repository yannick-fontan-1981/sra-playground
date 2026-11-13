import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { SharedSeriesConstraint } from '../src/logos-engine/v6-shared-series.ts';
import { ReferencePopulationMemory } from '../src/logos-engine/v6-reference-population-access.ts';
import { ReceptionServiceMemory } from '../src/logos-engine/v6-reception-service-access.ts';
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
const legacy = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reference-population-legacy-checkpoints.json.gz', import.meta.url))).toString());
const source = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-reference-population-reference.json.gz', import.meta.url))).toString());
const copy = <T>(value: T): T => structuredClone(value);
const stateId = 'family_state:public_occurrence_recall';
function empty(): SharedSeriesConstraint { return new SharedSeriesConstraint(legacy.policy); }
function event(): R {
  return { kind: 'observed_reference_population',
    state: { epoch: 1, scene: { floor: [[0, 0], [0, 1]], bodies: [{ cell: [0, 1], appearance: 3 }] },
      active: [0, 1], pending: null, tried: [['ACTION4', [0, 0]]], evidence: ['before', 'after'] },
    controls: { ACTION4: { delta: [0, 1], evidence: ['before', 'after'] } },
    detail: { before: 'before', after: 'after', command: { action_ref: 'ACTION4' }, mode: 'probe' },
    observed_local_relations: [{ local_direction_mask: 0, degree: 0, appearance: 3 }],
    color_rule_status: 'observed_samples_only_no_complete_law' };
}
function acquired(): SharedSeriesConstraint {
  const family = empty(); family.restore(copy(legacy.cases.find((value: R) => value.id === 'combined').state));
  const own = event(); family.population.applyEvent(own); family.events.push(own);
  family.restore(family.state()); return family;
}

for (const value of legacy.cases as R[]) test(`published0.46 checkpoint remains exact before Population acquisition: ${value.id}`, () => {
  const family = acquired(); family.restoreNative(copy(value.state));
  assert.deepEqual(family.state(), value.state); assert.equal(family.population.eventCount, 0);
  const checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  assert.equal(family.nativeState(), checkpoint);
});

test('Population state crosses Kernel with detached exports and certified repeated restore', async context => {
  const family = acquired(), store = new NativeKnowledgeStore('shared-population-contract', 'restoration');
  await store.commit([{ id: stateId, kind: 'family_state', family: family.id, value: family.nativeState() }],
    { workflow: 'test.population', step: 'checkpoint', statement: 'retain' });
  let reductions = 0; const original = ReferencePopulationMemory.prototype.applyEvent;
  context.mock.method(ReferencePopulationMemory.prototype, 'applyEvent', function (this: ReferencePopulationMemory, value: R) {
    reductions++; original.call(this, value);
  });
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 1);
  const owner = family.population; reductions = 0;
  family.restoreNative(store.stateValue(stateId) as R); assert.equal(reductions, 0); assert.equal(family.population, owner);
  const checkpoint = family.nativeState(), exported = family.population.currentState();
  exported.population_controls.ACTION4.delta[0] = 99;
  exported.population_state!.active[0] = 99; exported.population_events.pop();
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.population.eventCount, 1);
  assert.deepEqual(family.population.currentState().population_state!.active, [0, 1]);
  assert.deepEqual(family.population.currentState().population_controls.ACTION4.delta, [0, 1]);
});

test('Population identity, revision, private state, controls and journal invalidate certified reuse', context => {
  const mutations: [string, (family: SharedSeriesConstraint) => void][] = [
    ['reducer', family => family.population.applyEvent(event())],
    ['replacement', family => { const next = new ReferencePopulationMemory(); next.applyEvent(event()); family.population = next; }],
    ['state', family => { (family.population as R).populationState = { ...family.population.currentState().population_state, active: [9, 9] }; }],
    ['controls', family => { (family.population as R).populationControls = {}; }],
    ['journal', family => { (family.population as R).populationEvents.push(event()); }],
  ];
  let reductions = 0; const original = ReferencePopulationMemory.prototype.applyEvent;
  context.mock.method(ReferencePopulationMemory.prototype, 'applyEvent', function (this: ReferencePopulationMemory, value: R) {
    reductions++; original.call(this, value);
  });
  for (const [name, mutate] of mutations) {
    const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
    mutate(family); reductions = 0; family.restoreNative(checkpoint);
    assert.equal(reductions, 1, name); assert.deepEqual(family.state(), checkpoint, name);
  }
});

test('Rejected Population checkpoints preserve all older shared owners atomically', () => {
  const family = acquired(), checkpoint = family.nativeState(); family.restoreNative(checkpoint);
  const owners = [family.population, family.reception, family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs];
  for (const mutate of [
    (value: R) => { value.events.at(-1).state.active = [9, 9]; },
    (value: R) => { value.events.pop(); },
    (value: R) => { delete value.events.at(-1).controls; },
    (value: R) => { value.digest = 'forged'; },
  ]) {
    const bad = copy(checkpoint); mutate(bad); assert.throws(() => family.restoreNative(bad));
    for (const [index, owner] of [family.population, family.reception, family.rootedLine, family.exposed, family.chamber, family.panel, family.pairs].entries()) {
      assert.equal(owner, owners[index], 'Rejected restore must retain each existing owner identity');
    }
    assert.deepEqual(family.state(), checkpoint);
  }
});

test('Population owns only its events and preserves nonempty Reception and older journals', () => {
  const family = acquired(), checkpoint = family.nativeState(), reception = family.reception.currentState();
  assert.equal(family.population.eventCount, 1); assert.equal(family.reception.eventCount, 1);
  const restored = empty(); restored.restore(checkpoint);
  assert.deepEqual(restored.reception.currentState(), reception);
  assert.deepEqual(restored.population.currentState(), family.population.currentState());
  assert.throws(() => family.population.applyEvent(reception.reception_events[0]!), /Outside reference-population/);
  assert.throws(() => family.reception.applyEvent(event()), /Outside reception-service/);
  family.population.applyEvent(event());
  assert.throws(() => family.restoreNative(family.nativeState()), /Shared series memory changed/);
  family.restoreNative(checkpoint); assert.deepEqual(family.state(), checkpoint);
});

const selectionCase = source.cases.find((value: R) => value.id === 'record:selection_single_marker');
const coldSelectionCase = source.cases.find((value: R) => value.id === 'record:common_cold_selection');
const controlCase = source.cases.find((value: R) => value.id === 'record:common_cold_control');
const { before: observation, rows } = selectionCase.arguments;
const inputs = observation.available_action_refs.filter((ref: string) => ref !== 'ACTION6').map((action_ref: string) => ({ action_ref }));
const packet = { frame_rows: rows, level: observation.level_epoch, levels_completed: observation.levels_completed,
  available_action_refs: observation.available_action_refs } as NativePublicObservation;

test('Population common entry adds its measured point, binds and guards before every older branch', async () => {
  const family = empty(), checkpoint = family.nativeState();
  const proposal = await family.observedPropose(observation, rows, inputs, 600, source.config, 1e12, () => 0);
  assert.equal(proposal?.status, 'proposed'); assert.equal(proposal?.reference_population_plan.mode, 'select');
  assert.deepEqual(proposal!.actions, [selectionCase.arguments.command]);
  assert.equal(proposal?.field_subquestion, 'observed_composition_services');
  family.bind(proposal!, new ObservedInputDomain(256));
  assert.deepEqual(proposal!.steps[0].point_binding.point, [proposal!.actions[0].data.x, proposal!.actions[0].data.y]);
  assert.equal(family.before(proposal!, 0, packet, observation).admitted, true);
  assert.equal(family.nativeState(), checkpoint); assert.equal(family.population.eventCount, 0);
  const edited = copy(proposal!); edited.actions[0].data.x++;
  assert.throws(() => family.bind(edited, new ObservedInputDomain(256)), /Current point changed/);
  assert.equal(family.before(edited, 0, packet, observation).admitted, false);
  assert.equal(family.before(proposal!, 0, packet, { ...observation, observation_ref: 'different' }).admitted, false);
  assert.equal(family.before(proposal!, 0, { ...packet, available_action_refs: ['ACTION1'] }, observation).admitted, false);
  const mixed = { ...copy(proposal!), reception_service_plan: { unexpected: true }, rooted_line_plan: { unexpected: true },
    panel_service_plan: { unexpected: true }, chamber_relation_plan: { unexpected: true }, exposed_reception_plan: { unexpected: true } };
  assert.deepEqual(family.before(mixed, 0, packet, observation), family.before(proposal!, 0, packet, observation));
  const { after, later } = selectionCase.arguments;
  assert.deepEqual(family.after(mixed, 0, observation, after, rows, later), family.after(proposal!, 0, observation, after, rows, later));
  for (const invalid of [null, false, {}]) {
    const malformed = { ...mixed, reference_population_plan: invalid };
    assert.throws(() => family.before(malformed, 0, packet, observation));
    assert.throws(() => family.after(malformed, 0, observation, after, rows, later));
  }
});

test('Common Population deadline, work bound and zero action budget preserve unknown or absent results', async () => {
  const family = empty(), checkpoint = family.nativeState();
  assert.deepEqual(await family.observedPropose(observation, rows, inputs, 16, source.config, 10, () => 11),
    { status: 'unknown', reason: 'reference_population_level_deadline', block_unrelated_probe: true });
  const bounded = await family.observedPropose(observation, rows, inputs, 16,
    { ...source.config, native_reference_population_work_budget: { node_bound: 0 } }, 10, () => 0);
  assert.equal(bounded?.status, 'unknown'); assert.equal(bounded?.reason, 'reference_population_work_bound');
  assert.equal(bounded?.block_unrelated_probe, true);
  assert.equal(await family.observedPropose(observation, rows, inputs, 0, source.config, 10, () => 0), null);
  await assert.rejects(family.observedPropose(observation, rows, inputs, 16, source.config, null), /current level deadline/);
  assert.equal(family.nativeState(), checkpoint);
});

test('Population return acquires once after Reception and restores actual selection and control evidence', async context => {
  const family = empty(), order: string[] = [];
  for (const [name, prototype] of [['pair', CoupledPairEvidenceMemory.prototype], ['support', AuxiliarySupportMemory.prototype],
    ['exposed', ExposedReceptionMemory.prototype], ['chamber', RelationalChamberMemory.prototype],
    ['panel', PanelServiceMemory.prototype], ['rooted', RootedLineMemory.prototype], ['reception', ReceptionServiceMemory.prototype],
    ['population', ReferencePopulationMemory.prototype]] as const) {
    const original = prototype.record;
    context.mock.method(prototype, 'record', function (this: any, ...values: any[]): R[] {
      order.push(name); return (original as (...values: any[]) => R[]).apply(this, values);
    });
  }
  for (const value of [coldSelectionCase, controlCase]) {
    const { before, after, rows: first, later, command } = value.arguments;
    const proposal = await family.observedPropose(before, first, inputs, 600, source.config, 1e12, () => 0);
    assert.ok(proposal?.reference_population_plan); assert.deepEqual(proposal!.actions[0], command);
    family.bind(proposal!, new ObservedInputDomain(256));
    order.length = 0;
    const result = family.record(before, after, command, first, later, proposal!, 0, [first]);
    assert.deepEqual(order, ['pair', 'support', 'exposed', 'chamber', 'panel', 'rooted', 'reception', 'population']);
    const own = result.events.filter((item: R) => item.kind === 'observed_reference_population');
    assert.equal(own.length, 1); assert.deepEqual(own, value.expected, 'Actual public response reproduces independent original own event');
    const restored = empty(); restored.restore(family.nativeState());
    assert.deepEqual(restored.population.currentState(), family.population.currentState());
    assert.deepEqual(await restored.observedPropose(after, later, inputs, 599, source.config, 1e12, () => 0),
      await family.observedPropose(after, later, inputs, 599, source.config, 1e12, () => 0));
    own[0].state.evidence.push('external mutation');
    assert.deepEqual(restored.population.currentState(), family.population.currentState());
  }
  assert.equal(family.population.eventCount, 2);
  assert.deepEqual(family.population.currentState().population_controls.ACTION1.delta, [-1, 0]);
  assert.deepEqual(family.population.currentState().population_state!.active, [4, 4]);
  assert.equal(family.population.currentState().population_state!.pending, null);
  const { after, later } = controlCase.arguments;
  const next = await family.observedPropose(after, later, inputs, 599, source.config, 1e12, () => 0);
  assert.deepEqual(next?.reference_population_plan.controls, family.population.currentState().population_controls);
  const cold = await empty().observedPropose(after, later, inputs, 599, source.config, 1e12, () => 0);
  assert.notDeepEqual(cold?.actions, next?.actions, 'The acquired actual selection and displacement change the next decision');
});
