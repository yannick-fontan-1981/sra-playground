import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { candidates, extract, measureCurrentPointSpanBindings, measurePointSpanLocus } from '../src/logos-engine/v6-framed-transfer-observation.ts';
import { measureCurrentUniformReceptionQuestions } from '../src/logos-engine/v6-framed-uniform-questions.ts';
import { measureCurrentDirectedReceiverQuestions, DIRECTED_RECEIVER_COMPOSITION_CONTRACT } from '../src/logos-engine/v6-framed-directed-composition.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));
const fixture = JSON.parse(gunzipSync(read('fixtures/v6-framed-directed-composition-public.json.gz')).toString());
const options = { currentPointWitnessBinding: true, currentPublicPacketReceptions: true, currentUniformReceptionQuestions: true,
  currentSettledSupportReceptions: true, currentDirectedReceptionComposition: true };
const classicOptions = { currentPointWitnessBinding: true, currentPublicPacketReceptions: true, currentUniformReceptionQuestions: true };
const actual = fixture.acquisition17;
const before = await measureNativeObservation(actual.before_packet, 17, fixture.session_ref);
const after = await measureNativeObservation(actual.after_packet, 18, fixture.session_ref);
const acquisition = await FramedTransfer.create(options); acquisition.restoreNative(actual.checkpoint_before);
const acquired = await acquisition.recordPublicTransition(before, after, actual.command, actual.before_packet.frame_rows,
  actual.after_packet.frame_rows, actual.proposal, 0, actual.after_packet.frame_packet);
const phased = acquisition.publicPacketReceptionState().receipts.filter(record => record.native_directed_composition_only === true);

async function current(index: number, profile = options, includePhased = true) {
  const sample = fixture.checkpoints.find((row: any) => row.return_index === index); assert.ok(sample);
  const checkpoint = structuredClone(sample.checkpoint);
  if (includePhased && index >= 17) checkpoint.public_packet_receptions.receipts.push(...phased);
  const family = await FramedTransfer.create(profile); family.restoreNative(checkpoint);
  const observation = await measureNativeObservation(sample.packet, index + 1, fixture.session_ref);
  return { family, observation, packet: sample.packet };
}

test('actual phased reception is acquired separately and never feeds directionless source candidates', async () => {
  assert.equal(phased.length, 1); const receipt = phased[0]!;
  assert.deepEqual(receipt.delta, [-10, 0]); assert.deepEqual(receipt.source_frame_bbox, [41, 32, 45, 36]);
  assert.deepEqual(receipt.marker_frame_bbox, [31, 32, 35, 36]);
  assert.equal(receipt.native_packet_witness.schema, 'native.framed_public_phased_reception.v1');
  assert.equal(receipt.native_packet_witness.native_directed_composition_only, true);
  assert.equal(receipt.native_packet_witness.causal_action_efficacy_established, false);
  assert.equal(receipt.native_packet_witness.intermediate_command_count, 0);
  assert.deepEqual(receipt.evidence, [before.observation_ref, after.observation_ref]);
  const old = await FramedTransfer.create(classicOptions); old.restoreNative(actual.checkpoint_before);
  const result = await old.recordPublicTransition(before, after, actual.command, actual.before_packet.frame_rows,
    actual.after_packet.frame_rows, actual.proposal, 0, actual.after_packet.frame_packet);
  assert.deepEqual(acquired!.source_result, result!.source_result); assert.deepEqual(acquisition.state(), old.state());
  assert.deepEqual(acquisition.publicPacketReceptionState().receipts.filter(row => row.native_directed_composition_only !== true), old.publicPacketReceptionState().receipts);
  const withPhased = await current(51, { ...options, currentDirectedReceptionComposition: false });
  const withoutPhased = await current(51, { ...options, currentDirectedReceptionComposition: false }, false);
  assert.deepEqual(await withPhased.family.propose(withPhased.observation, withPhased.packet.frame_rows, [], 100),
    await withoutPhased.family.propose(withoutPhased.observation, withoutPhased.packet.frame_rows, [], 100));
});

