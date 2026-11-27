import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { admit, key } from '../public-v1/admission.mjs';
import { decide, initialState, project } from '../public-v1/planifier.mjs';
import { count } from './compter.mjs';

const dir = process.argv[2];
if (!dir) throw new Error('Indiquer le répertoire public-format/examples de développement');
const read = async path => JSON.parse(await readFile(path, 'utf8'));
async function loadPublic(name) {
  const bytes = await readFile(join(dir, name)), card = JSON.parse(bytes);
  return { card, sha256: createHash('sha256').update(key(card)).digest('hex') };
}
const shown = await loadPublic('dial-c939c746ea676bf167d6.json'), masked = await loadPublic('dial.json');
const change = await read(new URL('./contre-exemple.json', import.meta.url));
const sameCard = structuredClone(masked.card);
sameCard.observations[0] = shown.card.observations[0];
sameCard.sources[11] = shown.card.sources[11];
assert.deepEqual(sameCard, shown.card, 'une seule observation publique et sa ligne de provenance diffèrent');

function summary(card) {
  const model = admit(card), state = initialState(model);
  const { result, metrics, offered } = count(model, state);
  const horizon = result.cost;
  assert.ok(horizon > 1);
  assert.equal(decide(model, state, [], horizon - 1).command, null);
  assert.deepEqual(decide(model, state, [], horizon).command, result.command);
  const permuted = structuredClone(card);
  permuted.commands.reverse();
  const other = admit(permuted);
  assert.deepEqual(count(other, initialState(other)), { result, metrics, offered });

  // Toutes les sous-listes d’observations, avec but, règles, domaines et commandes fixés.
  // Comparer aussi le coût, les finalistes et le statut de succès, pas seulement le premier mot.
  const signature = r => key([r.command, r.cost, r.finalists, r.qualification]);
  const masks = [];
  for (let mask = 0; mask < 2 ** card.observations.length; mask++) {
    const observations = card.observations.filter((_, i) => mask & (1 << i));
    if (masks.some(m => (mask & m) === m)) continue; // Ce sur-ensemble ne peut plus être minimal.
    const reduced = admit({ ...card, observations });
    if (signature(decide(reduced, initialState(reduced))) === signature(result)) masks.push(mask);
  }
  const minimal = masks.map(m => card.observations.filter((_, i) => m & (1 << i)).map(o => o.ref));
  const alternatives = [];
  for (const [id, command] of model.commands) {
    const transition = project(model, state, id);
    let forcedCost = null;
    if (transition.next) {
      const costs = transition.next.map(s => decide(model, s, [], 9).cost);
      if (costs.every(Number.isInteger)) forcedCost = 1 + Math.max(...costs);
    } else if (transition.end === 'success') forcedCost = 1;
    alternatives.push({ command: command.command, projection: transition.reason ?? (transition.end ?? 'applicable'),
      coutPremierGesteImpose: forcedCost });
  }
  return { command: result.command, horizon, qualification: result.qualification, equality: result.tie?.lastRule ?? null,
    admissibles: offered.admissible.length, finalistes: result.finalists, metrics, observationsMinimales: minimal,
    lignesCiteesParAgenda: result.evidence, alternatives };
}

const connu = summary(shown.card), inconnu = summary(masked.card);
assert.equal(connu.command[0], 'marquer');
assert.equal(inconnu.command[0], 'lire');
assert.equal(connu.horizon, 3);
assert.equal(inconnu.horizon, 4);
assert.equal(connu.finalistes.length, 2);
assert.equal(inconnu.finalistes.length, 1);

// Même contrat public, une seule exigence changée. Les deux sorties demandent le même tampon.
const variant = structuredClone(masked.card);
const rule = variant.observations.find(o => key(o.ref) === key(change.ref));
assert.equal(rule.value, change.avant);
rule.value = change.apres;
variant.sources[change.ligne] = variant.sources[change.ligne].replace(change.avant, change.apres);
const model = admit(variant);
const response = decide(model, initialState(model));
let commonState = initialState(model);
for (const command of change.planSansLecture.slice(0, -1)) {
  const step = project(model, commonState, key(command));
  assert.equal(step.next?.length, 1);
  commonState = step.next[0];
}
const prematureStop = project(model, commonState, key(change.planSansLecture.at(-1))).reason;
assert.equal(prematureStop, 'effet conditionnel indéterminé');
const verification = [];
for (const value of variant.domains[0].values) {
  let state = initialState(model);
  state.facts.set(key(variant.domains[0].ref), value);
  for (const command of change.planSansLecture.slice(0, -1)) {
    const step = project(model, state, key(command));
    assert.equal(step.next?.length, 1);
    state = step.next[0];
  }
  const end = project(model, state, key(change.planSansLecture.at(-1))).end;
  assert.equal(end, 'success');
  verification.push({ value, end });
}
assert.equal(response.cost, 4, 'contre-exemple à conserver au gel f296ac1c');
const receipt = { consommateur: 'f296ac1c2e18f9d02b8e3045c3a225c61553c0e6',
  entrees: { visible: shown.sha256, masquee: masked.sha256 }, connu, inconnu,
  contreExemple: { commande: response.command, horizonDuSolveur: response.cost, horizonDemontre: 3,
    finalistes: response.finalists, blocageApresDeuxMarques: prematureStop, verification } };
if (process.argv[3] === '--json') {
  process.stdout.write(JSON.stringify(receipt) + '\n');
} else {
  assert.deepEqual(receipt, await read(new URL('./recu.json', import.meta.url)));
  for (const [nom, s] of [['sortie visible', connu], ['sortie masquée', inconnu]]) {
    console.log([nom, s.command.join(' '), 'horizon ' + s.horizon, s.metrics.visited + ' états visités',
      s.metrics.expanded + ' développés', s.finalistes.length + ' offre(s) au coût minimal'].join(' | '));
  }
  console.log('Contre-exemple, exigences identiques : horizon du solveur ' + response.cost + ', plan commun vérifié en 3 gestes.');
}
