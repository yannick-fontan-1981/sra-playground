import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import { CollectionEvidence } from '../src/logos-engine/v6-inventory-caller-context.ts';
import { projectManagedLayout, searchManagedAccess } from '../src/logos-engine/v6-morphology-managed.ts';
import { measureMorphologyRoutes } from '../src/logos-engine/v6-morphology-measurements.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-morphology-managed-reference.json.gz', import.meta.url))).toString());
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
freeze(fixture);
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const scenes: Record<string, Snapshot> = Object.fromEntries(Object.entries(fixture.scenes).map(([name, scene]: [string, any]) => [name, Snapshot.fromPublic(scene.observation, scene.rows)]));
const historyOf = (rows: readonly (readonly string[])[]) => rows.map(([first, command, second]) => [scenes[first!]!, command!, scenes[second!]!] as const);
function collection(events: R[] | null): CollectionEvidence | null {
  if (events === null) return null;
  const owner = new CollectionEvidence(); for (const event of events) owner.apply_event(event); return owner;
}
function projection(value: any): any {
  const result = structuredClone(value);
  // V6 emits this field by iterating a set of vectors. Membership is consumed
  // as an edge map; ordering has no bearing on search priority or witness.
  if (result[0]) result[0].uncertain_edges.sort((a: R, b: R) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return result;
}

test('managed reference executes unchanged V6 source and verifies every original file', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.deepEqual([fixture.sourceVerification.verifiedOriginalFilesBefore, fixture.sourceVerification.verifiedOriginalFilesAfter], [1786, 1786]);
  assert.deepEqual([fixture.method.sourceModified, fixture.method.astTransformed, fixture.method.monkeyPatched, fixture.method.nativeExecution], [false, false, false, false]);
  assert.equal(digest(await readFile(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/manifest.json`, import.meta.url))), fixture.sourceVerification.manifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url))), expected, path);
  }
  for (const name of ['project_layout', 'search_managed_access', 'measure_routes', 'rigid_role', 'CollectionEvidence.evidence_for']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
});

for (const sample of fixture.searches) test(`source managed product search: ${sample.id}`, () => {
  const call = () => searchManagedAccess(sample.layout, sample.meter, sample.orientation,
    { actionBudget: sample.actionBudget, maxPrefix: sample.maxPrefix, maxStates: sample.maxStates });
  if (sample.expectedError) { assert.throws(call, { name: 'TypeError', message: sample.expectedError }); return; }
  const actual = call(); assert.deepEqual(actual, sample.expected);
  assert.equal(actual.release_authority, false);
  for (const option of actual.options) {
    assert.equal(option.release_authority, false);
    assert.ok(option.prefix.length <= (sample.maxPrefix ?? 16));
    assert.ok(option.charge_order.length <= 2);
  }
  assert.deepEqual(call(), actual, 'Stateless repetition preserves ordering and witnesses');
});

for (const sample of fixture.projections) test(`source managed public projection: ${sample.id}`, () => {
  const inputs = { ...sample, current: scenes[sample.current]!,
    surfaces: new Set<string>(sample.surfaces.map(JSON.stringify)),
    unresolvedEdges: new Map<string, R>(sample.unresolvedEdges.map(([edge, value]: [unknown, R]) => [JSON.stringify(edge), value])),
    featureSites: new Map<string, R>((sample.featureSites ?? []).map(([at, value]: [unknown, R]) => [JSON.stringify(at), value])),
    collectionEvidence: collection(sample.collectionEvents) };
  const saved = inputs.collectionEvidence?.retained_state();
  const actual = projectManagedLayout(inputs);
  assert.deepEqual(projection(actual), projection(sample.expected));
  assert.deepEqual(projectManagedLayout(inputs), actual);
  assert.deepEqual(inputs.collectionEvidence?.retained_state(), saved, 'Measurement does not acquire a second collection history');
});

for (const sample of fixture.geometry) test(`source managed geometry integration: ${sample.id}`, async () => {
  const owner = collection(sample.collectionEvents), saved = owner?.retained_state();
  const actual = await measureMorphologyRoutes({ ...sample, current: scenes[sample.current]!, history: historyOf(sample.history),
    contacts: new Map<string, R>(sample.contacts.map(([at, value]: [unknown, R]) => [JSON.stringify(at), value])),
    tried: new Set<string>(sample.tried), collectionEvidence: owner });
  assert.deepEqual(actual.facts, sample.expectedFacts); assert.deepEqual(actual.plans, sample.expectedPlans);
  assert.equal(actual.receipt.release_authority, false);
  assert.deepEqual(owner?.retained_state(), saved);
});

test('bounded search explicitly distinguishes incompleteness from complete absence of a route', () => {
  const incomplete = fixture.searches.find((sample: R) => sample.id === 'state-bound-remains-incomplete').expected;
  const impossible = fixture.searches.find((sample: R) => sample.id === 'empty-meter-is-complete-no-route').expected;
  assert.equal(incomplete.status, 'search_incomplete'); assert.equal(incomplete.search_complete, false);
  assert.equal(impossible.status, 'no_complete_conditional_route'); assert.equal(impossible.search_complete, true);
});

test('palette recovery requires a later actual charge or peer and keeps its full conditional witness', () => {
  const result = fixture.searches.find((sample: R) => sample.id === 'palette-repair-and-recovery').expected;
  assert.ok(result.options.some((option: R) => option.objective === 'aligned_peer'));
  const recovery = result.options.filter((option: R) => option.objective === 'feature_then_recovery');
  assert.ok(recovery.length);
  for (const option of recovery) {
    const repair = option.conditional_path.findIndex((step: R) => step.feature);
    assert.ok(repair >= 0); assert.ok(option.conditional_path.slice(repair + 1).some((step: R) => step.charge));
    assert.equal(option.remaining_at_peer, null);
  }
});
