#!/usr/bin/env node
/**
 * Pool two complete, retained measurement cohorts without choosing a winner.
 * Usage: node scripts/compare-native-cost-cohorts.mjs POLICY BASELINE1 AFTER1 COMPARISON1 BASELINE2 AFTER2 COMPARISON2 OUTPUT
 * This is a multi-run evidence calculation, never a fabricated harness run.
 * It imports no native runtime and performs no benchmark or game execution.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));

/** Exact arithmetic of compare-native-loop-costs.mjs, checked against both receipts. */
export function distribution(values) {
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0), 'Timings must be finite and nonnegative');
  const sorted = values.toSorted((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: !n ? null : n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: n >= 20 ? sorted[Math.ceil(n * 0.95) - 1] : null, minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
}

export function valuesFor(trial, stage) {
  if (stage === 'session_elapsed') return [trial.replayElapsedMs];
  if (stage === 'known_prefix_service' || stage === 'known_prefix_request') return trial.requests
    .filter(row => row.type === 'advance' && row.kind === 'action')
    .map(row => stage === 'known_prefix_service' ? row.nativeServiceMs : row.wallMs);
  return trial.samples.filter(row => row.stage === stage).map(row => row.elapsedMs);
}

export function metricFor(trials, stage) {
  const values = trials.flatMap(row => valuesFor(row, stage));
  const medians = trials.map(row => distribution(valuesFor(row, stage)).medianMs).filter(Number.isFinite);
  const noise = distribution(medians);
  return { distribution: distribution(values),
    noise: noise.medianMs ? (noise.maxMs - noise.minMs) / noise.medianMs : null };
}

export function comparisonMetrics(leftTrials, rightTrials, stages, budget, unaffected) {
  return stages.map(stage => {
    const lm = metricFor(leftTrials, stage), rm = metricFor(rightTrials, stage);
    const left = lm.distribution, right = rm.distribution;
    assert.ok(left.count > 0 && right.count > 0, `Missing measured stage ${stage}`);
    assert.equal(left.count, right.count, `Measured sample count changed for ${stage}`);
    assert.ok(left.medianMs > 0, `Cannot define a finite relative budget for zero baseline median ${stage}`);
    const increase = right.medianMs / left.medianMs - 1;
    const noise = { baselineRelativeRange: lm.noise, afterRelativeRange: rm.noise };
    return { stage, before: left, after: right, medianRelativeIncrease: increase,
      roundMedianNoise: noise, budgetApplies: unaffected,
      result: !unaffected ? 'changed_path_diagnostic' : increase <= budget ? 'within_observed_budget' :
        Math.max(noise.baselineRelativeRange ?? 0, noise.afterRelativeRange ?? 0) > budget ? 'over_budget_with_noise_unresolved' : 'over_budget' };
  });
}

/** Compare physical work and phase placement, not scheduling or allocation noise. */
export function workSignature(trial) {
  return { case: trial.case, warmup: trial.warmup, actions: trial.actions,
    levelsCompleted: trial.levelsCompleted, cycles: trial.cycles,
    samples: trial.samples.map(row => omit(row, ['elapsedMs'])),
    requests: trial.requests.map(row => omit(row, ['wallMs', 'nativeServiceMs', 'transportAndSchedulingMs'])),
    observations: trial.observations,
    pauses: trial.pauses.map(row => omit(row, ['requestedAt', 'acknowledgementMs', 'safeBoundaryMs'])),
    inspection: trial.inspection.map(row => omit(row, ['nativeServiceMs', 'endToEndMs'])),
    memorySamples: trial.memory.map(row => omit(row, ['heapUsed', 'rss'])),
    final: omit(trial.final, ['implementation']) };
}

function unresolvedFor(comparisons) {
  return comparisons.flatMap(row => row.metrics.filter(metric => metric.budgetApplies && metric.result !== 'within_observed_budget')
    .map(metric => ({ case: row.case, stage: metric.stage, result: metric.result,
      medianRelativeIncrease: metric.medianRelativeIncrease })));
}

function inside(path) {
  const absolute = resolve(ROOT, path), local = relative(ROOT, absolute);
  assert.ok(local && !local.startsWith('..') && !local.startsWith('/'), 'Evidence path must be inside the checkout');
  return absolute;
}

async function fingerprint(path) {
  const absolute = inside(path), bytes = await readFile(absolute);
  return { path: relative(ROOT, absolute), sha256: sha(bytes), bytes: bytes.length };
}

export async function readEvidence(path) {
  const absolute = inside(path), bytes = await readFile(absolute);
  return { value: JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes),
    fingerprint: { path: relative(ROOT, absolute), sha256: sha(bytes), bytes: bytes.length } };
}

