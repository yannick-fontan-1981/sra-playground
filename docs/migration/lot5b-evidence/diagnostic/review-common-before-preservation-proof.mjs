#!/usr/bin/env node
/** Compare an actual complete-caller operation journal to a cold original replay.
 * This tool performs comparisons only and never executes a native or Python
 * agent. In the separate export, native results are not original replay inputs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [directoryArgument, fixtureArgument, receiptArgument, ...extra] = process.argv.slice(2);
assert.ok(directoryArgument && fixtureArgument && receiptArgument && !extra.length,
  'Usage: review-addressed-material-common-loop.mjs COMMON-LOOP-DIRECTORY ORIGINAL-REPLAY.json.gz EXPORT-RECEIPT.json');
const directory = resolve(ROOT, directoryArgument), journalPath = resolve(directory, 'actual-operations.json');
const reportPath = resolve(directory, 'common-loop.json.gz'), fixturePath = resolve(ROOT, fixtureArgument), exportPath = resolve(ROOT, receiptArgument);
const hash = value => createHash('sha256').update(value).digest('hex'), inputs = new Map();
async function fingerprint(path) {
  const bytes = await readFile(resolve(ROOT, path));
  const record = { path: relative(ROOT, resolve(ROOT, path)), bytes: bytes.length, sha256: hash(bytes) };
  if (inputs.has(record.path)) assert.deepEqual(record, inputs.get(record.path));
  inputs.set(record.path, record); return record;
}
async function read(path) {
  const bytes = await readFile(path); await fingerprint(path);
  return JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
}
const [journal, common, fixture, exported] = await Promise.all([read(journalPath), read(reportPath), read(fixturePath), read(exportPath)]);
const checks = [], failures = [];
function check(name, operation) {
  try { operation(); checks.push({ name, passed: true }); }
  catch (error) { const row = { name, passed: false, error: { name: error.name, message: error.message } }; checks.push(row); failures.push(row); }
}
await fingerprint(fileURLToPath(import.meta.url));
assert.equal(fixture.schema, 'logos-engine.v6.addressed-material-reference.v1');
assert.equal(fixture.mode, 'captured-public-journals');
assert.equal(exported.schema, 'logos-engine.independent-python-oracle-export.v1'); assert.equal(exported.status, 'passed');
assert.equal(exported.mode, fixture.mode); assert.equal(exported.sourceInventoryUnchanged, true);
assert.equal(exported.sourceInventorySha256Before, exported.sourceInventorySha256After);
assert.equal(exported.sourceFilesVerifiedBefore, 1786); assert.equal(exported.sourceFilesVerifiedAfter, 1786);
assert.deepEqual(await fingerprint(fixturePath), { path: exported.fixture.path, bytes: exported.fixture.bytes, sha256: exported.fixture.sha256 });
assert.deepEqual(await fingerprint(exported.exporter.path), exported.exporter);
const manifest = await read(resolve(ROOT, exported.sourceManifest.path));
assert.equal((await fingerprint(exported.sourceManifest.path)).sha256, exported.sourceManifest.sha256);
for (const record of Object.values(exported.importedOriginalModules)) {
  const source = record.path.split('/source/')[1]; assert.ok(source);
  assert.equal((await fingerprint(record.path)).sha256, record.sha256);
  assert.equal(manifest.files[source]?.sha256, record.sha256);
}
const actualInput = inputs.get(relative(ROOT, journalPath));
const chain = fixture.chains.find(item => item.inputJournal?.path === actualInput.path);
assert.ok(chain); assert.equal(chain.inputJournal.sha256, actualInput.sha256); assert.equal(chain.inputJournal.nativeResultsConsulted, false);
assert.equal(journal.schema, 'logos-engine.addressed-material-public-operations.v1');
assert.equal(common.schema, 'logos-engine.addressed-material-common-loop.v1');
assert.equal(common.status, 'passed', 'An incomplete common-loop attempt cannot become a successful original comparison');
assert.equal(chain.operations.length, journal.operations.length);
assert.equal(chain.initialState.model, null); assert.equal(chain.initialState.stock, null); assert.equal(chain.initialState.prior, null);
assert.deepEqual(chain.initialState.samples, []); assert.deepEqual(chain.initialState.passed, []);
check('cold_original_and_actual_public_journal_bound_to_immutable_sources', () => {
  assert.equal(exported.sourceInventoryUnchanged, true); assert.equal(chain.inputJournal.nativeResultsConsulted, false);
});
for (let index = 0; index < journal.operations.length; index++) {
  const actual = journal.operations[index], expected = chain.operations[index], prefix = `operation:${index}:${actual.method}`;
  check(prefix + ':same_actual_public_inputs', () => {
    assert.equal(expected.journalOperation, index); assert.equal(expected.capturedMethod, actual.method);
    const originalInput = Object.fromEntries(Object.entries(expected.input).filter(([key]) => key !== 'proposal'));
    assert.deepEqual(originalInput, actual.input);
    assert.equal(expected.useLatestSourceProposal, actual.useLatestSourceProposal ?? false);
  });
  check(prefix + ':original_result', () => {
    assert.deepEqual(actual.native.exception ?? null, expected.exception ?? null);
    if (!expected.exception) assert.deepEqual(actual.native.result, expected.result);
  });
  check(prefix + ':complete_source_state', () => assert.deepEqual(actual.native.state, expected.state));
  if (actual.method === 'bind' && !expected.exception) check(prefix + ':exact_source_point_bindings', () => {
    const points = value => value.steps.map(step => ({ action: step.action, locus_witness: step.locus_witness, point_binding: step.point_binding }));
    assert.deepEqual(points(actual.native.proposalAfterBind), points(expected.proposalAfterBind));
  });
}
const records = journal.operations.filter(op => op.method === 'record');
check('actual_return_population_and_unique_ownership', () => {
  assert.equal(records.length, common.returned); assert.equal(new Set(records.map(op => op.input.before.observation_ref)).size, records.length);
  assert.equal(records.filter(op => op.useLatestSourceProposal).length, common.ownReturns);
  assert.ok(common.ownReturns > 0); assert.ok(records.some(op => !op.useLatestSourceProposal));
});
check('actual_native_checkpoint_restoration_evidence', () => {
  assert.ok(common.restores.length > 0 && common.checkpoints.length > 0);
  for (const row of common.restores) assert.deepEqual(row.input, row.output);
  for (const row of common.checkpoints) assert.equal(row.state.schema, 'logos-engine.addressed-material.v1');
});
if (common.mode === 'navigation-no-effect') check('negative_actual_return_changes_the_following_owner_decision', () => {
  assert.equal(common.finalOwner.model, null);
  const lastRecord = records.at(-1); assert.equal(lastRecord.native.result.status, 'field_refuted');
  assert.equal(journal.operations.findLast(op => op.method === 'propose').native.result, null);
});
for (const record of [...inputs.values()]) assert.deepEqual(await fingerprint(record.path), record);
const result = { schema: 'logos-engine.addressed-material-common-original-comparison.v1', status: failures.length ? 'failed' : 'passed',
  recordedAt: new Date().toISOString(), chainId: common.chainId, mode: common.mode, nativeSourceDigest: common.nativeSource.digest,
  inputs: [...inputs.values()], inputsUnchanged: true, coldOriginal: true, nativeResultsUsedAsOracleInputs: false,
  operations: journal.operations.length, actualReturns: records.length, selectedReturns: common.ownReturns,
  passiveReturns: records.length - common.ownReturns, navigationReturns: common.ownPathReturns, stockReturns: common.stockReturns,
  checks: { total: checks.length, passed: checks.filter(c => c.passed).length, failed: failures.length, items: checks },
  qualification: 'The original starts cold and recomputes every proposal, guard, obligation, result and complete source state from the actual public method inputs. Selected proposal arguments come only from its own latest computation. Bind compares the exact action/locus/point bindings; additional common-caller proposal decorations remain in the native journal and are outside that component projection. Native checkpoint restoration is separately observed, not described as an original Python API. Synthetic common-loop success is not a game result, a latency measurement or whole-original-caller selection parity.' };
await writeFile(resolve(directory, 'original-comparison.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, checks: result.checks.total, failed: failures.length, operations: result.operations,
  actualReturns: result.actualReturns, selectedReturns: result.selectedReturns, stockReturns: result.stockReturns,
  failures: failures.map(row => ({ name: row.name, error: row.error.message.slice(0, 400) })) }));
if (failures.length) process.exitCode = 1;
