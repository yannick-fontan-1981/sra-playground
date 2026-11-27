import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseCard } from '../../cards.mjs';
import { completions, initialState, step } from '../../enumerate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const start = readFileSync(join(here, 'DEPART.md'), 'utf8').replaceAll('\r\n', '\n').trimEnd();
const card = readFileSync(join(here, '../../exemple/public/9fd1072013fd810d513c.md'), 'utf8');
const worlds = completions(parseCard(card));
const { values } = parseArgs({ options: { monde: { type: 'string' }, prefixe: { type: 'string' }, message: { type: 'boolean' } } });
const prefix = values.prefixe ? JSON.parse(readFileSync(values.prefixe, 'utf8')) : [];
if (!Array.isArray(prefix) || !prefix.every(t => t && Object.keys(t).sort().join() === 'action,retour' &&
  typeof t.action === 'string' && !/[\r\n]/.test(t.action) && typeof t.retour === 'string' && !/[\r\n]/.test(t.retour))) {
  throw new Error('Préfixe attendu : suite des couples publics action et retour');
}

function apply(world, state, action) {
  return step(world, state, action.trim().replace(/\s+/g, ' ')) ?? { next: state, feedback: 'Action indisponible.' };
}

const possible = [];
for (const [i, world] of worlds.entries()) {
  if (values.monde !== undefined && String(i + 1) !== values.monde) continue;
  let state = initialState();
  let matches = true;
  for (const t of prefix) {
    if (!state) { matches = false; break; }
    const result = apply(world, state, t.action);
    if (result.feedback !== t.retour) { matches = false; break; }
    state = result.next;
  }
  if (matches) possible.push({ world, state });
}
if (!possible.length) throw new Error('Le préfixe ne se reproduit pas dans le monde demandé ou le numéro est invalide');
if (possible.every(p => !p.state)) throw new Error('Le préfixe se termine déjà par un verdict');
if (values.message) {
  if (!prefix.length) console.log(start);
  else {
    const rules = start.slice(0, start.lastIndexOf('Joue ton premier coup.')).trimEnd();
    console.log(rules + '\n\nCes tours ont déjà été joués, dans cet ordre.\n\n' +
      prefix.map(t => 'Commande jouée : ' + t.action + '\nRetour reçu : ' + t.retour).join('\n\n') +
      '\n\nReprends après le dernier retour. Donne uniquement la prochaine commande.');
  }
} else {
  if (values.prefixe && possible.length > 1) throw new Error('Préfixe encore ambigu. Indiquer le numéro de monde initial côté opérateur.');
  let { world, state } = possible[randomInt(possible.length)];
  for await (const action of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const result = apply(world, state, action);
    console.log(result.feedback);
    if (!result.next) break;
    state = result.next;
  }
}
