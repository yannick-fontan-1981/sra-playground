import assert from 'node:assert/strict';

export const budget = Object.freeze({ commands: 12, states: 12_000 });
export const signal = node => ({ view: node.view, outcome: node.outcome ?? null });
export const signalKey = publicSignal => JSON.stringify([publicSignal.view, publicSignal.outcome]);

export function validate(domain) {
  assert.equal(domain.objective, 'win');
  assert.deepEqual(domain.budget, budget);
  if (domain.scope !== undefined) assert.equal(typeof domain.scope, 'string');
  assert.ok(Array.isArray(domain.actions) && domain.actions.length > 0);
  assert.equal(new Set(domain.actions).size, domain.actions.length);
  assert.ok(domain.actions.every(action => typeof action === 'string' && action.length));
  assert.ok(Array.isArray(domain.worlds) && domain.worlds.length > 0);
  for (const world of domain.worlds) {
    assert.ok(Object.hasOwn(world.nodes, world.start));
    assert.equal(world.nodes[world.start].outcome, undefined);
    assert.equal(world.nodes[world.start].view, domain.worlds[0].nodes[domain.worlds[0].start].view);
    for (const command of Object.values(world.roles ?? {})) assert.ok(domain.actions.includes(command));
    for (const node of Object.values(world.nodes)) {
      assert.equal(typeof node.view, 'string');
      if (node.outcome !== undefined) {
        assert.ok(['win', 'loss'].includes(node.outcome));
        assert.ok(!node.next || Object.keys(node.next).length === 0);
      } else {
        assert.deepEqual(Object.keys(node.next).sort(), [...domain.actions].sort());
        assert.ok(Object.values(node.next).every(id => Object.hasOwn(world.nodes, id)));
      }
    }
  }
}

export function publicModel(domain) {
  const initial = domain.worlds.map((world, index) => [index, world.start]);
  const node = ([index, id]) => domain.worlds[index].nodes[id];
  const distances = domain.worlds.map(world => {
    const reverse = new Map(Object.keys(world.nodes).map(id => [id, []]));
    const queue = Object.keys(world.nodes).filter(id => world.nodes[id].outcome === 'win');
    const distance = new Map(queue.map(id => [id, 0]));
    for (const [id, state] of Object.entries(world.nodes)) {
      for (const next of new Set(Object.values(state.next ?? {}))) reverse.get(next).push(id);
    }
    for (let index = 0; index < queue.length; index++) {
      for (const previous of reverse.get(queue[index])) {
        if (distance.has(previous)) continue;
        distance.set(previous, distance.get(queue[index]) + 1);
        queue.push(previous);
      }
    }
    return distance;
  });
  const won = states => states.every(state => node(state).outcome === 'win');
  const lost = states => states.some(state => node(state).outcome === 'loss');
  const distance = states => Math.max(...states.map(([index, id]) => distances[index].get(id) ?? Infinity));

  // A common open-loop suffix treats already won branches as finished.
  const advance = (states, action) => states.map(([index, id]) =>
    [index, node([index, id]).next?.[action] ?? id]);
  function partition(states) {
    const branches = new Map();
    for (const state of states) {
      const key = signalKey(signal(node(state)));
      const branch = branches.get(key) ?? [];
      branch.push(state);
      branches.set(key, branch);
    }
    return branches;
  }
  return { initial, won, lost, distance, advance, partition, key: JSON.stringify };
}

export function knownRole(domain, states, role) {
  const commands = new Set(states.map(([index]) => {
    const roles = domain.worlds[index].roles ?? {};
    return Object.hasOwn(roles, role) ? roles[role] : undefined;
  }));
  if (commands.size === 1) return commands.values().next().value;
}
