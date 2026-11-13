#!/usr/bin/env node
/** Scoped behavior and separately retained work diagnostics; never a cost-budget decision. */
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
assert.equal(process.argv.length, 5, 'Usage: compare-native-restoration-paths.mjs BEFORE.json.gz AFTER.json.gz OUTPUT.json');
const confined = name => {
  const path = resolve(root, name), local = relative(root, path);
  assert.ok(local && !local.startsWith('..'), 'Inputs and output must be within this checkout');
  return path;
};
const ownerIds = ['family_state:public_occurrence_recall', 'family_state:morphology', 'caller:counters', 'caller:lifecycle'];
const requestFields = ['operation', 'sequence', 'resultKind', 'actions', 'levelsCompleted', 'cycles', 'nodeCount',
  'graphRevision', 'acquiredTransitions', 'family', 'proposalKind'];
const timingFields = ['totalMs', 'medianMs', 'minMs', 'maxMs'];
async function load(name) {
  const path = confined(name), bytes = await readFile(path);
  const value = JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes);
  assert.equal(value.schema, 'logos-engine.native-restoration-profile.v2');
  assert.equal(value.status, 'passed');
  assert.equal(value.nativeSourceUnchanged, true);
  assert.deepEqual(Object.keys(value.final.ownerStates).sort(), [...ownerIds].sort(), 'Exactly the four declared owner states are required');
  assert.ok(Array.isArray(value.commands) && Array.isArray(value.requests) && Array.isArray(value.samples));
  for (const request of value.requests) {
    for (const key of requestFields) assert.ok(Object.hasOwn(request, key), `Missing request field ${key}`);
    assert.ok(Number.isFinite(request.serviceMs) && request.serviceMs >= 0);
  }
  for (const sample of value.samples) {
    assert.equal(sample.failed, false);
    assert.ok(Number.isFinite(sample.elapsedMs) && sample.elapsedMs >= 0);
    assert.equal(typeof sample.stage, 'string');
    assert.equal(typeof sample.method, 'string');
  }
  for (const group of ['stages', 'families', 'knowledgeReads']) {
    assert.ok(value[group] && typeof value[group] === 'object' && !Array.isArray(value[group]));
    for (const entry of Object.values(value[group])) {
      assert.ok(Number.isInteger(entry.count) && entry.count >= 0);
      for (const key of timingFields) assert.ok(entry[key] === null || Number.isFinite(entry[key]));
    }
  }
  assert.ok(value.witnessResults && typeof value.witnessResults === 'object');
  assert.ok(Number.isFinite(value.replayElapsedMs) && value.replayElapsedMs >= 0);
  return { value, receipt: { path: relative(root, path), bytes: bytes.length, sha256: hash(bytes) } };
}
const before = await load(beforeName), after = await load(afterName);
const a = before.value, b = after.value;
const projectRequests = value => value.requests.map(row => Object.fromEntries(requestFields.map(key => [key, row[key]])));
const checks = {
  sameGenerator: isDeepStrictEqual(a.generator, b.generator),
  sameInputs: isDeepStrictEqual(a.inputs, b.inputs),
  sameCase: isDeepStrictEqual(a.case, b.case),
  commandsExact: isDeepStrictEqual(a.commands, b.commands),
  retainedOwnerStatesExact: isDeepStrictEqual(a.final.ownerStates, b.final.ownerStates),
  selectedRequestFieldsExact: isDeepStrictEqual(projectRequests(a), projectRequests(b)),
};
const keysOfBoth = (left, right) => [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
const delta = (left, right) => typeof left === 'number' && typeof right === 'number' ? right - left : null;
const timing = (left, right) => ({ beforeMs: left ?? null, afterMs: right ?? null,
  deltaMs: delta(left, right), relativeChange: typeof left === 'number' && left > 0 && typeof right === 'number' ? (right - left) / left : null });
function compareDistributions(group) {
  return keysOfBoth(a[group], b[group]).map(name => {
    const left = a[group][name], right = b[group][name];
    return { name, before: left ?? null, after: right ?? null,
      beforeCount: left?.count ?? 0, afterCount: right?.count ?? 0,
      countDelta: (right?.count ?? 0) - (left?.count ?? 0),
      countExact: left !== undefined && right !== undefined && left.count === right.count,
      timings: Object.fromEntries(timingFields.map(field => [field, timing(left?.[field], right?.[field])])) };
  });
}
// Count each actual observed method in its operation, including families whose
// counts would otherwise be hidden by a common family.restore/nativeState stage.
function methodCounts(value) {
  const groups = new Map();
  for (const sample of value.samples) {
    const identity = { stage: sample.stage, method: sample.method, family: sample.family ?? null,
      operation: sample.operation ?? null };
    const key = JSON.stringify(identity);
    if (!groups.has(key)) groups.set(key, { ...identity, count: 0, totalMs: 0 });
    const entry = groups.get(key);
    entry.count++;
    entry.totalMs += sample.elapsedMs;
  }
  return Object.fromEntries([...groups].sort(([left], [right]) => left.localeCompare(right)));
}
const methodA = methodCounts(a), methodB = methodCounts(b);
const methodComparisons = keysOfBoth(methodA, methodB).map(key => {
  const left = methodA[key], right = methodB[key], identity = left ?? right;
  return { stage: identity.stage, method: identity.method, family: identity.family, operation: identity.operation,
    beforeCount: left?.count ?? 0, afterCount: right?.count ?? 0,
    countDelta: (right?.count ?? 0) - (left?.count ?? 0),
    countExact: (left?.count ?? 0) === (right?.count ?? 0),
    total: timing(left?.totalMs, right?.totalMs) };
});
const distributions = Object.fromEntries(['stages', 'families', 'knowledgeReads'].map(group => [group, compareDistributions(group)]));
const countDifferences = Object.entries(distributions).flatMap(([group, rows]) => rows.filter(row => !row.countExact)
  .map(row => ({ group, name: row.name, beforeCount: row.beforeCount, afterCount: row.afterCount,
    countDelta: row.countDelta, beforePresent: row.before !== null, afterPresent: row.after !== null })));
const witnessComparisons = keysOfBoth(a.witnessResults, b.witnessResults).map(name => {
  const left = a.witnessResults[name], right = b.witnessResults[name];
  return { name, before: left ?? null, after: right ?? null, exact: isDeepStrictEqual(left, right),
    deltas: Object.fromEntries(keysOfBoth(left ?? {}, right ?? {}).map(key => [key, delta(left?.[key], right?.[key])])) };
});
const requestTimings = Array.from({ length: Math.max(a.requests.length, b.requests.length) }, (_, index) => {
  const left = a.requests[index], right = b.requests[index];
  return { index, beforeRequest: left ? { operation: left.operation, sequence: left.sequence } : null,
    afterRequest: right ? { operation: right.operation, sequence: right.sequence } : null,
    service: timing(left?.serviceMs, right?.serviceMs) };
});
const sourcePaths = keysOfBoth(a.nativeSource.files, b.nativeSource.files);
const generatorBytes = await readFile(fileURLToPath(import.meta.url));
const report = {
  schema: 'logos-engine.native-restoration-scoped-behavior.v1',
  status: Object.values(checks).every(Boolean) ? 'scoped_behavior_identical' : 'difference_requires_review',
  generatedAt: new Date().toISOString(),
  generator: { path: relative(root, fileURLToPath(import.meta.url)), bytes: generatorBytes.length, sha256: hash(generatorBytes) },
  before: before.receipt, after: after.receipt, checks,
  counts: { before: { actions: a.commands.length, requests: a.requests.length, retainedOwners: Object.keys(a.final.ownerStates).length, samples: a.samples.length },
    after: { actions: b.commands.length, requests: b.requests.length, retainedOwners: Object.keys(b.final.ownerStates).length, samples: b.samples.length } },
  retainedOwnerIds: ownerIds, requestFields,
  nativeSources: { before: { digest: a.nativeSource.digest, fileCount: a.nativeSource.fileCount },
    after: { digest: b.nativeSource.digest, fileCount: b.nativeSource.fileCount } },
  changedNativeFiles: sourcePaths.filter(path => a.nativeSource.files[path] !== b.nativeSource.files[path]),
  environments: { before: a.environment, after: b.environment, exact: isDeepStrictEqual(a.environment, b.environment) },
  strictFinalEquality: isDeepStrictEqual(a.final, b.final),
  workDiagnostics: {
    affectsBehaviorStatus: false,
    aggregateInvocationCountsExact: countDifferences.length === 0,
    countDifferences,
    methodInvocationCountsExact: methodComparisons.every(row => row.countExact),
    methodCountDifferences: methodComparisons.filter(row => !row.countExact),
    methodComparisons,
    witnessResultsExact: witnessComparisons.every(row => row.exact),
    witnessComparisons,
    distributions,
    replayElapsed: timing(a.replayElapsedMs, b.replayElapsedMs),
    requestTimings,
  },
  qualifications: [
    'Only the six named exact behavior checks determine status and exit code. Method counts, witness outcomes, durations, environment differences and strictFinalEquality are retained separately and cannot turn a failed behavior check into success.',
    'The four declared owner states and explicitly listed request fields are the entire retained equality scope. The full final objects are also compared strictly and the resulting boolean is preserved. Scoped behavior identity is not whole-graph or whole-snapshot identity.',
    'All before/after distribution groups, observed methods by family and operation, witness results and request timings are retained, including added/removed groups and unfavorable results. Complete individual samples and provenance remain in the fingerprinted input receipts. Counts are allowed to differ because the correction can avoid work; each difference still requires interpretation.',
    'The profiler leaves source state/callerContextState projections intact but instruments other methods and prototypes. This is a single-session instrumented normal-projection diagnostic, not an uninstrumented replay, not an exclusive-time measurement, and not a cost-budget decision. Nested timings must not be added as exclusive time.',
    'Timing ratios are descriptive only, not p95, confidence intervals, causal proof, a memory-stability claim or acceptance of the official +10% budget. No failed strict identity or budget outcome is converted to equality or success.',
  ],
};
await writeFile(confined(outputName), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, checks, counts: report.counts, strictFinalEquality: report.strictFinalEquality,
  aggregateCountDifferences: countDifferences.length, methodCountDifferences: report.workDiagnostics.methodCountDifferences.length,
  witnessResultsExact: report.workDiagnostics.witnessResultsExact }));
if (report.status !== 'scoped_behavior_identical') process.exitCode = 1;
