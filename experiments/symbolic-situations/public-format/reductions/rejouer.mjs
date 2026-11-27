import assert from 'node:assert/strict';
import { enumerateFinite } from '../../finite-policies.mjs';
import { measure } from '../operator/measure.mjs';
import { publicCase } from './cases.mjs';
import { frozen } from './consumer.mjs';

const [id, sha, depot, mode] = process.argv.slice(2);
assert.ok(mode === undefined || mode === '--exiger-passage');
const solver = frozen(sha, depot);
const c = publicCase(id);
const report = await measure([c], solver);
console.log(JSON.stringify({ sha:solver.sha, ...report }, null, 2));
if (mode === '--exiger-passage') {
  const answer = enumerateFinite(c.worlds, c.dynamics);
  assert.equal(report.bilan.issues.succes, c.worlds.length, 'succès requis à chaque départ');
  assert.equal(report.bilan.actions.refusees, 0);
  const traces = report.departs.map(row => row.tours.map(t => t.action));
  assert.ok(answer.optimal.some(policy => c.worlds.every((w,i) =>
    JSON.stringify(policy[c.dynamics.worldId(w)]) === JSON.stringify(traces[i]))),
    'une politique minimale compatible avec les observations est requise');
}
