import { Agenda } from '../agenda.mjs';
import { key } from './admission.mjs';

export function initialState(model) {
  const facts = new Map();
  for (const [ref, obs] of model.observations) if (obs.status === 'known') facts.set(ref, obs.value);
  return { facts, uses: new Map() };
}

// undefined représente l'inconnu. null et false sont deux valeurs observables distinctes.
export function truth(expr, facts) {
  if (expr.eq) {
    const [left, right] = expr.eq;
    const a = facts.get(key(left));
    const b = right?.ref ? facts.get(key(right.ref)) : right;
    return a === undefined || b === undefined ? undefined : a === b;
  }
  if (expr.not) {
    const result = truth(expr.not, facts);
    return result === undefined ? undefined : !result;
  }
  const all = !!expr.all;
  const values = (expr.all ?? expr.any).map(term => truth(term, facts));
  if (values.includes(!all)) return !all;
  return values.includes(undefined) ? undefined : all;
}

const stable = (domain, facts) => domain.stableWhen === true ||
  (!!domain.stableWhen && truth(domain.stableWhen, facts) === true);
const stateKey = ({ facts, uses }) => key([[...facts].sort(), [...uses].sort()]);

const maxValuesPerProof = 8;
const maxTrialsPerDecision = 64;

function proofSearch() {
  return { cache: new Map(), metrics: { trials: 0, proved: 0, incomplete: 0, bounded: 0, cacheHits: 0 } };
}

function unknownRefs(expr, facts, refs) {
  if (expr.eq) {
    const [left, right] = expr.eq;
    for (const ref of right?.ref ? [left, right.ref] : [left]) {
      const id = key(ref);
      if (!facts.has(id)) refs.add(id);
    }
  } else {
    for (const term of expr.all ?? expr.any ?? [expr.not]) unknownRefs(term, facts, refs);
  }
}

// Une seule inconnue finie. Chaque hypothèse doit faire réussir la projection
// terminale entière, y compris ses autres effets, conditions et invariants.
function commonTerminal(model, state, id, rules, search) {
  const stateId = stateKey(state);
  if (search.cache.has(stateId)) {
    search.metrics.cacheHits++;
    return search.cache.get(stateId);
  }
  const refs = new Set();
  for (const rule of rules) {
    if (rule.when && truth(rule.when, state.facts) === undefined) unknownRefs(rule.when, state.facts, refs);
  }
  const [ref] = refs;
  const domain = refs.size === 1 && model.domains.get(ref);
  const unproved = cause => ({ reason: 'effet conditionnel indéterminé', proof: { kind: 'unproved', cause } });
  let result;
  if (!domain || !stable(domain, state.facts)) {
    search.metrics.incomplete++;
    result = unproved('domaine unique et stable non établi');
  } else if (domain.values.length > maxValuesPerProof ||
    search.metrics.trials + domain.values.length > maxTrialsPerDecision) {
    search.metrics.bounded++;
    result = unproved('budget de vérification insuffisant pour le domaine entier');
  } else {
    const values = [];
    for (const value of domain.values) {
      const hypothetical = { facts: new Map(state.facts).set(ref, value), uses: state.uses };
      search.metrics.trials++;
      if (projectOnce(model, hypothetical, id).end !== 'success') break;
      values.push(value);
    }
    if (values.length === domain.values.length) {
      search.metrics.proved++;
      result = { end: 'success', proof: { kind: 'all-public-values', ref: domain.ref, values, source: domain.source } };
    } else {
      search.metrics.incomplete++;
      result = unproved('une valeur publique ne conduit pas au succès explicite');
    }
  }
  search.cache.set(stateId, result);
  return result;
}

export function project(model, state, id) {
  return projectOnce(model, state, id, proofSearch());
}