function validateTrial(trial) {
  assert.equal(trial.final.actions, trial.actions);
  assert.equal(trial.final.acquiredTransitions, trial.actions);
  assert.equal(trial.requests.filter(row => row.type === 'init').length, 1);
  assert.equal(trial.requests.filter(row => row.type === 'advance').length, trial.actions);
  assert.ok(trial.pauses.every(row => row.acknowledgedPaused));
  if (!trial.warmup) {
    assert.equal(trial.pauses.find(row => row.phase === 'initial_planning').actionsAtSafeBoundary, 0);
    assert.equal(trial.pauses.find(row => row.phase === 'engaged_action').actionsAtSafeBoundary, 1);
  }
}

async function validateReport(file) {
  const report = file.value;
  assert.equal(report.schema, 'logos-engine.native-loop-costs.v1');
  assert.equal(report.status, 'passed', 'An incomplete harness run cannot be silently treated as a full cohort');
  assert.equal(report.nativeSourceUnchanged, true);
  assert.ok(Number.isInteger(report.manifest.rounds) && report.manifest.rounds > 0);
  assert.equal(Object.keys(report.nativeSource.files).length, report.nativeSource.fileCount);
  assert.equal(sha(Buffer.from(JSON.stringify(report.nativeSource.files))), report.nativeSource.digest);
  assert.deepEqual(await fingerprint(report.generator.path), report.generator, 'Measured timing harness bytes changed');
  assert.ok(report.inputs.length > 0);
  for (const input of report.inputs) assert.deepEqual(await fingerprint(input.path), input, 'Retained input fingerprint changed');
  // The unchanged measurement harness records its CASES declaration first.
  const declared = await readEvidence(report.inputs[0].path);
  assert.deepEqual(declared.value, report.manifest, 'Cases-file bytes and embedded declaration must agree');
  assert.deepEqual(report.cases.map(row => row.id), report.manifest.cases.map(row => row.id));
  for (const item of report.cases) {
    const measured = item.trials.filter(row => !row.warmup), warmups = item.trials.filter(row => row.warmup);
    assert.equal(measured.length, report.manifest.rounds);
    assert.equal(warmups.length, 1, 'Preserve the single declared warmup of each original harness case');
    assert.deepEqual(measured.map(row => row.round), Array.from({ length: report.manifest.rounds }, (_, index) => index + 1));
    for (const trial of item.trials) validateTrial(trial);
    assert.deepEqual(omit(item.sessionElapsed, ['tailQualification']), distribution(measured.map(row => row.replayElapsedMs)));
  }
}

