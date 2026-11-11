/** Read-only comparison of an incomplete public trajectory, preserving failure.
 * This does not execute an agent and cannot validate common-loop completion. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
const ROOT = process.cwd(), [directoryArgument, ...extra] = process.argv.slice(2);
assert.ok(directoryArgument && !extra.length);
const directory = resolve(ROOT, directoryArgument), inputs = [], raw = new Map();
const sha = data => createHash('sha256').update(data).digest('hex');
function read(name) {
  const path = resolve(directory, name), bytes = readFileSync(path);
  raw.set(path, bytes); inputs.push({ path: relative(ROOT, path), bytes: bytes.length, sha256: sha(bytes) });
  return JSON.parse(name.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
}
const journal = read('actual-operations.json'), original = read('original-replay.json.gz'),
  exported = read('original-export.json'), common = read('common-loop.json.gz');
assert.equal(common.status, 'failed', 'This diagnostic explicitly retains an incomplete common attempt');
assert.equal(original.mode, 'captured-public-journals'); assert.equal(original.chains.length, 1);
assert.equal(exported.status, 'passed'); assert.equal(exported.sourceInventoryUnchanged, true);
assert.equal(exported.sourceInventorySha256Before, exported.sourceInventorySha256After);
const chain = original.chains[0], actualJournal = inputs.find(row => row.path.endsWith('/actual-operations.json'));
assert.equal(chain.inputJournal.path, actualJournal.path); assert.equal(chain.inputJournal.sha256, actualJournal.sha256);
assert.equal(chain.inputJournal.nativeResultsConsulted, false);
assert.equal(exported.fixture.sha256, inputs.find(row => row.path.endsWith('/original-replay.json.gz')).sha256);
assert.equal(chain.operations.length, journal.operations.length);
const checks = [], failures = [];
function check(name, actual, expected) {
  try { assert.deepEqual(actual, expected); checks.push({ name, passed: true }); }
  catch (error) { const failure = { name, passed: false, message: error.message }; checks.push(failure); failures.push(failure); }
}
for (const [index, actual] of journal.operations.entries()) {
  const expected = chain.operations[index], prefix = `${index}:${actual.method}`;
  check(prefix + ':method', actual.method, expected.capturedMethod);
  check(prefix + ':public-inputs', actual.input, Object.fromEntries(Object.entries(expected.input).filter(([key]) => key !== 'proposal')));
  check(prefix + ':proposal-source', actual.useLatestSourceProposal ?? false, expected.useLatestSourceProposal);
  check(prefix + ':exception', actual.native.exception ?? null, expected.exception ?? null);
  if (!expected.exception) check(prefix + ':result', actual.native.result, expected.result);
  check(prefix + ':complete-source-state', actual.native.state, expected.state);
  if (actual.method === 'bind' && !expected.exception) {
    const project = value => value.steps.map(step => ({ action: step.action, locus_witness: step.locus_witness, point_binding: step.point_binding }));
    check(prefix + ':point-bindings', project(actual.native.proposalAfterBind), project(expected.proposalAfterBind));
  }
}
for (const [path, bytes] of raw) assert.equal(sha(readFileSync(path)), sha(bytes));
const result = { schema: 'logos-engine.addressed-material-partial-public-replay.v1',
  status: failures.length ? 'partial_source_parity_failed' : 'partial_source_parity_passed',
  commonLoopStatus: common.status, commonLoopFailures: common.checks.failures, completionClaimed: false,
  nativeResultsUsedAsOracleInputs: false, inputs, inputsUnchanged: true,
  operations: journal.operations.length, actualReturns: common.returned, selectedReturns: common.ownReturns,
  stockReturns: common.stockReturns, nextReason: common.next?.reason ?? null,
  checks: { total: checks.length, passed: checks.length - failures.length, failed: failures.length, items: checks },
  qualification: 'Only the actual partial public trajectory is compared with a separate cold original replay. The failed complete-caller attempt remains failed; no proposal, obligation, prior, response or state is changed to bypass its refusal.' };
writeFileSync(resolve(directory, 'partial-original-comparison.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, commonLoopStatus: common.status, checks: checks.length, failures: failures.map(row => ({ name: row.name, message: row.message.slice(0, 400) })), operations: result.operations, actualReturns: result.actualReturns, stockReturns: result.stockReturns, nextReason: result.nextReason }));
if (failures.length) process.exitCode = 1;
