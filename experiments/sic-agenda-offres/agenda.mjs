import { reasoningGroupOrder } from '../../src/sic/reasoning-mode.ts';

const unique = items => [...new Set(items)].sort();
const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
const slot = (group, entry) => JSON.stringify([group, entry]);

// Les reçus décrivent des arrêts déjà qualifiés par la source pour cette observation.
function sourceTraversal({ groups, mode, remaining, stops, observation }) {
  const ranking = reasoningGroupOrder(groups, mode, remaining);
  const order = ranking.order.map(i => groups[i]);
  const receipts = new Map();
  for (const stop of stops) {
    const group = groups.find(g => g.id === stop.group);
    const key = slot(stop.group, stop.entry);
    const groupStop = stop.stop_group !== undefined;
    if (!group?.entries.includes(stop.entry) || receipts.has(key) || !stop.ref || !stop.resumeWhen
      || stop.release_authority !== false || groupStop && (stop.stop_group !== stop.group || stop.source_entry !== stop.entry)
      || stop.observation_ref !== observation.ref || stop.frame_hash !== observation.frame
      || stop.level_epoch !== observation.epoch) throw new Error('Reçu de refus invalide ou périmé');
    const scope = stop.block_unrelated_probe === true ? 'traversal' : groupStop ? 'group' : 'entry';
    receipts.set(key, { ...stop, scope });
  }
  const slots = new Map(), reached = [];
  let traversalStop = null;
  for (const group of order) {
    let groupStop = null;
    for (const entry of group.entries) {
      const key = slot(group.id, entry);
      let barrier = traversalStop ?? groupStop;
      if (!barrier && receipts.has(key)) {
        barrier = receipts.get(key);
        reached.push(barrier);
        if (barrier.scope === 'group') groupStop = barrier;
        if (barrier.scope === 'traversal') traversalStop = barrier;
      }
      slots.set(key, barrier);
    }
  }
  return { slots, reached, traversalStop, order: order.map(g => g.id), card: ranking.card };
}

function checkGuard(facts, { fact, expected }) {
  const witness = facts[fact];
  if (!witness || witness.value === 'unknown') {
    return { fact, expected, observed: null, state: 'absente', evidence: [] };
  }
  if (typeof witness.value !== 'boolean' || !Array.isArray(witness.evidence) || !witness.evidence.length
    || !witness.evidence.every(ref => typeof ref === 'string' && ref.trim())) {
    throw new Error('Un fait connu exige une valeur booléenne et des références : ' + fact);
  }
  const state = expected === witness.value ? 'confirmee' : 'contraire';
  return { fact, expected, observed: witness.value, state, evidence: witness.evidence };
}

export function qualifyGuards(guards, facts) {
  const checks = guards.map(guard => checkGuard(facts, guard));
  const contrary = checks.filter(c => c.state === 'contraire');
  const absent = checks.filter(c => c.state === 'absente');
  const admission = contrary.length ? 'contredite' : absent.length ? 'indeterminee' : 'admissible';
  return { checks, contrary, absent, admission };
}

function assess(offer, turn, source) {
  const key = slot(offer.group, offer.entry);
  if (!source.slots.has(key)) throw new Error('Entrée source inconnue : ' + key);
  const { checks, contrary, absent, admission } = qualifyGuards(offer.guards, turn.facts);
  const hint = offer.modeFacts[turn.mode];
  const modeWitness = hint ? checkGuard(turn.facts, { fact: hint, expected: true }) : null;
  const barrier = source.slots.get(key);
  const contribution = offer.contributes.includes(turn.need.target) ? 'directe'
    : offer.contributes.includes(turn.need.fallback) ? 'repli' : 'aucune';
  const resumeWhen = barrier ? barrier.resumeWhen : [...contrary, ...absent].map(requirement).join(' et ');
  return { id: offer.id, strategy: offer.strategy, group: offer.group, entry: offer.entry, checks, admission,
    contribution, modeWitness, barrier: barrier?.ref ?? null, resumeWhen, reason: '', status: 'differee' };
}

function requirement(check) {
  return check.fact + '=' + check.expected + ' avec un témoin courant';
}

// Le besoin fournit son repli acceptable. Dans chaque classe, une offre prouvée
// passe avant une demande de preuve. Un refus de parcours atteint garde sa question.
function choose(rows, source) {
  for (const contribution of ['directe', 'repli']) {
    const relevant = rows.filter(r => !r.barrier && r.contribution === contribution);
    for (const admission of ['admissible', 'indeterminee']) {
      if (admission === 'indeterminee' && source.traversalStop) continue;
      const peers = relevant.filter(r => r.admission === admission);
      if (!peers.length) continue;
      const preferred = peers.filter(r => r.modeWitness?.state === 'confirmee');
      const finalists = preferred.length ? preferred : peers; // rows est déjà trié par id.
      const tie = peers.length === 1 ? null : {
        peers: peers.map(r => r.id), finalists: finalists.map(r => r.id),
        rule: finalists.length < peers.length ? 'usage étayé dans le mode courant' : 'égalité après le mode',
        evidence: unique(preferred.flatMap(r => r.modeWitness.evidence)),
        lastRule: finalists.length > 1 ? 'identifiant de branche croissant' : null,
      };
      return { winner: finalists[0], tie };
    }
  }
  return { winner: null, tie: null };
}

