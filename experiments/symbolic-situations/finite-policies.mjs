// Exhaust all successful finite traces, then combine only observation-compatible choices.
import assert from 'node:assert/strict';

function winningTraces(world, { actions, initialState, step }) {
  const available = actions(world);
  const wins = [];
  function visit(state, trace) {
    for (const action of available) {
      const result = step(world, state, action);
      if (!result) continue;
      const path = [...trace, [action, result.feedback]];
      if (result.next) visit(result.next, path);
      else if (result.feedback === 'succès') wins.push(path);
    }
  }
  visit(initialState(world), []);
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

export function enumerateFinite(worlds, dynamics) {
  assert.ok(worlds.length > 0, 'aucun monde compatible');
  const traces = worlds.map(world => winningTraces(world, dynamics));
  let candidates = [[]];
  for (const options of traces) {
    candidates = candidates.flatMap(previous => options
      .filter(trace => previous.every(other => compatible(other, trace)))
      .map(trace => [...previous, trace]));
  }
  const strip = trace => trace.map(([action]) => action);
  const policies = candidates.map(tuple => Object.fromEntries(tuple.map((trace, i) => [dynamics.worldId(worlds[i]), strip(trace)])));
  const cost = policy => Math.max(...Object.values(policy).map(plan => plan.length));
  const minimum = Math.min(...policies.map(cost));
  return {
    worlds,
    perWorld: Object.fromEntries(traces.map((rows, i) => [dynamics.worldId(worlds[i]), rows.map(strip)])),
    policies, optimal: policies.filter(policy => cost(policy) === minimum), minimum,
  };
}
