#!/usr/bin/env node
/** Compare two completed cost runs with identical harness, inputs and settings.
 * Usage: node scripts/compare-native-loop-costs.mjs POLICY BASELINE AFTER OUTPUT
 * Native source changes are expected. Session/phase timings are not speed claims
 * about live games. A noisy over-budget result remains unresolved.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function distribution(values) {
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: !n ? null : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null, minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
}
function valuesFor(trial, stage) {
  if (stage === 'session_elapsed') return [trial.replayElapsedMs];
  if (stage === 'known_prefix_service' || stage === 'known_prefix_request') return trial.requests
    .filter(row => row.type === 'advance' && row.kind === 'action')
    .map(row => stage === 'known_prefix_service' ? row.nativeServiceMs : row.wallMs);
  return trial.samples.filter(row => row.stage === stage).map(row => row.elapsedMs);
}
function metricFor(item, stage) {
  const trials = item.trials.filter(row => !row.warmup);
  const values = trials.flatMap(row => valuesFor(row, stage));
  const medians = trials.map(row => distribution(valuesFor(row, stage)).medianMs).filter(Number.isFinite), noise = distribution(medians);
  return { distribution: distribution(values), noise: noise.medianMs ? (noise.maxMs - noise.minMs) / noise.medianMs : null };
}
async function read(path) { const bytes = await readFile(path); return { value: JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes),
  fingerprint: { path: relative(ROOT, path), sha256: sha(bytes), bytes: bytes.length } }; }
const [policyArg, baselineArg, afterArg, outputArg] = process.argv.slice(2);
if (!outputArg || process.argv.length !== 6) throw new Error('Usage: compare-native-loop-costs.mjs POLICY BASELINE AFTER OUTPUT');
const paths = [policyArg, baselineArg, afterArg, outputArg].map(value => resolve(ROOT, value));
assert.ok(paths.every(path => relative(ROOT, path) && !relative(ROOT, path).startsWith('..')));
try { await access(paths[3]); throw new Error('Cost comparison already exists; refusing overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const [{ value: policy, fingerprint: policyFile }, { value: before, fingerprint: beforeFile }, { value: after, fingerprint: afterFile }] = await Promise.all(paths.slice(0, 3).map(read));
assert.equal(policy.schema, 'logos-engine.native-loop-cost-comparison-policy.v1');
assert.ok(policy.relativeBudget > 0 && policy.relativeBudget < 1);
for (const report of [before, after]) {
  assert.equal(report.schema, 'logos-engine.native-loop-costs.v1'); assert.equal(report.status, 'passed');
  assert.equal(report.nativeSourceUnchanged, true);
}
assert.deepEqual(before.generator, after.generator, 'Before/after must use exactly the same timing harness');
assert.deepEqual(before.inputs, after.inputs, 'Before/after public returns and declarations must match');
assert.deepEqual(before.manifest, after.manifest);
assert.deepEqual(before.environment, after.environment, 'Runtime and hardware description changed');
assert.deepEqual(before.cases.map(row => row.id), after.cases.map(row => row.id));
const comparisons = [];
for (const first of before.cases) {
  const second = after.cases.find(row => row.id === first.id), untouched = policy.unaffectedCaseIds.includes(first.id);
  const a = first.trials.filter(row => !row.warmup), b = second.trials.filter(row => !row.warmup);
  assert.equal(a.length, before.manifest.rounds); assert.equal(b.length, a.length);
  assert.deepEqual(a.map(row => [row.round, row.actions, row.levelsCompleted, row.cycles]), b.map(row => [row.round, row.actions, row.levelsCompleted, row.cycles]),
    'Matched replay work changed; compare separate behavior rather than claiming a speed ratio');
  for (const trial of [...a, ...b]) {
    assert.equal(trial.final.actions, trial.actions); assert.equal(trial.final.acquiredTransitions, trial.actions);
    assert.equal(trial.requests.filter(row => row.type === 'init').length, 1);
    assert.equal(trial.requests.filter(row => row.type === 'advance').length, trial.actions);
    assert.ok(trial.pauses.every(row => row.acknowledgedPaused));
    assert.equal(trial.pauses.find(row => row.phase === 'initial_planning').actionsAtSafeBoundary, 0);
    assert.equal(trial.pauses.find(row => row.phase === 'engaged_action').actionsAtSafeBoundary, 1);
  }
  const metrics = [];
  for (const stage of policy.stages) {
    const leftMetric = metricFor(first, stage), rightMetric = metricFor(second, stage);
    const left = leftMetric.distribution, right = rightMetric.distribution;
    assert.ok(left?.count > 0 && right?.count > 0, `Missing measured ${stage} on ${first.id}`);
    assert.equal(left.count, right.count, 'Stage work counts changed');
    const increase = right.medianMs / left.medianMs - 1;
    const noise = { baselineRelativeRange: leftMetric.noise, afterRelativeRange: rightMetric.noise };
    metrics.push({ stage, before: left, after: right, medianRelativeIncrease: increase,
      roundMedianNoise: noise, budgetApplies: untouched,
      result: !untouched ? 'changed_path_diagnostic' : increase <= policy.relativeBudget ? 'within_observed_budget' :
        Math.max(noise.baselineRelativeRange ?? 0, noise.afterRelativeRange ?? 0) > policy.relativeBudget ? 'over_budget_with_noise_unresolved' : 'over_budget' });
  }
  const isPose = sample => sample.proposalKind === 'typed_pose_dependency';
  const pose = [a, b].map(trials => {
    const rows = trials.flatMap(row => row.samples).filter(isPose), result = {};
    for (const stage of policy.stages) {
      const values = rows.filter(row => row.stage === stage).map(row => row.elapsedMs).toSorted((x, y) => x - y);
      if (values.length) result[stage] = { count: values.length, medianMs: values.length % 2 ? values[(values.length - 1) / 2] :
        (values[values.length / 2 - 1] + values[values.length / 2]) / 2,
        p95Ms: values.length >= 20 ? values[Math.ceil(values.length * 0.95) - 1] : null, maxMs: values.at(-1) };
    }
    return result;
  });
  comparisons.push({ case: first.id, unaffected: untouched, measuredSessions: a.length,
    actionsPerSession: a[0].actions, levelsCompleted: a[0].levelsCompleted,
    sessionElapsed: { before: first.sessionElapsed, after: second.sessionElapsed, medianRelativeIncrease: second.sessionElapsed.medianMs / first.sessionElapsed.medianMs - 1 },
    metrics, selectedPoseCosts: { before: pose[0], after: pose[1] },
    inspection: { before: first.inspection, after: second.inspection }, pause: { before: first.pause, after: second.pause } });
}
assert.ok(policy.unaffectedCaseIds.every(id => comparisons.some(row => row.case === id)));
const unresolved = comparisons.flatMap(row => row.metrics.filter(metric => metric.budgetApplies && metric.result !== 'within_observed_budget')
  .map(metric => ({ case: row.case, stage: metric.stage, result: metric.result, medianRelativeIncrease: metric.medianRelativeIncrease })));
const report = { schema: 'logos-engine.native-loop-cost-comparison.v1', status: unresolved.length ? 'budget_review_required' : 'passed',
  recordedAt: new Date().toISOString(), inputs: { policy: policyFile, baseline: beforeFile, after: afterFile },
  generator: { path: relative(ROOT, fileURLToPath(import.meta.url)), sha256: sha(await readFile(fileURLToPath(import.meta.url))) },
  before: { headCommit: before.gitHead, nativeDigest: before.nativeSource.digest }, after: { headCommit: after.gitHead, nativeDigest: after.nativeSource.digest },
  harnessInputsMatched: true, environmentMatched: true, replayWorkMatched: true, relativeBudget: policy.relativeBudget,
  comparisons, unresolved,
  qualification: 'Observed median ratios under matched recorded-public work, not a hardware-independent speed claim. Native digests bind the actual measured inputs; headCommit names the Git base and does not imply that a dirty working tree was already committed. Nested stages must not be summed. known_prefix_service is the complete service advance returning another action in the committed prefix, including observation/guard/snapshot work; known_prefix_request additionally includes worker transport/scheduling before controller acceptance. session_elapsed includes the complete controller replay. restoration isolates family restoration only; caller/authority restoration remains included in new_decision. Inspection is service plus worker transport, with no rendered inspector. Pause covers only initial planning and the first engaged action, not arbitrary long-search preemption. Three cold-knowledge sessions calibrate observed round-to-round variation, not confidence intervals. P95 is withheld below 20 samples. An over-budget result with large noise remains unresolved and requires a targeted follow-up; the noise is never added to the allowance. Selected pose samples diagnose the changed path. A finite multi-level session does not establish hours-long memory behavior. Live game, browser rendering and external hosting times are not measured.' };
await mkdir(dirname(paths[3]), { recursive: true }); await writeFile(paths[3], JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: report.status, output: relative(ROOT, paths[3]), unresolved }));
