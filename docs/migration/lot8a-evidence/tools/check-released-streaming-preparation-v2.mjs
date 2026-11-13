/** Small synthetic --prepare-only comparison of the historical and V2 hosts.
 * No game, native harness or original agent is imported in either child path.
 * All fixtures are temporary; the small execution receipt is saved explicitly.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
assert(args.length === 2 && args[0] === '--output', 'Expected --output NEW_RECEIPT.json');
const SELF = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SELF), '../../../..');
const output = resolve(args[1]);
assert(!existsSync(output), 'The checker never replaces a receipt');
const oldHost = 'scripts/replay-public-regression-released-baseline.mjs';
const newHost = 'docs/migration/lot8a-evidence/tools/replay-recorded-public-released-streaming-v2.mjs';
const MAX_FIXTURE_BYTES = 262_144, sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputFiles = [SELF, resolve(ROOT, oldHost), resolve(ROOT, newHost),
  resolve(ROOT, 'docs/migration/lot8a-evidence/tools/write-streamed-evidence-gzip.mjs'),
  resolve(ROOT, 'docs/migration/lot10b-evidence/stream-evidence-json.mjs')];
const fingerprint = path => { const bytes = readFileSync(path); return { path, bytes: bytes.length, sha256: sha(bytes) }; };
const inputsBefore = inputFiles.map(fingerprint);
const directory = mkdtempSync(join(tmpdir(), 'lot8a-released-preparation-v2-'));
const result = { schema: 'logos-engine.lot8a.released-preparation-fixture-check.v1',
  status: 'failed', startedAt: new Date().toISOString(), command: process.argv,
  synthetic: true, nativeExecution: false, originalAgentExecution: false, gameExecution: false,
  maximumFixtureBytes: MAX_FIXTURE_BYTES, cases: [], rejectedCases: [], commands: [], inputsBefore,
  qualification: 'Small preparation-only equivalence and host-root collection checks. The native harness is not imported. '
    + 'This proves neither WEAV completion, total runtime memory bounds, production correctness nor performance.' };

function jsonFile(name, value, compressed) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  assert(bytes.length <= MAX_FIXTURE_BYTES, 'Fixture exceeds the declared small bound');
  const path = join(directory, name);
  writeFileSync(path, compressed ? gzipSync(bytes) : bytes, { flag: 'wx' });
  return path;
}
function command(host, label, baseline, trace, exposeGc = true) {
  const reportPath = join(directory, `${label}-report.json.gz`);
  const preparationPath = join(directory, `${label}-preparation.json`);
  const argv = [...(exposeGc ? ['--expose-gc'] : []), '--max-old-space-size=1536',
    resolve(ROOT, host), baseline, trace, reportPath, preparationPath, '--prepare-only'];
  const child = spawnSync(process.execPath, argv, { cwd: ROOT, timeout: 15_000, encoding: 'utf8', maxBuffer: 65_536 });
  assert.equal(child.signal, null, 'Fixture child was killed');
  assert.equal(child.error, undefined, 'Fixture child did not execute normally');
  result.commands.push({ argv: [process.execPath, ...argv], exitCode: child.status,
    stdout: child.stdout, stderr: child.stderr });
  assert.equal(existsSync(reportPath), false, 'Preparation-only mode produced a campaign report');
  return { ...child, preparationPath };
}
try {
  const packets = [
    { command: null, packet: { frame_rows: [[0, 1], [2, 3]], frame_packet: [[[0, 1], [2, 3]]], level: 1, levels_completed: 0, state: 'NOT_FINISHED' } },
    { command: { action_ref: 'ACTION6', data: { x: 1, y: 0 } }, packet: { frame_rows: [[0, 2], [2, 3]], frame_packet: [[[0, 1], [2, 3]], [[0, 2], [2, 3]]], level: 1, levels_completed: 0, state: 'NOT_FINISHED' } },
    { command: { action_ref: 'ACTION4' }, packet: { frame_rows: [[2, 0], [2, 3]], frame_packet: [[[2, 0], [2, 3]]], level: 2, levels_completed: 1, state: 'NOT_FINISHED' } },
  ];
  const baseline = { schema: 'fixture-only', status: 'passed', game: 'SYNTHETIC_PREPARATION_ONLY', targetLevels: 3,
    gameAssets: { 'fixture.asset': '0'.repeat(64) },
    initial: { publicPacketSha256: sha(JSON.stringify(packets[0].packet)) },
    actions: packets.slice(1).map(row => ({ command: row.command, publicPacketSha256: sha(JSON.stringify(row.packet)) })),
    unusedHistoricalGraph: Array.from({ length: 1_024 }, (_, index) => ({ index, value: [index, index + 1, 'discarded historical host data'] })) };
  const trace = { status: 'passed', game: baseline.game, packets };
  const tracePath = jsonFile('trace.json.gz', trace, true);
  const commonFields = ['schema', 'status', 'game', 'targetLevels', 'expectedActions', 'completePublicPackets',
    'baselineDecodedBytes', 'baseline', 'trace', 'exactExpectationSha256', 'initialPublicPacketSha256',
    'packetStreamSha256', 'actions', 'validation', 'baselineRootCollectedBeforeHarnessImport', 'preparationOnly'];
  for (const compressed of [true, false]) {
    const name = compressed ? 'gzip_baseline' : 'plain_baseline';
    const baselinePath = jsonFile(`${name}.json${compressed ? '.gz' : ''}`, baseline, compressed);
    const before = [fingerprint(baselinePath), fingerprint(tracePath)];
    const old = command(oldHost, `${name}-original`, baselinePath, tracePath);
    const current = command(newHost, `${name}-v2`, baselinePath, tracePath);
    assert.equal(old.status, 0, old.stderr); assert.equal(current.status, 0, current.stderr);
    const original = JSON.parse(readFileSync(old.preparationPath));
    const actual = JSON.parse(readFileSync(current.preparationPath));
    for (const field of commonFields) assert.deepEqual(actual[field], original[field], `${name}: ${field}`);
    assert.deepEqual(actual.hostOnlyRootsCollectedBeforeHarnessImport, {
      baselineCompressedBuffer: true, baselineDecodedBuffer: true,
      traceCompressedBuffer: true, traceDecodedBuffer: true,
      traceRoot: true, copiedExpectationRoot: true });
    assert.deepEqual(actual.retainedRuntimeInputs, ['game', 'targetLevels', 'gameAssets', 'packets', 'trace', 'baseline']);
    assert.equal(actual.noNativeStateOrBudgetChanged, true);
    assert.deepEqual([fingerprint(baselinePath), fingerprint(tracePath)], before);
    result.cases.push({ name, passed: true, commonFieldsCompared: commonFields.length,
      expectedActions: actual.expectedActions, completePublicPackets: actual.completePublicPackets,
      baselineRootCollectedBeforeHarnessImport: actual.baselineRootCollectedBeforeHarnessImport,
      otherCollectedRoots: actual.hostOnlyRootsCollectedBeforeHarnessImport,
      baselineDecodedBytes: actual.baselineDecodedBytes,
      exactExpectationSha256: actual.exactExpectationSha256, packetStreamSha256: actual.packetStreamSha256,
      inputsUnchanged: true, noCampaignReportCreated: true });
  }

  const baselinePath = join(directory, 'gzip_baseline.json.gz');
  const defects = [
    ['wrong_command', value => { value.packets[1].command = { action_ref: 'ACTION1' }; }],
    ['wrong_complete_packet', value => { value.packets[2].packet.frame_rows[0][0] = 9; }],
    ['wrong_game', value => { value.game = 'OTHER_SYNTHETIC_FIXTURE'; }],
    ['wrong_packet_count', value => { value.packets.pop(); }],
  ];
  for (const [name, mutate] of defects) {
    const defective = structuredClone(trace); mutate(defective);
    const invalid = jsonFile(`${name}.json.gz`, defective, true);
    for (const [label, host] of [['original', oldHost], ['v2', newHost]]) {
      const child = command(host, `${name}-${label}`, baselinePath, invalid);
      assert.notEqual(child.status, 0); assert(!existsSync(child.preparationPath));
    }
    result.rejectedCases.push({ name, passed: true, originalAndV2Reject: true, noPreparationOrCampaignReportCreated: true });
  }
  for (const [label, host] of [['original', oldHost], ['v2', newHost]]) {
    const child = command(host, `without_gc-${label}`, baselinePath, tracePath, false);
    assert.notEqual(child.status, 0); assert(!existsSync(child.preparationPath));
  }
  result.rejectedCases.push({ name: 'explicit_gc_required', passed: true, originalAndV2Reject: true,
    noPreparationOrCampaignReportCreated: true });
  result.inputsAfter = inputFiles.map(fingerprint);
  assert.deepEqual(result.inputsAfter, inputsBefore);
  result.status = 'passed'; result.passedCases = result.cases.length;
  result.passedRejections = result.rejectedCases.length;
} catch (error) {
  result.error = { name: error.name, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  rmSync(directory, { recursive: true, force: true });
  result.finishedAt = new Date().toISOString();
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ status: result.status, passedCases: result.passedCases,
  passedRejections: result.passedRejections, receipt: output, nativeExecution: false, gameExecution: false }));
