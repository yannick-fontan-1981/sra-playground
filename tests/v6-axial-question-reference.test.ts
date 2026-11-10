import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { AxialQuestion } from '../src/logos-engine/v6-axial-question.ts';
import { AxialPolicy } from '../src/logos-engine/v6-axial-question-policy.ts';
import * as geometry from '../src/logos-engine/v6-axial-question-geometry.ts';

type R = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-axial-question-reference.json.gz', import.meta.url))).toString()) as R;
const copy = <T>(value: T): T => structuredClone(value);
const receiptFields = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
function sourceView(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sourceView);
  if (receiptFields.every(k => Object.hasOwn(value, k)) && typeof value.workflow === 'string') {
    assert.deepEqual(Object.keys(value).sort(), [...receiptFields].sort(), 'Every original SRC receipt field remains compared');
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceView(child)]));
}

for (const row of fixture.geometryCases) test(`axial original geometry: ${row.id}`, () => {
  const run = () => (geometry as unknown as R)[row.operation](...copy(row.arguments));
  if (row.error) assert.throws(run); else assert.deepEqual(run(), row.value);
});

for (const row of fixture.cases) test(`axial original family: ${row.id}`, async () => {
  const family = await AxialQuestion.create(); family.restore(copy(row.seedState));
  const run = async () => {
    const value = await (family as unknown as R)[row.operation](...copy(row.arguments));
    return value === undefined ? null : sourceView(value);
  };
  if (row.error) await assert.rejects(run); else assert.deepEqual(await run(), row.value);
  assert.deepEqual(sourceView(family.state()), row.afterState, 'All six original source fields are compared');
});

for (const row of fixture.policyCases) test(`axial original DRM/SRC selection: ${row.id}`, async () => {
  const policy = await AxialPolicy.create();
  assert.deepEqual(policy.select(copy(row.offers)), row.select);
  assert.deepEqual(sourceView(await policy.choose(copy(row.offers))), row.choose);
  assert.equal(row.select.release_authority, false);
});

test('axial oracle verifies the original sources and executes the consumed V5 pivot path', () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.ok(fixture.sourceFilesVerifiedBeforeAndAfter > 1700);
  assert.match(fixture.qualification, /synthetic/); assert.match(fixture.qualification, /No game dispatch/);
  assert.match(fixture.boundaryQualification, /source limitation/);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.referenceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, path);
  }
  for (const [path, name] of [
    ['agents/yf_arc3_v5/capabilities/axial_field_configuration.py', '_direct'],
    ['agents/yf_arc3_v5/capabilities/axial_field_configuration.py', '_state'],
    ['agents/yf_arc3_v5/capabilities/mechanical_family_contracts_d.py', 'DWorkBudget.visit'],
    ['agents/yf_arc3_v6/morphology_policy/axial_question/geometry.py', 'projected_turns'],
    ['agents/yf_arc3_v6/morphology_policy/axial_question/policy.py', 'AxialPolicy.select'],
    ['agents/yf_arc3_v6/morphology_policy/axial_question/family.py', 'AxialQuestion.record'],
  ]) assert.ok(fixture.executedSourceFunctions.some((r: R) => r.path === path && r.function === name && r.calls > 0), name);
});

