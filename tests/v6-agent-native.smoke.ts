/**
 * Explicit real-game campaign:
 * node tests/v6-agent-native.smoke.ts [gameCode] [targetLevels] [report.json]
 * V6_SMOKE_PROGRESS=1 emits compact per-request/level progress to stderr.
 * The agent is TypeScript; Pyodide is used solely for native game engines.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runNativeGameCampaign } from './helpers/v6-live-game-campaign.ts';

const publicTrace: unknown[] = [];
const tracePath = process.env.V6_SMOKE_PUBLIC_TRACE;
const report = await runNativeGameCampaign({
  gameCode: process.argv[2] ?? 'HANO', targetLevels: Number(process.argv[3] ?? 3),
  progress: process.env.V6_SMOKE_PROGRESS === '1' ? event => console.error(JSON.stringify(event)) : undefined,
  ...(tracePath ? { publicTrace: (packet, command) => { publicTrace.push({ packet, command }); } } : {}),
});
if (tracePath) {
  const path = resolve(tracePath); await mkdir(dirname(path), { recursive: true });
  await writeFile(path, gzipSync(JSON.stringify({ schema: 'logos-engine.native-public-game-trace.v1',
    game: report.game, sourceDigest: report.source.digest, status: report.status, packets: publicTrace }), { mtime: 0 }));
}
if (process.argv[4]) {
  const path = resolve(process.argv[4]);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ game: report.game, targetLevels: report.targetLevels, result: report.status,
  ...report.final, pythonAgentModules: report.pythonAgentModules?.length ?? null,
  baseline: report.baseline, sourceUnchangedDuringRun: report.sourceUnchangedDuringRun,
  levelActions: report.boundaries.map((boundary: any) => boundary.levelActions),
  elapsedSeconds: report.elapsedSeconds, failure: report.failure,
}));
if (report.status !== 'passed') process.exitCode = 1;