test('directed-only annotations are mandatory on restoration and survive historical archiving', async () => {
  const { family } = await current(51), checkpoint = family.nativeState(), revision = family.nativeRevision;
  for (const alter of [
    (record: any) => { delete record.native_directed_composition_only; },
    (record: any) => { delete record.native_packet_witness.native_directed_composition_only; },
    (record: any) => { record.native_directed_composition_only = false; },
  ]) {
    const changed = structuredClone(checkpoint) as any;
    alter(changed.public_packet_receptions.receipts.find((row: any) => row.native_directed_composition_only));
    assert.throws(() => family.restoreNative(changed), TypeError); assert.equal(family.nativeState(), checkpoint); assert.equal(family.nativeRevision, revision);
  }
  family.scope({ level_epoch: 4 }); const memory = family.publicPacketReceptionState();
  assert.deepEqual(memory.receipts, []);
  const archived = memory.portable.find(row => row.source_epoch === 3); assert.ok(archived);
  assert.equal(archived.authority, 'historical_not_current_permit');
  assert.equal(archived.receipts.filter((row: any) => row.native_directed_composition_only).length, 1);
});

test('existing real priorities after returns 9 and 17 remain unchanged', async () => {
  for (const [index, point] of [[9, { x: 6, y: 23 }], [17, { x: 51, y: 43 }]] as const) {
    const { family, observation, packet } = await current(index), result = await family.propose(observation, packet.frame_rows, [], 100); assert.ok(result);
    assert.deepEqual(result.actions, [{ action_ref: 'ACTION6', data: point }]);
    assert.equal(result.framed_transfer_plan.native_directed_receiver_composition, undefined);
    assert.equal((await family.before(result, 0, packet, observation)).admitted, true);
  }
});

test('real views 49 and 51 yield one revalidated receiver preparation with a literal directed anchor', async () => {
  for (const [index, point, delta, offset] of [[49, { x: 14, y: 33 }, -10, 2], [51, { x: 41, y: 33 }, 5, 0]] as const) {
    const { family, observation, packet } = await current(index), retained = family.nativeState(), revision = family.nativeRevision;
    const result = await family.propose(observation, packet.frame_rows, [], 100); assert.ok(result);
    assert.deepEqual(result.actions, [{ action_ref: 'ACTION6', data: point }]); assert.equal(result.actions.length, 1);
    assert.equal(result.steps[0]!.expected_after, null);
    const plan = result.framed_transfer_plan, coordination = plan.native_directed_receiver_composition!, question = coordination.question;
    assert.equal(question.kind, 'prepare_uniform_receiver'); assert.equal(question.physical_task_count, 1);
    assert.equal(question.requested_translation, delta); assert.equal(question.selected_offset_hypothesis.offset, offset);
    assert.deepEqual(question.observed_source_to_receiver_vector, [-10, 0]); assert.deepEqual(question.receiver_anchor, [31, 32, 35, 36]);
    assert.equal(question.source_locus_revalidated, true);
    assert.equal(coordination.selected_strength, 'original_source_point_locus_revalidated');
    assert.equal(plan.choice.projection_ref, 'projection.exploration.revalidated_point_motion_span_question');
    assert.equal(plan.offer.facts.framed_reception_locus_binding_count, undefined, 'preparation never fabricates a reception locus');
    assert.equal(plan.offer.facts.point_span_locus_expected_delta, delta);
    assert.equal(question.pending_reception_geometry.no_following_command_committed, true);
    assert.equal(question.reception_observed, false); assert.equal(question.control_effect_established, false);
    assert.equal(question.expected_effect_status, 'unknown'); assert.equal(question.release_authority, false);
    for (const prediction of question.all_compatible_offset_predictions) {
      assert.equal(prediction.within_public_bounds, true); assert.equal(prediction.independent_of_other_support, true);
      assert.ok(prediction.claim_refs.length > 0); assert.ok(prediction.projected_frames.length > 1);
    }
    for (const span of [question.co_carried_span, question.receiver_span, question.moving_span]) {
      assert.equal(span.derivation, undefined); assert.ok(span.source_claim_ref); assert.equal(span.context_epoch, observation.level_epoch);
    }
    const [frame] = await extract(packet.frame_rows, observation.observation_ref);
    const [bindings, complete] = measureCurrentPointSpanBindings(frame, family.spans, observation.level_epoch, family.policy.route.point_motion_span_recall_contract);
    assert.deepEqual(question.source_point_span_measurement, measurePointSpanLocus(frame, plan.offer.point as [number, number], bindings, complete));
    const guard = await family.before(result, 0, packet, observation); assert.equal(guard.admitted, true);
    assert.equal(guard.native_binding_receipt!.rule, 'native.current_directed_receiver_composition');
    assert.equal(guard.native_binding_receipt!.source_guard.admitted, false, 'this new point is not misrepresented as an original source offer');
    assert.deepEqual((await family.analogy(observation, packet.frame_rows, [], 100))!.actions, result.actions);
    assert.equal(family.nativeState(), retained); assert.equal(family.nativeRevision, revision);
  }
});

