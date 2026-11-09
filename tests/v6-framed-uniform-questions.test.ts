import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { candidates, digest, transition } from '../src/logos-engine/v6-framed-transfer-observation.ts';
import { measureCurrentUniformReceptionQuestions, UNIFORM_RECEPTION_QUESTION_CONTRACT } from '../src/logos-engine/v6-framed-uniform-questions.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
// Frozen actual returns from the earlier failed campaign. No host is accessed.
const directory = 'docs/migration/native-campaigns-v52/';
const campaign = JSON.parse(read(`${directory}gare-three-levels.json`).toString());
const trace = JSON.parse(gunzipSync(read(`${directory}gare-public-trace.json.gz`)).toString());
const proposal = campaign.prefixes[16].framedTransfer.proposal;
const session = proposal.binding.observation_ref.split(':epoch:')[0];
const first = trace.packets[16].packet, final = trace.packets[17].packet, command = trace.packets[17].command;
const before = await measureNativeObservation(first, 17, session), after = await measureNativeObservation(final, 18, session);
const options = { currentPointWitnessBinding: true, currentPublicPacketReceptions: true, currentUniformReceptionQuestions: true };
const acquired = await FramedTransfer.create(options); acquired.restore(campaign.prefixes[15].framedAcquisition.sourceState);
await acquired.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet);
const checkpoint = acquired.nativeState();

async function currentFamily() {
  const family = await FramedTransfer.create(options); family.restoreNative(checkpoint); return family;
}

test('a current source point tests the missing reception prerequisite without claiming its unknown offset', async () => {
  const family = await currentFamily(), state = family.nativeState(), revision = family.nativeRevision;
  const strict = await FramedTransfer.create({ currentPointWitnessBinding: true, currentPublicPacketReceptions: true }); strict.restoreNative(checkpoint);
  const original = await strict.propose(after, final.frame_rows, [], 100);
  const result = await family.propose(after, final.frame_rows, [], 100);
  assert.ok(original); assert.ok(result);
  assert.deepEqual(original.actions, [{ action_ref: 'ACTION6', data: { x: 9, y: 13 } }]);
  assert.deepEqual(result.actions, [{ action_ref: 'ACTION6', data: { x: 51, y: 43 } }]);
  const plan = result.framed_transfer_plan, coordination = plan.native_uniform_reception_question!;
  assert.equal(coordination.question.kind, 'calibration_dependency');
  assert.equal(coordination.question.tasks.length, 2); assert.equal(coordination.current_reception_offer_count, 0);
  assert.equal(coordination.current_calibration_offer_count, 1); assert.equal(coordination.original_physical_candidate, true);
  assert.deepEqual(coordination.source_choice, original.framed_transfer_plan.choice);
  assert.deepEqual(coordination.source_selected_point, [9, 13]); assert.deepEqual(coordination.selected_point, [51, 43]);
  assert.equal(coordination.control_offset_status, 'unknown_until_actual_return');
  assert.equal(coordination.expected_effect_status, 'unknown'); assert.equal(coordination.release_authority, false);
  assert.equal(coordination.calibration_precedence.rule, 'native.pure_typed_calibration_preserves_revalidated_control');
  assert.equal(coordination.calibration_precedence.selected_basis.relation_support, 'observed_uniform_prerequisite');
  assert.equal(coordination.calibration_precedence.selected_basis.observed_uniform_task_count, 2);
  assert.equal(coordination.calibration_precedence.selected_basis.typed_hypothesis_task_count, 0);
  assert.equal(plan.choice.projection_ref, 'projection.exploration.parallel_solid_band_interface_question');
  assert.notEqual(plan.offer.facts.framed_reception_locus_binding_count, 1);
  assert.equal(plan.offer.facts.candidate_execution_count, 0); assert.equal(result.steps[0]!.expected_after, null);
  const sourceOffers = await candidates(final.frame_rows, after, family.policy, family.spans,
    [...family.receipts, ...family.publicPacketReceptionState().receipts], family.attempts);
  const exact = sourceOffers.filter(offer => offer.candidate_ref === plan.offer.candidate_ref && offer.component_ref === plan.offer.component_ref);
  assert.equal(exact.length, 1); const { native_uniform_reception_question: _native, ...plain } = plan.offer;
  assert.deepEqual(plain, exact[0]);
  for (const task of coordination.question.tasks) {
    assert.equal(task.prototype_status, 'missing_for_required_side_and_current_value');
    assert.equal(task.orientation_preserved, true); assert.equal(task.isometry_applied, false); assert.equal(task.palette_mapping_applied, false);
    assert.equal(task.pending_alignment_is_not_an_action_plan, true); assert.deepEqual(task.prototype_claim_refs, []);
  }
  const sourceGuard = await family.beforeSource(result, 0, final, after), guard = await family.before(result, 0, final, after);
  assert.equal(sourceGuard.admitted, true); assert.equal(guard.admitted, true);
  assert.equal(guard.native_binding_receipt!.rule, 'native.current_uniform_reception_dependency');
  assert.deepEqual(guard.native_binding_receipt!.source_guard, sourceGuard);
  assert.deepEqual(guard.native_binding_receipt!.current_coordination, coordination);
  assert.equal(guard.native_binding_receipt!.expected_effect_status, 'unknown');
  assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), state);
});