function projectOnce(model, state, id, search) {
  const rules = model.rules.get(id);
  const stop = reason => ({ reason });
  for (const rule of rules) {
    if (rule.maxUses && (state.uses.get(id) ?? 0) >= rule.maxUses) return stop('limite publique atteinte');
    if (!rule.requires && !rule.successRequires) continue;
    const success = !!rule.successRequires;
    const value = truth(rule.requires ?? rule.successRequires, state.facts);
    if (value !== true) return stop((success ? 'condition nécessaire au succès' : 'condition d’exécution') +
      (value === false ? ' contredite' : ' inconnue'));
  }
  const sets = new Map(), keeps = new Set(), reveals = new Set(), ends = new Set();
  for (const rule of rules.filter(r => r.effect)) {
    const applies = rule.when ? truth(rule.when, state.facts) : true;
    if (applies === undefined) {
      if (search && id === key(model.goal.command)) return commonTerminal(model, state, id, rules, search);
      return stop('effet conditionnel indéterminé');
    }
    if (!applies) continue;
    const effect = rule.effect;
    if (effect.end) ends.add(effect.end);
    if (effect.keep) keeps.add(key(effect.keep));
    if (effect.reveal) reveals.add(key(effect.reveal));
    if (effect.set) {
      const [ref, value] = effect.set, k = key(ref);
      if (sets.has(k) && sets.get(k) !== value) return stop('effets simultanés incompatibles');
      sets.set(k, value);
    }
  }
  if (ends.has('failure') || ends.size > 1) return stop('issue défavorable déclarée');
  const facts = new Map(state.facts), uses = new Map(state.uses);
  for (const [ref, domain] of model.domains) {
    if (!stable(domain, state.facts) && !keeps.has(ref)) facts.delete(ref);
  }
  for (const [ref, value] of sets) facts.set(ref, value);
  if (rules.some(r => r.maxUses)) uses.set(id, (uses.get(id) ?? 0) + 1);
  if ((model.goal.maintain ?? []).some(expr => truth(expr, facts) !== true)) return stop('invariant non établi');
  if (ends.size) {
    if (id !== key(model.goal.command)) return stop('autre terminaison');
    return { end: [...ends][0] };
  }
  if (id === key(model.goal.command)) return stop('issue de la commande terminale non décrite');
  let next = [{ facts, uses, revealed: [] }];
  for (const ref of reveals) {
    const domain = model.domains.get(ref);
    if (!domain || !stable(domain, facts)) return stop('domaine ou stabilité de lecture inconnus');
    const values = facts.has(ref) ? [facts.get(ref)] : domain.values;
    next = next.flatMap(branch => values.map(value => ({
      facts: new Map(branch.facts).set(ref, value), uses,
      revealed: [...branch.revealed, { ref: JSON.parse(ref), value }],
    })));
  }
  if (next.every(branch => stateKey(branch) === stateKey(state))) return stop('aucun progrès public');
  return { next };
}

// Recherche ET/OU bornée. Une lecture doit offrir une continuation pour chaque retour public.
export function decide(model, state, evidence = [], horizon = 10) {
  if (!Number.isSafeInteger(horizon) || horizon < 1) throw new Error('Horizon invalide');
  const costs = new Map(), memo = new Map(), ids = [...model.commands.keys()].sort();
  let acceptAttempt = false;
  const search = proofSearch();
  const transition = (s, id) => projectOnce(model, s, id, search);
  const transitions = new Map(ids.map(id => [id, transition(state, id)]));
  function reachable(s, depth) {
    if (!depth) return false;
    const cacheKey = key([stateKey(s), depth]);
    if (!memo.has(cacheKey)) memo.set(cacheKey, ids.some(id => canFinish(transition(s, id), depth)));
    return memo.get(cacheKey);
  }
  function canFinish(t, depth) {
    return t.end === 'success' || (acceptAttempt && t.end === 'unspecified') ||
      (!!t.next && t.next.every(s => reachable(s, depth - 1)));
  }
  for (const attempt of [false, true]) {
    acceptAttempt = attempt;
    memo.clear();
    for (let depth = 1; depth <= horizon; depth++) {
      for (const [id, t] of transitions) if (canFinish(t, depth)) costs.set(id, depth);
      if (costs.size) break;
    }
    if (costs.size) break;
  }
  const refs = [...model.lines.map(n => 'fiche:L' + n), ...evidence];
  const facts = {}, offers = [];
  for (const id of ids) {
    const guard = 'transition:' + id;
    const t = transitions.get(id);
    facts[guard] = { value: !t.reason, evidence: refs };
    offers.push({ id, group: 'commandes', entry: id, strategy: id, modeFacts: {}, guards: [{ fact: guard, expected: true }],
      contributes: costs.has(id) ? ['objectif_au_moindre_cout'] : [] });
  }
  const admissibleStart = (model.goal.maintain ?? []).every(expr => truth(expr, state.facts) === true);
  if (!admissibleStart) return { command: null, reason: 'invariant initial non établi' };
  const decision = new Agenda().decide({ goal: key(model.goal.command), scope: 'fiche', observation: { ref: evidence.at(-1) ?? 'fiche' },
    need: { target: 'objectif_au_moindre_cout' }, mode: 'solving', remaining: Infinity,
    groups: [{ id: 'commandes', entries: ids }], stops: [], offers, facts });
  const chosen = decision.decision === 'selectionner' ? decision.branch : null;
  return { command: chosen ? model.commands.get(chosen).command : null, cost: chosen ? costs.get(chosen) : null,
    qualification: !chosen ? 'indéterminé' : acceptAttempt ? 'tentative terminale sous conditions nécessaires' : 'succès décrit par les règles',
    reason: chosen ? decision.reason : 'aucune continuation justifiée dans l’horizon ' + horizon,
    finalists: [...costs.keys()].map(JSON.parse), tie: decision.tie, evidence: decision.evidence,
    commonProofs: search.metrics,
    candidates: ids.map(id => ({ command: model.commands.get(id).command, reason: transitions.get(id).reason ??
      (costs.has(id) ? 'continuation minimale' : 'aucune continuation aussi courte établie') })) };
}
