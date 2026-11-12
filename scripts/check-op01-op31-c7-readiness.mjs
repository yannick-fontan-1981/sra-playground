import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_OFFICIAL_PERFORMANCE_PATHS = Object.freeze([
  'scripts/measure-native-loop-costs.mjs',
  'tests/helpers/v6-live-game-campaign.ts',
  'src/runtime/v6-agent-worker.ts',
  'docs/migration/v6-delivery-roadmap.md',
  'docs/migration/v6-entry-point-progress.json',
]);

export function checkOfficialPerformanceReadiness(root = process.cwd()) {
  const missing = REQUIRED_OFFICIAL_PERFORMANCE_PATHS.filter(path => !existsSync(resolve(root, path)));
  return {
    ready: missing.length === 0,
    missing,
    required: [...REQUIRED_OFFICIAL_PERFORMANCE_PATHS],
    status: missing.length === 0
      ? 'official-performance-harness-present'
      : 'functionally-qualified-official-performance-to-confirm',
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = checkOfficialPerformanceReadiness();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
