import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureOccludedCatalogue, fitOccludedCatalogue, exposedCatalogueValues, catalogueStructure, catalogueFieldPixels } from '../src/logos-engine/v6-occluded-catalogue-observation.ts';
import { measureOccludedCatalogueProjection, certifyOccludedCatalogue, iterIntegerCatalogueProjection } from '../src/logos-engine/v6-occluded-catalogue-mechanics.ts';
import { OccludedCatalogueMemory, commonOccludedCatalogueProposal, commonCatalogueViewProposal, bindOccludedCatalogue,
  occludedCatalogueBefore, occludedCatalogueAfter } from '../src/logos-engine/v6-occluded-catalogue-access.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-occluded-catalogue-reference.json.gz');
const probe = await compressed(fixture.originalPublicProbe.path);
const cold = await compressed(fixture.isolatedColdProbe.path);
const discovery = await compressed(fixture.initialDiscovery.path);
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const projection = (memory: OccludedCatalogueMemory): R => {
  const { requested_stop_reason: _, ...own } = memory.currentState(); return own;
};
const clock = () => 0;

function assertState(memory: OccludedCatalogueMemory, expected: R): void {
  assert.deepEqual(projection(memory), expected.projection);
  assert.equal(memory.requestedStopReason, expected.requestedStopReason ?? null);
  assert.equal(memory.retainedCatalogueDigest(expected.parentDigest), expected.catalogueDigest);
  assert.equal(memory.retainedDigest(expected.parentDigest), expected.digest);
}

test('catalogue reference distinguishes cold abstention, source-provider coordination and original full caller parity', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  assert.match(fixture.qualification.commonEnvelope, /not the original full common caller/);
  assert.match(fixture.qualification.coldStart, /independently proposed by original ObservedFrontier/);
  assert.match(fixture.qualification.digestScope, /actual FramedWindowAccess ancestor/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe, cold, discovery]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, Object.keys(manifest.files).length);
    for (const [path, digest] of Object.entries(item.sourceHashes)) {
      assert.equal(manifest.files[path].sha256, digest, path);
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), digest, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  for (const source of [fixture.originalPublicProbe, fixture.isolatedColdProbe, fixture.initialDiscovery]) {
    assert.equal(hash(await readFile(new URL(source.path, root))), source.sha256);
  }
  assert.equal(cold.status, 'stopped'); assert.equal(cold.reason, 'occluded_catalogue_component_abstained');
  assert.equal(cold.actions, 0); assert.equal(cold.levelsCompleted, 0); assert.equal(cold.packets.length, 1);
  assert.equal(probe.status, 'passed'); assert.equal(probe.reason, 'target_levels_completed');
  assert.equal(probe.game, 'GRIL'); assert.equal(probe.fullOriginalCaller, false);
  assert.deepEqual(probe.providerOrder, ['catalogue_propose', 'catalogue_view_propose', 'ObservedFrontier.propose']);
  for (const item of [probe, cold]) {
    assert.equal(item.sessionCount, 1); assert.equal(item.manualPrimingActions, 0); assert.equal(item.resets, 0); assert.equal(item.levelJumps, 0);
    assert.deepEqual(item.requests[0], { type: 'load', code: 'GRIL', level: 1 });
    assert.ok(item.requests.slice(1).every((request: R) => request.type === 'action'));
  }
  assert.equal(probe.actions, 18); assert.equal(probe.levelsCompleted, 3); assert.equal(probe.state, 'NOT_FINISHED');
  assert.deepEqual(probe.boundaries.map((item: R) => item.actions), [5, 10, 18]);
  assert.deepEqual(probe.boundaries.map((item: R) => item.levelActions), [5, 5, 8]);
  assert.equal(probe.packets.length, 19);
  assert.deepEqual(fixture.sourceAliasing, []);
});

test('all 100 untouched initial public scenes preserve source catalogue applicability', () => {
  assert.equal(discovery.games.length, 100); assert.equal(fixture.initialMeasurements.length, 100);
  for (const [index, expected] of (fixture.initialMeasurements as R[]).entries()) {
    const item = discovery.games[index]; assert.equal(item.game, expected.game);
    assert.deepEqual(measureOccludedCatalogue(item.packet.frame_rows), expected.expected, item.game);
  }
  assert.deepEqual(fixture.initialMeasurements.filter((item: R) => item.expected).map((item: R) => item.game), ['GRIL']);
});

