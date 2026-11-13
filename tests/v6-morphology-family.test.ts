import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeMorphologyFamily } from '../src/logos-engine/v6-morphology-family.ts';
import { GoalAccessMemory, Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { InventoryCallerContext } from '../src/logos-engine/v6-inventory-caller-context.ts';
import type { NativeObservation, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-measurements-reference.json.gz', import.meta.url))).toString());
const scenario = fixture.family;
const scene = (name: string): R => fixture.scenes[name];
const observation = (name: string): NativeObservation => scene(name).observation;
const rows = (name: string): number[][] => scene(name).rows;
const snapshot = (name: string): Snapshot => Snapshot.fromPublic(observation(name), rows(name));
function packet(name: string): NativePublicObservation {
  const obs = observation(name);
  return { frame_rows: rows(name), frame_packet: [rows(name)], level: obs.level_epoch,
    levels_completed: obs.levels_completed, state: obs.state, step_index: obs.revision,
    available_action_refs: obs.available_action_refs, frame_hash: obs.frame_hash };
}
function sourceDecision(result: R): R {
  const { trace: _trace, instructions: _instructions, execution_engine: _engine,
    reference_commit: _commit, reference_semantic_hash: _semantic,
    all_executed_statements: _all, instruction_quantum: _quantum, ...original } = result;
  return original;
}
function sourceProposal(value: R): R {
  const { morphology_measurement_receipt: _receipt, ...proposal } = structuredClone(value);
  proposal.morphology = sourceDecision(proposal.morphology);
  return proposal;
}
async function setup() {
  const goal = new GoalAccessMemory(), shared = new InventoryCallerContext();
  goal.episode = scenario.history.map(([a, command, b]: string[]) => [snapshot(a!), command!, snapshot(b!)] as const);
  const family = await NativeMorphologyFamily.create();
  family.enableCallerContext({ goal: () => goal, forecast: () => shared.meter.forecast(),
    observe: (obs, pixels) => shared.observePlanning(obs, pixels), collection: () => shared.collection });
  return { goal, shared, family };
}
async function propose(family: NativeMorphologyFamily): Promise<R> {
  const value = await family.propose(observation(scenario.current), rows(scenario.current), scenario.inputs, scenario.remaining);
  assert.ok(value); return value;
}
async function recordStep(family: NativeMorphologyFamily, proposal: R, index: number, row: R) {
  return family.record(observation(row.before), observation(row.after), proposal.actions[index],
    rows(row.before), rows(row.after), proposal, index);
}

test('native family consumes real producers and reproduces the complete original base proposal', async () => {
  const { family, goal, shared } = await setup(), knowledge = goal.retainedState();
  const proposal = await propose(family);
  assert.deepEqual(sourceProposal(proposal), scenario.proposal);
  assert.equal(proposal.morphology.release_authority, false);
  assert.equal(proposal.morphology_measurement_receipt.decision.route_key, 'modifier');
  assert.deepEqual(goal.retainedState(), knowledge, 'Producing a route does not acquire a new effect');
  const state = family.state(), meter = shared.state();
  assert.deepEqual(sourceProposal(await propose(family)), scenario.proposal);
  assert.deepEqual(shared.state(), meter, 'Repeated planning does not acquire the current meter twice');
  assert.deepEqual(family.state(), state, 'Pure current measurements do not become extra domain memory');
  assert.deepEqual(Object.keys(state).sort(), ['contacts', 'entry_access_return', 'feature_trials', 'format', 'journal', 'tried']);
  assert.equal(state.entry_access_return, null);
});

test('current morphology decision survives a null route only within its measured selection scope', async () => {
  const { family, goal } = await setup();
  goal.episode = [];
  const current = observation(scenario.current), retained = family.state();
  assert.equal(await family.propose(current, rows(scenario.current), scenario.inputs, scenario.remaining), null);
  const decision = family.currentDecision(current);
  assert.ok(decision);
  assert.equal(decision.status, 'retained');
  assert.equal(decision.reason, 'control_not_currently_attested');
  assert.equal(decision.route_key, null);
  assert.equal(decision.measured_facts.control_attested, false);
  assert.equal(decision.release_authority, false);
  assert.deepEqual(family.state(), retained, 'A current answer is not acquired historical evidence');
  decision.measured_facts.pair_ref = 'changed-by-reader';
  assert.notEqual(family.currentDecision(current)?.measured_facts.pair_ref, 'changed-by-reader');
  for (const changed of [
    { ...current, observation_ref: 'another-observation' }, { ...current, level_epoch: current.level_epoch + 1 },
    { ...current, levels_completed: current.levels_completed + 1 }, { ...current, frame_hash: 'another-frame' },
  ]) assert.equal(family.currentDecision(changed), null);
  family.beginDecision(); assert.equal(family.currentDecision(current), null);
  assert.equal(family.currentMeasurementReceipt(current), null);
  await family.propose(current, rows(scenario.current), scenario.inputs, scenario.remaining);
  family.restoreNative(family.nativeState());
  assert.equal(family.currentDecision(current), null, 'Even an identical checkpoint cannot restore an ephemeral decision');
});

test('a selected morphology proposal and the current source decision have identical measured meaning', async () => {
  const { family } = await setup(), proposal = await propose(family), current = observation(scenario.current);
  assert.deepEqual(family.currentDecision(current), proposal.morphology);
  family.beginDecision();
  assert.equal(family.currentDecision(current), null);
  assert.deepEqual(sourceProposal(proposal), scenario.proposal, 'Resetting the next cycle does not alter the committed proposal');
});

test('all original per-step geometry guards, effects and selected acquisitions match unchanged Python', async () => {
  const { family } = await setup(), proposal = await propose(family);
  family.bind(proposal);
  for (const [index, row] of scenario.steps.entries()) {
    assert.deepEqual(family.before(proposal, index, packet(row.before), observation(row.before)), row.guard);
    assert.deepEqual(await family.after(proposal, index, observation(row.before), observation(row.after), rows(row.before), rows(row.after)), row.response);
    assert.deepEqual((await recordStep(family, proposal, index, row)).events, row.event === null ? [] : [row.event]);
  }
  const state = family.state();
  assert.deepEqual(state.contacts, scenario.expectedContacts.map(([key, value]: [unknown, R]) => [JSON.stringify(key), value]));
  assert.deepEqual(state.tried, scenario.expectedTried);
  assert.deepEqual(state.feature_trials, scenario.expectedFeatureTrials);
  assert.equal(state.journal.length, 1, 'Only the selected terminal return acquires a contact');
  const last = scenario.steps.at(-1);
  assert.deepEqual((await recordStep(family, proposal, scenario.steps.length - 1, last)).events, []);
  assert.deepEqual(family.state(), state, 'A repeated selected return is idempotent');
});

test('an unchanged pattern and a scope boundary preserve source uncertainty in selected return records', async () => {
  for (const outcome of [scenario.contrary, scenario.boundary]) {
    const { family } = await setup(), proposal = await propose(family);
    assert.deepEqual((await recordStep(family, proposal, 4, outcome)).events, [outcome.event]);
    assert.equal(outcome.event.unchanged_peer, null);
    assert.deepEqual(family.state().contacts, []);
  }
});

test('actual route guards reject expired scope, missing commands and changed public footprints', async () => {
  const { family } = await setup(), proposal = await propose(family), live = observation(scenario.current), first = packet(scenario.current);
  assert.equal(family.before(proposal, 0, first, live).admitted, true);
  for (const [changed, observed] of [
    [{ ...first, level: first.level + 1 }, live],
    [{ ...first, levels_completed: first.levels_completed + 1 }, live],
    [{ ...first, available_action_refs: [] }, live],
    [first, { ...live, observation_ref: 'expired-observation' }],
  ] as [NativePublicObservation, NativeObservation][]) {
    assert.equal(family.before(proposal, 0, changed, observed).admitted, false);
  }
  for (const target of ['from', 'to']) {
    const pixels = structuredClone(first.frame_rows) as number[][];
    const [x, y] = proposal.morphology_plan.steps[0][target]; pixels[y][x] = (pixels[y][x] + 1) % 16;
    assert.equal(family.before(proposal, 0, { ...first, frame_rows: pixels }, live).admitted, false);
  }
  const tampered = structuredClone(proposal); tampered.actions[0] = { action_ref: 'ACTION5' };
  assert.throws(() => family.bind(tampered), /differ/);
  assert.equal(family.before(tampered, 0, first, live).admitted, false);
});

test('acquired contacts restore exactly, while altered or duplicate event projections fail atomically', async () => {
  const { family } = await setup(), proposal = await propose(family), last = scenario.steps.at(-1);
  await recordStep(family, proposal, 4, last);
  const state = family.state(), restored = (await setup()).family;
  restored.restoreNative(state); assert.deepEqual(restored.state(), state);
  assert.deepEqual((await recordStep(restored, proposal, 4, last)).events, []);
  for (const modify of [
    (value: R) => { value.contacts = []; },
    (value: R) => { value.journal.push(structuredClone(value.journal[0])); },
    (value: R) => { value.journal[0].event.unchanged_peer = null; },
    (value: R) => { value.tried.push('unsupported-trial'); },
  ]) {
    const corrupt = structuredClone(state); modify(corrupt);
    assert.throws(() => restored.restoreNative(corrupt), /morphology|Morphology/);
    assert.deepEqual(restored.state(), state);
  }
});

test('restoring before a committed prefix finishes preserves a guarded continuation and acquires its return once', async () => {
  let { family } = await setup(); const proposal = await propose(family);
  for (let index = 0; index < 2; index++) {
    const row = scenario.steps[index];
    assert.deepEqual((await recordStep(family, proposal, index, row)).events, []);
  }
  const next = (await setup()).family; next.restoreNative(family.state()); family = next;
  for (let index = 2; index < 5; index++) {
    const row = scenario.steps[index];
    assert.equal(family.before(proposal, index, packet(row.before), observation(row.before)).admitted, true);
    await recordStep(family, proposal, index, row);
  }
  assert.equal(family.state().journal.length, 1);
  assert.deepEqual(family.state().contacts, scenario.expectedContacts.map(([key, value]: [unknown, R]) => [JSON.stringify(key), value]));
});

test('the measured contact is consumed by the following current peer decision after restoration', async () => {
  const { family } = await setup(), proposal = await propose(family), last = scenario.steps.at(-1);
  await recordStep(family, proposal, 4, last);
  const retained = family.state();
  const next = await family.propose(observation(last.after), rows(last.after), scenario.inputs, 95);
  assert.deepEqual(next === null ? null : sourceProposal(next), scenario.nextProposal);
  assert.deepEqual(family.state(), retained, 'Current planning preserves acquired contact evidence');
  const restored = (await setup()).family; restored.restoreNative(retained);
  const again = await restored.propose(observation(last.after), rows(last.after), scenario.inputs, 95);
  assert.deepEqual(again === null ? null : sourceProposal(again), scenario.nextProposal);
});

test('actual station entries and preserved departure produce the original current cycle and discriminate its return', async () => {
  const { family, goal } = await setup(), first = await propose(family), station = fixture.station;
  assert.deepEqual((await recordStep(family, first, 4, station.first)).events, [station.first.event]);
  const exit = station.departure;
  assert.deepEqual(await family.observeDepartures(observation(exit.before), observation(exit.after),
    rows(exit.before), rows(exit.after), exit.command), exit.events);
  const history = (values: string[][]) => values.map(([a, command, b]) => [snapshot(a!), command!, snapshot(b!)] as const);
  goal.episode = history(station.history.slice(0, -1));
  const reentry = await family.propose(observation(exit.after), rows(exit.after), scenario.inputs, 100);
  assert.ok(reentry); assert.deepEqual(sourceProposal(reentry), station.second.proposal);
  assert.deepEqual((await recordStep(family, reentry, 0, station.second)).events, [station.second.event]);
  goal.episode = history(station.history);
  const cycle = await family.propose(observation(station.current), rows(station.current), scenario.inputs, 100);
  assert.ok(cycle); assert.deepEqual(sourceProposal(cycle), station.proposal);
  assert.equal(cycle.actions.length, 2);
  assert.equal(family.before(cycle, 0, packet(station.current), observation(station.current)).admitted, true);
  const positive = scenario.steps.at(-1).after, contrary = station.first.after;
  const expected = await family.after(cycle, 1, observation(station.current), observation(positive), rows(station.current), rows(positive));
  const contradicted = await family.after(cycle, 1, observation(station.current), observation(contrary), rows(station.current), rows(contrary));
  assert.equal(expected.reason, 'compare_selective_entry_prediction');
  assert.equal(expected.matched, true);
  assert.equal(contradicted.matched, false);
  assert.equal(expected.seal_prefix, true); assert.equal(contradicted.seal_prefix, true);
});

test('a border retention probe revalidates every remaining visible pixel before release', async () => {
  const { family, goal } = await setup(), first = await propose(family), last = scenario.steps.at(-1);
  await recordStep(family, first, 4, last);
  const partial = fixture.cases.find((row: R) => row.id === 'observed-border-occlusion-permits-one-interior-probe');
  goal.episode = partial.history.map(([a, command, b]: string[]) => [snapshot(a!), command!, snapshot(b!)] as const);
  const value = await family.propose(observation(partial.current), rows(partial.current), scenario.inputs, 100);
  assert.ok(value); const proposal = value as R;
  assert.equal(proposal.morphology_plan.partial_correspondence.status, 'border_occluded_interior_observed');
  assert.equal(family.before(proposal, 0, packet(partial.current), observation(partial.current)).admitted, true);
  const support = proposal.morphology_plan.partial_correspondence;
  const destination = proposal.morphology_plan.steps[0].to, size = proposal.morphology_plan.size;
  const [x, y] = support.visible_pixels.find(([a, b]: number[]) => !(destination[0] <= a! && a! < destination[0] + size[0] && destination[1] <= b! && b! < destination[1] + size[1]));
  const changed = structuredClone(rows(partial.current)); changed[y][x] = (changed[y][x] + 1) % 16;
  assert.equal(family.before(proposal, 0, { ...packet(partial.current), frame_rows: changed }, observation(partial.current)).admitted, false);
});
