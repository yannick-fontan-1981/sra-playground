import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  NATIVE_RUNNER_MANIFEST_PATH,
  REQUIRED_NATIVE_RUNNERS,
  REQUIRED_OFFICIAL_PERFORMANCE_PATHS,
  checkOfficialPerformanceReadiness,
  validateNativeRunnerManifest,
} from '../scripts/check-op01-op31-c7-readiness.mjs';

function write(root: string, relative: string, content = ''): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function writeRequiredPaths(root: string): void {
  for (const relative of REQUIRED_OFFICIAL_PERFORMANCE_PATHS) write(root, relative);
}

function validManifest() {
  return {
    version: 1,
    runners: Object.fromEntries(REQUIRED_NATIVE_RUNNERS.map(key => {
      const [variant, game] = key.split('/');
      return [key, {
        variant,
        game,
        runnerRef: `runner:${key}`,
        corpusRef: `corpus:${game}`,
        timingScope: 'complete native session around the qualified action loop',
        evidenceRefs: [`evidence:${key}`],
      }];
    })),
  };
}

test('C7 readiness refuses official qualification when harness files are missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-missing-'));
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [...REQUIRED_OFFICIAL_PERFORMANCE_PATHS]);
  assert.equal(result.runnerManifest.present, false);
  assert.equal(result.status, 'functionally-qualified-official-performance-to-confirm');
});

test('C7 readiness remains false when harness files exist but runner manifest is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-no-runners-'));
  writeRequiredPaths(root);
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.runnerManifest.missingRunners, [...REQUIRED_NATIVE_RUNNERS]);
});

test('runner manifest rejects an incomplete four-runner declaration', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-partial-runners-'));
  const manifest = validManifest();
  delete manifest.runners['B/SMLP'];
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(manifest));
  const result = validateNativeRunnerManifest(root);
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingRunners, ['B/SMLP']);
});

test('C7 readiness passes only with every harness path and all four evidenced runners', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-ready-'));
  writeRequiredPaths(root);
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(validManifest()));
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.runnerManifest.valid, true);
  assert.deepEqual(result.runnerManifest.missingRunners, []);
  assert.equal(result.status, 'official-performance-runner-inputs-present');
});