test('the current composition guard rejects altered supports, anchor, offsets, effects and directed premises', async () => {
  const { family, observation, packet } = await current(51), proposal = await family.propose(observation, packet.frame_rows, [], 100); assert.ok(proposal);
  for (const alter of [
    (row: any) => { delete row.framed_transfer_plan.native_directed_receiver_composition; },
    (row: any) => { row.framed_transfer_plan.native_directed_receiver_composition.question.receiver_anchor[1]++; },
    (row: any) => { row.framed_transfer_plan.native_directed_receiver_composition.question.ghost.frame_bbox[1]++; },
    (row: any) => { row.framed_transfer_plan.native_directed_receiver_composition.question.observed_source_to_receiver_vector[0] *= -1; },
    (row: any) => { row.framed_transfer_plan.native_directed_receiver_composition.question.selected_offset_hypothesis.offset++; },
    (row: any) => { row.framed_transfer_plan.native_directed_receiver_composition.question.all_compatible_offset_predictions = []; },
    (row: any) => { row.steps[0].point_binding.point[0]++; },
    (row: any) => { row.steps[0].expected_after = { reception: 'guaranteed' }; },
  ]) {
    const changed = structuredClone(proposal); alter(changed); assert.equal((await family.before(changed, 0, packet, observation)).admitted, false);
  }
  const changedPacket = structuredClone(packet), box = proposal.framed_transfer_plan.native_directed_receiver_composition!.question.literal_gap[1];
  changedPacket.frame_rows[box[0]][box[1]] = (changedPacket.frame_rows[box[0]][box[1]] + 1) % 256;
  assert.equal((await family.before(proposal, 0, changedPacket, observation)).admitted, false);
  assert.equal((await family.before(proposal, 0, packet, { ...observation, available_action_refs: [] })).admitted, false);
  const without = structuredClone(family.nativeState()) as any;
  without.public_packet_receptions.receipts = without.public_packet_receptions.receipts.filter((row: any) => row.native_directed_composition_only !== true);
  family.restoreNative(without); assert.equal((await family.before(proposal, 0, packet, observation)).admitted, false);
});

test('offset hypotheses in the real source support remain conflicting under the complete source measurement', async () => {
  const { family, observation, packet } = await current(51), [frame] = await extract(packet.frame_rows, observation.observation_ref);
  const [bindings, complete] = measureCurrentPointSpanBindings(frame, family.spans, observation.level_epoch, family.policy.route.point_motion_span_recall_contract);
  const carrier = bindings.find(([span]) => span.orthogonal_interval[0] === 41 && span.orthogonal_interval[1] === 45)!;
  const samples = carrier[1].filter(sample => sample.point_before_side === 'upper' && sample.operator_value === packet.frame_rows[43][49]);
  assert.deepEqual([...new Set(samples.map(sample => sample.point_to_upper_edge))].sort(), [0, 2]);
  for (const x of [49, 51]) {
    const measured = measurePointSpanLocus(frame, [43, x], bindings, complete);
    assert.equal(measured.point_span_locus_binding_count, 0); assert.equal(measured.point_span_current_support_exact, undefined);
    assert.deepEqual([...new Set(samples.map(sample => x + sample.point_to_upper_edge - carrier[0].after_interval[1]))].sort(), x === 49 ? [3, 5] : [5, 7]);
  }
});

