#!/usr/bin/env node
/** Factory-only comparison of the published V60 registration gap.
 * No game is loaded, no observation is initialized and no action is requested.
 * Usage: node scripts/prove-native-morphology-registration-gap.mjs BASELINE_ROOT OUTPUT.json
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_COMMIT = '9be3d0434f6f8ff91236d61a51eafa4017c3a082';
const REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const SOURCE = `reference/v6/${REFERENCE_COMMIT}/source/agents/yf_arc3_v6`;
const DECLARATIONS = {
  common: `${SOURCE}/laya_proto/common_frontier_policy.drm.json`,
  strategy: `${SOURCE}/morphology_policy/strategy.drm`,
};
const hash = value => createHash('sha256').update(value).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const baselineRoot = resolve(process.argv[2] ?? '');
const output = resolve(process.argv[3] ?? '');
assert.ok(process.argv[2] && process.argv[3], 'Baseline checkout and output path are required');
assert.notEqual(baselineRoot, ROOT, 'The historical baseline must be independent');

async function nativeInventory(root) {
  const names = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(root, full));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(root, folder));
  const files = {};
  for (const name of names.sort()) files[name] = hash(await readFile(resolve(root, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
async function declarations(root) {
  const values = {}, files = {};
  for (const [name, path] of Object.entries(DECLARATIONS)) {
    const bytes = await readFile(resolve(root, path));
    files[path] = hash(bytes); values[name] = JSON.parse(bytes);
  }
  return { values, files };
}
async function factory(root, declared) {
  const started = performance.now();
  const module = await import(pathToFileURL(resolve(root, 'src/logos-engine/v6-native-runtime.ts')).href);
  const runtime = await module.createNativeV6Runtime(declared);
  const snapshot = runtime.snapshot();
  assert.deepEqual([snapshot.actions, snapshot.cycles, snapshot.acquiredRecords], [0, 0, 0]);
  assert.equal(snapshot.nodeCount, null);
  assert.equal(snapshot.proposal, null);
  assert.equal(snapshot.caller.enabled, false);
  assert.equal(snapshot.coverage.fullV6Parity, false);
  return { snapshot, factoryAndSnapshotElapsedMs: performance.now() - started };
}

const startedAt = new Date().toISOString();
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: baselineRoot, encoding: 'utf8' }).trim(), BASELINE_COMMIT);
execFileSync('git', ['diff', '--exit-code', BASELINE_COMMIT, '--', 'src/logos-engine', 'src/runtime'], { cwd: baselineRoot });
const baselineExpected = await json(resolve(baselineRoot, 'docs/migration/lot1-evidence/final/source-manifest.json'));
const currentExpected = await json(resolve(ROOT, 'docs/migration/lot2a-evidence/final/source-manifest.json'));
const before = { baseline: await nativeInventory(baselineRoot), current: await nativeInventory(ROOT) };
assert.deepEqual(before.baseline, baselineExpected, 'Historical native files differ from the published frozen baseline');
assert.deepEqual(before.current, currentExpected, 'Current native files differ from the frozen lot 2A source');
const baselineDeclarations = await declarations(baselineRoot), currentDeclarations = await declarations(ROOT);
assert.deepEqual(baselineDeclarations.files, currentDeclarations.files, 'Both factories must consume the same source declarations');
const baseline = await factory(baselineRoot, baselineDeclarations.values);
const current = await factory(ROOT, currentDeclarations.values);
const beforeGroup = baseline.snapshot.coverage.sourceGroups.find(group => group.id === 'morphology');
const afterGroup = current.snapshot.coverage.sourceGroups.find(group => group.id === 'morphology');
assert.ok(beforeGroup && afterGroup, 'Both actual factory snapshots must expose the declared source group');
assert.deepEqual(beforeGroup.families, []);
assert.deepEqual(afterGroup.families, ['morphology']);
assert.equal(baseline.snapshot.coverage.registeredFamilies.includes('morphology'), false);
assert.equal(current.snapshot.coverage.registeredFamilies.includes('morphology'), true);
assert.deepEqual(current.snapshot.coverage.registeredFamilies.filter(name => name !== 'morphology'), baseline.snapshot.coverage.registeredFamilies);
assert.deepEqual(current.snapshot.coverage.sourceGroups.filter(group => group.id !== 'morphology'),
  baseline.snapshot.coverage.sourceGroups.filter(group => group.id !== 'morphology'));
assert.deepEqual(current.snapshot.coverage.emptySourceGroups, baseline.snapshot.coverage.emptySourceGroups.filter(name => name !== 'morphology'));
const after = { baseline: await nativeInventory(baselineRoot), current: await nativeInventory(ROOT) };
assert.deepEqual(after, before, 'Factory observation must leave both native inventories unchanged');
const scriptPath = relative(ROOT, fileURLToPath(import.meta.url));
const result = {
  schema: 'logos-engine.v6.morphology-registration-gap.v1',
  status: 'passed', startedAt, completedAt: new Date().toISOString(),
  scope: 'Public snapshots of two actual uninitialized native factories; registration only.',
  qualification: 'This proves the published V60 morphology source group was empty and the current factory registers its provider at the same declared group. It proves no selected decision, authorization, acquired transition, game success or complete morphology parity.',
  callsPerVersion: { factory: 1, snapshot: 1, initialize: 0, resume: 0, advance: 0, gameLoads: 0, actions: 0 },
  baseline: { publishedVersion: 60, commit: BASELINE_COMMIT, checkout: baselineRoot, native: before.baseline, ...baseline },
  current: { checkout: ROOT, native: before.current, ...current },
  declarations: currentDeclarations.files,
  sourceReferenceCommit: REFERENCE_COMMIT,
  observedDifference: { beforeGroup, afterGroup, otherGroupsUnchanged: true, otherRegisteredFamiliesUnchanged: true },
  integrity: { nativeBeforeAfterEqual: true, declarationsEqual: true, originalReferenceSourceEdited: false },
  generator: { path: scriptPath, sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  timingQualification: 'Elapsed factory time includes import and snapshot overhead during concurrent development. It is not a benchmark or a game-performance measurement.',
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify({ status: result.status, output, before: beforeGroup.families, after: afterGroup.families,
  nativeUnchanged: true, baselineFactoryMs: baseline.factoryAndSnapshotElapsedMs, currentFactoryMs: current.factoryAndSnapshotElapsedMs }) + '\n');
