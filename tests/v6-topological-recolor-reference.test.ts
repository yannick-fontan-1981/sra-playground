import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { TopologicalRecolor } from '../src/logos-engine/v6-topological-recolor.ts';
import { RecolorPolicy } from '../src/logos-engine/v6-topological-recolor-policy.ts';
import * as geometry from '../src/logos-engine/v6-topological-recolor-geometry.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-topological-recolor-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const receiptFields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sourceView);
  if (receiptFields.every(k => Object.hasOwn(value, k)) && typeof value.workflow === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...receiptFields].sort(), 'No original SRC receipt field is excluded from comparison');
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceView(child)]));
}

for (const row of fixture.geometryCases) test(`recolor original geometry: ${row.id}`, () => {
  const run = () => (geometry as unknown as R)[row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.cases) test(`recolor original family: ${row.id}`, async () => {
  const family = await TopologicalRecolor.create(); family.restore(copy(row.seedState));
  const run = async () => {
    const value = await (family as unknown as R)[row.operation](...copy(row.arguments));
    return value === undefined ? null : sourceView(value);
  };
  if (row.error) await assert.rejects(run); else assert.deepEqual(await run(), row.value);
  assert.deepEqual(sourceView(family.state()), row.afterState, 'All six source state fields are compared');
});

for (const row of fixture.policyCases) test(`recolor original local DRM/SRC: ${row.id}`, async () => {
  const policy = await RecolorPolicy.create();
  assert.deepEqual(policy.select(copy(row.offers)), row.select);
  assert.deepEqual(sourceView(await policy.choose(copy(row.offers))), row.choose);
  assert.equal(row.select.release_authority, false);
});

for (const row of fixture.budgetCases) test(`recolor consumed V5 budget: ${row.id}`, () => {
  const budget = new geometry.RecolorWorkBudget(copy(row.request), () => 0);
  const run = () => row.operation === 'pocketComponents'
    ? geometry.pocketComponents(copy(row.points), row.connectivity, budget)
    : geometry.enclosedPockets(copy(row.region), row.connectivity, budget);
  if (row.error) {
    assert.throws(run, (error: any) => {
      assert.equal(error.name, row.error.name); assert.equal(error.message, row.error.message);
      if (Object.hasOwn(row.error, 'cause')) assert.equal(error.cause, row.error.cause);
      if (Object.hasOwn(row.error, 'frontier')) assert.deepEqual(error.frontier, row.error.frontier);
      return true;
    });
  } else assert.deepEqual(run(), row.value);
  assert.equal(budget.examined, row.examined);
});

test('recolor reference is anchored to unchanged original source, including consumed V5 helpers', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, path);
  }
  for (const [path, name] of [
    ['agents/yf_arc3_v5/capabilities/topological_region_recolor.py', '_pockets'],
    ['agents/yf_arc3_v5/capabilities/topological_region_recolor.py', '_components'],
    ['agents/yf_arc3_v5/capabilities/digital_topology.py', '_neighbors'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py', 'DWorkBudget.visit'],
    ['agents/yf_arc3_v6/morphology_policy/topological_recolor/family.py', 'TopologicalRecolor.record'],
  ]) assert.ok(fixture.executedSourceFunctions.some((r: R) => r.path === path && r.function === name && r.calls > 0), name);
});

test('four controlled source steps preserve unknown goal status and fall back to a real shell pixel', async () => {
  const family = await TopologicalRecolor.create(), steps = fixture.kernelControlled.sequence;
  assert.equal(fixture.kernelControlled.seedState.epoch, null, 'Component starts with cold memory');
  for (const step of steps) {
    assert.deepEqual(await family.proposeSource(step.observation, step.rows, [], 16), step.proposal);
    assert.deepEqual(family.state(), step.proposalState);
    assert.deepEqual(family.before(step.proposal, 0, { frame_rows: step.rows } as any, step.observation), step.before);
    assert.deepEqual(family.after(step.proposal, 0, step.observation, step.afterObservation, step.rows, step.afterRows), step.after);
    assert.deepEqual(family.record(step.observation, step.afterObservation, step.proposal.actions[0], step.rows, step.afterRows,
      step.proposal, 0, [step.afterRows]), { events: [step.record] });
    assert.deepEqual(family.state(), step.afterState);
    const saved = family.nativeState(); family.restoreNative(saved); assert.deepEqual(family.state(), step.afterState);
  }
  const last = steps.at(-1), offer = last.proposal.recolor_plan.offer;
  assert.deepEqual(offer.point, [30, 8]); assert.notDeepEqual(offer.point, [32, 10]);
  assert.equal(last.rows[10][32], 0, 'The bounding-box centre lies inside a hole');
  assert.equal(last.rows[offer.point[1]][offer.point[0]], offer.body.value);
  assert.equal(family.selection.length, 2); assert.equal(family.writes.length, 2); assert.equal(Object.keys(family.attempts).length, 4);
  assert.ok(family.writes.every(w => w.goal_confirmed === false));
  assert.ok(steps.every((s: R) => s.after.matched === null && s.record.goal_hypothesis === true));
});

