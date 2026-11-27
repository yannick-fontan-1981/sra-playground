import { compareAvailableControlsId } from '../../src/sic/compare-available-controls.ts';
import { recheckDirectionalControlsId } from '../../src/sic/recheck-directional-controls.ts';

// Petite projection manuelle d'un seul groupe du pack SIC strict, dans son ordre source.
export const group = 'explore_available_inputs';
export const compareEntry = compareAvailableControlsId;
export const accessEntry = recheckDirectionalControlsId;
export const groups = [{ id: group, entries: [compareEntry, accessEntry] }];
const yes = fact => ({ fact, expected: true });
export const fact = (value, ...evidence) => ({ value, evidence });

export const comparison = {
  id: 'comparaison', strategy: 'compare_alternative', group, entry: compareEntry,
  guards: [yes('deuxDirections'), yes('autreCommandeAdmise'), { fact: 'comparaisonClose', expected: false }, yes('retourDiagonalUnique')],
  contributes: ['contraste_des_effets', 'retour_informatif'],
  modeFacts: { assimilation: 'effetAnterieurAReexaminer', exploration: 'alternativeNonMesuree' },
};
export const access = {
  id: 'acces', strategy: 'P07', group, entry: accessEntry,
  guards: [yes('deuxDirections'), yes('budgetDeReexamen'), yes('routeVersEssai')],
  contributes: ['acces_a_un_essai', 'retour_informatif'],
  modeFacts: { solving: 'planDependDeCetAcces' },
};
export const needs = {
  compare: { target: 'contraste_des_effets', fallback: 'retour_informatif' },
  reach: { target: 'acces_a_un_essai', fallback: 'retour_informatif' },
  learn: { target: 'retour_informatif' },
};

export const scene = {
  goal: 'G_official_completion', scope: 'salle-A/epoch-1', observation: { ref: 'obs-8', epoch: 1, frame: 'image-8' },
  need: needs.compare, mode: 'exploration', remaining: 6, groups, offers: [comparison, access], stops: [],
  facts: {
    deuxDirections: fact(true, 'obs-8'), autreCommandeAdmise: fact(true, 'entrees-8'),
    comparaisonClose: fact(false, 'memoire-comparaison-8'),
    // Retour immédiatement précédent, même époque et référence courante, une seule
    // translation de deux composantes non nulles attribuée à l’une des deux commandes.
    retourDiagonalUnique: fact(true, 'mouvement-7-8'),
    budgetDeReexamen: fact(true, 'budget-8'), routeVersEssai: fact(true, 'transition-3-4'),
    // Motifs propres au prototype. Chaque témoin porte sur l'usage de l'offre dans ce mode.
    effetAnterieurAReexaminer: fact(true, 'obligation-relecture-8'),
    alternativeNonMesuree: fact(true, 'registre-alternative-8'),
    planDependDeCetAcces: fact(true, 'dependance-acces-8'),
  },
};

export function withoutFact(turn, name) {
  const facts = { ...turn.facts };
  delete facts[name];
  return { ...turn, facts };
}

// Le lieu d'injection est expérimental. Les propriétaires des deux offres
// ci-dessus ne sont pas déclarés producteurs natifs de ces refus.
export function refusal(scope, entry = compareEntry, ownerGroup = group) {
  return { group: ownerGroup, entry, ref: 'refus-' + scope,
    ...(scope === 'traversal' ? { block_unrelated_probe: true } : {}),
    ...(scope === 'group' ? { stop_group: ownerGroup, source_entry: entry } : {}),
    observation_ref: scene.observation.ref, level_epoch: scene.observation.epoch, frame_hash: scene.observation.frame,
    release_authority: false, resumeWhen: 'le propriétaire atteste la levée du refus sur le prochain relevé du mouvement' };
}
