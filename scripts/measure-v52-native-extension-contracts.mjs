/** Pure measurements of retained public inputs. This runner opens no game. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { FramedPolicy } from '../src/logos-engine/v6-framed-transfer-policy.ts';
import { FramedTransfer } from '../src/logos-engine/v6-framed-transfer.ts';
import { candidates } from '../src/logos-engine/v6-framed-transfer-observation.ts';
import { measureCurrentPublicPacketReceptions } from '../src/logos-engine/v6-framed-transfer-public-receptions.ts';
import { measureCurrentPhasedPublicPacketReceptions } from '../src/logos-engine/v6-framed-transfer-phased-receptions.ts';
import { measureCurrentUniformReceptionQuestions } from '../src/logos-engine/v6-framed-uniform-questions.ts';
import { measureCurrentDirectedReceiverQuestions } from '../src/logos-engine/v6-framed-directed-composition.ts';

const [kind, inputPath] = process.argv.slice(2);
if (!['phased', 'directed'].includes(kind) || !inputPath) throw new Error('Expected phased|directed and a retained input path');
const reference = JSON.parse(gunzipSync(readFileSync(inputPath)).toString());
const policy = await FramedPolicy.create();
if (kind === 'phased') {
  const a = reference.arguments;
  const stationary = await measureCurrentPublicPacketReceptions(a.first, a.final, a.before, a.after, a.command, a.frames, policy);
  const phased = await measureCurrentPhasedPublicPacketReceptions(a.first, a.final, a.before, a.after, a.command, a.frames, policy);
  const projectedRecords = [];
  for (const [domain, measurement] of [['stationary', stationary], ['phased_directed_only', phased]]) {
    for (const row of measurement.rows) {
      const [result, workflow] = await policy.record('policy.record_observed_framed_replacement', row.facts);
      projectedRecords.push({ domain, result, workflow });
    }
  }
  process.stdout.write(JSON.stringify({ stationary, phased_directed_only: phased, projectedRecords }));
} else {
  const cases = [];
  for (const item of reference.cases) {
    const { observation: obs, publicPacket: packet, checkpoint } = item;
    const source = checkpoint.source_state, annex = checkpoint.public_packet_receptions;
    const currentAnnex = annex.epoch === obs.level_epoch ? annex.receipts : [];
    const classic = [...source.receipts, ...currentAnnex.filter(record => record.native_directed_composition_only !== true
      && record.native_packet_witness?.native_directed_composition_only !== true)];
    const sourceOffers = await candidates(packet.frame_rows, obs, policy, source.spans, classic, source.attempts);
    const uniform = await measureCurrentUniformReceptionQuestions(packet.frame_rows, obs, policy, source.spans, classic, source.attempts, sourceOffers, true);
    const directed = uniform.complete ? await measureCurrentDirectedReceiverQuestions(packet.frame_rows, obs, policy, source.spans,
      [...source.receipts, ...currentAnnex], source.attempts, [...sourceOffers, ...uniform.receptionOffers], uniform.occupiedReceptionPoints ?? []) : null;
    const family = await FramedTransfer.create({ currentPointWitnessBinding: true, currentPublicPacketReceptions: true,
      currentUniformReceptionQuestions: true, currentSettledSupportReceptions: true, currentDirectedReceptionComposition: true });
    family.restoreNative(checkpoint);
    const proposal = await family.propose(obs, packet.frame_rows, [], 600);
    const sourceGuard = proposal ? await family.beforeSource(proposal, 0, packet, obs) : null;
    const nativeGuard = proposal ? await family.before(proposal, 0, packet, obs) : null;
    cases.push({ afterActualAction: item.afterActualAction, sourceOffers, uniform, directed, proposal,
      sourceGuard, nativeGuard, sourceStateAfter: family.state(), nativeCheckpointAfter: family.nativeState() });
  }
  process.stdout.write(JSON.stringify({ cases }));
}
