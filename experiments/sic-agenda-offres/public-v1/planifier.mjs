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
const stateKey = ({ facts, uses, possible }) => key([[...facts].sort(), [...uses].sort(), [...(possible ?? [])].sort()]);

function conditionalBudget() {
  return { cache: new Map(), examined: 0, bounded: 0 };
}

// Une table publique complète : un sélecteur inconnu, une cible matérielle,
// des égalités distinctes. Aucun numéro de situation n'entre dans les faits.
function conditionalWrite(model, state, id, rules, budget) {
  const cacheKey = key([id, stateKey(state)]);
  if (budget.cache.has(cacheKey)) return budget.cache.get(cacheKey);
  const rows = new Map();
  let driver, target;
  for (const rule of rules) {
    const test = rule.when?.eq, write = rule.effect.set;
    if (!test || !write || test[1]?.ref) return null;
    const input = key(test[0]), output = key(write[0]);
    if (driver !== undefined && (input !== driver || output !== target)) return null;
    if (rows.has(test[1]) && rows.get(test[1]) !== write[1]) return null;
    driver = input; target = output;
    rows.set(test[1], write[1]);
  }
  const inputDomain = model.domains.get(driver), outputDomain = model.domains.get(target);
  if (!inputDomain || !stable(inputDomain, state.facts) || !outputDomain) return null;
  const inputs = state.possible?.get(driver) ?? inputDomain.values;
  if (inputs.length > 8 || budget.examined + inputs.length > 64) {
    budget.bounded++;
    return null;
  }
  budget.examined += inputs.length;
  let assignment = null;
  if (inputs.every(v => rows.has(v) && outputDomain.values.includes(rows.get(v)))) {
    const values = new Set(inputs.map(v => rows.get(v)));
    assignment = { target, values: outputDomain.values.filter(v => values.has(v)) };
  }
  budget.cache.set(cacheKey, assignment);
  return assignment;
}

export function project(model, state, id, budget = conditionalBudget()) {
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
  const conditional = [];
  for (const rule of rules.filter(r => r.effect)) {
    const applies = rule.when ? truth(rule.when, state.facts) : true;
    if (applies === undefined) {
      if (!rule.effect.set || id === key(model.goal.command)) return stop('effet conditionnel indéterminé');
      conditional.push(rule);
      continue;
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
  const facts = new Map(state.facts), uses = new Map(state.uses), possible = new Map(state.possible);
  for (const [ref, domain] of model.domains) {
    if (!stable(domain, state.facts) && !keeps.has(ref)) {
      facts.delete(ref);
      possible.delete(ref);
    }
  }
  for (const [ref, value] of sets) { facts.set(ref, value); possible.delete(ref); }
  if (conditional.length) {
    if (ends.size || reveals.size) return stop('effet conditionnel associé à une terminaison ou à une lecture');
    const assignment = conditionalWrite(model, state, id, conditional, budget);
    if (!assignment) return stop('effet conditionnel indéterminé');
    const { target, values } = assignment;
    if (sets.has(target) && values.some(v => sets.get(target) !== v)) return stop('effets simultanés incompatibles');
    if (keeps.has(target) && values.some(v => state.facts.get(target) !== v)) return stop('conservation incompatible avec une issue');
    if (values.length === 1) {
      facts.set(target, values[0]);
      possible.delete(target);
    } else {
      facts.delete(target);
      possible.set(target, values);
      if (possible.size > 1) return stop('plusieurs effets non observés');
    }
  }
  if (rules.some(r => r.maxUses)) uses.set(id, (uses.get(id) ?? 0) + 1);
  if ((model.goal.maintain ?? []).some(expr => truth(expr, facts) !== true)) return stop('invariant non établi');
  if (ends.size) {
    if (id !== key(model.goal.command)) return stop('autre terminaison');
    return { end: [...ends][0] };
  }
  if (id === key(model.goal.command)) return stop('issue de la commande terminale non décrite');
  let next = [{ facts, uses, possible, revealed: [] }];
  for (const ref of reveals) {
    const domain = model.domains.get(ref);
    if (!domain || !stable(domain, facts)) return stop('domaine ou stabilité de lecture inconnus');
    const values = facts.has(ref) ? [facts.get(ref)] : possible.get(ref) ?? domain.values;
    next = next.flatMap(branch => values.map(value => ({
      facts: new Map(branch.facts).set(ref, value), uses,
      possible: new Map([...branch.possible].filter(([k]) => k !== ref)),
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
  const budget = conditionalBudget();
  let acceptAttempt = false;
  const transitions = new Map(ids.map(id => [id, project(model, state, id, budget)]));
  function reachable(s, depth) {
    if (!depth) return false;
    const cacheKey = key([stateKey(s), depth]);
    if (!memo.has(cacheKey)) memo.set(cacheKey, ids.some(id => canFinish(project(model, s, id, budget), depth)));
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
    conditionalEffects: { examined: budget.examined, bounded: budget.bounded },
    candidates: ids.map(id => ({ command: model.commands.get(id).command, reason: transitions.get(id).reason ??
      (costs.has(id) ? 'continuation minimale' : 'aucune continuation aussi courte établie') })) };
}
