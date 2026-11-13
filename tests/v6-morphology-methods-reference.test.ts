import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { GoalAccessMemory, Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { InventoryCallerContext } from '../src/logos-engine/v6-inventory-caller-context.ts';
import { NativeMorphologyFamily } from '../src/logos-engine/v6-morphology-family.ts';
import { NativeCallerCoordinator } from '../src/logos-engine/v6-native-caller.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { recalledDirections } from '../src/logos-engine/v6-target-method.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import type { NativeObservation, NativeProposal, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import type { NativeAuthorityTransition } from '../src/logos-engine/v6-native-authority.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-methods-reference.json.gz', import.meta.url))).toString());
const root = new URL('../', import.meta.url);
const source = new URL(`reference/v6/${fixture.commit}/source/`, root);
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const copy = <T>(value: T): T => structuredClone(value);
const configuration = { targetLevels: 3, domain: new ObservedInputDomain(256), strategy: {}, informationGoal: 'open_questions' as const };

function packet(row: R): NativePublicObservation {
  const obs = row.observation;
  return { frame_rows: row.rows, frame_packet: [row.rows], level: obs.level_epoch,
    levels_completed: obs.levels_completed, state: obs.state, step_index: obs.revision,
    available_action_refs: obs.available_action_refs, frame_hash: obs.frame_hash };
}
const snapshot = (row: R): Snapshot => Snapshot.fromPublic(row.observation, row.rows);
function sourceProposal(value: R): R {
  const { morphology_measurement_receipt: _measurement, ...proposal } = copy(value);
  const { trace: _trace, instructions: _instructions, execution_engine: _engine,
    reference_commit: _commit, reference_semantic_hash: _semantic,
    all_executed_statements: _all, instruction_quantum: _quantum, ...decision } = proposal.morphology;
  proposal.morphology = decision;
  return proposal;
}
function sourceProjection(value: R): R {
  return { contacts: value.contacts.map(([key, row]: [string, R]) => [JSON.parse(key), row]),
    tried: value.tried, feature_trials: value.feature_trials, entry_access_return: value.entry_access_return };
}
function contractCheckpoint(events: R[], projection: R): R {
  return { format: 'native.current_morphology.v2',
    journal: events.map((event, index) => ({ id: `declared-component-event:${index}`, digest: symbolicDigest(event), event: copy(event) })),
    contacts: projection.contacts.map(([key, row]: [unknown, R]) => [JSON.stringify(key), copy(row)]),
    tried: copy(projection.tried), feature_trials: copy(projection.feature_trials), entry_access_return: copy(projection.entry_access_return) };
}
async function connectedFamily(scenes: R, history: string[][], method: () => R | null = () => null) {
  const family = await NativeMorphologyFamily.create(), goal = new GoalAccessMemory(), shared = new InventoryCallerContext();
  goal.episode = history.map(([a, command, b]) => [snapshot(scenes[a!]), command!, snapshot(scenes[b!])] as const);
  family.enableCallerContext({ goal: () => goal, forecast: () => shared.meter.forecast(),
    observe: (obs, rows) => shared.observePlanning(obs, rows), collection: () => shared.collection, targetMethod: method });
  return { family, goal, shared };
}
class ObservedWritesMemory extends NativeReasoningMemory {
  readonly writes: R[] = [];
  override put(episode: string, key: string, value: any, evidence = 'fixture', revision = 1): void {
    this.writes.push(copy({ episode, key, value, evidence, revision }));
    super.put(episode, key, value, evidence, revision);
  }
}
function transition(args: R): NativeAuthorityTransition {
  // This boundary contract deliberately supplies a scored public witness. It
  // does not claim that a Kernel released or executed this action sequence.
  return { before: args.before, after: args.after, command: args.command, index: args.index,
    first: null, second: null, outcome: null } as unknown as NativeAuthorityTransition;
}

