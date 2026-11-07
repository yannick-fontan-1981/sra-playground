import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ORDERED_SUPPORT_POLICY, OrderedSupportTransfer, declaredSupportOrders,
  materializeOrderedSupportTransferWitnesses, materializeOrderedSupportClickCounterfactual, measureMaterialBands,
  measureOrderedSupportGeometry, measureOrderedSupportNonLayerSpans,
  measureOrderedSupportScene, orderedSupportSelectionMatches,
} from '../src/logos-engine/v6-ordered-support.ts';
import { detectV5Components, measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-ordered-support-reference.json', import.meta.url), 'utf8'));
const mainFixture = JSON.parse(await readFile(new URL('./fixtures/v6-ordered-support-main-reference.json', import.meta.url), 'utf8'));
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);

test('ordered-support oracle and DRM bind the unchanged V6 and V5 source files', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [name, entry] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(name, source));
    assert.equal(bytes.length, entry.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, name);
  }
  assert.deepEqual(ORDERED_SUPPORT_POLICY, fixture.policy);
});

for (const [index, item] of fixture.searchCases.entries()) {
  test(`ordered-support BFS matches Python paths and exact expansion accounting ${index + 1}`, () => {
    assert.deepEqual(declaredSupportOrders(item.configuration.length, item.target, item.variants), item.orders);
    assert.deepEqual(materializeOrderedSupportTransferWitnesses(item.request), item.result);
  });
}

for (const item of fixture.counterfactualCases) {
  test(`V5 click-counterfactual projection preserves the declared route contract: ${item.name}`, async () => {
    const rows = item.rows;
    assert.deepEqual(materializeOrderedSupportClickCounterfactual({ rows, components: await detectV5Components(rows),
      point_candidates: item.pointCandidates, point_action_ref: 'ACTION6', configuration: item.configuration }), item.result);
  });
}

async function assertMeasurements(rows, expected, label) {
  const parts = await detectV5Components(rows);
  const geometry = measureOrderedSupportGeometry(rows, parts);
  assert.deepEqual(geometry, expected.geometry, `${label}: V5 geometry`);
  assert.deepEqual(geometry.supports.length ? measureOrderedSupportNonLayerSpans(rows, parts, geometry) : null,
    expected.nonLayer, `${label}: spans and tie accounting`);
  assert.deepEqual(await measureOrderedSupportScene(rows), expected.scene, `${label}: conditional V6 scene`);
}

test('native OrderedSupportTransfer matches original HANO through 30 actions and 3 real level completions', async () => {
  const item = fixture.session, family = new OrderedSupportTransfer();
  let current = item.initial.public;
  let obs = await measureNativeObservation(current, 0, 'native-ordered-support-oracle');
  assert.deepEqual(obs, item.initial.observation);
  await assertMeasurements(current.frame_rows, item.initial.measurements, 'initial');
  let actions = 0, completions = 0;
  for (const [cycle, event] of item.transitions.entries()) {
    const proposal = await family.propose(obs, current.frame_rows, [], event.remaining);
    assert.ok(proposal, `proposal at cycle ${cycle}`);
    assert.deepEqual(proposal, event.proposal, `full original proposal at cycle ${cycle}`);
    for (const [index, step] of event.steps.entries()) {
      assert.deepEqual(family.before(proposal, index, current, obs), step.beforeGuard, `before action ${actions + 1}`);
      if (!step.beforeGuard.admitted) break;
      const after = await measureNativeObservation(step.afterPublic, actions + 1, 'native-ordered-support-oracle');
      assert.deepEqual(after, step.afterObservation, `observation after action ${actions + 1}`);
      assert.deepEqual(await family.after(proposal, index, obs, after, current.frame_rows, step.afterPublic.frame_rows), step.afterGuard,
        `after guard at action ${actions + 1}`);
      assert.deepEqual(await family.record(obs, after, proposal.actions[index]!, current.frame_rows, step.afterPublic.frame_rows,
        proposal, index, step.afterPublic.frame_packet), step.record, `evidence at action ${actions + 1}`);
      assert.deepEqual(family.state(), step.familyState, `retained memory at action ${actions + 1}`);
      completions += after.levels_completed - obs.levels_completed;
      current = step.afterPublic; obs = after; actions++;
    }
  }
  assert.equal(actions, item.actions);
  assert.equal(actions, 30);
  assert.equal(completions, 3);
  assert.equal(current.levels_completed, item.levelsCompleted);
  assert.deepEqual(family.state(), item.finalFamilyState);
  assert.deepEqual(await family.propose(obs, current.frame_rows, [], 160 - actions), item.finalProposal);
  const restored = new OrderedSupportTransfer(); restored.restore(family.state());
  assert.deepEqual(restored.state(), family.state());
  assert.deepEqual(await restored.propose(obs, current.frame_rows, [], 160 - actions), item.finalProposal);
});

