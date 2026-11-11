/** Actual cold HPDL campaign. Invoke through run-hpdl-clocked-proof.py only. */
import { createReadStream, createWriteStream, closeSync, existsSync, fsyncSync,
  openSync, realpathSync, renameSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { runNativeGameCampaign } from '../../../tests/helpers/v6-live-game-campaign.ts';
import { evidenceJsonChunks, writeEvidenceJsonSync } from './stream-evidence-json.mjs';

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'));
const EVIDENCE = resolve(ROOT, 'docs/migration/lot10b-evidence');
const [directory, ...unexpected] = process.argv.slice(2);
if (!directory || unexpected.length) {
  throw new Error('Usage: run-hpdl-campaign.mjs NEW_ATTEMPT_DIRECTORY (through the clocked wrapper)');
}
const out = realpathSync(resolve(ROOT, directory));
const childPath = relative(EVIDENCE, out);
if (!childPath || childPath === '..' || childPath.startsWith(`..${sep}`) || !statSync(out).isDirectory()) {
  throw new Error('The existing attempt directory must be below lot10b-evidence');
}
const paths = {
  journal: resolve(out, 'hpdl-actual-public-journal.jsonl'),
  checkpoints: resolve(out, 'hpdl-checkpoints.jsonl'),
  checkpoint: resolve(out, 'hpdl-checkpoint.json'),
  report: resolve(out, 'hpdl-campaign.json.gz'),
  trace: resolve(out, 'hpdl-public-trace.json.gz'),
  started: resolve(out, 'hpdl-child-start.json'),
  returned: resolve(out, 'hpdl-child-return.json'),
};
for (const path of Object.values(paths)) {
  if (existsSync(path)) throw new Error(`Attempt output already exists: ${path}`);
}
// The outer process creates the attempt claim and verified freeze before spawn.
for (const name of ['attempt-start.json', 'preflight.json']) {
  if (!existsSync(resolve(out, name))) throw new Error(`Missing wrapper admission: ${name}`);
}

function syncDirectory() {
  const fd = openSync(out, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeFreshJson(path, value) {
  const fd = openSync(path, 'wx', 0o600);
  let bytes;
  try {
    bytes = writeEvidenceJsonSync(fd, value, { trailingNewline: true });
    fsyncSync(fd);
  } finally { closeSync(fd); }
  syncDirectory();
  return bytes;
}
function appendJson(fd, value) {
  writeEvidenceJsonSync(fd, value, { trailingNewline: true });
  fsyncSync(fd);
}
function commitFile(temporary, destination) {
  // The final name is installed only after all bytes have reached a closed file.
  const fd = openSync(temporary, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, destination);
  syncDirectory();
}

writeFreshJson(paths.started, {
  schema: 'logos-engine.lot10b.hpdl-child-start.v1', game: 'HPDL', targetLevels: 6,
  startedAt: new Date().toISOString(), pid: process.pid, parentPid: process.ppid,
  nodeVersion: process.version, execArgv: process.execArgv,
  additionalActionCap: null,
  qualification: 'One actual cold production campaign. The parent owns admission, cumulative accounting and the external deadline.',
});
let journalFd = openSync(paths.journal, 'wx', 0o600);
let checkpointsFd = openSync(paths.checkpoints, 'wx', 0o600);
syncDirectory();
let packetsObserved = 0, actionReturnsObserved = 0, checkpointSequence = 0;

try {
  const report = await runNativeGameCampaign({
    gameCode: 'HPDL', targetLevels: 6,
    progress: event => console.log(JSON.stringify(event)),
    publicTrace: (packet, command) => {
      // This callback observes the actual return; it supplies no decision/state.
      appendJson(journalFd, { command, packet });
      packetsObserved += 1;
      if (command !== null) actionReturnsObserved += 1;
    },
    checkpoint: partialReport => {
      const sequence = ++checkpointSequence;
      const recordedAt = new Date().toISOString();
      const temporary = resolve(out, `hpdl-checkpoint-${String(sequence).padStart(6, '0')}.inprogress.json`);
      const memoryBeforeCapture = process.memoryUsage();
      const processLifetimeMaxRssBeforeCaptureKilobytes = process.resourceUsage().maxRSS;
      const captureStarted = performance.now();
      const checkpointBytes = writeFreshJson(temporary, {
        schema: 'logos-engine.lot10b.hpdl-campaign-checkpoint.v1',
        game: 'HPDL', targetLevels: 6, sequence, recordedAt,
        completeCampaign: false,
        qualification: 'The exact report supplied by the harness checkpoint callback; no final result is inferred.',
        report: partialReport,
      });
      commitFile(temporary, paths.checkpoint);
      const serializationAndCommitElapsedMs = performance.now() - captureStarted;
      const memoryAfterCapture = process.memoryUsage();
      const processLifetimeMaxRssAfterCaptureKilobytes = process.resourceUsage().maxRSS;
      appendJson(checkpointsFd, {
        sequence, recordedAt, completeCampaign: false,
        reportStatus: partialReport.status,
        recordedActions: partialReport.actions.length,
        recordedPrefixes: partialReport.prefixes.length,
        packetsObserved, actionReturnsObserved,
        captureDiagnostics: {
          serialization: 'incremental_json_v1', checkpointBytes,
          serializationAndCommitElapsedMs,
          memoryBeforeCapture, memoryAfterCapture,
          processLifetimeMaxRssBeforeCaptureKilobytes, processLifetimeMaxRssAfterCaptureKilobytes,
          qualification: 'Elapsed time uses a monotonic clock and covers serialization and commit. maxRSS values are cumulative process-lifetime maxima in kilobytes, not peaks attributable to this capture. Process memory samples surround serialization and commit only. No cause of an earlier process termination is inferred.',
        },
      });
    },
  });

  closeSync(journalFd); journalFd = null;
  closeSync(checkpointsFd); checkpointsFd = null;
  if (!['passed', 'failed'].includes(report.status) || !report.final) {
    throw new Error('The harness returned without a terminal campaign report');
  }
  // A partial checkpoint is never promoted to either of these final artifacts.
  const reportTemporary = `${paths.report}.inprogress`;
  await pipeline(Readable.from(evidenceJsonChunks(report, { trailingNewline: true }), { objectMode: false }),
    createGzip({ mtime: 0 }), createWriteStream(reportTemporary, { flags: 'wx', mode: 0o600 }));
  commitFile(reportTemporary, paths.report);
  const traceTemporary = `${paths.trace}.inprogress`;
  async function* traceChunks() {
    yield `${JSON.stringify({
      schema: 'logos-engine.native-public-game-trace.v1', game: 'HPDL',
      sourceDigest: report.source.digest, status: report.status,
    }).slice(0, -1)},"packets":[`;
    let first = true;
    const lines = createInterface({ input: createReadStream(paths.journal), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) throw new Error('Unexpected empty public journal record');
      yield `${first ? '' : ','}${line}`;
      first = false;
    }
    yield ']}\n';
  }
  await pipeline(Readable.from(traceChunks()), createGzip({ mtime: 0 }),
    createWriteStream(traceTemporary, { flags: 'wx', mode: 0o600 }));
  commitFile(traceTemporary, paths.trace);
  writeFreshJson(paths.returned, {
    schema: 'logos-engine.lot10b.hpdl-child-return.v1', returnedAt: new Date().toISOString(),
    status: report.status, final: report.final, failure: report.failure,
    sourceDigest: report.source.digest,
    packetsObserved, actionReturnsObserved, checkpointSequence,
    qualification: 'These fields were returned by the actual harness; final gzip artifacts are now complete.',
  });
  console.log(JSON.stringify({ status: report.status, final: report.final, failure: report.failure,
    report: relative(ROOT, paths.report), trace: relative(ROOT, paths.trace),
    sourceDigest: report.source.digest, actionReturnsObserved, checkpointSequence }));
  if (report.status !== 'passed') process.exitCode = 1;
} finally {
  if (journalFd !== null) closeSync(journalFd);
  if (checkpointsFd !== null) closeSync(checkpointsFd);
}