test('method references retain 1786 verified originals and exact unmodified inline boundary statements', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceVerification.verifiedOriginalFilesBefore, 1786);
  assert.equal(fixture.sourceVerification.verifiedOriginalFilesAfter, 1786);
  assert.equal(fixture.method.sourceModified, false);
  assert.equal(fixture.method.originalStatementsModified, false);
  assert.equal(fixture.method.monkeyPatched, false);
  assert.equal(fixture.method.nativeExecution, false);
  assert.equal(fixture.method.wholeRuntimeExecuted, false);
  assert.equal(fixture.method.sourceFragmentExtracted, true);
  assert.deepEqual(fixture.method.boundaryDoubles, ['memory.put/get storage boundary', 'strategy_router ownership container']);
  assert.equal(hash(await readFile(new URL(fixture.generator.path, root))), fixture.generator.sha256);
  for (const input of fixture.inputArtifacts) assert.equal(hash(await readFile(new URL(input.path, root))), input.sha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(hash(await readFile(new URL(path, source))), expected);
  }
  const fragment = fixture.sourceFragment;
  assert.equal(fragment.firstLine, 1274);
  assert.equal(fragment.lastLine, 1304);
  assert.equal(fragment.statementCount, 2);
  const text = await readFile(new URL(fragment.path, source), 'utf8');
  assert.equal(hash(text), fragment.sourceSha256);
  assert.equal(hash(text.split('\n').slice(fragment.firstLine - 1, fragment.lastLine).join('\n') + '\n'), fragment.segmentSha256);
  assert.equal(fixture.boundaryCases.length, 15);
  assert.equal(fixture.recalledCases.length, 7);
  assert.equal(fixture.entryFamily.guardCases.length, 7);
  assert.equal(fixture.entryFamily.returnCases.length, 6);
  assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === 'MorphologyAdapter.record'));
  assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === 'resume'));
  assert.ok(fixture.sourceHashes['agents/yf_arc3_v5/drm/morphology.drm']);
});

for (const sample of fixture.boundaryCases) {
  test(`original boundary method contract: ${sample.id}`, async () => {
    // Variants are explicitly declared component event-history premises. The
    // independent test below acquires the positive contact through record().
    const family = await NativeMorphologyFamily.create();
    family.restoreNative(contractCheckpoint(sample.args.events, sample.expected.projection));
    const retained = family.state(), memory = new ObservedWritesMemory();
    let caller = new NativeCallerCoordinator(memory, configuration);
    caller.targetMethod = copy(sample.args.priorMethod);
    const witness = caller.boundaryWitness(transition(sample.args), copy(sample.args.proposal), sample.args.decisionRevision,
      (method, current) => family.stationHypothesisFor(method, current));
    assert.deepEqual(witness, sample.expected.witness);
    assert.deepEqual(caller.targetMethod, sample.expected.targetMethod);
    assert.deepEqual(caller.targetMethod?.station_hypothesis ?? null, sample.expected.stationMethod);
    assert.deepEqual(memory.writes.filter(row => row.key === 'target_method'), sample.expected.writes,
      'The enriched method has exactly one authoritative memory write');
    assert.deepEqual(family.state(), retained, 'Station method projection cannot acquire or alter contacts');
    const state = caller.state();
    caller = new NativeCallerCoordinator(memory, configuration); caller.restore(state);
    assert.deepEqual(caller.targetMethod, sample.expected.targetMethod);
    assert.deepEqual(caller.checkpointWrites().find(row => row.id === 'caller:counters')?.value,
      state.counters, 'The existing caller owner persists the one method');
    assert.ok(!Object.hasOwn(family.state(), 'station_method') && !Object.hasOwn(family.state(), 'entry_method'),
      'The morphology family must not create a second method owner');
  });
}

