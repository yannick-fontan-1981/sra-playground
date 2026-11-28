import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { createGzip, gzipSync, gunzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_SEED, MODEL_CONTRACT, P05_FAMILIES, behaviorSignature, developmentSeeds,
  digest, generateP05Situation, randomSource, renameAndPermute } from './sic-p05-laboratory.mjs';
import { certifyP05 } from './sic-p05-oracle.mjs';
import { compareP05Situation } from './sic-p05-compare.mjs';
import { runP05Contrasts } from './sic-p05-contrasts.mjs';
import { frozenP05Provenance } from '../src/sic/p05-frozen-adapter.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const SOURCE_FILES = ['scripts/sic-p05-laboratory.mjs', 'scripts/sic-p05-oracle.mjs',
  'scripts/sic-p05-compare.mjs', 'scripts/sic-p05-campaign.mjs', 'scripts/sic-p05-contrasts.mjs',
  'scripts/sic-p05-p09-bridge.mjs', 'src/sic/p05-acquisition.ts', 'src/sic/p05-frozen-adapter.ts',
  'src/sic/controlled-parts.ts', 'src/sic/effect-composer.ts'];
const baseRevision = '20433007224accc36e3d7976696d9ee7a783a227';

function sourceProvenance() {
  const files = Object.fromEntries(SOURCE_FILES.map(file => [file, digest(readFileSync(join(root, file)))]));
  const frozenBlob = execFileSync('git', ['hash-object', 'src/sic/controlled-parts.ts'], { cwd: root, encoding: 'utf8' }).trim();
  if (frozenBlob !== frozenP05Provenance.gitBlob) throw new Error('Frozen P05 source was modified; comparison refused');
  // Blob recorded at baseRevision. A shallow CI checkout need not fetch unrelated
  // historical games/evidence merely to attest the unchanged composer.
  const expectedComposer = 'f54a624abaaa89e4d5363f41869017f4e7f99b35';
  const currentComposer = execFileSync('git', ['hash-object', 'src/sic/effect-composer.ts'], { cwd: root, encoding: 'utf8' }).trim();
  if (expectedComposer !== currentComposer) throw new Error('P09 composer differs from the frozen source');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--', ...SOURCE_FILES], { cwd: root, encoding: 'utf8' }).trim();
  return { baseRevision, revision, sourceFingerprint: digest(files), files, frozenBlob,
    p09ComposerBlob: currentComposer, dirtySource: Boolean(dirty), node: process.version };
}

const sum = (rows, fn) => rows.reduce((total, row) => total + (Number(fn(row)) || 0), 0);
function extent(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  return finite.length ? { min: finite[0], median: finite[Math.floor(finite.length / 2)], max: finite.at(-1),
    sum: finite.reduce((total, value) => total + value, 0) } : { min: null, median: null, max: null, sum: 0 };
}

