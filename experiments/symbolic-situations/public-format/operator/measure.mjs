import { createHash } from 'node:crypto';
import { episode } from '../../ressource/qualification/operer.mjs';

function admission(run) {
  if (run.statut === 'format_incompatible') return 'incompatible';
  if (run.tours.length || run.statut === 'arret_solveur') return 'admise';
  return 'indeterminee';
}

function reads(message, { tours: turns, statut }) {
  const commands = new Map(message.rules.filter(r => r.effect?.reveal).map(r =>
    [r.command.join(' '), JSON.stringify(r.effect.reveal)]));
  const known = new Set(message.observations.filter(o => o.status === 'known').map(o => JSON.stringify(o.ref)));
  const domains = new Map(message.domains.map(d => [JSON.stringify(d.ref), d.values]));
  const result = { demandes: 0, retours: 0, nouvellesValeurs: 0, avecReponse: 0, suiviesDuneCommande: 0 };
  for (const [i, t] of turns.entries()) {
    const ref = commands.get(t.action);
    if (!ref) continue;
    result.demandes++;
    if (!t.executee) continue;
    if (!domains.get(ref)?.includes(t.retour)) throw new Error('Retour de lecture extérieur au domaine public');
    result.retours++;
    if (!known.has(ref)) result.nouvellesValeurs++;
    known.add(ref);
    if (i + 1 < turns.length) result.suiviesDuneCommande++;
    if (i + 1 < turns.length || statut === 'arret_solveur') result.avecReponse++;
  }
  return result;
}

// Compare public prefixes. Different decisions at equal histories may come from
// a nondeterministic consumer. Only an actual public feedback can distinguish worlds.
export function comparePair(a, b) {
  if (a.empreinteInitiale !== b.empreinteInitiale) throw new Error('Les entrées de la paire diffèrent');
  const common = Math.min(a.tours.length, b.tours.length);
  for (let i = 0; i < common; i++) {
    const x = a.tours[i], y = b.tours[i];
    if (x.action !== y.action) return { communs: i, fin: 'actions_differentes_a_vue_egale' };
    if (x.retour !== y.retour) return { communs: i, fin: 'premier_retour_distinct', action: x.action, tour: i + 1 };
  }
  return { communs: common, fin: 'aucun_retour_distinct_sur_prefixe_commun' };
}

export function summary(runs) {
  const count = predicate => runs.filter(predicate).length;
  const turns = runs.flatMap(r => r.tours);
  const sum = key => runs.reduce((n, r) => n + r.lectures[key], 0);
  return { departs: runs.length, admission: {
    admises: count(r => r.admission === 'admise'), incompatibles: count(r => r.admission === 'incompatible'),
    indeterminees: count(r => r.admission === 'indeterminee'),
  }, actions: { proposees: turns.length, executees: turns.filter(t => t.executee).length, refusees: turns.filter(t => !t.executee).length },
  lectures: { demandes: sum('demandes'), retours: sum('retours'), nouvellesValeurs: sum('nouvellesValeurs'),
    avecReponse: sum('avecReponse'), suiviesDuneCommande: sum('suiviesDuneCommande') },
  issues: { succes: count(r => r.statut === 'succes'), echecsTerminaux: count(r => r.statut === 'echec_action'),
    abandons: count(r => r.statut === 'arret_solveur'), incompatibles: count(r => r.statut === 'format_incompatible'),
    techniques: count(r => ['limite_operateur', 'erreur_solveur'].includes(r.statut)) } };
}

export async function measure(cases, solver) {
  const runs = [], pairs = [];
  for (const c of cases) {
    const group = [];
    const initial = JSON.stringify({ fiche: c.message }) + '\n';
    const hash = createHash('sha256').update(initial).digest('hex');
    for (const [i, world] of c.worlds.entries()) {
      const r = await episode(solver.files, c.message, world, c.dynamics, solver.program);
      group.push({ famille: c.family, fiche: c.id, mondeOperateur: i + 1, empreinteInitiale: hash,
        admission: admission(r), lectures: reads(c.message, r), ...r });
    }
    if (group.length === 2) pairs.push({ famille: c.family, fiche: c.id, ...comparePair(...group) });
    runs.push(...group);
  }
  const families = [...new Set(cases.map(c => c.family))];
  return { bilan: summary(runs), familles: Object.fromEntries(families.map(f => [f, summary(runs.filter(r => r.famille === f))])),
    paires: pairs, departs: runs };
}
