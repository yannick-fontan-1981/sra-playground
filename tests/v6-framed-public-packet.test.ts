import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { measureCurrentPublicPacketReceptions, PUBLIC_PACKET_RECEPTION_CONTRACT } from '../src/logos-engine/v6-framed-transfer-public-receptions.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
// These are already retained actual returns of the earlier cold campaign, not
// a game host, a proposed trajectory or expected results from the new helper.
const directory = 'docs/migration/native-campaigns-v52/';
const campaign = JSON.parse(read(`${directory}gare-three-levels.json`).toString());
const trace = JSON.parse(gunzipSync(read(`${directory}gare-public-trace.json.gz`)).toString());
const prefix = campaign.prefixes[16], proposal = prefix.framedTransfer.proposal;
const seed = campaign.prefixes[15].framedAcquisition.sourceState;
const session = proposal.binding.observation_ref.split(':epoch:')[0];
const first = trace.packets[16].packet, final = trace.packets[17].packet, command = trace.packets[17].command;
const before = await measureNativeObservation(first, 17, session), after = await measureNativeObservation(final, 18, session);
const options = { currentPointWitnessBinding: true, currentPublicPacketReceptions: true };

async function measuredFamily() {
  const family = await FramedTransfer.create(options); family.restore(seed);
  const result = await family.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet);
  assert.ok(result); return { family, result };
}

test('three stable public replacements belong to one real returned command', async () => {
  const family = await FramedTransfer.create();
  const measured = await measureCurrentPublicPacketReceptions(first.frame_rows, final.frame_rows, before, after, command, final.frame_packet, family.policy);
  assert.equal(measured.complete, true); assert.equal(measured.rows.length, 3); assert.equal(measured.frame_count, 14);
  assert.deepEqual(measured.rows.map(row => row.packet_witness.source_stable_packet_range), [[-1, 1], [3, 5], [7, 9]]);
  assert.deepEqual(measured.rows.map(row => row.packet_witness.receiver_stable_packet_range), [[3, 5], [7, 9], [11, 13]]);
  for (const row of measured.rows) {
    assert.equal(row.facts.framed_replacement_context_epoch, before.level_epoch);
    assert.equal(row.facts.framed_replacement_marker_uniform, true);
    assert.equal(row.facts.framed_replacement_unique_preserved_copy, true);
    assert.equal(row.facts.framed_replacement_border_preserved, true);
    assert.equal(row.facts.framed_replacement_gap_patches.length, 1);
    const patch = row.facts.framed_replacement_gap_patches[0][2];
    assert.equal(patch.length, 5); assert.ok(patch.every((line: unknown[]) => line.length === 5));
    const witness = row.packet_witness;
    assert.deepEqual(witness.actual_returned_command, command);
    assert.equal(witness.before_observation_ref, before.observation_ref); assert.equal(witness.after_observation_ref, after.observation_ref);
    assert.equal(witness.context_epoch, before.level_epoch);
    assert.equal(witness.intermediate_command_count, 0); assert.equal(witness.causal_action_efficacy_established, false);
    assert.equal(witness.current_control_authority, false); assert.equal(witness.historical_receipt_reused, false);
    assert.equal(witness.epistemic_status, 'observed_replacement_not_control_law');
    for (const snapshot of [witness.source_snapshot, witness.arrival_snapshot, witness.settled_snapshot]) {
      assert.ok(snapshot.packet_index >= -1 && snapshot.packet_index < final.frame_packet.length);
      assert.match(snapshot.rows_sha256, /^[0-9a-f]{64}$/); assert.equal(typeof snapshot.frame_ref, 'string');
    }
  }
});