export function summarizeP05(rows) {
  return {
    situations: rows.length,
    oracleSolvable: sum(rows, row => row.certified),
    expectedAcquisitions: sum(rows, row => row.expectedAcquisitions),
    candidateCompleteSituations: sum(rows, row => row.candidate.complete),
    correctlyAcquiredEffects: sum(rows, row => row.candidate.qualifiedAcquisitions),
    erroneousAttributions: sum(rows, row => row.candidate.erroneousAttributions),
    unsupportedClaims: sum(rows, row => row.candidate.unsupportedClaims),
    frozen: {
      comparisonScope: frozenP05Provenance.scope,
      qualifiedApiAvailable: false, qualifiedAcquisitions: 0,
      qualifiedSituationVerdict: 'not-representable-at-this-frozen-boundary',
      expectedMotionRows: sum(rows, row => row.frozen.expectedMotionRows),
      recordedCorrectMotionRows: sum(rows, row => row.frozen.recordedCorrectMotionRows),
      selectedCorrectMotionRows: sum(rows, row => row.frozen.selectedCorrectMotionRows),
      allMotionRowsRecordedSituations: sum(rows, row => row.frozen.recordedAllMotionRows),
      erroneousQualifiedAttributions: 0,
      note: 'Raw vectors and qualified contextual effects are different measures. No global SIC failure is inferred from an absent API.',
    },
    rawMotionAcquisitionGainSituations: sum(rows, row => row.candidate.complete && !row.frozen.recordedAllMotionRows),
    newQualificationSituations: sum(rows, row => row.candidate.complete),
    oracleExperimentGestures: extent(rows.map(row => row.oracleCertifiedGestures)),
    actualGesturesEachArm: extent(rows.map(row => row.actualGesturesEachArm)),
    firstAcquisitionGesture: extent(rows.map(row => row.firstAcquisitionGesture)),
    acquisitionEvidenceCompleteGesture: extent(rows.map(row => row.acquisitionEvidenceCompleteGesture)),
    oracleMinimality: 'not-claimed',
    stationaryAttempts: sum(rows, row => row.stationaryAttempts),
    noEffectAttempts: sum(rows, row => row.noEffectAttempts),
    justifiedStationaryAbstentions: sum(rows, row => row.justifiedStationaryAbstentions),
    staleProofsKeptSeparate: sum(rows, row => row.staleProofs),
    transfer: Object.fromEntries(['confirmed', 'refuted', 'restricted'].map(status => [status, sum(rows, row => row.transfer[status])])),
    choiceTasks: sum(rows, row => Boolean(row.choice)),
    correctChoices: sum(rows, row => row.choice?.success),
    choiceReplayGestures: sum(rows, row => row.choice?.replayGestures),
    choiceReplayBudget: 'Separate post-acquisition evaluation; one preparation + one command + maxLatency waits.',
    ablations: sum(rows, row => Boolean(row.ablation)),
    successfulLinkWithdrawals: sum(rows, row => row.ablation?.success),
    ablationsWithNoResidualSnapshotCopy: sum(rows, row => row.ablation?.residualCopies === 0),
    p09StillSolvableByAnotherAcquisition: sum(rows, row => row.ablation?.p09AfterWithdrawal.success),
    p09: { compositionsTested: sum(rows, row => row.p09.tested), replayedSuccesses: sum(rows, row => row.p09.success),
      gestures: extent(rows.map(row => row.p09.commands)), native: false },
    publicTraceDisagreements: sum(rows, row => row.publicTraceHash !== row.frozenPublicTraceHash
      || row.publicTraceHash !== row.independentTraceHash),
    native: { tested: 0, wins: 0, status: 'not-run; SS08–SS25 and the independent 2,000-case reserve remain sealed' },
  };
}

function gzipWriter(path) {
  mkdirSync(dirname(path), { recursive: true });
  const stream = createGzip({ level: 6 }), target = createWriteStream(path);
  stream.pipe(target);
  return { async write(value) { if (!stream.write(JSON.stringify(value) + '\n')) await once(stream, 'drain'); },
    async close() { stream.end(); await Promise.all([finished(stream), finished(target)]); } };
}

function qualityFailures(stats, contrasts) {
  const failures = [];
  if (stats.oracleSolvable !== stats.situations) failures.push('uncertified-positive-cases');
  if (stats.erroneousAttributions) failures.push('erroneous-attributions');
  if (stats.unsupportedClaims) failures.push('unsupported-claims');
  if (stats.publicTraceDisagreements) failures.push('arm-or-oracle-trace-disagreement');
  if (stats.ablations !== stats.successfulLinkWithdrawals) failures.push('causal-link-ablation-failed');
  if (contrasts.firstFailure) failures.push('negative-contrast-failed');
  // A candidate miss is a measurement, not an excuse to discard/re-generate a case.
  return failures;
}

