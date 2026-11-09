#!/usr/bin/env node
/** Reproduce fixed-position and restoration-mixture diagnostics, without reruns.
 * Usage: node scripts/audit-native-cost-positions.mjs BASELINE AFTER COMPARISON OUTPUT
 * The original comparison remains authoritative; these diagnostics never change
 * its budget, selected samples, or result.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comparisonMetrics, distribution, readEvidence, workSignature } from './compare-native-cost-cohorts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const stableKey = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
const withoutTimings = sample => omit(sample, ['elapsedMs']);
const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Usage: audit-native-cost-positions.mjs BASELINE AFTER COMPARISON OUTPUT');
const output = resolve(ROOT, args[3]);
assert.ok(relative(ROOT, output) && !relative(ROOT, output).startsWith('..'));
try { await access(output); throw new Error('Position audit already exists; refusing overwrite'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const [baseline, after, official] = await Promise.all(args.slice(0, 3).map(readEvidence));
assert.deepEqual(official.value.inputs.baseline, baseline.fingerprint);
assert.deepEqual(official.value.inputs.after, after.fingerprint);
const cases = [];
for (const first of baseline.value.cases) {
  const second = after.value.cases.find(row => row.id === first.id);
  assert.ok(second);
  const beforeTrials = first.trials.filter(row => !row.warmup), afterTrials = second.trials.filter(row => !row.warmup);
  assert.equal(beforeTrials.length, afterTrials.length);
  const gate = official.value.comparisons.find(row => row.case === first.id);
  assert.ok(gate);
  assert.deepEqual(comparisonMetrics(beforeTrials, afterTrials, gate.metrics.map(row => row.stage),
    official.value.relativeBudget, gate.unaffected), gate.metrics, 'Reproduce original metrics before diagnosing them');
  const workChecks = beforeTrials.map((trial, index) => {
    assert.deepEqual(workSignature(trial), workSignature(afterTrials[index]));
    return { round: trial.round, exact: true, samplesPerVersion: trial.samples.length,
      requestsPerVersion: trial.requests.length, actionsPerVersion: trial.actions, levelsPerVersion: trial.levelsCompleted };
  });
  const positions = [];
  for (const stage of gate.metrics.map(row => row.stage).filter(name => name !== 'session_elapsed')) {
    const groups = [beforeTrials, afterTrials].map(trials => {
      const byKey = new Map();
      for (const trial of trials) {
        const known = stage === 'known_prefix_service' || stage === 'known_prefix_request';
        const rows = known ? trial.requests.filter(row => row.type === 'advance' && row.kind === 'action')
          .map(row => ({ stage, sequence: row.sequence, requestType: row.type,
            elapsedMs: stage === 'known_prefix_service' ? row.nativeServiceMs : row.wallMs }))
          : trial.samples.filter(row => row.stage === stage);
        for (const sample of rows) {
          const key = stableKey(withoutTimings(sample));
          if (!byKey.has(key)) byKey.set(key, []);
          byKey.get(key).push({ round: trial.round, elapsedMs: sample.elapsedMs });
        }
      }
      return byKey;
    });
    assert.deepEqual([...groups[0].keys()].sort(), [...groups[1].keys()].sort());
    for (const [key, beforeSamples] of groups[0]) {
      const afterSamples = groups[1].get(key), a = distribution(beforeSamples.map(row => row.elapsedMs)),
        b = distribution(afterSamples.map(row => row.elapsedMs));
      positions.push({ key: JSON.parse(key), beforeSamples, afterSamples, before: a, after: b,
        medianDeltaMs: b.medianMs - a.medianMs, medianRelativeChange: b.medianMs / a.medianMs - 1,
        observedRangesDisjointAfterSlower: b.minMs > a.maxMs });
    }
  }
  const restoration = [beforeTrials, afterTrials].map(trials => trials.flatMap(row => row.samples)
    .filter(row => row.stage === 'restoration'));
  const subtypes = [false, true].map(withPlan => {
    const a = distribution(restoration[0].filter(row => Boolean(row.proposalKind) === withPlan).map(row => row.elapsedMs));
    const b = distribution(restoration[1].filter(row => Boolean(row.proposalKind) === withPlan).map(row => row.elapsedMs));
    return { subtype: withPlan ? 'with_plan' : 'without_plan', before: a, after: b,
      medianDeltaMs: b.medianMs - a.medianMs, medianRelativeChange: b.medianMs / a.medianMs - 1 };
  });
  const pivots = restoration.map(rows => {
    const sorted = rows.toSorted((a, b) => a.elapsedMs - b.elapsedMs), n = sorted.length;
    return { sampleCount: n, middleSamples: n % 2 ? [sorted[(n - 1) / 2]] : sorted.slice(n / 2 - 1, n / 2 + 1),
      pooledMedianMs: distribution(rows.map(row => row.elapsedMs)).medianMs };
  });
  const sums = ['new_decision', 'known_prefix_guard', 'restoration', 'persistence', 'acquisition_and_persistence'].map(stage => {
    const arrays = [beforeTrials, afterTrials].map(trials => trials.map(trial => trial.samples
      .filter(row => row.stage === stage).reduce((sum, row) => sum + row.elapsedMs, 0)));
    const a = distribution(arrays[0]), b = distribution(arrays[1]);
    return { stage, beforeRoundSumsMs: arrays[0], afterRoundSumsMs: arrays[1],
      beforeMedianRoundSumMs: a.medianMs, afterMedianRoundSumMs: b.medianMs,
      medianRoundSumRelativeChange: b.medianMs / a.medianMs - 1 };
  });
  cases.push({ case: first.id, workChecks, officialMetricsUnchanged: gate.metrics,
    positionDiagnostics: positions, restorationMixture: { subtypes, pooledMedianPivots: { before: pivots[0], after: pivots[1] } },
    phaseRoundSumDiagnostics: sums });
}
const scriptPath = fileURLToPath(import.meta.url), helperPath = resolve(ROOT, 'scripts/compare-native-cost-cohorts.mjs');
const result = { schema: 'logos-engine.native-loop-cost-position-audit.v1', recordedAt: new Date().toISOString(),
  generator: { path: relative(ROOT, scriptPath), sha256: sha(await readFile(scriptPath)) },
  helper: { path: relative(ROOT, helperPath), sha256: sha(await readFile(helperPath)) },
  inputs: { baseline: baseline.fingerprint, after: after.fingerprint, originalComparison: official.fingerprint },
  originalGate: { status: official.value.status, relativeBudget: official.value.relativeBudget,
    unresolved: official.value.unresolved, changedByAudit: false }, cases,
  qualification: 'Read-only calculations from retained reports. Work signatures include every phase and request position, observations and final graph counts. Fixed-position medians, restoration subtypes and round totals diagnose sensitivity; none replaces the predeclared pooled stage median or changes the budget. No timing samples are excluded other than the declared warmups. Internal admission work, allocations and GC/JIT causes are not measured by these phase records. Position ranges with three observations do not establish a population confidence interval. Correlated service/request/guard criteria are preserved exactly.' };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: relative(ROOT, output), originalStatus: result.originalGate.status,
  cases: cases.map(row => ({ case: row.case, positions: row.positionDiagnostics.length })) }));
