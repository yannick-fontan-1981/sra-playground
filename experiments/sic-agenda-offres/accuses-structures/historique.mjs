import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [format, candidate, ...candidateDeps] = process.argv.slice(2);
if (!format || !/^[0-9a-f]{40}$/.test(candidate ?? '')) {
  throw new Error('Indiquer le dossier public-format, le SHA du candidat et ses éventuelles dépendances supplémentaires');
}
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const parent = '615e249349e6f274b07c7626d30c545d374234a5';
const folder = mkdtempSync(join(tmpdir(), 'accuses-historiques-'));
const program = 'experiments/sic-agenda-offres/public-v1/';
const fixed = [program + 'admission.mjs', program + 'planifier.mjs', program + 'schema.json',
  'experiments/sic-agenda-offres/agenda.mjs', 'src/sic/reasoning-mode.ts'];
function measure(sha, deps, name) {
  const path = join(folder, name + '.json');
  execFileSync(process.execPath, [resolve(format,'operator/run.mjs'), '--partition','developpement',
    '--depot',repo,'--sha',sha,'--entree',program + 'solveur.mjs',
    ...deps.flatMap(dep => ['--dep',dep]), '--rapport',path], { windowsHide:true, stdio:['ignore','ignore','inherit'] });
  return JSON.parse(readFileSync(path, 'utf8'));
}
const base = measure(parent, fixed, 'parent');
const current = measure(candidate, [...fixed, ...candidateDeps], 'candidat');
assert.equal(current.operateur, base.operateur);
assert.equal(current.partition, 'developpement');
assert.equal(current.consommateur, candidate);
assert.deepEqual(current.departs, base.departs);
assert.equal(current.bilan.issues.succes, 18);
console.log('Historique v1 : 18 reçus de départ identiques au parent. ' + current.bilan.actions.executees +
  ' commandes et ' + current.bilan.lectures.retours + ' lectures. Reçus ' + folder);