function writeOutputs(out, configuration, rows, generation, contrasts, timing, examples = {}) {
  const stats = summarizeP05(rows), families = Object.fromEntries(configuration.families.map(id =>
    [id, { name: P05_FAMILIES.find(family => family.id === id).name,
      ...summarizeP05(rows.filter(row => row.family === id)) }]));
  const signatures = rows.map(row => row.behaviorHash);
  if (new Set(signatures).size !== rows.length) throw new Error('Global behavioral duplicate in positive quotas');
  const firstFailure = rows.find(row => row.candidate.erroneousAttributions || row.candidate.unsupportedClaims
    || !row.candidate.complete || !row.ablation?.success || !row.p09.success) ?? null;
  const stableRows = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
  const report = { protocol: 'P05-development-v1', configuration, stats, families, generation, contrasts,
    corpus: { uniqueBehaviorSignatures: signatures.length, signatureSetSha256: digest([...signatures].sort()),
      resultRowsSha256: digest(stableRows), evaluationOnly: ['privateSpec', 'oracle.policy', 'oracle.outcomes'],
      learnerInputs: ['public observations', 'public return IDs', 'public maxLatency', 'unconfirmed prior claims'],
      reserved: { requestedCount: 2000, generated: 0, read: 0, operatorOwned: true },
      sealedNativeGames: 'SS08–SS25: no read or execution' },
    firstFailure, firstDeviationExamples: examples, timing, qualityFailures: qualityFailures(stats, contrasts) };
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'results.jsonl.gz'), gzipSync(stableRows, { level: 9 }));
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ protocol: report.protocol, configuration,
    resultRowsSha256: report.corpus.resultRowsSha256, signatureSetSha256: report.corpus.signatureSetSha256,
    files: Object.fromEntries(['report.json', 'results.jsonl.gz', 'evaluation.jsonl.gz', 'corpus.evaluation-only.jsonl.gz']
      .filter(file => existsSync(join(out, file))).map(file => [file, digest(readFileSync(join(out, file)))])) }, null, 2) + '\n');
  return report;
}

