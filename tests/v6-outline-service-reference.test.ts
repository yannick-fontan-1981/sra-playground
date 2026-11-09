import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readEvidenceSync } from './helpers/chunked-evidence.ts';
import { OutlineService } from '../src/logos-engine/v6-outline-service.ts';
import { OutlinePolicy, OUTLINE_POLICY_SUBSET } from '../src/logos-engine/v6-outline-policy.ts';
import { outlineBoxes, outlineSameBox, measureOutlineControlZoneRoutes, measureOutlinePerimeterAccompaniment } from '../src/logos-engine/v6-outline-geometry.ts';
import { v6Canonical } from '../src/logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

const fixture = JSON.parse(gunzipSync(readEvidenceSync(new URL('./fixtures/v6-outline-service-reference.json.gz', import.meta.url))).toString('utf8'));
const policy = await OutlinePolicy.create();

// Only these four receipt fields exist in the pinned source. The native
// interpreter additionally retains its complete execution trace. Normalize
// only the three explicit Outline receipt locations; no other field is lost.
function sourceReceipt(receipt) {
  assert.equal(receipt.execution_engine, 'logos-engine.typescript');
  assert.equal(receipt.reference_commit, OUTLINE_POLICY_SUBSET.referenceCommit);
  return Object.fromEntries(['workflow', 'src_hash', 'src_status', 'executed_statements'].map(key => [key, receipt[key]]));
}
function sourceMeasurement(measured) {
  return measured === null ? null : { ...measured, control_workflow: sourceReceipt(measured.control_workflow) };
}
function sourceProposal(proposal) {
  if (proposal === null) return null;
  return { ...proposal, outline_plan: { ...proposal.outline_plan, measurement: sourceMeasurement(proposal.outline_plan.measurement), workflow: sourceReceipt(proposal.outline_plan.workflow) },
    compositions: proposal.compositions.map(composition => ({ ...composition, properties: { ...composition.properties, current_measurement: sourceMeasurement(composition.properties.current_measurement) } })) };
}

for (const row of fixture.geometryCases) test(`outline V5 geometry ${row.id}`, async () => {
  const a = row.arguments;
  const run = async () => {
    if (row.operation === 'boxes') return outlineBoxes(a.rows);
    if (row.operation === 'sameBox') return outlineSameBox(a.rows, a.box, a.value);
    if (row.operation === 'controlZoneRoutes') return measureOutlineControlZoneRoutes(a.rows, a.fields, a.routeConfig);
    if (row.operation === 'perimeterAccompaniment') return measureOutlinePerimeterAccompaniment(a.rows, a.fields);
    if (row.operation === 'digest') return symbolicDigest(a.value);
    throw new Error(`Unimplemented fixture operation: ${row.operation}`);
  };
  if (row.error) await assert.rejects(run);
  else assert.deepEqual(await run(), row.value);
});

for (const row of fixture.policyCases) test(`outline DRM and SRC ${row.id}`, async () => {
  const choose = row.operation === 'evaluate';
  assert.deepEqual(choose ? policy.interpret(row.facts) : policy.interpretControl(row.facts), row.interpretation);
  const [decision, receipt] = await (choose ? policy.evaluate(row.facts) : policy.bindControl(row.facts));
  assert.deepEqual([decision, sourceReceipt(receipt)], row.value);
});

for (const row of fixture.memoryCases) test(`outline source state and guards ${row.id}`, async () => {
  const family = await OutlineService.create(); family.restore(row.seedState); const a = row.arguments;
  const run = async () => {
    let value;
    switch (row.operation) {
      case 'current': return family.current(a.obs, a.rows);
      case 'measure': return sourceMeasurement(await family.measure(a.obs, a.rows));
      case 'propose': return sourceProposal(await family.propose(a.obs, a.rows, a.inputs, a.remaining));
      case 'scope': await family.scope(a.obs, a.rows); return null;
      case 'restore': family.restore(a.state); return null;
      case 'record': return family.recordSource(a.before, a.after, a.command, a.first, a.second, a.proposal ?? null, a.index ?? 0);
      case 'before': return family.beforeSource(a.proposal, a.index, { frame_rows: a.rows }, a.obs);
      case 'after': return family.afterSource(a.proposal, a.index, a.before, a.after, a.first, a.second);
      case 'bind': family.bind(a.proposal, null); return null;
      case 'stateDetached':
        value = family.state(); value.control.evidence.push('controlled:external-mutation'); value.tracks = {};
        return { mutatedSnapshot: value, retainedState: family.state() };
      case 'restoreDetached':
        value = structuredClone(a.state); family.restore(value); value.control.evidence.push('controlled:incoming-mutation'); value.tracks = {};
        return family.state();
      default: throw new Error(`Unimplemented memory fixture operation: ${row.operation}`);
    }
  };
  if (row.error) await assert.rejects(run);
  else assert.deepEqual(await run(), row.value);
  assert.deepEqual(family.state(), row.afterState);
});

