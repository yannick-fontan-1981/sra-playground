import { Agenda } from '../agenda.mjs';
import { digest } from './sceau.mjs';

// Ordre déclaré par landingModule. Les offres s'excluent par leurs gardes.
// La question posée ici est celle du workflow local, dans le fournisseur déjà appelé.
const rules = [['routeSupported', 'P07'], ['eligibleProbe', 'P05'], ['knownInteraction', 'P02']];
const offers = rules.map(([, strategy], index) => ({ id: strategy, strategy, group: 'qualification', entry: strategy,
  contributes: ['qualifier'], modeFacts: {}, guards: rules.slice(0, index + 1).map(([fact], i) => ({ fact, expected: i === index })) }));
const groups = [{ id: 'qualification', entries: offers.map(offer => offer.id) }];

export function predictLocal(sealed) {
  if (!sealed) return { decision: 'indéterminé', reason: 'pré-événement absent' };
  const { event, sha256 } = sealed;
  const allowed = ['invocation', 'observationRef', 'family', 'facts', 'evidence'];
  if (Object.keys(event).some(key => !allowed.includes(key)) ||
    Object.keys(event.facts ?? {}).some(key => !['mode', ...rules.map(([fact]) => fact)].includes(key))) {
    throw new Error('Champ hors contrat dans le pré-événement');
  }
  if (digest(event) !== sha256) throw new Error('Empreinte du pré-événement invalide');
  const { facts: source, evidence, observationRef, invocation, family } = event;
  const identity = { observationRef, invocation, family, sha256 };
  if (!['sic_verify_remote_replay', 'sic_learn_remote_replay'].includes(family) ||
    !Number.isSafeInteger(invocation) || invocation < 1) {
    return { ...identity, decision: 'indéterminé', reason: 'invocation du fournisseur non identifiée' };
  }
  if (!source || !observationRef || !Array.isArray(evidence) || !evidence.includes(observationRef)) {
    return { ...identity, decision: 'indéterminé', reason: 'références ou faits absents' };
  }
  const facts = {};
  for (const [name] of rules) {
    if (source[name] === undefined || source[name] === null) continue;
    if (typeof source[name] !== 'boolean') throw new Error('Fait non booléen : ' + name);
    facts[name] = { value: source[name], evidence };
  }
  if (!['assimilation', 'exploration', 'solving'].includes(source.mode)) {
    return { ...identity, decision: 'indéterminé', reason: 'mode non documenté' };
  }
  // Groupe unique sans préférence de mode. La réserve native ne décide pas
  // dans cette qualification locale et le workflow a déjà été atteint.
  const result = new Agenda().decide({ goal: 'qualification_locale', scope: observationRef, need: { target: 'qualifier' },
    mode: source.mode, remaining: Infinity, groups, offers, facts, observation: { ref: observationRef }, stops: [] });
  if (result.decision === 'selectionner') return { ...identity, decision: result.branch };
  if (result.decision === 'ouvrir_preuve') return { ...identity, decision: 'indéterminé', reason: 'garde absente : ' + result.proof };
  return { ...identity, decision: 'abstention', reason: 'toutes les gardes sont fausses' };
}
