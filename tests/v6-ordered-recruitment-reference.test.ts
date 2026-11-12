import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { OrderedRecruitment } from '../src/logos-engine/v6-ordered-recruitment.ts';
import { RecruitmentPolicy } from '../src/logos-engine/v6-ordered-recruitment-policy.ts';
import * as geometry from '../src/logos-engine/v6-ordered-recruitment-geometry.ts';
import * as projection from '../src/logos-engine/v6-ordered-recruitment-projection.ts';
import * as reduction from '../src/logos-engine/v5-ordered-front-reduction.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-ordered-recruitment-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const stateFields = ['epoch', 'order', 'methods', 'portable', 'attempts', 'continuation', 'last'].sort();
function expectSourceError(error: unknown, expected: R): boolean {
  assert.ok(error instanceof Error);
  if (expected.name === 'ValueError' && expected.message === 'ordered exact binding mismatch') assert.equal(error.message, expected.message);
  if (expected.cause !== undefined) {
    assert.equal((error as unknown as R).cause, expected.cause);
    assert.deepEqual((error as unknown as R).frontier, expected.frontier);
  }
  return true;
}
function checkWorkflowReceipts(value: any): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(checkWorkflowReceipts); return; }
  const fields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
  if (fields.every(name => Object.hasOwn(value, name))) assert.deepEqual(Object.keys(value).sort(), fields.sort());
  Object.values(value).forEach(checkWorkflowReceipts);
}

for (const row of fixture.geometryCases) test(`ordered original geometry: ${row.id}`, () => {
  const args = copy(row.arguments);
  const run = () => (geometry as unknown as R)[row.operation](...args);
  if (row.error) assert.throws(run, error => expectSourceError(error, row.error));
  else assert.deepEqual(run(), row.value);
});

for (const row of fixture.summaryCases) test(`ordered original summary: ${row.id}`, () => {
  assert.deepEqual(projection.orderedRecruitmentSummary(copy(row.measurement)), row.value);
});

for (const row of fixture.projectionCases) test(`ordered original complete projection: ${row.id}`, () => {
  const args = copy(row.arguments), before = copy(args);
  const run = () => (projection.orderedRecruitmentAlternatives as any)(...args, { reductionNowMs: () => 0 });
  if (row.error) assert.throws(run, error => expectSourceError(error, row.error));
  else assert.deepEqual(run(), row.value, 'Every plan, action, contextual step, consumption trace and search receipt is retained');
  assert.deepEqual(args, before, 'The conditional projection does not mutate its public inputs');
});

for (const row of fixture.cases) test(`ordered original family: ${row.id}`, async () => {
  const family = await OrderedRecruitment.create(); family.restore(copy(row.seedState));
  if (row.controlledDependency === 'duplicate_exact_current_offers') {
    const original = family.offers.bind(family);
    family.offers = (...args: Parameters<OrderedRecruitment['offers']>) => {
      const [offers, measurement] = original(...args); return [offers.concat(copy(offers)), measurement];
    };
  }
  const run = async () => {
    const value = await (family as unknown as R)[row.operation](...copy(row.arguments));
    checkWorkflowReceipts(value); return value === undefined ? null : value;
  };
  if (row.error) await assert.rejects(run, error => expectSourceError(error, row.error));
  else assert.deepEqual(await run(), row.value, 'Complete proposal, point binding, route evidence and source workflow remain compared');
  assert.deepEqual(family.state(), row.afterState, 'All seven source state fields remain compared');
  assert.deepEqual(Object.keys(family.state()).sort(), stateFields);
});

for (const row of fixture.policyCases) test(`ordered original DRM and SRC: ${row.id}`, async () => {
  const policy = await RecruitmentPolicy.create();
  assert.deepEqual(policy.select(copy(row.offers)), row.select);
  const value = await policy.choose(copy(row.offers)); checkWorkflowReceipts(value);
  assert.deepEqual(value, row.choose);
  assert.equal(value[0].release_authority, false);
});

for (const row of fixture.reductionCases) test(`ordered consumed original V5 reduction: ${row.id}`, () => {
  let clockCalls = 0;
  const now = () => row.clockMilliseconds[Math.min(clockCalls++, row.clockMilliseconds.length - 1)];
  const request = copy(row.request), before = copy(request);
  const run = () => reduction.measureOrderedFrontReductionD(request, now);
  if (row.error) assert.throws(run, error => expectSourceError(error, row.error));
  else assert.deepEqual(run(), row.value, 'Complete D result, scope, ordered frontier, cursor, trace and descriptive facts match');
  assert.equal(clockCalls, row.clockCalls);
  assert.deepEqual(request, before);
  assert.deepEqual(reduction.normalizeOrderedFrontReductionRequestD(copy(row.request)), row.normalizedRequest);
  assert.equal(reduction.orderedFrontReductionInputDigest(copy(row.request)), row.inputDigest);
});

for (const row of fixture.constructorCases) test(`ordered original V5 model: ${row.id}`, () => {
  const run = () => (reduction as unknown as R)[row.operation](copy(row.argument));
  // Python's ValidationError and the native TypeError are distinct API error
  // classes; exact accepted normalized values remain compared without dropping fields.
  if (row.error) assert.throws(run, TypeError);
  else assert.deepEqual(run(), row.value);
});

