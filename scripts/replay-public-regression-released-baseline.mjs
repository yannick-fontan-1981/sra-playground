/** Same cold replay harness, with the historical report released before startup.
 * Usage: node --expose-gc --max-old-space-size=768 SCRIPT BASELINE TRACE.gz REPORT.gz PREPARATION.json [--prepare-only]
 * The existing harness still recomputes every command before its archived return.
 * No production source, time/action budget, recorded packet or comparator changes.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const [baselineArgument, traceArgument, reportArgument, preparationArgument, mode, ...extra] = process.argv.slice(2);
assert.ok(baselineArgument && traceArgument && reportArgument && preparationArgument && extra.length === 0
  && (mode === undefined || mode === '--prepare-only'),
  'Usage: node --expose-gc SCRIPT BASELINE TRACE.gz REPORT.gz PREPARATION.json [--prepare-only]');
assert.equal(typeof globalThis.gc, 'function', 'Use --expose-gc to verify release before starting the unchanged harness');
const reportPath = resolve(reportArgument), preparationPath = resolve(preparationArgument);
for (const path of [reportPath, preparationPath]) {
  try { await access(path); throw new Error(`Evidence already exists: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** None of the large baseline root, decoded JSON or compressed bytes escapes
 * this function. Only the host contract, small expectations and original packet
 * array survive. The weak reference verifies that the root really was released. */
async function prepare() {
  const baselineBytes = await readFile(baselineArgument), traceBytes = await readFile(traceArgument);
  const decoded = baselineArgument.endsWith('.gz') ? gunzipSync(baselineBytes) : baselineBytes;
  const baseline = JSON.parse(decoded), trace = JSON.parse(gunzipSync(traceBytes));
  assert.equal(baseline.status, 'passed'); assert.equal(trace.status, 'passed');
  assert.equal(trace.game, baseline.game);
  const expected = {
    game: baseline.game, targetLevels: baseline.targetLevels, gameAssets: structuredClone(baseline.gameAssets),
    initialPublicPacketSha256: baseline.initial.publicPacketSha256,
    actions: baseline.actions.map(action => ({ command: structuredClone(action.command), publicPacketSha256: action.publicPacketSha256 })),
  };
  assert.equal(trace.packets.length, expected.actions.length + 1);
  assert.equal(hash(JSON.stringify(trace.packets[0].packet)), expected.initialPublicPacketSha256);
  const checks = [];
  for (const [index, item] of trace.packets.slice(1).entries()) {
    assert.deepEqual(item.command, expected.actions[index].command);
    const packetSha256 = hash(JSON.stringify(item.packet));
    assert.equal(packetSha256, expected.actions[index].publicPacketSha256);
    checks.push({ index: index + 1, commandSha256: hash(JSON.stringify(item.command)), publicPacketSha256: packetSha256 });
  }
  return { game: expected.game, targetLevels: expected.targetLevels, gameAssets: expected.gameAssets, packets: trace.packets,
    trace: { path: traceArgument, sha256: hash(traceBytes) }, baseline: { path: baselineArgument, sha256: hash(baselineBytes) },
    baselineRoot: new WeakRef(baseline),
    preparation: { schema: 'logos-engine.released-baseline-replay-preparation.v1', status: 'passed',
      game: expected.game, targetLevels: expected.targetLevels, expectedActions: expected.actions.length,
      completePublicPackets: trace.packets.length, baselineDecodedBytes: decoded.byteLength,
      baseline: { path: baselineArgument, sha256: hash(baselineBytes), bytes: baselineBytes.byteLength },
      trace: { path: traceArgument, sha256: hash(traceBytes), bytes: traceBytes.byteLength },
      exactExpectationSha256: hash(JSON.stringify(expected)), initialPublicPacketSha256: expected.initialPublicPacketSha256,
      packetStreamSha256: hash(JSON.stringify(trace.packets)), actions: checks,
      validation: 'The unchanged historical host checks are performed for every command and complete packet hash before release. Only baseline game/target/assets, provenance and trace packets reach the unchanged harness.',
      memoryBeforeRelease: process.memoryUsage() } };
}
const prepared = await prepare();
// WeakRef targets stay live until the end of their current JavaScript job.
// A fresh event-loop turn is required before the explicit collection check.
await new Promise(resolve => setImmediate(resolve));
globalThis.gc();
assert.equal(prepared.baselineRoot.deref(), undefined, 'Historical report root must be collected before importing the campaign harness');
delete prepared.baselineRoot;
prepared.preparation.baselineRootCollectedBeforeHarnessImport = true;
prepared.preparation.memoryAfterRelease = process.memoryUsage();
prepared.preparation.preparationOnly = mode === '--prepare-only';
await mkdir(dirname(preparationPath), { recursive: true });
await writeFile(preparationPath, JSON.stringify(prepared.preparation, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ phase: 'baseline-released', preparation: preparationArgument,
  expectedActions: prepared.preparation.expectedActions, completePublicPackets: prepared.preparation.completePublicPackets,
  exactExpectationSha256: prepared.preparation.exactExpectationSha256,
  baselineRootCollectedBeforeHarnessImport: true }));
if (mode !== '--prepare-only') {
  const { runNativeGameCampaign } = await import('../tests/helpers/v6-live-game-campaign.ts');
  await mkdir(dirname(reportPath), { recursive: true });
  const report = await runNativeGameCampaign({ gameCode: prepared.game, targetLevels: prepared.targetLevels,
    progress: event => console.log(JSON.stringify(event)), recordedPublic: {
      trace: prepared.trace, baseline: prepared.baseline, gameAssets: prepared.gameAssets, packets: prepared.packets,
    } });
  await writeFile(reportPath, gzipSync(JSON.stringify(report) + '\n'), { flag: 'wx' });
  console.log(JSON.stringify({ report: reportArgument, status: report.status, final: report.final,
    failure: report.failure, sourceDigest: report.source.digest, mode: 'recorded-public-replay' }));
  if (report.status !== 'passed') process.exitCode = 1;
}
