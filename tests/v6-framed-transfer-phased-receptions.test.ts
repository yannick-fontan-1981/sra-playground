import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { FramedPolicy } from '../src/logos-engine/v6-framed-transfer-policy.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measureCurrentPublicPacketReceptions } from '../src/logos-engine/v6-framed-transfer-public-receptions.ts';
import { PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT, measureCurrentPhasedPublicPacketReceptions } from '../src/logos-engine/v6-framed-transfer-phased-receptions.ts';

// Actual public returns retained from the frozen failed campaign. These tests
// neither open a host nor execute an action. Negative variants are explicitly
// controlled raster perturbations, not additional game observations.
const trace = JSON.parse(gunzipSync(readFileSync(new URL('../docs/migration/native-campaigns-v52/attempt8/gare-public-trace.json.gz', import.meta.url))).toString());
const first = trace.packets[16].packet, final = trace.packets[17].packet, command = trace.packets[17].command;
const before = await measureNativeObservation(first, 17, 'test:phased-public-return');
const after = await measureNativeObservation(final, 18, 'test:phased-public-return');
const policy = await FramedPolicy.create();
const measure = (frames = final.frame_packet, currentPolicy = policy) => measureCurrentPhasedPublicPacketReceptions(
  first.frame_rows, final.frame_rows, before, after, command, frames, currentPolicy);
const positive = await measure();

test('a unique framed appearance enters a uniform receiver after the public support has settled', () => {
  assert.equal(positive.complete, true); assert.equal(positive.rows.length, 1); assert.equal(positive.frame_count, 14);
  const { facts, packet_witness: witness } = positive.rows[0]!;
  assert.deepEqual(facts.framed_replacement_source_frame_bbox, [41, 32, 45, 36]);
  assert.deepEqual(facts.framed_replacement_marker_frame_bbox, [31, 32, 35, 36]);
  assert.deepEqual(facts.framed_replacement_delta, [-10, 0]);
  assert.equal(facts.framed_replacement_source_inner_value, 5); assert.equal(facts.framed_replacement_source_border_value, 14);
  assert.equal(facts.framed_replacement_marker_inner_value, 5); assert.equal(facts.framed_replacement_marker_border_value, 3);
  assert.equal(facts.framed_replacement_border_preserved, true); assert.equal(facts.framed_replacement_marker_uniform, true);
  assert.equal(facts.framed_replacement_tracking_lineage_agrees, false, 'Keep actual occurrence identifiers; contextual matching is a separate claim');
  assert.deepEqual(witness.source_stable_packet_range, [0, 1]); assert.deepEqual(witness.receiver_stable_packet_range, [3, 5]);
  assert.equal(witness.source_snapshot.packet_index, 1); assert.equal(witness.arrival_snapshot.packet_index, 3);
  assert.equal(witness.settled_snapshot.packet_index, 5, 'Frame4 has a transient front-collar change; frame13 has a later neighboring arrival');
  assert.equal(witness.first_valid_settlement_after_minimum_stability, true);
  assert.deepEqual(witness.unique_framed_appearance_trajectory.map((row: any) => row.packet_index), [0, 1, 2, 3, 4, 5]);
  assert.equal(witness.contextual_identity.unique_in_each_observed_frame, true);
  assert.equal(witness.contextual_identity.global_component_identity_asserted, false);
  assert.equal(witness.observed_trajectory_axial, true); assert.equal(witness.observed_axis_progression_monotone, true);
  assert.equal(witness.observed_motion_axis, 'row');
  assert.deepEqual(witness.support_observed_packet_range, [0, 5]);
  assert.equal(witness.support_endpoint_patches_unchanged_in_all_observed_frames, true);
  assert.equal(witness.settled_source_support.endpoint_patches.length, 2);
  assert.equal(witness.receiver_surroundings.collar_ends_equal, true);
  assert.equal(witness.receiver_surroundings.lateral_unchanged_in_all_observed_frames, true);
  assert.deepEqual(facts.framed_replacement_gap_patches, [['column', [36, 32, 40, 36], [
    [9, 5, 5, 5, 9], [5, 9, 5, 9, 5], [9, 9, 9, 9, 9], [5, 5, 9, 5, 5], [5, 5, 9, 5, 5],
  ]]]);
});

