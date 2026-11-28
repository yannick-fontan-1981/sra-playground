import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  oracleSolve, oracleReplay, oraclePolicyTrace, oracleIdentityClaim, oracleObservationKey,
} from '../scripts/p07-access/oracle.mjs';
import { families, generateScenario, seededDraw } from '../scripts/p07-access/generator.mjs';
import { initialState, stepState, identifyInView, publicProblem, executePolicy } from '../scripts/p07-access/runtime.mjs';
import { planAccess } from '../scripts/p07-access/candidate.mjs';

const truth = { all: [] };
const eq = (variable, value) => ({ variable, eq: value });
const set = (variable, value) => ({ variable, set: value });

function scenario(overrides = {}) {
  return {
    protocol: 'sic-p07-access-v1', id: 'oracle-adversarial', family: 'control', seed: 0,
    initial: [{ p: 0, seen: 0, alive: 1 }],
    variables: [{ id: 'p', role: 'position' }, { id: 'seen', role: 'observation' },
      { id: 'alive', role: 'invariant' }],
    actions: [{ id: 'cross', kind: 'move', requires: eq('p', 0), updates: [set('p', 1)],
      events: [{ kind: 'crossing', actor: 'p', from: 0, to: 1 }] }],
    goal: eq('p', 1), invariant: eq('alive', 1), parentInvariant: truth,
    budget: { commands: 4, states: 256 }, structure: {},
    presentation: { rotation: 0, offset: [0, 0], palette: [] }, ...overrides,
  };
}

function uncertain(allowObservation) {
  const spec = scenario({
    initial: [{ p: 0, seen: 0, alive: 1, hidden: 0 }, { p: 0, seen: 0, alive: 1, hidden: 1 }],
    budget: { commands: 2, states: 256 },
  });
  spec.variables.push({ id: 'hidden', role: 'hidden-location', hidden: true, visibleWhen: eq('seen', 1) });
  spec.actions = [0, 1].map(side => ({
    id: `choose-${side}`, kind: 'move', requires: eq('p', 0), updates: [],
    branches: [
      { when: eq('hidden', side), updates: [set('p', 1)],
        events: [{ kind: 'crossing', actor: 'p', from: 0, to: 1 }] },
      { when: { not: eq('hidden', side) }, updates: [set('alive', 0)] },
    ],
  }));
  if (allowObservation) spec.actions.push({ id: 'observe', kind: 'observe', requires: truth,
    updates: [set('seen', 1)], events: [{ kind: 'observation', subject: 'route', variable: 'seen' }] });
  return spec;
}

test('oracle has no executable import of the measured implementation', () => {
  const source = readFileSync(new URL('../scripts/p07-access/oracle.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/(?:import\s+[^;]+?from\s*|import\s*\()(['"])([^'"]+)\1/g)].map(match => match[2]);
  assert.deepEqual(imports, ['node:crypto']);
});

test('the planning boundary excludes the true subject and all future view samples', () => {
  const spec = generateScenario('F2-viewpoint', seededDraw(26112808), { seed: 26112807, index: 1 });
  spec.oracle = { forbiddenAnswer: true };
  const problem = publicProblem(spec);
  assert.deepEqual(Object.keys(problem).sort(), [
    'actions', 'budget', 'goal', 'initial', 'invariant', 'parentInvariant', 'protocol', 'variables',
  ]);
  assert.equal(problem.variables.some(variable => variable.id === spec.view.assignment), false);
  for (const values of problem.initial) assert.equal(spec.view.assignment in values, false);
  for (const key of ['view', 'family', 'seed', 'structure', 'presentation', 'ablations', 'oracle', 'id']) {
    assert.equal(key in problem, false, `planning input must omit ${key}`);
  }
  // The adapter is permitted to read only the private variable's NAME to remove
  // it. Touching future image samples or unrelated metadata is a test failure.
  const originalView = spec.view;
  spec.view = new Proxy(originalView, { get(target, key) {
    if (key !== 'assignment') throw new Error(`Read future view sample: ${String(key)}`);
    return target[key];
  } });
  const wrapped = new Proxy(spec, { get(target, key) {
    if (['family', 'seed', 'structure', 'presentation', 'ablations', 'oracle', 'id'].includes(key)) {
      throw new Error(`Read non-public metadata: ${String(key)}`);
    }
    return target[key];
  } });
  const planned = planAccess(wrapped);
  assert.equal(planned.status, 'solved');
  spec.view = originalView;
  const played = executePolicy(spec, planned.policy);
  assert.equal(oracleReplay(spec, played.steps).accessVerified, true);
});