test('native annex leaves all six source fields and the complete source result unchanged', async () => {
  const strict = await FramedTransfer.create(); strict.restore(seed);
  const expected = await strict.recordSource(before, after, command, first.frame_rows, final.frame_rows, proposal, 0);
  const { family, result } = await measuredFamily();
  assert.deepEqual(result.source_result, expected);
  assert.deepEqual(family.state(), strict.state());
  assert.deepEqual(Object.keys(family.state()).sort(), ['attempts', 'epoch', 'last', 'portable', 'receipts', 'spans']);
  assert.equal(family.receipts.length, 0); assert.equal(family.spans.length, 1);
  assert.equal(result.native_result.status, 'observed_public_packet_receptions');
  assert.equal(result.native_result.derived.length, 3);
  const annex = family.publicPacketReceptionState();
  assert.equal(annex.receipts.length, 3); assert.equal(annex.epoch, after.level_epoch);
  for (const record of annex.receipts) {
    assert.ok(record.claims.some((claim: any) => claim.id === record.source_claim_ref));
    assert.deepEqual(record.evidence, [before.observation_ref, after.observation_ref]);
    assert.equal(record.derivation.policy, 'policy.record_observed_framed_replacement');
    assert.equal(record.derivation.workflow.workflow, 'v6.framed_transfer.record');
    assert.equal(record.derivation.workflow.execution_engine, 'logos-engine.typescript');
    assert.equal(record.native_packet_witness.causal_action_efficacy_established, false);
  }
});

test('passive acquisition learns the same public reception without a selected framed proposal', async () => {
  const family = await FramedTransfer.create(options); family.restore(seed);
  const result = await family.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, null, 0, final.frame_packet);
  assert.equal(result!.native_result.derived.length, 3);
  assert.equal(family.publicPacketReceptionState().receipts.length, 3);
  assert.deepEqual(family.attempts, {}, 'a foreign action does not fabricate a framed selected attempt');
});

test('selected adapter emits one event for one command and does not replay source acquisition', async () => {
  const family = await FramedTransfer.create(options); family.restore(seed);
  const result = await family.record(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet);
  assert.equal(result.events.length, 1);
  assert.equal((result.events[0] as any).native_result.derived.length, 3);
  assert.equal(family.spans.length, 1); assert.equal(family.publicPacketReceptionState().receipts.length, 3);
});

test('default adapter stays source exact even when a public packet is supplied', async () => {
  const family = await FramedTransfer.create(), strict = await FramedTransfer.create(); family.restore(seed); strict.restore(seed);
  const expected = await strict.recordSource(before, after, command, first.frame_rows, final.frame_rows, proposal, 0);
  assert.deepEqual(await family.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet), expected);
  assert.deepEqual(family.state(), strict.state());
  assert.equal(family.nativeState().format, 'native.public_framed_transfer.v1');
  assert.equal(family.publicPacketReceptionState().receipts.length, 0);
});

test('annex is an immutable authoritative checkpoint and malformed restore is atomic', async () => {
  const { family } = await measuredFamily(), checkpoint = family.nativeState(), revision = family.nativeRevision;
  assert.equal(checkpoint.format, 'native.public_framed_transfer.v2');
  assert.ok(Object.isFrozen(checkpoint)); assert.ok(Object.isFrozen(checkpoint.public_packet_receptions));
  const detached = family.publicPacketReceptionState(); detached.receipts[0]!.source_claim_ref = 'tampered';
  assert.notEqual(family.publicPacketReceptionState().receipts[0]!.source_claim_ref, 'tampered');
  const restored = await FramedTransfer.create(options); restored.restoreNative(checkpoint);
  assert.deepEqual(restored.state(), family.state()); assert.deepEqual(restored.publicPacketReceptionState(), family.publicPacketReceptionState());
  assert.equal(restored.nativeState(), checkpoint);
  for (const alter of [
    (state: any) => { state.public_packet_receptions.epoch++; },
    (state: any) => { state.public_packet_receptions.receipts[0].context_epoch++; },
    (state: any) => { state.public_packet_receptions.receipts[0].native_packet_witness.causal_action_efficacy_established = true; },
    (state: any) => { delete state.public_packet_receptions.receipts[0].source_claim_ref; },
    (state: any) => { state.public_packet_receptions.format = 'unknown'; },
    (state: any) => { state.source_state.spans = 'not-an-array'; },
  ]) {
    const changed = structuredClone(checkpoint); alter(changed); assert.throws(() => family.restoreNative(changed), TypeError);
    assert.equal(family.nativeRevision, revision); assert.equal(family.nativeState(), checkpoint);
  }
  const strict = await FramedTransfer.create(); assert.throws(() => strict.restoreNative(checkpoint), TypeError);
});

