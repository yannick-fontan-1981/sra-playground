#!/usr/bin/env node
/** Final 0.68 Chart delivery inventory. Record the actual factories' owners and family-installed programs, without a session.
 * Derived from the retained final 8B inventory, with both generator identities bound.
 * Usage: node SCRIPT BASELINE_CHECKOUT CANDIDATE_CHECKOUT OUTPUT.json
 * No runtime initialize, observation, proposal, action or workflow execution is requested.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT), '../../../../../..');
const DERIVED_FROM = 'docs/migration/lot8b-evidence/tools/final-functional/work-forms/record-owner-source-inventory.mjs';
const PUBLISHED_BASELINE = '8462204043aa368faa7df280d796bb706eb53b38';
const REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const RUNTIME = 'src/logos-engine/v6-native-runtime.ts';
const STORE = 'src/logos-engine/v6-knowledge-store.ts';
const PROGRAMS = 'src/logos-engine/v6-src-program.ts';
const DECLARATIONS = [`${REFERENCE}/laya_proto/common_frontier_policy.drm.json`, `${REFERENCE}/morphology_policy/strategy.drm`];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const portable = name => name.split(sep).join('/');

function compareNames(first, second) {
  const a = Array.from(first, char => char.codePointAt(0)), b = Array.from(second, char => char.codePointAt(0));
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

// Matches Python json.dumps(ordered, separators=(',', ':')) with ensure_ascii=True.
function manifestEncoding(files) {
  return JSON.stringify(files).replace(/[\u007f-\uffff]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

async function fingerprint(checkout, name) {
  const bytes = await readFile(resolve(checkout, name));
  return { path: portable(relative(checkout, resolve(checkout, name))), bytes: bytes.length, sha256: hash(bytes) };
}

async function inventory(checkout) {
  const names = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if ((entry.isFile() || entry.isSymbolicLink() && (await stat(path)).isFile())
        && ['.ts', '.json', '.drm'].includes(extname(entry.name))) names.push(portable(relative(checkout, path)));
    }
  }
  for (const folder of ['src/logos-engine', 'src/runtime']) await walk(resolve(checkout, folder));
  names.sort(compareNames);
  assert.equal(new Set(names).size, names.length, 'Native file names must be unique');
  assert.ok(names.length > 0, 'Native source inventory is empty');
  const files = {};
  for (const name of names) files[name] = hash(await readFile(resolve(checkout, name)));
  return { fileCount: names.length, digest: hash(manifestEncoding(files)), files };
}

function uniqueIds(ids, label) {
  assert.ok(ids.length > 0 && ids.every(id => typeof id === 'string' && id.length > 0), `${label} must be nonempty IDs`);
  assert.equal(new Set(ids).size, ids.length, `${label} must be unique`);
}

function assertUninitialized(runtime) {
  assert.equal(runtime.initialized, false, 'Factory inventory must not initialize the runtime');
  assert.equal(runtime.knowledge, null, 'Factory inventory must not create a runtime session store');
  assert.equal(runtime.observation, null, 'Factory inventory must not acquire an observation');
  assert.equal(runtime.current, null, 'Factory inventory must not supply a public packet');
}

async function inspect(checkout, role) {
  const before = await inventory(checkout);
  const expected = role === 'baseline'
    ? { fileCount: 331, digest: 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a' }
    : { fileCount: 334, digest: 'e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653' };
  assert.deepEqual({ fileCount: before.fileCount, digest: before.digest }, expected, 'Unexpected frozen native source');
  const sourceCommit = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim();
  if (role === 'baseline') assert.equal(sourceCommit, PUBLISHED_BASELINE, 'Use the exact Site 108 published source checkout');
  const inputs = {};
  for (const name of [RUNTIME, STORE, PROGRAMS, ...DECLARATIONS]) inputs[name] = await fingerprint(checkout, name);
  const runtimeSource = await readFile(resolve(checkout, RUNTIME), 'utf8');
  const versions = [...runtimeSource.matchAll(/NATIVE_V6_IMPLEMENTATION\s*=\s*['"]logos-engine\.typescript\.v6\.native-migration\/([^'"]+)['"]/g)].map(match => match[1]);
  assert.deepEqual(versions, [role === 'baseline' ? '0.67.0' : '0.68.0'],
    'Use the actual published 0.67 and the separately versioned final Chart candidate 0.68');
  assert.ok(runtimeSource.includes('id: `family_state:${family.id}`')
    && runtimeSource.includes('id: `family_activation:${family.id}`')
    && runtimeSource.includes('for (const family of this.families) await family.attachPrograms?.(this.knowledge)'),
  'Explicit family state, activation and program installation must remain present in the runtime source');
  const [{ createNativeV6Runtime }, { NativeKnowledgeStore }] = await Promise.all([
    import(pathToFileURL(resolve(checkout, RUNTIME)).href),
    import(pathToFileURL(resolve(checkout, STORE)).href),
  ]);
  const declarations = {
    common: JSON.parse(await readFile(resolve(checkout, DECLARATIONS[0]), 'utf8')),
    strategy: JSON.parse(await readFile(resolve(checkout, DECLARATIONS[1]), 'utf8')),
  };
  const runtime = await createNativeV6Runtime(declarations);
  assertUninitialized(runtime);
  assert.ok(Array.isArray(runtime.families), 'The real factory does not expose its compiled TS family array');
  assert.match(runtime.sourceDigest, /^[0-9a-f]{64}$/, 'Factory sourceDigest is missing');
  const owners = runtime.families.map(family => family.id);
  uniqueIds(owners, `${role} owners`);
  const scope = `lot9a-delivery-owner-source-inventory:${role}`;
  const store = new NativeKnowledgeStore(runtime.sourceDigest, scope);
  const installations = [];
  const registerProgram = store.registerProgram.bind(store);
  let attachingOwner = null;
  // Observe the real registration with unchanged callbacks. Only the returned
  // run handle is barred: source inventory never permits workflow execution.
  store.registerProgram = async (id, callbacks) => {
    assert.ok(attachingOwner !== null, 'Program registration must belong to a family attachPrograms call');
    const handle = await registerProgram(id, callbacks);
    installations.push({ owner: attachingOwner, workflowId: id, nodeId: `program:${id}` });
    return { ...handle, run: async () => { throw new Error('Workflow execution is outside source inventory'); } };
  };
  for (const family of runtime.families) {
    if (family.attachPrograms) {
      attachingOwner = family.id;
      await family.attachPrograms(store);
      attachingOwner = null;
    }
  }
  assertUninitialized(runtime);
  const nodes = Object.values(store.memory.nodes);
  assert.ok(nodes.length > 0 && nodes.every(node => node.kind === 'program'),
    'The separate inventory store must contain only actually installed program nodes');
  const programNodeIds = nodes.map(node => node.id).sort(compareNames);
  uniqueIds(programNodeIds, `${role} program nodes`);
  assert.ok(programNodeIds.every(id => id.startsWith('program:')), 'Unexpected program node identifier');
  const programs = programNodeIds.map(id => id.slice('program:'.length));
  uniqueIds(programs, `${role} workflow IDs`);
  assert.deepEqual([...new Set(installations.map(row => row.nodeId))].sort(compareNames), programNodeIds,
    'Installed nodes and observed family registration calls disagree');
  assert.ok(nodes.every(node => node.scope === scope && node.origin.source_digest === runtime.sourceDigest),
    'Installed programs must use the real factory sourceDigest and local scope');
  const after = await inventory(checkout);
  assert.deepEqual(after, before, 'Native source changed while reading its factory inventory');
  assert.equal(execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 10000 }).trim(), sourceCommit,
    'Factory inventory source HEAD changed during inspection');
  for (const [name, expected] of Object.entries(inputs)) {
    assert.deepEqual(await fingerprint(checkout, name), expected, 'Factory input changed: ' + name);
  }
  return { checkout, sourceCommit, published: role === 'baseline', nativeVersion: versions[0], native: before, owners, programs, programNodeIds, installations,
    groups: structuredClone(runtime.groups), programNodes: nodes.map(node => structuredClone(node)),
    factorySourceDigest: runtime.sourceDigest, storeScope: scope, sourceInputs: Object.values(inputs),
    runtimeUninitializedBeforeAndAfter: true,
    sourceDeclaredNodeIds: {
      family_state: owners.map(id => `family_state:${id}`),
      family_activation: owners.map(id => `family_activation:${id}`),
      program: programNodeIds,
    } };
}

async function main() {
  assert.equal(process.argv.length, 5, 'Usage: node SCRIPT BASELINE_CHECKOUT CANDIDATE_CHECKOUT OUTPUT.json');
  const generator = await fingerprint(ROOT, relative(ROOT, SCRIPT));
  const derivedFrom = await fingerprint(ROOT, DERIVED_FROM);
  const baselineCheckout = await realpath(resolve(process.argv[2]));
  const candidateCheckout = await realpath(resolve(process.argv[3]));
  assert.equal(candidateCheckout, await realpath(ROOT), 'Explicit candidate must be the tool checkout');
  assert.notEqual(baselineCheckout, candidateCheckout, 'Baseline and candidate checkouts must differ');
  const output = resolve(process.argv[4]);
  assert.ok(output.startsWith(resolve(ROOT, 'docs/migration/lot9a-evidence/delivery-final-068-01') + sep), 'Output must belong to lot9a evidence');
  const outputRelative = relative(candidateCheckout, output);
  assert.ok(outputRelative && outputRelative !== '..' && !outputRelative.startsWith(`..${sep}`),
    'Output must be a new file inside the candidate checkout');
  try {
    await access(output);
    throw new Error('Output already exists; refusing overwrite: ' + output);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const baseline = await inspect(baselineCheckout, 'baseline');
  const candidate = await inspect(candidateCheckout, 'candidate');
  const difference = (first, second) => first.filter(id => !second.includes(id)).sort(compareNames);
  const changes = {
    ownersAdded: difference(candidate.owners, baseline.owners), ownersRemoved: difference(baseline.owners, candidate.owners),
    programsAdded: difference(candidate.programs, baseline.programs), programsRemoved: difference(baseline.programs, candidate.programs),
  };
  assert.deepEqual(changes.ownersAdded, ['public_chart_navigation'], 'Only Chart may be added');
  assert.deepEqual(changes.ownersRemoved, []); assert.deepEqual(changes.programsRemoved, []);
  assert.deepEqual(changes.programsAdded, ['v6.chart_navigation.choose']);
  assert.deepEqual([baseline.owners.length, candidate.owners.length, baseline.programs.length, candidate.programs.length], [62, 63, 28, 29]);
  assert.deepEqual(candidate.owners.filter(id => id !== 'public_chart_navigation'), baseline.owners);
  assert.deepEqual(candidate.installations.filter(row => row.owner !== 'public_chart_navigation'), baseline.installations);
  assert.deepEqual(candidate.installations.filter(row => row.owner === 'public_chart_navigation'),
    [{ owner: 'public_chart_navigation', workflowId: 'v6.chart_navigation.choose', nodeId: 'program:v6.chart_navigation.choose' }]);
  for (const id of ['public_observed_binding', 'selected_rigid', 'motif_access', 'public_ordered_recruitment', 'branch_routing']) {
    assert.ok(baseline.owners.includes(id) && candidate.owners.includes(id), 'Existing common owner missing: ' + id);
  }
  const index = candidate.owners.indexOf('public_chart_navigation');
  assert.equal(candidate.owners[index - 1], 'public_ordered_reaction');
  assert.equal(candidate.owners[index + 1], 'public_topological_recolor');
  let chartEntries = 0;
  const strippedGroups = candidate.groups.map(group => {
    const keep = group.families.map((id, index) => ({ id, index })).filter(row => {
      if (row.id !== 'public_chart_navigation') return true;
      assert.equal(group.id, 'factored_material_return'); assert.equal(group.entryPoints[row.index], 'chart_navigation'); chartEntries++; return false;
    });
    return { ...group, families: keep.map(row => row.id),
      ...(group.entryPoints ? { entryPoints: keep.map(row => group.entryPoints[row.index]) } : {}) };
  });
  assert.equal(chartEntries, 1); assert.deepEqual(strippedGroups, baseline.groups);
  const sourceDelta = {
    added: Object.keys(candidate.native.files).filter(path => !Object.hasOwn(baseline.native.files, path)).sort(),
    removed: Object.keys(baseline.native.files).filter(path => !Object.hasOwn(candidate.native.files, path)).sort(),
    changed: Object.keys(baseline.native.files).filter(path => Object.hasOwn(candidate.native.files, path) && baseline.native.files[path] !== candidate.native.files[path]).sort(),
  };
  assert.deepEqual(sourceDelta, { added: ['src/logos-engine/v6-chart-navigation-geometry.ts', 'src/logos-engine/v6-chart-navigation-policy.ts', 'src/logos-engine/v6-chart-navigation.ts'], removed: [], changed: ['src/logos-engine/v6-native-runtime.ts'] });
  assert.deepEqual(await inventory(baselineCheckout), baseline.native, 'Baseline source changed after its inspection');
  assert.deepEqual(await inventory(candidateCheckout), candidate.native, 'Candidate source changed after its inspection');
  assert.deepEqual(await fingerprint(ROOT, relative(ROOT, SCRIPT)), generator, 'Inventory generator changed');
  assert.deepEqual(await fingerprint(ROOT, DERIVED_FROM), derivedFrom, 'Retained derivation source changed');
  const result = {
    schema: 'logos-engine.lot9a-delivery-owner-cost-source-inventory.v1', recordedAt: new Date().toISOString(),
    qualificationStage: 'functional_preparation_against_published_067_not_official_cost', globalLockUsed: false, officialPerformanceEligible: false,
    publishedBaseline: { site: 108, sourceCommit: PUBLISHED_BASELINE, nativeVersion: '0.67.0' },
    nativeDigests: { baseline: baseline.native.digest, candidate: candidate.native.digest },
    owners: { baseline: baseline.owners, candidate: candidate.owners },
    programs: { baseline: baseline.programs, candidate: candidate.programs },
    programScope: 'family-installed programs',
    programNodeIds: { baseline: baseline.programNodeIds, candidate: candidate.programNodeIds },
    changes, sourceDelta, generator, derivedFrom,
    method: 'Actual createNativeV6Runtime factories with each checkout\'s original declarations; every registered family attachPrograms installs into that checkout\'s actual NativeKnowledgeStore. Read the resulting program node IDs; never initialize either runtime.',
    nativeDigestAlgorithm: 'SHA-256 of compact ASCII-escaped JSON mapping sorted repository-relative native file names to file SHA-256; src/logos-engine and src/runtime; suffixes .ts, .json and .drm; identical to run-v53-campaign-proof.py native_source.',
    sourceInventory: { baseline, candidate },
    qualification: 'Actual frozen factories of Site 108 published 0.67 and final Chart candidate 0.68, without initializing either runtime. Only public_chart_navigation and family-installed v6.chart_navigation.choose may be added; the other 62 owners and 28 family programs retain their order and registrations. Only three Chart source files and v6-native-runtime.ts differ. Real family attachPrograms install into separate role-local stores; run handles refuse execution. Program node values, groups, inventories and source digests are retained. This inventory grants no official performance readiness, positive Chart acquisition, game success or publication.',
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ schema: result.schema, output: portable(outputRelative),
    nativeDigests: result.nativeDigests, ownerCounts: { baseline: baseline.owners.length, candidate: candidate.owners.length },
    programCounts: { baseline: baseline.programs.length, candidate: candidate.programs.length }, changes }));
}

await main();
