/** Development reference cap. The unchanged common harness still owns decisions. */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { runNativeGameCampaign } from '../tests/helpers/v6-live-game-campaign.ts';

const [game, target, cap, reportArgument, traceArgument, journalArgument] = process.argv.slice(2);
const targetLevels = Number(target), maximumAcquiredActions = Number(cap);
if (!game || !Number.isInteger(targetLevels) || targetLevels < 1
    || !Number.isInteger(maximumAcquiredActions) || maximumAcquiredActions < 1
    || !reportArgument || !traceArgument || !journalArgument) {
  throw new Error('Usage: run-bounded-native-campaign.mjs GAME TARGET_LEVELS MAX_ACTIONS REPORT.gz TRACE.gz JOURNAL');
}
const [reportPath, tracePath, journalPath] = [reportArgument, traceArgument, journalArgument].map(value => resolve(value));
for (const path of [reportPath, tracePath, journalPath]) {
  try { await access(path); throw new Error(`Evidence already exists: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(dirname(path), { recursive: true });
}
const packets = [];
let actionCapReached = false;
const report = await runNativeGameCampaign({ gameCode: game, targetLevels,
  progress: event => {
    console.log(JSON.stringify(event));
    // A response follows acquisition and precedes acceptance/dispatch of another
    // returned command. Stop only the outer diagnostic, never rewrite a policy.
    if (event.phase === 'response' && event.actions >= maximumAcquiredActions
        && event.levelsCompleted < targetLevels) {
      actionCapReached = true;
      throw new Error('outer_reference_acquired_action_cap');
    }
  },
  publicTrace: (packet, command) => {
    const item = { command: structuredClone(command), packet: structuredClone(packet) };
    packets.push(item);
    appendFileSync(journalPath, JSON.stringify(item) + '\n');
  },
});
report.outerReferenceLimit = { maximumAcquiredActions, actionCapReached,
  qualification: 'A bounded development reference, not a complete production campaign. The unchanged common harness owns every decision. If the outer action cap is reached, the last response has acquired its transition but is not accepted by the browser controller; final controller/prefix summaries may therefore lag that response. All actual public returns remain in the journal.' };
await writeFile(reportPath, gzipSync(JSON.stringify(report) + '\n'));
await writeFile(tracePath, gzipSync(JSON.stringify({ schema: 'logos-engine.native-public-game-trace.v1',
  game, sourceDigest: report.source.digest, status: report.status, packets }) + '\n'));
console.log(JSON.stringify({ status: report.status, final: report.final, failure: report.failure, actionCapReached }));
if (report.status !== 'passed') process.exitCode = 1;
