/**
 * Independent P07 reference interpreter and bounded contingent-policy oracle.
 * Deliberately imports no generator, runtime, candidate or SIC implementation.
 * Only the declarative protocol in schema.ts is shared with the measured code.
 */
import { createHash } from 'node:crypto';

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const name of Object.keys(value).sort()) result[name] = ordered(value[name]);
    return result;
  }
  return value;
}

/** For comparison tests only; the measured runtime implements its own encoder. */
export function oracleObservationKey(observation) {
  return JSON.stringify(ordered(observation));
}

function predicate(rule, values) {
  if (!rule || typeof rule !== 'object') return false;
  if ('all' in rule) return rule.all.every(item => predicate(item, values));
  if ('any' in rule) return rule.any.some(item => predicate(item, values));
  if ('not' in rule) return !predicate(rule.not, values);
  const actual = values[rule.variable];
  if (!Number.isFinite(actual)) return false;
  if ('eq' in rule) return actual === rule.eq;
  if ('min' in rule) return actual >= rule.min;
  if ('max' in rule) return actual <= rule.max;
  return false;
}

function invariant(spec, values, parent) {
  return predicate(spec.invariant, values)
    && (!parent || predicate(spec.parentInvariant, values));
}

function observe(spec, values, feedback) {
  const visible = {};
  for (const variable of spec.variables) {
    if (!variable.hidden || (variable.visibleWhen && predicate(variable.visibleWhen, values))) {
      visible[variable.id] = values[variable.id];
    }
  }
  const result = { values: visible, feedback };
  if (spec.view && predicate(spec.view.revealedWhen, values)) {
    result.view = {};
    for (const key of ['targetBefore', 'anchorsBefore', 'anchorsAfter', 'subjectsAfter']) {
      result.view[key] = structuredClone(spec.view[key]);
    }
  }
  return result;
}

/**
 * Recover a correspondence using only an actually received view. Three
 * non-collinear anchor pairs define an affine map; every other pair checks it.
 * Two pairs are sufficient only for the orientation-preserving similarity
 * transforms used by the protocol's rotation/translation presentations.
 */
export function oracleIdentityClaim(observation) {
  const view = observation?.view;
  if (!view) return undefined;
  const before = view.anchorsBefore;
  const after = view.anchorsAfter;
  if (!Array.isArray(before) || before.length !== after?.length || before.length < 2) return undefined;
  let transform;
  outer: for (let a = 0; a < before.length; a++) {
    for (let b = a + 1; b < before.length; b++) {
      for (let c = b + 1; c < before.length; c++) {
        const ux = before[b][0] - before[a][0];
        const uy = before[b][1] - before[a][1];
        const vx = before[c][0] - before[a][0];
        const vy = before[c][1] - before[a][1];
        const determinant = ux * vy - uy * vx;
        if (Math.abs(determinant) < 1e-9) continue;
        transform = point => {
          const x = point[0] - before[a][0];
          const y = point[1] - before[a][1];
          const u = (x * vy - y * vx) / determinant;
          const v = (ux * y - uy * x) / determinant;
          return [
            after[a][0] + u * (after[b][0] - after[a][0]) + v * (after[c][0] - after[a][0]),
            after[a][1] + u * (after[b][1] - after[a][1]) + v * (after[c][1] - after[a][1]),
          ];
        };
        break outer;
      }
    }
  }
  if (!transform) {
    const x = before[1][0] - before[0][0];
    const y = before[1][1] - before[0][1];
    const norm = x * x + y * y;
    if (norm < 1e-9) return undefined;
    const tx = after[1][0] - after[0][0];
    const ty = after[1][1] - after[0][1];
    const real = (tx * x + ty * y) / norm;
    const imaginary = (ty * x - tx * y) / norm;
    transform = point => {
      const dx = point[0] - before[0][0];
      const dy = point[1] - before[0][1];
      return [after[0][0] + real * dx - imaginary * dy,
        after[0][1] + imaginary * dx + real * dy];
    };
  }
  const equal = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  if (!before.every((point, i) => equal(transform(point), after[i]))) return undefined;
  const projected = transform(view.targetBefore);
  const matches = view.subjectsAfter.map((point, index) => equal(point, projected) ? index : -1)
    .filter(index => index >= 0);
  return matches.length === 1 ? matches[0] : undefined;
}

function update(values, changes) {
  for (const change of changes) {
    if ('set' in change) values[change.variable] = change.set;
    else values[change.variable] += change.add;
  }
}

