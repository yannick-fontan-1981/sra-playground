import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { FramedPolicy } from '../src/logos-engine/v6-framed-transfer-policy.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { extract, candidates, pointRegions, temporalComponents, transition, digest, measureParallelSolidBands,
  measureFramedMaskCorrespondences, measureCurrentPointSpanBindings, measurePointSpanLocus,
  measureFramedReceptionLoci, measureRegionalReceptionLoci, measurePointMotionSpans,
  measureFramedReplacements,
} from '../src/logos-engine/v6-framed-transfer-observation.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const compressed = async (path: string): Promise<R> => JSON.parse(gunzipSync(await readFile(new URL(path, root))).toString());
const fixture = await compressed('tests/fixtures/v6-framed-transfer-reference.json.gz');
const probes = await Promise.all(fixture.originalPublicProbes.map((item: R) => compressed(item.path)));
const discovery = await compressed(fixture.initialDiscovery.path);
const policy = await FramedPolicy.create();
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');

/** Independent spelling; not imported from the native implementation. */
function finiteCanonical(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  if (typeof value === 'number') { assert.ok(Number.isSafeInteger(value)); assert.equal(Object.is(value, -0), false); return String(value); }
  if (Array.isArray(value)) return '[' + value.map(finiteCanonical).join(',') + ']';
  assert.equal(typeof value, 'object');
  return '{' + Object.keys(value).sort().map(key => finiteCanonical(key) + ':' + finiteCanonical(value[key])).join(',') + '}';
}
/** Additional native interpreter evidence is checked separately, never used to
 * replace or normalize source identifiers, numbers, facts or workflow fields. */
function sourceProjection(value: any): any {
  if (Array.isArray(value)) return value.map(sourceProjection);
  if (value === null || typeof value !== 'object') return value;
  if (Object.hasOwn(value, 'workflow') && Object.hasOwn(value, 'src_hash') && Object.hasOwn(value, 'executed_statements')) {
    const sourceKeys = ['workflow', 'src_hash', 'src_status', 'executed_statements'];
    const nativeKeys = ['all_executed_statements', 'instruction_quantum', 'instructions', 'trace', 'execution_engine', 'reference_commit', 'reference_semantic_hash',
      'native_execution_hash', 'source_definition_hash', 'edited'];
    assert.ok(sourceKeys.every(key => Object.hasOwn(value, key)));
    if (Object.hasOwn(value, 'execution_engine')) {
      assert.equal(value.execution_engine, 'logos-engine.typescript'); assert.equal(value.reference_commit, fixture.sourceCommit);
      assert.equal(value.instruction_quantum, 128); assert.ok(Number.isSafeInteger(value.instructions) && value.instructions > 0);
      assert.ok(value.trace.length > 0); assert.ok(value.all_executed_statements.length >= value.executed_statements.length);
      assert.match(value.reference_semantic_hash, /^[a-f0-9]{64}$/);
      if (Object.hasOwn(value, 'native_execution_hash')) {
        assert.match(value.native_execution_hash, /^[a-f0-9]{64}$/); assert.equal(value.source_definition_hash, value.src_hash); assert.equal(value.edited, false);
      }
    }
    // Unknown source fields remain significant. Only the ten enumerated native
    // interpreter annotations are outside the unchanged source receipt.
    return Object.fromEntries(Object.entries(value).filter(([key]) => !nativeKeys.includes(key)).map(([key, child]) => [key, sourceProjection(child)]));
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sourceProjection(child)]));
}
const exact = (actual: unknown, expected: unknown, message?: string): void => assert.equal(finiteCanonical(sourceProjection(actual)), finiteCanonical(expected), message);
const box = (value: R): R => ({ top: value.top, left: value.left, bottom: value.bottom, right: value.right });
const entities = (scene: R): R[] => scene.entities.map((e: R) => ({ entity_id: e.entity_id, component_id: e.component.component_id }));
async function extracted(rows: any, ref: string): Promise<R> {
  const [frame, components, scene] = await extract(rows, ref);
  return { rows: frame.rows, components: components.map(c => ({ component_id: c.component_id, value: c.value, area: c.area,
    bbox: box(c.bbox), relative_pixels: c.relative_pixels, pixels: c.pixels })), entities: entities(scene), frame_ref: scene.frame_ref };
}
async function temporal(a: R): Promise<R> {
  const [before, after, old, current, translations, correspondence] = await temporalComponents(a.first, a.second, a.before, a.after, a.records);
  return { beforeRows: before.rows, afterRows: after.rows, beforeEntities: entities(old), afterEntities: entities(current), translations, correspondence };
}
async function scene(a: R): Promise<R> {
  const [frame, components] = await extract(a.rows, a.obs.observation_ref);
  const bands = measureParallelSolidBands(components, policy.route.parallel_band_measurement_contract);
  const bindings = measureCurrentPointSpanBindings(frame, a.spans, a.obs.level_epoch, policy.route.point_motion_span_recall_contract);
  const regions = pointRegions(frame, components, bands);
  const common = { frame, components, records: a.receipts, span_records: a.spans, context_epoch: a.obs.level_epoch,
    span_contract: policy.route.point_motion_span_recall_contract, contract: policy.route.framed_reception_locus_contract };
  return { bands, regions, bindings, masks: measureFramedMaskCorrespondences(frame, components, policy.mask),
    loci: measureFramedReceptionLoci({ ...common, mask_contract: policy.route.framed_reception_mask_contract, band_facts: bands }),
    regional: measureRegionalReceptionLoci({ ...common, mask_contract: policy.mask, operator_regions: regions }),
    candidates: await candidates(a.rows, a.obs, policy, a.spans, a.receipts, a.attempts) };
}
async function result(item: R, callback: () => any): Promise<void> {
  if (item.error) {
    await assert.rejects(async () => callback(), (error: any) => {
      assert.equal(error.message, item.error.message, item.id); return true;
    });
  } else exact((await callback()) ?? null, item.value, item.id);
}