test('repeated actual packet deduplicates current receipts and retains complete provenance', async () => {
  const { family } = await measuredFamily(); const retained = family.publicPacketReceptionState().receipts;
  const repeated = await family.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet);
  assert.equal(repeated!.native_result.derived.length, 3); assert.deepEqual(family.publicPacketReceptionState().receipts, retained);
  const checkpoint = family.nativeState(), restored = await FramedTransfer.create(options); restored.restoreNative(checkpoint);
  await restored.recordPublicTransition(before, after, command, first.frame_rows, final.frame_rows, proposal, 0, final.frame_packet);
  assert.deepEqual(restored.publicPacketReceptionState().receipts, retained);
});

test('epoch boundary archives receipts as historical evidence without a current permit', async () => {
  const { family } = await measuredFamily(), receipts = family.publicPacketReceptionState().receipts;
  family.scope({ level_epoch: after.level_epoch + 1 });
  const annex = family.publicPacketReceptionState();
  assert.equal(annex.epoch, after.level_epoch + 1); assert.deepEqual(annex.receipts, []); assert.equal(annex.last, null);
  assert.equal(annex.portable.length, 1);
  assert.deepEqual(annex.portable[0], { source_epoch: after.level_epoch, receipts, authority: 'historical_not_current_permit' });
  assert.ok(annex.portable[0]!.receipts.every((record: any) => record.context_epoch === after.level_epoch));
  const restored = await FramedTransfer.create(options); restored.restoreNative(family.nativeState());
  assert.deepEqual(restored.publicPacketReceptionState(), annex);
  const invalid = structuredClone(family.nativeState()) as any; invalid.public_packet_receptions.portable[0].authority = 'current_permit';
  assert.throws(() => restored.restoreNative(invalid), TypeError);
  assert.deepEqual(restored.publicPacketReceptionState(), annex);
});

test('source-only restoration does not preserve native evidence absent from that snapshot', async () => {
  const { family } = await measuredFamily(), source = family.state();
  family.restore(source); assert.deepEqual(family.state(), source); assert.deepEqual(family.publicPacketReceptionState().receipts, []);
  const strict = await FramedTransfer.create(); strict.restore(source);
  family.restoreNative(strict.nativeState()); assert.deepEqual(family.state(), source);
  assert.equal(family.nativeState().format, 'native.public_framed_transfer.v2');
  assert.deepEqual(family.publicPacketReceptionState().receipts, []);
});

test('incomplete packet domains produce no partial native receipt prefix', async () => {
  const family = await FramedTransfer.create(), policy = family.policy;
  const cases = [
    { frames: [], before, after, expected: 'public_frame_packet_unavailable' },
    { frames: Array.from({ length: PUBLIC_PACKET_RECEPTION_CONTRACT.maximum_frames + 1 }, () => final.frame_rows), before, after, expected: 'public_frame_count_bound' },
    { frames: final.frame_packet, before, after: { ...after, level_epoch: after.level_epoch + 1 }, expected: 'public_epoch_or_observation_mismatch' },
    { frames: [first.frame_rows], before, after, expected: 'public_frame_packet_final_mismatch' },
  ];
  for (const sample of cases) {
    const result = await measureCurrentPublicPacketReceptions(first.frame_rows, final.frame_rows, sample.before, sample.after, command, sample.frames, policy);
    assert.equal(result.complete, false); assert.deepEqual(result.rows, []); assert.equal(result.reason, sample.expected);
  }
});
