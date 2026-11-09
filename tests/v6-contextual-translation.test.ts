import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { contextualTranslationExposures } from '../src/logos-engine/v6-contextual-translation.ts';
import { Snapshot, registered } from '../src/logos-engine/v6-composition-memory.ts';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-contextual-translation-reference.json.gz', import.meta.url))).toString());
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
freeze(fixture);
const scenes = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]: [string, any]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const historyOf = (rows: readonly (readonly string[])[]) => rows.map(([before, command, after]) => [scenes[before!]!, command!, scenes[after!]!] as const);

test('contextual exposure reference executes byte-verified unchanged original source on synthetic public inputs', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.contextual-translation-reference.v1');
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([fixture.sourceVerification.verifiedOriginalFilesBefore, fixture.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([fixture.method.sourceModified, fixture.method.astTransformed, fixture.method.monkeyPatched, fixture.method.nativeExecution], [false, false, false, false]);
  assert.equal(fixture.cases.length, 45);
  assert.equal(fixture.cases.filter((sample: any) => Object.keys(sample.expected).length).length, 21);
  assert.equal(digest(await readFile(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/manifest.json`, import.meta.url))), fixture.sourceVerification.manifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url))), expected, path);
  }
  for (const name of ['contextual_translation_exposures', 'registered', 'identity', 'footprint', 'pairs', 'components']) {
    assert.ok(fixture.executedSourceFunctions.some((row: any) => row.function === name && row.calls > 0), name);
  }
});

test('contextual exposure consumes the exact original geometry.pairs component projection', () => {
  for (const [name, scene] of Object.entries(fixture.scenes) as [string, any][]) {
    assert.deepEqual(geometricComponents(scene.rows), scene.components, name);
  }
});

for (const sample of fixture.cases) test(`original contextual exposure parity: ${sample.id}`, async () => {
  const history = historyOf(sample.history), current = scenes[sample.current]!;
  assert.deepEqual(history.map(([before, , after]) => registered(before, after)), sample.registeredPairs);
  assert.deepEqual(history.map(([, , after]) => registered(after, current)), sample.registeredToCurrent);
  const actual = await contextualTranslationExposures(history, current, sample.commands);
  assert.deepEqual(actual, sample.expected, sample.purpose);
  assert.deepEqual(Object.keys(actual), Object.keys(sample.expected));
  // Snapshots and admission data are immutable. Calling the source measurement
  // twice must not retain an acquired control or change witness selection.
  assert.deepEqual(await contextualTranslationExposures(history, current, sample.commands), sample.expected);
});
