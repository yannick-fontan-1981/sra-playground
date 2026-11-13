import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_OFFICIAL_PERFORMANCE_PATHS = Object.freeze([
  'scripts/measure-native-loop-costs.mjs',
  'scripts/native-loop-session-adapter.mjs',
  'scripts/verify-native-loop-runner-manifest.mjs',
  'scripts/run-native-region-official-benchmark.mjs',
  'tests/helpers/v6-live-game-campaign.ts',
  'src/runtime/v6-agent-worker.ts',
  'src/benchmarks/native-region-official-benchmark.ts',
  'benchmarks/native-region-official.html',
  'docs/migration/v6-delivery-roadmap.md',
  'docs/recovery/native-loop-source-refs.json',
]);

export const REGISTRY_PROGRESS_PATH = 'docs/migration/v6-entry-point-progress.json';
export const NATIVE_RUNNER_MANIFEST_PATH = 'docs/recovery/native-loop-runner-manifest.json';
export const REQUIRED_NATIVE_RUNNERS = Object.freeze(['A/STCK', 'A/SMLP', 'B/STCK', 'B/SMLP']);
export const READY_MANIFEST_STATUS = 'ready-for-official-abba-measurement';
export const QUALIFIED_MANIFEST_STATUS = 'qualified-functionally-and-performance';

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function normalizeRunners(manifest) {
  if (Array.isArray(manifest.runners)) {
    return {
      schema: 'explicit-runner-array-v1',
      byId: Object.fromEntries(manifest.runners.map(runner => [runner?.id, runner])),
    };
  }
  if (manifest.runners && typeof manifest.runners === 'object') {
    return {
      schema: 'legacy-evidenced-runner-map-v1',
      byId: manifest.runners,
    };
  }
  return { schema: 'invalid', byId: {} };
}

function manifestEvidenceRefs(manifest) {
  return [
    manifest?.sourceRefs?.proof,
    manifest?.transport?.parityProof,
    manifest?.corpus?.qualificationProof,
    manifest?.officialMeasurement?.proof,
  ].filter(nonEmptyString);
}

function validateMeasurement(manifest, root) {
  const measurement = manifest?.officialMeasurement;
  if (manifest.status === READY_MANIFEST_STATUS) {
    const valid = measurement?.executed === false
      && (measurement.result === null || measurement.results === null || measurement.results === undefined);
    return {
      executed: false,
      accepted: false,
      proofPresent: false,
      valid,
      reason: valid
        ? 'official ABBA inputs are ready and no result is claimed yet'
        : 'pre-measurement manifest claims an incompatible measurement state',
    };
  }

  if (manifest.status !== QUALIFIED_MANIFEST_STATUS) {
    return {
      executed: false,
      accepted: false,
      proofPresent: false,
      valid: false,
      reason: 'unsupported runner manifest lifecycle status',
    };
  }

  const proofPath = measurement?.proof;
  const proofPresent = nonEmptyString(proofPath) && existsSync(resolve(root, proofPath));
  const threshold = Number(manifest?.protocol?.acceptance?.thresholdPercent);
  const gameResults = measurement?.results;
  const gamesAccepted = ['STCK', 'SMLP'].every(game => {
    const result = gameResults?.[game];
    return result?.accepted === true
      && Number.isFinite(result.relativeIncreasePercent)
      && Number.isFinite(threshold)
      && result.relativeIncreasePercent < threshold;
  });
  const valid = measurement?.executed === true
    && measurement.accepted === true
    && measurement.sampleRemoval === 0
    && measurement.retries === 0
    && proofPresent
    && gamesAccepted;

  return {
    executed: measurement?.executed === true,
    accepted: valid,
    proofPresent,
    proofPath: nonEmptyString(proofPath) ? proofPath : null,
    runId: Number.isInteger(measurement?.runId) ? measurement.runId : null,
    valid,
    reason: valid
      ? 'official ABBA proof exists and both games pass the strict per-game threshold'
      : 'qualified manifest lacks a complete accepted official ABBA proof',
  };
}

