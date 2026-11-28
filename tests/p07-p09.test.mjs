import assert from 'node:assert/strict';
import test from 'node:test';
import { planFrozen, frozenSource } from '../scripts/p07-access/frozen.mjs';
import { planAccess } from '../scripts/p07-access/candidate.mjs';
import { executePolicy } from '../scripts/p07-access/runtime.mjs';
import { issueAccessReceipt, resumeP09, runP09 } from '../scripts/p07-access/p09.mjs';
import { auditP09, certifyP09 } from '../scripts/p07-access/p09-audit.mjs';

const equal = (variable, value) => ({ variable, eq: value });
const always = { all: [] };

function fixture() {
  const move = (id, from, to, updates = []) => ({
    id, kind: 'move', requires: equal('position', from),
    updates: [{ variable: 'position', set: to }, ...updates],
    events: [{ kind: 'crossing', actor: 'position', from, to, dependency: `route:${from}:${to}` }],
  });
  return {
    protocol: 'sic-p07-access-v1', id: 'p09-fixture', family: 'fixture', seed: 0,
    initial: [{ position: 0, reserve: 1, alive: 1 }],
    variables: [{ id: 'position', role: 'traveler-position' }, { id: 'reserve', role: 'parent-reserve' },
      { id: 'alive', role: 'alive' }],
    actions: [move('shortcut', 0, 2, [{ variable: 'reserve', set: 0 }]),
      move('safe-a', 0, 1), move('safe-b', 1, 2)],
    goal: equal('position', 2), invariant: equal('alive', 1), parentInvariant: { variable: 'reserve', min: 1 },
    budget: { commands: 5, states: 500 }, structure: { fixture: true },
    presentation: { rotation: 0, offset: [0, 0], palette: [0, 1] },
  };
}

test('the frozen arm imports the exact historical composer and keeps its shortest conformant sequence', () => {
  const spec = fixture();
  assert.equal(frozenSource.revision, '20433007224accc36e3d7976696d9ee7a783a227');
  assert.equal(frozenSource.gitBlob, 'f54a624abaaa89e4d5363f41869017f4e7f99b35');
  const direct = planFrozen(spec);
  assert.equal(direct.status, 'solved');
  assert.deepEqual(direct.commands, ['shortcut']);
  assert.equal(executePolicy(spec, direct.policy).accessVerified, true);
  const preserved = planFrozen(spec, { parent: true });
  assert.deepEqual(preserved.commands, ['safe-a', 'safe-b']);
  assert.equal(executePolicy(spec, preserved.policy, { parent: true }).accessVerified, true);
});

test('P09 requests the access with its invariant, consumes a played receipt and resumes its parent', () => {
  const result = runP09(fixture());
  assert.equal(result.requested, true);
  assert.equal(result.request.primitive, 'P07');
  assert.equal(result.accessVerified, true);
  assert.equal(result.receipt.invariantPreserved, true);
  assert.deepEqual(result.execution.steps.map(step => step.action), ['safe-a', 'safe-b']);
  assert.equal(result.completed, true);
  assert.equal(result.parentResumed, true);
  assert.equal(result.parentCommands, 1);
  assert.equal(result.commands, 3);
  assert.equal(result.officialWins, 0);
  assert.equal(result.nativeVictories, 0);
});

test('a predicted goal, a forged receipt and a fabricated final state cannot authorize the parent', () => {
  const spec = fixture();
  const result = runP09(spec);
  assert.equal(resumeP09(spec, { ...result.receipt, traceHash: 'unplayed-prediction' }, result.execution).completed, false);
  const fabricated = { ...result.execution, steps: [], commands: 0 };
  assert.equal(issueAccessReceipt(spec, fabricated), null);
  assert.equal(resumeP09(spec, result.receipt, fabricated).completed, false);
  const changedFinal = { ...result.execution,
    finalState: { ...result.execution.finalState, values: { ...result.execution.finalState.values, position: 1 } } };
  assert.equal(issueAccessReceipt(spec, changedFinal), null);
});

test('access that consumed the parent reserve is not an admissible subgoal receipt', () => {
  const spec = fixture();
  const shortcut = executePolicy(spec, planAccess(spec).policy);
  assert.equal(shortcut.accessVerified, true);
  assert.equal(shortcut.finalState.values.reserve, 0);
  assert.equal(issueAccessReceipt(spec, shortcut), null);
});

test('the parent interaction counts against the same primitive gesture ceiling', () => {
  const spec = fixture();
  spec.budget.commands = 2;
  const result = runP09(spec);
  assert.equal(result.completed, false);
  assert.equal(result.reason, 'access-policy-unavailable');
  assert.ok(result.commands <= spec.budget.commands);
});

test('the parent rechecks an invariant that expires after access and before its own interaction', () => {
  const spec = fixture();
  spec.initial[0].window = 2;
  spec.variables.push({ id: 'window', role: 'window', timer: true });
  spec.parentInvariant = { variable: 'window', min: 1 };
  const result = runP09(spec);
  assert.equal(result.accessVerified, true);
  assert.equal(result.completed, false);
  assert.equal(result.reason, 'parent-invariant-or-guard');
  assert.equal(result.parentCommands, 0);
});