test('coordination is mandatory even when the source guard recognizes the physical point', async () => {
  const family = await currentFamily(), result = await family.propose(after, final.frame_rows, [], 100); assert.ok(result);
  for (const alter of [
    (changed: any) => { delete changed.framed_transfer_plan.native_uniform_reception_question; },
    (changed: any) => { changed.framed_transfer_plan.native_uniform_reception_question.question.tasks[0].alignment_delta++; },
    (changed: any) => { changed.framed_transfer_plan.native_uniform_reception_question.source_selected_point[0]++; },
    (changed: any) => { changed.steps[0].point_binding.point[0]++; },
    (changed: any) => { changed.framed_transfer_plan.offer.facts.candidate_execution_count++; },
  ]) {
    const changed = structuredClone(result); alter(changed);
    const guard = await family.before(changed, 0, final, after); assert.equal(guard.admitted, false); assert.ok(guard.native_binding_receipt);
  }
  assert.equal((await family.before(result, 0, final, { ...after, available_action_refs: [] })).admitted, false);
  assert.equal((await family.before(result, 0, final, { ...after, level_epoch: after.level_epoch + 1 })).admitted, false);
});

test('an acquired current-context attempt removes the prerequisite question without changing learned mechanics', async () => {
  const family = await currentFamily(), result = await family.propose(after, final.frame_rows, [], 100); assert.ok(result);
  const state = structuredClone(family.nativeState()) as any;
  state.source_state.attempts[result.framed_transfer_plan.offer.candidate_ref] = {
    evidence: [after.observation_ref, 'unit-test:actual-return'], unchanged: true,
  };
  family.restoreNative(state); const retained = family.nativeState(), revision = family.nativeRevision;
  const next = await family.propose(after, final.frame_rows, [], 100);
  assert.notEqual(next?.framed_transfer_plan.offer.candidate_ref, result.framed_transfer_plan.offer.candidate_ref);
  assert.equal((await family.before(result, 0, final, after)).admitted, false);
  assert.equal(family.nativeState(), retained); assert.equal(family.nativeRevision, revision);
  assert.deepEqual(family.spans, state.source_state.spans);
  assert.deepEqual(family.publicPacketReceptionState().receipts, state.public_packet_receptions.receipts);
});

