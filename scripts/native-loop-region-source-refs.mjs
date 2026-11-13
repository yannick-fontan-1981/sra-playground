import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const NATIVE_REGION_SOURCE_REF_VERSION = 1;

export const NATIVE_REGION_COMMON_COMPONENTS = Object.freeze([
  '.github/workflows/lot9b-official-native-region-abba.yml',
  'benchmarks/native-region-official.html',
  'package-lock.json',
  'package.json',
  'public/python/custom-games.zip',
  'public/python/custom_level_navigation.py',
  'public/python/game_bridge.py',
  'public/python/official_adapter.py',
  'scripts/measure-native-loop-costs.mjs',
  'scripts/native-loop-browser-worker-dispatch.mjs',
  'scripts/native-loop-explicit-runners.mjs',
  'scripts/native-loop-game-bridge-session.mjs',
  'scripts/native-loop-public-corpus-runner.mjs',
  'scripts/native-loop-region-action6-corpus.mjs',
  'scripts/native-loop-region-benchmark-runners.mjs',
  'scripts/native-loop-region-public-action6-probe.mjs',
  'scripts/native-loop-session-adapter.mjs',
  'scripts/prepare-python.mjs',
  'scripts/python-runtime-assets.json',
  'scripts/run-native-region-official-benchmark.mjs',
  'src/benchmarks/native-region-official-benchmark.ts',
  'src/benchmarks/native-region-official-config.ts',
  'src/runtime/browser-games.ts',
  'src/runtime/game-worker.ts',
  'vite.config.ts',
]);

export const NATIVE_REGION_CANDIDATE_COMPONENTS = Object.freeze([
  'scripts/native-loop-region-candidate-hook.mjs',
  'src/logos-engine/v6-public-observation-delta.ts',
  'src/logos-engine/v6-region-intervention-owner.ts',
  'src/logos-engine/v6-region-intervention.ts',
  'src/logos-engine/v6-region-public-evidence.ts',
  'src/runtime/contracts.ts',
]);

export const NATIVE_REGION_EXECUTION_CONTRACT = Object.freeze({
  corpusRef: 'native-region-action6-corpus-v1',
  seed: 0,
  startLevel: 1,
  timingScope:
    'after initial public observation, through policy/hook/action loops, ending after the returned observation of the requested final action',
  transport:
    'BrowserGameRuntime -> game-worker.ts -> Pyodide -> game_bridge.py -> custom-games.zip',
  methodRefStrategy:
    'native-region-singleton:<game>:<invocationIndex>:<actionIndex>',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

function canonicalText(value) {
  return JSON.stringify(canonical(value));
}

function validatePathSet(paths, label) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new TypeError(`${label} must be a non-empty array`);
  }
  const sorted = [...paths].sort();
  if (new Set(paths).size !== paths.length) {
    throw new Error(`${label} contains duplicate paths`);
  }
  if (JSON.stringify(paths) !== JSON.stringify(sorted)) {
    throw new Error(`${label} must be sorted`);
  }
  for (const path of paths) {
    if (typeof path !== 'string' || path.length === 0 || path.startsWith('/') || path.includes('..')) {
      throw new TypeError(`${label} contains invalid repository path`);
    }
  }
}

export async function hashSourceComponents(paths, read = readFile) {
  validatePathSet(paths, 'source component paths');
  const components = [];
  for (const path of paths) {
    const bytes = await read(path);
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    components.push({
      path,
      bytes: buffer.byteLength,
      sha256: sha256(buffer),
    });
  }
  return components;
}