test('hidden alternatives permit observational policy gains without weakening the frozen deterministic composer', () => {
  const spec = fixture();
  spec.initial = [0, 1].map(hidden => ({ position: 0, reserve: 1, alive: 1, hidden, measured: 0 }));
  spec.variables.push({ id: 'hidden', role: 'hidden-route', hidden: true, visibleWhen: equal('measured', 1) },
    { id: 'measured', role: 'route-observation' });
  spec.actions = [{ id: 'observe', kind: 'observe', requires: equal('measured', 0),
    updates: [{ variable: 'measured', set: 1 }],
    events: [{ kind: 'observation', subject: 'route', variable: 'measured' }] },
  ...[0, 1].map(choice => ({ id: `cross-${choice}`, kind: 'move', requires: equal('position', 0), updates: [],
    branches: [{ when: equal('hidden', choice), updates: [{ variable: 'position', set: 2 }],
      events: [{ kind: 'crossing', actor: 'position', from: 0, to: 2, dependency: `route:${choice}` }] },
    { when: { not: equal('hidden', choice) }, updates: [{ variable: 'alive', set: 0 }] }] }))];
  spec.parentInvariant = always;
  assert.equal(planFrozen(spec).policy, null);
  const candidate = planAccess(spec);
  assert.ok(candidate.policy);
  for (let world = 0; world < 2; world++) {
    const played = executePolicy(spec, candidate.policy, { world });
    assert.equal(played.accessVerified, true);
    assert.equal(played.commands, 2);
    assert.equal(played.steps[0].action, 'observe');
  }
});

test('already distinct initial observations permit different frozen plans under one cumulative state budget', () => {
  const spec = fixture();
  spec.initial = [0, 1].map(route => ({ position: 0, reserve: 1, alive: 1, route }));
  spec.variables.push({ id: 'route', role: 'public-route-indicator' });
  spec.actions = [0, 1].map(route => ({ id: `visible-route-${route}`, kind: 'move',
    requires: { all: [equal('position', 0), equal('route', route)] },
    updates: [{ variable: 'position', set: 2 }],
    events: [{ kind: 'crossing', actor: 'position', from: 0, to: 2 }] }));
  for (const planner of [planFrozen, planAccess]) {
    const plan = planner(spec);
    assert.equal(plan.status, 'solved');
    assert.equal(Object.keys(plan.policy.initialBranches).length, 2);
    for (let world = 0; world < 2; world++) {
      const played = executePolicy(spec, plan.policy, { world });
      assert.equal(played.accessVerified, true);
      assert.equal(played.commands, 1);
      assert.equal(played.steps[0].action, `visible-route-${world}`);
    }
  }
  const tooSmall = planFrozen({ ...spec, budget: { ...spec.budget, states: 3 } });
  assert.equal(tooSmall.policy, null);
  assert.equal(tooSmall.explored, 3);
  assert.equal(tooSmall.status, 'state-budget-exhausted');
  const justEnough = planFrozen({ ...spec, budget: { ...spec.budget, states: 4 } });
  assert.equal(justEnough.status, 'solved');
  assert.equal(justEnough.explored, 4);
});

test('a blocked command can spend time until a timed route becomes available', () => {
  const spec = fixture();
  spec.initial = [{ position: 0, reserve: 1, alive: 1, cooldown: 2 }];
  spec.variables.push({ id: 'cooldown', role: 'time-until-opening', timer: true });
  spec.actions = [
    { id: 'blocked-pulse', kind: 'interact', requires: equal('position', 99), updates: [] },
    { id: 'cross-when-ready', kind: 'move', requires: { all: [equal('position', 0), equal('cooldown', 0)] },
      updates: [{ variable: 'position', set: 2 }],
      events: [{ kind: 'crossing', actor: 'position', from: 0, to: 2 }] },
  ];
  spec.budget.commands = 3;
  for (const planner of [planFrozen, planAccess]) {
    const plan = planner(spec);
    assert.equal(plan.status, 'solved');
    const played = executePolicy(spec, plan.policy);
    assert.equal(played.accessVerified, true);
    assert.equal(played.commands, 3);
    assert.equal(played.crossings, 1);
    assert.deepEqual(played.steps.map(step => step.observation.feedback), ['blocked', 'blocked', 'ok']);
  }
});

test('the independent oracle certifies and replays access plus the actual parent command', () => {
  const spec = fixture();
  const certificate = certifyP09(spec);
  assert.equal(certificate.solvable, true);
  assert.equal(certificate.worstCommands, 3);
  assert.ok(certificate.certificateHash);
  assert.equal(certificate.worlds[0].parentCommands, 1);
  const result = runP09(spec), audit = auditP09(spec, result);
  assert.equal(audit.valid, true);
  assert.equal(audit.completed, true);
  assert.equal(audit.commands, 3);
  assert.equal(audit.reportedCommandsMatch, true);
  assert.equal(audit.officialWins, 0);
});

test('the independent parent audit rejects an omitted parent action or a falsified physical ledger', () => {
  const spec = fixture(), result = runP09(spec);
  const missing = auditP09(spec, { ...result, parentStep: null });
  assert.equal(missing.completed, false);
  assert.equal(missing.goalAtEnd, false);
  const ledger = auditP09(spec, { ...result, commands: 1 });
  assert.equal(ledger.completed, false);
  assert.equal(ledger.reportedCommandsMatch, false);
  const corrupted = structuredClone(result);
  corrupted.parentStep.observation.values.reserve = 0;
  const audit = auditP09(spec, corrupted);
  assert.equal(audit.valid, false);
  assert.equal(audit.completed, false);
});

test('a feasible access does not certify an infeasible full parent trajectory', () => {
  const spec = fixture();
  spec.initial[0].window = 2;
  spec.variables.push({ id: 'window', role: 'window', timer: true });
  spec.parentInvariant = { variable: 'window', min: 1 };
  const result = runP09(spec);
  assert.equal(result.accessVerified, true);
  assert.equal(certifyP09(spec).solvable, false);
  assert.equal(auditP09(spec, result).completed, false);
});
