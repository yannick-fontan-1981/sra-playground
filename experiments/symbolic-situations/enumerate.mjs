// Independent finite-state evaluator. No generator, key, lineage or seed as input.
import assert from 'node:assert/strict';

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

function winningTraces(world) {
  const actions = ['valider', 'lire', ...world.cells.flatMap(cell =>
    world.stamps.map(stamp => 'marquer ' + cell + ' ' + stamp))];
  const wins = [];
  function visit(state, trace) {
    for (const action of actions) {
      const result = step(world, state, action);
      if (!result) continue;
      const path = [...trace, [action, result.feedback]];
      if (result.next) visit(result.next, path);
      else if (result.feedback === 'succès') wins.push(path);
    }
  }
  visit(initialState(), []);
  return wins;
}

// A decision can differ only after the agent has received different observations.
function compatible(left, right) {
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i][0] !== right[i][0]) return false;
    if (left[i][1] !== right[i][1]) return true;
  }
  return left.length === right.length;
}

export function enumerate(model) {
  const worlds = completions(model);
  assert.ok(worlds.length > 0, 'aucun monde compatible');
  const traces = worlds.map(world => winningTraces(world));
  let candidates = [[]];
  for (const options of traces) {
    candidates = candidates.flatMap(previous => options
      .filter(trace => previous.every(other => compatible(other, trace)))
      .map(trace => [...previous, trace]));
  }
  const strip = trace => trace.map(([action]) => action);
  const policies = candidates.map(tuple => Object.fromEntries(tuple.map((trace, i) => [worlds[i].dial, strip(trace)])));
  const cost = policy => Math.max(...Object.values(policy).map(plan => plan.length));
  const minimum = Math.min(...policies.map(cost));
  return {
    worlds,
    perWorld: Object.fromEntries(traces.map((rows, i) => [worlds[i].dial, rows.map(strip)])),
    policies, optimal: policies.filter(policy => cost(policy) === minimum), minimum,
  };
}
