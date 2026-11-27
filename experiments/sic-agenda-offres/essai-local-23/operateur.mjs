import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { loadService } from './service.mjs';
import { openFixture, response } from './fiche.mjs';

import { frozen, root, withPinnedEngine } from './moteur.mjs';

const { values } = parseArgs({ options: { fiche: { type: 'string' }, ordre: { type: 'string' }, moteur: { type: 'string', default: 'candidat' } } });
if (!values.fiche) throw Error('Préciser --fiche et le chemin du JSON public.');
if (values.ordre && !['least_tried', 'command_order'].includes(values.ordre)) throw Error('Ordre natif inconnu.');
const card = JSON.parse(await readFile(values.fiche, 'utf8'));
async function dialog(engine) {
  const { session, history, decision } = await openFixture(await loadService(engine), card, values.ordre);
  const emit = message => console.log(JSON.stringify(message));
  emit({ historique: history, decision });
  if (decision.ticket) {
    for await (const line of createInterface({ input: process.stdin })) {
      try {
        const { ticket, after } = response(JSON.parse(line));
        const acquisition = await session.advance(ticket, after);
        const prochaine = await session.decision();
        emit({ acquisition, decision: prochaine });
        if (!prochaine.ticket) break;
      } catch (error) {
        if (error.code !== 'stale') throw error;
        emit({ erreur: 'ticket_perime' });
      }
    }
  }
}
if (values.moteur === 'candidat') await dialog(root.href);
else if (values.moteur === 'gel') await withPinnedEngine(frozen, dialog);
else throw Error('Choisir --moteur candidat ou gel.');
