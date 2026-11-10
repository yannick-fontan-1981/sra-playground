#!/usr/bin/env node
/** A separate additive-owner calculation. Never replaces the failed strict gate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonMetrics, distribution, readEvidence, workSignature } from '../../../scripts/compare-native-cost-cohorts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = resolve(ROOT, process.argv[2] ?? 'docs/migration/lot4a-evidence/performance-integrated');
assert.ok(relative(ROOT, DIR) && !relative(ROOT, DIR).startsWith('..'));
const sha = value => createHash('sha256').update(value).digest('hex');
const fingerprint = async path => {
  path = resolve(path);
  const bytes = await readFile(path), local = relative(ROOT, path);
  return { path: local.startsWith('..') ? path : local, bytes: bytes.length, sha256: sha(bytes) };
};
const read = async name => readEvidence(relative(ROOT, resolve(DIR, name)));
const output = resolve(DIR, 'owner-qualified-comparison.json');
try { await access(output); throw new Error('Exclusive output already exists'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
try { await access(resolve(DIR, 'combined-comparison.json')); throw new Error('Do not replace or coexist with a claimed strict success'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const names = ['comparison-policy.json', 'cases.json', 'declaration.json', 'window.json', 'owner-addition-declaration.json',
  'aggregation-failure-reproduced.json', 'owner-addition-qualification.json',
  'cohort1/baseline.json', 'cohort1/after.json', 'cohort1/comparison.json',
  'cohort2/baseline.json', 'cohort2/after.json', 'cohort2/comparison.json'];
const files = Object.fromEntries(await Promise.all(names.map(async name => [name, await read(name)])));
const extraInputsBefore = await Promise.all([resolve(DIR, 'owner-addition-protocol.md'), fileURLToPath(import.meta.url),
  resolve(ROOT, 'scripts/compare-native-cost-cohorts.mjs')].map(fingerprint));
const value = name => files[name].value;
const policy = value('comparison-policy.json'), manifest = value('cases.json'), declaration = value('declaration.json');
const window = value('window.json'), qualification = value('owner-addition-qualification.json');
const ownerDeclaration = value('owner-addition-declaration.json');
assert.equal(ownerDeclaration.status, 'declared_after_measurement_before_graph_capture_and_qualified_pooling');
assert.equal(ownerDeclaration.numericPolicyChanged, false);
assert.equal(ownerDeclaration.rawTimingModificationPermitted, false);
assert.equal(ownerDeclaration.qualifiedAggregateExists, false); assert.equal(ownerDeclaration.captureExists, false);
assert.ok(Date.parse(ownerDeclaration.recordedAt) > Date.parse(window.finishedAt));
assert.ok(ownerDeclaration.inputs.some(row => row.path === extraInputsBefore[0].path && row.sha256 === extraInputsBefore[0].sha256));
for (const record of ownerDeclaration.inputs) assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record);
assert.equal(qualification.schema, 'logos-engine.feedback-cost-owner-addition-qualification.v1');
assert.equal(qualification.status, 'qualified_owner_addition_verified');
assert.equal(qualification.workMetadataExact, false);
assert.equal(qualification.strictAggregationReclassified, false);
assert.deepEqual(qualification.nativeDigests, declaration.nativeDigests);
assert.deepEqual([...qualification.addedNodeIds].sort(), ['family_state:feedback_sequences',
  'family_activation:feedback_sequences', 'program:v6.feedback_sequences.choose'].sort());
assert.ok(qualification.checks.length > 0 && qualification.checks.every(row => row.passed === true));
assert.ok(qualification.checks.every(row => Number.isInteger(row.assertions) && row.assertions > 0));
assert.equal(qualification.checkedCount, qualification.checks.reduce((sum, row) => sum + row.assertions, 0));
assert.equal(qualification.inputsUnchanged, true);
assert.deepEqual(qualification.inputsAfter, qualification.inputs);
for (const record of qualification.inputs) assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record);
assert.equal(value('aggregation-failure-reproduced.json').exitCode, 1);
assert.equal(value('aggregation-failure-reproduced.json').outputExists, false);
assert.equal(value('aggregation-failure-reproduced.json').inputsUnchanged, true);
assert.equal(window.status, 'passed'); assert.equal(window.finalIntegrity, 'passed');
assert.deepEqual(window.plannedOrder, ['A1', 'B1', 'B2', 'A2']);
assert.deepEqual(window.executions.map(row => row.label), window.plannedOrder);
assert.equal(manifest.rounds, 4); assert.equal(policy.relativeBudget, 0.1);
assert.deepEqual(policy.unaffectedCaseIds, manifest.cases.map(row => row.id));
assert.equal(policy.stages.length, 8);
for (const record of [...declaration.officialTools, declaration.globalDecisionTool, declaration.globalCalculationTool])
  assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record, 'Predeclared official tool changed');

const workDifferences = [], unchangedWithinVersion = new Map(), cohorts = [];
function compareWork(a, b, trial, path = '$') {
  if (Object.is(a, b)) return;
  if (Array.isArray(a) || Array.isArray(b)) {
    assert.ok(Array.isArray(a) && Array.isArray(b)); assert.equal(a.length, b.length, path);
    a.forEach((item, index) => compareWork(item, b[index], trial, `${path}[${index}]`)); return;
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), path);
    for (const key of Object.keys(a)) compareWork(a[key], b[key], trial, `${path}.${key}`);
    return;
  }
  const nodes = /^\$\.observations\[\d+\]\.nodeCount$/.test(path)
    || /^\$\.inspection\[\d+\]\.graphNodes$/.test(path) || path === '$.final.nodeCount';
  const revisions = path === '$.final.graphRevision';
  assert.ok(nodes || revisions, `Unqualified work difference: ${path}`);
  assert.ok(Number.isInteger(a) && Number.isInteger(b));
  assert.equal(b - a, nodes ? 3 : 3 + trial.cycles, `Unproved structural delta at ${path}`);
  workDifferences.push({ ...trial.identity, path, baseline: a, after: b, delta: b - a });
}
const firstReport = value('cohort1/baseline.json');
for (const n of [1, 2]) {
  const before = value(`cohort${n}/baseline.json`), after = value(`cohort${n}/after.json`), official = value(`cohort${n}/comparison.json`);
  for (const [side, report] of [['baseline', before], ['after', after]]) {
    assert.equal(report.schema, 'logos-engine.native-loop-costs.v1'); assert.equal(report.status, 'passed');
    assert.equal(report.nativeSourceUnchanged, true); assert.deepEqual(report.manifest, manifest);
    assert.deepEqual(report.generator, firstReport.generator); assert.deepEqual(report.environment, firstReport.environment);
    assert.deepEqual(report.inputs, firstReport.inputs);
    assert.equal(Object.keys(report.nativeSource.files).length, report.nativeSource.fileCount);
    assert.equal(sha(JSON.stringify(report.nativeSource.files)), report.nativeSource.digest);
    assert.equal(report.nativeSource.digest, declaration.nativeDigests[side === 'after' ? 'candidate' : 'baseline']);
    for (const record of [report.generator, ...report.inputs]) assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record);
    assert.deepEqual(report.cases.map(row => row.id), manifest.cases.map(row => row.id));
    for (const item of report.cases) {
      assert.equal(item.trials.filter(t => t.warmup).length, 1);
      assert.deepEqual(item.trials.filter(t => !t.warmup).map(t => t.round), [1, 2, 3, 4]);
      for (const trial of item.trials) {
        const key = `${side}:${item.id}:${trial.warmup}`;
        const actual = workSignature(trial);
        if (unchangedWithinVersion.has(key)) assert.deepEqual(actual, unchangedWithinVersion.get(key));
        else unchangedWithinVersion.set(key, actual);
        assert.equal(trial.final.actions, trial.actions); assert.equal(trial.final.acquiredTransitions, trial.actions);
        assert.ok(trial.pauses.every(pause => pause.acknowledgedPaused));
      }
    }
  }
  assert.equal(official.schema, 'logos-engine.native-loop-cost-comparison.v1');
  assert.ok(['passed', 'budget_review_required'].includes(official.status));
  assert.deepEqual(official.inputs, { policy: files['comparison-policy.json'].fingerprint,
    baseline: files[`cohort${n}/baseline.json`].fingerprint, after: files[`cohort${n}/after.json`].fingerprint });
  const expectedGenerator = await fingerprint(resolve(ROOT, official.generator.path));
  assert.equal(expectedGenerator.sha256, official.generator.sha256);
  assert.equal(official.harnessInputsMatched, true); assert.equal(official.environmentMatched, true); assert.equal(official.replayWorkMatched, true);
  const unresolved = [];
  for (const item of before.cases) {
    const other = after.cases.find(row => row.id === item.id);
    assert.equal(item.trials.length, other.trials.length);
    item.trials.forEach((trial, index) => compareWork(workSignature(trial), workSignature(other.trials[index]), {
      cycles: trial.cycles, identity: { cohort: n, case: item.id, round: trial.round, warmup: trial.warmup } }));
    const a = item.trials.filter(t => !t.warmup), b = other.trials.filter(t => !t.warmup);
    const metrics = comparisonMetrics(a, b, policy.stages, policy.relativeBudget, true);
    const recorded = official.comparisons.find(row => row.case === item.id);
    assert.deepEqual(metrics, recorded.metrics, 'Original phase results must reproduce exactly');
    assert.deepEqual(recorded.sessionElapsed, { before: item.sessionElapsed, after: other.sessionElapsed,
      medianRelativeIncrease: other.sessionElapsed.medianMs / item.sessionElapsed.medianMs - 1 });
    unresolved.push(...metrics.filter(m => m.result !== 'within_observed_budget').map(m => ({
      case: item.id, stage: m.stage, result: m.result, medianRelativeIncrease: m.medianRelativeIncrease })));
  }
  assert.deepEqual(official.unresolved, unresolved);
  assert.equal(official.status, unresolved.length ? 'budget_review_required' : 'passed');
  cohorts.push({ id: `cohort_${n}`, baseline: files[`cohort${n}/baseline.json`].fingerprint,
    after: files[`cohort${n}/after.json`].fingerprint, originalComparison: files[`cohort${n}/comparison.json`].fingerprint,
    validation: { budgetMetricsExactlyReproduced: true, originalStatus: official.status, originalUnresolved: unresolved } });
}
assert.equal(workDifferences.length, 432, 'Every measured structural difference must remain enumerated');
const comparisons = [], ledger = [];
for (const item of manifest.cases) {
  const sides = {};
  for (const side of ['baseline', 'after']) {
    const trials = [1, 2].flatMap(n => value(`cohort${n}/${side}.json`).cases.find(c => c.id === item.id).trials
      .filter(t => !t.warmup).map(t => ({ n, t })));
    assert.equal(trials.length, 8);
    sides[side] = trials.map(row => row.t);
    for (const { n, t } of trials) ledger.push({ cohort: `cohort_${n}`, side, case: item.id, round: t.round,
      startedAt: t.startedAt, finishedAt: t.finishedAt, actions: t.actions, levelsCompleted: t.levelsCompleted,
      sampleCount: t.samples.length, requestCount: t.requests.length });
  }
  comparisons.push({ case: item.id, unaffected: true, measuredSessionsPerVersion: 8,
    actionsPerSession: item.actions, levelsCompleted: sides.baseline[0].levelsCompleted,
    cohortRounds: [{ cohort: 'cohort_1', rounds: 4 }, { cohort: 'cohort_2', rounds: 4 }],
    metrics: comparisonMetrics(sides.baseline, sides.after, policy.stages, policy.relativeBudget, true) });
}
assert.equal(ledger.length, 32); assert.equal(new Set(ledger.map(row => `${row.startedAt}|${row.finishedAt}`)).size, 32);
assert.equal(ledger.reduce((sum, row) => sum + row.actions, 0), 400);
const unresolved = comparisons.flatMap(row => row.metrics.filter(m => m.result !== 'within_observed_budget').map(m => ({
  case: row.case, stage: m.stage, result: m.result, medianRelativeIncrease: m.medianRelativeIncrease })));
const inputsBefore = [...Object.values(files).map(row => row.fingerprint), ...extraInputsBefore];
for (const record of inputsBefore) assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record);
for (const record of [...declaration.officialTools, declaration.globalDecisionTool, declaration.globalCalculationTool])
  assert.deepEqual(await fingerprint(resolve(ROOT, record.path)), record, 'Official tool changed during qualified calculation');
const result = {
  schema: 'logos-engine.native-cost-owner-qualified-comparison.v1', status: 'qualified_diagnostic_calculation',
  recordedAt: new Date().toISOString(), budgetStatus: unresolved.length ? 'budget_review_required' : 'passed',
  generator: await fingerprint(fileURLToPath(import.meta.url)),
  calculationHelper: await fingerprint(resolve(ROOT, 'scripts/compare-native-cost-cohorts.mjs')),
  inputs: { policy: files['comparison-policy.json'].fingerprint, cohorts, retained: inputsBefore },
  ownerQualification: files['owner-addition-qualification.json'].fingerprint,
  originalStrictAggregation: { status: 'failed', receipt: files['aggregation-failure-reproduced.json'].fingerprint,
    unchanged: true, originalOutputAbsent: true },
  sources: Object.fromEntries([['baseline', firstReport], ['after', value('cohort1/after.json')]].map(([side, report]) =>
    [side, { digest: report.nativeSource.digest, fileCount: report.nativeSource.fileCount }])),
  environment: firstReport.environment, timingHarness: firstReport.generator, relativeBudget: policy.relativeBudget,
  budgetMetricCount: 16, withinObservedBudget: 16 - unresolved.length, comparisons, unresolved,
  includedMeasuredSessions: ledger, qualifiedWorkDifferences: workDifferences,
  method: { workMetadataExactAcrossAllSessions: false, workMetadataExactWithinEachVersion: true,
    allOtherMeasuredWorkFieldsExact: true, qualificationDeclaredAfterWindow: true, originalStrictFailurePreserved: true,
    excludedMeasuredSessions: 0, excludedOutliers: 0, excludedWarmupsPerCaseAndVersion: 2,
    selectedCohort: null, noiseAllowanceAdded: false, timingsModified: false, addedOwnerCostSubtracted: false,
    originalBudgetMetricsExactlyReproduced: true, p95MinimumSamples: 20,
    combine: 'All original measured sessions pooled before calculation; explicit additional-owner structural qualification only.' },
  qualification: 'Separate post-measurement work qualification, never a passed strict aggregation. Native source, harness, samples, thresholds and all unfavorable results are unchanged. All measured work fields other than the four explicitly attributed graph-count paths are exact. Separate graph replays corroborate the added owner; they do not retrospectively prove uncaptured leaves of measured sessions. Every cost of the additional owner remains in the original durations. No complete private-graph identity, live-game latency or long-session stability is claimed.'
};
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), budgetStatus: result.budgetStatus,
  metrics: 16, withinObservedBudget: result.withinObservedBudget, sessions: ledger.length, actions: 400,
  qualifiedDifferences: workDifferences.length, strictAggregationStatus: 'failed', unresolved }));
