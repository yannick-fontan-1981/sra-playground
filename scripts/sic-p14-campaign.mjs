import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { FAMILIES, generateCase, signature, shiftOrigin } from './sic-p14/generator.mjs';
import { certifyPolicy } from './sic-p14/oracle.mjs';
import { compareCase, runEpisode, summarize, digest } from './sic-p14/compare.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const BASE = '20433007224accc36e3d7976696d9ee7a783a227';
const FROZEN_CYCLE_BLOB = '5fbd8cc4f0a694d26aed29654a83ff998dca8c41';
const { values } = parseArgs({ options: {
  count: { type: 'string', default: '80' }, seed: { type: 'string', default: '26112814' },
  family: { type: 'string' }, state: { type: 'string', default: join(root, 'artifacts/sic-p14') },
  'skip-ablations': { type: 'boolean', default: false },
  'origin-controls': { type: 'string', default: '2' },
} });
const count = Number(values.count), seed = Number(values.seed), controls = Number(values['origin-controls']);
const family = values.family === undefined ? null : FAMILIES[Number(values.family) - 1] ?? values.family;
const families = family === null ? [...FAMILIES] : [family];
if (!Number.isSafeInteger(count) || count < 1 || count % families.length
  || !families.every(name => FAMILIES.includes(name))) throw new Error('Count must be positive and balanced over selected families');
if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('Seed must be uint32');
if (!Number.isSafeInteger(controls) || controls < 0) throw new Error('Invalid origin control count');
const directory = resolve(values.state);
mkdirSync(directory, { recursive: true });
const codeFiles = ['scripts/sic-p14-campaign.mjs', 'scripts/sic-p14-aggregate.mjs', ...readdirSync(join(root, 'scripts/sic-p14'))
  .filter(name => name.endsWith('.mjs')).map(name => 'scripts/sic-p14/' + name),
  'src/sic/temporal-evidence.ts', 'src/sic/witnessed-cycle.ts', 'src/sic/effect-composer.ts'].sort();
const sourceHashes = Object.fromEntries(codeFiles.map(path => [path, digest(readFileSync(join(root, path), 'utf8'))]));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const frozenBlob = execFileSync('git', ['hash-object', 'src/sic/witnessed-cycle.ts'], { cwd: root, encoding: 'utf8' }).trim();
if (frozenBlob !== FROZEN_CYCLE_BLOB) throw new Error('The native frozen inference no longer matches base 20433007');
const quota = count / families.length;
const configuration = { protocol: 'P14-observed-time-v1', baseRevision: BASE, revision,
  scope: 'isolated-SIC-primitive-simulation-with-P09-composition',
  seed, count, quotas: Object.fromEntries(families.map(name => [name, quota])),
  budgets: { actions: 180, ticks: 360, states: 20000 }, frozenCycleBlob: frozenBlob,
  sourceHashes, sourceFingerprint: digest(sourceHashes),
  ablations: !values['skip-ablations'], originControlsPerFamily: controls,
  native: { executed: 0, officialVictories: 0, status: 'not-tested' },
  sealed: { operatorCases: 2000, accessed: false, generated: false, gamesExcluded: 'SS08–SS25' },
  interpretation: 'A case passes only if every declared latent world is crossed; no native game score is inferred.' };
writeFileSync(join(directory, 'configuration.json'), JSON.stringify(configuration, null, 2) + '\n');
writeFileSync(join(directory, 'receipts.jsonl'), '');
const began = performance.now(), startTime = new Date().toISOString();
const rows = [], used = new Set(), originChecks = [], rejects = {};
const nextIndex = Object.fromEntries(families.map(name => [name, 0]));
for (const name of families) rejects[name] = { duplicate: 0, noCertifiedPolicy: 0, generated: 0, reasons: {} };

function compactCertificate(certificate) {
  const { policy, ...summary } = certificate;
  return summary;
}
function deterministic(value) {
  if (Array.isArray(value)) return value.map(deterministic);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['wallMs', 'inferenceMs'].includes(key)).map(([key, val]) => [key, deterministic(val)]));
  return value;
}

