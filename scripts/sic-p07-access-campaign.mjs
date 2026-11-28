import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { parseArgs } from 'node:util';
import { createGzip } from 'node:zlib';
import { families, generateScenario, seededDraw, structuralSignature } from './p07-access/generator.mjs';
import { addResult, certify, compareInvariance, compareScenario, emptyTotals } from './p07-access/comparator.mjs';
import { addInvariance, emptyInvariance, reportMarkdown, resultFailures } from './p07-access/reporting.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  count: { type: 'string', default: '80' },
  seed: { type: 'string', default: '26112807' },
  family: { type: 'string', default: 'all' },
  out: { type: 'string', default: 'artifacts/p07-access' },
  'expect-sha': { type: 'string' },
} });
const count = Number(values.count), seed = Number(values.seed);
const selected = values.family === 'all' ? [...families] : families.filter(family => values.family.split(',').includes(family));
if (!Number.isSafeInteger(count) || count < 1) throw new Error('--count must be a positive integer');
if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('--seed must be an unsigned 32-bit integer');
if (!selected.length || (values.family !== 'all' && values.family.split(',').some(family => !families.includes(family)))) {
  throw new Error(`--family must be all or one of ${families.join(', ')}`);
}
if (count % selected.length) throw new Error('--count must be divisible by the number of selected families');
const directory = resolve(root, values.out);
const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (values['expect-sha'] && values['expect-sha'] !== sourceSha) throw new Error(`HEAD ${sourceSha} does not match --expect-sha ${values['expect-sha']}`);

function sourceFiles(directory = join(root, 'scripts/p07-access')) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(path));
    else if (entry.name.endsWith('.mjs')) result.push(relative(root, path));
  }
  return result;
}
const sourceRoster = () => [...new Set([...sourceFiles(), 'scripts/p07-access/schema.ts',
  'scripts/sic-p07-access-campaign.mjs', 'scripts/sic-p07-access-aggregate.mjs',
  'src/sic/access-policy.ts', 'src/sic/effect-composer.ts'])].sort();
const files = sourceRoster();
function fingerprint(fileList = files) {
  const hash = createHash('sha256');
  for (const file of fileList) hash.update(file + '\0').update(readFileSync(join(root, file))).update('\0');
  return hash.digest('hex');
}
const sourceDirty = execFileSync('git', ['status', '--porcelain', '--', ...files], { cwd: root, encoding: 'utf8' }).trim().length > 0;
if (values['expect-sha'] && sourceDirty) throw new Error('--expect-sha requires all fingerprinted source files to be committed');
const configuration = {
  protocol: 'sic-p07-development-campaign-v1', sourceSha, sourceDirty, fingerprint: fingerprint(), sourceFiles: files,
  count, seed, families: selected, quotas: Object.fromEntries(selected.map(family => [family, count / selected.length])),
  familySeeds: Object.fromEntries(selected.map(family => [family, (seed ^ Math.imul(families.indexOf(family) + 1, 0x9e3779b9)) >>> 0])),
  provenance: 'simulated-declarative-P07', nativeVictories: 0,
  sealed: { independentCases: 2000, consulted: false, games: 'SS08–SS25', gamesConsulted: false },
};

