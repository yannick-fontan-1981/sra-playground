/**
 * P14 evaluation oracle. This module deliberately imports no environment,
 * generator, subject, SIC inference primitive, or candidate policy.
 *
 * It implements the transition contract a second time and synthesizes an
 * observation-branching policy over the finite set of hidden worlds. Existence
 * is certified for that declared uncertainty set; optimality is not claimed.
 */
import { createHash } from 'node:crypto';

const copy = value => JSON.parse(JSON.stringify(value));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const modulo = (value, period) => ((value % period) + period) % period;

function initialState(spec, worldIndex) {
  const definition = spec.worlds[worldIndex];
  if (!definition) throw new RangeError(`Missing evaluation world ${worldIndex}`);
  const parameters = copy(definition.channels);
  return {
    worldIndex,
    tick: 0,
    commands: 0,
    position: spec.public.initial,
    terminal: null,
    parameters,
    starts: Object.fromEntries(Object.entries(parameters).map(([id, channel]) => [id, channel.kind === 'clock' ? 0 : null])),
    holds: {},
    uses: Object.fromEntries(spec.public.actions.filter(action => action.uses !== undefined).map(action => [action.id, action.uses])),
  };
}

function cloneState(state) {
  return {
    ...state,
    parameters: { ...state.parameters },
    starts: { ...state.starts },
    holds: Object.fromEntries(Object.entries(state.holds).map(([id, hold]) => [id, { ...hold }])),
    uses: { ...state.uses },
  };
}

function ageAt(state, id, tick) {
  return state.starts[id] === null ? tick : tick - state.starts[id];
}

function truthAt(state, id, tick) {
  const hold = state.holds[id];
  if (hold && tick <= hold.until) return hold.value;
  const channel = state.parameters[id];
  if (!channel) throw new Error(`Unknown evaluation channel ${id}`);
  if (channel.kind === 'pulse') {
    if (state.starts[id] === null) return 0;
    const age = tick - state.starts[id];
    return Number(age >= channel.delay && age < channel.delay + channel.width);
  }
  const age = tick - state.starts[id];
  const prefix = channel.prefix ?? [];
  if (age < prefix.length) return prefix[age];
  return channel.cycle[modulo(age - prefix.length + (channel.phase ?? 0), channel.cycle.length)];
}

function permitted(spec, state, action) {
  if (!action || state.terminal) return false;
  if (state.commands >= spec.budget.actions || state.tick + action.duration > spec.budget.ticks) return false;
  if (state.uses[action.id] !== undefined && state.uses[action.id] <= 0) return false;
  if (action.from !== undefined && state.position !== action.from) return false;
  if (action.kind === 'trigger') {
    for (const id of action.targets ?? []) {
      const channel = state.parameters[id];
      if (!channel || channel.kind !== 'pulse') return false;
      const start = state.starts[id];
      if (start !== null && state.tick - start < channel.delay + channel.width) return false;
    }
  }
  return true;
}

function frameAt(spec, state, tick, inspect = false, intermediate = false) {
  const values = {};
  const reliable = {};
  for (const id of spec.public.channels) {
    const channel = state.parameters[id];
    const age = ageAt(state, id, tick);
    const mask = channel.mask;
    const noise = channel.noise;
    const concealed = !inspect && mask?.length > 0 && mask[modulo(age, mask.length)] === 0;
    const corrupted = !inspect && noise?.length > 0 && noise[modulo(age, noise.length)] === 1;
    values[id] = concealed ? null : truthAt(state, id, tick) ^ Number(corrupted);
    reliable[id] = !concealed && !corrupted;
  }
  return { ref: `t:${tick}:c:${state.commands}`, tick, values, reliable, intermediate };
}

function observationOf(spec, state, frames, receipt) {
  return {
    tick: state.tick,
    position: state.position,
    terminal: state.terminal,
    frames,
    receipt,
    enabled: spec.public.actions.filter(action => permitted(spec, state, action)).map(action => action.id),
    holds: Object.fromEntries(Object.entries(state.holds).filter(([, hold]) => hold.until >= state.tick).map(([id, hold]) => [id, { ...hold }])),
    uses: { ...state.uses },
  };
}

function begin(spec, worldIndex) {
  const state = initialState(spec, worldIndex);
  return { state, observation: observationOf(spec, state, [frameAt(spec, state, 0)], null) };
}