test('recolor entry preserves source proposal and refuses unrelated source entries', async () => {
  const k = fixture.kernelControlled, family = await TopologicalRecolor.create();
  assert.deepEqual(await family.proposeInSubquestion('factored_material_return', 'topological_recolor', k.observation, k.rows, [], 16),
    { ...k.proposal, material_access_subquestion: 'topological_recolor' });
  await assert.rejects(family.proposeInSubquestion('surface', 'topological_recolor', k.observation, k.rows, [], 16), /Unknown topological-recolor/);
  await assert.rejects(family.proposeInSubquestion('factored_material_return', 'observed_inventory_composition', k.observation, k.rows, [], 16), /Unknown topological-recolor/);
});

test('recolor source inputs do not replace current observation or expand the geometric domain', async () => {
  const k = fixture.kernelControlled, family = await TopologicalRecolor.create();
  assert.deepEqual(await family.proposeSource(k.observation, k.rows, [{ action_ref: 'ACTION1', data: {} }], 16), k.proposal,
    'The original caller ignores its inputs list; current public ACTION6 remains required');
  assert.equal(await family.proposeSource({ ...k.observation, available_action_refs: ['ACTION1'] }, k.rows,
    [{ action_ref: 'ACTION6', data: k.proposal.actions[0].data }], 16), null, 'An input list cannot create a missing public interface');
  assert.throws(() => geometry.components(k.rows, [-1, 0, 3, 3]), /outside current raster/);
  assert.throws(() => geometry.components([[true as any]]));
  assert.throws(() => geometry.components([[256]]));
  assert.throws(() => geometry.components([[1], [1, 2]]));
});

test('recolor checkpoints are detached, immutable, atomic and retain exactly six source fields', async () => {
  const family = await TopologicalRecolor.create(), seed = copy(fixture.kernelControlled.sequence.at(-1).afterState);
  family.restore(seed); const expected = family.state();
  seed.selection[0].evidence.length = 0; seed.writes.length = 0; assert.deepEqual(family.state(), expected);
  const publicState = family.state(); publicState.selection[0].evidence.length = 0; assert.deepEqual(family.state(), expected);
  const saved = family.nativeState() as R, revision = family.nativeRevision;
  assert.deepEqual(Object.keys(saved.source_state).sort(), ['epoch', 'selection', 'writes', 'attempts', 'portable', 'last'].sort());
  assert.ok(Object.isFrozen(saved)); assert.ok(Object.isFrozen(saved.source_state.selection[0].evidence));
  assert.equal(family.nativeState(), saved);
  for (const invalid of [{ ...copy(saved), format: 'other' }, { ...copy(saved), extra: true },
    { ...copy(saved), source_state: { ...copy(expected), epoch: NaN } },
    { ...copy(saved), source_state: { ...copy(expected), selection: {} } },
    { ...copy(saved), source_state: { ...copy(expected), writes: [1] } },
    { ...copy(saved), source_state: { ...copy(expected), attempts: [] } },
    { ...copy(saved), source_state: { ...copy(expected), last: [] } }]) {
    assert.throws(() => family.restoreNative(invalid)); assert.deepEqual(family.state(), expected);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), saved);
  }
  assert.throws(() => family.restore({ selection: {} })); assert.deepEqual(family.state(), expected);
  family.restore({ selection: [], writes: [], last: null }); family.restoreNative(saved);
  assert.deepEqual(family.state(), expected, 'Identical immutable checkpoint still repairs changed mutable owner fields');
});

test('V5 pocket failure never becomes a complete topology receipt', () => {
  const region = copy(fixture.budgetCases[0].region), request = { node_bound: 50000, time_bound_ms: 1000, domain_bound: 20000 };
  for (const invalid of [{ ...region, clipped: true }, { ...region, boundary_complete: false },
    { ...region, support: [...region.support, region.support[0]] }]) {
    assert.throws(() => geometry.enclosedPockets(invalid, 4, new geometry.RecolorWorkBudget(request, () => 0)), geometry.RecolorPrerequisite);
  }
  let now = 0; const budget = new geometry.RecolorWorkBudget(request, () => now);
  budget.visit(); now = 1000;
  assert.throws(() => budget.finish(), (e: any) => e.name === 'DComputationInterrupted' && e.cause === 'TIME_BOUND');
  assert.equal(budget.examined, 1);
});
