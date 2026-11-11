#!/usr/bin/env node
/** Capture exact, non-timing work forms before the follow-up cost window.
 * Usage: node SCRIPT BASELINE_CHECKOUT PERFORMANCE_DIR BASELINE_MANIFEST CANDIDATE_MANIFEST
 * Runs eight functional sessions, never an official cost cohort. The unchanged
 * official worker and its exact bridge/trial functions are reused in memory.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { workSignature } from '../../../../../scripts/compare-native-cost-cohorts.mjs';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot7b-evidence/followup-recovery');
const HARNESS = 'scripts/measure-native-loop-costs.mjs';
const COMPARATOR = 'scripts/compare-native-cost-cohorts.mjs';
const SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const DECLARATIONS = [SOURCE + 'laya_proto/common_frontier_policy.drm.json', SOURCE + 'morphology_policy/strategy.drm'];
const hash = value => createHash('sha256').update(value).digest('hex');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const digest = value => hash(JSON.stringify(ordered(value)));
const inside = (root, path) => { const name = relative(root, path); return name && !name.startsWith('..') && !name.startsWith('/'); };
async function fp(path, checkout = ROOT) {
  const bytes = await readFile(path);
  return { path: inside(ROOT, path) ? relative(ROOT, path) : path, sha256: hash(bytes), bytes: bytes.length };
}
async function absent(path) { try { await access(path); throw new Error('Refusing existing output or window: ' + path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
async function inventory(checkout) {
  const names = [];
  async function visit(folder) { for (const item of await readdir(folder, { withFileTypes: true })) {
    const path = resolve(folder, item.name);
    if (item.isDirectory()) await visit(path);
    else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(checkout, path));
  } }
  for (const folder of ['src/logos-engine', 'src/runtime']) await visit(resolve(checkout, folder));
  const files = {};
  for (const name of names.sort()) files[name] = hash(await readFile(resolve(checkout, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
async function importedHarness(checkout) {
  const path = resolve(checkout, HARNESS), original = await readFile(path, 'utf8');
  const footer = 'if (isMainThread) await main(); else await workerMain();';
  assert.equal(original.split(footer).length, 2, 'Official harness entry point changed');
  let source = original.replace(footer, 'export { bridge, trial };');
  // Location-only substitutions let the retained functions execute from a data
  // module. Worker creation still points to the unchanged official disk file.
  const locationCount = source.split('import.meta.url').length - 1;
  assert.equal(locationCount, 4, 'Official harness location uses changed');
  source = source.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(path).href));
  const imports = ['../src/logos-engine/v6-native-runtime.ts', '../src/runtime/v6-agent-service.ts', '../src/runtime/v6-agent.ts'];
  for (const name of imports) {
    const expression = `import('${name}')`;
    assert.equal(source.split(expression).length, 2, 'Official harness import changed: ' + name);
    source = source.replace(expression, `import(${JSON.stringify(pathToFileURL(resolve(dirname(path), name)).href)})`);
  }
  return { module: await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
    derivation: { source: await fp(path), entryPointReplacementCount: 1, locationReplacementCount: locationCount,
      relativeImportReplacementCount: imports.length, transformedSourceSha256: hash(source),
      workerFileUnmodified: true, bridgeAndTrialBodiesUnchangedExceptModuleLocations: true } };
}

async function main() {
  const [baselineArgument, performanceArgument, baselineManifestArgument, candidateManifestArgument] = process.argv.slice(2);
  assert.equal(process.argv.length, 6, 'Usage: node SCRIPT BASELINE_CHECKOUT PERFORMANCE_DIR BASELINE_MANIFEST CANDIDATE_MANIFEST');
  const baseline = await realpath(resolve(baselineArgument)), performanceDir = resolve(ROOT, performanceArgument);
  assert.notEqual(baseline, ROOT);
  assert.ok(inside(BASE, performanceDir));
  const paths = { declaration: resolve(performanceDir, 'strict-work-declaration.json'), forms: resolve(performanceDir, 'strict-work-forms.json'),
    receipt: resolve(performanceDir, 'strict-work-capture.json') };
  for (const path of [...Object.values(paths), resolve(performanceDir, 'window.json'), resolve(performanceDir, 'readiness.json')]) await absent(path);
  await mkdir(performanceDir, { recursive: true });
  const startedAt = new Date().toISOString(), watched = new Map();
  async function input(path) { const record = await fp(path); watched.set(path, record); return JSON.parse(await readFile(path, 'utf8')); }
  const casesPath = resolve(performanceDir, 'cases.json'), cases = await input(casesPath);
  assert.equal(cases.schema, 'logos-engine.native-loop-cost-cases.v1'); assert.equal(cases.rounds, 4);
  assert.deepEqual(cases.cases.map(item => [item.id, item.actions, item.warmupActions, item.targetLevels]), [['STCK', 10, 3, 3], ['SMLP', 15, 3, 3]]);
  const manifestPaths = { baseline: resolve(ROOT, baselineManifestArgument), candidate: resolve(ROOT, candidateManifestArgument) };
  assert.ok(Object.values(manifestPaths).every(path => inside(ROOT, path)));
  const manifests = { baseline: await input(manifestPaths.baseline), candidate: await input(manifestPaths.candidate) };
  const checkouts = { baseline, candidate: ROOT }, generator = await fp(SCRIPT);
  watched.set(SCRIPT, generator);
  const comparator = await fp(resolve(ROOT, COMPARATOR)); watched.set(resolve(ROOT, COMPARATOR), comparator);
  for (const [role, checkout] of Object.entries(checkouts)) {
    assert.deepEqual(await inventory(checkout), manifests[role], role + ' freeze differs');
    for (const name of [HARNESS, ...DECLARATIONS]) {
      const path = resolve(checkout, name), record = await fp(path); watched.set(path, record);
      assert.equal(record.sha256, (await fp(resolve(ROOT, name))).sha256, 'Baseline/candidate input differs: ' + name);
    }
  }
  const nativeDigests = Object.fromEntries(Object.entries(manifests).map(([role, value]) => [role, value.digest]));
  const declaration = { schema: 'logos-engine.followup-strict-work-declaration.v1', declaredAt: startedAt,
    nativeDigests, cases: await fp(casesPath), sourceManifests: Object.fromEntries(await Promise.all(Object.entries(manifestPaths).map(async ([role, path]) => [role, await fp(path)]))),
    generator, workSignatureTool: comparator, comparison: 'exact_deep_equality_no_exemptions',
    plannedSessions: 8, plannedActions: 62, measuredCostSessions: 0, timingMetricsRetained: 0,
    forms: cases.cases.flatMap(item => [{ case: item.id, warmup: true, actions: item.warmupActions }, { case: item.id, warmup: false, actions: item.actions }]),
    qualification: 'Functional work forms only, declared before execution and before the official cost window. Timing values exist transiently inside the unchanged harness but are not retained, compared or used to select measurements.' };
  await writeFile(paths.declaration, JSON.stringify(declaration, null, 2) + '\n', { flag: 'wx' });
  watched.set(paths.declaration, await fp(paths.declaration));
  const receipt = { schema: 'logos-engine.followup-strict-work-capture.v1', status: 'running', startedAt,
    declaration: await fp(paths.declaration), nativeDigests, sessions: [], failures: [], measuredCostSessions: 0, timingMetricsRetained: 0 };
  await writeFile(paths.receipt, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  const save = () => writeFile(paths.receipt, JSON.stringify(receipt, null, 2) + '\n');
  const captures = [], derivations = {};
  try {
    for (const [role, checkout] of Object.entries(checkouts)) {
      const { module, derivation } = await importedHarness(checkout); derivations[role] = derivation;
      for (const item of cases.cases) {
        const tracePath = resolve(checkout, item.trace);
        assert.ok(inside(checkout, tracePath));
        const bytes = await readFile(tracePath), traceRecord = await fp(tracePath);
        assert.equal(hash(bytes), item.traceSha256); watched.set(tracePath, traceRecord);
        const trace = JSON.parse(item.trace.endsWith('.gz') ? gunzipSync(bytes) : bytes);
        assert.equal(trace.status, 'passed'); assert.equal(trace.packets[0].packet.step_index, 0);
        const connection = await module.bridge();
        try {
          for (const warmup of [true, false]) {
            const actions = warmup ? item.warmupActions : item.actions;
            const session = { role, case: item.id, warmup, actions, status: 'running', startedAt: new Date().toISOString() };
            receipt.sessions.push(session); await save();
            const signature = workSignature(await module.trial(connection, item, trace, warmup ? 0 : 1, actions, warmup));
            assert.equal(signature.actions, actions); assert.equal(signature.final.acquiredTransitions, actions);
            assert.equal(signature.inspection.length, warmup ? 0 : 3);
            captures.push({ role, case: item.id, warmup, signature, signatureSha256: digest(signature) });
            Object.assign(session, { status: 'passed', finishedAt: new Date().toISOString(), signatureSha256: digest(signature) });
            await save();
            console.log(JSON.stringify({ role, case: item.id, warmup, actions, status: 'captured_no_timing_retained' }));
          }
        } finally { await connection.close(); }
      }
    }
    const forms = declaration.forms.map(form => {
      const rows = captures.filter(row => row.case === form.case && row.warmup === form.warmup);
      assert.deepEqual(rows.map(row => row.role), ['baseline', 'candidate']);
      assert.deepEqual(rows[0].signature, rows[1].signature, 'A/B functional work differs: ' + form.case + '/' + form.warmup);
      return { ...form, signature: rows[0].signature, signatureSha256: rows[0].signatureSha256 };
    });
    for (const [role, checkout] of Object.entries(checkouts)) assert.deepEqual(await inventory(checkout), manifests[role]);
    for (const [path, record] of watched) assert.deepEqual(await fp(path), record, 'Input changed during capture: ' + path);
    assert.equal(captures.length, 8); assert.equal(captures.reduce((sum, row) => sum + row.signature.actions, 0), 62);
    const value = { schema: 'logos-engine.followup-strict-cost-forms.v1', status: 'passed', startedAt, finishedAt: new Date().toISOString(),
      declaration: await fp(paths.declaration), generator, workSignatureTool: comparator, nativeDigests,
      sourceManifests: declaration.sourceManifests, cases: await fp(casesPath), derivations, forms, captures,
      functionalSessions: captures.length, functionalActions: 62, measuredCostSessions: 0, timingMetricsRetained: 0,
      comparison: 'exact_deep_equality_no_exemptions', sourceAndInputsUnchanged: true,
      inputs: [...watched.values()].filter(row => !row.path.startsWith('/')),
      watchedExternalInputs: [...watched.values()].filter(row => row.path.startsWith('/')),
      qualification: 'All four forms are exactly equal between actual baseline and candidate. This is a prospective finite functional identity contract, not a cost result or a live-game success. All 40 later official trials must match it without structural exemptions.' };
    await writeFile(paths.forms, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    Object.assign(receipt, { status: 'passed', finishedAt: value.finishedAt, forms: await fp(paths.forms), sourceAndInputsUnchanged: true });
  } catch (error) {
    receipt.status = 'failed'; receipt.finishedAt = new Date().toISOString(); receipt.failures.push(String(error.stack ?? error));
    throw error;
  } finally { await save(); }
}

await main();