test('framed provenance preserves two cold source failures and verifies every pinned source file', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.framed-transfer-reference.v1');
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.equal(fixture.qualification.nativeResultsUsedAsExpectations, false);
  assert.match(fixture.qualification.identityTracing, /replaces no source function/);
  assert.match(fixture.qualification.numerics, /No general Python float identity equivalence/);
  assert.match(fixture.qualification.scope, /not full original caller or Kernel parity/);
  assert.equal(probes.length, 2);
  exact(probes.map(p => [p.game, p.status, p.reason, p.actions, p.levelsCompleted]), [
    ['GARE', 'stopped', 'before_guard_refused', 12, 1], ['LKEY', 'stopped', 'framed_transfer_component_abstained', 2, 0],
  ]);
  for (const p of probes) {
    assert.equal(p.fullOriginalCaller, false); assert.equal(p.frontierEnabled, false);
    exact(p.providerOrder, ['FramedTransfer.propose']); assert.equal(p.sessionCount, 1);
    assert.equal(p.manualPrimingActions, 0); assert.equal(p.resets, 0); assert.equal(p.levelJumps, 0);
    assert.equal(p.state, 'NOT_FINISHED'); exact(p.requests[0], { type: 'load', code: p.game, level: 1 });
    assert.ok(p.requests.slice(1).every((request: R) => request.type === 'action'));
    assert.equal(p.packets.length, p.actions + 1); assert.equal(p.requests.length, p.actions + 1);
    assert.equal(p.pinnedSourceFilesVerifiedBeforeImport, 1786); assert.equal(p.pinnedSourceFilesVerifiedAfterCampaign, 1786);
    for (const [path, value] of Object.entries(p.gameAssetHashes)) assert.equal(hash(await readFile(new URL('public/python/' + path, root))), value);
  }
  exact(probes[0].boundaries, [{ actions: 7, levelActions: 7, levelsCompleted: 1 }]);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 1786);
  for (const [path, entry] of Object.entries(manifest.files) as [string, R][]) {
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), entry.sha256, path);
  }
  for (const item of [fixture, ...probes]) {
    assert.equal(item.pinnedSourceFilesVerifiedBeforeImport, 1786);
    assert.equal(Object.keys(item.sourceHashes).filter(path => path.endsWith('.py')).length, item.importedSourceModuleCount);
    for (const [path, value] of Object.entries(item.sourceHashes)) assert.equal(manifest.files[path].sha256, value, path);
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(fixture.pinnedSourceFilesVerifiedAfterRun, 1786);
  assert.equal(fixture.explicitLocalPolicyFileCount, 2);
  for (const [path, value] of Object.entries(fixture.policySourceHashes)) assert.equal(manifest.files[path].sha256, value, path);
  for (const item of [...fixture.originalPublicProbes, fixture.initialDiscovery]) assert.equal(hash(await readFile(new URL(item.path, root))), item.sha256);
});