test('receipt scope, literal gap, direction and current source offer must all remain witnessed', async () => {
  const family = await currentFamily(), receipts = family.publicPacketReceptionState().receipts;
  const offers = await candidates(final.frame_rows, after, family.policy, family.spans, receipts, family.attempts);
  const measure = (currentReceipts: readonly any[], currentOffers = offers, attempts = family.attempts) =>
    measureCurrentUniformReceptionQuestions(final.frame_rows, after, family.policy, family.spans, currentReceipts, attempts, currentOffers);
  const valid = await measure(receipts); assert.equal(valid.complete, true); assert.equal(valid.calibrationOffers.length, 1);
  const stale = structuredClone(receipts), reversed = structuredClone(receipts), gapChanged = structuredClone(receipts);
  for (const record of stale) record.context_epoch--;
  for (const record of reversed) [record.source_frame_bbox, record.marker_frame_bbox] = [record.marker_frame_bbox, record.source_frame_bbox];
  for (const record of gapChanged) for (const patch of record.gap_patches) patch[2][0][0] = (patch[2][0][0] + 1) % 256;
  const candidate = valid.calibrationOffers[0]!;
  const staleOffers = structuredClone(offers);
  for (const offer of staleOffers) if (offer.candidate_ref === candidate.candidate_ref) offer.signature = 'stale-public-support';
  for (const sample of [
    await measure([]), await measure(stale), await measure(reversed), await measure(gapChanged), await measure(receipts, staleOffers),
    await measure(receipts, offers, { [candidate.candidate_ref]: { unchanged: false, evidence: [after.observation_ref, 'unit-test:changed-return'] } }),
  ]) {
    assert.equal(sample.complete, true); assert.deepEqual(sample.receptionOffers, []); assert.deepEqual(sample.calibrationOffers, []);
  }
});

test('a bounded measurement refuses the whole native domain rather than a partial question prefix', async () => {
  const family = await currentFamily(), receipts = family.publicPacketReceptionState().receipts;
  const offers = await candidates(final.frame_rows, after, family.policy, family.spans, receipts, family.attempts);
  const limited = { ...family.policy, route: { ...family.policy.route,
    framed_reception_locus_contract: { ...family.policy.route.framed_reception_locus_contract, maximum_tasks: 1 } } };
  const tasks = await measureCurrentUniformReceptionQuestions(final.frame_rows, after, limited, family.spans, receipts, family.attempts, offers);
  assert.equal(tasks.complete, false); assert.equal(tasks.reason, 'uniform_question_task_bound');
  assert.deepEqual(tasks.receptionOffers, []); assert.deepEqual(tasks.calibrationOffers, []);
  const inventory = await measureCurrentUniformReceptionQuestions(final.frame_rows, after, family.policy, family.spans, receipts, family.attempts,
    Array.from({ length: UNIFORM_RECEPTION_QUESTION_CONTRACT.maximum_existing_offers + 1 }, () => offers[0]!));
  assert.equal(inventory.complete, false); assert.equal(inventory.reason, 'uniform_question_inventory_bound');
  assert.equal(inventory.work_count, 0); assert.deepEqual(inventory.receptionOffers, []); assert.deepEqual(inventory.calibrationOffers, []);
});

// Independent review counterexample: two observed motion spans meet two
// conditional reception tasks at one physical point. Histories are synthetic
// public rasters, not invented offset fields or a game solution.
const collision = JSON.parse(gunzipSync(read('tests/fixtures/v6-framed-uniform-collision.json.gz')).toString());

test('collision fixture spans are derived from the complete synthetic image pairs by the source acquisition policy', async () => {
  const family = await FramedTransfer.create();
  for (const history of collision.histories) {
    const old = { ...collision.obs, observation_ref: `review:synthetic:before:${history.name}`, frame_hash: digest(history.before) };
    const [measurement] = await transition(history.before, collision.rows, old, collision.obs, history.command, family.policy, []);
    assert.equal(measurement.point_motion_span_rows.length, 1);
    const [recorded] = await family.policy.record('policy.record_observed_point_motion_span', measurement.point_motion_span_rows[0]);
    assert.equal(recorded.status, 'derived');
    assert.deepEqual({ ...recorded.record, evidence: [old.observation_ref, collision.obs.observation_ref] },
      collision.spans.find((span: any) => span.evidence[0] === old.observation_ref));
  }
});

