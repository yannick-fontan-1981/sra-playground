/** Executed simulator and public-model adapter. The independent oracle imports none of this file. */
export function predicate(test, values) {
  if ('all' in test) return test.all.every(item => predicate(item, values));
  if ('any' in test) return test.any.some(item => predicate(item, values));
  if ('not' in test) return !predicate(test.not, values);
  const value = values[test.variable];
  if (value === undefined) throw new Error(`Unknown variable: ${test.variable}`);
  if ('eq' in test) return value === test.eq;
  if ('min' in test) return value >= test.min;
  if ('max' in test) return value <= test.max;
  throw new Error('Malformed predicate');
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  return value;
}
export const observationKey = observation => JSON.stringify(ordered(observation));
export const stateKey = state => observationKey({ values: state.values, evidence: state.evidence,
  identityClaim: state.identityClaim ?? null });

/**
 * The planning boundary deliberately excludes actual camera samples and the true
 * subject assignment. They are obtained only from the played observation. Other
 * hidden variables are supplied as a complete set of public hypotheses, never a
 * selector identifying the actual world. Labels, seeds and oracle data are absent.
 */
export function publicProblem(spec) {
  const privateVariable = spec.view?.assignment;
  const variables = spec.variables.filter(variable => variable.id !== privateVariable);
  const allowed = new Set(variables.map(variable => variable.id));
  return {
    protocol: spec.protocol,
    variables: structuredClone(variables),
    initial: spec.initial.map(values => Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)))),
    actions: structuredClone(spec.actions),
    goal: structuredClone(spec.goal),
    invariant: structuredClone(spec.invariant),
    parentInvariant: structuredClone(spec.parentInvariant),
    budget: { ...spec.budget },
  };
}

export function publicBelief(spec, states) {
  const allowed = new Set(spec.variables.map(variable => variable.id));
  return states.map(state => ({ ...state,
    values: Object.fromEntries(Object.entries(state.values).filter(([key]) => allowed.has(key))) }));
}

export function observe(spec, state) {
  const result = { values: {}, feedback: state.feedback };
  for (const variable of spec.variables) {
    if (!variable.hidden || variable.visibleWhen && predicate(variable.visibleWhen, state.values)) {
      result.values[variable.id] = state.values[variable.id];
    }
  }
  if (spec.view && predicate(spec.view.revealedWhen, state.values)) {
    const { targetBefore, anchorsBefore, anchorsAfter, subjectsAfter } = spec.view;
    result.view = structuredClone({ targetBefore, anchorsBefore, anchorsAfter, subjectsAfter });
  }
  return result;
}

/** Match a subject by a rigid quarter-turn/translation inferred from public landmarks. */
export function identifyInView(view) {
  if (!view || view.anchorsBefore.length < 2 || view.anchorsBefore.length !== view.anchorsAfter.length) return null;
  const rotate = ([x, y], n) => n === 0 ? [x, y] : n === 1 ? [-y, x] : n === 2 ? [-x, -y] : [y, -x];
  const hits = new Set();
  for (let turn = 0; turn < 4; turn++) {
    const first = rotate(view.anchorsBefore[0], turn);
    const offset = view.anchorsAfter[0].map((value, axis) => value - first[axis]);
    const project = point => rotate(point, turn).map((value, axis) => value + offset[axis]);
    if (!view.anchorsBefore.every((point, index) => project(point).every((value, axis) => value === view.anchorsAfter[index][axis]))) continue;
    const target = project(view.targetBefore);
    view.subjectsAfter.forEach((point, index) => { if (point.every((value, axis) => value === target[axis])) hits.add(index); });
  }
  return hits.size === 1 ? [...hits][0] : null;
}

export function initialState(spec, world = 0) {
  if (!spec.initial[world]) throw new Error('Unknown initial hypothesis');
  const state = { values: { ...spec.initial[world] }, feedback: 'initial', evidence: false };
  const claim = identifyInView(observe(spec, state).view);
  if (claim !== null) state.identityClaim = claim;
  return state;
}

function update(values, changes) {
  for (const change of changes) {
    if (!(change.variable in values)) throw new Error(`Unknown effect variable: ${change.variable}`);
    if ('set' in change) values[change.variable] = change.set;
    else values[change.variable] += change.add;
  }
}

