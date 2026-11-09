/** Cold command recomputation against complete, previously observed packets. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const [baselineArgument, traceArgument, reportArgument] = process.argv.slice(2);
if (!baselineArgument || !traceArgument || !reportArgument) {
  throw new Error('Usage: replay-v53-public-regression.mjs BASELINE TRACE.gz REPORT.gz');
}
const reportPath = resolve(reportArgument);
try { await access(reportPath); throw new Error(`Evidence already exists: ${reportPath}`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineBytes = await readFile(baselineArgument), traceBytes = await readFile(traceArgument);
const baseline = JSON.parse(baselineArgument.endsWith('.gz') ? gunzipSync(baselineBytes) : baselineBytes);
const trace = JSON.parse(gunzipSync(traceBytes));
assert.equal(baseline.status, 'passed'); assert.equal(trace.status, 'passed');
assert.equal(trace.game, baseline.game);
assert.equal(trace.packets.length, baseline.actions.length + 1);
assert.equal(hash(JSON.stringify(trace.packets[0].packet)), baseline.initial.publicPacketSha256);
for (const [index, item] of trace.packets.slice(1).entries()) {
  assert.deepEqual(item.command, baseline.actions[index].command);
  assert.equal(hash(JSON.stringify(item.packet)), baseline.actions[index].publicPacketSha256);
}
await mkdir(dirname(reportPath), { recursive: true });
const report = await runNativeGameCampaign({ gameCode: baseline.game, targetLevels: baseline.targetLevels,
  progress: event => console.log(JSON.stringify(event)), recordedPublic: {
    trace: { path: traceArgument, sha256: hash(traceBytes) },
    baseline: { path: baselineArgument, sha256: hash(baselineBytes) },
    gameAssets: baseline.gameAssets, packets: trace.packets,
  },
});
await writeFile(reportPath, gzipSync(JSON.stringify(report) + '\n'));
console.log(JSON.stringify({ report: reportArgument, status: report.status, final: report.final,
  failure: report.failure, sourceDigest: report.source.digest, mode: 'recorded-public-replay' }));
if (report.status !== 'passed') process.exitCode = 1;
