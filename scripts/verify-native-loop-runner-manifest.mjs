import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { OFFICIAL_COST_PROTOCOL } from './measure-native-loop-costs.mjs';
import {
  computeNativeRegionSourceRefs,
  NATIVE_REGION_EXECUTION_CONTRACT,
} from './native-loop-region-source-refs.mjs';

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function equal(actual, expected, label) {
  if (stable(actual) !== stable(expected)) {
    throw new Error(`${label} mismatch\nactual=${stable(actual)}\nexpected=${stable(expected)}`);
  }
}

function coreSourceRefReport(report) {
  return {
    version: report.version,
    commonRoot: report.commonRoot,
    candidateRoot: report.candidateRoot,
    reference: report.reference,
    candidate: report.candidate,
    commonComponents: report.commonComponents,
    candidateComponents: report.candidateComponents,
    invariants: report.invariants,
  };
}

function expectedProtocolTotals() {
  const series = OFFICIAL_COST_PROTOCOL.seriesOrder.length;
  const gameSpecs = Object.values(OFFICIAL_COST_PROTOCOL.games);
  return {
    invocations: series * gameSpecs.reduce(
      (sum, spec) => sum + 1 + spec.measuredSessionsPerSeries,
      0,
    ),
    warmupSessions: series * gameSpecs.length,
    warmupActions: series * gameSpecs.reduce((sum, spec) => sum + spec.warmupActions, 0),
    measuredSessions: series * gameSpecs.reduce(
      (sum, spec) => sum + spec.measuredSessionsPerSeries,
      0,
    ),
    measuredActions: series * gameSpecs.reduce(
      (sum, spec) => sum + spec.measuredActions * spec.measuredSessionsPerSeries,
      0,
    ),
  };
}