test('the directed annex preserves actual-command provenance and leaves the original public acquisition unchanged', async () => {
  const { facts, packet_witness: witness } = positive.rows[0]!;
  assert.equal(witness.schema, PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT.schema);
  assert.equal(facts.framed_replacement_native_directed_composition_only, true);
  assert.equal(witness.native_directed_composition_only, true); assert.equal(witness.original_directionless_candidate_eligible, false);
  assert.deepEqual(witness.actual_returned_command, command);
  assert.equal(witness.before_observation_ref, before.observation_ref); assert.equal(witness.after_observation_ref, after.observation_ref);
  assert.equal(witness.intermediate_command_count, 0); assert.equal(witness.causal_action_efficacy_established, false);
  assert.equal(witness.current_control_authority, false); assert.equal(witness.historical_receipt_reused, false);
  const original = await measureCurrentPublicPacketReceptions(first.frame_rows, final.frame_rows, before, after, command, final.frame_packet, policy);
  assert.equal(original.complete, true); assert.equal(original.rows.length, 3);
  assert.deepEqual(original.rows.map(row => row.packet_witness.receiver_stable_packet_range), [[3, 5], [7, 9], [11, 13]]);
  assert.ok(original.rows.every(row => row.facts.framed_replacement_delta[0] > 0));
});

test('the source record projection retains the truthful unequal occurrence identifiers', async () => {
  const { facts } = positive.rows[0]!;
  assert.notEqual(facts.framed_replacement_source_ref, facts.framed_replacement_current_visible_ref);
  const [derived] = await policy.record('policy.record_observed_framed_replacement', facts);
  assert.equal(derived.status, 'derived'); assert.equal(derived.record.tracking_lineage_agrees, false);
  assert.equal(derived.record.source_entity_ref, facts.framed_replacement_source_ref);
  assert.equal(derived.record.current_visible_ref, facts.framed_replacement_current_visible_ref);
  assert.deepEqual(derived.record.delta, [-10, 0]);
  // The family must retain the annex witness and directed-only flag alongside
  // this projected record; projection alone does not grant source eligibility.
});

async function refusedObservation(frames: number[][][]) {
  const result = await measure(frames); assert.equal(result.complete, true); assert.deepEqual(result.rows, []); return result;
}

test('a source-support excursion during the phase is refused even when both outer endpoints return to their final positions', async () => {
  const frames = structuredClone(final.frame_packet), support = positive.rows[0]!.packet_witness.settled_source_support;
  const frame = frames[2], background = first.frame_rows[0][0];
  const dr = support.before_bbox[0] - support.after_bbox[0], dc = support.before_bbox[1] - support.after_bbox[1];
  for (const [box] of support.endpoint_patches) {
    for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) frame[y][x] = background;
  }
  for (const [box, patch] of support.endpoint_patches) {
    for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) frame[y + dr][x + dc] = patch[y - box[0]][x - box[1]];
  }
  await refusedObservation(frames);
});

test('a duplicate of the complete contextual appearance in an intermediate frame breaks the track', async () => {
  const frames = structuredClone(final.frame_packet), trajectory = positive.rows[0]!.packet_witness.unique_framed_appearance_trajectory;
  const box = trajectory.find((position: any) => position.packet_index === 2).frame_bbox;
  const patch = frames[2].slice(box[0], box[2] + 1).map((row: number[]) => row.slice(box[1], box[3] + 1));
  // A controlled spare region of this retained public raster, outside the
  // measured source, receiver and support. The entire border is duplicated.
  for (let y = 0; y < patch.length; y++) for (let x = 0; x < patch[y].length; x++) frames[2][50 + y][10 + x] = patch[y][x];
  await refusedObservation(frames);
});

