import { enumerateFinite } from '../finite-policies.mjs';

export function worlds(m) {
  return [m.drop, m.jam].sort().filter(code => m.current === null || code === m.current)
    .map(code => ({ model: m, code }));
}

export function initialState({ model }) {
  return { purged: model.purged, held: true, locked: false, indexed: false, scanned: false };
}

function actions({ model: m }) {
  return ['purger ' + m.source, 'sonder ' + m.source, 'bloquer ' + m.source, 'retirer ' + m.source,
    ...(m.indexed ? ['indexer ' + m.receiver] : []), 'sceller ' + m.receiver];
}

export function step({ model: m, code }, state, action) {
  const { purged, held, locked, indexed, scanned } = state;
  const advance = (delta, feedback) => ({ next: { ...state, ...delta }, feedback });
  const terminal = feedback => ({ next: null, feedback });
  switch (action) {
    case 'purger ' + m.source:
      return !purged && held ? advance({ purged: true }, 'purge terminée') : null;
    case 'sonder ' + m.source:
      return purged && !scanned ? advance({ scanned: true }, code) : null;
    case 'bloquer ' + m.source:
      if (!purged || locked) return null;
      if (held && code === m.jam) return terminal('poignée coincée');
      return advance({ locked: true }, 'butée bloquée');
    case 'retirer ' + m.source:
      if (!held) return null;
      if (!purged || (!locked && code === m.drop)) return terminal('clapet fermé');
      return advance({ held: false }, 'poignée libérée');
    case 'indexer ' + m.receiver:
      return m.indexed && !held && !indexed ? advance({ indexed: true }, 'poste indexé') : null;
    case 'sceller ' + m.receiver:
      return terminal(purged && !held && locked && (!m.indexed || indexed) ? 'succès' : 'échec');
    default:
      return null;
  }
}

export function evaluate(model) {
  return enumerateFinite(worlds(model), { initialState, step, actions, worldId: w => w.code });
}
