import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [folder, sha] = process.argv.slice(2);
if (!folder || !/^[0-9a-f]{40}$/.test(sha ?? '')) throw new Error('Indiquer le dossier public-format et le SHA du candidat');
const op = path => import(pathToFileURL(join(resolve(folder), path)).href);
const { consumer } = await op('operator/frozen.mjs');
const { measure } = await op('operator/measure.mjs');
const { probe } = await op('accuses/dialogue.mjs');
const { situations } = await op('accuses/situations.mjs');
const { publicCase } = await op('reductions/cases.mjs');
const { development } = await op('operator/schedule.mjs');
const { translate } = await op('relais/traduire.mjs');
const prefix = 'experiments/sic-agenda-offres/public-v1/';
const solver = consumer({ sha, depot: fileURLToPath(new URL('../../../', import.meta.url)), entree: prefix + 'solveur.mjs',
  dep: ['admission.mjs','planifier.mjs','schema.json','protocole-1.1/contrat.mjs','protocole-1.1/schema.json'].map(p=>prefix+p)
    .concat(['experiments/sic-agenda-offres/agenda.mjs','src/sic/reasoning-mode.ts']) });
const adapted = c => ({ ...c, message: translate(c.message) });

for (const [id,n,cost] of [['A',2,4],['B',1,2],['C',2,3]]) {
  const sample = adapted(publicCase(id));
  const report = await measure([sample],solver);
  assert.equal(report.bilan.issues.succes,n,id);
  assert.equal(report.bilan.actions.executees,n*cost,id);
  for (const row of report.departs) {
    if (id !== 'B') {
      const read = row.tours.findIndex(t=>t.action==='lire');
      assert.ok(read >= 0);
      assert.equal(row.tours[read+1].action,'marquer P '+row.tours[read].retour);
    }
  }
  console.log(id, sample.message.format, 'accusés déclarés', n + '/' + n, 'succès en',cost,'gestes');
}
for (const c of situations()) {
  const row = await probe(adapted(c),solver);
  assert.ok(row.conforme,c.id);
}
console.log('sra.public/1.1 : 7/7 confirmations valides et 4/4 contrôles insuffisants conformes.');
const cross = situations().find(c=>c.id==='B5');
cross.message.sources[3] = 'La commande indexer P renvoie exactement « indexé ». Elle est disponible si P est non indexé et indexe P.';
for (const c of [{...cross,id:'X1'}, {...cross,id:'X2',negative:true,substitution:cross.other}]) {
  const row = await probe(adapted(c),solver);
  assert.ok(row.conforme,c.id);
  console.log(c.id, 'sra.public/1.1', row.livre, '→', JSON.stringify(row.suivant));
}
const cards = development().map(adapted);
assert.equal(cards.length,12);
assert.ok(cards.every(c => c.message.receipts.every(r => r.status === 'undeclared')));
const translated = await measure(cards,solver);
assert.equal(translated.bilan.departs,18);
assert.equal(translated.bilan.admission.admises,18);
assert.ok(translated.departs.every(row => row.statut === 'arret_solveur' && row.premierEcart.detail.includes('undeclared')));
console.log('Anciennes fiches traduites en 1.1, accusés matériels undeclared :', JSON.stringify(translated.bilan));
