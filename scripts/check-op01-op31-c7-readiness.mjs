import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_OFFICIAL_PERFORMANCE_PATHS = Object.freeze([
  'scripts/measure-native-loop-costs.mjs',
  'scripts/native-loop-session-adapter.mjs',
  'tests/helpers/v6-live-game-campaign.ts',
  'src/runtime/v6-agent-worker.ts',
  'docs/migration/v6-delivery-roadmap.md',
  'docs/migration/v6-entry-point-progress.json',
]);

export const NATIVE_RUNNER_MANIFEST_PATH = 'docs/recovery/native-loop-runner-manifest.json';
export const REQUIRED_NATIVE_RUNNERS = Object.freeze(['A/STCK', 'A/SMLP', 'B/STCK', 'B/SMLP']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

export function validateNativeRunnerManifest(root = process.cwd()) {
  const path = resolve(root, NATIVE_RUNNER_MANIFEST_PATH);
  if (!existsSync(path)) {
    return {
      present: false,
      valid: false,
      missingRunners: [...REQUIRED_NATIVE_RUNNERS],
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
      missingRunners: [...REQUIRED_NATIVE_RUNNERS],
      reason: 'native runner manifest is not valid JSON',
    };
  }

  if (!manifest || manifest.version !== 1 || !manifest.runners || typeof manifest.runners !== 'object') {
    return {
      present: true,
      valid: false,
      missingRunners: [...REQUIRED_NATIVE_RUNNERS],
      reason: 'native runner manifest must declare version 1 and runners',
    };
  }

  const missingRunners = [];
  for (const key of REQUIRED_NATIVE_RUNNERS) {
    const runner = manifest.runners[key];
    const [variant, game] = key.split('/');
    const evidence = runner?.evidenceRefs;
    if (
      !runner
      || runner.variant !== variant
      || runner.game !== game
      || !nonEmptyString(runner.runnerRef)
      || !nonEmptyString(runner.sourceRef)
      || !Number.isInteger(runner.seed)
      || !nonEmptyString(runner.corpusRef)
      || !nonEmptyString(runner.timingScope)
      || !Array.isArray(evidence)
      || evidence.length === 0
      || !evidence.every(nonEmptyString)
    ) {
      missingRunners.push(key);
    }
  }

  return {
    present: true,
    valid: missingRunners.length === 0,
    missingRunners,
    reason: missingRunners.length === 0
      ? 'all four native runners have durable corpus/timing evidence'
      : 'one or more native runners lack durable corpus/timing evidence',
  };
}

export function checkOfficialPerformanceReadiness(root = process.cwd()) {
  const missing = REQUIRED_OFFICIAL_PERFORMANCE_PATHS.filter(path => !existsSync(resolve(root, path)));
  const runnerManifest = validateNativeRunnerManifest(root);
  const ready = missing.length === 0 && runnerManifest.valid;
  return {
    ready,
    missing,
    required: [...REQUIRED_OFFICIAL_PERFORMANCE_PATHS],
    runnerManifest,
    status: ready
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