export async function verifyNativeLoopRunnerManifest({
  sourceRefsPath = 'docs/recovery/native-loop-source-refs.json',
  manifestPath = 'docs/recovery/native-loop-runner-manifest.json',
} = {}) {
  const storedSourceRefs = JSON.parse(await readFile(sourceRefsPath, 'utf8'));
  const computedSourceRefs = await computeNativeRegionSourceRefs({ commitSha: null });
  equal(
    coreSourceRefReport(storedSourceRefs),
    coreSourceRefReport(computedSourceRefs),
    'stored native Region source refs',
  );

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1 || manifest.kind !== 'reconstructed-native-region-benchmark-manifest') {
    throw new Error('runner manifest identity is invalid');
  }
  if (manifest.status !== 'ready-for-official-abba-measurement') {
    throw new Error('runner manifest is not ready for official ABBA measurement');
  }
  if (manifest.historicalRunnerIdentityRecovered !== false || manifest.historicalCorpusRecovered !== false) {
    throw new Error('runner manifest must not claim recovered historical identity');
  }

  equal(manifest.sourceRefs.commonRoot, computedSourceRefs.commonRoot, 'manifest commonRoot');
  equal(manifest.sourceRefs.candidateRoot, computedSourceRefs.candidateRoot, 'manifest candidateRoot');
  equal(manifest.sourceRefs.reference, computedSourceRefs.reference.sourceRef, 'manifest A sourceRef');
  equal(manifest.sourceRefs.candidate, computedSourceRefs.candidate.sourceRef, 'manifest B sourceRef');
  equal(manifest.corpus.id, NATIVE_REGION_EXECUTION_CONTRACT.corpusRef, 'manifest corpus');
  equal(manifest.corpus.seed, NATIVE_REGION_EXECUTION_CONTRACT.seed, 'manifest seed');
  equal(manifest.corpus.startLevel, NATIVE_REGION_EXECUTION_CONTRACT.startLevel, 'manifest startLevel');
  equal(manifest.corpus.methodRefStrategy, NATIVE_REGION_EXECUTION_CONTRACT.methodRefStrategy, 'methodRef strategy');
  equal(manifest.transport.path, NATIVE_REGION_EXECUTION_CONTRACT.transport, 'manifest transport');
  equal(manifest.timing.scope, NATIVE_REGION_EXECUTION_CONTRACT.timingScope, 'manifest timing scope');

  equal(manifest.protocol.seriesOrder, OFFICIAL_COST_PROTOCOL.seriesOrder, 'series order');
  equal(manifest.protocol.variantBySeries, OFFICIAL_COST_PROTOCOL.variantBySeries, 'series variants');
  equal(manifest.protocol.games, {
    STCK: {
      warmupActions: OFFICIAL_COST_PROTOCOL.games.STCK.warmupActions,
      measuredActions: OFFICIAL_COST_PROTOCOL.games.STCK.measuredActions,
      measuredSessionsPerSeries: OFFICIAL_COST_PROTOCOL.games.STCK.measuredSessionsPerSeries,
    },
    SMLP: {
      warmupActions: OFFICIAL_COST_PROTOCOL.games.SMLP.warmupActions,
      measuredActions: OFFICIAL_COST_PROTOCOL.games.SMLP.measuredActions,
      measuredSessionsPerSeries: OFFICIAL_COST_PROTOCOL.games.SMLP.measuredSessionsPerSeries,
    },
  }, 'game protocol');
  equal(manifest.protocol.totals, expectedProtocolTotals(), 'protocol totals');
  equal(manifest.protocol.acceptance.thresholdPercent, OFFICIAL_COST_PROTOCOL.globalThresholdPercent, 'threshold');
  equal(manifest.protocol.acceptance.strictlyLessThan, OFFICIAL_COST_PROTOCOL.thresholdIsStrict, 'strict threshold');
  equal(manifest.protocol.acceptance.crossGameCompensationAllowed, OFFICIAL_COST_PROTOCOL.crossGameCompensationAllowed, 'cross-game compensation');
  equal(manifest.protocol.acceptance.phaseOverrunBlocking, OFFICIAL_COST_PROTOCOL.phaseOverrunIsBlocking, 'phase blocking');
  equal(manifest.protocol.acceptance.measuredSampleRemovalAllowed, OFFICIAL_COST_PROTOCOL.measuredSampleRemovalAllowed, 'sample removal');

  const runners = [...manifest.runners].sort((a, b) => a.id.localeCompare(b.id));
  equal(runners.map(runner => runner.id), ['A/SMLP', 'A/STCK', 'B/SMLP', 'B/STCK'], 'runner identities');
  for (const runner of runners) {
    const expectedVariant = runner.id.startsWith('A/') ? 'A' : 'B';
    const expectedGame = runner.id.endsWith('/STCK') ? 'STCK' : 'SMLP';
    equal(runner.variant, expectedVariant, `${runner.id} variant`);
    equal(runner.game, expectedGame, `${runner.id} game`);
    equal(runner.sourceRef, expectedVariant === 'A'
      ? computedSourceRefs.reference.sourceRef
      : computedSourceRefs.candidate.sourceRef, `${runner.id} sourceRef`);
    equal(runner.regionHook, expectedVariant === 'A' ? 'disabled' : 'region_intervention', `${runner.id} Region hook`);
    equal(runner.seed, NATIVE_REGION_EXECUTION_CONTRACT.seed, `${runner.id} seed`);
    equal(runner.startLevel, NATIVE_REGION_EXECUTION_CONTRACT.startLevel, `${runner.id} startLevel`);
    equal(runner.warmupActions, OFFICIAL_COST_PROTOCOL.games[expectedGame].warmupActions, `${runner.id} warmup actions`);
    equal(runner.measuredActions, OFFICIAL_COST_PROTOCOL.games[expectedGame].measuredActions, `${runner.id} measured actions`);
  }

  if (manifest.officialMeasurement.executed !== false || manifest.officialMeasurement.result !== null) {
    throw new Error('manifest must remain pre-measurement until official ABBA is executed');
  }

  return {
    referenceSourceRef: computedSourceRefs.reference.sourceRef,
    candidateSourceRef: computedSourceRefs.candidate.sourceRef,
    runners: runners.map(runner => runner.id),
    protocolTotals: manifest.protocol.totals,
    status: manifest.status,
  };
}

async function main() {
  const result = await verifyNativeLoopRunnerManifest();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