const compiled = new WeakMap();
function indexSpec(spec) {
  let value = compiled.get(spec);
  if (!value) {
    value = { actions: new Map(spec.actions.map(action => [action.id, action])), timers: spec.variables.filter(variable => variable.timer) };
    compiled.set(spec, value);
  }
  return value;
}

export function stepState(spec, before, actionId, { parent = false } = {}) {
  const index = indexSpec(spec);
  const action = index.actions.get(actionId);
  if (!action) throw new Error(`Unknown action: ${actionId}`);
  const invariant = values => predicate(spec.invariant, values) && (!parent || predicate(spec.parentInvariant, values));
  const values = { ...before.values };
  let valid = invariant(values);
  const enabled = predicate(action.requires, before.values);
  for (const variable of index.timers) if (values[variable.id] > 0) values[variable.id]--;
  valid &&= invariant(values);
  const blocked = !enabled || !!action.throughout && !predicate(action.throughout, values);
  const declared = [];
  if (!blocked) {
    update(values, action.updates);
    declared.push(...action.events ?? []);
    for (const branch of action.branches ?? []) {
      if (!predicate(branch.when, before.values)) continue;
      update(values, branch.updates);
      declared.push(...branch.events ?? []);
    }
  }
  valid &&= invariant(values);
  const state = { values, feedback: blocked ? 'blocked' : 'ok', evidence: before.evidence,
    ...(before.identityClaim === undefined ? {} : { identityClaim: before.identityClaim }) };
  const observation = observe(spec, state);
  const claim = identifyInView(observation.view);
  if (claim !== null) state.identityClaim = claim;
  const events = declared.filter(event => {
    if (event.kind === 'crossing') return before.values[event.actor] === event.from && values[event.actor] === event.to && event.from !== event.to;
    if (event.kind === 'observation') return before.values[event.variable] === 0 && values[event.variable] === 1;
    return true;
  });
  if (events.some(event => event.kind === 'crossing' || event.kind === 'observation')) state.evidence = true;
  return { state, observation, events, valid, blocked };
}

export function isGoal(spec, state) {
  return state.evidence && predicate(spec.goal, state.values)
    && (!spec.view || state.identityClaim !== undefined && state.identityClaim === state.values[spec.view.assignment]);
}

export function executePolicy(spec, policy, { world = 0, parent = false, startState, limit = spec.budget.commands } = {}) {
  let state = startState ? structuredClone(startState) : initialState(spec, world);
  let node = policy;
  const steps = [], receipts = [];
  let crossings = 0, newObservations = 0, officialWins = 0, firstViolation = null;
  const initialObservation = observe(spec, state);
  if (node?.initialBranches) node = node.initialBranches[observationKey(initialObservation)];
  while (node && steps.length < limit) {
    const result = stepState(spec, state, node.action, { parent });
    const step = { action: node.action, observation: result.observation };
    if (result.observation.view) {
      const claim = identifyInView(result.observation.view);
      if (claim !== null) step.identityClaim = claim;
    }
    steps.push(step);
    for (const event of result.events) {
      if (event.kind === 'crossing') crossings++;
      if (event.kind === 'observation') newObservations++;
      if (event.kind === 'official-win') officialWins++;
      receipts.push({ id: `return:${steps.length}`, action: node.action, ...event });
    }
    state = result.state;
    if (!result.valid) { firstViolation = { command: steps.length, reason: 'invariant' }; break; }
    if (isGoal(spec, state)) break;
    const key = observationKey(result.observation);
    const next = node.branches?.[key] ?? node.branches?.['*'];
    if (next === undefined) { firstViolation = { command: steps.length, reason: 'unhandled-observation', observation: result.observation }; break; }
    node = next;
  }
  return { steps, commands: steps.length, accessVerified: !firstViolation && isGoal(spec, state), crossings,
    newObservations, officialWins, firstViolation, receipts, finalState: state, initialObservation };
}

export function enabledActions(spec, states) {
  // A blocked command still advances time and can be an admissible wait.
  if (indexSpec(spec).timers.some(variable => states.some(state => state.values[variable.id] > 0))) return spec.actions;
  return spec.actions.filter(action => states.some(state => predicate(action.requires, state.values)));
}

export function normalizeBelief(states) {
  const byKey = new Map(states.map(state => [stateKey(state), state]));
  return [...byKey].sort(([a], [b]) => a.localeCompare(b)).map(([, state]) => state);
}
export const beliefKey = states => normalizeBelief(states).map(stateKey).join('\n');