test('axial cold public contrast, real SRC proposal and observed turn influence the next choice', async () => {
  const k = fixture.kernelCold, family = await AxialQuestion.create();
  assert.equal(family.selection, null); assert.equal(family.epoch, null); assert.equal(family.rotations.length, 0);
  assert.equal(await family.proposeSource(k.initialObservation, k.initialRows, [], 8), null);
  assert.deepEqual(family.recordObserved(k.initialObservation, k.selectedObservation, k.selectionCommand,
    k.initialRows, k.selectedRows), k.passive.value);
  assert.deepEqual(family.state(), k.passive.afterState);
  const proposal = await family.proposeSource(k.selectedObservation, k.selectedRows, [], 8);
  assert.deepEqual(proposal, k.proposal.value);
  assert.equal((proposal as R).bundle_template.operation_key, 'OP18');
  assert.equal((proposal as R).axial_plan.workflow.workflow, 'v6.axial_question.choose');
  assert.equal((proposal as R).axial_plan.workflow.src_status, k.proposal.value.axial_plan.workflow.src_status);
  assert.equal((proposal as R).axial_plan.choice.release_authority, false);
  assert.equal(family.before(proposal!, 0, { frame_rows: k.selectedRows } as any, k.selectedObservation).admitted, true);
  assert.equal(family.after(proposal!, 0, k.selectedObservation, k.contraryObservation,
    k.selectedRows, k.contraryRows).matched, null);
  assert.deepEqual(family.record(k.selectedObservation, k.contraryObservation, (proposal as R).actions[0],
    k.selectedRows, k.contraryRows, proposal!, 0, [k.contraryRows]), { events: [k.active.value] });
  assert.deepEqual(family.state(), k.active.afterState);
  const next = await family.proposeSource(k.contraryObservation, k.contraryRows, [], 8);
  assert.deepEqual(next, k.next.value);
  assert.equal((next as R).axial_plan.offer.method_revalidation.release_authority, false);
  const restored = await AxialQuestion.create(); restored.restoreNative(family.nativeState());
  assert.deepEqual(await restored.proposeSource(k.contraryObservation, k.contraryRows, [], 8), next);
  const without = await AxialQuestion.create(); without.restore({ ...family.state(), rotations: [] });
  const ablation = await without.proposeSource(k.contraryObservation, k.contraryRows, [], 8);
  assert.notDeepEqual((ablation as R).actions, (next as R).actions, 'A real acquired receipt changes ACTION3 into recalled ACTION4');
});

test('axial source tie selection is deterministic and independent of exact guard uniqueness', async () => {
  const policy = await AxialPolicy.create(), tie = fixture.policyCases.find((r: R) => r.id === 'source_index_final_tie');
  const [selected] = await policy.choose(copy(tie.offers));
  assert.equal(selected.status, 'selected'); assert.equal(selected.index, 0);
  const source = fixture.cases.find((r: R) => r.id === 'shared_key_multiple_peers_guard_abstains');
  const family = await AxialQuestion.create(); family.restore(copy(source.seedState));
  const [proposal, index, publicPacket, obs] = copy(source.arguments);
  assert.ok(proposal); assert.equal(family.before(proposal, index, publicPacket, obs).admitted, false);
});

test('axial boundary adaptation excludes the new final scene and preserves original packet ordinals', async () => {
  const row = fixture.cases.find((r: R) => r.id === 'boundary_uses_last_compatible_old_scene_sample');
  const family = await AxialQuestion.create(); family.restore(copy(row.seedState));
  const result = family.recordObserved(...copy(row.arguments) as Parameters<AxialQuestion['recordObserved']>) as R;
  const { native_packet_attribution: attribution, ...source } = result;
  assert.deepEqual(source, row.value);
  assert.deepEqual(attribution.accepted_frame_ordinals, [0, 1]);
  assert.equal(attribution.status, 'old_scene_frames_only');
  assert.equal(attribution.new_scene_is_old_effect_evidence, false);
  assert.deepEqual(family.state(), row.afterState);
  assert.equal(family.portable[0].methods[0].frame_ordinal, 1);
  assert.equal(family.selection, null); assert.equal(family.rotations.length, 0);
  assert.deepEqual(family.attempts, {}); assert.equal(family.last, null);
});

