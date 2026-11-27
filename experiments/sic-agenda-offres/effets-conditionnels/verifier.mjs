import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { admit, key } from '../public-v1/admission.mjs';
import { decide, initialState, project } from '../public-v1/planifier.mjs';
import { PublicSession } from '../public-v1/solveur.mjs';

if (!process.argv[2]) throw new Error('Indiquer le dossier public-format/reductions');
const load = async id => JSON.parse(await readFile(join(process.argv[2], id + '.json'), 'utf8'));
const card = await load('A'), model = admit(card), state = initialState(model), before = structuredClone(state);
const index = ['indexer', 'P'], dial = key(['dial']), driver = key(['effort','P']);
const choice = decide(model, state);
assert.deepEqual(choice.command, index);
assert.equal(choice.cost, 4);
assert.equal(decide(model, state, [], 3).command, null);
assert.deepEqual(choice.conditionalEffects, { examined: 2, bounded: 0 });
const step = project(model, state, key(index));
assert.equal(step.next.length, 1);
const finalBudget = { cache: new Map(), examined: 62, bounded: 0 };
assert.ok(project(model, state, key(index), finalBudget).next);
assert.equal(finalBudget.examined, 64);
assert.ok(project(model, state, key(index), finalBudget).next);
assert.equal(finalBudget.examined, 64);
const tooSmall = { cache: new Map(), examined: 63, bounded: 0 };
assert.ok(project(model, state, key(index), tooSmall).reason);
assert.equal(tooSmall.examined, 63);
assert.equal(tooSmall.bounded, 1);
const indexed = step.next[0];
assert.deepEqual(indexed.revealed, []);
assert.equal(indexed.facts.get(key(['indexed','P'])), true);
assert.equal(indexed.facts.has(dial), false);
assert.equal(indexed.facts.has(driver), false);
assert.deepEqual(indexed.possible.get(dial), ['R','S']);
assert.deepEqual(state, before);
assert.deepEqual(decide(model, indexed).command, ['lire']);
const reading = project(model, indexed, key(['lire']));
assert.deepEqual(reading.next.map(s => s.revealed), [[{ ref: ['dial'], value: 'R' }], [{ ref: ['dial'], value: 'S' }]]);
for (const observed of reading.next) {
  assert.equal(observed.possible.has(dial), false);
  assert.equal(observed.facts.has(driver), false);
  assert.deepEqual(decide(model, observed).command, ['marquer','P',observed.facts.get(dial)]);
}
const reversed = structuredClone(card);
reversed.commands.reverse();
reversed.rules.reverse();
const reverseModel = admit(reversed);
assert.deepEqual(decide(reverseModel, initialState(reverseModel)), choice);
for (const value of ['R','S']) {
  const session = new PublicSession();
  assert.deepEqual(session.next({ fiche: card }), { action: 'indexer P' });
  assert.deepEqual(session.next({ retour: 'poste indexé' }), { action: 'lire' });
  assert.deepEqual(session.next({ retour: value }), { action: 'marquer P ' + value });
  assert.deepEqual(session.next({ retour: 'marqué' }), { action: 'valider' });
  assert.equal(session.next({ retour: 'succès' }), null);
}
const variants = {
  'précondition inconnue': c => { delete c.observations[0].value; c.observations[0].status = 'unknown'; },
  'une issue sans règle': c => c.domains[0].values.push('T'),
  'conflit simultané': c => c.rules.push({ command: index, when: {eq:[['effort','P'],'R']}, effect:{set:[['dial'],'S']}, source:[3] }),
  'risque terminal': c => c.rules.push({ command: index, when: {eq:[['effort','P'],'R']}, effect:{end:'failure'}, source:[3] }),
  'sélecteur instable': c => { delete c.domains[0].stableWhen; },
  'valeur hors domaine de la cible': c => c.domains[1].values.pop(),
  'conflit avec effet certain': c => c.rules.push({ command:index, effect:{set:[['dial'],'R']}, source:[3] }),
  'conservation incompatible': c => c.rules.push({ command:index, effect:{keep:['dial']}, source:[3] }),
  'plus de huit possibilités': c => c.domains[0].values.push('3','4','5','6','7','8','9'),
};
for (const [name, alter] of Object.entries(variants)) {
  const variant = structuredClone(card); alter(variant);
  const m = admit(variant), s = initialState(m);
  assert.ok(project(m, s, key(index)).reason, name);
  assert.equal(decide(m, s).command, null, name);
}

// Le garde-fou de coût reste indépendant : même tampon des deux côtés, projection terminale historique.
const costCard = JSON.parse(await readFile(join(process.argv[2], '../examples/dial.json'), 'utf8'));
costCard.observations.find(o => key(o.ref) === key(['required_stamp','X6e9ba2'])).value = 'X03a3e1';
const costModel = admit(costCard);
assert.equal(decide(costModel, initialState(costModel)).cost, 4);
console.log('A : indexer → lire → marquer R/S → valider. Deux issues conservées, horizon 4.');
console.log('Neuf variations en abstention. Permutations et budget vérifiés. Témoin de coût toujours à quatre gestes.');