test('distinct native reception tasks sharing a physical point are refused across different support descriptions', async () => {
  const family = await FramedTransfer.create(), { rows, obs, spans, receipts } = collision;
  const measure = async (currentReceipts: any[]) => {
    const offers = await candidates(rows, obs, family.policy, spans, currentReceipts, {}), unchanged = structuredClone(offers);
    const result = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, spans, currentReceipts, {}, offers);
    assert.deepEqual(offers, unchanged, 'native cardinality never rewrites source facts'); return result;
  };
  const first = await measure([receipts[0]]), second = await measure([receipts[1]]);
  const atCollision = (offer: any) => offer.point[0] === 31 && offer.point[1] === 31;
  assert.equal(first.receptionOffers.filter(atCollision).length, 1); assert.equal(second.receptionOffers.filter(atCollision).length, 1);
  const a = first.receptionOffers.find(atCollision)!, b = second.receptionOffers.find(atCollision)!;
  assert.notEqual(a.component_ref, b.component_ref); assert.notEqual(a.candidate_ref, b.candidate_ref);
  assert.notEqual(a.facts.framed_reception_locus_axis, b.facts.framed_reception_locus_axis);
  const together = await measure(receipts); assert.equal(together.complete, true);
  assert.deepEqual(together.receptionOffers.map(offer => offer.point), [[31, 32]], 'another unambiguous physical point remains admissible');
  assert.equal(together.receptionOffers[0]!.facts.framed_reception_locus_binding_count, 1);
});

test('a distinct current source reception locus participates in native physical-point cardinality', async () => {
  const family = await FramedTransfer.create(), rows = structuredClone(collision.rows);
  // Replace one uniform receptor by an observed homologous pattern. The
  // unmodified source geometry now generates its own typed reception locus.
  for (let y = 29; y <= 31; y++) for (let x = 19; x <= 21; x++) rows[y][x] = x === 19 || y === 31 ? 5 : 3;
  const obs = { ...collision.obs, observation_ref: 'review:synthetic:typed-current', frame_hash: digest(rows) };
  const receipts = collision.receipts.map((record: any, index: number) => index === 0 ? { ...record, marker_uniform: false } : record);
  const offers = await candidates(rows, obs, family.policy, collision.spans, receipts, {}), unchanged = structuredClone(offers);
  const sourceAtPoint = offers.filter(offer => offer.point[0] === 31 && offer.point[1] === 31 && offer.facts.framed_reception_locus_binding_count === 1);
  assert.equal(sourceAtPoint.length, 1); assert.equal(sourceAtPoint[0]!.facts.framed_reception_locus_same_mask_marker, true);
  const isolated = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, collision.spans, receipts, {}, []);
  assert.deepEqual(isolated.receptionOffers.map(offer => offer.point), [[31, 31]]);
  const complete = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, collision.spans, receipts, {}, offers);
  assert.equal(complete.complete, true); assert.deepEqual(complete.receptionOffers, []); assert.deepEqual(offers, unchanged);
});

test('declared source multiplicity cannot be erased when overwritten source descriptions are unavailable', async () => {
  const family = await FramedTransfer.create(), { rows, obs, spans, receipts } = collision;
  const baseline = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, spans, [receipts[0]], {}, []);
  const entry = baseline.receptionOffers.find(offer => offer.point[0] === 31 && offer.point[1] === 31)!;
  // Model the source map's documented last-description retention contract.
  // Even an identical visible task must not erase its declared extra locus.
  const { native_uniform_reception_question: _witness, ...visibleSourceDescription } = structuredClone(entry);
  const sameTask = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, spans, [receipts[0]], {},
    [visibleSourceDescription, structuredClone(visibleSourceDescription)]);
  assert.deepEqual(sameTask.receptionOffers.map(offer => offer.point), baseline.receptionOffers.map(offer => offer.point),
    'two descriptions of one identified reception task do not create a second task');
  visibleSourceDescription.facts.framed_reception_locus_binding_count = 2;
  const unchanged = structuredClone(visibleSourceDescription);
  const measured = await measureCurrentUniformReceptionQuestions(rows, obs, family.policy, spans, [receipts[0]], {}, [visibleSourceDescription]);
  assert.equal(measured.complete, true); assert.deepEqual(measured.receptionOffers.map(offer => offer.point), [[31, 32]]);
  assert.deepEqual(visibleSourceDescription, unchanged);
});

