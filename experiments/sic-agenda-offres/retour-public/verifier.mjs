import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { admit, key } from '../public-v1/admission.mjs';
import { initialState, project } from '../public-v1/planifier.mjs';
import { PublicSession, qualifyReturn } from '../public-v1/solveur.mjs';

if (!process.argv[2]) throw new Error('Indiquer le dossier public-format/reductions de développement');
const card = JSON.parse(await readFile(join(process.argv[2], 'B.json'), 'utf8'));
const possible = structuredClone(card);
possible.observations.push({ ref: ['indice-annexe', 'P'], status: 'unknown', source: [5] });
possible.sources[5] = 'La valeur de l’indice annexe est inconnue.';
const command = ['indexer', 'P'];

function pending(fiche, words = command) {
  const model = admit(fiche), state = initialState(model);
  const request = { ...project(model, state, key(words)), command: words };
  return { model, state, request };
}
function after(fiche, feedback, words = command) {
  const s = new PublicSession();
  assert.deepEqual(s.next({ fiche }), { action: words.join(' ') });
  return s.next({ retour: feedback });
}
const { model, state, request } = pending(possible);
assert.deepEqual(model.receipts.get(key(command)), { text: 'indexé', source: [3] });
const before = structuredClone(state);
const positive = qualifyReturn(model, request, 'indexé');
assert.deepEqual([...positive.state.facts], [[key(['indexed', 'P']), true]]);
assert.equal(positive.state.facts.has(key(['indice-annexe', 'P'])), false);
assert.equal(model.observations.get(key(['indice-annexe', 'P'])).status, 'unknown');
assert.deepEqual(after(possible, 'indexé'), { action: 'valider' });
for (const feedback of ['Action indisponible.', ' ', 'indexé ailleurs', 'Indexé', 'poste indexé']) {
  assert.ok(after(possible, feedback).arret);
  assert.ok(qualifyReturn(model, request, feedback).reason);
}
assert.deepEqual(state, before);
assert.deepEqual([...state.facts], [[key(['indexed', 'P']), false]]);

// L’identité comprend tous les arguments. Un accusé annoncé pour Q ne confirme rien pour P.
const foreign = structuredClone(possible);
foreign.sources[6] = 'indexer Q renvoie exactement « ailleurs ».';
foreign.commands.push({ command: ['indexer', 'Q'], source: [6] });
assert.ok(after(foreign, 'ailleurs').arret);
assert.deepEqual(after(foreign, 'indexé'), { action: 'valider' });
const ambiguous = structuredClone(possible);
ambiguous.sources[6] = 'indexer P renvoie exactement « second accusé ».';
ambiguous.commands[0].source.push(6);
for (const feedback of ['indexé', 'second accusé', 'poste indexé']) assert.match(after(ambiguous, feedback).arret, /ambigu/);
const conditional = structuredClone(possible);
conditional.sources[3] = conditional.sources[3].replace('indexe P et', 'indexe P sous condition et');
assert.match(after(conditional, 'indexé').arret, /ambigu/);

const renamed = JSON.parse(JSON.stringify(possible, (_, value) => {
  if (value === 'indexer') return 'caler';
  if (value === 'indexed') return 'calé';
  return value === 'P' ? 'Q' : value;
}));
const words = ['caler', 'Q'];
renamed.sources[2] = 'Le poste Q est initialement non calé.';
renamed.sources[4] = 'valider termine sur succès si Q est calé, sur échec sinon.';
renamed.sources[3] = 'caler Q est disponible si le poste est libre. La commande cale Q et renvoie exactement « R-42 ».';
assert.deepEqual(after(renamed, 'R-42', words), { action: 'valider' });
assert.ok(after(renamed, 'indexé', words).arret);
renamed.sources[3] = 'caler Q renvoie exactement « R-42 ».';
assert.deepEqual(after(renamed, 'R-42', words), { action: 'valider' });

const legacy = structuredClone(possible);
legacy.sources[3] = 'La commande indexe le poste P.';
assert.deepEqual(after(legacy, 'poste indexé'), { action: 'valider' });
assert.ok(after(legacy, 'indexé').arret);
console.log('B : indexer P → indexé → valider. Seul indexed(P) devient vrai.');
console.log('Refus, retour vide, libellé étranger, ambiguïté, renommage et accusé historique vérifiés.');