test('all uncertain initial hypotheses survive the public projection', () => {
  for (const family of ['F7-uncertain-location', 'F8-recovery']) {
    const spec = generateScenario(family, seededDraw(26112813), { seed: 26112807, index: 6 });
    const projected = publicProblem(spec);
    assert.equal(spec.initial.length >= 2, true);
    assert.deepEqual(projected.initial, spec.initial);
  }
});

test('a claimed crossing without physical displacement cannot establish access', () => {
  const spec = scenario({ goal: eq('seen', 1), actions: [{ id: 'claim', kind: 'move',
    requires: truth, updates: [set('seen', 1)],
    events: [{ kind: 'crossing', actor: 'p', from: 0, to: 1 }] }] });
  assert.equal(oracleSolve(spec).solvable, false);
  const replay = oracleReplay(spec, [{ action: 'claim',
    observation: { values: { p: 0, seen: 1, alive: 1 }, feedback: 'ok' } }]);
  assert.equal(replay.valid, true);
  assert.equal(replay.crossings, 0);
  assert.equal(replay.accessVerified, false);
});

test('a falsified returned observation is rejected at its first command', () => {
  const spec = scenario();
  const solution = oracleSolve(spec);
  const steps = oraclePolicyTrace(spec, solution);
  steps[0].observation.feedback = 'blocked';
  const replay = oracleReplay(spec, steps);
  assert.equal(replay.valid, false);
  assert.deepEqual([replay.firstViolation.index, replay.firstViolation.reason], [0, 'observation-mismatch']);
  assert.equal(replay.accessVerified, false);
});

test('restoring an invariant after timer decay cannot erase its intermediate violation', () => {
  const spec = scenario();
  spec.initial[0].window = 1;
  spec.variables.push({ id: 'window', role: 'opening', timer: true });
  spec.invariant = { all: [eq('alive', 1), { variable: 'window', min: 1 }] };
  spec.actions[0].updates.push(set('window', 2));
  assert.equal(oracleSolve(spec).solvable, false);
  const replay = oracleReplay(spec, [{ action: 'cross',
    observation: { values: { p: 1, seen: 0, alive: 1, window: 2 }, feedback: 'ok' } }]);
  assert.equal(replay.firstViolation.reason, 'invariant-during');
});

test('parent invariants are added to the base invariant and checked during every command', () => {
  const spec = scenario();
  spec.initial[0].reserve = 1;
  spec.variables.push({ id: 'reserve', role: 'parent-reserve', timer: true });
  spec.actions[0].updates.push(set('reserve', 2));
  spec.parentInvariant = { variable: 'reserve', min: 1 };
  assert.equal(oracleSolve(spec).solvable, true);
  assert.equal(oracleSolve(spec, { parent: true }).solvable, false);
  spec.variables.find(variable => variable.id === 'reserve').timer = false;
  spec.actions[0].updates.push(set('alive', 0));
  assert.equal(oracleSolve(spec, { parent: true }).solvable, false);
});

test('an omniscient route per world is not a feasible observation policy', () => {
  const spec = uncertain(false);
  for (const world of spec.initial) {
    assert.equal(oracleSolve({ ...spec, initial: [world] }).solvable, true);
  }
  assert.equal(oracleSolve(spec).solvable, false);
});

