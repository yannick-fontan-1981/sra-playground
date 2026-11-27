import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { selectReasoningMode, reasoningGroupOrder } from '../../../src/sic/reasoning-mode.ts';
import { Agenda, qualifyGuards } from '../agenda.mjs';
import { standalonePlanningGroups } from '../../../src/sic/standalone-families.ts';
import { planningGroupsWithExperiments } from '../../../src/sic/experiment-selection-groups.ts';

export const targets = [11, 12].map(turn => ({ game: 'G50T', level: 4, turn }));
// Pack du banc « sic » sans préférence de couverture et sans retrait de famille.
const declared = planningGroupsWithExperiments(standalonePlanningGroups, false, false);
const groups = declared.map(g => ({ id: g.id, entries: g.families.map((family, i) =>
  JSON.stringify([family, g.entryPoints?.[i] ?? null])) }));
const budgetsFile = new URL('../../../docs/diagnostics/sic-107-4a546a13-20261126/expected-budgets.json', import.meta.url);
export async function loadCaps() {
  const { budgets } = JSON.parse(await readFile(budgetsFile, 'utf8'));
  return budgets.G50T.map(level => level.actions);
}

export async function* events(path) {
  const stream = createReadStream(path, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) if (line.trim()) yield JSON.parse(line);
  } finally {
    lines.close();
    stream.destroy();
  }
}

// Repartir de L1 pour compter les primitives. Ne transférer que les scalaires
// publics de T−1 et finir sur sa frontière, même si le fichier continue.
export async function cut(records, target, caps) {
  let seenLoad = false, observed = null, outcome = null, actions = 0, levelActions = 0;
  const missing = reason => ({ cut: false, reason, target });
  for await (const { game, level, turn, kind, value } of records) {
    if (game !== target.game) return missing('jeu inattendu');
    if (!seenLoad) {
      if (kind !== 'observation' || level !== 1 || turn !== 1 || value.level !== 1) return missing('début de campagne absent');
      seenLoad = true;
    }
    if (level > target.level || level === target.level && turn >= target.turn) break;
    const previous = level === target.level && turn === target.turn - 1;
    if (kind === 'boundary' && ['reset_level', 'undo_action'].includes(value.operation)) return missing('récupération dans le préfixe');
    if (kind === 'observation' && previous) {
      if (observed || value.level !== target.level) return missing('plateau précédent ambigu');
      observed = { level: value.level, levelsCompleted: value.levelsCompleted, state: value.state,
        availableActionIds: value.availableActionIds };
    }
    if (kind === 'native' && value.kind === 'actual_outcome') {
      actions++;
      if (level === target.level) levelActions++;
      if (previous) {
        if (!observed || outcome) return missing('retour précédent ambigu');
        outcome = { matched: value.matched, ref: value.observation_ref };
      }
    }
    if (!previous || kind !== 'boundary') continue;
    if (!observed || !outcome || typeof outcome.ref !== 'string' || !Number.isInteger(observed.levelsCompleted)
      || !Array.isArray(observed.availableActionIds) || !observed.availableActionIds.every(Number.isSafeInteger)
      || levelActions !== target.turn - 1 || value.operation !== 'advance' || value.phase !== 'sealed_prefix'
      || value.kind !== 'boundary') return missing('coupe avant planification non attestée');
    if (!outcome.ref.includes(`:epoch:${target.level}:revision:${actions + 1}:frame:`)) return missing('révision incompatible avec le compte des primitives');
    const remaining = Math.max(0, Math.min(caps[target.level - 1] - levelActions, caps.reduce((a, b) => a + b) - actions));
    return { cut: true, target, ...observed, observationRef: outcome.ref, matched: outcome.matched,
      actions, levelActions, targetLevels: caps.length, remaining };
  }
  return missing('frontière précédente absente');
}

function knownMode(projection) {
  const latestReturn = projection.matched === true ? 'matched' : projection.matched === false ? 'contradicted' : 'unknown';
  const modes = [true, false].map(acquiredInformation => selectReasoningMode({ ...projection,
    remainingActions: projection.remaining, latestReturn, acquiredInformation }).mode);
  return modes[0] === modes[1] ? modes[0] : null;
}

// Les mêmes gardes à trois valeurs servent dans l'agenda et lors de cette
// inspection partielle. Les noms de fournisseurs proviennent des cas autonomes.
function inspectFamilies(projection) {
  const keys = projection.availableActionIds.filter(key => key !== 7);
  const facts = { deuxDirectionsExactes: { value: keys.length === 2 && keys.every(k => k >= 1 && k <= 4),
    evidence: [projection.observationRef] } };
  const inspect = names => qualifyGuards(names.map(fact => ({ fact, expected: true })), facts);
  return {
    comparaison: inspect(['deuxDirectionsExactes', 'autreCommandeAdmise', 'comparaisonOuverte', 'retourDiagonalUnique']),
    acces: inspect(['directionsFiltreesAdmissibles', 'budgetDeReexamen', 'routeVersEssai']),
  };
}

// null = indisponible dans l'enregistreur. Un tableau vide ne signifie
// « aucun refus » ou « aucune offre » que si le producteur le certifie.
export function observeAgenda(turn) {
  const required = ['goal', 'need', 'scope', 'observation', 'mode', 'remaining', 'groups', 'offers', 'facts', 'stops'];
  const missing = required.filter(key => turn[key] == null);
  if (missing.length) return { status: 'indéterminé', selection: null, missing };
  const result = new Agenda().decide(turn);
  if (result.decision !== 'selectionner') return { status: result.decision, selection: null, branch: result.branch, missing: [] };
  const offer = turn.offers.find(o => o.id === result.branch);
  if (!offer.family) return { status: 'indéterminé', selection: null, missing: ['family'] };
  return { status: 'sélection', selection: { family: offer.family, strategy: offer.strategy }, missing: [] };
}

export function predict(projection) {
  if (!projection.cut) return { target: projection.target, status: 'indéterminé', selection: null, reason: projection.reason };
  const mode = knownMode(projection);
  const card = mode ? reasoningGroupOrder(groups, mode, projection.remaining).card : null;
  const observation = { ref: projection.observationRef, epoch: projection.level };
  const turn = { goal: 'G_official_completion', observation, scope: projection.observationRef.split(':revision:', 1)[0],
    mode, remaining: projection.remaining, facts: {}, need: null, offers: null, groups, stops: null };
  const partial = observeAgenda(turn);
  return { target: projection.target, ...partial, reason: 'Besoin courant, offres qualifiées et refus effectifs non consignés avant les fournisseurs.',
    context: { observationRef: projection.observationRef, levelActions: projection.levelActions, remaining: projection.remaining,
      availableActionIds: projection.availableActionIds, matched: projection.matched, mode, card, declaredGroups: groups.length },
    families: inspectFamilies(projection) };
}