function advance(spec, old, actionId) {
  const state = cloneState(old);
  const action = spec.public.actions.find(candidate => candidate.id === actionId);
  const start = state.tick;
  if (!permitted(spec, state, action)) {
    state.terminal = 'failed';
    return {
      state,
      observation: observationOf(spec, state, [], { action: actionId, kind: action?.kind ?? 'invalid', start, end: start, interventions: [] }),
    };
  }

  state.commands += 1;
  if (state.uses[action.id] !== undefined) state.uses[action.id] -= 1;
  const interventions = [];
  if (action.kind === 'hold') {
    // Capture all values before installing any hold: simultaneous intervention.
    const captured = (action.targets ?? []).map(id => [id, truthAt(state, id, start)]);
    for (const [id, value] of captured) state.holds[id] = { until: start + action.holdTicks, value };
  }
  if (action.kind === 'trigger') {
    for (const id of action.targets ?? []) {
      state.starts[id] = start;
      interventions.push(id);
    }
  }

  let safe = true;
  const frames = [];
  for (let offset = 1; offset <= action.duration; offset += 1) {
    state.tick = start + offset;
    if (action.kind === 'move') {
      for (const id of action.gates ?? []) if (truthAt(state, id, state.tick) !== 1) safe = false;
    }
    if (offset === action.duration && action.kind === 'move' && safe) {
      state.position = action.to;
      const replacements = spec.worlds[state.worldIndex].replacements?.[action.id] ?? {};
      for (const id of action.perturbs ?? []) {
        if (!replacements[id]) continue;
        state.parameters[id] = replacements[id];
        state.starts[id] = replacements[id].kind === 'clock' ? state.tick : null;
        delete state.holds[id];
        interventions.push(id);
      }
    }
    frames.push(frameAt(spec, state, state.tick, action.kind === 'inspect', offset !== action.duration));
  }
  if (action.kind === 'move' && !safe) state.terminal = 'failed';
  else if (action.kind === 'move' && state.position === spec.public.goal) state.terminal = 'crossed';
  else if (state.commands >= spec.budget.actions || state.tick >= spec.budget.ticks) state.terminal = 'failed';
  const receipt = { action: action.id, kind: action.kind, start, end: state.tick, interventions };
  return { state, observation: observationOf(spec, state, frames, receipt) };
}

/** Independent runtime, evaluation side only; never hand snapshot() to a subject. */
export function createOracleWorld(spec, worldIndex = 0) {
  let current = begin(spec, worldIndex);
  return {
    observation() { return copy(current.observation); },
    observe() { return copy(current.observation); },
    step(actionId) { current = advance(spec, current.state, actionId); return copy(current.observation); },
    snapshot() { return copy(current.state); },
  };
}

export function independentReplay(spec, worldIndex, actions) {
  const runtime = createOracleWorld(spec, worldIndex);
  const observations = [runtime.observation()];
  const states = [runtime.snapshot()];
  for (const action of actions) {
    observations.push(runtime.step(typeof action === 'string' ? action : action.action));
    states.push(runtime.snapshot());
  }
  return { observations, states };
}

function partition(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const signature = JSON.stringify(entry.observation);
    if (!groups.has(signature)) groups.set(signature, { observationKey: digest(entry.observation), entries: [] });
    groups.get(signature).entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => a.observationKey.localeCompare(b.observationKey));
}

function privateKey(state) {
  return JSON.stringify([
    state.worldIndex, state.tick, state.commands, state.position, state.terminal,
    state.starts, state.holds, state.uses, state.parameters,
  ]);
}

function beliefKey(entries) {
  return entries.map(entry => privateKey(entry.state)).sort().join('\n');
}

