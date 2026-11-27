import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateFinite } from '../../finite-policies.mjs';
import { measure } from '../operator/measure.mjs';
import { launch } from '../../ressource/qualification/solveur.mjs';
import { frozen } from './consumer.mjs';
import { publicCase } from './cases.mjs';
import { receiptCase } from './B.mjs';

const solver = frozen();
const stop = 'aucune continuation justifiée dans l’horizon 10';
const ackStop = 'accusé matériel non reconnu pour la commande demandée';
const oracle = c => enumerateFinite(c.worlds, c.dynamics);

test('A · arrêt avant toute commande, effet conditionnel localisé', async () => {
  const c = publicCase('A'), r = await measure([c], solver);
  assert.equal(r.bilan.admission.admises, 2);
  assert.equal(r.bilan.issues.abandons, 2);
  for (const row of r.departs) {
    assert.deepEqual(row.tours, []);
    assert.deepEqual(row.premierEcart, {tour:0, etape:'decision', detail:stop});
  }
  // Diagnostic distinct du processus d'essai. Les modules importés proviennent du même gel Git.
  const folder = './programme/experiments/sic-agenda-offres/public-v1/';
  const diagnostic = `import { admit, key } from '${folder}admission.mjs';
    import { initialState, project } from '${folder}planifier.mjs';
    import { createInterface } from 'node:readline';
    for await (const line of createInterface({input:process.stdin})) {
      const m = admit(JSON.parse(line).fiche);
      console.log(JSON.stringify(project(m, initialState(m), key(['indexer','P'])).reason));
      break;
    }`;
  const proc = launch(new Map([...solver.files, ['diagnostic.mjs',Buffer.from(diagnostic)]]), 'diagnostic.mjs');
  try { assert.equal(await proc.reply({fiche:c.message}), 'effet conditionnel indéterminé'); }
  finally { await proc.close(); }
});

test('A · geste commun exécutable, puis lecture discriminante indispensable', async () => {
  const c = publicCase('A');
  const answer = oracle(c);
  assert.equal(answer.minimum, 4);
  assert.deepEqual(answer.policies, [{R:['indexer P','lire','marquer P R','valider'],
    S:['indexer P','lire','marquer P S','valider']}]);
  const program = 'temoin.mjs';
  const script = `import {createInterface} from 'node:readline';
    for await (const line of createInterface({input:process.stdin})) {
      const {fiche,retour} = JSON.parse(line);
      if (retour === 'succès') break;
      const action = fiche ? 'indexer P' : retour === 'poste indexé' ? 'lire' :
        retour === 'marqué' ? 'valider' : 'marquer P ' + retour;
      console.log(JSON.stringify({action}));
    }`;
  const r = await measure([c], {program,files:new Map([[program,Buffer.from(script)]])});
  assert.equal(r.bilan.issues.succes, 2);
  assert.equal(r.paires[0].tour, 2);
  assert.equal(r.paires[0].action, 'lire');
  for (const [i,row] of r.departs.entries()) {
    assert.deepEqual(row.tours.map(t=>t.retour), ['poste indexé',c.worlds[i],'marqué','succès']);
    assert.deepEqual(row.tours.map(t=>t.action), answer.optimal[0][c.worlds[i]]);
  }
});

test('B · premier arrêt sur le libellé exact, avec contrôle à un seul libellé changé', async () => {
  const c = publicCase('B'), r = await measure([c], solver);
  assert.equal(r.bilan.admission.admises, 1);
  assert.equal(r.bilan.issues.abandons, 1);
  assert.deepEqual(r.departs[0].tours,[{action:'indexer P',retour:'indexé',executee:true}]);
  assert.deepEqual(r.departs[0].premierEcart,{tour:1,etape:'decision',detail:ackStop});
  assert.deepEqual(oracle(c).optimal, [{unique:['indexer P','valider']}]);
  const card = structuredClone(c.message);
  card.sources[3] = card.sources[3].replace('« indexé »','« poste indexé »');
  const alt = await measure([receiptCase(card, 'P', 'poste indexé')], solver);
  assert.equal(alt.bilan.issues.succes, 1);
  assert.deepEqual(alt.departs[0].tours.map(t=>t.action), ['indexer P','valider']);
});

test('C · chaque marque prématurée condamne un monde, le consommateur les écarte toutes deux', async () => {
  const c = publicCase('C'), answer = oracle(c);
  assert.equal(answer.minimum, 3);
  assert.deepEqual(answer.policies, [{R:['lire','marquer P R','valider'],S:['lire','marquer P S','valider']}]);
  for (const [i,world] of c.worlds.entries()) {
    const wrong = 'marquer P ' + c.worlds[1-i];
    const committed = c.dynamics.step(world, c.dynamics.initialState(world), wrong);
    assert.ok(committed.next);
    assert.equal(c.dynamics.step(world, committed.next, 'valider').feedback, 'échec');
    assert.ok(answer.perWorld[world].every(plan=>plan[0] !== wrong));
  }
  const r = await measure([c], solver);
  assert.equal(r.bilan.issues.succes, 2);
  for (const [i,row] of r.departs.entries())
    assert.deepEqual(row.tours.map(t=>t.action),answer.optimal[0][c.worlds[i]]);
});
