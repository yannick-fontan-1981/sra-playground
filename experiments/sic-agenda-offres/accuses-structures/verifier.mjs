import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { admit, key } from '../public-v1/admission.mjs';
import { initialState, project } from '../public-v1/planifier.mjs';
import { PublicSession, qualifyReturn } from '../public-v1/solveur.mjs';

if (!process.argv[2]) throw new Error('Indiquer le dossier public-format du producteur');
const root = resolve(process.argv[2]);
const tool = path => import(pathToFileURL(join(root, path)).href);
const { examples, receiptVariation, confirmation } = await tool('accuses-publics/developpement.mjs');
const { publish, makeLedger } = await tool('accuses-publics/contrat.mjs');
const { publicCase } = await tool('reductions/cases.mjs');
const { situations } = await tool('accuses/situations.mjs');
const samples = examples();
function request(fiche, command) {
  const model = admit(fiche), before = initialState(model);
  const pending = { command, before, ...project(model, before, key(command)) };
  return feedback => qualifyReturn(model, pending, feedback);
}
function firstTwo(fiche, words, feedback) {
  const s = new PublicSession();
  assert.deepEqual(s.next({fiche}), {action: words.join(' ')});
  return s.next({retour: feedback});
}
const p = ['indexer','P'], ref = key(['indexed','P']), q = key(['indexed','Q']);
const specimens = situations();
for (const c of specimens) {
  const card = receiptVariation(c).card;
  const retour = c.substitution ?? (c.down ? 'Action indisponible.' : c.ack);
  const next = firstTwo(card, c.action.split(' '), retour);
  if (c.negative) assert.ok(next.arret, c.id);
  else assert.deepEqual(next, {action:'valider'}, c.id);
}
const cross = specimens.find(c => c.id === 'B5');
cross.message.sources[3] = 'La commande indexer P renvoie exactement « indexé ». Elle est disponible si P est non indexé et indexe P.';
const crossCard = receiptVariation(cross).card;
assert.deepEqual(firstTwo(crossCard, p, cross.ack), {action:'valider'});
assert.ok(firstTwo(crossCard, p, cross.other).arret);
const certain = request(crossCard,p)(cross.ack);
assert.equal(certain.state.facts.get(ref),true);
assert.equal(certain.state.facts.get(q),false);
assert.equal(request(crossCard,p)(cross.other).kind,'unmatched');
const shared = receiptVariation(specimens.find(c => c.id === 'B6')).card;
assert.equal(request(shared,p)('indexé').state.facts.get(q),false);
assert.equal(request(shared,['indexer','Q'])('indexé').state.facts.get(ref),false);
const publicText = structuredClone(crossCard);
publicText.sources[3] = 'Un ordre différent de mots entoure cette citation publique « indexé ».';
assert.deepEqual(firstTwo(publicText,p,'indexé'),{action:'valider'});

const vocab = samples.retours.card;
const qualify = request(vocab,p);
for (const label of ['indexé','indexation faite']) assert.equal(qualify(label).state.facts.get(ref),true);
for (const [label,kind] of [['verrou local','refused'],['compte rendu incomplet','ambiguous'],
  ['Action indisponible.','refused'],['poste indexé','unmatched']]) {
  const r = qualify(label);
  assert.equal(r.kind,kind);
  assert.equal(r.state,undefined);
}
assert.equal(request(vocab,['toucher','U'])('quelconque').kind,'ambiguous');
const absent = structuredClone(samples.B.card);
delete absent.receipts;
assert.equal(request(absent,p)('poste indexé').kind,'undeclared');
assert.ok(firstTwo(absent,p,'indexé').arret);
const undeclared = structuredClone(samples.B.card);
undeclared.receipts[0] = {command:p,status:'undeclared'};
assert.equal(request(undeclared,p)('indexé').kind,'undeclared');