export function buildNativeRegionSourceRefs({
  commonComponents,
  candidateComponents,
  commitSha = process.env.GITHUB_SHA ?? null,
}) {
  if (!Array.isArray(commonComponents) || commonComponents.length === 0) {
    throw new TypeError('commonComponents must be non-empty');
  }
  if (!Array.isArray(candidateComponents) || candidateComponents.length === 0) {
    throw new TypeError('candidateComponents must be non-empty');
  }
  const commonPaths = commonComponents.map(item => item.path);
  const candidatePaths = candidateComponents.map(item => item.path);
  validatePathSet(commonPaths, 'common component paths');
  validatePathSet(candidatePaths, 'candidate component paths');
  const overlap = commonPaths.filter(path => candidatePaths.includes(path));
  if (overlap.length > 0) {
    throw new Error(`common/candidate component overlap: ${overlap.join(', ')}`);
  }

  const commonRoot = sha256(canonicalText(commonComponents));
  const candidateRoot = sha256(canonicalText(candidateComponents));
  const commonProfile = {
    version: NATIVE_REGION_SOURCE_REF_VERSION,
    commonRoot,
    execution: NATIVE_REGION_EXECUTION_CONTRACT,
  };
  const referenceProfile = {
    ...commonProfile,
    variant: 'A',
    regionHook: 'disabled',
  };
  const candidateProfile = {
    ...commonProfile,
    variant: 'B',
    regionHook: 'enabled',
    candidateRoot,
  };
  const referenceDigest = sha256(canonicalText(referenceProfile));
  const candidateDigest = sha256(canonicalText(candidateProfile));

  return {
    version: NATIVE_REGION_SOURCE_REF_VERSION,
    generatedFromCommit: commitSha,
    commonRoot,
    candidateRoot,
    reference: {
      sourceRef: `lot9b-region-v1:A:${referenceDigest}`,
      profile: referenceProfile,
    },
    candidate: {
      sourceRef: `lot9b-region-v1:B:${candidateDigest}`,
      profile: candidateProfile,
    },
    commonComponents,
    candidateComponents,
    invariants: {
      commonComponentsIdentical: true,
      sameTransport: true,
      sameCorpus: true,
      sameSeed: true,
      sameStartLevel: true,
      onlyMeasuredDifference:
        'B executes the real region_intervention hook; A leaves that hook disabled',
    },
  };
}

export async function computeNativeRegionSourceRefs(options = {}) {
  const read = options.read ?? readFile;
  const commonComponents = await hashSourceComponents(
    options.commonPaths ?? NATIVE_REGION_COMMON_COMPONENTS,
    read,
  );
  const candidateComponents = await hashSourceComponents(
    options.candidatePaths ?? NATIVE_REGION_CANDIDATE_COMPONENTS,
    read,
  );
  return buildNativeRegionSourceRefs({
    commonComponents,
    candidateComponents,
    commitSha: options.commitSha ?? process.env.GITHUB_SHA ?? null,
  });
}

async function main() {
  const outputIndex = process.argv.indexOf('--output');
  const verifyIndex = process.argv.indexOf('--verify');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  const verify = verifyIndex >= 0 ? process.argv[verifyIndex + 1] : undefined;
  if (outputIndex >= 0 && !output) throw new Error('--output requires a path');
  if (verifyIndex >= 0 && !verify) throw new Error('--verify requires a path');

  const report = await computeNativeRegionSourceRefs();
  if (verify) {
    const expected = JSON.parse(await readFile(verify, 'utf8'));
    const comparable = structuredClone(report);
    const expectedComparable = structuredClone(expected);
    comparable.generatedFromCommit = null;
    expectedComparable.generatedFromCommit = null;
    delete comparable.qualification;
    delete expectedComparable.qualification;
    if (canonicalText(comparable) !== canonicalText(expectedComparable)) {
      throw new Error(`native Region source refs differ from ${verify}`);
    }
  }
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    commonRoot: report.commonRoot,
    candidateRoot: report.candidateRoot,
    referenceSourceRef: report.reference.sourceRef,
    candidateSourceRef: report.candidate.sourceRef,
    commonComponentCount: report.commonComponents.length,
    candidateComponentCount: report.candidateComponents.length,
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
