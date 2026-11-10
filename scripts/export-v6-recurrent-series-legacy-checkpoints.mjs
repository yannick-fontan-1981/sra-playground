/** Produce legacy expectations using only an explicitly selected published
 * native 0.49 checkout. Synthetic retained evidence; no game host or action.
 * Usage: node scripts/export-v6-recurrent-series-legacy-checkpoints.mjs CHECKOUT OUTPUT.gz
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [checkout, output] = process.argv.slice(2);
assert.ok(checkout && output, 'Published checkout and new output path required');
const base = resolve(checkout), target = resolve(ROOT, output);
try { await access(target); throw new Error('Output already exists'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(resolve(base, 'docs/migration/lot3h-evidence/final/source-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: base, encoding: 'utf8' }).trim();
assert.equal(commit, '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f');
assert.equal(manifest.digest, 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054');
assert.equal(manifest.fileCount, 268);
async function verify() {
  for (const [path, expected] of Object.entries(manifest.files)) {
    assert.equal(hash(await readFile(resolve(base, path))), expected, path);
  }
}
await verify();
const fixtures = {};
async function fixture(path, compressed = true) {
  const bytes = await readFile(resolve(base, path)); fixtures[path] = hash(bytes);
  return JSON.parse(compressed ? gunzipSync(bytes) : bytes);
}
const older = await fixture('tests/fixtures/v6-crossed-prefix-legacy-checkpoints.json.gz');
const crossed = await fixture('tests/fixtures/v6-crossed-prefix-reference.json.gz');
const occurrence = await fixture('tests/fixtures/v6-occurrence-reference.json', false);
const sparse = occurrence.scenarios.flatMap(scenario => scenario.steps)
  .filter(step => step.operation.kind === 'apply_event'
    && /^(repeated_line_|supported_)/.test(step.operation.event.kind)).map(step => step.operation.event);
assert.deepEqual(sparse.map(event => event.kind), ['repeated_line_trial', 'repeated_line_scored',
  'supported_insertion_observation', 'supported_insertion_order', 'supported_line_refutation']);
const crossedEvents = crossed.chains.find(item => item.id === 'compatible_pair').events;
assert.equal(crossedEvents.length, 7);
const { SharedSeriesConstraint } = await import(pathToFileURL(resolve(base, 'src/logos-engine/v6-shared-series.ts')));
const cases = [];
const capture = (id, state = null, events = []) => {
  const family = new SharedSeriesConstraint(older.policy);
  if (state !== null) family.restore(structuredClone(state));
  for (const event of structuredClone(events)) { family.memory.applyEvent(event); family.events.push(event); }
  const retained = family.state(), restored = new SharedSeriesConstraint(older.policy);
  restored.restore(retained); assert.deepEqual(restored.state(), retained);
  cases.push({ id, state: retained });
};
for (const item of older.cases) capture(item.id, item.state);
capture('crossed_acquired', null, crossedEvents);
capture('legacy_repeated', null, sparse.slice(0, 2));
capture('legacy_supported', null, sparse.slice(2));
capture('legacy_series', null, sparse);
capture('minimal_public_trial', null, [{ kind: 'repeated_line_trial', trial: 'public-reducer-change' }]);
capture('legacy_replacements', null, [...sparse,
  { kind: 'repeated_line_trial', trial: 'second', epoch: 2 },
  { kind: 'repeated_line_trial', trial: 'trial', epoch: 3 },
  { kind: 'supported_insertion_order', source: 'source', epoch: 3 }]);
capture('opaque_unicode_rejections', null, [
  { kind: 'supported_line_refutation', trial: '\uE000', epoch: 1 },
  { kind: 'supported_line_refutation', trial: '\u{10000}', epoch: 1 },
]);
capture('combined_with_series', older.cases.find(item => item.id === 'combined').state, [...crossedEvents, ...sparse]);
await verify();
const value = { schema: 'logos-engine.native-shared-legacy-checkpoints.v1',
  generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  source: { commit, siteVersion: 78, nativeVersion: '0.49.0', nativeDigest: manifest.digest, fileCount: manifest.fileCount,
    manifestSha256: hash(manifestBytes), unchanged: true },
  fixtureFiles: fixtures, policy: older.policy, sparseEvents: sparse, cases,
  qualification: 'Nineteen checkpoints produced and reloaded by the published native 0.49 source from Site 78. The unchanged native digest matches Site 77. Both original repeated/supported digest slots include sparse historical events and replacement behavior; the minimal public reducer event matches the published native mutation test. An opaque mixed BMP/non-BMP rejection fixture preserves the historical shared UTF-16 ordering, separately from source Unicode ordering; actually produced trial identities are ASCII hexadecimal. Other acquired layers and CrossedPrefix are retained. Synthetic contracts only; no game result, new implementation or new source oracle supplies these expected digests.' };
assert.equal(cases.length, 19);
await writeFile(target, gzipSync(JSON.stringify(value) + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ path: relative(ROOT, target), cases: cases.length, sourceDigest: manifest.digest, commit }));
