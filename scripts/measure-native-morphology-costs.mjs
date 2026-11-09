#!/usr/bin/env node
/** Absolute component costs on original-verified synthetic public-raster inputs.
 * Usage: node scripts/measure-native-morphology-costs.mjs OUTPUT.json
 * No baseline ratio: V60 did not have this current-measurement producer.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { NativeMorphologyPolicy } from '../src/logos-engine/v6-morphology-policy.ts';
import { measureMorphologyRoutes } from '../src/logos-engine/v6-morphology-measurements.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'tests/fixtures/v6-morphology-measurements-reference.json.gz';
const CASES = ['measured-modifier-access', 'measured-selective-return-enables-peer-route',
  'short-prefix-does-not-falsify-full-access-cost', 'empty-history-does-not-attest-control',
  'multiple-current-pairs-remain-ambiguous'];
const WARMUP = 3, REPETITIONS = 20;
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
async function fingerprint(path) { const bytes = await readFile(path); return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) }; }
async function nativeInventory() {
  const names = [];
  async function walk(path) { for (const item of await readdir(path, { withFileTypes: true })) {
    const full = resolve(path, item.name); if (item.isDirectory()) await walk(full);
    else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(ROOT, full));
  } }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, folder));
  const files = {}; for (const name of names.sort()) files[name] = hash(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
function stats(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null, minMs: sorted[0], maxMs: sorted.at(-1) };
}
function sourceFields(result) {
  const { trace, instructions, execution_engine, reference_commit, reference_semantic_hash,
    all_executed_statements, instruction_quantum, ...original } = result;
  return original;
}

const [outputArgument] = process.argv.slice(2);
if (!outputArgument || process.argv.length !== 3) throw new Error('Usage: measure-native-morphology-costs.mjs OUTPUT.json');
const output = resolve(ROOT, outputArgument);
assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..'));
try { await access(output); throw new Error('Receipt exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const startedAt = new Date().toISOString(), nativeBefore = await nativeInventory();
const generator = await fingerprint(fileURLToPath(import.meta.url)), fixtureFile = await fingerprint(resolve(ROOT, FIXTURE));
const fixture = JSON.parse(gunzipSync(await readFile(resolve(ROOT, FIXTURE))));
assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
assert.equal(fixture.sourceVerification.verifiedOriginalFilesBefore, 1786);
assert.equal(fixture.sourceVerification.verifiedOriginalFilesAfter, 1786);
assert.equal(fixture.method.sourceModified, false);
const sourceRoot = `reference/v6/${fixture.commit}`;
const expectationInputs = [await fingerprint(resolve(ROOT, fixture.generator.path)),
  await fingerprint(resolve(ROOT, `${sourceRoot}/manifest.json`))];
assert.equal(expectationInputs[0].sha256, fixture.generator.sha256);
assert.equal(expectationInputs[1].sha256, fixture.sourceVerification.manifestSha256);
for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
  const actual = await fingerprint(resolve(ROOT, `${sourceRoot}/source/${name}`));
  assert.equal(actual.sha256, expected, name); expectationInputs.push(actual);
}
const scenes = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const policy = await NativeMorphologyPolicy.create(), cases = [];
for (const id of CASES) {
  const sample = fixture.cases.find(row => row.id === id); assert.ok(sample, id);
  // Only public frames, public transition history and scoped acquired evidence
  // enter the producer. Original expected facts and commands stay in assertions.
  const input = { history: sample.history.map(([a, command, b]) => [scenes[a], command, scenes[b]]),
    current: scenes[sample.current], limit: sample.limit,
    contacts: new Map(sample.contacts.map(([key, value]) => [JSON.stringify(key), clone(value)])),
    tried: new Set(sample.tried), available: clone(sample.available), actionBudget: sample.actionBudget,
    meterForecast: clone(sample.meterForecast), stationMethod: clone(sample.stationMethod) };
  const before = clone(input), samples = [], warmup = [];
  let finalDecision, finalReceipt;
  for (let index = -WARMUP; index < REPETITIONS; index++) {
    const began = performance.now();
    const measured = await measureMorphologyRoutes(input);
    const producedAt = performance.now();
    const admitted = clone(measured.facts);
    for (const name of Object.keys(admitted.routes)) {
      if (measured.plans[name].steps.some(step => !sample.available.includes(step.action_ref))) delete admitted.routes[name];
    }
    Object.assign(admitted, { meter_forecast: sample.meterForecast, extension_route: null, extension_kind: null });
    const policyAt = performance.now(), decision = await policy.evaluate(admitted), ended = performance.now();
    const timing = { index, producerMs: producedAt - began, policyMs: ended - policyAt, combinedMs: ended - began };
    (index < 0 ? warmup : samples).push(timing);
    // Correctness verification is outside the measured intervals.
    assert.deepEqual(measured.facts, sample.expectedFacts, id);
    assert.deepEqual(measured.plans, sample.expectedPlans, id);
    assert.deepEqual(sourceFields(decision), sample.expectedDecision, id);
    assert.equal(decision.release_authority, false);
    finalDecision = Object.fromEntries(['status', 'reason', 'route_key', 'operation'].map(key => [key, decision[key]]));
    finalReceipt = measured.receipt;
  }
  assert.deepEqual(clone(input), before, 'A repeated producer call must not acquire or mutate domain knowledge');
  cases.push({ id, warmup, samples, costs: Object.fromEntries(['producerMs', 'policyMs', 'combinedMs'].map(stage => [stage, stats(samples.map(row => row[stage]))])),
    finalDecision, finalReceipt, sourceOutputMatched: true, inputUnchanged: true });
}
assert.deepEqual(await nativeInventory(), nativeBefore, 'Native source changed during measurement');
assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
assert.deepEqual(await fingerprint(resolve(ROOT, FIXTURE)), fixtureFile);
for (const input of expectationInputs) assert.deepEqual(await fingerprint(resolve(ROOT, input.path)), input);
const result = { schema: 'logos-engine.native-morphology-component-costs.v1', status: 'passed', startedAt,
  finishedAt: new Date().toISOString(), gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  nativeSource: nativeBefore, nativeSourceUnchanged: true, generator, fixture: fixtureFile, expectationInputs,
  fixtureMethod: fixture.method, fixtureScope: fixture.scope,
  environment: { node: process.version, platform: platform(), release: release(), cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
  protocol: { warmupPerCase: WARMUP, measuredCallsPerCase: REPETITIONS, cases: CASES }, cases,
  qualifications: [
    'Absolute after-only component timings; V60 had no native current-measurement producer, so no baseline zero-cost ratio is claimed.',
    'Fixed synthetic public-raster component cases verified against the original Python, not cold integrated game sessions or live-game timings. Snapshot construction and policy creation occur before measurement.',
    'Each case has three warmups then twenty calls on the same measured inputs in one warm process. Samples are correlated; p95 is empirical, not a confidence bound.',
    'Producer and policy timings exclude correctness assertions. combinedMs also includes current route admission and result preparation; do not add it to the separate stages.',
    'No complete runtime planning, authorization, common acquisition, persistence, restoration, transport, inspector, browser rendering or game execution is timed here.',
    'Input acquired history and contacts come from the component fixture. No imported learned state is claimed to be a cold game acquisition. Expected output is used only after each decision.',
  ] };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), nativeDigest: nativeBefore.digest,
  cases: cases.map(row => ({ id: row.id, ...row.costs })) }));