test('a robust policy observes before incompatible irreversible route choices', () => {
  const spec = uncertain(true);
  const solution = oracleSolve(spec);
  assert.equal(solution.solvable, true);
  assert.equal(solution.worstCommands, 2);
  const traces = spec.initial.map((_, world) => oraclePolicyTrace(spec, solution, { world }));
  assert.equal(traces[0][0].action, 'observe');
  assert.equal(traces[1][0].action, 'observe');
  assert.notEqual(traces[0][1].action, traces[1][1].action);
  for (let world = 0; world < traces.length; world++) {
    assert.equal(oracleReplay(spec, traces[world], { world }).accessVerified, true);
  }
  assert.equal(oracleSolve({ ...spec, budget: { ...spec.budget, commands: 1 } }).solvable, false);
});

test('the correct subject must be inferred from the obtained view, not its distractor', () => {
  const spec = scenario({ goal: eq('seen', 1) });
  spec.initial[0].assignment = 1;
  spec.variables.push({ id: 'assignment', role: 'subject-assignment', hidden: true });
  spec.view = { revealedWhen: eq('seen', 1), assignment: 'assignment', targetBefore: [2, 1],
    anchorsBefore: [[0, 0], [1, 0], [0, 1]], anchorsAfter: [[5, 8], [5, 9], [4, 8]],
    subjectsAfter: [[3, 10], [4, 10]] };
  spec.actions = [{ id: 'look', kind: 'observe', requires: truth, updates: [set('seen', 1)],
    events: [{ kind: 'observation', subject: 'target', variable: 'seen' }] }];
  const solution = oracleSolve(spec);
  const trace = oraclePolicyTrace(spec, solution);
  assert.equal(trace[0].identityClaim, 1);
  assert.equal(oracleIdentityClaim(trace[0].observation), 1);
  assert.equal(oracleReplay(spec, trace).accessVerified, true);
  const missing = structuredClone(trace); delete missing[0].identityClaim;
  assert.equal(oracleReplay(spec, missing).accessVerified, false);
  trace[0].identityClaim = 0;
  const wrong = oracleReplay(spec, trace);
  assert.equal(wrong.firstViolation.reason, 'unverified-subject-correspondence');
  assert.equal(wrong.accessVerified, false);
});

test('blocked commands still consume one command and decay timers without applying effects', () => {
  const spec = scenario();
  spec.initial[0].window = 3;
  spec.variables.push({ id: 'window', role: 'opening', timer: true });
  spec.actions[0].requires = eq('p', 1);
  const replay = oracleReplay(spec, [{ action: 'cross',
    observation: { values: { p: 0, seen: 0, alive: 1, window: 2 }, feedback: 'blocked' } }]);
  assert.equal(replay.valid, true);
  assert.equal(replay.commands, 1);
  assert.equal(replay.crossings, 0);
  assert.equal(replay.finalObservation.feedback, 'blocked');
});

test('conditional effects read the pre-command state', () => {
  const spec = scenario();
  spec.actions = [{ id: 'switch-and-cross', kind: 'interact', requires: truth,
    updates: [set('seen', 1)], branches: [{ when: eq('seen', 0), updates: [set('p', 1)],
      events: [{ kind: 'crossing', actor: 'p', from: 0, to: 1 }] }] }];
  const solution = oracleSolve(spec);
  assert.equal(solution.solvable, true);
  assert.equal(oracleReplay(spec, oraclePolicyTrace(spec, solution)).accessVerified, true);
});

