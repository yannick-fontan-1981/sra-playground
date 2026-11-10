#!/usr/bin/env node
/** A scoped behavior comparison of complete, preserved diagnostic receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const [beforeName, afterName, outputName] = process.argv.slice(2);
assert.equal(process.argv.length, 5, 'Usage: compare-native-profile-behavior.mjs BEFORE.json.gz AFTER.json.gz OUTPUT.json');
async function load(name) {
  const path = resolve(root, name), bytes = await readFile(path);
  assert.ok(!relative(root, path).startsWith('..'));
  const value = JSON.parse(name.endsWith('.gz') ? gunzipSync(bytes) : bytes);
  assert.equal(value.schema, 'logos-engine.native-loop-profile.v1');
  assert.equal(value.status, 'passed'); assert.equal(value.nativeSourceUnchanged, true);
  return { value, receipt: { path: relative(root, path), bytes: bytes.length, sha256: hash(bytes) } };
}
const before = await load(beforeName), after = await load(afterName);
const a = before.value, b = after.value;
const requestFields = ['operation', 'sequence', 'resultKind', 'actions', 'levelsCompleted', 'cycles', 'nodeCount',
  'graphRevision', 'acquiredTransitions', 'family', 'proposalKind'];
const projectRequests = value => value.requests.map(row => Object.fromEntries(requestFields.map(key => [key, row[key]])));
const checks = {
  sameGenerator: isDeepStrictEqual(a.generator, b.generator), sameInputs: isDeepStrictEqual(a.inputs, b.inputs),
  sameCase: isDeepStrictEqual(a.case, b.case), commandsExact: isDeepStrictEqual(a.commands, b.commands),
  retainedOwnerStatesExact: isDeepStrictEqual(a.final.ownerStates, b.final.ownerStates),
  selectedRequestFieldsExact: isDeepStrictEqual(projectRequests(a), projectRequests(b)),
  stageInvocationCountsExact: isDeepStrictEqual(Object.fromEntries(Object.entries(a.stages).map(([key, value]) => [key, value.count])),
    Object.fromEntries(Object.entries(b.stages).map(([key, value]) => [key, value.count]))),
};
const sourcePaths = [...new Set([...Object.keys(a.nativeSource.files), ...Object.keys(b.nativeSource.files)])].sort();
const report = { schema: 'logos-engine.native-profile-scoped-behavior.v1',
  status: Object.values(checks).every(Boolean) ? 'scoped_behavior_identical' : 'difference_requires_review',
  generatedAt: new Date().toISOString(), generator: { path: relative(root, fileURLToPath(import.meta.url)), sha256: hash(await readFile(fileURLToPath(import.meta.url))) },
  before: before.receipt, after: after.receipt, checks,
  counts: { actions: a.commands.length, requests: a.requests.length, retainedOwners: Object.keys(a.final.ownerStates).length },
  retainedOwnerIds: Object.keys(a.final.ownerStates), requestFields,
  changedNativeFiles: sourcePaths.filter(path => a.nativeSource.files[path] !== b.nativeSource.files[path]),
  strictFinalEquality: isDeepStrictEqual(a.final, b.final),
  qualification: 'All recorded commands, four retained owner states, the explicitly listed request fields and method invocation counts are compared exactly. These are actual instrumented public-return replays. Full receipts retain timings, source provenance and graph identities. This scoped result is not whole-graph or whole-snapshot identity, not an uninstrumented replay and not a cost-budget decision. No failed strict identity is converted to equality.' };
await writeFile(resolve(root, outputName), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, checks, counts: report.counts, strictFinalEquality: report.strictFinalEquality }));
if (report.status !== 'scoped_behavior_identical') process.exitCode = 1;
