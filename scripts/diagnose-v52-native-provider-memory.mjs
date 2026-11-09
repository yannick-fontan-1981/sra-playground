/** Instrument actual native provider calls and preserve public returns on abort. */
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const [gameCode, target, journalPath, checkpointPath, finalPath] = process.argv.slice(2);
if (!gameCode || !target || !journalPath || !checkpointPath || !finalPath) throw new Error('GAME LEVELS PUBLIC.jsonl PARTIAL.json FINAL.json');
for (const path of [journalPath, checkpointPath, finalPath]) if (existsSync(path)) throw new Error(`Existing diagnostic evidence: ${path}`);
writeFileSync(journalPath, '');
const report = await runNativeGameCampaign({ gameCode, targetLevels: Number(target), providerDiagnostics: true,
  progress: event => console.log(JSON.stringify(event)),
  publicTrace: (packet, command) => appendFileSync(journalPath, JSON.stringify({ packet, command }) + '\n'),
  checkpoint: value => writeFileSync(checkpointPath, JSON.stringify(value)),
});
writeFileSync(finalPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, final: report.final, failure: report.failure }));
if (report.status !== 'passed') process.exitCode = 1;