for (const item of fixture.cases as R[]) test(`source catalogue contract ${item.id}`, () => {
  const a = item.arguments;
  let actual: unknown;
  switch (item.operation) {
    case 'measure': actual = measureOccludedCatalogue(a.rows); break;
    case 'fit': actual = fitOccludedCatalogue(a.rows, a.scene, a.backgrounds); break;
    case 'exposed': actual = exposedCatalogueValues(a.before, a.after, a.scene); break;
    case 'structure': actual = catalogueStructure(a.scene); break;
    case 'field_pixels': actual = catalogueFieldPixels(a.rows, a.scene); break;
    case 'integer_projection': actual = [...iterIntegerCatalogueProjection(a.points, a.scale, a.translation)]; break;
    case 'projection': actual = measureOccludedCatalogueProjection(a.request, clock); break;
    case 'certify': actual = certifyOccludedCatalogue(a.scene, a.rows, a.obs, a.backgrounds, a.fits, 300000, clock); break;
    default: throw new Error('Unknown independent catalogue operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
});

test('all public packet measurements preserve full masks, extents, current selectors and geometry references', () => {
  assert.equal(fixture.packetMeasurements.length, probe.packets.length);
  for (const item of fixture.packetMeasurements as R[]) {
    assert.deepEqual(measureOccludedCatalogue(probe.packets[item.actionIndex].packet.frame_rows), item.scene, String(item.actionIndex));
  }
});

test('18 source common acquisitions preserve 15 catalogue proposals and 33 own events exactly', async () => {
  const memory = new OccludedCatalogueMemory(), domain = new ObservedInputDomain(4096);
  let boundary = 0, catalogueOffers = 0, views = 0, frontierOffers = 0, events = 0;
  for (const [index, envelope] of (fixture.commonEnvelopes as R[]).entries()) {
    const first = probe.packets[index], after = probe.packets[index + 1];
    assertState(memory, envelope.beforeState);
    const inputs = domain.candidates(first.observation), remaining = probe.budget.levelActions - (index - boundary);
    let proposal = await commonOccludedCatalogueProposal(memory, first.observation, first.packet.frame_rows, inputs, remaining, fixture.policy, 300000, clock);
    if (!proposal) proposal = await commonCatalogueViewProposal(memory, first.observation, first.packet.frame_rows, inputs, remaining, fixture.policy, 300000, clock);
    if (envelope.selectedProvider === 'frontier') {
      assert.equal(proposal, null, 'The catalogue does not invent a first view control');
      assert.equal(envelope.proposal.kind, 'experiment');
      assert.equal(envelope.proposal.question.reason, 'unobserved_input_effect_or_unexplained_transition');
      assert.equal(envelope.proposal.question.input_trials_at_context, 0);
      frontierOffers++;
    } else {
      assert.ok(proposal); assert.deepEqual(proposal, envelope.unboundProposal);
      bindOccludedCatalogue(proposal, domain); assert.deepEqual(proposal, envelope.proposal);
      const meta = { epoch: first.observation.level_epoch, score: first.observation.levels_completed,
        observation_ref: first.observation.observation_ref, available: first.observation.available_action_refs };
      assert.deepEqual(occludedCatalogueBefore(proposal, 0, first.packet.frame_rows, meta), envelope.beforeGuard);
      assert.deepEqual(occludedCatalogueAfter(proposal, 0, first.packet.frame_rows, after.packet.frame_rows,
        { epoch: after.observation.level_epoch, score: after.observation.levels_completed, state: after.observation.state }), envelope.outcome);
      catalogueOffers++; views += Number(proposal.occluded_catalogue_plan.mode === 'view');
    }
    assert.deepEqual(projection(memory), envelope.beforeState.projection, 'Planning acquires no imagined return');
    const selected = proposal ?? envelope.proposal;
    const acquired = memory.record(first.observation, selected.actions[0], after.observation,
      first.packet.frame_rows, after.packet.frame_rows, selected, 0);
    assert.deepEqual(acquired, envelope.ownEvents, `actual source acquisition ${index + 1}`);
    assertState(memory, envelope.ownState); events += acquired.length;
    if (after.observation.levels_completed > first.observation.levels_completed) boundary = index + 1;
  }
  assert.equal(catalogueOffers, 15); assert.equal(views, 4); assert.equal(frontierOffers, 3); assert.equal(events, 33);
  assert.deepEqual(projection(memory), probe.finalState.projection);
});

test('source projection preserves occlusion unknowns and contradictions in every registered view', () => {
  const byId = new Map<string, R>((fixture.cases as R[]).map(item => [item.id, item]));
  const visible = byId.get('projection:visible_rejects_extra_pixel')!.expected;
  const unknown = byId.get('projection:unknown_is_not_negative')!.expected;
  const occluded = byId.get('projection:opaque_occluder_coverage_is_not_absence')!.expected;
  const multiple = byId.get('projection:earlier_view_contradiction_retained')!.expected;
  assert.deepEqual(visible.values.consistent_model_refs, ['M0']);
  assert.deepEqual(unknown.values.consistent_model_refs, ['M0', 'M1']);
  assert.deepEqual(occluded.values.consistent_model_refs, ['M0', 'M1']);
  assert.deepEqual(multiple.values.consistent_model_refs, ['M0']);
  assert.equal(multiple.values.intermediate_registered_view_discarded, false);
  assert.equal(multiple.values.occluded_or_clipped_pixel_used_as_negative, false);
  const bounded = byId.get('projection:node_bound')!.expected;
  assert.equal(bounded.status, 'NEEDS_EVIDENCE'); assert.equal(bounded.domain_complete, false);
  assert.equal(bounded.descriptive_facts.primitive_release_authorized, false);
});

test('current point and view guards reject stale context, changed payloads and missing controls', () => {
  for (const mode of ['answer', 'view']) {
    const envelope = (fixture.commonEnvelopes as R[]).find(item => item.proposal.occluded_catalogue_plan?.mode === mode)!;
    const original = probe.packets[envelope.actionIndex - 1], proposal = clone(envelope.proposal);
    const meta = { epoch: original.observation.level_epoch, score: original.observation.levels_completed,
      observation_ref: original.observation.observation_ref, available: original.observation.available_action_refs };
    for (const change of [{ epoch: meta.epoch + 1 }, { score: meta.score + 1 }, { observation_ref: 'another-view' }, { available: [] }]) {
      assert.equal(occludedCatalogueBefore(proposal, 0, original.packet.frame_rows, { ...meta, ...change }).admitted, false);
    }
    assert.equal(occludedCatalogueBefore(proposal, 1, original.packet.frame_rows, meta).admitted, false);
    const rows = clone(original.packet.frame_rows); rows[0][0] = (rows[0][0] + 1) % 16;
    assert.equal(occludedCatalogueBefore(proposal, 0, rows, meta).admitted, false);
    const changed = clone(proposal); changed.actions[0] = { ...changed.actions[0], data: { x: 0, y: 0 } };
    assert.equal(occludedCatalogueBefore(changed, 0, original.packet.frame_rows, meta).admitted, false);
    const bundle = clone(proposal); bundle.bundle_template.actions = [];
    assert.equal(occludedCatalogueBefore(bundle, 0, original.packet.frame_rows, meta).admitted, false);
  }
});

test('retained source events are immutable and reconstruct both catalogue layers without hidden state', () => {
  const memory = new OccludedCatalogueMemory();
  for (const envelope of fixture.commonEnvelopes as R[]) for (const event of envelope.ownEvents) memory.applyEvent(clone(event));
  const last = fixture.commonEnvelopes.at(-1).ownState;
  assertState(memory, last);
  const copy = memory.currentState(); copy.catalogue_events.length = 0; copy.catalogue_view_events.length = 0;
  assertState(memory, last);
  const event = clone(fixture.commonEnvelopes[0].ownEvents[0]), isolated = new OccludedCatalogueMemory();
  isolated.applyEvent(event); const prior = isolated.retainedDigest('ancestor'); event.candidate_ids.length = 0;
  assert.equal(isolated.retainedDigest('ancestor'), prior);
  assert.throws(() => isolated.applyEvent({ kind: 'foreign-owner' }), /Outside catalogue layer/);
});
