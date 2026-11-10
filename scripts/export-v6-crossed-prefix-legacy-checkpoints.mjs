/** Retain checkpoints produced by an explicitly selected published native checkout.
 * Usage: node scripts/export-v6-crossed-prefix-legacy-checkpoints.mjs CHECKOUT OUTPUT.gz
 * Pure synthetic/event fixtures only; no game host, policy change or game action.
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
const manifestBytes = await readFile(resolve(base, 'docs/migration/lot3g-evidence/final/source-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: base, encoding: 'utf8' }).trim();
assert.equal(commit, 'fbbc3fb6b796c0ba359654da7234008767090e1f');
assert.equal(manifest.digest, 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26');
assert.equal(manifest.fileCount, 266);
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
const exposed = { kind: 'observed_exposed_reception',
  state: { epoch: 1, layout: 'measured-layout', evidence: ['before', 'after'], probed: [], dial_tried: [] },
  controls: { ACTION4: { delta: [1, 0], evidence: ['before', 'after'] } },
  models: { coupled: {}, attached: {}, color_edges: [], repulsion: {} },
  detail: { command: { action_ref: 'ACTION4' }, before: 'before', after: 'after' } };
const rooted = { kind: 'observed_rooted_line', memory: { epoch: 1, controls: {}, current: null, tried: ['ACTION1'], evidence: ['root-before', 'root-after'], refuted: [] }, detail: { kind: 'calibrate', boundary: false, matched: null } };
const { freshReceptionServiceMemory } = await import(pathToFileURL(resolve(base, 'src/logos-engine/v6-reception-service-access.ts')));
const reception = { kind: 'observed_reception_service', memory: { ...freshReceptionServiceMemory(), epoch: 1,
  evidence: ['reception-before', 'reception-after'], trials: { ACTION1: 1 }, wait_spent: 3,
  controls: { ACTION1: { delta: [0, -4], evidence: ['reception-before', 'reception-after'], status: 'provisional_observed_control' } } },
  detail: { command: { action_ref: 'ACTION1' }, before: 'reception-before', after: 'reception-after', boundary: false,
    kind: 'control_probe', matched: null, carrier_delta: [0, -4] } };
const populationBytes = await readFile(resolve(base, 'tests/fixtures/v6-reference-population-reference.json.gz'));
const populationFixture = JSON.parse(gunzipSync(populationBytes));
const population = populationFixture.cases.find(value => value.id === 'record:common_cold_control').expected.find(event => event.kind === 'observed_reference_population');
assert.ok(population, 'Published fixture must provide an actual source-acquired population event');
const framedBytes = await readFile(resolve(base, 'tests/fixtures/v6-framed-window-reference.json.gz'));
const framedFixture = JSON.parse(gunzipSync(framedBytes));
const framed = framedFixture.cases.find(value => value.id === 'record:no_progress').expectedOwnEvents.find(event => event.kind === 'framed_window_response');
assert.ok(framed, 'Published fixture must provide an actual source-acquired framed-window response');
const occurrenceBytes = await readFile(resolve(base, 'tests/fixtures/v6-occurrence-reference.json'));
const occurrenceFixture = JSON.parse(occurrenceBytes);
const legacyCrossed = occurrenceFixture.scenarios.flatMap(scenario => scenario.steps)
  .filter(step => step.operation.kind === 'apply_event' && step.operation.event.kind.startsWith('crossed_prefix_'))
  .map(step => step.operation.event);
assert.equal(legacyCrossed.length, 3);
assert.deepEqual(legacyCrossed.map(event => event.kind), ['crossed_prefix_state', 'crossed_prefix_pair', 'crossed_prefix_input']);
const cases = [];
for (const [id, events] of [
  ['empty', []], ['paired', pair.states.small.events], ['panel', [panel]],
  ['chamber', [chamber]], ['exposed', [exposed]], ['rooted', [rooted]], ['reception', [reception]],
  ['population', [population]], ['framed', [framed]], ['legacy_crossed', legacyCrossed],
  ['combined', [...pair.states.small.events, exposed, chamber, panel, rooted, reception, population, framed]],
]) {
  const family = new SharedSeriesConstraint(pair.policy.recall);
  for (const event of structuredClone(events)) {
    if (event.kind === 'observed_panel_service') family.panel.applyEvent(event);
    else if (event.kind === 'observed_chamber_relations') family.chamber.applyEvent(event);
    else if (event.kind === 'observed_exposed_reception') family.exposed.applyEvent(event);
    else if (event.kind === 'observed_rooted_line') family.rootedLine.applyEvent(event);
    else if (event.kind === 'observed_reception_service') family.reception.applyEvent(event);
    else if (event.kind === 'observed_reference_population') family.population.applyEvent(event);
    else if (event.kind === 'framed_window_response') family.framedWindow.applyEvent(event);
    else if (event.kind.startsWith('crossed_prefix_')) family.memory.applyEvent(event);
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
  source: { commit, siteVersion: 76, nativeVersion: '0.48.0', nativeDigest: manifest.digest, fileCount: manifest.fileCount, manifestSha256: hash(manifestBytes), unchanged: true },
  pairFixtureSha256: hash(pairBytes), populationFixtureSha256: hash(populationBytes),
  framedFixtureSha256: hash(framedBytes), occurrenceFixtureSha256: hash(occurrenceBytes), policy: pair.policy.recall, cases,
  qualification: 'Eleven checkpoints produced and reloaded by the published native 0.48 source from Site 76, commit fbbc3fb6b796c0ba359654da7234008767090e1f. Ten old-layer checkpoint categories include FramedWindow; an additional legacy CrossedPrefix journal preserves the exact pre-existing occurrence fixture events, including a sparse pair without inputs/evidence. Synthetic/event contracts only; no new game result or future native source supplies the expected digests.' };
await writeFile(target, gzipSync(JSON.stringify(value) + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ path: relative(ROOT, target), cases: cases.length, sourceDigest: manifest.digest }));
