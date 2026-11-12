#!/usr/bin/env node
/** Lot8B supplement. Reads retained reports; runs no native code or measurement.
 * CLI: node analyze.mjs CONTRACT STRICT_ATTEMPT_RECEIPT NEW_OUTPUT
 * Historical arithmetic/workSignature are imported unchanged. Full raw trial
 * metadata is compared; exactly four predeclared structural paths may differ.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat, writeFile, access } from 'node:fs/promises';
import { dirname, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { distribution, comparisonMetrics, workSignature } from '../../../../../scripts/compare-native-cost-cohorts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const SELF = relative(ROOT, fileURLToPath(import.meta.url));
const ORDER = ['A1', 'B1', 'B2', 'A2'];
const PLAN = [['A1', 'baseline', 'cohort1/baseline.json'], ['B1', 'candidate', 'cohort1/after.json'],
  ['B2', 'candidate', 'cohort2/after.json'], ['A2', 'baseline', 'cohort2/baseline.json']];
const STAGES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
  'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration'];
const OMIT = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const copied = value => JSON.parse(JSON.stringify(value));
const instant = value => { assert.equal(typeof value, 'string'); assert.match(value, /(?:Z|[+-]\d\d:\d\d)$/);
  const n = Date.parse(value); assert.ok(Number.isFinite(n), 'Invalid timestamp'); return n; };
const touched = new Map();
let baselineRoot;

async function fp(name) {
  const path = resolve(ROOT, name), canonical = await realpath(path);
  assert.equal(path, canonical, 'Canonical input required');
  assert.ok(path.startsWith(ROOT + '/') || baselineRoot && path.startsWith(baselineRoot + '/'), 'Input outside selected checkouts');
  assert.ok((await stat(path)).isFile());
  const hash = createHash('sha256'); let bytes = 0;
  for await (const block of createReadStream(path)) { hash.update(block); bytes += block.length; }
  const label = path.startsWith(ROOT + '/') ? relative(ROOT, path) : path;
  const record = { path: label, bytes, sha256: hash.digest('hex') };
  if (touched.has(label)) assert.deepEqual(record, touched.get(label), 'Input changed during analysis');
  touched.set(label, record); return record;
}
async function verify(record) { assert.deepEqual(await fp(record.path), record, 'Pinned input changed: ' + record.path); }
async function read(name) {
  const record = await fp(name), bytes = await readFile(resolve(ROOT, name));
  assert.equal(sha(bytes), record.sha256, 'Input changed during read');
  return { value: JSON.parse(String(name).endsWith('.gz') ? gunzipSync(bytes) : bytes), record };
}
function shape(trial) {
  return { actions: trial.actions, cycles: trial.cycles, levelsCompleted: trial.levelsCompleted,
    requests: trial.requests.map(row => ({ type: row.type, sequence: row.sequence, kind: row.kind, actions: row.actions })),
    observations: trial.observations, inspection: trial.inspection.map(row => ({ graphNodes: row.graphNodes })), final: trial.final };
}
function normalizedWork(trial) {
  const result = copied(workSignature(trial));
  for (const row of result.observations) row.nodeCount = 0;
  for (const row of result.inspection) row.graphNodes = 0;
  result.final.nodeCount = 0; result.final.graphRevision = 0;
  return result;
}
function strictBudget(before, after) {
  function rational(n) {
    assert.ok(Number.isFinite(n) && n > 0, 'Positive finite global median required');
    const [mantissa, exponent = '0'] = String(n).toLowerCase().split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    let numerator = BigInt(whole + fraction), denominator = 1n;
    const scale = fraction.length - Number(exponent);
    if (scale >= 0) denominator = 10n ** BigInt(scale); else numerator *= 10n ** BigInt(-scale);
    return [numerator, denominator];
  }
  const [a, ad] = rational(before), [b, bd] = rational(after);
  return b * ad * 10n < a * bd * 11n;
}
function structuralRows(form, context) {
  const rows = [];
  const add = (path, a, b) => {
    assert.ok(Number.isSafeInteger(a) && a >= 0 && Number.isSafeInteger(b) && b >= 0);
    rows.push({ ...context, path, before: a, after: b, delta: b - a });
  };
  form.baseline.observations.forEach((row, i) => add(`observations[${i}].nodeCount`, row.nodeCount, form.candidate.observations[i].nodeCount));
  form.baseline.inspection.forEach((row, i) => add(`inspection[${i}].graphNodes`, row.graphNodes, form.candidate.inspection[i].graphNodes));
  for (const key of ['nodeCount', 'graphRevision']) add('final.' + key, form.baseline.final[key], form.candidate.final[key]);
  return rows;
}

const [contractArg, strictArg, outputArg] = process.argv.slice(2);
assert.ok(contractArg && strictArg && outputArg && process.argv.length === 5, 'Usage: analyze.mjs CONTRACT STRICT_ATTEMPT NEW_OUTPUT');
const output = resolve(ROOT, outputArg);
assert.ok(output.startsWith(ROOT + '/docs/migration/lot8b-evidence/'));
try { await access(output); assert.fail('Output already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const contractFile = await read(contractArg), contract = contractFile.value;
assert.equal(contract.schema, 'logos-engine.lot8b-final-cost-contract.v1');
assert.equal(contract.status, 'declared_before_official_window');
baselineRoot = await realpath(contract.baseline.checkout);
assert.equal(await realpath(contract.candidate.checkout), ROOT);
assert.deepEqual(contract.measurement.order, ORDER);
assert.equal(contract.measurement.rounds, 4);
assert.equal(contract.measurement.measuredSessions, 32); assert.equal(contract.measurement.measuredActions, 400);
assert.equal(contract.measurement.warmupSessions, 8); assert.equal(contract.measurement.warmupActions, 24);
assert.equal(contract.measurement.excludedMeasuredSessions, 0); assert.equal(contract.measurement.excludedOutliers, 0);
assert.deepEqual(contract.structuralRule.allowedPaths,
  ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision']);
assert.equal(contract.globalRule.comparison, 'strictly_less_than'); assert.equal(contract.globalRule.relativeIncreaseLimit, 0.1);
assert.equal(contract.globalRule.allCasesMustPass, true); assert.equal(contract.globalRule.crossCaseCompensation, false);
assert.equal(contract.globalRule.phaseOverrunsMayBeAccepted, true);
assert.deepEqual(contract.supplementaryTools.analyzer, await fp(SELF));
for (const record of contract.inputFingerprints) await verify(record);
const perf = contract.performanceDirectory;
assert.ok(resolve(ROOT, perf).startsWith(ROOT + '/docs/migration/lot8b-evidence/'));
const cases = (await read(contract.cases.path)).value, policy = (await read(contract.comparisonPolicy.path)).value;
assert.deepEqual(policy.stages, STAGES); assert.deepEqual(policy.unaffectedCaseIds, ['STCK', 'SMLP']); assert.equal(policy.relativeBudget, 0.1);
assert.equal(cases.rounds, 4); assert.deepEqual(cases.cases.map(row => [row.id, row.actions, row.warmupActions]), [['STCK', 10, 3], ['SMLP', 15, 3]]);
const formsFile = await read(contract.expectedForms.path), forms = formsFile.value.forms;
assert.deepEqual(formsFile.value.nativeDigests, contract.nativeDigests);
assert.deepEqual(forms.map(row => [row.case, row.form]), [['STCK', 'warmup'], ['STCK', 'measured'], ['SMLP', 'warmup'], ['SMLP', 'measured']]);
const manifests = {};
for (const role of ['baseline', 'candidate']) manifests[role] = (await read(contract[role].manifest.path)).value;
const windowFile = await read(perf + '/window.json'), window = windowFile.value;
assert.equal(window.status, 'passed'); assert.equal(window.finalIntegrity, 'passed'); assert.deepEqual(window.plannedOrder, ORDER);
assert.deepEqual(window.executions.map(row => row.label), ORDER);
assert.deepEqual(window.nativeDigests, { baseline: contract.nativeDigests.baseline, correction: contract.nativeDigests.candidate });
assert.equal(window.baselineCheckout, baselineRoot); assert.equal(window.correctionCheckout, ROOT);
assert.ok(instant(contract.recordedAt) < instant(window.startedAt));
const runner = contract.historicalTools.find(row => row.path === 'scripts/measure-native-loop-costs.mjs');
assert.equal(window.runnerSha256, runner.sha256);
for (const row of window.inputs) assert.equal((await fp(row.path)).sha256, row.sha256);
let lastFinish = instant(window.startedAt), environment, measuredActions = 0, warmupActions = 0;
const ledger = [], reports = {}, signatures = new Map(), normalized = new Map();
for (let i = 0; i < PLAN.length; i++) {
  const [label, role, name] = PLAN[i], execution = window.executions[i], reportFile = await read(perf + '/' + name), report = reportFile.value;
  reports[label] = reportFile;
  assert.equal(execution.status, 'passed'); assert.equal(execution.exitCode, 0);
  assert.equal(execution.checkout, contract[role].checkout); assert.equal(execution.nativeDigest, contract.nativeDigests[role]);
  assert.deepEqual(execution.command, ['node', runner.path, perf + '/cases.json', perf + '/' + name]);
  assert.equal(execution.reportSha256, reportFile.record.sha256);
  assert.equal((await fp(execution.log)).sha256, execution.logSha256);
  assert.ok(instant(execution.startedAt) >= lastFinish); lastFinish = instant(execution.finishedAt);
  assert.ok(lastFinish >= instant(execution.startedAt));
  assert.equal(report.schema, 'logos-engine.native-loop-costs.v1'); assert.equal(report.status, 'passed');
  assert.equal(report.nativeSourceUnchanged, true); assert.deepEqual(report.nativeSource, manifests[role]);
  assert.deepEqual(report.generator, runner); assert.deepEqual(report.manifest, cases);
  assert.equal(report.checkout, contract[role].checkout);
  if (role === 'baseline') assert.equal(report.gitHead, contract.baseline.sourceCommit);
  else execFileSync('git', ['merge-base', '--is-ancestor', contract.candidate.sourceCommit, report.gitHead], { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
  if (environment) assert.deepEqual(report.environment, environment); else environment = report.environment;
  assert.deepEqual(report.cases.map(row => row.id), ['STCK', 'SMLP']);
  for (const record of report.inputs) await verify(record);
  assert.deepEqual(report.inputs, reports.A1.value.inputs);
  for (const item of report.cases) {
    assert.equal(item.trials.length, 5); assert.deepEqual(item.trials.map(row => [row.round, row.warmup]), [[0, true], [1, false], [2, false], [3, false], [4, false]]);
    const measured = item.trials.filter(row => !row.warmup);
    assert.deepEqual(OMIT(item.sessionElapsed, ['tailQualification']), distribution(measured.map(row => row.replayElapsedMs)));
    for (const trial of item.trials) {
      assert.equal(trial.case, item.id); assert.ok(Number.isFinite(trial.replayElapsedMs) && trial.replayElapsedMs > 0);
      assert.ok(instant(trial.startedAt) >= instant(execution.startedAt) && instant(trial.finishedAt) >= instant(trial.startedAt)
        && instant(trial.finishedAt) <= instant(execution.finishedAt));
      const formName = trial.warmup ? 'warmup' : 'measured', form = forms.find(f => f.case === item.id && f.form === formName);
      assert.deepEqual(shape(trial), form[role], `Actual final-source form differs: ${label}/${item.id}/${trial.round}`);
      assert.equal(trial.final.implementation, 'logos-engine.typescript.v6.native-migration/' + contract[role].nativeVersion);
      assert.equal(trial.final.actions, trial.actions); assert.equal(trial.final.acquiredTransitions, trial.actions);
      assert.equal(trial.requests.filter(row => row.type === 'init').length, 1);
      assert.equal(trial.requests.filter(row => row.type === 'advance').length, trial.actions);
      assert.ok(trial.pauses.every(row => row.acknowledgedPaused === true));
      if (!trial.warmup) {
        assert.deepEqual(trial.pauses.map(row => row.phase), ['initial_planning', 'engaged_action']);
        assert.equal(trial.pauses[0].actionsAtSafeBoundary, 0); assert.equal(trial.pauses[1].actionsAtSafeBoundary, 1);
      } else assert.deepEqual(trial.pauses, []);
      const key = role + '/' + item.id + '/' + formName, commonKey = item.id + '/' + formName;
      const sig = workSignature(trial), norm = normalizedWork(trial);
      if (signatures.has(key)) assert.deepEqual(sig, signatures.get(key), 'Within-version work changed'); else signatures.set(key, sig);
      if (normalized.has(commonKey)) assert.deepEqual(norm, normalized.get(commonKey), 'Unqualified cross-version work difference'); else normalized.set(commonKey, norm);
      if (trial.warmup) warmupActions += trial.actions; else measuredActions += trial.actions;
      ledger.push({ label, role, cohort: label.endsWith('1') ? 'cohort1' : 'cohort2', case: item.id, round: trial.round,
        warmup: trial.warmup, startedAt: trial.startedAt, finishedAt: trial.finishedAt,
        actions: trial.actions, elapsedMs: trial.replayElapsedMs, report: reportFile.record });
    }
  }
}
assert.ok(lastFinish <= instant(window.finishedAt));
assert.equal(reports.B1.value.gitHead, reports.B2.value.gitHead);
assert.equal(ledger.length, 40); assert.equal(ledger.filter(row => !row.warmup).length, 32);
assert.equal(measuredActions, 400); assert.equal(warmupActions, 24);
assert.equal(new Set(ledger.map(row => [row.label, row.case, row.round].join('/'))).size, 40);
assert.equal(new Set(ledger.map(row => JSON.stringify([row.startedAt, row.finishedAt]))).size, 40,
  'A physical trial timestamp pair was reused');
const pairs = [];
for (const [n, a, b] of [[1, 'A1', 'B1'], [2, 'A2', 'B2']]) {
  const pairFile = await read(`${perf}/cohort${n}/comparison.json`), pair = pairFile.value;
  assert.equal(pair.schema, 'logos-engine.native-loop-cost-comparison.v1');
  assert.ok(['passed', 'budget_review_required'].includes(pair.status));
  assert.deepEqual(pair.inputs, { policy: contract.comparisonPolicy, baseline: reports[a].record, after: reports[b].record });
  const tool = contract.historicalTools.find(row => row.path === 'scripts/compare-native-loop-costs.mjs');
  assert.deepEqual(pair.generator, OMIT(tool, ['bytes']));
  for (const name of ['STCK', 'SMLP']) {
    const left = reports[a].value.cases.find(row => row.id === name).trials.filter(row => !row.warmup);
    const right = reports[b].value.cases.find(row => row.id === name).trials.filter(row => !row.warmup);
    assert.deepEqual(pair.comparisons.find(row => row.case === name).metrics, comparisonMetrics(left, right, STAGES, 0.1, true));
  }
  pairs.push(pairFile.record);
}
const strictFile = await read(strictArg), strict = strictFile.value;
const strictTool = 'scripts/compare-native-cost-cohorts.mjs';
const strictCommand = ['node', strictTool, perf + '/comparison-policy.json', ...[1, 2].flatMap(n =>
  ['baseline.json', 'after.json', 'comparison.json'].map(name => `${perf}/cohort${n}/${name}`)), perf + '/combined-comparison.json'];
assert.equal(strict.schema, 'logos-engine.retained-tool-failure.v1'); assert.deepEqual(strict.command, strictCommand);
assert.equal(strict.exitCode, 1); assert.equal(strict.inputsUnchanged, true); assert.equal(strict.outputExists, false);
assert.ok(instant(strict.startedAt) >= instant(window.finishedAt) && instant(strict.finishedAt) >= instant(strict.startedAt));
await verify(strict.log); for (const record of strict.inputs) await verify(record);
assert.deepEqual(strict.inputs, await Promise.all(strictCommand.slice(1, -1).map(fp)));
try { await access(resolve(ROOT, strictCommand.at(-1))); assert.fail('Strict output unexpectedly exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const strictLogBytes = await readFile(resolve(ROOT, strict.log.path));
const strictLog = (strict.log.path.endsWith('.gz') ? gunzipSync(strictLogBytes) : strictLogBytes).toString();
assert.ok(strictLog.includes('Within-cohort work metadata changed') && strictLog.includes('AssertionError'), 'Not the predeclared strict work-identity refusal');
const comparisons = [], globals = [], structuralDifferences = [];
for (const name of ['STCK', 'SMLP']) {
  const roleTrials = role => PLAN.filter(row => row[1] === role).flatMap(([label]) =>
    reports[label].value.cases.find(row => row.id === name).trials.filter(row => !row.warmup));
  const a = roleTrials('baseline'), b = roleTrials('candidate');
  assert.equal(a.length, 8); assert.equal(b.length, 8);
  const metrics = comparisonMetrics(a, b, STAGES, 0.1, true), session = metrics.find(row => row.stage === 'session_elapsed');
  comparisons.push({ case: name, measuredSessionsPerVersion: 8, metrics });
  globals.push({ case: name, sessionsPerVersion: 8, beforeMedianMs: session.before.medianMs,
    afterMedianMs: session.after.medianMs, medianRelativeIncrease: session.after.medianMs / session.before.medianMs - 1,
    accepted: strictBudget(session.before.medianMs, session.after.medianMs), baselineRawMs: a.map(row => row.replayElapsedMs),
    candidateRawMs: b.map(row => row.replayElapsedMs) });
  for (const cohort of ['cohort1', 'cohort2']) for (let round = 0; round <= 4; round++) {
    const form = forms.find(f => f.case === name && f.form === (round === 0 ? 'warmup' : 'measured'));
    structuralDifferences.push(...structuralRows(form, { case: name, cohort, round, warmup: round === 0 }));
  }
}
const phaseOverruns = comparisons.flatMap(row => row.metrics.filter(m => m.stage !== 'session_elapsed' && m.result !== 'within_observed_budget')
  .map(metric => ({ case: row.case, ...metric })));
for (const record of [...touched.values()]) await verify(record);
const result = { schema: 'logos-engine.lot8b-final-cost-analysis.v1', status: 'analysis_passed', recordedAt: new Date().toISOString(),
  generator: await fp(SELF), contract: contractFile.record, window: windowFile.record, strictAttempt: strictFile.record,
  nativeDigests: contract.nativeDigests, pairs, includedTrials: ledger, measuredSessions: 32, measuredActions,
  warmupSessions: 8, warmupActions, excludedMeasuredSessions: 0, excludedOutliers: 0,
  exactFinalFormsChecked: 40, fullWorkSignaturesChecked: 40, structuralDifferences, comparisons, globals,
  globalBudgetAccepted: globals.every(row => row.accepted), phaseOverruns,
  historicalStrictComparisonPassed: false, independentReviewRequired: true, isolationEstablishedByThisReader: false,
  officialQualificationEstablishedByThisReader: false, publicationAuthorizedByThisReader: false,
  inputFingerprints: [...touched.values()],
  qualification: 'Supplementary qualified-work arithmetic only. The historical strict refusal remains failed. All40trials match the predeclared final-source forms and fullwork signatures apart from four exact structural paths. All32measured sessions are pooled; allphase diagnostics and rawdurations remain. Strictglobal acceptance requires bothgames independently. Isolation, finalfunctional review and publication remain separate.' };
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, output: relative(ROOT, output), globalBudgetAccepted: result.globalBudgetAccepted,
  globals: result.globals.map(row => OMIT(row, ['baselineRawMs', 'candidateRawMs'])), phaseOverruns: phaseOverruns.length }));
