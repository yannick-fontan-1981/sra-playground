import { readFileSync } from 'node:fs';
import { receiptCase } from './B.mjs';

// Concrete device. This transition function does not interpret the public rules.
export function dialCase(id, message, station = 'P', codes = ['R','S']) {
  const moving = id === 'A';
  const index = 'indexer ' + station;
  const marks = codes.map(code => 'marquer ' + station + ' ' + code);
  const dynamics = {
    worldId: world => world,
    actions: () => [...(moving ? [index] : []), 'lire', ...marks, 'valider'],
    initialState: world => ({ indexed: !moving, dial: moving ? codes[0] : world, read: false, mark: null }),
    step(world, state, action) {
      function update(patch, feedback) { return { next: { ...state, ...patch }, feedback }; }
      if (moving && action === index && !state.indexed)
        return update({ indexed: true, dial: world }, 'poste indexé');
      if (action === 'lire' && state.indexed && !state.read)
        return update({ read: true }, state.dial);
      if (state.indexed && state.mark === null && marks.includes(action))
        return update({ mark: codes[marks.indexOf(action)] }, 'marqué');
      if (action === 'valider')
        return { next: null, feedback: state.mark === state.dial ? 'succès' : 'échec' };
      return null;
    }
  };
  return { id, family: id === 'A' ? 'effet conditionnel' : 'choix irréversible', message, worlds: codes, dynamics };
}

export function publicCase(id) {
  if (id === 'B') return receiptCase();
  if (!['A','C'].includes(id)) throw new Error('Fiche A, B ou C attendue');
  const message = JSON.parse(readFileSync(new URL(id + '.json', import.meta.url)));
  return dialCase(id, message);
}