test('a real measured contact return enriches the existing caller method and restores without duplicate ownership', async () => {
  const sample = fixture.acquisition, scenes = fixture.scenes;
  const { family } = await connectedFamily(scenes, sample.history);
  const proposal = await family.propose(scenes[sample.current].observation, scenes[sample.current].rows, sample.inputs, sample.remaining);
  assert.ok(proposal);
  assert.deepEqual(sourceProposal(proposal), sample.proposal);
  const events: R[] = [];
  for (const [index, step] of sample.steps.entries()) {
    const a = scenes[step.before], b = scenes[step.after];
    events.push(...(await family.record(a.observation, b.observation, proposal.actions[index], a.rows, b.rows, proposal, index)).events);
  }
  assert.deepEqual(events, sample.events);
  assert.deepEqual(sourceProjection(family.state()), sample.projection);
  const args = fixture.boundaryCases[0].args, memory = new ObservedWritesMemory();
  const caller = new NativeCallerCoordinator(memory, configuration);
  const witness = caller.boundaryWitness(transition(args), args.proposal, args.decisionRevision,
    (method, current) => family.stationHypothesisFor(method, current));
  assert.deepEqual(witness.target_method, fixture.boundaryCases[0].expected.targetMethod);
  assert.equal(memory.writes.filter(row => row.key === 'target_method').length, 1);
  const state = family.state(), restored = await NativeMorphologyFamily.create();
  restored.restoreNative(state);
  assert.deepEqual(restored.stationHypothesisFor(witness.target_method, witness), witness.target_method.station_hypothesis);
  const projection = restored.stationHypothesisFor(witness.target_method, witness)!;
  projection.role_refs[0] = 'mutated-external-reader';
  assert.deepEqual(restored.state(), state);
  const { entry_access_return: _pending, ...legacy } = state;
  legacy.format = 'native.current_morphology.v1';
  restored.restoreNative(legacy);
  assert.deepEqual(restored.state(), state, 'The legacy five-field checkpoint projects to v2 with no invented return');
});

for (const sample of fixture.recalledCases) {
  test(`original recalled motion contract: ${sample.id}`, () => {
    assert.deepEqual(recalledDirections(sample.method, sample.decision, snapshot(sample.current)), sample.expected);
  });
}

async function entrySequence() {
  const sample = fixture.entryFamily, scenes = sample.scenes;
  // This prior scored method is an explicit consumer-boundary premise. The
  // historical acquisition of this method is tested above, not claimed here.
  const method = copy(sample.priorMethod);
  const context = await connectedFamily(scenes, sample.history, () => method);
  for (const name of sample.meterScenes) context.shared.observePlanning(scenes[name].observation, scenes[name].rows);
  const { family, goal, shared } = context;
  const proposal = await family.propose(scenes[sample.current].observation, scenes[sample.current].rows, sample.inputs, sample.remaining);
  assert.ok(proposal);
  assert.deepEqual(sourceProposal(proposal), sample.proposal);
  assert.deepEqual(shared.meter.forecast(), sample.firstForecast);
  for (const [index, step] of sample.steps.entries()) {
    const before = scenes[step.before], after = scenes[step.after];
    assert.deepEqual(family.before(proposal, index, packet(before), before.observation), step.guard);
    assert.deepEqual(await family.after(proposal, index, before.observation, after.observation, before.rows, after.rows), step.response);
    const returned = await family.record(before.observation, after.observation, proposal.actions[index], before.rows, after.rows, proposal, index);
    assert.deepEqual(returned.events, step.event === null ? [] : [step.event]);
    shared.observePlanning(after.observation, after.rows);
    goal.episode.push([snapshot(before), proposal.actions[index].action_ref, snapshot(after)]);
  }
  assert.deepEqual(sourceProjection(family.state()), sample.acquiredProjection);
  return { ...context, method, proposal, current: scenes[sample.steps.at(-1).after] };
}