async function validateCohort(cohort, policyFile) {
  const { baseline: beforeFile, after: afterFile, comparison: comparisonFile } = cohort;
  const before = beforeFile.value, after = afterFile.value, official = comparisonFile.value, policy = policyFile.value;
  await validateReport(beforeFile); await validateReport(afterFile);
  assert.equal(official.schema, 'logos-engine.native-loop-cost-comparison.v1');
  assert.ok(['passed', 'budget_review_required'].includes(official.status), 'Budget failures must remain included');
  assert.deepEqual(official.inputs, { policy: policyFile.fingerprint, baseline: beforeFile.fingerprint, after: afterFile.fingerprint });
  assert.deepEqual(await fingerprint(official.generator.path), { ...official.generator,
    bytes: (await readFile(inside(official.generator.path))).length }, 'Official comparison generator changed');
  assert.equal(official.relativeBudget, policy.relativeBudget);
  assert.equal(official.harnessInputsMatched, true); assert.equal(official.environmentMatched, true);
  assert.equal(official.replayWorkMatched, true);
  assert.deepEqual(before.generator, after.generator);
  assert.deepEqual(before.inputs, after.inputs);
  assert.deepEqual(before.manifest, after.manifest);
  assert.deepEqual(before.environment, after.environment);
  assert.deepEqual(before.cases.map(row => row.id), after.cases.map(row => row.id));
  assert.deepEqual(official.before, { headCommit: before.gitHead, nativeDigest: before.nativeSource.digest });
  assert.deepEqual(official.after, { headCommit: after.gitHead, nativeDigest: after.nativeSource.digest });

  const reproduced = [];
  for (const first of before.cases) {
    const second = after.cases.find(row => row.id === first.id);
    const a = first.trials.filter(row => !row.warmup), b = second.trials.filter(row => !row.warmup);
    assert.deepEqual(first.trials.map(workSignature), second.trials.map(workSignature), 'Within-cohort work metadata changed');
    const unaffected = policy.unaffectedCaseIds.includes(first.id);
    const metrics = comparisonMetrics(a, b, policy.stages, policy.relativeBudget, unaffected);
    const recorded = official.comparisons.find(row => row.case === first.id);
    assert.ok(recorded); assert.equal(recorded.measuredSessions, a.length);
    assert.equal(recorded.actionsPerSession, a[0].actions); assert.equal(recorded.levelsCompleted, a[0].levelsCompleted);
    assert.equal(recorded.unaffected, unaffected);
    assert.deepEqual(recorded.metrics, metrics, `Exact original metric/distribution/noise reproduction failed for ${first.id}`);
    assert.deepEqual(recorded.sessionElapsed, { before: first.sessionElapsed, after: second.sessionElapsed,
      medianRelativeIncrease: second.sessionElapsed.medianMs / first.sessionElapsed.medianMs - 1 });
    reproduced.push({ case: first.id, metrics });
  }
  assert.equal(official.comparisons.length, reproduced.length);
  const unresolved = unresolvedFor(reproduced);
  assert.deepEqual(official.unresolved, unresolved, 'Original failures must be reproduced, not reclassified');
  assert.equal(official.status, unresolved.length ? 'budget_review_required' : 'passed');
  return { budgetMetricsExactlyReproduced: true,
    reproducedFields: ['comparisons[].metrics', 'comparisons[].sessionElapsed', 'unresolved', 'status'],
    measuredSessionsPerCase: before.manifest.rounds,
    budgetMetricCount: reproduced.flatMap(row => row.metrics).filter(row => row.budgetApplies).length,
    originalStatus: official.status, originalUnresolved: unresolved };
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 8,
    'Usage: compare-native-cost-cohorts.mjs POLICY BASELINE1 AFTER1 COMPARISON1 BASELINE2 AFTER2 COMPARISON2 OUTPUT');
  const paths = args.map(inside), output = paths.at(-1);
  assert.equal(new Set(paths).size, paths.length, 'Inputs/output must be distinct retained evidence paths');
  try { await access(output); throw new Error('Cohort comparison already exists; refusing overwrite'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const [policyFile, b1, a1, c1, b2, a2, c2] = await Promise.all(paths.slice(0, -1).map(readEvidence));
  const policy = policyFile.value;
  assert.equal(policy.schema, 'logos-engine.native-loop-cost-comparison-policy.v1');
  assert.ok(policy.relativeBudget > 0 && policy.relativeBudget < 1);
  assert.equal(new Set(policy.stages).size, policy.stages.length);
  assert.equal(new Set([b1, a1, b2, a2].map(file => file.fingerprint.sha256)).size, 4, 'A report must never count twice');
  assert.notEqual(c1.fingerprint.sha256, c2.fingerprint.sha256);
  const cohorts = [{ id: 'cohort_1', baseline: b1, after: a1, comparison: c1 },
    { id: 'cohort_2', baseline: b2, after: a2, comparison: c2 }];
  const validations = [];
  for (const cohort of cohorts) validations.push(await validateCohort(cohort, policyFile));
  assert.deepEqual(c1.value.generator, c2.value.generator, 'Original pair comparisons must share one comparator');

  for (const side of ['baseline', 'after']) {
    const first = cohorts[0][side].value, second = cohorts[1][side].value;
    assert.deepEqual(first.nativeSource, second.nativeSource, `Measured ${side} source changed between cohorts`);
    assert.deepEqual(first.generator, second.generator);
    assert.deepEqual(first.environment, second.environment);
    assert.deepEqual(first.inputs.slice(1), second.inputs.slice(1), 'Only CASES-file fingerprint may differ between cohorts');
    assert.deepEqual(omit(first.manifest, ['rounds']), omit(second.manifest, ['rounds']),
      'Only declared round count may differ between cohorts');
    assert.deepEqual(first.cases.map(row => row.id), second.cases.map(row => row.id));
  }
  assert.ok(policy.unaffectedCaseIds.every(id => b1.value.cases.some(row => row.id === id)));

  const comparisons = [], inclusion = [];
  for (const item of b1.value.cases) {
    const perSide = {};
    for (const side of ['baseline', 'after']) {
      const measured = [], seenSessions = new Set();
      let warmupSignature, signature;
      for (const cohort of cohorts) {
        const candidate = cohort[side].value.cases.find(row => row.id === item.id);
        for (const trial of candidate.trials) {
          const actualWork = workSignature(trial);
          if (trial.warmup) {
            if (warmupSignature) assert.deepEqual(actualWork, warmupSignature, 'Declared warmup work changed');
            else warmupSignature = actualWork;
            continue;
          }
          if (signature) assert.deepEqual(actualWork, signature, `Work-position mix changed within or across ${side} cohorts for ${item.id}`);
          else signature = actualWork;
          const sessionKey = `${trial.startedAt}|${trial.finishedAt}`;
          assert.ok(!seenSessions.has(sessionKey), 'A physical measurement session must not be included twice');
          seenSessions.add(sessionKey); measured.push(trial);
          inclusion.push({ cohort: cohort.id, side, case: item.id, round: trial.round,
            startedAt: trial.startedAt, finishedAt: trial.finishedAt, actions: trial.actions,
            levelsCompleted: trial.levelsCompleted, sampleCount: trial.samples.length, requestCount: trial.requests.length });
        }
      }
      perSide[side] = measured;
    }
    assert.equal(perSide.baseline.length, perSide.after.length);
    const expectedSessions = cohorts.reduce((sum, cohort) => sum + cohort.baseline.value.manifest.rounds, 0);
    assert.equal(perSide.baseline.length, expectedSessions, 'Every measured session must be retained');
    assert.deepEqual(workSignature(perSide.baseline[0]), workSignature(perSide.after[0]));
    const metrics = comparisonMetrics(perSide.baseline, perSide.after, policy.stages,
      policy.relativeBudget, policy.unaffectedCaseIds.includes(item.id));
    comparisons.push({ case: item.id, unaffected: policy.unaffectedCaseIds.includes(item.id),
      measuredSessionsPerVersion: expectedSessions, actionsPerSession: perSide.baseline[0].actions,
      levelsCompleted: perSide.baseline[0].levelsCompleted,
      cohortRounds: cohorts.map(cohort => ({ cohort: cohort.id, rounds: cohort.baseline.value.manifest.rounds })), metrics });
  }
  const unresolved = unresolvedFor(comparisons);
  const budgetMetrics = comparisons.flatMap(row => row.metrics).filter(row => row.budgetApplies);
  assert.equal(budgetMetrics.length, policy.unaffectedCaseIds.length * policy.stages.length);
  const report = {
    schema: 'logos-engine.native-loop-cost-cohort-comparison.v1',
    status: unresolved.length ? 'budget_review_required' : 'passed', recordedAt: new Date().toISOString(),
    generator: await fingerprint(fileURLToPath(import.meta.url)),
    inputs: { policy: policyFile.fingerprint, cohorts: cohorts.map((cohort, index) => ({ id: cohort.id,
      baseline: cohort.baseline.fingerprint, after: cohort.after.fingerprint,
      originalComparison: cohort.comparison.fingerprint, validation: validations[index] })) },
    sources: { baseline: { digest: b1.value.nativeSource.digest, fileCount: b1.value.nativeSource.fileCount },
      after: { digest: a1.value.nativeSource.digest, fileCount: a1.value.nativeSource.fileCount } },
    environment: b1.value.environment, timingHarness: b1.value.generator,
    method: { combine: 'All declared measured sessions from both retained cohorts, pooled before any metric calculation.',
      selectedCohort: null, excludedMeasuredSessions: 0, excludedOutliers: 0,
      excludedWarmupsPerCaseAndVersion: cohorts.length,
      originalBudgetMetricsExactlyReproduced: true, nativeSourcesIdenticalWithinEachVersion: true,
      harnessAndNonCasesInputsIdentical: true, casesDeclarationDiffersOnlyInRounds: true,
      workMetadataExactAcrossAllSessions: true,
      workSignatureExcludes: ['elapsed timing values', 'absolute timing timestamps', 'heapUsed and rss', 'final.implementation, checked through source manifests separately'],
      noiseAllowanceAdded: false,
      p95MinimumSamples: 20, p95Method: 'Empirical nearest rank, withheld below 20 samples.',
      sourceOfTimings: 'Original retained harness reports; this tool is not a new harness execution.' },
    relativeBudget: policy.relativeBudget, budgetMetricCount: budgetMetrics.length,
    withinObservedBudget: budgetMetrics.filter(metric => metric.result === 'within_observed_budget').length,
    comparisons, unresolved, includedMeasuredSessions: inclusion,
    qualification: 'Both complete cohorts remain visible and all their measured sessions are included, whether their original budget comparison passed or failed. Only predeclared warmups are excluded. Phase definitions, pooled medians, nearest-rank p95 and round-median noise arithmetic exactly reproduce each original pair comparison before pooling. The budget is unchanged and noise never increases its allowance. Static environment and exact work metadata do not establish identical GC/JIT/scheduling conditions. Within-session samples are correlated; this is a finite matched-public-replay cost result, not a population confidence interval or a live-game speed claim. No synthetic logos-engine.native-loop-costs report is produced.'
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, output: relative(ROOT, output),
    sessionsPerVersionAndCase: comparisons.map(row => ({ case: row.case, sessions: row.measuredSessionsPerVersion })),
    budgetMetrics: report.budgetMetricCount, withinObservedBudget: report.withinObservedBudget, unresolved }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
