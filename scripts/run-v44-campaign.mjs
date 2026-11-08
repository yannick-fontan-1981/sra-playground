/** Execute one cold native campaign through the opaque public host. */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const [gameCode, levels, reportArgument, traceArgument] = process.argv.slice(2);
if (!gameCode || !levels || !reportArgument) throw new Error('Usage: run-v44-campaign.mjs GAME TARGET_LEVELS REPORT.json [TRACE.json.gz]');
const reportPath = resolve(reportArgument), tracePath = traceArgument ? resolve(traceArgument) : null;
for (const path of [reportPath, tracePath].filter(Boolean)) {
  try { await access(path); throw new Error(`Evidence already exists: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await mkdir(dirname(reportPath), { recursive: true });
if (tracePath) await mkdir(dirname(tracePath), { recursive: true });
const packets = [];
const report = await runNativeGameCampaign({ gameCode, targetLevels: Number(levels),
  progress: event => console.log(JSON.stringify(event)),
  ...(tracePath ? { publicTrace: (packet, command) => packets.push({ command: structuredClone(command), packet: structuredClone(packet) }) } : {}) });
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
if (tracePath) await writeFile(tracePath, gzipSync(JSON.stringify({ schema: 'logos-engine.native-public-game-trace.v1',
  game: gameCode, sourceDigest: report.source.digest, status: report.status, packets })));
console.log(JSON.stringify({ report: reportArgument, trace: traceArgument ?? null, status: report.status,
  final: report.final, boundaries: report.boundaries, failure: report.failure, sourceDigest: report.source.digest }));
if (report.status !== 'passed') process.exitCode = 1;