function routeDistances(spec) {
  const distance = new Map([[spec.public.goal, 0]]);
  for (let round = 0; round <= spec.public.actions.length; round += 1) {
    let changed = false;
    for (const action of spec.public.actions) {
      if (action.kind !== 'move' || !distance.has(action.to)) continue;
      const candidate = distance.get(action.to) + action.duration;
      if (candidate < (distance.get(action.from) ?? Infinity)) {
        distance.set(action.from, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return distance;
}

function moveSafe(entries, action) {
  return entries.every(({ state }) => {
    for (let tick = state.tick + 1; tick <= state.tick + action.duration; tick += 1) {
      for (const id of action.gates ?? []) if (truthAt(state, id, tick) !== 1) return false;
    }
    return true;
  });
}

/**
 * Construct an AND/OR certificate. At an OR node exactly one action is chosen
 * for the complete indistinguishable belief. At an AND node every observation
 * outcome is solved. No branch can select an action by its private world ID.
 * The certificate is existential over spec.worlds, not a learned agent and not
 * a proof about hidden laws outside this finite declared ensemble.
 */
export function certifyPolicy(spec, options = {}) {
  const initial = spec.worlds.map((_, index) => begin(spec, index));
  const initialGroups = partition(initial);
  const stateLimit = options.maxStates ?? spec.budget.states ?? 20000;
  const distances = routeDistances(spec);
  const solved = new Map();
  const rejected = new Set();
  const nodes = [];
  let explored = 0;
  let limitReached = false;

  function search(entries) {
    const key = beliefKey(entries);
    if (solved.has(key)) return solved.get(key);
    if (rejected.has(key)) return null;
    if (entries.every(entry => entry.state.terminal === 'crossed')) {
      const result = {
        id: nodes.length,
        maxActions: Math.max(...entries.map(entry => entry.state.commands)),
        maxTicks: Math.max(...entries.map(entry => entry.state.tick)),
      };
      nodes.push({ id: result.id, terminal: 'crossed' });
      solved.set(key, result);
      return result;
    }
    if (entries.some(entry => entry.state.terminal)) { rejected.add(key); return null; }
    if (explored >= stateLimit) { limitReached = true; return null; }
    explored += 1;

    const position = entries[0].state.position;
    const required = new Set(spec.public.actions.filter(action => action.kind === 'move' && action.from === position).flatMap(action => action.gates ?? []));
    const choices = spec.public.actions.filter(action => entries.every(entry => permitted(spec, entry.state, action)))
      .filter(action => action.kind !== 'move' || moveSafe(entries, action));
    const ranking = action => {
      if (action.kind === 'move') return (distances.get(action.to) ?? 1000) + action.duration;
      if (action.kind === 'hold') {
        const relevant = (action.targets ?? []).some(id => required.has(id));
        const open = entries.every(({ state }) => (action.targets ?? []).every(id => truthAt(state, id, state.tick) === 1));
        return relevant && open ? 30 : 120;
      }
      if (action.kind === 'trigger') return (action.targets ?? []).some(id => required.has(id)) ? 40 : 110;
      return (action.kind === 'inspect' ? 60 : 70) + action.duration / 100;
    };
    choices.sort((a, b) => ranking(a) - ranking(b) || a.id.localeCompare(b.id));

    const equivalent = new Set();
    for (const action of choices) {
      const successors = entries.map(entry => advance(spec, entry.state, action.id));
      if (successors.some(entry => entry.state.terminal === 'failed')) continue;
      const outcomes = partition(successors);
      // Different receipts can describe the same physical transition and the
      // same information partition; exploring them twice proves nothing more.
      const equivalence = outcomes.map(group => beliefKey(group.entries)).sort().join('\n---\n');
      if (equivalent.has(equivalence)) continue;
      equivalent.add(equivalence);
      const children = [];
      let valid = true;
      for (const group of outcomes) {
        const child = search(group.entries);
        if (!child) { valid = false; break; }
        children.push({ observationKey: group.observationKey, node: child.id, maxActions: child.maxActions, maxTicks: child.maxTicks });
      }
      if (!valid) continue;
      const result = {
        id: nodes.length,
        maxActions: Math.max(...children.map(child => child.maxActions)),
        maxTicks: Math.max(...children.map(child => child.maxTicks)),
      };
      nodes.push({ id: result.id, action: action.id, outcomes: children.map(({ observationKey, node }) => ({ observationKey, node })) });
      solved.set(key, result);
      return result;
    }
    rejected.add(key);
    return null;
  }

  const roots = [];
  for (const group of initialGroups) {
    const root = search(group.entries);
    if (!root) {
      return {
        solvable: false,
        reason: limitReached ? 'oracle-state-budget' : 'no-certified-observation-policy',
        maxActions: null, maxTicks: null, branches: 0, states: explored,
        uncertaintyWorlds: spec.worlds.length, initialObservationClasses: initialGroups.length,
      };
    }
    roots.push({ observationKey: group.observationKey, node: root.id, maxActions: root.maxActions, maxTicks: root.maxTicks });
  }

  // Discard successful subtrees belonging only to an abandoned search option.
  const retained = new Set();
  function visit(id) {
    if (retained.has(id)) return;
    retained.add(id);
    for (const outcome of nodes[id].outcomes ?? []) visit(outcome.node);
  }
  roots.forEach(root => visit(root.node));
  const compactNodes = [...retained].sort((a, b) => a - b).map(id => nodes[id]);
  const policy = {
    version: 1,
    initial: roots.map(({ observationKey, node }) => ({ observationKey, node })),
    nodes: compactNodes,
  };
  return {
    solvable: true,
    maxActions: Math.max(...roots.map(root => root.maxActions)),
    maxTicks: Math.max(...roots.map(root => root.maxTicks)),
    branches: compactNodes.reduce((count, node) => count + (node.outcomes?.length ?? 0), 0),
    states: explored,
    policyStates: compactNodes.length,
    uncertaintyWorlds: spec.worlds.length,
    initialObservationClasses: initialGroups.length,
    policyHash: digest(policy),
    ...(options.includePolicy === false ? {} : { policy }),
  };
}

/** Re-evaluate a certificate using only public observation hashes for choices. */
export function replayCertifiedPolicy(spec, certificate, worldIndex = 0) {
  if (!certificate.solvable || !certificate.policy) throw new Error('A complete successful policy certificate is required');
  const runtime = createOracleWorld(spec, worldIndex);
  const nodes = new Map(certificate.policy.nodes.map(node => [node.id, node]));
  const observations = [runtime.observation()];
  const actions = [];
  let cursor = certificate.policy.initial.find(branch => branch.observationKey === digest(observations[0]))?.node;
  while (cursor !== undefined) {
    const node = nodes.get(cursor);
    if (!node) throw new Error('Certificate references a missing node');
    if (node.terminal) return { crossed: observations.at(-1).terminal === 'crossed', actions, observations };
    actions.push(node.action);
    const observation = runtime.step(node.action);
    observations.push(observation);
    cursor = node.outcomes.find(branch => branch.observationKey === digest(observation))?.node;
  }
  return { crossed: false, actions, observations, error: 'uncovered-public-observation' };
}
