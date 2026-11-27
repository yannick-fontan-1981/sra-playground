import assert from 'node:assert/strict';
import { Agenda } from './agenda.mjs';
import { access, accessEntry, compareEntry, fact, group, needs, refusal, scene, withoutFact } from './cas.mjs';

const results = [];
const fresh = turn => new Agenda().decide(turn);
const row = (r, id) => r.tree.branches.find(b => b.id === id);
const size = r => 1 + r.tree.branches.reduce((n, b) => n + 1 + b.questions.length, 0);
const verdict = r => [r.decision, r.branch, r.proof].filter(Boolean).join(' / ');

function verify(label, result, expected) {
  assert.equal(verdict(result), expected, label);
  assert.equal(result.tree.budget, 1);
  const active = result.tree.branches.filter(b => ['attend_preuve', 'active'].includes(b.status));
  assert.equal(active.length, result.tree.activePath ? 1 : 0);
  if (result.tree.activePath) assert.deepEqual(result.tree.activePath, [result.goal, active[0].id, ...(result.proof ? [result.proof] : [])]);
  for (const b of result.tree.branches) {
    assert.ok(b.reason);
    if (b.status === 'suspendue') assert.ok(b.resumeWhen);
  }
  results.push({ label, expected, result });
  return result;
}

const compare = 'selectionner / comparaison', reach = 'selectionner / acces';
const open = 'ouvrir_preuve / comparaison / retourDiagonalUnique';
const wait = 'suspendre / comparaison / retourDiagonalUnique';
const full = verify('Besoin de contraste', fresh(scene), compare);
const reachNeed = { ...scene, need: needs.reach };
const otherNeed = verify('Seul le besoin devient accès', fresh(reachNeed), reach);
assert.equal(row(full, 'comparaison').contribution, 'directe');
assert.equal(row(otherNeed, 'comparaison').contribution, 'repli');
assert.equal(row(otherNeed, 'acces').contribution, 'directe');
assert.deepEqual(full.tie, null);

const missing = withoutFact(scene, 'retourDiagonalUnique');
assert.deepEqual(fresh(missing), fresh({ ...scene, facts: { ...scene.facts, retourDiagonalUnique: { value: 'unknown' } } }));
const contradicted = { ...missing, facts: { ...missing.facts, retourDiagonalUnique: fact(false, 'mouvement-7-8-axial') } };
const episode = new Agenda();
const first = verify('Retour diagonal absent', episode.decide(missing), open);
assert.equal(row(first, 'comparaison').admission, 'indeterminee');
assert.equal(row(first, 'acces').admission, 'admissible');
assert.equal(size(first), 4);
const second = verify('Même état sur le même arbre', episode.decide(missing), wait);
assert.equal(size(second), size(first));
assert.deepEqual(episode.decide(missing), second);
assert.equal(second.tree.activePath, null);
assert.deepEqual(second.returns, []);
const returned = verify('Le témoin arrive, retour au parent', episode.decide(scene), compare);
assert.deepEqual(returned.returns, [{ parent: scene.goal, branch: 'comparaison', fact: 'retourDiagonalUnique',
  result: 'confirmee', evidence: ['mouvement-7-8'] }]);
assert.equal(size(returned), 4);
assert.equal(row(returned, 'comparaison').questions[0].state, 'confirmee');
assert.equal(row(returned, 'acces').status, 'differee');
assert.ok(returned.evidence.includes('mouvement-7-8'));

const counterfactual = new Agenda();
assert.deepEqual(counterfactual.decide(missing), first);
assert.deepEqual(counterfactual.decide(missing), second);
const counter = verify('Le même relevé contredit le prérequis', counterfactual.decide(contradicted), reach);
assert.equal(row(counter, 'comparaison').status, 'suspendue');
assert.equal(row(counter, 'comparaison').questions[0].state, 'contraire');
assert.equal(row(counter, 'acces').status, 'active');
assert.match(row(counter, 'comparaison').resumeWhen, /retourDiagonalUnique=true/);
assert.deepEqual(counter.returns[0].evidence, ['mouvement-7-8-axial']);
assert.ok(counter.evidence.includes('mouvement-7-8-axial'));
assert.equal(row(fresh(withoutFact(contradicted, 'autreCommandeAdmise')), 'comparaison').admission, 'contredite');
assert.equal(size(counter), 4);
const restored = verify('Le prérequis est rétabli', counterfactual.decide(scene), compare);
assert.equal(size(restored), 4);
assert.equal(row(restored, 'comparaison').questions[0].state, 'confirmee');