test('native family plus support binding matches all 15 proposals selected by the full original MAIN', async () => {
  const familyBytes = await readFile(new URL('./fixtures/v6-ordered-support-reference.json', import.meta.url));
  assert.equal(createHash('sha256').update(familyBytes).digest('hex'), mainFixture.familyFixtureSha256);
  for (const [name, expected] of Object.entries(mainFixture.sourceSha256)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name, source))).digest('hex'), expected, name);
  }
  const family = new OrderedSupportTransfer(), levelActions: Record<number, number> = {};
  let current = fixture.session.initial.public, actions = 0;
  let observation = await measureNativeObservation(current, mainFixture.initialRevision, mainFixture.observationScope);
  for (const [index, original] of mainFixture.decisions.entries()) {
    assert.equal(original.revision, actions + 1);
    const remaining = Math.min(mainFixture.globalActionCap - actions,
      mainFixture.levelActionCaps[current.level - 1] - (levelActions[current.level] ?? 0));
    const actual = await family.propose(observation, current.frame_rows, [], remaining);
    assert.ok(actual);
    // This exact assignment is common_support_navigation.bind, outside the
    // OrderedSupportTransfer class. The retained original router receipts are
    // intentionally not claimed as implemented by this family-only test.
    for (const step of actual.steps) step.point_binding = structuredClone(step.locus_witness);
    for (const key of Object.keys(actual)) assert.deepEqual(actual[key], original.proposal[key], `original MAIN proposal ${original.revision}.${key}`);
    const event = fixture.session.transitions[index];
    for (const [stepIndex, step] of event.steps.entries()) {
      assert.equal(family.before(actual, stepIndex, current, observation).admitted, true);
      const after = await measureNativeObservation(step.afterPublic, actions + 2, mainFixture.observationScope);
      assert.deepEqual(await family.after(actual, stepIndex, observation, after, current.frame_rows, step.afterPublic.frame_rows), step.afterGuard);
      await family.record(observation, after, actual.actions[stepIndex]!, current.frame_rows, step.afterPublic.frame_rows,
        actual, stepIndex, step.afterPublic.frame_packet);
      levelActions[current.level] = (levelActions[current.level] ?? 0) + 1;
      current = step.afterPublic; observation = after; actions++;
    }
  }
  assert.equal(actions, mainFixture.actions);
  assert.equal(current.levels_completed, mainFixture.levelsCompleted);
  assert.deepEqual(levelActions, mainFixture.levelActions);
});

for (const item of fixture.rasterCases) {
  test(`ordered-support measurements and proposal match Python on ${item.name}`, async () => {
    await assertMeasurements(item.public.frame_rows, item.measurements, item.name);
    const observation = await measureNativeObservation(item.public, 0, 'native-ordered-support-raster');
    assert.deepEqual(observation, item.observation);
    assert.deepEqual(await new OrderedSupportTransfer().propose(observation, item.public.frame_rows, [], 160), item.proposal);
  });
}

