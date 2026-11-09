import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { NativeMorphologyPolicy } from '../src/logos-engine/v6-morphology-policy.ts';
import { morphologyPairs, measureMorphologyRoutes, observedMorphologySelectiveChange } from '../src/logos-engine/v6-morphology-measurements.ts';
import { ObservedMeter } from '../src/logos-engine/v6-inventory-caller-context.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-measurements-reference.json.gz', import.meta.url))).toString());
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
freeze(fixture);
const scenes: Record<string, Snapshot> = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]: [string, any]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const historyOf = (rows: readonly (readonly string[])[]) => rows.map(([first, command, second]) => [scenes[first!]!, command!, scenes[second!]!] as const);
const policy = await NativeMorphologyPolicy.create();
function originalFields(result: R): R {
  const { trace: _trace, instructions: _instructions, execution_engine: _engine,
    reference_commit: _commit, reference_semantic_hash: _semantic,
    all_executed_statements: _all, instruction_quantum: _quantum, ...original } = result;
  return original;
}

test('morphology producer fixture executes byte-verified original V5/V6 on measured public rasters', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([fixture.sourceVerification.verifiedOriginalFilesBefore, fixture.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([fixture.method.sourceModified, fixture.method.astTransformed, fixture.method.monkeyPatched, fixture.method.nativeExecution], [false, false, false, false]);
  assert.equal(digest(await readFile(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/manifest.json`, import.meta.url))), fixture.sourceVerification.manifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url))), expected, path);
  }
  for (const name of ['measure_routes', 'pairs', 'matched_pairs', 'rigid_role', 'measure_centered_enclosure_identities']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
});

test('current centered enclosures and homologous pairs match the original on all measured scenes', async () => {
  for (const [name, scene] of Object.entries(fixture.scenes) as [string, R][]) {
    const [pairs, parts] = await morphologyPairs(scene.rows);
    assert.deepEqual(pairs, scene.pairs, name);
    assert.deepEqual(parts, scene.components, name);
  }
});

for (const sample of fixture.cases) test(`original current morphology measures and policy: ${sample.id}`, async () => {
  const inputs = {
    history: historyOf(sample.history), current: scenes[sample.current]!, limit: sample.limit,
    contacts: new Map<string, R>(sample.contacts.map(([key, value]: [unknown, R]) => [JSON.stringify(key), value])),
    tried: new Set<string>(sample.tried), available: sample.available,
    actionBudget: sample.actionBudget, meterForecast: sample.meterForecast, stationMethod: sample.stationMethod,
    featureTrials: sample.featureTrials,
  };
  const actual = await measureMorphologyRoutes(inputs);
  assert.deepEqual(actual.facts, sample.expectedFacts);
  assert.deepEqual(actual.plans, sample.expectedPlans);
  // The source adapter removes unavailable route actions before evaluation.
  const admittedFacts = structuredClone(actual.facts);
  for (const name of Object.keys(admittedFacts.routes)) {
    if (actual.plans[name].steps.some((step: R) => !sample.available.includes(step.action_ref))) delete admittedFacts.routes[name];
  }
  Object.assign(admittedFacts, { meter_forecast: sample.meterForecast, extension_route: null, extension_kind: null });
  assert.deepEqual(admittedFacts, sample.admittedFacts);
  const decision = await policy.evaluate(admittedFacts);
  assert.deepEqual(originalFields(decision), sample.expectedDecision);
  assert.equal(decision.release_authority, false);
  // Producers acquire no domain state. Repeating them preserves both the
  // source history and the current scoped answer.
  const repeated = await measureMorphologyRoutes(inputs);
  assert.deepEqual(repeated.facts, actual.facts);
  assert.deepEqual(repeated.plans, actual.plans);
});

test('a short committed prefix does not make the complete observed access affordable', async () => {
  const sample = fixture.cases.find((row: R) => row.id === 'short-prefix-does-not-falsify-full-access-cost');
  assert.equal(sample.expectedPlans.modifier.steps.length, 2);
  assert.equal(sample.expectedPlans.modifier.full_access_length, 5);
  assert.equal(sample.meterForecast.steps_before_empty, 3);
  assert.equal(sample.expectedDecision.route_key, null);
  assert.equal(sample.expectedDecision.reason, 'access_exceeds_observed_meter_seek_affordable_effect');
});

test('existing forecast owner measures the source strip sequence, survives restore and supplies current scope', () => {
  let meter = new ObservedMeter();
  fixture.meter.scenes.forEach((name: string, index: number) => {
    const scene = scenes[name]!;
    meter.observe(scene.epoch, scene.ref, scene.rows, fixture.meter.primitiveIndices[index]);
    assert.deepEqual(meter.forecast(), fixture.meter.forecasts[index]);
    const next = new ObservedMeter(); next.restore(meter.state()); meter = next;
    assert.deepEqual(meter.forecast(), fixture.meter.forecasts[index]);
  });
  const before = meter.state(), current = scenes[fixture.meter.scenes.at(-1)]!;
  meter.observe(current.epoch, current.ref, current.rows, 4);
  assert.deepEqual(meter.state(), before, 'Same public observation is acquired once');
  assert.equal(meter.forecast()?.observation_ref, current.ref);
  meter.observe(2, 'new-scope', current.rows, 0);
  assert.equal(meter.forecast(), null, 'Foreign epoch cannot reuse prior depletion forecast');
});

test('one measured orientation return binds the unchanged peer without assigning a palette role', async () => {
  const sample = fixture.selective;
  assert.deepEqual(await observedMorphologySelectiveChange(scenes[sample.before]!.rows, scenes[sample.after]!.rows, sample.pair), sample.unchangedPeer);
  assert.equal(await observedMorphologySelectiveChange(scenes[sample.before]!.rows, scenes[sample.before]!.rows, sample.pair), null);
});

test('measured rotations, reflection, palette permutation and translation preserve useful selection', () => {
  for (const suffix of ['rotated', 'reflected', 'recolored', 'translated']) {
    const sample = fixture.cases.find((row: R) => row.id === 'generic-' + suffix);
    assert.equal(sample.expectedDecision.route_key, 'modifier');
    assert.equal(sample.expectedPlans.modifier.steps.length, 5);
    assert.equal(sample.sourceRigidControl, true);
  }
});
