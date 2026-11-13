import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  NATIVE_RUNNER_MANIFEST_PATH,
  QUALIFIED_MANIFEST_STATUS,
  READY_MANIFEST_STATUS,
  REGISTRY_PROGRESS_PATH,
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

function validLegacyManifest() {
  return {
    version: 1,
    status: READY_MANIFEST_STATUS,
    runners: Object.fromEntries(REQUIRED_NATIVE_RUNNERS.map(key => {
      const [variant, game] = key.split('/');
      return [key, {
        variant,
        game,
        runnerRef: `runner:${key}`,
        sourceRef: `source:${variant}`,
        seed: 0,
        corpusRef: `corpus:${game}`,
        timingScope: 'complete native session around the qualified action loop',
        evidenceRefs: [`evidence:${key}`],
      }];
    })),
    officialMeasurement: {
      executed: false,
      result: null,
    },
  };
}

function validQualifiedManifest() {
  return {
    version: 1,
    status: QUALIFIED_MANIFEST_STATUS,
    sourceRefs: {
      proof: 'evidence/source-refs.json',
    },
    transport: {
      parityProof: 'evidence/transport-parity.json',
    },
    corpus: {
      id: 'native-region-action6-corpus-v1',
      qualificationProof: 'evidence/corpus-proof.json',
    },
    timing: {
      scope: 'after initial public observation through the returned final observation',
    },
    protocol: {
      acceptance: {
        thresholdPercent: 10,
      },
    },
    runners: REQUIRED_NATIVE_RUNNERS.map(key => {
      const [variant, game] = key.split('/');
      return {
        id: key,
        variant,
        game,
        factory: `create${variant}${game}Runner`,
        sourceRef: `source:${variant}`,
        seed: 0,
      };
    }),
    officialMeasurement: {
      executed: true,
      accepted: true,
      runId: 123,
      sampleRemoval: 0,
      retries: 0,
      proof: 'evidence/official-performance.json',
      results: {
        STCK: {
          relativeIncreasePercent: 9.9,
          accepted: true,
        },
        SMLP: {
          relativeIncreasePercent: -1.5,
          accepted: true,
        },
      },
    },
  };
}

function writeQualifiedEvidence(root: string): void {
  write(root, 'evidence/source-refs.json', '{}');
  write(root, 'evidence/transport-parity.json', '{}');
  write(root, 'evidence/corpus-proof.json', '{}');
  write(root, 'evidence/official-performance.json', '{}');
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

test('legacy runner manifest rejects an incomplete four-runner declaration', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-partial-runners-'));
  const manifest = validLegacyManifest();
  delete manifest.runners['B/SMLP'];
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(manifest));
  const result = validateNativeRunnerManifest(root);
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingRunners, ['B/SMLP']);
});

test('pre-measurement readiness accepts the complete legacy evidenced runner map', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-ready-inputs-'));
  writeRequiredPaths(root);
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(validLegacyManifest()));
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, true);
  assert.equal(result.performanceQualified, false);
  assert.deepEqual(result.missing, []);
  assert.equal(result.runnerManifest.valid, true);
  assert.equal(result.runnerManifest.schema, 'legacy-evidenced-runner-map-v1');
  assert.equal(result.status, 'official-performance-runner-inputs-present');
});

test('post-measurement readiness accepts the modern explicit runner array and durable proof', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-qualified-'));
  writeRequiredPaths(root);
  writeQualifiedEvidence(root);
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(validQualifiedManifest()));
  const result = checkOfficialPerformanceReadiness(root);
  assert.equal(result.ready, true);
  assert.equal(result.performanceQualified, true);
  assert.equal(result.runnerManifest.valid, true);
  assert.equal(result.runnerManifest.schema, 'explicit-runner-array-v1');
  assert.equal(result.runnerManifest.measurement.accepted, true);
  assert.equal(result.status, 'official-performance-qualified');
  assert.equal(result.separateRegistryGate.path, REGISTRY_PROGRESS_PATH);
  assert.equal(result.separateRegistryGate.present, false);
  assert.equal(result.separateRegistryGate.blocksPerformanceQualification, false);
});

test('qualified manifest fails closed when its official proof file is missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-proof-missing-'));
  writeRequiredPaths(root);
  write(root, 'evidence/source-refs.json', '{}');
  write(root, 'evidence/transport-parity.json', '{}');
  write(root, 'evidence/corpus-proof.json', '{}');
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(validQualifiedManifest()));
  const result = validateNativeRunnerManifest(root);
  assert.equal(result.valid, false);
  assert.equal(result.measurement.proofPresent, false);
  assert.equal(result.measurement.accepted, false);
});

test('strict +10 percent threshold still fails qualification', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-c7-strict-threshold-'));
  writeRequiredPaths(root);
  writeQualifiedEvidence(root);
  const manifest = validQualifiedManifest();
  manifest.officialMeasurement.results.STCK.relativeIncreasePercent = 10;
  write(root, NATIVE_RUNNER_MANIFEST_PATH, JSON.stringify(manifest));
  const result = validateNativeRunnerManifest(root);
  assert.equal(result.valid, false);
  assert.equal(result.measurement.accepted, false);
});