async function runDevelopment({ perFamily, families, seed, out }) {
  const startedAt = new Date().toISOString(), began = performance.now(), provenance = sourceProvenance();
  const configuration = { ...provenance, seed, developmentSeeds: developmentSeeds(seed), perFamily,
    count: perFamily * families.length, families, commonCommandBudget: 96, modelContract: MODEL_CONTRACT,
    frozen: frozenP05Provenance, nativeWorkerCompared: false, P04ExplorationPolicy: 'identical-public-factorial-policy' };
  mkdirSync(out, { recursive: true });
  const corpus = gzipWriter(join(out, 'corpus.evaluation-only.jsonl.gz'));
  const evaluation = gzipWriter(join(out, 'evaluation.jsonl.gz'));
  const rows = [], generation = {}, examples = {}, global = new Set();
  try {
    for (const family of families) {
      const draw = randomSource(configuration.developmentSeeds[family]), used = new Set();
      const stats = { attempted: 0, accepted: 0, duplicateBehaviorsRejected: 0,
        uncertifiedRejected: 0, rejectionReasons: {}, invarianceChecks: 0 };
      generation[family] = stats;
      while (stats.accepted < perFamily) {
        if (++stats.attempted > Math.max(10_000, perFamily * 200)) throw new Error(`Generator exhausted family ${family}`);
        const spec = generateP05Situation(family, draw, stats.attempted), signature = behaviorSignature(spec);
        if (used.has(signature.hash)) { stats.duplicateBehaviorsRejected++; continue; }
        // Admit by the independent oracle BEFORE observing any candidate result.
        const certificate = certifyP05(spec);
        if (!certificate.solvable) {
          stats.uncertifiedRejected++; stats.rejectionReasons[certificate.reason] = (stats.rejectionReasons[certificate.reason] ?? 0) + 1;
          continue;
        }
        if (global.has(signature.hash)) throw new Error(`Cross-family duplicate ${signature.hash}; quotas must be revised`);
        const renamed = behaviorSignature(renameAndPermute(spec, seed + stats.attempted));
        if (signature.canonical !== renamed.canonical) throw new Error('Renaming/permutation created a new counted behavior');
        stats.invarianceChecks++;
        used.add(signature.hash); global.add(signature.hash); stats.accepted++;
        spec.id = `p05-${family}-${signature.hash.slice(0, 20)}`;
        const result = compareP05Situation(spec, certificate);
        result.row.behaviorHash = signature.hash;
        result.row.familyOrdinal = stats.accepted;
        rows.push(result.row);
        await corpus.write({ spec, behaviorHash: signature.hash, canonicalBehavior: signature.canonical });
        await evaluation.write(result.evaluation);
        if (!examples[family]) examples[family] = { id: spec.id, behaviorHash: signature.hash,
          firstDeviationGesture: result.row.firstDeviationGesture,
          decisiveReturnId: result.row.ablation?.decisiveReturnId,
          effectId: result.row.ablation?.targetEffectId,
          publicTraceHash: result.row.publicTraceHash,
          detail: 'Full public prefix, claims, independent verdict and P09 replay in evaluation.jsonl.gz.' };
        if (stats.accepted % 100 === 0 || stats.accepted === perFamily) console.log(JSON.stringify({ family,
          accepted: stats.accepted, quota: perFamily, duplicates: stats.duplicateBehaviorsRejected,
          elapsedSeconds: Math.round((performance.now() - began) / 1000) }));
      }
    }
  } finally { await Promise.all([corpus.close(), evaluation.close()]); }
  const contrasts = runP05Contrasts({ seed, countPerKind: 32 });
  const timing = { startedAt, finishedAt: new Date().toISOString(), wallSeconds: (performance.now() - began) / 1000,
    parallelFamilyJobs: 1, cumulativeReplayGesturesBothArms: sum(rows, row => 2 * row.actualGesturesEachArm) };
  const report = writeOutputs(out, configuration, rows, generation, contrasts, timing, examples);
  console.log(JSON.stringify({ report: join(out, 'report.json'), ...report.stats,
    qualityFailures: report.qualityFailures, wallSeconds: timing.wallSeconds }));
  if (report.qualityFailures.length) process.exitCode = 1;
  return report;
}

function findReports(directory) {
  const found = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) found.push(...findReports(path));
    else if (item.name === 'report.json') found.push(path);
  }
  return found;
}