test('the native before guard rechecks physical reception cardinality and preserves another valid point', async () => {
  const family = await FramedTransfer.create({ currentPointWitnessBinding: true, currentUniformReceptionQuestions: true });
  const { rows, obs, spans, receipts } = collision, packet = { frame_rows: rows, available_actions: [6] };
  family.restore({ epoch: obs.level_epoch, spans, receipts: [receipts[0]], attempts: {}, portable: [], last: null });
  const firstQuestion = await family.propose(obs, rows, [], 10); assert.ok(firstQuestion);
  assert.deepEqual(firstQuestion.actions, [{ action_ref: 'ACTION6', data: { x: 31, y: 31 } }]);
  assert.equal(firstQuestion.framed_transfer_plan.native_uniform_reception_question!.question.kind, 'reception_question');
  assert.equal((await family.before(firstQuestion, 0, packet as any, obs)).admitted, true);
  family.restore({ ...family.state(), receipts });
  const rejected = await family.before(firstQuestion, 0, packet as any, obs); assert.equal(rejected.admitted, false);
  assert.equal(rejected.native_binding_receipt!.coordination_current, false);
  const next = await family.propose(obs, rows, [], 10); assert.ok(next);
  assert.deepEqual(next.actions, [{ action_ref: 'ACTION6', data: { x: 32, y: 31 } }]);
  const guard = await family.before(next, 0, packet as any, obs); assert.equal(guard.admitted, true);
  assert.equal(guard.native_binding_receipt!.expected_effect_status, 'unknown');
});

const typedCheckpoint = JSON.parse(gunzipSync(read('tests/fixtures/v6-framed-typed-prerequisite.json.gz')).toString());

