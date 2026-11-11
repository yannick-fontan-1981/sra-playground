#!/usr/bin/env node
/** Read-only verification of all 40 official trials against prospective forms.
 * Usage: node SCRIPT PERFORMANCE_DIR
 * Writes only an exclusive verification receipt; runs no native worker.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workSignature } from '../../../../../scripts/compare-native-cost-cohorts.mjs';

const SCRIPT = fileURLToPath(import.meta.url), ROOT = resolve(dirname(SCRIPT), '../../../../..');
const BASE = resolve(ROOT, 'docs/migration/lot7b-evidence/followup-recovery');
const hash = value => createHash('sha256').update(value).digest('hex');
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const digest = value => hash(JSON.stringify(ordered(value)));
const inside = (root, path) => { const name = relative(root, path); return name && !name.startsWith('..') && !name.startsWith('/'); };
async function fp(path) { const bytes = await readFile(path); return { path: inside(ROOT, path) ? relative(ROOT, path) : path, sha256: hash(bytes), bytes: bytes.length }; }

async function main() {
  assert.equal(process.argv.length, 3, 'Usage: node SCRIPT PERFORMANCE_DIR');
  const perf = resolve(ROOT, process.argv[2]); assert.ok(inside(BASE, perf));
  const output = resolve(perf, 'strict-work-verification.json');
  try { await access(output); throw new Error('Refusing existing verification output'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const inputs = new Map();
  async function read(path) { const record = await fp(path); inputs.set(path, record); return JSON.parse(await readFile(path, 'utf8')); }
  async function checked(record) {
    const path = resolve(ROOT, record.path); assert.ok(inside(ROOT, path) || record.path.startsWith('/'));
    assert.deepEqual(await fp(path), record, 'Prospective input changed: ' + record.path); inputs.set(path, record); return path;
  }
  const formsPath = resolve(perf, 'strict-work-forms.json'), forms = await read(formsPath);
  const window = await read(resolve(perf, 'window.json')), declaration = await read(resolve(perf, 'declaration.json'));
  const readiness = await read(resolve(perf, 'readiness.json'));
  assert.equal(forms.schema, 'logos-engine.followup-strict-cost-forms.v1'); assert.equal(forms.status, 'passed');
  assert.equal(forms.sourceAndInputsUnchanged, true); assert.equal(forms.comparison, 'exact_deep_equality_no_exemptions');
  assert.equal(forms.functionalSessions, 8); assert.equal(forms.functionalActions, 62);
  assert.equal(forms.measuredCostSessions, 0); assert.equal(forms.timingMetricsRetained, 0);
  assert.deepEqual(forms.nativeDigests, declaration.nativeDigests);
  assert.deepEqual(forms.forms.map(row => [row.case, row.warmup, row.actions]), [['STCK', true, 3], ['STCK', false, 10], ['SMLP', true, 3], ['SMLP', false, 15]]);
  for (const row of forms.forms) assert.equal(digest(row.signature), row.signatureSha256);
  assert.equal(forms.captures.length, 8);
  for (const role of ['baseline', 'candidate']) for (const form of forms.forms) {
    const rows = forms.captures.filter(row => row.role === role && row.case === form.case && row.warmup === form.warmup);
    assert.equal(rows.length, 1); assert.deepEqual(rows[0].signature, form.signature); assert.equal(rows[0].signatureSha256, form.signatureSha256);
  }
  for (const record of [forms.declaration, forms.generator, forms.workSignatureTool, ...forms.inputs, ...forms.watchedExternalInputs]) await checked(record);
  assert.equal(window.status, 'passed'); assert.equal(window.finalIntegrity, 'passed');
  assert.equal(readiness.status, 'ready'); assert.equal(readiness.measurementAuthorized, true);
  assert.deepEqual(readiness.pendingRequirements, []); assert.deepEqual(readiness.strictWorkForms, await fp(formsPath));
  assert.deepEqual(readiness.strictPostWindowVerifier, await fp(SCRIPT), 'Post-window verifier changed after readiness');
  assert.ok(Date.parse(forms.finishedAt) <= Date.parse(readiness.finalizedAt) && Date.parse(readiness.finalizedAt) < Date.parse(window.startedAt));
  const rows = [], planned = [['A1', 'baseline', 'cohort1/baseline.json'], ['B1', 'candidate', 'cohort1/after.json'],
    ['B2', 'candidate', 'cohort2/after.json'], ['A2', 'baseline', 'cohort2/baseline.json']];
  assert.deepEqual(window.plannedOrder, planned.map(row => row[0]));
  assert.deepEqual(window.executions.map(row => row.label), window.plannedOrder);
  for (const [label, role, name] of planned) {
    const path = resolve(perf, name), report = await read(path);
    const execution = window.executions.find(row => row.label === label);
    assert.equal(execution.status, 'passed'); assert.equal(execution.exitCode, 0);
    assert.equal((await fp(path)).sha256, execution.copiedReportSha256 ?? execution.reportSha256);
    assert.equal(report.schema, 'logos-engine.native-loop-costs.v1'); assert.equal(report.status, 'passed');
    assert.equal(report.nativeSourceUnchanged, true); assert.equal(report.nativeSource.digest, forms.nativeDigests[role]);
    assert.equal(report.manifest.rounds, 4); assert.deepEqual(report.cases.map(row => row.id), ['STCK', 'SMLP']);
    for (const item of report.cases) {
      assert.equal(item.trials.length, 5);
      assert.deepEqual(item.trials.map(row => [row.round, row.warmup]), [[0, true], [1, false], [2, false], [3, false], [4, false]]);
      for (const trial of item.trials) {
        const expected = forms.forms.find(row => row.case === trial.case && row.warmup === trial.warmup);
        assert.ok(expected); const actual = workSignature(trial);
        assert.deepEqual(actual, expected.signature, `Official work differs from prospective form: ${label}/${trial.case}/${trial.round}`);
        assert.equal(digest(actual), expected.signatureSha256);
        rows.push({ label, role, case: trial.case, round: trial.round, warmup: trial.warmup, actions: trial.actions,
          signatureSha256: digest(actual), passed: true });
      }
    }
  }
  assert.equal(rows.length, 40);
  const measured = rows.filter(row => !row.warmup), warmups = rows.filter(row => row.warmup);
  assert.equal(measured.length, 32); assert.equal(measured.reduce((sum, row) => sum + row.actions, 0), 400);
  assert.equal(warmups.length, 8); assert.equal(warmups.reduce((sum, row) => sum + row.actions, 0), 24);
  for (const [path, record] of inputs) assert.deepEqual(await fp(path), record);
  const value = { schema: 'logos-engine.followup-strict-work-verification.v1', status: 'passed', recordedAt: new Date().toISOString(),
    generator: await fp(SCRIPT), nativeDigests: forms.nativeDigests, forms: await fp(formsPath),
    checkedTrials: rows.length, measuredSessions: 32, measuredActions: 400, excludedWarmupSessions: 8, excludedWarmupActions: 24,
    structuralExemptions: [], excludedMeasuredSessions: 0, excludedOutliers: 0, checks: rows,
    inputs: [...inputs.values()].filter(row => !row.path.startsWith('/')),
    watchedExternalInputs: [...inputs.values()].filter(row => row.path.startsWith('/')),
    qualification: 'Every official measured and warmup trial has the exact work signature declared by the earlier functional capture. This validates work identity, not the numerical budget; the unchanged global-cost tools decide that separately.' };
  await writeFile(output, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: value.status, checkedTrials: 40, output: relative(ROOT, output) }));
}

await main();