export function aggregateP05(directory, out) {
  const files = findReports(directory);
  const shards = files.map(file => ({ file, report: JSON.parse(readFileSync(file, 'utf8')) }))
    .filter(shard => shard.report.protocol === 'P05-development-v1' && shard.report.configuration.families.length === 1);
  if (shards.length !== 8) throw new Error(`Expected exactly eight independent family reports; received ${shards.length}`);
  shards.sort((a, b) => Number(a.report.configuration.families[0]) - Number(b.report.configuration.families[0]));
  const first = shards[0].report, allFamilies = shards.flatMap(shard => shard.report.configuration.families);
  if (new Set(allFamilies).size !== 8 || allFamilies.join(',') !== P05_FAMILIES.map(family => family.id).join(',')) {
    throw new Error('Incomplete or duplicate family coverage');
  }
  const compatible = ['baseRevision', 'revision', 'sourceFingerprint', 'seed', 'perFamily', 'commonCommandBudget'];
  for (const { file, report } of shards) for (const key of compatible) {
    if (report.configuration[key] !== first.configuration[key]) throw new Error(`Incompatible shard ${key}: ${file}`);
  }
  const rows = shards.flatMap(({ file, report }) => {
    const data = gunzipSync(readFileSync(join(dirname(file), 'results.jsonl.gz'))).toString('utf8');
    if (digest(data) !== report.corpus.resultRowsSha256) throw new Error('Shard row fingerprint mismatch');
    const values = data.trim().split('\n').map(line => JSON.parse(line));
    if (values.length !== report.configuration.perFamily) throw new Error('Shard quota not met');
    const family = report.configuration.families[0];
    if (values.some(row => row.family !== family)) throw new Error('Shard contains a row from another family');
    if (values.some(row => row.commonCommandBudget !== report.configuration.commonCommandBudget
      || !Number.isSafeInteger(row.actualGesturesEachArm) || row.actualGesturesEachArm < 0
      || row.actualGesturesEachArm > row.commonCommandBudget
      || row.oracleCertifiedGestures > row.commonCommandBudget)) throw new Error('Shard command budget disagreement');
    if (digest(values.map(row => row.behaviorHash).sort()) !== report.corpus.signatureSetSha256) {
      throw new Error('Shard behavioral signature fingerprint mismatch');
    }
    return values;
  });
  const contrastsHash = digest(first.contrasts);
  for (const { report } of shards) if (digest(report.contrasts) !== contrastsHash) throw new Error('Contrast suite differs across shards');
  const configuration = { ...first.configuration, families: allFamilies, count: rows.length,
    aggregateOf: shards.map(({ report }) => ({ family: report.configuration.families[0],
      resultRowsSha256: report.corpus.resultRowsSha256 })) };
  const starts = shards.map(({ report }) => Date.parse(report.timing.startedAt));
  const ends = shards.map(({ report }) => Date.parse(report.timing.finishedAt));
  const events = shards.flatMap(({ report }) => [[Date.parse(report.timing.startedAt), 1], [Date.parse(report.timing.finishedAt), -1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let concurrency = 0, peak = 0;
  for (const [, delta] of events) { concurrency += delta; peak = Math.max(peak, concurrency); }
  const timing = { startedAt: new Date(Math.min(...starts)).toISOString(), finishedAt: new Date().toISOString(),
    wallSeconds: (Date.now() - Math.min(...starts)) / 1000,
    familyExecutionWallSeconds: (Math.max(...ends) - Math.min(...starts)) / 1000,
    cumulativeFamilySeconds: sum(shards, shard => shard.report.timing.wallSeconds),
    observedConcurrentFamilyProcesses: peak, configuredMaximumFamilyJobs: 8,
    concurrencySource: 'family process UTC intervals; job lifecycle peak must also be checked through GitHub Jobs',
    cumulativeReplayGesturesBothArms: sum(rows, row => 2 * row.actualGesturesEachArm) };
  const generation = Object.assign({}, ...shards.map(({ report }) => report.generation));
  const examples = Object.assign({}, ...shards.map(({ report }) => report.firstDeviationExamples));
  const report = writeOutputs(out, configuration, rows, generation, first.contrasts, timing, examples);
  console.log(JSON.stringify({ report: join(out, 'report.json'), situations: rows.length,
    complete: report.stats.candidateCompleteSituations, failures: report.qualityFailures, timing }));
  if (report.qualityFailures.length) process.exitCode = 1;
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    'per-family': { type: 'string', default: '1000' },
    count: { type: 'string' },
    families: { type: 'string', default: '1,2,3,4,5,6,7,8' },
    seed: { type: 'string', default: String(DEFAULT_SEED) },
    out: { type: 'string', default: join(root, 'artifacts', 'sic-p05-development') },
    aggregate: { type: 'string' },
  }, strict: true });
  const out = resolve(values.out);
  if (values.aggregate) aggregateP05(resolve(values.aggregate), out);
  else {
    const seed = Number(values.seed), families = values.families.split(',').map(value => value.trim());
    const perFamily = values.count ? Number(values.count) / families.length : Number(values['per-family']);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('Seed must be uint32');
    if (!Number.isSafeInteger(perFamily) || perFamily < 1) throw new Error('Quota must be a positive integer per family');
    if (new Set(families).size !== families.length || families.some(id => !P05_FAMILIES.some(family => family.id === id))) {
      throw new Error('Only development families 1..8 are accepted; no holdout generator is supplied');
    }
    await runDevelopment({ perFamily, families, seed, out });
  }
}