for (let ordinal = 0; ordinal < quota; ordinal++) for (const name of families) {
  let spec, key, certificate, sourceIndex;
  do {
    sourceIndex = nextIndex[name]++;
    if (sourceIndex > Math.max(50000, quota * 100)) throw new Error('Generator exhausted certified structural cases: ' + name);
    spec = generateCase(name, sourceIndex, seed);
    rejects[name].generated++;
    key = digest(signature(spec));
    if (used.has(key)) { rejects[name].duplicate++; continue; }
    certificate = certifyPolicy(spec, { includePolicy: false });
    if (!certificate.solvable) {
      rejects[name].noCertifiedPolicy++;
      rejects[name].reasons[certificate.reason] = (rejects[name].reasons[certificate.reason] ?? 0) + 1;
      continue;
    }
    break;
  } while (true);
  used.add(key);
  const comparison = compareCase(spec, { ablate: !values['skip-ablations'] });
  const row = { id: spec.id, family: name, ordinal, sourceIndex, signature: key,
    oracle: compactCertificate(certificate), ...comparison };
  rows.push(row);
  appendFileSync(join(directory, 'receipts.jsonl'), JSON.stringify(row) + '\n');
  if (ordinal < controls) {
    const shifted = shiftOrigin(spec, 1_000_003 + ordinal * 997);
    const shiftedSignature = digest(signature(shifted));
    for (const variant of ['frozen', 'candidate']) {
      const rerun = runEpisode(shifted, 0, variant);
      const expected = row.worlds[0][variant].traceHash;
      const passed = shiftedSignature === key && rerun.traceHash === expected;
      originChecks.push({ id: row.id, variant, delta: shifted.origin - spec.origin, passed,
        traceHash: rerun.traceHash, signature: shiftedSignature });
      if (!passed) throw new Error('Clock-origin invariance failed: ' + row.id + '/' + variant);
    }
  }
  if (rows.length % Math.min(25, count) === 0 || rows.length === count) console.log(JSON.stringify({
    completed: rows.length, count, seconds: Math.round((performance.now() - began) / 1000),
    lastFamily: name, frozen: rows.filter(item => item.frozen).length,
    candidate: rows.filter(item => item.candidate).length }));
}
const totals = summarize(rows), endTime = new Date().toISOString();
const report = { configuration, totals,
  families: Object.fromEntries(families.map(name => [name, summarize(rows.filter(row => row.family === name))])),
  generation: rejects, uniqueStructuralSignatures: used.size,
  originControls: { tested: originChecks.length, passed: originChecks.filter(row => row.passed).length, countedInCorpus: false, rows: originChecks },
  firstDifference: rows.flatMap(row => row.worlds.map(world => ({ id: row.id, family: row.family,
    world: world.world, difference: world.firstDifference }))).find(row => row.difference !== null) ?? null,
  firstCandidateError: rows.flatMap(row => row.worlds.map(world => ({ id: row.id, family: row.family,
    world: world.world, error: world.candidate.firstError }))).find(row => row.error !== null) ?? null,
  deterministicReceiptsSha256: digest(rows.map(row => JSON.stringify(deterministic(row))).join('\n') + '\n'),
  receiptFileSha256: digest(readFileSync(join(directory, 'receipts.jsonl'), 'utf8')),
  execution: { startTime, endTime, wallMs: performance.now() - began, cumulativeEpisodeWallMs:
    totals.byVariant.frozen.wallMs + totals.byVariant.candidate.wallMs, parallelLots: 1,
    runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    workflowRunId: process.env.GITHUB_RUN_ID ?? null, node: process.version } };
writeFileSync(join(directory, 'receipts.jsonl.gz'), gzipSync(readFileSync(join(directory, 'receipts.jsonl')), { level: 9 }));
writeFileSync(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: join(directory, 'report.json'), totals,
  deterministicReceiptsSha256: report.deterministicReceiptsSha256 }));
if (totals.oracleCertified !== count || totals.ablations.missingWitness
  || ['frozen', 'candidate'].some(variant => totals.byVariant[variant].proofViolations
    || totals.byVariant[variant].unguardedTimedActions || totals.byVariant[variant].unsupportedRevisions)) process.exitCode = 1;