test('incomplete or bounded competing domains produce no partial composition offers', async () => {
  const { family, observation, packet } = await current(51), receipts = [...family.receipts, ...family.publicPacketReceptionState().receipts];
  const excessive = Array.from({ length: DIRECTED_RECEIVER_COMPOSITION_CONTRACT.maximum_records + 1 }, () => receipts[0]!);
  const bounded = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, family.spans, excessive);
  assert.equal(bounded.complete, false); assert.deepEqual(bounded.offers, []); assert.equal(bounded.work_count, 0);
  const limited = { ...family.policy, route: { ...family.policy.route,
    framed_reception_locus_contract: { ...family.policy.route.framed_reception_locus_contract, maximum_records: 0 } } };
  const incomplete = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, limited, family.spans, receipts);
  assert.equal(incomplete.complete, false); assert.equal(incomplete.reason, 'directed_competing_source_domain_incomplete'); assert.deepEqual(incomplete.offers, []);
  const absent = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, family.spans, []);
  assert.equal(absent.complete, true); assert.deepEqual(absent.offers, []); assert.equal(absent.work_count, 0);
});

test('ambiguous uniform reception points survive filtering and are excluded from the directed domain', async () => {
  const collision = JSON.parse(gunzipSync(read('fixtures/v6-framed-uniform-collision.json.gz')).toString());
  const policy = (await FramedTransfer.create()).policy;
  const source = await candidates(collision.rows, collision.obs, policy, collision.spans, collision.receipts, {});
  const measured = await measureCurrentUniformReceptionQuestions(collision.rows, collision.obs, policy, collision.spans, collision.receipts, {}, source, true);
  const occupied = measured.occupiedReceptionPoints!.find(row => row.point[0] === 31 && row.point[1] === 31)!;
  assert.equal(occupied.raw_task_count, 2); assert.equal(occupied.task_refs.length, 2);
  assert.ok(measured.receptionOffers.every(offer => offer.point[0] !== 31 || offer.point[1] !== 31));
  const { family, observation, packet } = await current(51), receipts = [...family.receipts, ...family.publicPacketReceptionState().receipts];
  const baseline = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, family.spans, receipts, family.attempts);
  assert.ok(baseline.offers.some(offer => offer.point[0] === 33 && offer.point[1] === 41));
  // Adversarial provider-interface fixture: a complete competing domain marks
  // this current point occupied even though it returns no admissible offers.
  const rejected = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, family.spans, receipts, family.attempts, [],
    [{ point: [33, 41], raw_task_count: 2, task_refs: ['synthetic:competing:a', 'synthetic:competing:b'] }]);
  assert.equal(rejected.complete, true); assert.ok(rejected.offers.every(offer => offer.point[0] !== 33 || offer.point[1] !== 41));
  assert.ok(rejected.offers.length > 0, 'other unoccupied current points remain available');
});

test('geometry identities do not depend on native SRC execution annotations in span records', async () => {
  const { family, observation, packet } = await current(51), receipts = [...family.receipts, ...family.publicPacketReceptionState().receipts];
  const first = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, family.spans, receipts, family.attempts);
  const spans = structuredClone(family.spans);
  for (const span of spans) if (span.derivation?.workflow) span.derivation.workflow = { workflow: span.derivation.workflow.workflow,
    src_hash: span.derivation.workflow.src_hash, status: span.derivation.workflow.status, executed_statements: span.derivation.workflow.executed_statements };
  const second = await measureCurrentDirectedReceiverQuestions(packet.frame_rows, observation, family.policy, spans, receipts, family.attempts);
  assert.deepEqual(second, first);
});
