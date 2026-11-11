/** Qualify the real passive campaign adapter using explicitly synthetic packets. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const fixturePath = 'tests/fixtures/v6-preview-packing/reference.json.gz';
const bytes = await readFile(fixturePath), fixture = JSON.parse(gunzipSync(bytes).toString());
const session = fixture.sessions.find((row: any) => row.id === 'selection-unit-translation-and-official-boundary');
assert.ok(session);
// The browser transport requires 64x64 rasters. Preserve the constructed public
// content at its original coordinates and extend its observed outer background.
const publicPacket = (packet: any) => {
  const background = packet.frame_rows[0][0];
  const pad = (rows: number[][]) => Array.from({ length: 64 }, (_, y) =>
    Array.from({ length: 64 }, (_, x) => rows[y]?.[x] ?? background));
  const frame_rows = pad(packet.frame_rows), frame_packet = packet.frame_packet.map(pad);
  return { ...packet, frame_rows, frame_packet,
    frame_hash: createHash('sha256').update(JSON.stringify(frame_rows)).digest('hex').slice(0, 16) };
};
const packets = [{ command: null, packet: publicPacket(session.steps[0].beforePublic) },
  ...session.steps.filter((row: any) => row.command).map((row: any) => ({
    command: { action_ref: row.command.action_ref, data: row.command.data ?? {} }, packet: publicPacket(row.afterPublic) }))];
const fingerprint = { path: fixturePath, sha256: createHash('sha256').update(bytes).digest('hex') };
const result = await runNativeGameCampaign({ gameCode: 'SYN1', targetLevels: 1,
  recordedPublic: { trace: fingerprint, baseline: fingerprint, gameAssets: {}, packets } });
result.syntheticQualification = 'Constructed public packets from the unchanged original component fixture. No game host or game engine executed; not a live-game success.';
const output = process.argv[2]; assert.ok(output, 'Pass a new output path');
await writeFile(output, gzipSync(JSON.stringify(result) + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ output, status: result.status, actions: result.actions.length, prefixes: result.prefixes.length,
  previewEvents: result.previewPackingEvents.length, failure: result.failure, synthetic: true }));
if (result.status !== 'passed') process.exitCode = 1;
