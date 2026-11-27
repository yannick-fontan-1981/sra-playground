import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCard } from '../cards.mjs';
import { initialState, step, worlds } from '../world.mjs';
import { agenda, bundle, fingerprints, launch } from './solveur.mjs';

export async function episode(files, card, world, dynamics = { initialState, step }, program) {
  const solver = launch(files, program);
  const turns = [];
  let first = null, last;
  let input = { fiche: card };
  let state = dynamics.initialState(world);
  function result(status, stage, reason) {
    if (stage) first ??= { tour: turns.length, etape: stage, detail: reason };
    return { statut: status, premierEcart: first, tours: turns };
  }
  try {
    for (let i = 0; i < 32; i++) {
      const answer = await solver.reply(input);
      if (!answer || typeof answer !== 'object' || Object.keys(answer).length !== 1)
        return result('erreur_solveur', 'message', 'Une seule réponse est attendue');
      if (i === 0 && typeof answer.incompatible === 'string')
        return result('format_incompatible', 'lecture_fiche', answer.incompatible);
      if (typeof answer.arret === 'string') return result('arret_solveur', 'decision', answer.arret);
      if (typeof answer.action !== 'string' || !answer.action.trim() || /[\r\n]/.test(answer.action))
        return result('erreur_solveur', 'message', 'Commande absente ou multiligne');
      const action = answer.action.trim().replace(/\s+/g, ' ');
      const moved = dynamics.step(world, state, action);
      const feedback = moved?.feedback ?? 'Action indisponible.';
      turns.push({ action, retour: feedback, executee: Boolean(moved) });
      input = { retour: feedback };
      if (!moved) {
        first ??= { tour: turns.length, etape: 'commande_refusee', detail: action };
        continue;
      }
      if (!moved.next) {
        last = input;
        return feedback === 'succès' ? result('succes') : result('echec_action', 'action_terminale', feedback);
      }
      state = moved.next;
    }
    return result('limite_operateur', 'limite', '32 commandes proposées');
  } catch (error) {
    return result('erreur_solveur', 'transport', error.message);
  } finally {
    await solver.close(last);
  }
}

export function publicSchedule(lot) {
  const folder = join(lot, 'public');
  const cards = readdirSync(folder).map(name => {
    const text = readFileSync(join(folder, name), 'utf8').replaceAll('\r\n', '\n');
    // The published operator removes the final newline before calling PartiePublique.
    return { name, card: text.trimEnd(), model: parseCard(text) };
  });
  const codeOrder = m => m.current === null ? (m.purged ? 2 : 3) : [m.drop, m.jam].sort().indexOf(m.current);
  cards.sort((a, b) => codeOrder(a.model) - codeOrder(b.model));
  if (cards.map(c => codeOrder(c.model)).join() !== '0,1,2,3') throw new Error('Les quatre départs publics prévus sont nécessaires');
  return cards;
}

export async function qualify(lot, files) {
  const runs = [];
  for (const { name, card, model } of publicSchedule(lot)) {
    const inputHash = createHash('sha256').update(card).digest('hex');
    for (const [i, world] of worlds(model).entries()) {
      runs.push({ fiche: name, mondeOperateur: i + 1, sha256Entree: inputHash, ...await episode(files, card, world) });
    }
  }
  const totals = { departs: runs.length, formatsIncompatibles: 0, succes: 0, echecsAction: 0,
    autresArrets: 0, commandesProposees: 0, commandesExecutees: 0, commandesRefusees: 0 };
  for (const r of runs) {
    if (r.statut === 'format_incompatible') totals.formatsIncompatibles++;
    else if (r.statut === 'succes') totals.succes++;
    else if (r.statut === 'echec_action') totals.echecsAction++;
    else totals.autresArrets++;
    totals.commandesProposees += r.tours.length;
    totals.commandesExecutees += r.tours.filter(t => t.executee).length;
    totals.commandesRefusees += r.tours.filter(t => !t.executee).length;
  }
  return { totaux: totals, departs: runs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { lot: { type: 'string' }, solveur: { type: 'string' }, rapport: { type: 'string' } } });
  const root = dirname(fileURLToPath(import.meta.url));
  const lot = resolve(values.lot ?? join(root, '../generated/reserve'));
  const files = bundle(values.solveur);
  const report = { agenda: values.solveur ? null : agenda, runtime: process.version,
    empreintesSolveur: fingerprints(files), ...await qualify(lot, files) };
  if (values.rapport) writeFileSync(values.rapport, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(values.rapport ? report.totaux : report, null, 2));
}