test('an intermediate disappearance and a source with only one stable frame cannot become an observed reception', async () => {
  const missing = structuredClone(final.frame_packet), trajectory = positive.rows[0]!.packet_witness.unique_framed_appearance_trajectory;
  const box = trajectory.find((position: any) => position.packet_index === 2).frame_bbox;
  for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) missing[2][y][x] = final.frame_packet[1][y][x];
  await refusedObservation(missing);
  await refusedObservation(final.frame_packet.filter((_: unknown, index: number) => index !== 1));
});

test('aligned endpoints do not excuse an observed off-axis detour or backward step', async () => {
  const detour = structuredClone(final.frame_packet), trajectory = positive.rows[0]!.packet_witness.unique_framed_appearance_trajectory;
  const box = trajectory.find((position: any) => position.packet_index === 2).frame_bbox;
  const patch = detour[2].slice(box[0], box[2] + 1).map((row: number[]) => row.slice(box[1], box[3] + 1));
  for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) detour[2][y][x] = final.frame_packet[1][y][x];
  const shift = box[3] - box[1] + 1;
  for (let y = 0; y < patch.length; y++) for (let x = 0; x < patch[y].length; x++) detour[2][box[0] + y][box[1] - shift + x] = patch[y][x];
  await refusedObservation(detour);
  const reversal = structuredClone(final.frame_packet); reversal.splice(3, 0, structuredClone(final.frame_packet[1]));
  await refusedObservation(reversal);
});

test('a temporary lateral-collar change vetoes every later settlement of the same reception', async () => {
  const frames = structuredClone(final.frame_packet), witness = positive.rows[0]!.packet_witness;
  const box = positive.rows[0]!.facts.framed_replacement_marker_frame_bbox;
  const [y, x, value] = witness.receiver_surroundings.lateral_before_pixels.find(([row, column]: number[]) => row === box[0] + 1 && column === box[1] - 1);
  frames[2][y][x] = (value + 1) % 256;
  await refusedObservation(frames);
});

test('a front collar that never restores before a neighboring intrusion yields no settled receipt', async () => {
  const frames = structuredClone(final.frame_packet), box = positive.rows[0]!.facts.framed_replacement_marker_frame_bbox;
  const y = box[2] + 1, x = Math.floor((box[1] + box[3]) / 2), value = frames[1][y][x];
  // Frame4 already differs; original lateral integrity ends at frame10.
  // No admissible settlement remains after these controlled perturbations.
  for (let index = 5; index <= 9; index++) frames[index][y][x] = (value + 1) % 256;
  await refusedObservation(frames);
});

test('the public final frame, epoch and inventory bounds refuse the whole measurement', async () => {
  const wrong = structuredClone(final.frame_packet); wrong[wrong.length - 1][0][0] = (wrong[wrong.length - 1][0][0] + 1) % 256;
  const mismatch = await measure(wrong);
  assert.equal(mismatch.complete, false); assert.equal(mismatch.reason, 'phased_public_frame_packet_final_mismatch'); assert.deepEqual(mismatch.rows, []);
  const epoch = await measureCurrentPhasedPublicPacketReceptions(first.frame_rows, final.frame_rows, before, { ...after, level_epoch: before.level_epoch + 1 }, command, final.frame_packet, policy);
  assert.equal(epoch.complete, false); assert.deepEqual(epoch.rows, []);
  const oversized = await measure(Array.from({ length: PHASED_PUBLIC_PACKET_RECEPTION_CONTRACT.maximum_frames + 1 }, () => final.frame_rows));
  assert.equal(oversized.complete, false); assert.equal(oversized.work_count, 0); assert.deepEqual(oversized.rows, []);
  const declaration = policy.policies['policy.record_observed_framed_replacement'];
  const limited = { ...policy, policies: { ...policy.policies, 'policy.record_observed_framed_replacement': {
    ...declaration, configuration: { ...declaration.configuration, measurement_contract: { ...declaration.configuration.measurement_contract, maximum_replacements: 0 } },
  } } };
  const count = await measure(final.frame_packet, limited as FramedPolicy);
  assert.equal(count.complete, false); assert.equal(count.reason, 'phased_public_reception_count_bound'); assert.deepEqual(count.rows, []);
});