function explain(row, winner, tie, source) {
  if (row.barrier) return 'arrêt source ' + row.barrier + ', reprise si ' + row.resumeWhen;
  if (row.admission === 'contredite') {
    return 'prérequis contredit : ' + row.checks.filter(c => c.state === 'contraire')
      .map(c => c.fact + '=' + c.observed + ' (' + c.evidence.join(', ') + ')').join(', ');
  }
  if (row.contribution === 'aucune') return 'aucun résultat annoncé ne couvre le besoin ou son repli';
  if (!winner && source.traversalStop) return 'le refus de parcours atteint conserve la question en attente';
  if (!winner) return 'aucune offre justifiée';
  if (row.contribution !== winner.contribution) return 'repli différé pendant le traitement du besoin direct';
  if (row.admission !== winner.admission) return 'une offre de même contribution est déjà prouvée';
  if (tie && !tie.finalists.includes(row.id)) return 'égalité de contribution et d’admission, le mode favorise ' + tie.finalists.join(', ');
  if (tie?.lastRule && row !== winner) return 'égalité résiduelle, ' + tie.lastRule;
  return (row.contribution === 'directe' ? 'résultat demandé' : 'résultat de repli accepté')
    + (row.admission === 'admissible' ? ', prérequis confirmés' : ', preuve à obtenir');
}

export class Agenda {
  // Une instance suit un but dans une portée donnée. Une unique feuille peut prendre la main.
  #rootKey;
  #questions = new Map();

  decide(turn) {
    const rootKey = JSON.stringify([turn.scope, turn.goal]);
    if (this.#rootKey && this.#rootKey !== rootKey) throw new Error('Changer de but ou de portée exige un autre arbre');
    const source = sourceTraversal(turn);
    const rows = turn.offers.map(offer => assess(offer, turn, source)).sort(byId);
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error('Identifiants de branche dupliqués');
    this.#rootKey = rootKey;
    const { winner, tie } = choose(rows, source);
    const returns = [];
    for (const row of rows) {
      row.reason = explain(row, winner, tie, source);
      if (row.barrier || row.admission === 'contredite') row.status = 'suspendue';
      for (const check of row.checks) {
        const question = this.#questions.get(this.#key(row, check));
        if (!question) continue;
        if (question.state === 'en_attente' && check.state !== 'absente') {
          returns.push({ parent: turn.goal, branch: row.id, fact: check.fact, result: check.state, evidence: check.evidence });
        }
        if (question.state !== 'en_attente' && check.state === 'absente') question.requested = false;
        question.state = check.state === 'absente' ? 'en_attente' : check.state;
      }
    }

    let decision, branch, proof = null, active = null, reason, resumeWhen = null;
    let evidence = [];
    if (winner) {
      branch = winner.id;
      evidence = unique([...winner.checks.flatMap(c => c.evidence), ...(tie?.evidence ?? [])]);
      reason = winner.reason + (tie ? ', ' + [tie.rule, tie.lastRule].filter(Boolean).join(', ') : '');
      winner.reason = reason;
      if (winner.admission === 'admissible') {
        decision = 'selectionner';
        active = [turn.goal, branch];
        winner.status = 'active';
      } else {
        const check = winner.checks.find(c => c.state === 'absente');
        const key = this.#key(winner, check);
        proof = check.fact;
        resumeWhen = requirement(check);
        if (this.#questions.get(key)?.requested) {
          decision = 'suspendre';
          reason = 'demande déjà ouverte, attente de ' + resumeWhen;
          winner.status = 'suspendue';
        } else {
          decision = 'ouvrir_preuve';
          this.#questions.set(key, { branch, fact: proof, expected: check.expected, state: 'en_attente', requested: true });
          active = [turn.goal, branch, proof];
          winner.status = 'attend_preuve';
        }
        winner.reason = reason;
      }
    } else {
      decision = 'suspendre';
      const stop = source.traversalStop ?? source.reached.find(s => rows.some(r => r.barrier === s.ref));
      const culprit = rows.find(r => !r.barrier && r.contribution !== 'aucune' && r.admission === 'contredite');
      branch = stop ? stop.group + '/' + stop.entry : culprit?.id ?? turn.goal;
      reason = stop ? 'arrêt ' + stop.scope + ' du propriétaire ' + branch : culprit?.reason ?? 'aucune contribution au besoin';
      resumeWhen = stop?.resumeWhen ?? culprit?.resumeWhen ?? 'offre contribuant au besoin avec des prérequis prouvés';
      evidence = stop ? [stop.ref] : unique(culprit?.checks.filter(c => c.state === 'contraire').flatMap(c => c.evidence) ?? []);
    }
    // Une référence de refus ou de contradiction peut être décisive pour le repli.
    const excluded = rows.filter(r => r !== winner && r.contribution === 'directe');
    const exclusions = excluded.flatMap(r => r.barrier ? [r.barrier] : r.checks.filter(c => c.state === 'contraire').flatMap(c => c.evidence));
    const branches = rows.map(row => ({ ...row, questions: [...this.#questions.values()]
      .filter(q => q.branch === row.id).map(({ fact, expected, state }) => ({ fact, expected, state })) }));
    return { goal: turn.goal, scope: turn.scope, observation: turn.observation.ref, need: turn.need, mode: turn.mode,
      decision, branch, proof, reason, resumeWhen, evidence: unique([...evidence, ...exclusions]), tie, returns,
      source: { order: source.order, card: source.card, stops: source.reached.map(s => s.ref) },
      tree: { root: turn.goal, budget: 1, activePath: active, branches } };
  }

  #key(row, check) {
    return JSON.stringify([row.id, check.fact, check.expected]);
  }
}