/** Every call consumes exactly one command, including a blocked command. */
function transition(spec, before, action, parent) {
  if (!invariant(spec, before, parent)) return { violation: 'invariant-before' };
  const after = { ...before };
  for (const variable of spec.variables) {
    if (variable.timer && after[variable.id] > 0) after[variable.id]--;
  }
  if (!invariant(spec, after, parent)) return { violation: 'invariant-during' };
  const enabled = predicate(action.requires, before)
    && (!action.throughout || predicate(action.throughout, after));
  let declared = [];
  if (enabled) {
    update(after, action.updates);
    declared = [...(action.events ?? [])];
    for (const branch of action.branches ?? []) {
      if (predicate(branch.when, before)) {
        update(after, branch.updates);
        declared.push(...(branch.events ?? []));
      }
    }
  }
  if (!invariant(spec, after, parent)) return { violation: 'invariant-after' };
  const real = [];
  const seen = new Set();
  for (const event of declared) {
    // A declaration alone is not proof: check its actual state transition.
    if (event.kind === 'crossing' && !(event.from !== event.to
      && before[event.actor] === event.from && after[event.actor] === event.to)) continue;
    if (event.kind === 'observation' && !(before[event.variable] === 0
      && after[event.variable] === 1)) continue;
    const key = oracleObservationKey(event);
    if (!seen.has(key)) { real.push(event); seen.add(key); }
  }
  return { after, observation: observe(spec, after, enabled ? 'ok' : 'blocked'), events: real };
}

function goal(spec, envelope) {
  return envelope.evidence && predicate(spec.goal, envelope.values)
    && (!spec.view || envelope.identityClaim === envelope.values[spec.view.assignment]);
}

function envelopeKey(envelope) {
  return oracleObservationKey({ values: envelope.values, evidence: envelope.evidence,
    identityClaim: envelope.identityClaim ?? null });
}

function beliefKey(envelopes) {
  return [...new Set(envelopes.map(envelopeKey))].sort().join('\n');
}

function uniqueEnvelopes(envelopes) {
  return [...new Map(envelopes.map(envelope => [envelopeKey(envelope), envelope])).values()];
}

function scenarioError(spec) {
  if (spec?.protocol !== 'sic-p07-access-v1') return 'unsupported-protocol';
  if (!Array.isArray(spec.initial) || spec.initial.length === 0) return 'no-initial-world';
  if (!Number.isInteger(spec.budget?.commands) || spec.budget.commands < 0
    || !Number.isInteger(spec.budget?.states) || spec.budget.states < 1) return 'invalid-budget';
  if (new Set(spec.actions.map(action => action.id)).size !== spec.actions.length) return 'duplicate-action-id';
  if (new Set(spec.variables.map(variable => variable.id)).size !== spec.variables.length) return 'duplicate-variable-id';
  for (const world of spec.initial) {
    if (spec.variables.some(variable => !Number.isFinite(world[variable.id]))) return 'missing-or-nonnumeric-variable';
  }
  return undefined;
}

/**
 * Enumerate a bounded belief graph, then solve its AND/OR hyperedges backwards.
 * A single action is chosen for all indistinguishable worlds. Only received
 * public observations may split the belief; hidden state never selects a branch.
 */
