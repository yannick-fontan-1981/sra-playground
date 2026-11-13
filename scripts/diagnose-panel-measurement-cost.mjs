/** One bounded, public-raster component diagnostic; never a game runner. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';

const repository = resolve(process.argv[2]);
const output = resolve(repository, 'docs/migration/lot3a-evidence/diagnostics/panel-measurement-cost.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  'src/logos-engine/v6-panel-service-observation.ts',
  'src/logos-engine/v6-panel-service-pattern-set.ts',
  'src/logos-engine/v6-panel-service-access.ts',
  'src/logos-engine/v6-native-observer.ts',
  'src/logos-engine/v6-shared-series.ts',
];
const sourceHashes = () => Object.fromEntries(sourcePaths.map(path => [path, sha(readFileSync(resolve(repository, path)))]));
const beforeHashes = sourceHashes(), startedAt = new Date().toISOString();
const { measurePanelService, panelServiceInputCandidates } = await import(pathToFileURL(resolve(repository, sourcePaths[0])).href);
const corpusPath = 'tests/fixtures/v6-linked-packet-initial-public.json.gz';
const corpusBytes = readFileSync(resolve(repository, corpusPath));
const corpus = JSON.parse(gunzipSync(corpusBytes).toString());
const labels = ['STCK', 'SMLP', 'RSWP'];
const views = labels.map(label => {
  const view = corpus.games.find(value => value.game === label);
  if (!view) throw new Error('Missing declared public view: ' + label);
  const rows = Object.freeze(view.packet.frame_rows.map(row => Object.freeze([...row])));
  return { label, rows, available: Object.freeze([...view.observation.available_action_refs]),
    frameHash: view.observation.frame_hash, rasterSha256: sha(Buffer.from(JSON.stringify(rows))) };
});
const operations = [
  { id: 'measure_empty_symbols', sceneCalls: 1, invoke: view => measurePanelService(view.rows, []) },
  { id: 'input_candidates', sceneCalls: 1, invoke: view => panelServiceInputCandidates(view.rows, view.available) },
  { id: 'duplicated_entry_measurements', sceneCalls: 2,
    invoke: view => [panelServiceInputCandidates(view.rows, view.available), measurePanelService(view.rows, [])] },
];
const warmupRounds = 4, measuredRounds = 21;
const raw = new Map(), expected = new Map();
for (const view of views) for (const operation of operations) {
  const key = view.label + ':' + operation.id;
  raw.set(key, []);
  expected.set(key, sha(Buffer.from(JSON.stringify(operation.invoke(view)))));
}
let calls = 0;
function round(index, timed) {
  for (let vi = 0; vi < views.length; vi++) {
    const view = views[(vi + index) % views.length];
    for (let oi = 0; oi < operations.length; oi++) {
      const operation = operations[(oi + index) % operations.length];
      const key = view.label + ':' + operation.id, begin = performance.now();
      const result = operation.invoke(view);
      const elapsedMs = performance.now() - begin;
      calls++;
      if (timed) raw.get(key).push(elapsedMs);
      // Output integrity is checked outside the measured interval.
      if (sha(Buffer.from(JSON.stringify(result))) !== expected.get(key)) throw new Error('Nonstable public measurement: ' + key);
    }
  }
}
for (let index = 0; index < warmupRounds; index++) round(index, false);
for (let index = 0; index < measuredRounds; index++) round(index, true);
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { count: n, medianMs: sorted[Math.floor(n / 2)], minMs: sorted[0], maxMs: sorted[n - 1], samplesMs: values };
};
const measurements = views.map(view => {
  const scene = measurePanelService(view.rows, []), points = panelServiceInputCandidates(view.rows, view.available);
  return { label: view.label, frameHash: view.frameHash, rasterSha256: view.rasterSha256,
    height: view.rows.length, width: view.rows[0].length, frozenRaster: Object.isFrozen(view.rows) && view.rows.every(Object.isFrozen),
    available: view.available, panelSceneAdmitted: scene !== null, panels: scene?.panels.length ?? 0, pointCandidates: points.length,
    operations: operations.map(operation => ({ operation: operation.id, sceneCalls: operation.sceneCalls,
      outputSha256: expected.get(view.label + ':' + operation.id), ...summary(raw.get(view.label + ':' + operation.id)) })) };
});
const afterHashes = sourceHashes();
const record = {
  schema: 'logos-engine.lot3a.panel-measurement-component-cost.v1',
  status: JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) ? 'diagnostic_complete_source_unchanged' : 'invalid_source_changed',
  startedAt, completedAt: new Date().toISOString(),
  generator: { path: fileURLToPath(import.meta.url), sha256: sha(readFileSync(fileURLToPath(import.meta.url))) },
  environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
    cpuModel: os.cpus()[0]?.model ?? null },
  input: { path: corpusPath, sha256: sha(corpusBytes), selectedInitialPublicViews: labels },
  protocol: { processCount: 1, warmupRounds, measuredRounds, callsInsideRounds: calls, order: 'rotating views and operations',
    rasterOwnership: 'JSON numeric rows cloned and deeply frozen before timing, matching NativeRuntime public raster ownership',
    symbols: [], timed: 'Only the named native function call(s); output hash checks, imports and I/O excluded',
    labels: 'Metadata selecting declared archived public rasters; no label is passed to a measured native function',
    productionEdits: false, gameHostInvoked: false, physicalActions: 0, campaignRun: false,
    qualification: 'Single-process component diagnostic only; not an official loop-cost comparison or exclusive causal attribution of its noisy delta.' },
  sourceHashesBefore: beforeHashes, sourceHashesAfter: afterHashes, measurements,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: relative(repository, output), status: record.status,
  measurements: measurements.map(value => ({ label: value.label, admitted: value.panelSceneAdmitted, points: value.pointCandidates,
    costs: value.operations.map(operation => ({ operation: operation.operation, medianMs: operation.medianMs, minMs: operation.minMs, maxMs: operation.maxMs })) })) }, null, 2));
if (record.status !== 'diagnostic_complete_source_unchanged') process.exitCode = 1;
