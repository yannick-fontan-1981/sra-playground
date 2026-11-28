import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { FAMILIES } from './sic-p14/generator.mjs';
import { digest, summarize } from './sic-p14/compare.mjs';

const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' },
  count: { type: 'string', default: '8000' } } });
if (!values.input || !values.output) throw new Error('--input and --output directories are required');
const expectedCount = Number(values.count), input = resolve(values.input), output = resolve(values.output);
const files = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) collect(join(directory, entry.name));
    else if (entry.name === 'report.json') files.push(join(directory, entry.name));
  }
}
collect(input);
const reports = files.map(path => ({ path, report: JSON.parse(readFileSync(path, 'utf8')) }));
if (reports.length !== FAMILIES.length) throw new Error('Expected exactly eight independent family reports');
const reference = reports[0].report.configuration;
const seen = new Set(), coveredFamilies = new Set(), rows = [];
for (const { path, report } of reports) {
  const config = report.configuration, families = Object.keys(config.quotas);
  if (config.revision !== reference.revision || config.sourceFingerprint !== reference.sourceFingerprint
    || config.seed !== reference.seed || JSON.stringify(config.budgets) !== JSON.stringify(reference.budgets)) {
    throw new Error('Mixed revisions, sources, seeds or budgets');
  }
  if (families.length !== 1 || coveredFamilies.has(families[0]) || !FAMILIES.includes(families[0])
    || config.quotas[families[0]] !== expectedCount / FAMILIES.length) throw new Error('Incomplete or overlapping family coverage');
  coveredFamilies.add(families[0]);
  const text = gunzipSync(readFileSync(join(path.slice(0, -'report.json'.length), 'receipts.jsonl.gz'))).toString('utf8');
  if (digest(text) !== report.receiptFileSha256) throw new Error('Receipt archive hash mismatch');
  const shard = text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (shard.length !== config.count) throw new Error('Missing receipts');
  for (const row of shard) {
    if (seen.has(row.signature)) throw new Error('Duplicate temporal structure across families: ' + row.id);
    if (!row.oracle.solvable || row.oracle.maxActions > config.budgets.actions
      || row.oracle.maxTicks > config.budgets.ticks) throw new Error('Uncertified or over-budget case');
    seen.add(row.signature); rows.push(row);
  }
}
if (rows.length !== expectedCount) throw new Error('Wrong total coverage');
rows.sort((a, b) => a.ordinal - b.ordinal || FAMILIES.indexOf(a.family) - FAMILIES.indexOf(b.family));
const events = reports.flatMap(({ report }) => [[Date.parse(report.execution.startTime), 1], [Date.parse(report.execution.endTime), -1]])
  .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
let active = 0, peak = 0;
for (const [, change] of events) { active += change; peak = Math.max(peak, active); }
const totals = summarize(rows), originRows = reports.flatMap(({ report }) => report.originControls.rows);
function withoutTiming(value) {
  if (Array.isArray(value)) return value.map(withoutTiming);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['wallMs', 'inferenceMs'].includes(key)).map(([key, child]) => [key, withoutTiming(child)]));
  return value;
}
const receipts = rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const report = { configuration: { ...reference, count: expectedCount,
    quotas: Object.fromEntries(FAMILIES.map(family => [family, expectedCount / FAMILIES.length])) },
  totals, families: Object.fromEntries(FAMILIES.map(family => [family, summarize(rows.filter(row => row.family === family))])),
  generation: Object.assign({}, ...reports.map(({ report }) => report.generation)),
  uniqueStructuralSignatures: seen.size,
  originControls: { tested: originRows.length, passed: originRows.filter(row => row.passed).length,
    countedInCorpus: false, rows: originRows },
  firstDifference: rows.flatMap(row => row.worlds.map(world => ({ id: row.id, family: row.family,
    world: world.world, difference: world.firstDifference }))).find(row => row.difference !== null) ?? null,
  firstCandidateError: rows.flatMap(row => row.worlds.map(world => ({ id: row.id, family: row.family,
    world: world.world, error: world.candidate.firstError }))).find(row => row.error !== null) ?? null,
  deterministicReceiptsSha256: digest(rows.map(row => JSON.stringify(withoutTiming(row))).join('\n') + '\n'),
  receiptFileSha256: digest(receipts),
  execution: { runner: 'github-actions', workflowRunId: reports[0].report.execution.workflowRunId ?? process.env.GITHUB_RUN_ID ?? null,
    startTime: new Date(events[0][0]).toISOString(), endTime: new Date(events.at(-1)[0]).toISOString(),
    wallMs: events.at(-1)[0] - events[0][0], parallelLots: peak, totalLots: reports.length,
    cumulativeLotWallMs: reports.reduce((total, item) => total + item.report.execution.wallMs, 0),
    cumulativeEpisodeWallMs: totals.byVariant.frozen.wallMs + totals.byVariant.candidate.wallMs,
    shards: reports.map(({ report }) => ({ family: Object.keys(report.configuration.quotas)[0],
      ...report.execution, deterministicReceiptsSha256: report.deterministicReceiptsSha256 })) } };
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(output, 'configuration.json'), JSON.stringify(report.configuration, null, 2) + '\n');
writeFileSync(join(output, 'receipts.jsonl.gz'), gzipSync(receipts, { level: 9 }));
console.log(JSON.stringify({ count: rows.length, unique: seen.size, totals,
  deterministicReceiptsSha256: report.deterministicReceiptsSha256, peakLots: peak, wallMs: report.execution.wallMs }));
if (totals.oracleCertified !== expectedCount || totals.ablations.missingWitness
  || ['frozen', 'candidate'].some(variant => totals.byVariant[variant].proofViolations
    || totals.byVariant[variant].unguardedTimedActions || totals.byVariant[variant].unsupportedRevisions)) process.exitCode = 1;
