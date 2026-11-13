import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { OFFICIAL_COST_PROTOCOL, median } from './measure-native-loop-costs.mjs';
import {
  computeNativeRegionSourceRefs,
  NATIVE_REGION_EXECUTION_CONTRACT,
} from './native-loop-region-source-refs.mjs';

const READY_STATUS = 'ready-for-official-abba-measurement';
const QUALIFIED_STATUS = 'qualified-functionally-and-performance';
const NUMERIC_TOLERANCE = 1e-9;

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

function approximateEqual(actual, expected, label, tolerance = NUMERIC_TOLERANCE) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(`${label} must compare finite numbers`);
  }
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} mismatch\nactual=${actual}\nexpected=${expected}\ntolerance=${tolerance}`);
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

function relativeIncreasePercent(candidate, reference) {
  if (reference === 0) return candidate === 0 ? 0 : Number.POSITIVE_INFINITY;
  return 100 * (candidate / reference - 1);
}

async function verifyQualifiedMeasurement(manifest) {
  const measurement = manifest.officialMeasurement;
  if (
    measurement?.executed !== true
    || measurement.accepted !== true
    || typeof measurement.proof !== 'string'
    || measurement.proof.length === 0
  ) {
    throw new Error('qualified manifest requires an accepted executed measurement and proof path');
  }
  if (measurement.sampleRemoval !== 0 || measurement.retries !== 0) {
    throw new Error('qualified measurement must retain every sample and use no hidden retry');
  }

  const proof = JSON.parse(await readFile(measurement.proof, 'utf8'));
  if (proof.version !== 1 || proof.status !== 'official-performance-qualified' || proof.accepted !== true) {
    throw new Error('official performance proof identity or verdict is invalid');
  }

  equal(proof.sourceRefs.reference, manifest.sourceRefs.reference, 'proof A sourceRef');
  equal(proof.sourceRefs.candidate, manifest.sourceRefs.candidate, 'proof B sourceRef');
  equal(proof.sourceRefs.corpus, manifest.corpus.id, 'proof corpus');
  equal(proof.protocol.seriesOrder, OFFICIAL_COST_PROTOCOL.seriesOrder, 'proof series order');
  equal(proof.protocol.invocations, manifest.protocol.totals.invocations, 'proof invocation count');
  equal(proof.protocol.warmupSessions, manifest.protocol.totals.warmupSessions, 'proof warmup session count');
  equal(proof.protocol.warmupActions, manifest.protocol.totals.warmupActions, 'proof warmup action count');
  equal(proof.protocol.measuredSessions, manifest.protocol.totals.measuredSessions, 'proof measured session count');
  equal(proof.protocol.measuredActions, manifest.protocol.totals.measuredActions, 'proof measured action count');
  equal(proof.protocol.sampleRemoval, 0, 'proof sample removal');
  equal(proof.protocol.retries, 0, 'proof retries');
  equal(measurement.runId, proof.measurement.runId, 'measurement run id');
  equal(measurement.jobId, proof.measurement.jobId, 'measurement job id');
  equal(measurement.measuredCommit, proof.measurement.measuredCommit, 'measured commit');
  equal(measurement.measurementIsolation, proof.measurement.measurementIsolation, 'measurement isolation');

  for (const game of ['STCK', 'SMLP']) {
    const gameProof = proof.games?.[game];
    const manifestResult = measurement.results?.[game];
    if (!gameProof || !manifestResult) throw new Error(`qualified measurement is missing ${game}`);
    if (!Array.isArray(gameProof.referenceDurationsMs) || gameProof.referenceDurationsMs.length !== 8) {
      throw new Error(`${game} proof must retain eight reference samples`);
    }
    if (!Array.isArray(gameProof.candidateDurationsMs) || gameProof.candidateDurationsMs.length !== 8) {
      throw new Error(`${game} proof must retain eight candidate samples`);
    }

    const referenceMedian = median(gameProof.referenceDurationsMs);
    const candidateMedian = median(gameProof.candidateDurationsMs);
    const increase = relativeIncreasePercent(candidateMedian, referenceMedian);
    approximateEqual(referenceMedian, gameProof.referenceMedianMs, `${game} proof reference median`);
    approximateEqual(candidateMedian, gameProof.candidateMedianMs, `${game} proof candidate median`);
    approximateEqual(increase, gameProof.relativeIncreasePercent, `${game} proof relative increase`);
    approximateEqual(referenceMedian, manifestResult.referenceMedianMs, `${game} manifest reference median`);
    approximateEqual(candidateMedian, manifestResult.candidateMedianMs, `${game} manifest candidate median`);
    approximateEqual(increase, manifestResult.relativeIncreasePercent, `${game} manifest relative increase`);

    if (increase >= OFFICIAL_COST_PROTOCOL.globalThresholdPercent) {
      throw new Error(`${game} official result must remain strictly below +${OFFICIAL_COST_PROTOCOL.globalThresholdPercent}%`);
    }
    if (gameProof.accepted !== true || manifestResult.accepted !== true) {
      throw new Error(`${game} official result must be accepted in proof and manifest`);
    }
  }

  return {
    proof: measurement.proof,
    runId: measurement.runId,
    accepted: true,
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
  if (![READY_STATUS, QUALIFIED_STATUS].includes(manifest.status)) {
    throw new Error('runner manifest has an unsupported lifecycle status');
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

  if (!Array.isArray(manifest.runners)) throw new Error('runner manifest must expose the four explicit runners as an array');
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
    if (typeof runner.factory !== 'string' || runner.factory.length === 0) {
      throw new Error(`${runner.id} factory is missing`);
    }
  }

  let officialMeasurement;
  if (manifest.status === READY_STATUS) {
    if (manifest.officialMeasurement?.executed !== false || manifest.officialMeasurement?.result !== null) {
      throw new Error('pre-measurement manifest must not claim an official ABBA result');
    }
    officialMeasurement = { accepted: false, executed: false, proof: null };
  } else {
    officialMeasurement = {
      executed: true,
      ...(await verifyQualifiedMeasurement(manifest)),
    };
  }

  return {
    referenceSourceRef: computedSourceRefs.reference.sourceRef,
    candidateSourceRef: computedSourceRefs.candidate.sourceRef,
    runners: runners.map(runner => runner.id),
    protocolTotals: manifest.protocol.totals,
    status: manifest.status,
    officialMeasurement,
  };
}

async function main() {
  const result = await verifyNativeLoopRunnerManifest();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
