import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { admit, key } from '../public-v1/admission.mjs';
import { initialState, decide, project } from '../public-v1/planifier.mjs';
import { PublicSession } from '../public-v1/solveur.mjs';

if (!process.argv[2]) throw new Error('Indiquer le dossier des fiches de développement');
const patch = JSON.parse(await readFile(new URL('../caracterisation-public-v1/contre-exemple.json', import.meta.url), 'utf8'));
const opposite = JSON.parse(await readFile(join(process.argv[2], patch.base), 'utf8'));
const same = structuredClone(opposite);
const changed = same.observations.find(o => key(o.ref) === key(patch.ref));
assert.equal(changed.value, patch.avant);
changed.value = patch.apres;
same.sources[patch.ligne] = same.sources[patch.ligne].replace(patch.avant, patch.apres);
const marks = patch.planSansLecture.slice(0, -1);
const dial = key(same.domains[0].ref);

function afterMarks(card) {
  const m = admit(card);
  let s = initialState(m);
  for (const command of marks) {
    const transition = project(m, s, key(command));
    assert.equal(transition.next.length, 1);
    s = transition.next[0];
  }
  return [m, s];
}

// Opérateur jouet indépendant de project. La sortie n’est transmise qu’en retour de lire.
function play(card, exit) {
  const session = new PublicSession(), log = [], stamps = new Map();
  const required = card.observations.find(o => key(o.ref) === key(['required_stamp', exit])).value;
  const cells = card.observations.filter(o => o.ref[0] === 'mark').map(o => o.ref[1]);
  let reply = session.next({ fiche: card });
  for (let i = 0; i < 5; i++) {
    const words = card.commands.find(c => c.command.join(' ') === reply?.action)?.command;
    assert.ok(words, 'commande déclarée attendue');
    const [verb, cell, stamp] = words;
    let feedback;
    if (verb === 'lire') {
      assert.ok(log.every(t => t.command[0] !== 'lire'));
      feedback = exit;
    } else if (verb === 'marquer') {
      assert.ok(cells.includes(cell) && !stamps.has(cell) && [...stamps.values()].every(v => v === stamp));
      stamps.set(cell, stamp);
      feedback = 'marqué';
    } else {
      assert.deepEqual(words, card.goal.command);
      feedback = cells.every(c => stamps.get(c) === required) ? 'succès' : 'échec';
    }
    log.push({ command: words, feedback });
    reply = session.next({ retour: feedback });
    if (!reply) { assert.equal(feedback, 'succès'); return log; }
  }
  throw new Error('Partie non terminée');
}

for (const [label, card, cost] of [['commun', same, 3], ['opposé', opposite, 4]]) {
  const m = admit(card), s = initialState(m), before = structuredClone(s);
  const choice = decide(m, s);
  assert.deepEqual(s, before);
  assert.equal(choice.cost, cost);
  assert.equal(decide(m, s, [], cost - 1).command, null);
  const permuted = structuredClone(card);
  permuted.commands.reverse();
  const other = admit(permuted);
  assert.deepEqual(decide(other, initialState(other)), choice);
  const logs = card.domains[0].values.map(exit => play(card, exit));
  assert.deepEqual(logs.map(l => l.length), [cost, cost]);
  if (card === same) {
    assert.deepEqual(choice.finalists, marks);
    assert.deepEqual(logs[0], logs[1]);
    assert.deepEqual(logs[0].map(t => t.command), patch.planSansLecture);
  } else {
    assert.deepEqual(choice.command, ['lire']);
    assert.notDeepEqual(logs[0][1].command, logs[1][1].command);
  }
  console.log(label, choice.command.join(' '), 'horizon', cost, 'deux succès', JSON.stringify(choice.commonProofs));
}
const [m, s] = afterMarks(same);
assert.equal(s.facts.has(dial), false);
const snapshot = structuredClone(s);
const success = project(m, s, key(m.goal.command));
assert.equal(success.end, 'success');
assert.deepEqual(success.proof, { kind: 'all-public-values', ref: same.domains[0].ref,
  values: same.domains[0].values, source: same.domains[0].source });
assert.deepEqual(s, snapshot);
assert.equal(m.observations.get(dial).status, 'unknown');

for (const variant of ['sortie-en-échec', 'sortie-sans-règle', 'domaine-absent', 'stabilité-inconnue', 'deux-inconnues']) {
  const card = structuredClone(same);
  if (variant.startsWith('sortie-')) card.domains[0].values.push('troisième-sortie');
  if (variant === 'sortie-sans-règle') card.rules = card.rules.filter(r => r.effect?.end !== 'failure');
  if (variant === 'domaine-absent') card.domains = [];
  if (variant === 'stabilité-inconnue') delete card.domains[0].stableWhen;
  if (variant === 'deux-inconnues') {
    card.observations = card.observations.filter(o => key(o.ref) !== key(patch.ref));
  }
  const [model, state] = afterMarks(card);
  const terminal = project(model, state, key(model.goal.command));
  assert.equal(terminal.proof.kind, 'unproved', variant);
  assert.equal(decide(model, initialState(model)).command, null, variant);
}
const unspecified = structuredClone(same);
unspecified.rules.find(r => r.effect?.end === 'success').effect.end = 'unspecified';
const [attempt, attemptState] = afterMarks(unspecified);
assert.equal(project(attempt, attemptState, key(attempt.goal.command)).proof.kind, 'unproved');

// Cas abstrait de borne. Chaque étiquette de préparation expose la même tautologie
// sur un domaine fermé. Le parcours crée autant d’états distincts que d’étiquettes.
function budgetCard(count, labels) {
  const values = Array.from({ length: count }, (_, i) => 'v' + i);
  const goal = ['fin'], ref = ['valeur'], phase = ['phase'], source = [1];
  const preparations = Array.from({ length: labels }, (_, i) => ['préparer', String(i)]);
  const when = { all: [{ not: { eq: [phase, 'initiale'] } }, { any: values.map(v => ({ eq: [ref, v] })) }] };
  return { format: 'sra.public/1', goal: { command: goal, criterion: 'minimax_actions', source },
    commands: [goal, ...preparations].map(command => ({ command, source })),
    observations: [{ ref: phase, status: 'known', value: 'initiale', source }, { ref, status: 'unknown', source }],
    domains: [{ ref, values, stableWhen: true, source }], rules: [{ command: goal, when, effect: { end: 'success' }, source },
      ...preparations.map(command => ({ command, effect: { set: [phase, command[1]] }, source }))],
    sources: { 1: 'Préparer une étiquette puis terminer si la valeur appartient au domaine annoncé.' } };
}
for (const [n, expectedCost] of [[8, 2], [9, null]]) {
  const model = admit(budgetCard(n, 1));
  const result = decide(model, initialState(model), [], 2);
  assert.equal(result.cost, expectedCost);
  assert.equal(result.commonProofs.trials, n === 8 ? 8 : 0);
  if (n === 9) assert.ok(result.commonProofs.bounded > 0);
}
const busy = admit(budgetCard(2, 33)), capped = decide(busy, initialState(busy), [], 2);
assert.equal(capped.commonProofs.trials, 64);
assert.equal(capped.commonProofs.proved, 32);
assert.ok(capped.commonProofs.bounded > 0);
assert.equal(capped.finalists.length, 32);
console.log('Cas incomplets en abstention. Bornes vérifiées : 8 valeurs par preuve, 64 hypothèses par décision.');
