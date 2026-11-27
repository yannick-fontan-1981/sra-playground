import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';

export async function play({ parseCard, completions, initialState, step }) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { monde: { type: 'string' } } });
  if (positionals.length !== 1) throw new Error('Usage : node play.mjs FICHE.md [--monde 1|2]');
  const card = readFileSync(positionals[0], 'utf8');
  const worlds = completions(parseCard(card));
  const index = values.monde === undefined ? randomInt(worlds.length) : Number(values.monde) - 1;
  if (!Number.isInteger(index) || !worlds[index]) throw new Error('Numéro de monde incompatible avec cette fiche');
  const world = worlds[index];
  console.log(card.trimEnd());
  let state = initialState(world);
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    const result = step(world, state, line.trim().replace(/\s+/g, ' '));
    if (!result) {
      console.log('Action indisponible.');
      continue;
    }
    console.log(result.feedback);
    if (!result.next) break;
    state = result.next;
  }
}