export function validateNativeRunnerManifest(root = process.cwd()) {
  const path = resolve(root, NATIVE_RUNNER_MANIFEST_PATH);
  if (!existsSync(path)) {
    return {
      present: false,
      valid: false,
      schema: 'missing',
      missingRunners: [...REQUIRED_NATIVE_RUNNERS],
      missingEvidence: [],
      measurement: {
        executed: false,
        accepted: false,
        proofPresent: false,
        valid: false,
        reason: 'native runner manifest is missing',
      },
      reason: 'native runner manifest is missing',
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {
      present: true,
      valid: false,
      schema: 'invalid-json',
      missingRunners: [...REQUIRED_NATIVE_RUNNERS],
      missingEvidence: [],
      measurement: {
        executed: false,
        accepted: false,
        proofPresent: false,
        valid: false,
        reason: 'native runner manifest is not valid JSON',
      },
      reason: 'native runner manifest is not valid JSON',
    };
  }

  const identityValid = manifest?.version === 1
    && [READY_MANIFEST_STATUS, QUALIFIED_MANIFEST_STATUS].includes(manifest.status);
  const normalized = normalizeRunners(manifest ?? {});
  const globalCorpusRef = manifest?.corpus?.id;
  const globalTimingScope = manifest?.timing?.scope;
  const globalEvidence = manifestEvidenceRefs(manifest ?? {});
  const missingEvidence = globalEvidence.filter(reference => !existsSync(resolve(root, reference)));
  const hasDurableGlobalEvidence = globalEvidence.length >= 3 && missingEvidence.length === 0;

  const missingRunners = [];
  for (const key of REQUIRED_NATIVE_RUNNERS) {
    const runner = normalized.byId[key];
    const [variant, game] = key.split('/');
    const evidence = Array.isArray(runner?.evidenceRefs)
      ? runner.evidenceRefs
      : globalEvidence;
    const runnerRef = runner?.runnerRef ?? runner?.factory;
    const corpusRef = runner?.corpusRef ?? globalCorpusRef;
    const timingScope = runner?.timingScope ?? globalTimingScope;
    if (
      !runner
      || runner.variant !== variant
      || runner.game !== game
      || !nonEmptyString(runnerRef)
      || !nonEmptyString(runner.sourceRef)
      || !Number.isInteger(runner.seed)
      || !nonEmptyString(corpusRef)
      || !nonEmptyString(timingScope)
      || !Array.isArray(evidence)
      || evidence.length === 0
      || !evidence.every(nonEmptyString)
      || (normalized.schema === 'explicit-runner-array-v1' && !hasDurableGlobalEvidence)
    ) {
      missingRunners.push(key);
    }
  }

  const measurement = validateMeasurement(manifest ?? {}, root);
  const valid = identityValid
    && normalized.schema !== 'invalid'
    && missingRunners.length === 0
    && missingEvidence.length === 0
    && measurement.valid;

  return {
    present: true,
    valid,
    schema: normalized.schema,
    status: manifest?.status ?? null,
    missingRunners,
    missingEvidence,
    measurement,
    reason: valid
      ? measurement.accepted
        ? 'all four explicit native runners and the accepted official ABBA proof are durable'
        : 'all four explicit native runners have durable corpus and timing evidence'
      : !identityValid
        ? 'native runner manifest identity or lifecycle status is invalid'
        : missingRunners.length > 0
          ? 'one or more native runners lack durable corpus or timing evidence'
          : missingEvidence.length > 0
            ? 'one or more manifest evidence files are missing'
            : measurement.reason,
  };
}

export function checkOfficialPerformanceReadiness(root = process.cwd()) {
  const missing = REQUIRED_OFFICIAL_PERFORMANCE_PATHS.filter(path => !existsSync(resolve(root, path)));
  const runnerManifest = validateNativeRunnerManifest(root);
  const ready = missing.length === 0 && runnerManifest.valid;
  const performanceQualified = ready && runnerManifest.measurement.accepted;
  const registryProgressPresent = existsSync(resolve(root, REGISTRY_PROGRESS_PATH));
  return {
    ready,
    performanceQualified,
    missing,
    required: [...REQUIRED_OFFICIAL_PERFORMANCE_PATHS],
    runnerManifest,
    separateRegistryGate: {
      path: REGISTRY_PROGRESS_PATH,
      present: registryProgressPresent,
      blocksPerformanceQualification: false,
      reason: 'entry-point registry progress gates count/parity claims, not the already evidenced STCK/SMLP cost protocol',
    },
    status: performanceQualified
      ? 'official-performance-qualified'
      : ready
        ? 'official-performance-runner-inputs-present'
        : 'functionally-qualified-official-performance-to-confirm',
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = checkOfficialPerformanceReadiness();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
