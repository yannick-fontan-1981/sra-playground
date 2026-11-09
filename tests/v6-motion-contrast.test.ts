import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { motionOffers, motionFootprint } from '../src/logos-engine/v6-motion-contrast.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { electInformationGoals, reconcileInformationGoal } from '../src/logos-engine/v6-information-goals.ts';

const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-motion-contrast-reference.json.gz', import.meta.url))).toString());
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
freeze(fixture);
const scenes = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]: [string, any]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const historyOf = (rows: readonly (readonly string[])[]) => rows.map(([before, command, after]) => [scenes[before!]!, command!, scenes[after!]!] as const);

test('motion producer reference executes byte-verified unchanged original source on synthetic public inputs', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([fixture.sourceVerification.verifiedOriginalFilesBefore, fixture.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([fixture.method.sourceModified, fixture.method.astTransformed, fixture.method.monkeyPatched, fixture.method.nativeExecution], [false, false, false, false]);
  assert.equal(fixture.cases.length, 29);
  assert.equal(fixture.cases.filter((row: any) => row.expected.length).length, 13);
  assert.ok(fixture.cases.find((row: any) => row.id === 'positive-attested-two-axis-rigid-role').sourceRigidControl);
  assert.equal(digest(await readFile(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/manifest.json`, import.meta.url))), fixture.sourceVerification.manifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url))), expected, path);
  }
  for (const name of ['motion_offers', '_single_rigid_track', 'rigid_role', 'footprint']) {
    assert.ok(fixture.executedSourceFunctions.some((row: any) => row.function === name && row.calls > 0), name);
  }
});

test('motion producer consumes the exact component projection of original geometry.pairs', () => {
  for (const [name, scene] of Object.entries(fixture.scenes) as [string, any][]) {
    assert.deepEqual(geometricComponents(scene.rows), scene.components, name);
  }
  for (const sample of fixture.footprints) {
    assert.deepEqual(motionFootprint(fixture.scenes[sample.scene].rows, sample.at, sample.size), sample.expected);
  }
});

for (const sample of fixture.cases) test(`original motion experiment parity: ${sample.id}`, async () => {
  const history = historyOf(sample.history), current = scenes[sample.current]!;
  const actual = await motionOffers(history, current, sample.admitted, sample.observation);
  assert.deepEqual(actual, sample.expected);
  // The source producer has no retained state; a later call must not acquire or
  // silently alter a role, an available command, or any earlier public frame.
  assert.deepEqual(await motionOffers(history, current, sample.admitted, sample.observation), sample.expected);
});

for (const sample of fixture.callerControlled) test(`source motion producer, information election and measured reconciliation: ${sample.id}`, async () => {
  const scope = { actions: sample.inputs, remaining_actions: sample.remaining,
    remaining_meter_steps: sample.meter?.steps_before_empty ?? null, preserve_cells: sample.observation.preserve_cells };
  const offers = (await motionOffers(historyOf(sample.history), scenes[sample.current]!, scope, sample.observation)).map(offer => ({ ...offer, source: 'motion_contrast' }));
  assert.deepEqual(offers, sample.expectedOffers);
  const election = [...electInformationGoals(offers, sample.observation, sample.remaining, sample.meter, sample.policy)];
  assert.deepEqual(election, sample.expectedElection);
  for (const reconciliation of sample.reconciliations) {
    assert.deepEqual(reconcileInformationGoal(election[0]![1], sample.observation, fixture.scenes[reconciliation.after].observation, null), reconciliation.expected);
  }
});