test('framed policy declarations, called V5 route contracts, meaning templates and local hashes match the source', () => {
  for (const key of ['config', 'mask', 'projections', 'policies', 'rules']) assert.deepEqual((policy as any)[key], fixture.policy[key], key);
  // The source route declaration also owns unrelated, uncalled capabilities.
  // This component transfers exactly its four actual measurement contracts.
  const calledRouteContracts = ['framed_reception_locus_contract', 'framed_reception_mask_contract', 'parallel_band_measurement_contract', 'point_motion_span_recall_contract'];
  exact(Object.keys(policy.route).sort(), calledRouteContracts);
  for (const key of calledRouteContracts) assert.deepEqual(policy.route[key], fixture.policy.route[key], key);
  assert.equal(policy.loaded.source_hash, fixture.policy.drmHash);
});

test('framed choose and record install sequentially into the actual shared knowledge store and run from its two program nodes', async () => {
  const family = await FramedTransfer.create(), store = new NativeKnowledgeStore('test-framed-independent-reference', 'test-framed-reference');
  await family.attachPrograms(store);
  const programs = Object.values(store.memory.nodes).filter(node => node.kind === 'program');
  exact(programs.map(node => node.id).sort(), ['program:v6.framed_transfer.choose', 'program:v6.framed_transfer.record']);
  assert.equal(store.revision, 2);
  const choose = fixture.policyCases.find((item: R) => item.operation === 'choose' && item.value?.[0].status === 'selected');
  const record = fixture.policyCases.find((item: R) => item.operation === 'record' && item.value?.[0].status === 'derived');
  assert.ok(choose && record);
  const chosen = await family.policy.choose(choose.arguments.rows), derived = await family.policy.record(record.arguments.policy, record.arguments.facts);
  exact(chosen, choose.value); exact(derived, record.value);
  for (const receipt of [chosen[1], derived[1]] as R[]) { assert.match(receipt.native_execution_hash, /^[a-f0-9]{64}$/); assert.equal(receipt.edited, false); }
});

test('all observed geometry and V5 identity operands have exact qualified integer JSON bytes and hashes', () => {
  assert.ok(fixture.identityRecipes.length > 0);
  const functions = new Set<string>();
  for (const recipe of fixture.identityRecipes as R[]) {
    assert.ok(recipe.callers.length > 0); recipe.functions.forEach((name: string) => functions.add(name));
    assert.equal(finiteCanonical(recipe.value), recipe.sourceCanonical);
    assert.equal(recipe.sourceCanonical, recipe.nativeCanonical);
    assert.equal(hash(recipe.sourceCanonical), recipe.sourceHash);
    assert.equal(hash(recipe.nativeCanonical), recipe.nativeHash);
    assert.equal(recipe.sourceHash, recipe.nativeHash);
    assert.equal(digest(recipe.value), recipe.sourceHash);
  }
  exact([...functions].sort(), ['geometry.digest', 'v5.stable_digest']);
});

test('100 unchanged public initial scenes preserve every offer and the actual SRC choice receipt', async () => {
  assert.equal(fixture.initialMeasurements.length, 100); assert.equal(discovery.games.length, 100);
  for (const item of fixture.initialMeasurements as R[]) {
    const original = discovery.games.find((game: R) => game.game === item.game);
    const offers = await candidates(original.packet.frame_rows, original.observation, policy, [], [], {});
    exact(offers, item.candidates, item.game); exact(await policy.choose(offers), item.choice, item.game);
  }
  exact(fixture.initialMeasurements.filter((item: R) => item.choice[0].status === 'selected').map((item: R) => item.game), ['HANO', 'GARE', 'LKEY']);
});

