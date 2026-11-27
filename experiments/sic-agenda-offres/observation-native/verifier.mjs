import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { cut, events, loadCaps, observeAgenda, predict, targets } from './avant.mjs';
import { compare, readReceipt } from './apres.mjs';
import { scene } from '../cas.mjs';

if (!process.argv[2]) throw new Error('Usage : verifier.mjs DOSSIER_RUN');
const path = resolve(process.argv[2], 'G50T-A.jsonl');
const caps = await loadCaps();

async function* transform(fn) {
  for await (const event of events(path)) {
    const changed = fn(event);
    if (changed) yield changed;
  }
}
const at = (e, t, offset = 0) => e.game === t.game && e.level === t.level && e.turn === t.turn + offset;

// Tout accès à un champ non autorisé provoque immédiatement l'échec du test.
// Le premier événement du tour cible (même son en-tête) reste inaccessible.
function shield(e, t) {
  assert.ok(e.level < t.level || e.level === t.level && e.turn < t.turn, 'lecture après la coupe');
  const keys = new Set();
  if (e.kind === 'observation' && e.level === 1 && e.turn === 1) keys.add('level');
  if (e.kind === 'boundary') keys.add('operation');
  if (e.kind === 'native') keys.add('kind');
  if (at(e, t, -1)) {
    if (e.kind === 'observation') for (const key of ['level', 'levelsCompleted', 'state', 'availableActionIds']) keys.add(key);
    if (e.kind === 'native' && e.value.kind === 'actual_outcome') for (const key of ['matched', 'observation_ref']) keys.add(key);
    if (e.kind === 'boundary') for (const key of ['kind', 'phase']) keys.add(key);
  }
  return { ...e, value: new Proxy(e.value, {
    get(obj, key) { assert.ok(keys.has(key), 'champ hors contrat : ' + e.kind + '.' + String(key)); return obj[key]; },
    ownKeys() { throw new Error('copie globale interdite : ' + e.kind); },
  }) };
}

// Témoin positif du chemin de sélection, distinct des deux verdicts natifs.
const full = observeAgenda({ ...scene, offers: scene.offers.map(offer => ({ ...offer, family: offer.entry })) });
assert.deepEqual(full.selection, { family: 'sic_compare_available_controls', strategy: 'compare_alternative' });
const mock = { ...full, context: { observationRef: 'témoin', mode: 'solving', card: 'c', remaining: 2 } };
const mockReceipt = { ...mock.context, selection: full.selection };
assert.equal(compare(mock, mockReceipt).verdict, 'accord');
assert.equal(compare(mock, { ...mockReceipt, selection: { ...full.selection, family: 'autre' } }).verdict, 'écart');

for (const target of targets) {
  const project = records => cut(records, target, caps);
  const actual = await project(events(path));
  assert.equal(actual.cut, true);
  const before = predict(actual);
  const sealed = await project(transform(e => shield(e, target)));
  assert.deepEqual(sealed, actual);
  assert.deepEqual(predict(sealed), before);
  assert.equal(before.status, 'indéterminé');
  assert.deepEqual(before.missing, ['need', 'offers', 'stops']);
  assert.equal(before.families.comparaison.admission, 'contredite');
  assert.equal(before.families.acces.admission, 'indeterminee');

  // Changer le résultat réservé, la commande et le plateau suivant pour CE tour.
  // À T12 le retour public T11 reste antérieur et doit pouvoir agir comme tel.
  function poison(e) {
    if (!at(e, target)) return e;
    if (e.kind === 'native' && e.value.kind === 'sic_native_plan') return { ...e,
      value: { ...e.value, family: 'leurre', strategy: 'leurre' } };
    if (e.kind === 'decision') return { ...e, value: { ...e.value, command: { action_ref: 'leurre' },
      proposal: { kind: 'leurre', sicLocalDecision: { strategy: 'leurre' } } } };
    if (e.kind === 'dispatch' || e.kind === 'observation') return { ...e, value: { faux: true } };
    return e;
  }
  assert.deepEqual(predict(await project(transform(poison))), before);
  const receipt = await readReceipt(events(path), target);
  assert.ok(receipt);
  const route = target.turn === 11;
  assert.deepEqual(receipt.selection, { family: 'sic_verify_remote_replay', strategy: route ? 'P07' : 'P05' });
  assert.deepEqual(receipt.localGuards, { routeSupported: route, eligibleProbe: !route, knownInteraction: false });
  const changed = await readReceipt(transform(poison), target);
  assert.deepEqual(changed.selection, { family: 'leurre', strategy: 'leurre' });
  assert.notDeepEqual(changed.selection, receipt.selection);
  assert.deepEqual(compare(before, receipt).contexte, { mode: 'accord', card: 'accord', remaining: 'accord' });
  assert.equal(compare(before, receipt).verdict, 'indéterminé');
  assert.equal(compare(before, { ...receipt, observationRef: 'périmée' }).contexte, null);

  // Les champs légitimes influencent effectivement le prédicteur.
  const other = await project(transform(e => {
    if (at(e, target, -1) && e.kind === 'observation') return { ...e, value: { ...e.value, availableActionIds: [1, 2] } };
    if (at(e, target, -1) && e.kind === 'native' && e.value.kind === 'actual_outcome') {
      return { ...e, value: { ...e.value, matched: false } };
    }
    return e;
  }));
  const positive = predict(other);
  assert.equal(positive.context.mode, 'exploration');
  assert.equal(positive.families.comparaison.admission, 'indeterminee');
  const lost = await project(transform(e => at(e, target, -1) && e.kind === 'boundary' ? null : e));
  assert.equal(lost.cut, false);
  assert.equal(predict(lost).status, 'indéterminé');
  const lostObservation = await project(transform(e => at(e, target, -1) && e.kind === 'observation' ? null : e));
  assert.equal(lostObservation.cut, false);
  console.log('Tour', target.turn, '· coupe protégée, résultat masqué, mutation du reçu et contrôles positifs vérifiés.');
}
