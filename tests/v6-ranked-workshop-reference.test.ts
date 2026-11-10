import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { RankedWorkshop } from '../src/logos-engine/v6-ranked-workshop.ts';
import * as geometry from '../src/logos-engine/v6-ranked-workshop-geometry.ts';
import * as stem from '../src/logos-engine/v5-stem-reliefs.ts';
import * as scene from '../src/logos-engine/v5-station-profile-scene.ts';
import * as methods from '../src/logos-engine/v6-ranked-workshop-methods.ts';
import * as preparation from '../src/logos-engine/v6-ranked-workshop-preparation.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-ranked-workshop-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const implementations: R = {
  geometry: { ...geometry, stable_context: geometry.stableContext, comparison_context: geometry.comparisonContext },
  stem: { measure_stem_reliefs: stem.measureStemReliefs, measure_ranked_cuts: stem.measureRankedCuts },
  scene: { measure_corner_quartets: scene.measureCornerQuartets, measure_station_profile_scene: scene.measureStationProfileScene,
    station_profile_context: scene.stationProfileContext },
  methods: { ...methods, mode_signature: methods.modeSignature, support_appearance: methods.supportAppearance,
    extension_options: methods.extensionOptions, prepared_receiver_access: methods.preparedReceiverAccess },
  preparation: { ...preparation, band_index: preparation.bandIndex, preparation_options: preparation.preparationOptions,
    support_relation_admissible: preparation.supportRelationAdmissible },
};
const receiptFields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sourceView);
  if (receiptFields.every(k => Object.hasOwn(value, k)) && typeof value.workflow === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...receiptFields].sort(), 'Every original SRC receipt field remains compared');
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceView(child)]));
}

for (const row of [...fixture.geometryCases, ...fixture.methodCases]) test(`ranked workshop original ${row.module}: ${row.id}`, () => {
  const run = () => implementations[row.module][row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.selectionCases) test(`ranked workshop original DRM selection: ${row.id}`, async () => {
  const family = await RankedWorkshop.create();
  family.observation = copy(row.observation); family.rejected = copy(row.rejected);
  assert.deepEqual(family.select(copy(row.measured)), row.value);
  assert.deepEqual(family.selected, row.selected, 'Compare the exact selected source rule, action, support and objective');
});

for (const row of fixture.cases) test(`ranked workshop original family: ${row.id}`, async () => {
  const family = await RankedWorkshop.create(); family.restore(copy(row.seedState));
  const run = async () => {
    const result = await (family as unknown as R)[row.operation](...copy(row.arguments));
    return result === undefined ? null : sourceView(result);
  };
  if (row.error) await assert.rejects(run); else assert.deepEqual(await run(), row.value);
  assert.deepEqual(sourceView(family.state()), row.afterState, 'All eight original state fields remain compared');
});

test('ranked workshop oracle executes unchanged original V5/V6/SRC/DRM and discloses its synthetic scope', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.ok(fixture.sourceFilesVerifiedBeforeAndAfter > 1700);
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  assert.equal(fixture.publicInitialSource.actionsDispatched, 0);
  for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
  }
  const bytes = readFileSync(new URL(`../${fixture.publicInitialSource.path}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.publicInitialSource.sha256);
  for (const [path, name] of [
    ['agents/yf_arc3_v5/capabilities/stem_reliefs.py', 'measure_stem_reliefs'],
    ['agents/yf_arc3_v5/capabilities/stem_reliefs.py', 'measure_ranked_cuts'],
    ['agents/yf_arc3_v5/capabilities/station_profile_scene.py', 'measure_station_profile_scene'],
    ['agents/yf_arc3_v5/capabilities/station_profile_workbench.py', '_operator'],
    ['agents/yf_arc3_v6/morphology_policy/ranked_workshop/family.py', 'RankedWorkshop.propose'],
    ['agents/yf_arc3_v6/morphology_policy/ranked_workshop/family.py', 'RankedWorkshop.measure'],
    ['agents/yf_arc3_v6/morphology_policy/ranked_workshop/family.py', 'RankedWorkshop.select'],
    ['agents/yf_arc3_v6/morphology_policy/ranked_workshop/family.py', 'RankedWorkshop.record'],
    ['agents/yf_arc3_v6/morphology_policy/ranked_workshop/preparation.py', 'preparation_options'],
  ]) assert.ok(fixture.executedSourceFunctions.some((r: R) => r.path === path && r.function === name && r.calls > 0), name);
});

test('ranked workshop cold passive acquisition activates the workflow and active no-effect return prevents repetition', async () => {
  const family = await RankedWorkshop.create(), k = fixture.kernelControlled;
  assert.equal(await family.proposeSource(copy(k.observation), copy(k.rows), [], 32), null);
  assert.deepEqual(family.recordSource(copy(k.observation), copy(k.heldObservation), copy(k.passiveAction), copy(k.rows), copy(k.heldRows)), k.passiveReturn);
  assert.deepEqual(family.state(), k.acquiredState);
  const proposal = await family.proposeSource(copy(k.heldObservation), copy(k.heldRows), [], 32) as R;
  assert.deepEqual(proposal, k.proposal);
  assert.equal(proposal.bundle_template.operation_key, 'OP18');
  assert.equal(proposal.workshop_plan.workflow.workflow, 'v6.ranked_workshop.choose');
  assert.equal(proposal.workshop_plan.workflow.src_status, 'completed');
  const state = family.nativeState(); family.restoreNative(state);
  assert.deepEqual(family.state(), k.acquiredState, 'Persistence does not invent current or portable evidence');
  family.recordSource(copy(k.heldObservation), copy(k.noEffectObservation), copy(proposal.actions[0]), copy(k.heldRows), copy(k.heldRows), copy(proposal), 0);
  assert.deepEqual(family.state(), k.noEffectState);
  assert.equal(await family.proposeSource(copy(k.noEffectObservation), copy(k.heldRows), [], 32), null);
  assert.equal(family.state().events.at(-1).universal_law_confirmed, false);
});

test('ranked workshop portable restoration asks again and failed versus observed toggles change the next decision', async () => {
  const row = (id: string): R => fixture.cases.find((r: R) => r.id === id);
  const revalidation = row('new_scope_portable_method_is_revalidation_question');
  const failed = row('refuted_portable_method_abstains_in_scope');
  const success = row('confirmed_revalidation_changes_next_decision');
  const family = await RankedWorkshop.create(); family.restore(copy(revalidation.seedState));
  const saved = family.nativeState();
  const restored = await RankedWorkshop.create(); restored.restoreNative(saved);
  assert.deepEqual(await restored.proposeSource(...copy(revalidation.arguments) as [any, any, any, number]), revalidation.value);
  assert.equal(revalidation.value.workshop_plan.control_status, 'portable_method_to_revalidate');
  restored.restore(copy(failed.seedState));
  assert.equal(await restored.proposeSource(...copy(failed.arguments) as [any, any, any, number]), null);
  restored.restore(copy(success.seedState));
  const next = await restored.proposeSource(...copy(success.arguments) as [any, any, any, number]) as R;
  assert.deepEqual(next, success.value);
  assert.equal(next.workshop_plan.stage, 'adjacent_exchange_probe');
  assert.equal(next.compositions[0].properties.receipts_are_not_occupancy, true);
});