test('a repeated asymmetric extension stays ambiguous in the original and native detector', async () => {
  const item = fixture.invalidMeasurements.asymmetric_material;
  await assertMeasurements(item.rows, item, 'asymmetric_material');
  assert.equal(item.scene, null);
});

test('selection guards require the measured member or its exact surrounding ring', () => {
  const proposal = fixture.session.transitions[0].proposal;
  const before = fixture.session.initial.public.frame_rows;
  for (const item of fixture.selectionCases) {
    assert.equal(orderedSupportSelectionMatches(before, item.rows, proposal.support_plan), item.matches, item.name);
  }
  for (const item of fixture.materialBandCases) {
    assert.deepEqual(measureMaterialBands(item.rows, item.box, new Set(item.referencePixels.map(([x, y]) => `${x},${y}`))), item.bands, item.name);
  }
});

test('stale scope, altered action, absent selection and insufficient budget cannot authorize a deposit', async () => {
  const item = fixture.session, original = item.transitions[0], family = new OrderedSupportTransfer();
  const current = item.initial.public, obs = item.initial.observation;
  const proposal = await family.propose(obs, current.frame_rows, [], 160);
  assert.ok(proposal);
  assert.equal(family.before(proposal, 0, { ...current, level: current.level + 1 }, obs).admitted, false);
  assert.equal(family.before(proposal, 0, { ...current, available_action_refs: [] }, obs).admitted, false);
  assert.equal(family.before(proposal, 0, current, { ...obs, observation_ref: 'other' }).admitted, false);
  assert.equal(family.before(proposal, 1, current, obs).admitted, false);
  const changed = structuredClone(proposal); changed.actions[0].data.x++;
  assert.equal(family.before(changed, 0, current, obs).admitted, false);
  assert.equal(await family.propose(obs, current.frame_rows, [], 1), null);
  assert.equal(await family.propose({ ...obs, available_action_refs: [] }, current.frame_rows, [], 160), null);
  await assert.rejects(family.record(obs, original.steps[0].afterObservation, changed.actions[0], current.frame_rows,
    original.steps[0].afterPublic.frame_rows, proposal, 0, []), /differs from released binding/);
});

test('observed mismatch closes only the measured context and survives state restoration', async () => {
  const item = fixture.session, current = item.initial.public, obs = item.initial.observation;
  const family = new OrderedSupportTransfer(), proposal = await family.propose(obs, current.frame_rows, [], 160);
  assert.ok(proposal);
  const after = { ...obs, observation_ref: 'unmatched-observation', revision: obs.revision + 1 };
  const result = await family.record(obs, after, proposal.actions[0]!, current.frame_rows, current.frame_rows, proposal, 0, []);
  assert.equal(result.events[0].matched, false);
  assert.equal(await family.propose(obs, current.frame_rows, [], 160), null);
  const restored = new OrderedSupportTransfer(); restored.restore(family.state());
  assert.equal(await restored.propose(obs, current.frame_rows, [], 160), null);
  assert.ok(await restored.propose({ ...obs, level_epoch: obs.level_epoch + 1 }, current.frame_rows, [], 160));
});

test('bounded search rejects invalid order declarations instead of inventing a traversal', () => {
  const request = fixture.searchCases[0].request;
  for (const mutation of [
    { traversal_orders: [] }, { traversal_orders: [[0, 0, 1]] }, { traversal_orders: [[0, 1, 2], [0, 1, 2]] },
    { endpoint_support_index: 3 }, { maximum_state_expansions: 65537 }, { maximum_transfer_depth: 0 },
    { configuration: { support_extents: [[7, 11], [], []] } }, { configuration: { support_extents: [[7], [7], []] } },
  ]) assert.throws(() => materializeOrderedSupportTransferWitnesses({ ...request, ...mutation }));
});
