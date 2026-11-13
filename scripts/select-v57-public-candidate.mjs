/** Read-only pure morphology of retained public initial screens. No game host. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { measureFixedScene } from '../src/logos-engine/v6-fixed-origin.ts';
import { measurePeriodicSums } from '../src/logos-engine/v6-periodic-sums.ts';
import { measureReflectedLattice } from '../src/logos-engine/v6-reflected-cover.ts';
import { configuredScene } from '../src/logos-engine/v6-configured-arrivals.ts';
import { measureConstellationLayout } from '../src/logos-engine/v6-constellation-cover.ts';
import { measurePortLayout } from '../src/logos-engine/v6-port-assembly.ts';
import { measuredMetricScene } from '../src/logos-engine/v6-metric-composition.ts';
import { orientedCouplingInitial } from '../src/logos-engine/v6-oriented-coupling.ts';
import { measureRootedQuota } from '../src/logos-engine/v6-rooted-quota-observation.ts';
import { measureTraceField } from '../src/logos-engine/v6-trace-field-observation.ts';
import { measureProductPanel } from '../src/logos-engine/v6-product-panel-observation.ts';
import { measureRadialPorts } from '../src/logos-engine/v6-radial-port-observation.ts';
import { measureLinkedScene } from '../src/logos-engine/v6-linked-packet-observation.ts';
import { measureLabeledSequence } from '../src/logos-engine/v6-labeled-sequence-observation.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set('HANO SYME DNOI TU93 MEMO PIPE STCK TICT THER COMB CATL LF52 ZIPP SELE COLM GRIL LIFE VALV GARE CN04 RE86 ELAS ONDE DICO M0R0 SKBN DAME AS66 GLOB'.split(' '));
const functions = { measureFixedScene, measurePeriodicSums, measureReflectedLattice, configuredScene,
  measuredMetricScene, orientedCouplingInitial, measureRootedQuota, measureTraceField,
  measureProductPanel, measureRadialPorts, measureLinkedScene, measureLabeledSequence };
const corpusPath = 'tests/fixtures/v6-linked-packet-initial-public.json.gz';
const bytes = readFileSync(resolve(root, corpusPath)), corpus = JSON.parse(gunzipSync(bytes));
const results = [];
for (const g of corpus.games) {
  if (excluded.has(g.game)) continue;
  const rows = g.packet.frame_rows, matches = {};
  for (const [name, f] of Object.entries(functions)) {
    try { matches[name] = !!f(rows); } catch (error) { matches[name] = { error: String(error) }; }
  }
  for (const [name, f] of Object.entries({ measureConstellationLayout, measurePortLayout })) {
    try { matches[name] = !!f(g.observation, rows); } catch (error) { matches[name] = { error: String(error) }; }
  }
  results.push({ game: g.game, frameHash: g.packet.frame_hash, matches });
}
const result = {
  schema: 'logos-engine.v57.readonly-initial-morphology.v1', createdAt: new Date().toISOString(),
  baseline: '54b6057c5c53490a2dea5929003992551f442099',
  corpus: { path: corpusPath, sha256: createHash('sha256').update(bytes).digest('hex'),
    recordedActions: corpus.actions, recordedLevelJumps: corpus.levelJumps },
  scope: 'Pure geometry only on recorded public initial rasters. No agent proposals, acquisition, dispatched actions, game hosts, private states, game engines or manual solutions. Measurements only select candidate; no state is supplied to live campaigns.',
  functions: Object.keys(functions).concat(['measureConstellationLayout', 'measurePortLayout']),
  excludedPreviouslyQualified: [...excluded], results,
};
const target = resolve(root, process.argv[2] ?? 'docs/migration/native-campaigns-v57/initial-morphology-rerun.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ target, candidates: results.filter(r => Object.values(r.matches).some(v => v === true)) }));
