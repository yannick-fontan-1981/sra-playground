import { createHash } from 'node:crypto';
import { launch } from '../../ressource/qualification/solveur.mjs';
import { device } from './situations.mjs';

function classify(reply) {
  if (!reply || typeof reply !== 'object' || Object.keys(reply).length !== 1) return 'invalide';
  return ['action','arret','incompatible'].find(k=>typeof reply[k] === 'string' &&
    reply[k].trim().length > 0 && (k !== 'action' || !/[\r\n]/.test(reply[k]))) ?? 'invalide';
}

// Mesure du préfixe jusqu'à la décision suivant le premier retour, même après un refus physique.
export async function probe(c, solver) {
  const input = {fiche:c.message};
  const row = {cas:c.id,initial:createHash('sha256').update(JSON.stringify(input)+'\n').digest('hex'),
    admission:'indéterminée',premier:null,execution:null,physique:null,livre:null,
    interpretation:'non atteinte',suivant:null,issue:null,conforme:false};
  const proc = launch(solver.files,solver.program);
  let final;
  try {
    row.premier = await proc.reply(input);
    const kind = classify(row.premier);
    if (kind === 'invalide') { row.issue='message invalide'; return row; }
    row.admission = kind==='incompatible' ? 'incompatible' : 'admise';
    if (kind!=='action') { row.issue=kind; return row; }
    const action = row.premier.action.trim().replace(/\s+/g,' ');
    const initial = device.initialState(c);
    const first = device.step(c,initial,action);
    row.execution = first !== null;
    row.physique = first?.feedback ?? 'Action indisponible.';
    const intended = action===c.action;
    row.livre = intended ? (c.substitution ?? row.physique) : row.physique;
    if (first && !first.next) {
      final={retour:row.livre};
      row.issue=row.physique;
      return row;
    }
    row.suivant = await proc.reply({retour:row.livre});
    const next = classify(row.suivant);
    if (next==='arret') {
      row.interpretation='arrêt au retour';
      row.issue='arrêt';
      row.conforme=Boolean(c.negative && intended);
    } else if (next==='action') {
      row.interpretation='poursuite au retour';
      const second = device.step(c,first?.next ?? initial,row.suivant.action.trim().replace(/\s+/g,' '));
      row.issue=second?.feedback ?? 'Action indisponible.';
      if (second && !second.next) final={retour:second.feedback};
      row.conforme=Boolean(!c.negative && intended && row.suivant.action.trim()==='valider' && row.issue==='succès');
    } else { row.issue='réponse hors contrat'; }
    return row;
  } catch (error) {
    row.issue='erreur technique';
    row.detail=error.message;
    return row;
  } finally { await proc.close(final); }
}