test('full original adapter sequence acquires an approach return and resumes after checkpoint restoration', async () => {
  const sample = fixture.entryFamily;
  const { family, shared, goal, method, current, proposal } = await entrySequence();
  const checkpoint = family.state();
  assert.equal(checkpoint.format, 'native.current_morphology.v2');
  assert.equal(checkpoint.entry_access_return.kind, 'entry_access_return');
  assert.deepEqual(checkpoint.contacts, []);
  assert.deepEqual(checkpoint.tried, []);
  assert.equal(checkpoint.journal.length, 1, 'The approach return precedes the generic approach early return');
  const last = sample.steps.at(-1), before = sample.scenes[last.before];
  assert.deepEqual((await family.record(before.observation, current.observation, proposal.actions.at(-1), before.rows,
    current.rows, proposal, proposal.actions.length - 1)).events, []);
  assert.deepEqual(family.state(), checkpoint, 'Repeated selected returns are idempotent');
  const restored = await NativeMorphologyFamily.create(); restored.restoreNative(checkpoint);
  const retainedGoal = goal.retainedState(), retainedContext = shared.state();
  restored.enableCallerContext({ goal: () => goal, forecast: () => shared.meter.forecast(),
    observe: (obs, rows) => shared.observePlanning(obs, rows), collection: () => shared.collection, targetMethod: () => method });
  const resumed = await restored.propose(current.observation, current.rows, sample.inputs, sample.resumeRemaining);
  assert.ok(resumed);
  assert.deepEqual(sourceProposal(resumed), sample.resumedProposal);
  assert.deepEqual(shared.meter.forecast(), sample.resumedForecast);
  assert.deepEqual(restored.state(), checkpoint, 'A continuation proposal does not erase its acquired parent return');
  assert.deepEqual(goal.retainedState(), retainedGoal);
  assert.deepEqual(shared.state(), retainedContext, 'Planning rereads the same meter observation without a second acquisition');
  assert.equal(resumed.morphology_plan.parent_return_ref, checkpoint.entry_access_return.return_ref);
  assert.equal(resumed.morphology_plan.reserve_after_probe, 5);
});

for (const sample of fixture.entryFamily.guardCases) {
  test(`original entry probe guard: ${sample.id}`, async () => {
    const family = await NativeMorphologyFamily.create();
    const current = fixture.entryFamily.scenes[sample.current];
    const publicValue = { ...packet(current), ...sample.publicOverrides };
    assert.deepEqual(family.before(sample.proposal, 0, publicValue, sample.live), sample.expected);
  });
}

for (const sample of fixture.entryFamily.returnCases) {
  test(`original entry approach return: ${sample.id}`, async () => {
    const family = await NativeMorphologyFamily.create(), scenes = fixture.entryFamily.scenes;
    const result = await family.record(sample.beforeObservation, sample.afterObservation, sample.proposal.actions[sample.index],
      scenes[sample.before].rows, scenes[sample.after].rows, sample.proposal, sample.index);
    assert.deepEqual(result.events, sample.expected === null ? [] : [sample.expected]);
    assert.deepEqual(sourceProjection(family.state()), sample.projection);
  });
}

test('entry continuation checkpoint rejects forged projections, changed event digests and repeated journal identities atomically', async () => {
  const { family } = await entrySequence(), good = family.state();
  const invalid: R[] = [];
  const noProjection = copy(good); noProjection.entry_access_return = null; invalid.push(noProjection);
  const forged = copy(good); forged.entry_access_return.after = 'forged-current-return'; invalid.push(forged);
  const changedEvent = copy(good); changedEvent.journal[0].event.after = 'changed-event'; invalid.push(changedEvent);
  const duplicate = copy(good); duplicate.journal.push(copy(duplicate.journal[0])); invalid.push(duplicate);
  const { entry_access_return: _pending, ...invalidLegacy } = copy(good);
  invalidLegacy.format = 'native.current_morphology.v1'; invalid.push(invalidLegacy);
  for (const value of invalid) {
    assert.throws(() => family.restoreNative(value), /Morphology|morphology/);
    assert.deepEqual(family.state(), good, 'Rejected restore cannot alter live evidence');
  }
});
