import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ChartNavigation } from '../src/logos-engine/v6-chart-navigation.ts';
import { ChartPolicy } from '../src/logos-engine/v6-chart-navigation-policy.ts';
import * as geometry from '../src/logos-engine/v6-chart-navigation-geometry.ts';

type R = Record<string, any>;
const evidence = new URL('../docs/migration/lot9a-evidence/reference-01/', import.meta.url);
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('reference.json.gz', evidence))).toString()) as R;
const declaration = JSON.parse(readFileSync(new URL('declaration.json', evidence), 'utf8')) as R;
const copy = <T>(value: T): T => structuredClone(value);
const digest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const caseById = (id: string): R => {
  const value = fixture.cases.find((row: R) => row.id === id);
  assert.ok(value, id); return value;
};

for (const row of fixture.geometryCases) test(`chart immutable original geometry: ${row.id}`, () => {
  const args = copy(row.arguments);
  if (row.operation === 'routeChart') args[3] = new Set(args[3].map((p: number[]) => geometry.chartPointKey(p)));
  const run = () => (geometry as unknown as R)[row.operation](...args);
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.cases) test(`chart immutable original owner: ${row.id}`, async () => {
  const family = await ChartNavigation.create();
  family.restore(copy(row.seedState));
  const run = async () => {
    const result = await (family as unknown as R)[row.operation](...copy(row.arguments));
    return result === undefined ? null : result;
  };
  if (row.error) {
    await assert.rejects(run, (error: Error) => {
      assert.equal(error.message, row.error.message, 'The source action binding rejection is preserved');
      return true;
    });
  } else assert.deepEqual(await run(), row.value);
  assert.deepEqual(family.state(), row.afterState, 'Every source field, digest, receipt and evidence entry is retained');
});

for (const row of fixture.policyCases) test(`chart immutable original DRM and SRC: ${row.id}`, async () => {
  const policy = await ChartPolicy.create();
  assert.deepEqual(policy.select(copy(row.offers)), row.select);
  assert.deepEqual(await policy.choose(copy(row.offers)), row.choose);
  assert.equal(row.select.release_authority, false);
});

test('chart corpus is pinned, independent, bounded and entirely public-sized at inception', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.chart-navigation-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.equal(declaration.declaredBeforeOracleExecution, true);
  assert.equal(declaration.nativeImports, false);
  assert.equal(declaration.gamePayloadsInterpreted, 0);
  assert.equal(declaration.gameActionsDispatched, 0);
  assert.equal(declaration.performanceMeasurement, false);
  assert.equal(declaration.globalLockAcquired, false);
  assert.equal(digest(readFileSync(new URL('declaration.json', evidence))), fixture.declaration.sha256);
  assert.equal(digest(readFileSync(new URL(`../${fixture.generator.path}`, import.meta.url))), fixture.generator.sha256);
  assert.equal(digest(readFileSync(new URL(`../${fixture.sourceManifest.path}`, import.meta.url))), declaration.sourceManifestSha256);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) {
    assert.equal(digest(readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${path}`, import.meta.url))), hash, path);
    assert.ok(!path.includes('/games/') && !path.includes('/game_impl/'), 'No game implementation is in the consumed source graph');
  }
  assert.equal(fixture.stateFields.length, 14);
  for (const [name, frame] of Object.entries(fixture.frames) as [string, R][]) {
    assert.equal(frame.rows.length, 64, name);
    assert.ok(frame.rows.every((r: number[]) => r.length === 64 && r.every(v => Number.isInteger(v) && v >= 0 && v <= 15)), name);
    assert.deepEqual(frame.public.frame_rows, frame.rows);
    assert.deepEqual(frame.public.frame_packet, [frame.rows]);
    assert.equal(frame.observation.observation_ref,
      `chart:synthetic:epoch:${frame.observation.level_epoch}:revision:${frame.observation.revision}:frame:${frame.observation.frame_hash}`);
  }
  assert.ok(Object.keys(fixture.frames).length <= declaration.bounds.maximumFrames);
  assert.ok(fixture.geometryCases.length <= declaration.bounds.maximumGeometryCases);
  assert.ok(fixture.cases.length <= declaration.bounds.maximumOwnerOperations);
  assert.ok(fixture.policyCases.length <= declaration.bounds.maximumPolicyCases);
  for (const [path, name] of [
    ['agents/yf_arc3_v6/morphology_policy/chart_navigation/family.py', 'ChartNavigation.record'],
    ['agents/yf_arc3_v6/morphology_policy/chart_navigation/family.py', 'ChartNavigation.returned_view'],
    ['agents/yf_arc3_v6/morphology_policy/chart_navigation/family.py', 'ChartNavigation.before'],
    ['agents/yf_arc3_v6/morphology_policy/chart_navigation/geometry.py', 'decoded'],
    ['agents/yf_arc3_v5/capabilities/inventory_gated_navigation.py', '_chart_decode'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_a.py', 'family_result'],
  ]) assert.ok(fixture.executedSourceFunctions.some((r: R) => r.path === path && r.function === name && r.calls > 0), name);
});

for (const [name, sequence] of Object.entries(fixture.sequences) as [string, R][]) {
  test(`chart complete cold component sequence with checkpoint restoration: ${name}`, async () => {
    const family = await ChartNavigation.create();
    assert.deepEqual(family.state(), sequence.coldState);
    assert.equal(family.sourceStateShouldPersist(), false);
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i], a = fixture.frames[step.beforeFrame], b = fixture.frames[step.afterFrame];
      assert.equal(a.observation.revision, i + 1, `${name} starts cold at the real observer revision`);
      assert.equal(b.observation.revision, i + 2);
      assert.deepEqual(await family.proposeSource(copy(a.observation), copy(a.rows), [], 8), step.proposal);
      assert.deepEqual(family.state(), step.proposalState);
      assert.deepEqual(family.before(copy(step.proposal), 0, copy(a.public), copy(a.observation)), step.before);
      assert.deepEqual(family.after(copy(step.proposal), 0, copy(a.observation), copy(b.observation), copy(a.rows), copy(b.rows)), step.after);
      assert.deepEqual(family.record(copy(a.observation), copy(b.observation), copy(step.proposal.actions[0]), copy(a.rows), copy(b.rows),
        copy(step.proposal), 0, step.returnedFrames.map((n: string) => copy(fixture.frames[n].rows))), { events: [step.record] });
      assert.deepEqual(family.state(), step.afterState);
      assert.equal(family.sourceStateShouldPersist(), true);
      const checkpoint = family.nativeState(); family.restoreNative(checkpoint);
      assert.deepEqual(family.state(), step.afterState);
      assert.equal(step.record.actual_score_delta, 0, 'Controlled pixels do not supply a solved-level claim');
    }
  });
}

test('chart annotations, possession and local permission remain separate receipts', () => {
  const [gain, permission, arrival] = fixture.sequences.primary.steps;
  assert.deepEqual(gain.proposal.chart_plan.offer.held, []);
  assert.deepEqual(gain.afterState.visited, [[22, 10]]);
  assert.equal(gain.afterState.gains[0].status, 'peripheral_gain_observed_ownership_role_hypothetical');
  assert.equal(permission.afterState.grants[0].status, 'local_permission_hypothesis_not_confirmed_transaction');
  assert.equal(permission.afterState.grants[0].returned_frame_context.frame_ordinal, 0);
  assert.equal(permission.afterState.grants[0].returned_frame_context.outside_boundary_equal_to_canonical, true);
  assert.deepEqual(arrival.proposal.chart_plan.offer.held, []);
  assert.equal(arrival.proposal.chart_plan.offer.kind, 'homologous_marker');
  assert.deepEqual(arrival.afterState.position, [46, 10]);
  assert.deepEqual(caseById('loss_without_boundary_frame').afterState.grants, []);
  assert.deepEqual(caseById('boundary_pigment_not_removed').afterState.grants, []);
  assert.deepEqual(caseById('foreign_pixels_disqualify_intermediate').afterState.grants, []);
});

test('chart ambiguous positions need common directions and explicit local evidence', () => {
  const compatible = caseById('same_scene_compatible_direction_continues').value;
  assert.deepEqual(compatible.chart_plan.offer.location_alternatives, [[22, 10], [34, 10]]);
  assert.equal(compatible.chart_plan.offer.route_alternatives.length, 2);
  assert.deepEqual(compatible.actions, [{ action_ref: 'ACTION4' }]);
  const anchor = fixture.sequences.ambiguousBoundary.steps[1];
  assert.equal(anchor.afterState.position_status, 'conditional_current_boundary_annotation_anchor');
  assert.deepEqual(anchor.afterState.position, [34, 10]);
  const absent = caseById('missing_link_cannot_refute_location');
  assert.equal(absent.counterfactual.coldPhysicalQualification, false);
  assert.equal(absent.afterState.position, null);
  assert.deepEqual(absent.afterState.positions, [[22, 10], [34, 10]]);
  assert.deepEqual(absent.afterState.grants, []);
  assert.equal(caseById('incompatible_directions_abstain').value, null);
  const contradictory = caseById('contrary_anchor_retracts_prior_permission');
  assert.equal(contradictory.afterState.position_status, 'current_anchor_refutes_predicted_arrival');
  assert.deepEqual(contradictory.afterState.grants, []);
  assert.deepEqual(contradictory.afterState.visited, []);
});

test('chart checkpoints are detached, immutable, atomic and preserve all fourteen source fields', async () => {
  const family = await ChartNavigation.create(), state = copy(fixture.sequences.primary.steps[1].afterState);
  family.restore(state); const expected = family.state();
  state.grants[0].evidence.length = 0; state.gains.length = 0;
  assert.deepEqual(family.state(), expected);
  const detached = family.state() as R; detached.chart.nodes.length = 0; detached.views = {};
  assert.deepEqual(family.state(), expected);
  const saved = family.nativeState() as R;
  assert.ok(Object.isFrozen(saved)); assert.ok(Object.isFrozen(saved.source_state));
  assert.deepEqual(Object.keys(saved.source_state).sort(), [...fixture.stateFields].sort());
  for (const invalid of [
    { ...copy(saved), format: 'other' },
    { ...copy(saved), extra: true },
    { ...copy(saved), source_state: { ...copy(expected), epoch: NaN } },
    { ...copy(saved), source_state: { ...copy(expected), positions: {} } },
    { ...copy(saved), source_state: { ...copy(expected), grants: {} } },
    { ...copy(saved), source_state: { ...copy(expected), chart: [] } },
  ]) {
    assert.throws(() => family.restoreNative(invalid));
    assert.deepEqual(family.state(), expected, 'Malformed restoration cannot partly replace acquired evidence');
  }
  family.restore({ grants: [], last: null }); family.restoreNative(saved);
  assert.deepEqual(family.state(), expected, 'Restoring the same immutable checkpoint repairs changed mutable state');
});

test('chart official boundary carries interpretation only into the next epoch', async () => {
  const boundary = caseById('official_boundary_retains_interpretation_only');
  assert.equal(boundary.value.status, 'official_boundary_return');
  assert.equal(boundary.afterState.chart, null);
  assert.equal(boundary.afterState.position, null);
  assert.deepEqual(boundary.afterState.grants, []);
  assert.equal(boundary.afterState.portable.length, 1);
  assert.equal(boundary.afterState.portable[0].authority, 'tested_chart_interpretation_not_current_room_or_permit');
  const revalidated = caseById('portable_method_requires_current_morphology');
  assert.equal(revalidated.afterState.method_use.status, 'current_morphology_revalidated_not_world_state');
  assert.deepEqual(revalidated.value.chart_plan.offer.held, []);
  const family = await ChartNavigation.create(); family.restore(copy(boundary.afterState));
  assert.equal(family.sourceStateShouldPersist(), true, 'Portable interpretation is a real persistence owner');
});
