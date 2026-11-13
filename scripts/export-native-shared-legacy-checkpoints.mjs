/** Retain checkpoints produced by an explicitly selected published native checkout.
 * Usage: node scripts/export-native-shared-legacy-checkpoints.mjs CHECKOUT OUTPUT.gz
 * Pure synthetic/event fixtures only; no game host, policy change or game action.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [checkout, output] = process.argv.slice(2);
assert.ok(checkout && output, 'Published checkout and new output path required');
const base = resolve(checkout), target = resolve(ROOT, output);
try { await access(target); throw new Error('Output already exists'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(resolve(base, 'docs/migration/lot3b-state-cost-evidence/final/source-manifest.json'));
const manifest = JSON.parse(manifestBytes);
async function verify() {
  for (const [path, expected] of Object.entries(manifest.files)) {
    assert.equal(hash(await readFile(resolve(base, path))), expected, path);
  }
}
await verify();
const pairBytes = await readFile(resolve(base, 'tests/fixtures/v6-coupled-pair-planning-reference.json.gz'));
const pair = JSON.parse(gunzipSync(pairBytes));
const { SharedSeriesConstraint } = await import(pathToFileURL(resolve(base, 'src/logos-engine/v6-shared-series.ts')));
const panel = { kind: 'observed_panel_service', memory: { symbols: [], evidence: ['panel'], selection_observed: true, effects: [], failed: [] }, detail: {} };
const chamber = { kind: 'observed_chamber_relations', memory: {
  rows: { measured: { '["left"]': { value: '0', evidence: ['before', 'after'] } } },
  edges: {}, evidence: ['before', 'after'], conflicts: [], failed: [], boundaries: [] }, detail: {} };
const cases = [];
for (const [id, events] of [
  ['empty', []], ['paired', pair.states.small.events], ['panel', [panel]],
  ['chamber', [chamber]], ['combined', [...pair.states.small.events, chamber, panel]],
]) {
  const family = new SharedSeriesConstraint(pair.policy.recall);
  for (const event of structuredClone(events)) {
    if (event.kind === 'observed_panel_service') family.panel.applyEvent(event);
    else if (event.kind === 'observed_chamber_relations') family.chamber.applyEvent(event);
    else family.pairs.applyEvent(event);
    family.events.push(event);
  }
  const state = family.state();
  const restored = new SharedSeriesConstraint(pair.policy.recall); restored.restore(state);
  assert.deepEqual(restored.state(), state);
  cases.push({ id, state });
}
await verify();
const value = { schema: 'logos-engine.native-shared-legacy-checkpoints.v1',
  generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  source: { nativeDigest: manifest.digest, fileCount: manifest.fileCount, manifestSha256: hash(manifestBytes), unchanged: true },
  pairFixtureSha256: hash(pairBytes), policy: pair.policy.recall, cases,
  qualification: 'Five checkpoints produced and reloaded by the published native0.42 source. Synthetic/event contracts only; no new game result or future native source supplies the expected digests.' };
await writeFile(target, gzipSync(JSON.stringify(value) + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ path: relative(ROOT, target), cases: cases.length, sourceDigest: manifest.digest }));