test('the real views after returns 46 and 47 ask only the missing typed-analogy control prerequisite', async () => {
  assert.deepEqual(typedCheckpoint.packet.frame_rows, typedCheckpoint.following_noop.packet.frame_rows,
    'the intervening actual field-service return is a public no-op');
  for (const [offset, sample] of [
    [0, { packet: typedCheckpoint.packet, checkpoint: typedCheckpoint.checkpoint }],
    [1, typedCheckpoint.following_noop],
  ] as const) {
    const observation = await measureNativeObservation(sample.packet, typedCheckpoint.observation_revision + offset, typedCheckpoint.session_ref);
    const family = await FramedTransfer.create(options); family.restoreNative(sample.checkpoint);
    const retained = family.nativeState(), revision = family.nativeRevision;
    const originalReceipts = [...family.receipts, ...family.publicPacketReceptionState().receipts];
    const result = await family.propose(observation, sample.packet.frame_rows, [], 100); assert.ok(result);
    assert.deepEqual(result.actions, [{ action_ref: 'ACTION6', data: { x: 46, y: 33 } }]);
    const plan = result.framed_transfer_plan, coordination = plan.native_uniform_reception_question!;
    assert.equal(coordination.question.kind, 'calibration_dependency');
    assert.equal(coordination.question.basis_kind, 'current_typed_analogy_prerequisite');
    assert.equal(coordination.rule, 'native.current_typed_reception_dependency');
    assert.equal(coordination.current_reception_offer_count, 0);
    assert.equal(coordination.original_physical_candidate, true);
    assert.equal(coordination.control_offset_status, 'unknown_until_actual_return');
    assert.equal(coordination.expected_effect_status, 'unknown'); assert.equal(coordination.release_authority, false);
    assert.equal(coordination.calibration_precedence.incumbent_projection_ref, 'projection.exploration.parallel_solid_band_interface_question');
    assert.equal(coordination.calibration_precedence.incumbent_revalidated_control, false);
    assert.equal(coordination.calibration_precedence.selected_basis.relation_support, 'typed_hypothesis_only');
    assert.equal(coordination.calibration_precedence.selected_basis.observed_uniform_task_count, 0);
    assert.ok(coordination.calibration_precedence.selected_basis.typed_hypothesis_task_count > 0);
    assert.deepEqual(coordination.calibration_precedence.pure_typed_permitted_only_before,
      ['abstain', 'projection.exploration.parallel_solid_band_interface_question']);
    assert.equal(result.question.reason, 'qualify_current_operator_side_for_current_typed_reception_hypothesis');
    assert.equal(plan.choice.projection_ref, 'projection.exploration.parallel_solid_band_interface_question');
    assert.notEqual(plan.offer.facts.framed_reception_locus_binding_count, 1); assert.equal(result.steps[0]!.expected_after, null);
    const sourceOffers = await candidates(sample.packet.frame_rows, observation, family.policy, family.spans, originalReceipts, family.attempts);
    const unchangedSourceOffer = sourceOffers.find(offer => offer.candidate_ref === plan.offer.candidate_ref && offer.component_ref === plan.offer.component_ref);
    const { native_uniform_reception_question: _question, ...sourceFields } = plan.offer;
    assert.deepEqual(sourceFields, unchangedSourceOffer);
    for (const task of coordination.question.tasks) {
      assert.equal(task.basis_kind, 'current_typed_analogy_prerequisite');
      assert.equal(task.source_reception_projection_ref, 'projection.current_observed_entry_analogy');
      assert.equal(task.typed_reception_observed, false); assert.equal(task.pending_alignment_is_not_an_action_plan, true);
      assert.equal(task.required_side, 'upper'); assert.equal(task.alignment_delta, 20);
      assert.equal(task.prototype_status, 'missing_for_required_side_and_current_value'); assert.deepEqual(task.prototype_claim_refs, []);
      assert.equal(task.orientation_preserved, true); assert.equal(task.isometry_applied, false); assert.equal(task.palette_mapping_applied, false);
      for (const hypothesis of task.source_hypotheses) {
        const record = originalReceipts.find(receipt => receipt.source_claim_ref === hypothesis.observed_claim); assert.ok(record);
        assert.equal(record.marker_uniform, true); assert.equal(hypothesis.observed_mask_digest, record.mask_digest);
        assert.equal(hypothesis.current_mask_digest, task.source.mask_digest);
        assert.notEqual(hypothesis.current_mask_digest, hypothesis.observed_mask_digest);
        assert.equal(hypothesis.epistemic_status, 'hypothesis_not_observed_reception');
        assert.ok(result.question.hypothesis_refs.includes(hypothesis.hypothesis_ref));
      }
    }
    const sourceGuard = await family.beforeSource(result, 0, sample.packet, observation);
    const guard = await family.before(result, 0, sample.packet, observation);
    assert.equal(sourceGuard.admitted, true); assert.equal(guard.admitted, true);
    assert.equal(guard.native_binding_receipt!.rule, 'native.current_typed_reception_dependency');
    assert.deepEqual(guard.native_binding_receipt!.source_guard, sourceGuard);
    assert.equal(await family.analogy(observation, sample.packet.frame_rows, [], 100), null,
      'a calibration keeps the original caller entry and does not override early analogy admission');
    assert.equal(family.nativeState(), retained); assert.equal(family.nativeRevision, revision);
    assert.deepEqual([...family.receipts, ...family.publicPacketReceptionState().receipts], originalReceipts);
  }
});

