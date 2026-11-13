import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateNativeRegionBenchmarkConfig,
} from '../src/benchmarks/native-region-official-config.ts';

function config(manifestStatus: string): Record<string, unknown> {
  return {
    manifestVersion: 1,
    manifestStatus,
    referenceSourceRef: 'lot9b-region-v1:A:reference',
    candidateSourceRef: 'lot9b-region-v1:B:candidate',
    corpusRef: 'native-region-action6-corpus-v1',
    measurementIsolation: 'test-isolation',
    requestedAt: '2026-11-13T00:00:00.000Z',
  };
}

test('official benchmark accepts a manifest ready for its first ABBA measurement', () => {
  const validated = validateNativeRegionBenchmarkConfig(
    config('ready-for-official-abba-measurement'),
  );
  assert.equal(validated.manifestStatus, 'ready-for-official-abba-measurement');
});

test('official benchmark accepts a previously accepted manifest for repeat qualification', () => {
  const validated = validateNativeRegionBenchmarkConfig(
    config('official-abba-measurement-accepted'),
  );
  assert.equal(validated.manifestStatus, 'official-abba-measurement-accepted');
});

test('official benchmark rejects unknown manifest states', () => {
  assert.throws(
    () => validateNativeRegionBenchmarkConfig(config('unqualified')),
    /manifest status is unsupported/,
  );
});

test('official benchmark rejects incomplete source identity', () => {
  const input = config('ready-for-official-abba-measurement');
  input.candidateSourceRef = '';
  assert.throws(
    () => validateNativeRegionBenchmarkConfig(input),
    /candidateSourceRef must be a non-empty string/,
  );
});
