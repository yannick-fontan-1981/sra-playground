import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { addResult, emptyTotals } from './p07-access/comparator.mjs';
import { families, familyNames } from './p07-access/generator.mjs';

const { values } = parseArgs({ options: {
  parts: { type: 'string' }, out: { type: 'string', default: 'artifacts/sic-p07-development' },
  count: { type: 'string', default: '8000' }, 'expect-sha': { type: 'string' },
} });
if (!values.parts) throw new Error('--parts is required');
const root = resolve(values.parts), output = resolve(values.out), count = Number(values.count);
const paths = readdirSync(root, { recursive: true }).filter(path => path.endsWith('report.json'));
const reports = paths.map(path => ({ path: join(root, path), report: JSON.parse(readFileSync(join(root, path), 'utf8')) }));
assert.equal(reports.length, families.length, 'Exactly one complete shard per development family');
const totals = emptyTotals(), byFamily = {}, signatures = new Set(), ids = new Set();
const archives = { corpus: [], results: [] }, familySeeds = {}, quotas = {};
const invariance = { tested: 0, failed: 0, commandDifferences: 0 };
let sourceSha, fingerprint, seed, cumulativeSeconds = 0;
const parts = [];
for (const { path, report } of reports) {
  assert.equal(report.status, 'completed', path + ' successful qualification');
  const configuration = report.configuration;
  sourceSha ??= configuration.sourceSha;
  fingerprint ??= configuration.fingerprint;
  seed ??= configuration.seed;
  assert.equal(configuration.sourceSha, sourceSha, 'One frozen source SHA');
  assert.equal(configuration.fingerprint, fingerprint, 'One implementation fingerprint');
  assert.equal(configuration.seed, seed, 'One master development seed');
  if (values['expect-sha']) assert.equal(sourceSha, values['expect-sha']);
  assert.equal(configuration.families.length, 1, 'Each shard owns one family');
  const family = configuration.families[0];
  assert.ok(families.includes(family));
  assert.ok(!byFamily[family], 'No duplicate family');
  const directory = path.slice(0, -'report.json'.length);
  const corpus = readFileSync(join(directory, 'corpus.jsonl.gz'));
  const results = readFileSync(join(directory, 'results.jsonl.gz'));
  assert.equal(createHash('sha256').update(corpus).digest('hex'), report.artifacts.corpus.sha256, 'Corpus archive integrity');
  assert.equal(createHash('sha256').update(results).digest('hex'), report.artifacts.results.sha256, 'Results archive integrity');
  const specs = gunzipSync(corpus).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  const rows = gunzipSync(results).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(specs.length, count / families.length, 'Balanced quota');
  assert.equal(rows.length, specs.length, 'One comparison per accepted scenario');
  const familyTotals = emptyTotals();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], entry = specs[index];
    assert.equal(row.signature, entry.signature, 'Corpus/result identity');
    assert.equal(row.id, entry.spec.id, 'Scenario identity');
    assert.equal(row.family, family);
    assert.equal(entry.spec.family, family);
    assert.ok(!signatures.has(row.signature), 'Cross-shard structural duplication');
    assert.ok(!ids.has(row.id), 'Cross-shard case ID duplication');
    signatures.add(row.signature); ids.add(row.id);
    addResult(totals, row); addResult(familyTotals, row);
    const check = row.invariance;
    assert.ok(check, 'Every situation has an out-of-quota invariance test');
    invariance.tested++;
    invariance.failed += Number(!check.signatureStable || !check.frozenAccessStable || !check.candidateAccessStable || !!check.mismatches);
    invariance.commandDifferences += Number(check.frozenCommandDelta !== 0 || check.candidateCommandDelta !== 0);
  }
  assert.deepEqual(familyTotals, report.totals, 'Stored totals agree with all independent receipts');
  byFamily[family] = familyTotals;
  Object.assign(familySeeds, configuration.familySeeds);
  Object.assign(quotas, configuration.quotas);
  archives.corpus.push(corpus); archives.results.push(results);
  cumulativeSeconds += report.seconds;
  parts.push({ family, sourceSha, seconds: report.seconds,
    corpusSha256: createHash('sha256').update(corpus).digest('hex'),
    resultsSha256: createHash('sha256').update(results).digest('hex'), generation: report.generation });
}
assert.equal(totals.cases, count);
assert.equal(totals.certified, count);
assert.equal(totals.parentFeasible, count);
assert.equal(totals.parentCompleted, count);
for (const metric of ['regressions', 'replayMismatches', 'candidateMisses', 'ablationAuditErrors']) assert.equal(totals[metric], 0, metric);
assert.equal(invariance.failed, 0);
mkdirSync(output, { recursive: true });
const artifacts = {};
for (const key of ['corpus', 'results']) {
  // Concatenated gzip members remain a valid, losslessly readable gzip archive.
  const data = Buffer.concat(archives[key]);
  writeFileSync(join(output, `${key}.jsonl.gz`), data);
  const uncompressed = gunzipSync(data);
  artifacts[key] = { file: `${key}.jsonl.gz`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'),
    uncompressedBytes: uncompressed.length, uncompressedSha256: createHash('sha256').update(uncompressed).digest('hex') };
}
const configuration = { protocol: 'sic-p07-access-v1', sourceSha, fingerprint, seed, count,
  families, familySeeds, quotas, scope: 'frozen common composer versus conditional access component',
  sealed: { situations: 2000, accessed: 0, generated: 0 }, native: { gamesExecuted: 0, victories: 0 } };
const report = { status: 'completed', configuration, totals, byFamily, invariance, parts,
  seconds: Math.max(...parts.map(part => part.seconds)), cumulativeSeconds,
  timingScope: 'Longest shard compute time; GitHub job wall time and peak concurrency are recorded separately.', artifacts };
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(output, 'manifest.json'), JSON.stringify({ configuration, artifacts, parts }, null, 2) + '\n');
writeFileSync(join(output, 'source.sha'), sourceSha + '\n');
const lines = ['# P07 — développement, résultats simulés', '',
  `Source : \`${sourceSha}\`. Graine maître : \`${seed}\`. ${count} situations de développement ; 2 000 réservées à l’opérateur, non consultées.`, '',
  '| Famille | Quota | Accès figé | Accès candidat | Gains | Trajet plus court | P09 complet |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |'];
for (const family of families) {
  const part = byFamily[family];
  lines.push(`| ${familyNames[family]} | ${part.cases} | ${part.frozen.accesses} | ${part.candidate.accesses} | ${part.accessGains} | ${part.shorter} | ${part.parentCompleted} |`);
}
lines.push('', `Franchissements rejoués : ${totals.candidate.crossings}. Observations nouvelles : ${totals.candidate.newObservations}. Événements de victoire du simulateur : ${totals.candidate.simulatedWins}. Victoires natives : 0 (aucune partie native exécutée).`, '',
  `Ablations ciblées : ${totals.ablations} ; accès perdus ${totals.ablatedAccessLost}, conservés ${totals.ablatedAccessRetained}, dont ${totals.ablatedMoreCommands} avec davantage de gestes.`, '',
  `Contrôles d’invariance hors quota : ${invariance.tested}, échecs ${invariance.failed}. Désaccords de rejeu : ${totals.replayMismatches}. Régressions : ${totals.regressions}.`, '');
writeFileSync(join(output, 'report.md'), lines.join('\n'));
console.log(JSON.stringify({ status: report.status, sourceSha, count, totals, invariance, artifacts }));