for (const row of fixture.publicInitial) test(`outline cold public geometry abstains without acquisition ${row.index}`, async () => {
  const family = await OutlineService.create();
  assert.deepEqual(await outlineBoxes(row.rows), row.boxes);
  assert.deepEqual(await family.propose(row.observation, row.rows, [], 16), row.proposal);
  assert.deepEqual(family.state(), row.afterState);
  assert.equal(row.proposal, null);
});

test('outline controlled acquisition, complete proposal, guard and real-record comparison match unchanged source', async () => {
  const reference = fixture.controlledAcquisition, family = await OutlineService.create();
  assert.deepEqual(family.state(), reference.initialState);
  for (const transition of reference.transitions) {
    assert.deepEqual(family.state(), transition.beforeState);
    assert.deepEqual(await family.recordSource(transition.before, transition.after, transition.command, transition.first, transition.second), transition.value);
    assert.deepEqual(family.state(), transition.afterState);
  }
  assert.deepEqual(family.state(), reference.acquiredState);
  const current = reference.snapshots.at(-1);
  assert.deepEqual(sourceMeasurement(await family.measure(current.observation, current.rows)), reference.measurement);
  const proposal = await family.propose(current.observation, current.rows, [], 16);
  assert.deepEqual(sourceProposal(proposal), reference.proposal);
  family.bind(proposal, null);
  assert.deepEqual(family.beforeSource(proposal, 0, { frame_rows: current.rows }, current.observation), reference.beforeGuard);
  assert.deepEqual(family.afterSource(proposal, 0, current.observation, reference.localObservation, current.rows, current.rows), reference.localOutcome);
  assert.deepEqual(await family.recordSource(current.observation, reference.localObservation, proposal.actions[0], current.rows, current.rows, proposal, 0), reference.localRecord);
  assert.deepEqual(family.state(), reference.afterLocalState);
  assert.deepEqual(await family.propose(reference.localObservation, current.rows, [], 16), reference.repeatedProposal);
});

test('outline state views detach, native checkpoints freeze deeply, and invalid restores are atomic', async () => {
  const family = await OutlineService.create(), supplied = structuredClone(fixture.controlledAcquisition.acquiredState);
  family.restore(supplied); const before = family.state();
  supplied.control.evidence.push('mutated:caller'); supplied.tracks = {};
  assert.deepEqual(family.state(), before);
  const publicView = family.state(); publicView.control.bbox[0]++; publicView.control.evidence.push('mutated:view'); publicView.methods.push({ status: 'fabricated' });
  assert.deepEqual(family.state(), before);
  const checkpoint = family.nativeState(), revision = family.nativeRevision;
  assert.equal(checkpoint.format, 'native.public_outline_service.v1'); assert.deepEqual(checkpoint.source_state, before);
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.source_state.control.evidence));
  assert.throws(() => { checkpoint.source_state.control.evidence.push('mutated:checkpoint'); }, TypeError);
  const mutations = [value => { value.format = 'unknown'; }, value => { delete value.source_state.last_event; },
    value => { value.source_state.control.controls.ACTION4.delta = [1]; }, value => { value.source_state.methods = {}; },
    value => { value.source_state.tracks = []; }, value => { value.source_state.epoch = NaN; }, value => { value.hidden = true; }];
  for (const mutate of mutations) {
    const changed = structuredClone(checkpoint); mutate(changed);
    assert.throws(() => family.restoreNative(changed), TypeError);
    assert.deepEqual(family.state(), before); assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), checkpoint);
  }
  assert.throws(() => family.restore({ last: { action_ref: 'ACTION1' }, control: { malformed: true } }), TypeError);
  assert.deepEqual(family.state(), before); assert.equal(family.nativeRevision, revision);
  family.restoreNative(checkpoint); assert.equal(family.nativeRevision, revision);
  family.restore({ last: { action_ref: 'ACTION1' } }); assert.deepEqual(family.state(), { ...before, last: { action_ref: 'ACTION1' } });
});

test('outline declarative subset retains the exact three consumed V5 route contracts', () => {
  const subset = JSON.parse(OUTLINE_POLICY_SUBSET.document.text);
  assert.deepEqual(Object.keys(subset.declarations[0].configuration).sort(), [...OUTLINE_POLICY_SUBSET.routeFields].sort());
  assert.equal(createHash('sha256').update(OUTLINE_POLICY_SUBSET.document.text).digest('hex'), OUTLINE_POLICY_SUBSET.document.sha256);
  for (const [path, hash] of Object.entries(OUTLINE_POLICY_SUBSET.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${OUTLINE_POLICY_SUBSET.referenceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, path);
  }
});

for (const recipe of fixture.identityRecipes ?? []) test(`outline original identity recipe ${recipe.sourceHash}`, () => {
  assert.equal(v6Canonical(recipe.value), recipe.sourceCanonical);
  assert.equal(symbolicDigest(recipe.value), recipe.sourceHash);
  assert.equal(recipe.sourceCanonical, recipe.nativeCanonical); assert.equal(recipe.sourceHash, recipe.nativeHash);
});
