import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  REQUIRED_OFFICIAL_PERFORMANCE_PATHS,
  checkOfficialPerformanceReadiness,
} from '../scripts/check-op01-op31-c7-readiness.mjs';

test('C7 readiness refuses official qualification when required harness files are missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-missing-'));
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, [...REQUIRED_OFFICIAL_PERFORMANCE_PATHS]);
  assert.equal(result.status, 'functionally-qualified-official-performance-to-confirm');
});

test('C7 readiness passes only when every required official harness path exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-ready-'));
  for (const relative of REQUIRED_OFFICIAL_PERFORMANCE_PATHS) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
  }
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.status, 'official-performance-harness-present');
});