// Même commande, deux effets déterministes projetés. Le reçu en couvre un seul.
const partial = structuredClone(samples.B.card);
const other = ['voyant','P'];
partial.observations.push({ref:other,status:'unknown',source:[2]});
partial.rules.push({command:p,effect:{set:[other,true]},source:[3]});
const projected = request(partial,p)('indexé');
assert.equal(projected.state.facts.get(ref),true);
assert.equal(projected.state.facts.has(key(other)),false);
const unknown = structuredClone(partial);
unknown.receipts[0].replies[0].coverage = 'unknown';
const unproven = request(unknown,p)('indexé');
assert.equal(unproven.kind,'confirmed');
assert.equal(unproven.state.facts.has(ref),false);
assert.equal(unproven.state.facts.has(key(other)),false);
assert.ok(firstTwo(unknown,p,'indexé').arret);
const kept = structuredClone(partial);
kept.rules.push({command:p,effect:{keep:['indexed','P']},source:[3]});
kept.receipts[0].replies[0].coverage.push({effect:{keep:['indexed','P']},source:[3]});
const contradiction = request(kept,p)('indexé');
assert.equal(contradiction.kind,'ambiguous');
assert.equal(contradiction.state,undefined);
const prior = structuredClone(samples.B.card);
const saved = ['témoin','P'];
prior.observations.push({ref:saved,status:'known',value:false,source:[2]});
prior.rules.push({command:p,effect:{keep:saved},source:[3]});
prior.receipts[0].replies[0].coverage.push({effect:{keep:saved},source:[3]});
assert.equal(request(prior,p)('indexé').state.facts.get(key(saved)),false);
const unlinked = structuredClone(samples.B.card);
unlinked.sources[3] = 'Ce texte ne cite aucun libellé.';
assert.throws(()=>admit(unlinked), /Libellé absent/);
const wrongSubject = structuredClone(crossCard);
const wrongReply = wrongSubject.receipts.find(r=>key(r.command)===key(p)).replies[0];
wrongReply.coverage[0].effect.set[0] = ['indexed','Q'];
assert.throws(()=>admit(wrongSubject), /introuvable/);
const duplicate = structuredClone(samples.B.card);
duplicate.receipts[0].replies.push(structuredClone(duplicate.receipts[0].replies[0]));
assert.throws(()=>admit(duplicate));
const wrongVersion = {...samples.B.card,format:'sra.public/1'};
assert.throws(()=>admit(wrongVersion), /schéma/);

const a = samples.A.card, afterIndex = request(a,p)('poste indexé').state;
assert.equal(afterIndex.facts.get(ref),true);
assert.equal(afterIndex.facts.has(key(['dial'])),false);
assert.equal(afterIndex.facts.has(key(['effort','P'])),false);
assert.deepEqual(afterIndex.possible.get(key(['dial'])),['R','S']);
const cBase = publicCase('C').message;
const cDecl = ['R','S'].map(value=>confirmation(cBase,['marquer','P',value],'marqué',{set:[['mark','P'],value]}));
const cardC = publish(cBase,makeLedger(cBase,cDecl));
for (const [id,card] of [['A',a],['C',cardC]]) {
  for (const value of ['R','S']) {
    const session = new PublicSession();
    let out = session.next({fiche: card});
    if (id === 'A') {
      assert.deepEqual(out,{action:'indexer P'});
      out = session.next({retour:'poste indexé'});
    }
    assert.deepEqual(out,{action:'lire'});
    assert.deepEqual(session.next({retour:value}),{action:'marquer P ' + value});
    assert.deepEqual(session.next({retour:'marqué'}),{action:'valider'});
    assert.equal(session.next({retour:'succès'}),null);
  }
}
assert.deepEqual(firstTwo(samples.B3.card,['caler','P'],'calage enregistré'),{action:'valider'});
console.log('1.1 : 7 confirmations et 4 contrôles insuffisants, X1/X2, couverture partielle ou inconnue et lectures A/C vérifiés.');