for (const item of fixture.cases as R[]) test('original framed geometry ' + item.id, async () => {
  const a = clone(item.arguments);
  await result(item, async () => {
    switch (item.operation) {
      case 'extract': return extracted(a.rows, a.ref);
      case 'scene': return scene(a);
      case 'temporal': return temporal(a);
      case 'bands': return measureParallelSolidBands((await extract(a.rows, 'test:bands'))[1], a.contract);
      case 'masks': { const [frame, components] = await extract(a.rows, 'test:masks'); return measureFramedMaskCorrespondences(frame, components, a.contract); }
      case 'bindings': return measureCurrentPointSpanBindings((await extract(a.rows, 'test:bindings'))[0], a.records, a.epoch, a.contract);
      case 'spanBound': {
        const [beforeFrame, afterFrame, before, after, translations] = await temporalComponents(a.first, a.second, a.before, a.after, a.records);
        return measurePointMotionSpans({ before, after, before_frame: beforeFrame, after_frame: afterFrame, translations,
          point: [a.command.data.y, a.command.data.x], action_ref: a.command.action_ref, transition_ref: 'controlled:transition',
          candidate_ref: 'controlled:candidate', context_epoch: a.before.level_epoch, contract: a.contract });
      }
      case 'replacementBound': {
        const [first, second, before, after, translations] = await temporalComponents(a.first, a.second, a.before, a.after, a.records);
        const span = measurePointMotionSpans({ before, after, before_frame: first, after_frame: second, translations,
          point: [a.command.data.y, a.command.data.x], action_ref: a.command.action_ref, transition_ref: 'controlled:replacement',
          candidate_ref: 'controlled:candidate', context_epoch: a.before.level_epoch,
          contract: policy.policies['policy.record_observed_point_motion_span'].configuration.measurement_contract });
        const masksBefore = measureFramedMaskCorrespondences(first, before.entities, policy.mask), masksAfter = measureFramedMaskCorrespondences(second, after.entities, policy.mask);
        return measureFramedReplacements({ pairs: masksBefore.framed_mask_pairs ?? [], before, after, after_frame: second,
          complete: a.complete_override ?? (masksBefore.framed_mask_domain_complete && masksAfter.framed_mask_domain_complete),
          action_ref: a.command.action_ref, transition_ref: 'controlled:replacement', context_epoch: a.before.level_epoch, contract: a.contract,
          before_occurrences: masksBefore.framed_mask_occurrences ?? [], after_occurrences: masksAfter.framed_mask_occurrences ?? [],
          motion_spans: span.point_motion_span_rows, prior_authority: a.prior_authority });
      }
      case 'locusBound': {
        const [frame, components] = await extract(a.rows, a.obs.observation_ref), bands = measureParallelSolidBands(components, policy.route.parallel_band_measurement_contract);
        const common = { frame, components, records: a.receipts, span_records: a.spans, context_epoch: a.context_epoch,
          mask_contract: a.mask_contract, span_contract: a.span_contract, contract: a.contract };
        return a.regional ? measureRegionalReceptionLoci({ ...common, operator_regions: pointRegions(frame, components, bands), require_operator_value_match: a.require_operator_value_match })
          : measureFramedReceptionLoci({ ...common, band_facts: bands });
      }
      default: throw new Error('Unimplemented source geometry contract: ' + item.operation);
    }
  });
});

for (const item of fixture.policyCases as R[]) test('original framed policy ' + item.id, async () => {
  const a = clone(item.arguments);
  await result(item, () => {
    switch (item.operation) {
      case 'choose': return policy.choose(a.rows);
      case 'record': return policy.record(a.policy, a.facts);
      case 'projected': return policy.projected(a.projection, a.facts);
      default: throw new Error('Unimplemented source policy contract: ' + item.operation);
    }
  });
});

for (const replayed of fixture.replays as R[]) test(`original ${replayed.game} public returns preserve complete offers, temporal correspondences, motion spans, replacement claims and refusals`, async () => {
  const probe = probes.find(item => item.game === replayed.game)!;
  for (const item of replayed.measurements as R[]) {
    const first = probe.packets[item.actionIndex];
    exact(await scene({ rows: first.packet.frame_rows, obs: first.observation, ...item.state }), item.value, `scene ${item.actionIndex}`);
  }
  for (const item of replayed.transitions as R[]) {
    const a = probe.packets[item.actionIndex - 1], b = probe.packets[item.actionIndex];
    const args = { first: a.packet.frame_rows, second: b.packet.frame_rows, before: a.observation, after: b.observation, records: item.records };
    exact(await temporal(args), item.temporal, `temporal ${item.actionIndex}`);
    exact(await transition(args.first, args.second, args.before, args.after, b.command, policy, item.records), item.value, `transition ${item.actionIndex}`);
  }
});

