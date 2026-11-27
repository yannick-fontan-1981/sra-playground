// Seconde passe uniquement. Aucun import de ce lecteur dans le prédicteur.
const sameSelection = (a, b) => a.family === b.family && a.strategy === b.strategy;

export async function readReceipt(records, target) {
  let plan;
  for await (const { game, level, turn, kind, value } of records) {
    if (game !== target.game || level !== target.level || turn !== target.turn) continue;
    if (kind === 'native' && value.kind === 'sic_native_plan') plan = { family: value.family, strategy: value.strategy, id: value.id };
    if (kind !== 'decision') continue;
    const { agenda, ticket, proposal } = value;
    if (!plan || typeof plan.family !== 'string' || typeof plan.strategy !== 'string' || ticket?.actionIndex !== 0
      || plan.id !== 'sic-plan:' + agenda?.observationRef || ticket.observationRef !== agenda?.observationRef
      || proposal?.kind !== plan.family || proposal?.sicLocalDecision?.strategy !== plan.strategy) return null;
    const reasoning = agenda.reasoning;
    if (!reasoning || reasoning.observationRef !== agenda.observationRef) return null;
    const facts = proposal.sicSrcDecision?.situation;
    const localGuards = facts ? { routeSupported: facts.routeSupported, eligibleProbe: facts.eligibleProbe,
      knownInteraction: facts.knownInteraction } : null;
    return { selection: { family: plan.family, strategy: plan.strategy }, group: agenda.selected,
      observationRef: agenda.observationRef, mode: reasoning.mode, card: reasoning.card, remaining: reasoning.remainingActions, localGuards };
  }
  return null;
}

export function compare(prediction, receipt) {
  if (!prediction.context) return { verdict: 'indéterminé', cause: prediction.reason, contexte: null };
  if (!receipt || prediction.context?.observationRef !== receipt.observationRef) {
    return { verdict: 'indéterminé', cause: 'Coupe et reçu du premier geste non appariés.', contexte: null };
  }
  const contexte = Object.fromEntries(['mode', 'card', 'remaining'].map(key => [key, prediction.context[key] == null
    ? 'indéterminé' : prediction.context[key] === receipt[key] ? 'accord' : 'écart']));
  if (prediction.status === 'indéterminé') return { verdict: 'indéterminé', cause: prediction.reason, contexte };
  const agrees = prediction.selection && sameSelection(prediction.selection, receipt.selection);
  return { verdict: agrees ? 'accord' : 'écart', cause: agrees ? 'Même famille et même stratégie.'
    : 'Décision hors ligne distincte de la sélection native.', contexte };
}
