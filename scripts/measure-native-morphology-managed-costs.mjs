#!/usr/bin/env node
/** Absolute lot-2C component costs on source-verified positive public inputs.
 * Run only during a dedicated measurement window, after real-game campaigns.
 * Usage: node scripts/measure-native-morphology-managed-costs.mjs OUTPUT.json
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { CollectionEvidence } from '../src/logos-engine/v6-inventory-caller-context.ts';
import { projectManagedLayout, searchManagedAccess } from '../src/logos-engine/v6-morphology-managed.ts';
import { measureMorphologyRoutes } from '../src/logos-engine/v6-morphology-measurements.ts';
import { approachMorphologyEntry, resumeMorphologyEntry } from '../src/logos-engine/v6-morphology-entry.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'tests/fixtures/v6-morphology-managed-reference.json.gz';
const ENTRY_FIXTURE = 'tests/fixtures/v6-morphology-entry-reference.json.gz';
const PROTOCOL = 'docs/migration/lot2c-evidence/performance/managed-component-protocol.md';
const CASES = [
  ['projections', 'retained-method-current-public-layout'],
  ['projections', 'partial-frame-rim-retains-conditional-crossing'],
  ['searches', 'two-independent-charges-and-entry'],
  ['searches', 'palette-repair-and-recovery'],
  ['searches', 'opposite-control-contrast'],
  ['geometry', 'retained-method-reaches-managed-capacity-prefix'],
  ['geometry', 'public-palette-repair-binds-feature-reaccess'],
  ['geometry', 'palette-then-capacity-remains-valid-partial-composition'],
  ['geometry', 'distinct-prior-positive-ranks-unknown-control'],
  ['entry_approach', 'positive-deferred-contour'],
  ['entry_approach', 'positive-known-surround'],
  ['entry_resume', 'positive-return-base'],
];
const WARMUP = 3, REPETITIONS = 20;
const hash = value => createHash('sha256').update(value).digest('hex');
async function fingerprint(path) {
  const bytes = await readFile(path); return { path: relative(ROOT, path), bytes: bytes.length, sha256: hash(bytes) };
}
async function nativeInventory() {
  const names = [];
  async function walk(path) {
    for (const item of await readdir(path, { withFileTypes: true })) {
      const full = resolve(path, item.name);
      if (item.isDirectory()) await walk(full);
      else if (item.isFile() && /\.(ts|json|drm)$/.test(item.name)) names.push(relative(ROOT, full));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(ROOT, folder));
  const files = {}; for (const name of names.sort()) files[name] = hash(await readFile(resolve(ROOT, name)));
  return { fileCount: names.length, digest: hash(JSON.stringify(files)), files };
}
function collection(events) {
  if (events === null) return null;
  const owner = new CollectionEvidence(); for (const event of events) owner.apply_event(event); return owner;
}
function projection(value) {
  const result = structuredClone(value);
  if (result[0]) result[0].uncertain_edges.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return result;
}
function stats(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * .95) - 1] : null, minMs: sorted[0], maxMs: sorted.at(-1) };
}

const [outputArgument] = process.argv.slice(2);
if (!outputArgument || process.argv.length !== 3) throw new Error('Usage: measure-native-morphology-managed-costs.mjs OUTPUT.json');
const output = resolve(ROOT, outputArgument);
assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..'));
try { await access(output); throw new Error('Receipt exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const startedAt = new Date().toISOString(), nativeBefore = await nativeInventory();
const generator = await fingerprint(fileURLToPath(import.meta.url)), fixtureFile = await fingerprint(resolve(ROOT, FIXTURE));
const entryFixtureFile = await fingerprint(resolve(ROOT, ENTRY_FIXTURE));
const protocolFile = await fingerprint(resolve(ROOT, PROTOCOL));
const fixture = JSON.parse(gunzipSync(await readFile(resolve(ROOT, FIXTURE))));
const entryFixture = JSON.parse(gunzipSync(await readFile(resolve(ROOT, ENTRY_FIXTURE))));
const expectationInventory = new Map();
for (const reference of [fixture, entryFixture]) {
  assert.equal(reference.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([reference.sourceVerification.verifiedOriginalFilesBefore, reference.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([reference.method.sourceModified, reference.method.astTransformed, reference.method.monkeyPatched, reference.method.nativeExecution], [false, false, false, false]);
  for (const declared of [reference.generator, reference.sharedGenerator].filter(Boolean)) {
    const actual = await fingerprint(resolve(ROOT, declared.path));
    assert.equal(actual.sha256, declared.sha256); expectationInventory.set(actual.path, actual);
  }
  const sourceRoot = `reference/v6/${reference.commit}`, manifest = await fingerprint(resolve(ROOT, `${sourceRoot}/manifest.json`));
  assert.equal(manifest.sha256, reference.sourceVerification.manifestSha256); expectationInventory.set(manifest.path, manifest);
  for (const [name, expected] of Object.entries(reference.sourceHashes)) {
    const actual = await fingerprint(resolve(ROOT, `${sourceRoot}/source/${name}`));
    assert.equal(actual.sha256, expected, name); expectationInventory.set(actual.path, actual);
  }
}
const expectationInputs = [...expectationInventory.values()];
const scenes = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const entryScenes = Object.fromEntries(Object.entries(entryFixture.scenes).map(([name, scene]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const cases = [];
for (const [stage, id] of CASES) {
  const pool = stage === 'entry_approach' ? entryFixture.casesApproach : stage === 'entry_resume' ? entryFixture.casesResume : fixture[stage];
  const sample = pool.find(row => row.id === id); assert.ok(sample, id);
  let input, call, verify, qualify, prepare = () => {};
  if (stage === 'projections') {
    input = { current: scenes[sample.current], pair: structuredClone(sample.pair), origin: sample.origin, size: sample.size,
      motions: structuredClone(sample.motions), surfaces: new Set(sample.surfaces.map(JSON.stringify)),
      unresolvedEdges: new Map(sample.unresolvedEdges.map(([edge, value]) => [JSON.stringify(edge), structuredClone(value)])),
      marks: structuredClone(sample.marks), stations: structuredClone(sample.stations), stationMethod: structuredClone(sample.stationMethod),
      roleRefs: sample.roleRefs, available: structuredClone(sample.available), collectionEvidence: collection(sample.collectionEvents),
      observation: structuredClone(sample.observation), weakMoves: structuredClone(sample.weakMoves),
      featureSites: new Map((sample.featureSites ?? []).map(([at, value]) => [JSON.stringify(at), structuredClone(value)])) };
    call = () => projectManagedLayout(input);
    verify = result => assert.deepEqual(projection(result), projection(sample.expected), id);
    qualify = result => ({ status: result[0] ? 'projected' : 'refused', cells: result[0]?.cells.length ?? 0,
      modifiers: result[0]?.modifiers.length ?? 0, charges: result[0]?.charges.length ?? 0, orientationStatus: result[1]?.status ?? null });
  } else if (stage === 'searches') {
    input = { layout: structuredClone(sample.layout), meter: structuredClone(sample.meter), orientation: structuredClone(sample.orientation),
      options: { actionBudget: sample.actionBudget, maxPrefix: sample.maxPrefix, maxStates: sample.maxStates } };
    call = () => searchManagedAccess(input.layout, input.meter, input.orientation, input.options);
    verify = result => assert.deepEqual(result, sample.expected, id);
    qualify = result => ({ status: result.status, searchComplete: result.search_complete, states: result.states,
      options: result.options.length, release_authority: result.release_authority });
  } else if (stage === 'geometry') {
    input = { history: sample.history.map(([a, command, b]) => [scenes[a], command, scenes[b]]), current: scenes[sample.current], limit: sample.limit,
      contacts: new Map(sample.contacts.map(([key, value]) => [JSON.stringify(key), structuredClone(value)])), tried: new Set(sample.tried),
      available: structuredClone(sample.available), actionBudget: sample.actionBudget, meterForecast: structuredClone(sample.meterForecast),
      stationMethod: structuredClone(sample.stationMethod), collectionEvidence: collection(sample.collectionEvents),
      observation: structuredClone(sample.observation), featureTrials: structuredClone(sample.featureTrials) };
    call = () => measureMorphologyRoutes(input);
    verify = result => { assert.deepEqual(result.facts, sample.expectedFacts, id); assert.deepEqual(result.plans, sample.expectedPlans, id); };
    qualify = result => ({ status: result.receipt.status, routeKeys: Object.keys(result.plans),
      firstObligation: result.plans.managed_access?.obligation ?? null, totalCost: result.plans.managed_access?.total_cost ?? null,
      objective: result.plans.managed_access?.composition_objective ?? null, release_authority: result.receipt.release_authority });
  } else {
    const args = sample.args; assert.ok(sample.expected, 'Entry timing case must exercise a source-positive branch');
    input = { current: entryScenes[args.current], observation: structuredClone(args.observation), facts: structuredClone(args.facts),
      remaining: args.remaining, available: structuredClone(args.available), forecast: structuredClone(args.forecast) };
    let currentFacts;
    // These source consumers deliberately enrich their current facts. Each
    // measured call receives a fresh copy of the same pre-consumer facts;
    // cloning is preparation, outside the timed consumer interval.
    prepare = () => { currentFacts = structuredClone(input.facts); };
    if (stage === 'entry_approach') {
      assert.equal(args.collection, null, 'Selected source entry fixture declares no collection owner');
      Object.assign(input, { method: structuredClone(args.method), history: args.history.map(([a, command, b]) => [entryScenes[a], command, entryScenes[b]]),
        collectionEvidence: null });
      call = () => approachMorphologyEntry(input.method, input.history, input.current, input.observation, currentFacts,
        input.remaining, input.available, input.forecast, input.collectionEvidence);
    } else {
      input.pending = structuredClone(args.pending);
      call = () => resumeMorphologyEntry(input.pending, input.current, input.observation, currentFacts,
        input.remaining, input.available, input.forecast);
    }
    verify = result => { assert.deepEqual(result, sample.expected, id); assert.deepEqual(currentFacts, sample.expectedFacts, id); };
    qualify = result => ({ status: result ? 'bound' : 'refused', routeKey: result?.route_key ?? null,
      prefixLength: result?.steps.length ?? 0, deferredProbe: Boolean(result?.deferred_probe),
      informationCost: result?.information_cost ?? null, reserveAfterProbe: result?.reserve_after_probe ?? null,
      currentFactsMatchedOriginal: true });
  }
  const before = structuredClone(input), warmup = [], samples = []; let finalResult;
  for (let index = -WARMUP; index < REPETITIONS; index++) {
    prepare();
    const began = performance.now(), result = await call(), ended = performance.now();
    (index < 0 ? warmup : samples).push({ index, elapsedMs: ended - began });
    // Expectations never enter the producer and correctness is outside timing.
    verify(result); finalResult = qualify(result);
  }
  assert.deepEqual(structuredClone(input), before, 'Component must not acquire or mutate domain knowledge');
  cases.push({ id, stage, warmup, samples, costs: stats(samples.map(row => row.elapsedMs)), finalResult, sourceOutputMatched: true, inputUnchanged: true,
    preparation: stage.startsWith('entry_') ? 'Fresh current-facts copy before each timed source consumer; enrichment checked after timing' : 'Fixed immutable component inputs' });
}
assert.deepEqual(await nativeInventory(), nativeBefore, 'Native source changed during measurement');
assert.deepEqual(await fingerprint(fileURLToPath(import.meta.url)), generator);
assert.deepEqual(await fingerprint(resolve(ROOT, FIXTURE)), fixtureFile);
assert.deepEqual(await fingerprint(resolve(ROOT, ENTRY_FIXTURE)), entryFixtureFile);
assert.deepEqual(await fingerprint(resolve(ROOT, PROTOCOL)), protocolFile);
for (const input of expectationInputs) assert.deepEqual(await fingerprint(resolve(ROOT, input.path)), input);
const result = { schema: 'logos-engine.native-morphology-managed-component-costs.v1', status: 'passed', startedAt,
  finishedAt: new Date().toISOString(), gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  nativeSource: nativeBefore, nativeSourceUnchanged: true, generator, fixture: fixtureFile, entryFixture: entryFixtureFile, protocolFile, expectationInputs,
  fixtureMethod: fixture.method, fixtureScope: fixture.scope, entryFixtureMethod: entryFixture.method, entryFixtureScope: entryFixture.scope,
  environment: { node: process.version, platform: platform(), release: release(), cpuModel: cpus()[0]?.model ?? null, logicalCpus: cpus().length },
  protocol: { warmupPerCase: WARMUP, measuredCallsPerCase: REPETITIONS, cases: CASES }, cases,
  qualifications: [
    'Absolute positive-path component timings. Base version 62 had no native retained-method managed search; no before/after or zero-baseline ratio is claimed.',
    'Original-verified synthetic public inputs with explicit retained-method and collection consumer boundaries. These are not cold integrated game sessions or claims of whole-caller parity.',
    'Each case has three warmups then twenty calls in one warm process. Correlated samples and empirical p95 are not confidence bounds.',
    'Snapshot and owner construction, fresh entry-facts copies, expectation checks, input immutability checks, file hashing and receipt preparation are outside each measured interval.',
    'Projection and search stage costs are separate direct fixtures. Geometry includes all its own ordinary routes, managed projection and search; do not add these stage times together.',
    'No physical action, common-caller planning, runtime authorization, acquisition, persistence, restoration, transport, inspector rendering or game execution is timed.',
    'Only projection uncertain_edges is compared as a multiset because the original loops over a vector set. Search results, plans and route priorities are compared exactly.',
    'Entry approach and resume receive declared source-consumer method/pending-return premises. Their facts enrichment is checked exactly on a fresh facts copy; no Kernel acquisition is claimed.',
  ] };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), nativeDigest: nativeBefore.digest,
  cases: cases.map(row => ({ id: row.id, stage: row.stage, ...row.costs })) }));