for (const row of fixture.nativeAdaptationCases) test(`ordered named native boundary: ${row.id}`, () => {
  assert.ok(row.qualification); assert.ok(row.sourceResult.value);
  assert.equal(row.nativeExpectedError, 'TypeError');
  const owner = row.operation === 'recruitmentDigest' ? geometry : reduction;
  assert.equal(typeof (owner as unknown as R)[row.operation], 'function');
  assert.throws(() => (owner as unknown as R)[row.operation](copy(row.argument)), TypeError);
});

test('ordered reference binds its generator, all checked originals and consumed source functions', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.ordered-recruitment-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false); assert.equal(fixture.fullCallerParity, false);
  assert.equal(fixture.sourceFilesVerifiedBefore, 1786); assert.equal(fixture.sourceFilesVerifiedAfter, 1786);
  assert.equal(fixture.sourceFilesVerifiedBeforeAndAfter, 1786);
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  assert.deepEqual(fixture.bytecodeIsolation, { dontWriteBytecode: true, freshPrefixEmptyAfter: true });
  const exporter = readFileSync(new URL('../scripts/export-v6-ordered-recruitment-reference.py', import.meta.url));
  assert.equal(fixture.generator.path, 'scripts/export-v6-ordered-recruitment-reference.py');
  assert.equal(createHash('sha256').update(exporter).digest('hex'), fixture.generator.sha256);
  const pin = `../reference/v6/${fixture.referenceCommit}/`;
  const manifest = JSON.parse(readFileSync(new URL(pin + 'manifest.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(pin + 'source/' + path, import.meta.url))).digest('hex'), hash, path);
    assert.equal(manifest.files[path].sha256, hash, path);
  }
  for (const name of ['geometryCases', 'projectionCases', 'cases', 'policyCases', 'reductionCases', 'constructorCases', 'nativeAdaptationCases']) {
    assert.equal(fixture.groupCounts[name], fixture[name].length); assert.ok(fixture[name].length > 0);
    assert.equal(new Set(fixture[name].map((row: R) => row.id)).size, fixture[name].length);
  }
  const checks = [
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/geometry.py', 'measure'],
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/projection.py', 'alternatives'],
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/family.py', 'OrderedRecruitment.propose'],
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/family.py', 'OrderedRecruitment.before'],
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/family.py', 'OrderedRecruitment.record'],
    ['agents/yf_arc3_v6/morphology_policy/ordered_recruitment/policy.py', 'RecruitmentPolicy.select'],
    ['agents/yf_arc3_v5/capabilities/ordered_front_reduction_d.py', 'measure_ordered_front_reduction_d'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py', 'DWorkBudget.visit'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py', 'DWorkBudget.finish'],
  ];
  for (const [path, name] of checks) assert.ok(fixture.executedSourceFunctions.some((row: R) => row.path === path && row.function === name && row.calls > 0), name);
});

test('ordered cache coverage comes from actual original calls within one conditional projection', () => {
  const row = fixture.projectionCases.find((item: R) => item.id === 'same_survivor_queues_reuse_current_call_cache');
  assert.ok(row.sourceKernelCalls > 0); assert.ok(row.sourceCacheHits > 0);
  assert.equal(row.sourceReductionLookups - row.sourceKernelCalls, row.sourceCacheHits);
});

test('ordered cold method comes from actual public contrast and portable methods grant no current permit', () => {
  const cold = fixture.kernelCold, portable = fixture.kernelPortable;
  assert.equal(cold.cold.value, null);
  assert.deepEqual(cold.cold.seedState.methods, []); assert.deepEqual(cold.cold.seedState.portable, []);
  assert.deepEqual(cold.initialObservation.available_action_refs, ['ACTION5']);
  assert.equal(cold.passive.afterState.methods.length, 1);
  assert.equal(cold.passive.afterState.methods[0].kind, 'legend_direction_calibrated_by_actual_single_enemy_return');
  assert.equal(cold.passiveNoChange.afterState.methods.length, 0);
  assert.equal(cold.proposal.value.recruitment_plan.offer.step.type, 1);
  assert.equal(cold.append.afterState.continuation.steps.length, 1);
  assert.deepEqual(cold.continuation.value.recruitment_plan.offer.search, { status: 'validated_suffix_retained_no_new_search' });
  assert.deepEqual(portable.boundary.afterState.methods, []);
  assert.equal(portable.boundary.afterState.portable[0].authority, 'revisable_method_not_current_permit');
  assert.equal(portable.proposal.value.recruitment_plan.offer.method_revalidation.release_authority, false);
  assert.deepEqual(Object.keys(cold.proposal.value.recruitment_plan).sort(), ['offer', 'remaining', 'choice', 'workflow', 'drm_hash'].sort());
});

test('ordered complete source restoration detaches caller state and returned state', async () => {
  const family = await OrderedRecruitment.create(), source = copy(fixture.kernelCold.append.afterState);
  family.restore(source); const expected = family.state();
  source.methods.length = 0; assert.deepEqual(family.state(), expected);
  const returned = family.state(); returned.continuation.steps.length = 0;
  assert.deepEqual(family.state(), expected);
  const restored = await OrderedRecruitment.create(); restored.restore(copy(expected));
  assert.deepEqual(restored.state(), expected);
  assert.deepEqual(await restored.proposeSource(fixture.kernelCold.nextCombatObservation, fixture.kernelCold.nextCombatRows, [], 7), fixture.kernelCold.continuation.value);
});
