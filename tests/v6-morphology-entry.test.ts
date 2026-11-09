import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { approachMorphologyEntry, morphologyEntryContour, morphologyEntryPerimeterValues, resumeMorphologyEntry } from '../src/logos-engine/v6-morphology-entry.ts';
import { ObservedMeter } from '../src/logos-engine/v6-inventory-caller-context.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-entry-reference.json.gz', import.meta.url))).toString());
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
freeze(fixture);
const scenes: Record<string, Snapshot> = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]: [string, any]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
freeze(scenes);
const historyOf = (rows: readonly (readonly string[])[]) => rows.map(([first, command, second]) => [scenes[first!]!, command!, scenes[second!]!] as const);

test('entry references execute unchanged original consumers and geometry with complete source verification', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.morphology-entry-reference.v1');
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([fixture.sourceVerification.verifiedOriginalFilesBefore, fixture.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([fixture.method.sourceModified, fixture.method.astTransformed, fixture.method.monkeyPatched, fixture.method.nativeExecution], [false, false, false, false]);
  for (const generator of [fixture.generator, fixture.sharedGenerator]) {
    assert.equal(digest(await readFile(new URL('../' + generator.path, import.meta.url))), generator.sha256);
  }
  assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/manifest.json`, import.meta.url))), fixture.sourceVerification.manifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url))), expected, path);
  }
  for (const name of ['approach', 'resume', 'contour', 'perimeter_values', 'recalled_directions', 'measure_routes', 'pairs', 'registered', 'ObservedMeter.forecast']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
  assert.ok(fixture.casesApproach.length + fixture.casesResume.length + fixture.casesContour.length >= 80);
  assert.match(fixture.scope, /do not establish acquisition/);
});

for (const sample of fixture.casesApproach) test(`original entry approach: ${sample.id}`, async () => {
  const args = sample.args, facts = structuredClone(args.facts), history = historyOf(args.history);
  const actual = await approachMorphologyEntry(args.method, history, scenes[args.current]!, args.observation, facts,
    args.remaining, args.available, args.forecast, null);
  assert.deepEqual(actual, sample.expected);
  assert.deepEqual(facts, sample.expectedFacts);
  if (sample.expected === null) assert.deepEqual(facts, args.facts, 'Refusal must leave consumer facts untouched');
  const secondFacts = structuredClone(args.facts);
  const repeated = await approachMorphologyEntry(args.method, history, scenes[args.current]!, args.observation, secondFacts,
    args.remaining, args.available, args.forecast, null);
  assert.deepEqual(repeated, actual, 'Pure producer owns no hidden history or reused plan state');
  assert.deepEqual(secondFacts, facts);
});

for (const sample of fixture.casesResume) test(`original entry continuation: ${sample.id}`, async () => {
  const args = sample.args, facts = structuredClone(args.facts);
  const actual = await resumeMorphologyEntry(args.pending, scenes[args.current]!, args.observation, facts,
    args.remaining, args.available, args.forecast);
  assert.deepEqual(actual, sample.expected);
  assert.deepEqual(facts, sample.expectedFacts);
  if (sample.expected === null) assert.deepEqual(facts, args.facts, 'All saved return guards precede enrichment');
  else {
    assert.equal(actual!.steps, args.pending.plan.steps, 'Source shallow expansion retains nested step identity');
    assert.notEqual(actual!.evidence, args.pending.plan.evidence, 'Return evidence is newly constructed in source order');
  }
  if (args.pending?.plan?.consumer_extension) {
    assert.equal(actual!.consumer_extension, args.pending.plan.consumer_extension, 'Unknown plan fields retain the source shallow copy contract');
  }
  const secondFacts = structuredClone(args.facts);
  assert.deepEqual(await resumeMorphologyEntry(args.pending, scenes[args.current]!, args.observation, secondFacts,
    args.remaining, args.available, args.forecast), actual);
  assert.deepEqual(secondFacts, facts);
});

for (const sample of fixture.casesContour) test(`original contour and perimeter: ${sample.id}`, () => {
  assert.deepEqual(morphologyEntryContour(sample.rows, sample.point, sample.size, sample.exclude), sample.expectedContour);
  assert.deepEqual([...morphologyEntryPerimeterValues(sample.rows, sample.point, sample.size)].sort((a, b) => a - b), sample.expectedPerimeter);
});

test('approach reserve fixtures are measured by the existing native meter owner', () => {
  for (const sample of fixture.measuredMeters) {
    const meter = new ObservedMeter();
    sample.scenes.forEach((name: string, index: number) => {
      const current = scenes[name]!;
      meter.observe(current.epoch, current.ref, current.rows, index);
    });
    assert.deepEqual(meter.forecast(), sample.forecast);
  }
});

test('source preserves deferred uncertainty and the two-family common prefix', () => {
  const deferred = fixture.casesApproach.find((sample: R) => sample.id === 'positive-deferred-contour').expected;
  assert.equal(deferred.steps.length, 3);
  assert.equal(deferred.last_effect_unknown, false);
  assert.deepEqual(deferred.deferred_probe.steps[0].from, deferred.steps.at(-1).to);
  const common = fixture.casesApproach.find((sample: R) => sample.id === 'positive-common-prefix-of-two-goal-families');
  assert.deepEqual(common.expectedFacts.entry_rebind_goals.map((goal: R) => goal.family), ['capacity_probe', 'feature_probe']);
  const resumed = fixture.casesResume.find((sample: R) => sample.id === 'positive-return-base').expected;
  assert.equal(resumed.last_effect_unknown, true);
  assert.equal(resumed.information_cost, 1);
  assert.equal(resumed.risks.includes('reverse_is_not_yet_observed_in_this_epoch'), true);
});