for (const replayed of fixture.replays as R[]) test(`original ${replayed.game} component replay preserves every envelope, SRC workflow, guard, acquired record and six-field memory`, async () => {
  const probe = probes.find(item => item.game === replayed.game)!, family = await FramedTransfer.create(); let cursor = 0, boundary = 0;
  for (const envelope of replayed.envelopes as R[]) {
    const a = probe.packets[cursor]; exact(family.state(), envelope.beforeState, `before ${cursor}`);
    const analogyFamily = await FramedTransfer.create(); analogyFamily.restore(clone(envelope.beforeState));
    exact(await analogyFamily.analogy(a.observation, a.packet.frame_rows, [], probe.budget.levelActions - (cursor - boundary)), envelope.analogy);
    const proposal = await family.propose(a.observation, a.packet.frame_rows, [], probe.budget.levelActions - (cursor - boundary));
    assert.ok(proposal); exact(proposal, envelope.proposal, `proposal ${cursor}`); exact(family.state(), envelope.afterPlanningState);
    family.bind(proposal, null); exact(proposal, envelope.proposal);
    if (envelope.refusedGuard) {
      exact(await family.before(proposal, 0, a.packet, a.observation), envelope.refusedGuard);
      assert.equal(envelope.refusedGuard.admitted, false); assert.equal(envelope.refusedMatchingCandidates.length, 2);
      const offers = envelope.refusedMatchingCandidates;
      assert.equal(offers[0].candidate_ref, offers[1].candidate_ref); exact(offers[0].patches, offers[1].patches); exact(offers[0].point, offers[1].point);
      assert.notEqual(offers[0].component_ref, offers[1].component_ref);
      continue;
    }
    for (const step of envelope.steps as R[]) {
      const b = probe.packets[cursor + 1], command = proposal.actions[step.index]; exact(command, b.command);
      exact(await family.before(proposal, step.index, a.packet, a.observation), step.beforeGuard);
      exact(family.after(proposal, step.index, a.observation, b.observation, a.packet.frame_rows, b.packet.frame_rows), step.outcome);
      exact(await family.recordSource(a.observation, b.observation, command, a.packet.frame_rows, b.packet.frame_rows, proposal, step.index), step.acquired);
      exact(family.state(), step.afterState); cursor++;
      if (b.observation.levels_completed > a.observation.levels_completed) boundary = cursor;
    }
  }
  assert.equal(cursor, probe.actions);
  const final = probe.packets[cursor];
  exact(await family.propose(final.observation, final.packet.frame_rows, [], probe.budget.levelActions - (cursor - boundary)), replayed.terminalProposal);
  exact(family.state(), replayed.finalState);
});

for (const item of fixture.memoryCases as R[]) test('original framed state and guard ' + item.id, async () => {
  const a = clone(item.arguments), family = await FramedTransfer.create(); family.restore(clone(item.seed)); exact(family.state(), item.beforeState);
  await result(item, async () => {
    switch (item.operation) {
      case 'propose': return family.propose(a.obs, a.rows, a.inputs, a.remaining);
      case 'analogy': return family.analogy(a.obs, a.rows, a.inputs, a.remaining);
      case 'scope': return family.scope(a.obs);
      case 'restore': return family.restore(a.state);
      case 'before': return family.before(a.proposal, a.index, { frame_rows: a.rows } as any, a.obs);
      case 'bind': return family.bind(a.proposal, null);
      case 'record': return family.recordSource(a.before, a.after, a.command, a.first, a.second, a.proposal, a.index);
      case 'after': return family.after(a.proposal, a.index, a.before, a.after, a.first, a.second);
      default: throw new Error('Unimplemented source memory contract: ' + item.operation);
    }
  });
  exact(family.state(), item.afterState, item.id);
});

test('framed snapshots are detached, native checkpoints immutable and invalid restoration atomic', async () => {
  const family = await FramedTransfer.create(), source = probes[0].prefixes[5].beforeState;
  family.restore(clone(source)); const state = family.state() as R;
  state.spans.length = 0; state.epoch = 500; exact(family.state(), source);
  const checkpoint = family.nativeState(), before = family.state();
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.source_state));
  const restored = await FramedTransfer.create(); restored.restoreNative(checkpoint); exact(restored.state(), before);
  assert.throws(() => restored.restore({ spans: 'bad' } as any)); exact(restored.state(), before);
  assert.throws(() => restored.restoreNative({ format: 'unknown', source_state: before })); exact(restored.state(), before);
  const publicReturn = probes[0].packets[7]; restored.scope(publicReturn.observation);
  const portable = restored.state() as R; assert.equal(portable.spans.length, 0); assert.equal(portable.receipts.length, 0);
  assert.equal(portable.portable.at(-1).authority, 'historical_not_current_permit');
});

