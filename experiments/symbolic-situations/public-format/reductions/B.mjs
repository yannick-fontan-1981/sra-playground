import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { measure } from '../operator/measure.mjs';
import { frozen } from './consumer.mjs';

export const message = JSON.parse(readFileSync(new URL('./B.json', import.meta.url)));
export function receiptCase(card = message, station = 'P', ack = 'indexé') {
  const index = 'indexer ' + station;
  const dynamics = {
    worldId: () => 'unique',
    actions: () => [index, 'valider'],
    initialState: () => ({ indexed: false }),
    step(_world, state, action) {
      if (action === index && !state.indexed) return { next: { indexed: true }, feedback: ack };
      if (action === 'valider') return { next: null, feedback: state.indexed ? 'succès' : 'échec' };
      return null;
    },
  };
  return { id: 'B', family: 'accusé', message: card, worlds: [{}], dynamics };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const run = await measure([receiptCase()], frozen(process.argv[2], process.argv[3]));
  console.log(JSON.stringify(run.departs[0], null, 2));
}