const reverse = turn => ({ ...turn, offers: [...turn.offers].reverse() });
const permuted = verify('Ordre des offres inversé', fresh(reverse(scene)), compare);
assert.deepEqual(permuted, full);
assert.deepEqual(fresh(reverse(contradicted)), fresh(contradicted));

const common = { ...scene, need: needs.learn };
for (const [mode, expected, witness] of [
  ['assimilation', compare, 'obligation-relecture-8'],
  ['exploration', compare, 'registre-alternative-8'],
  ['solving', reach, 'dependance-acces-8'],
]) {
  const modeTurn = { ...common, mode };
  const byMode = verify('Besoin commun, ' + mode, fresh(modeTurn), expected);
  assert.deepEqual(byMode.tie.peers, ['acces', 'comparaison']);
  assert.deepEqual(byMode.tie.finalists, [byMode.branch]);
  assert.deepEqual(byMode.tie.evidence, [witness]);
  assert.ok(byMode.evidence.includes(witness));
  assert.deepEqual(fresh(reverse(modeTurn)), byMode);
  const unproved = verify('Prérequis absent, ' + mode, fresh({ ...missing, mode }), open);
  assert.equal(row(unproved, 'comparaison').admission, 'indeterminee');
}
const tied = withoutFact(common, 'alternativeNonMesuree');
const equal = verify('Égalité résiduelle', fresh(tied), reach);
assert.deepEqual(equal.tie.finalists, ['acces', 'comparaison']);
assert.equal(equal.tie.lastRule, 'identifiant de branche croissant');
assert.deepEqual(equal, verify('Même égalité, ordre inversé', fresh(reverse(tied)), reach));

// Entrées virtuelles pour éprouver les frontières d'un reçu effectif. Le
// troisième candidat sert exclusivement de témoin au-delà du groupe arrêté.
const next = { ...access, id: 'suite', group: 'groupe_temoin' };
const scopeCase = { ...scene, offers: [...scene.offers, next],
  groups: [...scene.groups, { id: next.group, entries: [accessEntry] }] };
function withStop(scope, entry = compareEntry) {
  return { ...scopeCase, stops: [refusal(scope, entry)] };
}
verify('Témoin de portée, avant refus', fresh(scopeCase), compare);
const local = verify('Refus limité à une entrée', fresh(withStop('entry')), reach);
assert.equal(row(local, 'acces').barrier, null);
assert.equal(row(local, 'comparaison').barrier, 'refus-entry');
const groupStop = verify('Arrêt du reste du groupe', fresh(withStop('group')), 'selectionner / suite');
assert.equal(row(groupStop, 'acces').barrier, 'refus-group');
assert.equal(row(groupStop, 'suite').barrier, null);
const stop = verify('Refus qui arrête le parcours', fresh(withStop('traversal')), 'suspendre / ' + group + '/' + compareEntry);
assert.deepEqual(stop.evidence, ['refus-traversal']);
assert.ok(stop.tree.branches.every(b => b.barrier === 'refus-traversal'));
assert.equal(stop.resumeWhen, refusal('traversal').resumeWhen);
const earlier = verify('Offre antérieure au refus de parcours', fresh(withStop('traversal', accessEntry)), compare);
assert.equal(row(earlier, 'comparaison').barrier, null);
assert.equal(row(earlier, 'suite').barrier, 'refus-traversal');
const hiddenStop = fresh({ ...withStop('group'), stops: [refusal('group'), refusal('traversal', accessEntry)] });
assert.deepEqual(hiddenStop, groupStop);
for (const stale of [{ frame_hash: 'autre' }, { level_epoch: 2 }, { observation_ref: 'obs-0' }, { release_authority: true }]) {
  assert.throws(() => fresh({ ...scene, stops: [{ ...refusal('traversal'), ...stale }] }), /invalide ou périmé/);
}
assert.throws(() => fresh({ ...scene, facts: { ...scene.facts, retourDiagonalUnique: fact(true) } }), /références/);
assert.throws(() => fresh({ ...scene, stops: [{ ...refusal('group'), source_entry: accessEntry }] }), /invalide ou périmé/);

if (process.argv.includes('--trace')) {
  console.log(JSON.stringify(results.map(({ label, result }) => ({ label, ...result })), null, 2));
} else {
  console.log('| Expérience | Attendu | Obtenu | Égalité départagée par | Nœuds / feuilles actives |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const { label, expected, result } of results) {
    const tie = result.tie;
    const rule = tie ? (tie.lastRule ?? tie.rule) : '—';
    console.log('| ' + [label, expected, verdict(result), rule, size(result) + ' / ' + Number(!!result.tree.activePath)].join(' | ') + ' |');
  }
  console.log('\n' + results.length + ' décisions conformes aux attentes.');
}