test('separate native point binding resolves the retained two-description collision without changing the strict source guard or memory', async () => {
  const probe = probes[0], final = probe.packets.at(-1), envelope = fixture.replays[0].envelopes.at(-1);
  const family = await FramedTransfer.create({ currentPointWitnessBinding: true }); family.restore(clone(envelope.afterPlanningState));
  const proposal = clone(envelope.proposal), before = family.state(), revision = family.nativeRevision;
  exact(await family.beforeSource(proposal, 0, final.packet, final.observation), envelope.refusedGuard);
  const guard = await family.before(proposal, 0, final.packet, final.observation);
  assert.equal(guard.admitted, true); assert.equal(guard.reason, 'native_current_framed_point_witness_bound');
  const receipt = guard.native_binding_receipt!;
  exact(receipt.source_guard, envelope.refusedGuard); assert.equal(receipt.current_description_count, 2);
  assert.equal(receipt.selected_current_bindings, 1); assert.equal(receipt.same_physical_point, true); assert.equal(receipt.point_binding_current, true);
  assert.equal(receipt.selected_component_ref, proposal.framed_transfer_plan.offer.component_ref);
  assert.equal(receipt.release_authority, false); assert.equal(receipt.expected_effect_status, 'unknown');
  exact(receipt.physical_command, proposal.actions[0]); exact(family.state(), before); assert.equal(family.nativeRevision, revision);
  const defaultFamily = await FramedTransfer.create(); defaultFamily.restore(clone(envelope.afterPlanningState));
  exact(await defaultFamily.before(proposal, 0, final.packet, final.observation), envelope.refusedGuard);
});

test('separate native point binding rejects stale scope, absent witnesses, payload changes and every mismatched point-binding field', async () => {
  const probe = probes[0], final = probe.packets.at(-1), envelope = fixture.replays[0].envelopes.at(-1);
  const family = await FramedTransfer.create({ currentPointWitnessBinding: true }); family.restore(clone(envelope.afterPlanningState));
  const before = family.state(), revision = family.nativeRevision;
  const mutations: [string, (proposal: R, observation: R, packet: R) => void][] = [
    ['observation', (_p, obs) => { obs.observation_ref += ':stale'; }],
    ['epoch', (_p, obs) => { obs.level_epoch++; }], ['frame hash', (_p, obs) => { obs.frame_hash = 'stale'; }],
    ['unavailable action', (_p, obs) => { obs.available_action_refs = []; }],
    ['changed public raster', (_p, _obs, packet) => { packet.frame_rows = packet.frame_rows.map((row: number[]) => row.map(() => 0)); }],
    ['payload', p => { p.actions[0].data.x++; p.steps[0].action = clone(p.actions[0]); }],
    ['missing selected witness', p => { p.framed_transfer_plan.offer.component_ref = 'controlled:absent'; }],
    ['different physical signature', p => { p.framed_transfer_plan.offer.signature = 'controlled:different'; }],
    ['different physical bounds', p => { p.framed_transfer_plan.offer.bbox[0]++; }],
    ['different physical palette', p => { p.framed_transfer_plan.offer.point_value++; }],
    ['different physical point', p => { p.framed_transfer_plan.offer.point[0]++; }],
    ['binding entity', p => { p.steps[0].point_binding.entity_ref = 'controlled:absent'; }],
    ['binding signature', p => { p.steps[0].point_binding.signature = 'controlled:different'; }],
    ['binding bounds', p => { p.steps[0].point_binding.bbox[0]++; }],
    ['binding point', p => { p.steps[0].point_binding.point[0]++; }],
    ['binding palette', p => { p.steps[0].point_binding.palette_value++; }],
    ['binding observation', p => { p.steps[0].point_binding.observation_ref += ':stale'; }],
    ['binding epoch', p => { p.steps[0].point_binding.level_epoch++; }],
    ['binding frame hash', p => { p.steps[0].point_binding.frame_hash = 'stale'; }],
  ];
  for (const [name, mutate] of mutations) {
    // JSON materialization avoids artificial aliasing between selected offer
    // bounds and point-binding bounds retained by Python's original object.
    const proposal = JSON.parse(JSON.stringify(envelope.proposal)), observation = clone(final.observation), packet = clone(final.packet);
    mutate(proposal, observation, packet);
    assert.equal((await family.before(proposal, 0, packet, observation)).admitted, false, name);
    exact(family.state(), before, name); assert.equal(family.nativeRevision, revision, name);
  }
  assert.equal((await family.before(clone(envelope.proposal), 1, final.packet, final.observation)).admitted, false);
  exact(family.state(), before); assert.equal(family.nativeRevision, revision);
});
