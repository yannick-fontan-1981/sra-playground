/** The ordinary cold native caller, with each actual public return flushed for diagnosis. */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const [gameCode, levels, reportArgument, traceArgument, journalArgument] = process.argv.slice(2);
if (!gameCode || !levels || !reportArgument || !traceArgument || !journalArgument) {
  throw new Error('Usage: run-v52-journaled-campaign.mjs GAME TARGET_LEVELS REPORT TRACE JOURNAL');
}
const [reportPath, tracePath, journalPath] = [reportArgument, traceArgument, journalArgument].map(value => resolve(value));
for (const path of [reportPath, tracePath, journalPath]) {
  try { await access(path); throw new Error(`Evidence already exists: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(path), { recursive: true });
}
const packets = [];
const report = await runNativeGameCampaign({ gameCode, targetLevels: Number(levels),
  progress: event => console.log(JSON.stringify(event)),
  publicTrace: (packet, command) => {
    const item = { command: structuredClone(command), packet: structuredClone(packet) };
    packets.push(item);
    appendFileSync(journalPath, JSON.stringify(item) + '\n');
  },
});
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
await writeFile(tracePath, gzipSync(JSON.stringify({ schema: 'logos-engine.native-public-game-trace.v1',
  game: gameCode, sourceDigest: report.source.digest, status: report.status, packets })));
console.log(JSON.stringify({ report: reportArgument, trace: traceArgument, status: report.status,
  final: report.final, boundaries: report.boundaries, failure: report.failure, sourceDigest: report.source.digest }));
if (report.status !== 'passed') process.exitCode = 1;