export function oracleSolve(spec, { parent = false, initialEvidence = false } = {}) {
  const error = scenarioError(spec);
  if (error) return { solvable: false, reason: error, explored: 0, worstCommands: null, policy: null };
  const nodes = [];
  const byKey = new Map();
  let exhausted = false;
  function intern(envelopes, depth) {
    const key = beliefKey(envelopes);
    if (byKey.has(key)) return byKey.get(key);
    if (nodes.length >= spec.budget.states) { exhausted = true; return undefined; }
    const node = { id: nodes.length, envelopes: uniqueEnvelopes(envelopes), depth,
      edges: [], incoming: [], value: Infinity, chosen: null };
    if (node.envelopes.every(envelope => goal(spec, envelope))) node.value = 0;
    nodes.push(node); byKey.set(key, node);
    return node;
  }
  const initialGroups = new Map();
  for (const values of spec.initial) {
    if (!invariant(spec, values, parent)) {
      return { solvable: false, reason: 'invariant-in-initial-world', explored: 0,
        worstCommands: null, policy: null, worldCount: spec.initial.length };
    }
    const initialObservation = observe(spec, values, 'initial');
    const key = oracleObservationKey(initialObservation);
    if (!initialGroups.has(key)) initialGroups.set(key, []);
    initialGroups.get(key).push({ values: { ...values }, evidence: !!initialEvidence,
      identityClaim: undefined });
  }
  const roots = new Map([...initialGroups].map(([key, envelopes]) => [key, intern(envelopes, 0)]));
  let explored = 0;
  const actions = [...spec.actions].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (let cursor = 0; cursor < nodes.length; cursor++) {
    const node = nodes[cursor];
    if (node.value === 0 || node.depth >= spec.budget.commands) continue;
    explored++;
    for (const action of actions) {
      const groups = new Map();
      const claims = new Map();
      let invalid = false;
      for (const envelope of node.envelopes) {
        const result = transition(spec, envelope.values, action, parent);
        if (result.violation) { invalid = true; break; }
        const observationKey = oracleObservationKey(result.observation);
        if (!groups.has(observationKey)) groups.set(observationKey, []);
        const claim = oracleIdentityClaim(result.observation);
        if (claim !== undefined) claims.set(observationKey, claim);
        groups.get(observationKey).push({
          values: result.after,
          evidence: envelope.evidence || result.events.some(event =>
            event.kind === 'crossing' || event.kind === 'observation'),
          identityClaim: claim ?? envelope.identityClaim,
        });
      }
      if (invalid) continue;
      const children = new Map();
      for (const [key, envelopes] of groups) {
        const child = intern(envelopes, node.depth + 1);
        if (!child) { invalid = true; break; }
        children.set(key, child);
      }
      if (invalid || (children.size === 1 && [...children.values()][0] === node)) continue;
      const edge = { parent: node, action: action.id, children, claims };
      node.edges.push(edge);
      for (const child of new Set(children.values())) child.incoming.push(edge);
    }
  }
  const changed = nodes.filter(node => node.value === 0);
  for (let cursor = 0; cursor < changed.length; cursor++) {
    for (const edge of changed[cursor].incoming) {
      const cost = 1 + Math.max(...[...edge.children.values()].map(child => child.value));
      if (cost < edge.parent.value) {
        edge.parent.value = cost;
        edge.parent.chosen = edge;
        changed.push(edge.parent);
      }
    }
  }
  const solved = [...roots.values()].every(root => root && root.value <= spec.budget.commands);
  if (!solved) return { solvable: false,
    reason: exhausted ? 'state-budget-exhausted' : 'no-policy-within-command-budget',
    explored, generated: nodes.length, worstCommands: null, policy: null,
    worldCount: spec.initial.length, stateBudgetExhausted: exhausted };
  const memo = new Map();
  function build(node) {
    if (node.value === 0) return null;
    if (memo.has(node.id)) return memo.get(node.id);
    const edge = node.chosen;
    const policy = { action: edge.action, branches: {} };
    memo.set(node.id, policy);
    for (const [key, child] of edge.children) policy.branches[key] = build(child);
    // When the action can reveal different observations, the executor computes
    // its claim after receiving that observation (oracleIdentityClaim is public-only).
    if (edge.claims.size === edge.children.size && new Set(edge.claims.values()).size === 1) {
      policy.identityClaim = edge.claims.values().next().value;
    }
    return policy;
  }
  const initialPolicies = Object.fromEntries([...roots].map(([key, root]) => [key, build(root)]));
  const worstCommands = Math.max(...[...roots.values()].map(root => root.value));
  const certificateHash = createHash('sha256').update(oracleObservationKey({
    protocol: spec.protocol, scenario: spec, parent, initialEvidence, worstCommands, initialPolicies,
  })).digest('hex');
  return { solvable: true, policy: roots.size === 1 ? Object.values(initialPolicies)[0] : null,
    initialPolicies, worstCommands, explored, generated: nodes.length,
    worldCount: spec.initial.length, stateBudgetExhausted: exhausted,
    invariantsChecked: parent ? ['base', 'parent'] : ['base'], certificateHash };
}

