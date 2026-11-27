// Independent finite-state evaluator. No generator, key, lineage or seed as input.
import { enumerateFinite } from './finite-policies.mjs';

export function completions(model) {
  const outputs = Object.keys(model.wiring).sort();
  return outputs.map(dial => ({
    dial, covered: model.seen === null, stamps: model.stamps, cells: model.cells, wiring: model.wiring,
  })).filter(world => (world.covered ? null : world.dial) === model.seen);
}

export function initialView(world) {
  return { stamps: world.stamps, cells: world.cells, wiring: world.wiring, seen: world.covered ? null : world.dial };
}

export const initialState = () => ({ marks: new Map(), read: false });

export function step(world, state, action) {
  const { marks, read } = state;
  if (action === 'valider') {
    const won = world.cells.every(cell => marks.get(cell) === world.wiring[world.dial]);
    return { feedback: won ? 'succès' : 'échec', next: null };
  }
  if (action === 'lire' && !read) return { feedback: world.dial, next: { marks, read: true } };
  const [verb, cell, stamp, extra] = action.split(' ');
  if (verb !== 'marquer' || extra !== undefined || !world.cells.includes(cell) || !world.stamps.includes(stamp)) return null;
  if (marks.has(cell) || (marks.size && ![...marks.values()].includes(stamp))) return null;
  return { feedback: 'marqué', next: { read, marks: new Map(marks).set(cell, stamp) } };
}

export function enumerate(model) {
  return enumerateFinite(completions(model), {
    worldId: world => world.dial,
    actions: world => ['valider', 'lire', ...world.cells.flatMap(cell =>
      world.stamps.map(stamp => 'marquer ' + cell + ' ' + stamp))],
    initialState, step,
  });
}