test('axial same-geometry new level is unknown rather than old-scene effect evidence', async () => {
  const row = fixture.cases.find((r: R) => r.id === 'source_identical_geometry_boundary_is_permissive');
  assert.equal(row.afterState.portable.length, 1, 'Original source limitation is retained in the independent oracle');
  for (const packet of [undefined, [], [row.arguments[4]], [row.arguments[3], row.arguments[4]]]) {
    const family = await AxialQuestion.create(); family.restore(copy(row.seedState));
    const args = copy(row.arguments); args[7] = packet;
    const result = family.recordObserved(...args as Parameters<AxialQuestion['recordObserved']>) as R;
    assert.equal(result.native_packet_attribution.status, 'ambiguous_old_and_new_scene_anchors_no_physical_contrast');
    assert.deepEqual(result.native_packet_attribution.accepted_frame_ordinals, []);
    assert.deepEqual(result.events, []); assert.equal(result.goal_supported_only_by_official_score, true);
    assert.equal(family.epoch, 2); assert.equal(family.selection, null); assert.equal(family.rotations.length, 0);
    assert.equal(family.portable.length, 0, 'No rotation is fabricated from the new level');
  }
});

test('axial boundary without attributable old frame keeps historical methods but resets current authority', async () => {
  const k = fixture.kernelControlled, family = await AxialQuestion.create(); family.restore(copy(k.active.afterState));
  const result = family.recordObserved(k.contraryObservation, k.newObservation, k.proposal.value.actions[0],
    k.contraryRows, k.newRows, k.proposal.value, 0, []) as R;
  assert.equal(result.native_packet_attribution.status, 'no_attributable_old_scene_frame');
  assert.deepEqual(result.events, []); assert.equal(family.portable.length, 1);
  assert.deepEqual(family.portable[0].methods, k.active.afterState.rotations);
  assert.equal(family.selection, null); assert.deepEqual(family.attempts, {});
  assert.equal(await family.proposeSource(k.newObservation, k.newRows, [], 8), null);
});

test('axial entry uses its exact source slot and no other source entry', async () => {
  const k = fixture.kernelCold, family = await AxialQuestion.create(); family.restore(copy(k.passive.afterState));
  assert.deepEqual(await family.proposeInSubquestion('factored_material_return', 'axial_question',
    k.selectedObservation, k.selectedRows, [], 8), { ...k.proposal.value, material_access_subquestion: 'axial_question' });
  await assert.rejects(family.proposeInSubquestion('information_goal', 'axial_question', k.selectedObservation, k.selectedRows, [], 8), /Unknown axial-question/);
  await assert.rejects(family.proposeInSubquestion('factored_material_return', 'window_question', k.selectedObservation, k.selectedRows, [], 8), /Unknown axial-question/);
});

test('axial checkpoint is detached, immutable, atomic and keeps exactly six source fields', async () => {
  const family = await AxialQuestion.create(), seed = copy(fixture.kernelControlled.active.afterState);
  family.restore(seed); const expected = family.state();
  seed.selection.evidence.length = 0; seed.rotations.length = 0; assert.deepEqual(family.state(), expected);
  const publicState = family.state(); publicState.selection.evidence.length = 0; assert.deepEqual(family.state(), expected);
  const saved = family.nativeState() as R, revision = family.nativeRevision;
  assert.deepEqual(Object.keys(saved.source_state).sort(), ['epoch', 'selection', 'rotations', 'portable', 'attempts', 'last'].sort());
  assert.ok(Object.isFrozen(saved)); assert.ok(Object.isFrozen(saved.source_state.selection.evidence));
  assert.equal(family.nativeState(), saved);
  for (const invalid of [{ ...copy(saved), format: 'foreign' }, { ...copy(saved), extra: true },
    { ...copy(saved), source_state: { ...copy(expected), epoch: NaN } },
    { ...copy(saved), source_state: { ...copy(expected), selection: [] } },
    { ...copy(saved), source_state: { ...copy(expected), rotations: [1] } },
    { ...copy(saved), source_state: { ...copy(expected), attempts: [] } },
    { ...copy(saved), source_state: { ...copy(expected), last: [] } }]) {
    assert.throws(() => family.restoreNative(invalid)); assert.deepEqual(family.state(), expected);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), saved);
  }
  assert.throws(() => family.restore({ selection: [] })); assert.deepEqual(family.state(), expected);
  family.restore({ selection: null, rotations: [], last: null }); family.restoreNative(saved);
  assert.deepEqual(family.state(), expected, 'An identical checkpoint repairs changed mutable fields');
});