test('a targeted support ablation preserves the executed prefix and removes only its support', () => {
  const spec = scenario({ goal: eq('p', 2) });
  spec.initial[0].support = 1;
  spec.variables.push({ id: 'support', role: 'support' });
  spec.actions.push({ id: 'finish', kind: 'move',
    requires: { all: [eq('p', 1), eq('support', 1)] }, updates: [set('p', 2)],
    events: [{ kind: 'crossing', actor: 'p', from: 1, to: 2, dependency: 'support' }] });
  const steps = oraclePolicyTrace(spec, oracleSolve(spec));
  const modified = structuredClone(steps);
  modified[1].observation = { values: { p: 1, seen: 0, alive: 1, support: 0 }, feedback: 'blocked' };
  const result = oracleReplay(spec, modified, { intervention: { at: 1, updates: [set('support', 0)] } });
  assert.equal(result.valid, true);
  assert.equal(result.interventionApplied, true);
  assert.equal(result.accessVerified, false);
  assert.equal(result.commands, 2);
  assert.equal(result.crossings, 1);
  assert.deepEqual(result.evidenceIds, ['crossing:0:p']);
  assert.equal(result.finalObservation.values.p, 1);
  const stopped = oracleReplay(spec, steps.slice(0, 1), { intervention: { at: 1, updates: [set('support', 0)] } });
  assert.equal(stopped.interventionApplied, true);
  assert.equal(stopped.commands, 1);
  assert.equal(stopped.goalAtEnd, false);
  assert.equal(stopped.finalObservation.values.support, 0);
});

test('withdrawing one route proof cannot be replaced by silently using its action', () => {
  const spec = scenario();
  const steps = oraclePolicyTrace(spec, oracleSolve(spec));
  const replay = oracleReplay(spec, steps, { intervention: { at: 0, withheldActions: ['cross'] } });
  assert.equal(replay.valid, false);
  assert.equal(replay.firstViolation.reason, 'withheld-route-proof');
  assert.equal(replay.finalObservation.values.p, 0);
});

test('a counterfactual oracle may retain evidence obtained before its checkpoint', () => {
  const spec = scenario({ initial: [{ p: 1, seen: 0, alive: 1 }], actions: [] });
  assert.equal(oracleSolve(spec).solvable, false);
  const retained = oracleSolve(spec, { initialEvidence: true });
  assert.equal(retained.solvable, true);
  assert.equal(retained.worstCommands, 0);
});

for (let familyIndex = 0; familyIndex < families.length; familyIndex++) {
  const family = families[familyIndex];
  test(`independent transition replay agrees with the executed runtime: ${family}`, () => {
    const spec = generateScenario(family, seededDraw(26112807 + familyIndex), { seed: 26112807, index: familyIndex });
    const solution = oracleSolve(spec);
    assert.equal(solution.solvable, true, `fixture must be solvable: ${solution.reason}`);
    for (let world = 0; world < spec.initial.length; world++) {
      const certified = oraclePolicyTrace(spec, solution, { world });
      assert.equal(oracleReplay(spec, certified, { world }).accessVerified, true);
      let state = initialState(spec, world);
      for (const certifiedStep of certified) {
        // Check every alternative action at every certified prefix, including
        // blocked commands, traps and incorrect contact/selection orders.
        for (const action of spec.actions) {
          const actual = stepState(spec, state, action.id);
          const step = { action: action.id, observation: actual.observation };
          const claim = identifyInView(actual.observation.view);
          if (claim !== null) step.identityClaim = claim;
          const isolated = { ...spec, initial: [{ ...state.values }] };
          const replay = oracleReplay(isolated, [step]);
          assert.equal(replay.valid, actual.valid, `${family}: validity of ${action.id}`);
          if (actual.valid) {
            assert.equal(oracleObservationKey(replay.finalObservation), oracleObservationKey(actual.observation));
            assert.equal(replay.crossings, actual.events.filter(event => event.kind === 'crossing').length);
            assert.equal(replay.newObservations, actual.events.filter(event => event.kind === 'observation').length);
          }
        }
        const actual = stepState(spec, state, certifiedStep.action);
        assert.deepEqual(actual.observation, certifiedStep.observation);
        state = actual.state;
      }
    }
  });
}