/** Independently replay and check a trace produced by either measured agent. */
export function oracleReplay(spec, steps, { world = 0, parent = false, intervention } = {}) {
  const error = scenarioError(spec);
  if (error || !Number.isInteger(world) || world < 0 || world >= spec.initial.length) {
    return { valid: false, accessVerified: false, crossings: 0, newObservations: 0,
      officialWins: 0, commands: 0, firstViolation: { index: 0, reason: error ?? 'invalid-world' } };
  }
  const state = { values: { ...spec.initial[world] }, evidence: false, identityClaim: undefined };
  const byId = new Map(spec.actions.map(action => [action.id, action]));
  const events = [];
  const evidenceIds = [];
  let crossings = 0;
  let newObservations = 0;
  let officialWins = 0;
  let accessAt = null;
  let firstViolation = null;
  let commands = 0;
  let finalObservation = observe(spec, state.values, 'initial');
  let interventionApplied = false;
  let withheldActions = new Set();
  const applyIntervention = index => {
    if (!intervention || interventionApplied || intervention.at !== index) return;
    // The prefix, command count, identity and prior evidence are kept intact.
    // Removing route knowledge changes no physical variable or past observation.
    update(state.values, intervention.updates ?? []);
    withheldActions = new Set(intervention.withheldActions ?? []);
    interventionApplied = true;
    if (!invariant(spec, state.values, parent)) {
      firstViolation = { index, reason: 'invariant-at-intervention' };
    }
    finalObservation = observe(spec, state.values, finalObservation.feedback);
  };
  if (intervention && (!Number.isInteger(intervention.at) || intervention.at < 0
    || intervention.at > steps.length)) firstViolation = { index: 0, reason: 'invalid-intervention-checkpoint' };
  if (!invariant(spec, state.values, parent)) firstViolation = { index: 0, reason: 'invariant-before' };
  for (let index = 0; index < steps.length && !firstViolation; index++) {
    applyIntervention(index);
    if (firstViolation) break;
    if (commands >= spec.budget.commands) {
      firstViolation = { index, reason: 'command-budget-exceeded' }; break;
    }
    const step = steps[index];
    if (withheldActions.has(step.action)) {
      firstViolation = { index, reason: 'withheld-route-proof', action: step.action }; break;
    }
    const action = byId.get(step.action);
    if (!action) { firstViolation = { index, reason: 'unknown-action', action: step.action }; break; }
    commands++;
    const result = transition(spec, state.values, action, parent);
    if (result.violation) { firstViolation = { index, reason: result.violation, action: step.action }; break; }
    if (oracleObservationKey(step.observation) !== oracleObservationKey(result.observation)) {
      firstViolation = { index, reason: 'observation-mismatch', action: step.action,
        expected: result.observation, received: step.observation }; break;
    }
    if (step.identityClaim !== undefined) {
      const correspondence = oracleIdentityClaim(result.observation);
      if (!result.observation.view || correspondence === undefined
        || step.identityClaim !== correspondence
        || step.identityClaim !== result.after[spec.view.assignment]) {
        firstViolation = { index, reason: 'unverified-subject-correspondence', action: step.action }; break;
      }
      state.identityClaim = step.identityClaim;
      evidenceIds.push(`identity:${index}:${step.identityClaim}`);
    }
    state.values = result.after;
    finalObservation = result.observation;
    for (const event of result.events) {
      events.push({ index, action: step.action, ...event });
      if (event.kind === 'crossing') { crossings++; state.evidence = true; evidenceIds.push(`crossing:${index}:${event.actor}`); }
      if (event.kind === 'observation') { newObservations++; state.evidence = true; evidenceIds.push(`observation:${index}:${event.variable}`); }
      if (event.kind === 'official-win') officialWins = 1;
    }
    if (accessAt === null && goal(spec, state)) accessAt = index;
  }
  if (!firstViolation) applyIntervention(steps.length);
  const valid = firstViolation === null;
  return { valid, accessVerified: valid && accessAt !== null,
    goalAtEnd: valid && goal(spec, state), crossings, newObservations, officialWins,
    commands, firstViolation, accessAt, evidenceIds, events, finalObservation,
    interventionApplied };
}

/** Materialize the independently certified policy for one private world. */
export function oraclePolicyTrace(spec, solution, { world = 0, parent = false } = {}) {
  if (!solution.solvable) return [];
  let values = { ...spec.initial[world] };
  let policy = solution.initialPolicies?.[oracleObservationKey(observe(spec, values, 'initial'))]
    ?? solution.policy;
  const steps = [];
  const actions = new Map(spec.actions.map(action => [action.id, action]));
  while (policy && steps.length < spec.budget.commands) {
    const action = actions.get(policy.action);
    if (!action) throw new Error(`Oracle policy names an absent action: ${policy.action}`);
    const result = transition(spec, values, action, parent);
    if (result.violation) throw new Error(`Oracle policy violates ${result.violation}`);
    const step = { action: policy.action, observation: result.observation };
    const claim = oracleIdentityClaim(result.observation);
    if (claim !== undefined) step.identityClaim = claim;
    steps.push(step);
    values = result.after;
    const key = oracleObservationKey(result.observation);
    if (!(key in policy.branches)) throw new Error('Oracle policy has no branch for its own observation');
    policy = policy.branches[key];
  }
  if (policy) throw new Error('Oracle policy exceeded its certified command budget');
  return steps;
}