async function fileHash(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
const reportPath = join(directory, 'report.json');
if (existsSync(directory) && readdirSync(directory).length) {
  const previous = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : null;
  if (!previous || previous.status !== 'completed' || JSON.stringify(previous.configuration) !== JSON.stringify(configuration)) {
    throw new Error(`Refusing to overwrite nonempty campaign directory ${directory}; choose a new --out`);
  }
  for (const artifact of Object.values(previous.artifacts)) {
    if (!existsSync(join(directory, artifact.file)) || await fileHash(join(directory, artifact.file)) !== artifact.sha256) {
      throw new Error(`Completed archive failed integrity verification: ${artifact.file}`);
    }
  }
  console.log(JSON.stringify({ reused: true, directory, sourceSha, fingerprint: configuration.fingerprint,
    cases: previous.totals.cases, status: previous.status }));
} else {
  await runCampaign();
}

async function runCampaign() {
  const began = performance.now();
  const startedAt = new Date().toISOString();
  mkdirSync(directory, { recursive: true });
  const rawCorpus = join(directory, 'corpus.jsonl'), rawResults = join(directory, 'results.jsonl');
  writeFileSync(rawCorpus, ''); writeFileSync(rawResults, '');
  writeFileSync(join(directory, 'source.sha'), sourceSha + '\n');
  const manifestPath = join(directory, 'manifest.json');
  const manifest = { configuration, status: 'running', startedAt, completed: 0 };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const totals = emptyTotals(), byFamily = Object.fromEntries(selected.map(family => [family, emptyTotals()]));
  const invariance = emptyInvariance(), invarianceByFamily = Object.fromEntries(selected.map(family => [family, emptyInvariance()]));
  const generation = { attempted: 0, accepted: 0, duplicates: 0, infeasible: 0, certificationErrors: 0,
    byFamily: Object.fromEntries(selected.map(family => [family, { attempted: 0, accepted: 0, duplicates: 0,
      infeasible: 0, certificationErrors: 0, rejectionReasons: {} }])) };
  const failures = new Set(), signatures = new Map(), examples = {};
  let firstMismatch = null, fatal = null, activeCase = null;
  const recordFailure = (issues, payload) => {
    for (const issue of issues) failures.add(issue);
    if (!firstMismatch) {
      firstMismatch = 'first-mismatch.json';
      writeFileSync(join(directory, firstMismatch), JSON.stringify({ issues, ...payload }, null, 2) + '\n');
    }
  };
  try {
    for (const family of selected) {
      const g = generation.byFamily[family];
      const draw = seededDraw(configuration.familySeeds[family]);
      const quota = configuration.quotas[family];
      while (g.accepted < quota) {
        if (g.attempted >= Math.max(10000, quota * 100)) throw new Error(`Structural generator exhausted for ${family}`);
        const index = g.accepted;
        const spec = generateScenario(family, draw, { seed: configuration.familySeeds[family], index });
        activeCase = { spec };
        g.attempted++; generation.attempted++;
        const signature = structuralSignature(spec);
        activeCase.signature = signature;
        if (signatures.has(signature)) {
          if (signatures.get(signature) !== family) throw new Error('Cross-family structural collision would alter sharded reproducibility');
          g.duplicates++; generation.duplicates++; continue;
        }
        const certificate = certify(spec);
        activeCase.certificate = certificate;
        if (!certificate.accepted) {
          const reason = certificate.reason ?? 'oracle-unsolved';
          g.rejectionReasons[reason] = (g.rejectionReasons[reason] ?? 0) + 1;
          if (reason === 'oracle-certificate-failed') {
            g.certificationErrors++; generation.certificationErrors++;
            recordFailure(['oracle-certificate-failed'], { signature, spec, certificate });
          } else { g.infeasible++; generation.infeasible++; }
          continue;
        }
        signatures.set(signature, family);
        const row = { ...compareScenario(spec, certificate), signature };
        row.invariance = compareInvariance(spec, row, 1 + index % 3);
        const issues = resultFailures(row);
        if (issues.length) recordFailure(issues, { signature, spec, result: row });
        addResult(totals, row); addResult(byFamily[family], row);
        addInvariance(invariance, row.invariance); addInvariance(invarianceByFamily[family], row.invariance);
        appendFileSync(rawCorpus, JSON.stringify({ signature, spec }) + '\n');
        appendFileSync(rawResults, JSON.stringify(row) + '\n');
        activeCase = null;
        g.accepted++; generation.accepted++;
        if (!examples[family] && (row.firstDifference || row.accessGain)) examples[family] = {
          id: row.id, signature, accessGain: row.accessGain, firstDifference: row.firstDifference,
        };
        if (generation.accepted % 100 === 0 || g.accepted === quota) {
          manifest.completed = generation.accepted;
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
          console.log(JSON.stringify({ family, familyCompleted: g.accepted, familyQuota: quota,
            completed: generation.accepted, count, seconds: Math.round((performance.now() - began) / 1000),
            candidateAccesses: totals.candidate.accesses, failures: [...failures] }));
        }
      }
    }
  } catch (error) {
    fatal = { name: error.name, message: error.message, stack: error.stack };
    recordFailure(['campaign-execution-error'], { ...activeCase, error: fatal, generation });
  }
  if (totals.cases !== count) failures.add('incomplete-quota');
  const finalFingerprint = fingerprint(sourceRoster());
  if (finalFingerprint !== configuration.fingerprint) failures.add('source-changed-during-campaign');
  const finalSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (finalSha !== sourceSha) failures.add('head-changed-during-campaign');
  const artifacts = {};
  for (const [key, raw] of [['corpus', rawCorpus], ['results', rawResults]]) {
    const file = key + '.jsonl.gz', path = join(directory, file);
    await pipeline(createReadStream(raw), createGzip({ level: 9 }), createWriteStream(path));
    artifacts[key] = { file, sha256: await fileHash(path), bytes: statSync(path).size,
      uncompressedSha256: await fileHash(raw), uncompressedBytes: statSync(raw).size };
    rmSync(raw);
  }
  const report = { configuration, status: failures.size ? 'failed' : 'completed',
    totals, byFamily, invariance, invarianceByFamily, generation,
    seconds: Number(((performance.now() - began) / 1000).toFixed(3)), artifacts,
    examples, firstMismatch, failures: [...failures], fatal,
    finalFingerprint, startedAt, finishedAt: new Date().toISOString() };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(directory, 'report.md'), reportMarkdown(report));
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, status: report.status, completed: totals.cases,
    finishedAt: report.finishedAt, seconds: report.seconds, artifacts, failures: report.failures }, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, sourceSha, fingerprint: configuration.fingerprint,
    cases: totals.cases, candidateAccesses: totals.candidate.accesses, frozenAccesses: totals.frozen.accesses,
    gains: totals.accessGains, parentCompleted: totals.parentCompleted, invarianceFailures: invariance.failed,
    failures: report.failures, seconds: report.seconds, directory }));
  if (failures.size) process.exitCode = 1;
}