test('the typed prerequisite guard rejects an altered hypothesis, current gap or missing original receipts', async () => {
  const sample = typedCheckpoint, observation = await measureNativeObservation(sample.packet, sample.observation_revision, sample.session_ref);
  const family = await FramedTransfer.create(options); family.restoreNative(sample.checkpoint);
  const result = await family.propose(observation, sample.packet.frame_rows, [], 100); assert.ok(result);
  const modified = structuredClone(result);
  modified.framed_transfer_plan.native_uniform_reception_question!.question.tasks[0].source_hypotheses[0].current_mask_digest = 'unmeasured-mask';
  assert.equal((await family.before(modified, 0, sample.packet, observation)).admitted, false);
  const changedPacket = structuredClone(sample.packet), gap = result.framed_transfer_plan.native_uniform_reception_question!.question.tasks[0].literal_gap[1];
  changedPacket.frame_rows[gap[0]][gap[1]] = (changedPacket.frame_rows[gap[0]][gap[1]] + 1) % 256;
  assert.equal((await family.before(result, 0, changedPacket, observation)).admitted, false);
  const withoutReceipts = structuredClone(family.nativeState()) as any;
  withoutReceipts.source_state.receipts = []; withoutReceipts.public_packet_receptions.receipts = [];
  family.restoreNative(withoutReceipts);
  assert.equal((await family.before(result, 0, sample.packet, observation)).admitted, false);
});

const priorityCheckpoint = JSON.parse(gunzipSync(read('tests/fixtures/v6-framed-typed-priority-after-nine.json.gz')).toString());

test('a real revalidated source control after return 9 precedes a purely typed unknown-offset calibration', async () => {
  const sample = priorityCheckpoint, observation = await measureNativeObservation(sample.packet, sample.observation_revision, sample.session_ref);
  const family = await FramedTransfer.create(options); family.restoreNative(sample.checkpoint);
  const strict = await FramedTransfer.create({ currentPointWitnessBinding: true, currentPublicPacketReceptions: true }); strict.restoreNative(sample.checkpoint);
  const retained = family.nativeState(), revision = family.nativeRevision;
  const receipts = [...family.receipts, ...family.publicPacketReceptionState().receipts];
  const sourceOffers = await candidates(sample.packet.frame_rows, observation, family.policy, family.spans, receipts, family.attempts);
  const available = await measureCurrentUniformReceptionQuestions(sample.packet.frame_rows, observation, family.policy,
    family.spans, receipts, family.attempts, sourceOffers);
  assert.equal(available.complete, true); assert.deepEqual(available.receptionOffers, []);
  assert.equal(available.calibrationOffers.length, 1);
  assert.deepEqual(available.calibrationOffers[0]!.point, [13, 44]);
  assert.equal(available.calibrationOffers[0]!.native_uniform_reception_question.basis_kind, 'current_typed_analogy_prerequisite');
  const result = await family.propose(observation, sample.packet.frame_rows, [], 100);
  const source = await strict.propose(observation, sample.packet.frame_rows, [], 100); assert.ok(result); assert.ok(source);
  assert.deepEqual(result, source, 'the complete original SRC choice and its proof remain unchanged');
  assert.deepEqual(result.actions, [{ action_ref: 'ACTION6', data: { x: 6, y: 23 } }]);
  assert.equal(result.framed_transfer_plan.choice.projection_ref, 'projection.exploration.revalidated_point_motion_span_question');
  assert.equal(result.framed_transfer_plan.offer.facts.point_span_current_support_exact, true);
  assert.equal(result.framed_transfer_plan.offer.facts.point_span_locus_expected_delta, -10);
  const supportRefs = result.framed_transfer_plan.offer.facts.point_span_locus_support_claim_refs;
  assert.equal(supportRefs.length, 1);
  const support = family.spans.find(span => span.source_claim_ref === supportRefs[0]); assert.ok(support);
  assert.equal(support.point_before_side, 'lower'); assert.equal(support.point_to_lower_edge, 4);
  assert.equal((await family.before(result, 0, sample.packet, observation)).admitted, true);
  const rejected = await family.before(sample.old_native_proposal, 0, sample.packet, observation);
  assert.equal(rejected.admitted, false); assert.equal(rejected.native_binding_receipt!.coordination_current, false);
  assert.equal(family.nativeState(), retained); assert.equal(family.nativeRevision, revision);
});
