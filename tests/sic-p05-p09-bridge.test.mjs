import assert from 'node:assert/strict';
import test from 'node:test';
import { composePlan } from '../src/sic/effect-composer.ts';
import { buildP05CompositionProblem, verifyP05Composition } from '../scripts/sic-p05-p09-bridge.mjs';

const initial = () => ({ selected: 'carrier', subjects: [{ id: 'carrier', position: [4, 7] }],
  context: { terrain: 'mat', phase: 1 }, reserve: 6, remote: 0, tick: 0 });
const acquisition = overrides => ({ effectId: 'effect:measured', command: 'unlabelled-c', receiver: 'selected',
  delta: [3, 0], delay: 0, resourceCost: 1, remoteDelta: 0,
  conditions: [{ field: 'terrain', equals: 'mat' }],
  supportingReturnIds: ['return:link'], limitingReturnIds: ['return:boundary'], status: 'restricted', ...overrides });
const scene = overrides => ({ initial: initial(), support: { subjectId: 'carrier', position: [7, 7] },
  deliveryResourceCost: 2, budget: { commands: 16, states: 2048 }, ...overrides });

// A separate execution law: no P09 contract/projector and no acquired result.
function physicalExecutor({ dx = 3, dy = 0, delay = 0, cost = 1, receiver = 'carrier', phase = null,
  period = null, terrain = 'mat', drift = false } = {}) {
  let queued = null;
  let calls = 0;
  const execute = (before, action) => {
    calls++;
    assert.deepEqual(Object.keys(action).sort(), action.kind === 'wait' ? ['kind'] : ['command', 'kind']);
    const after = structuredClone(before);
    after.tick = before.tick + 1;
    if (period !== null) after.context.phase = (before.context.phase + 1) % period;
    if (queued) {
      queued.left--;
      if (!queued.left) {
        const actual = after.subjects.find(subject => subject.id === queued.subject);
        actual.position[0] += queued.x;
        actual.position[1] += queued.y;
        queued = null;
      }
    }
    if (action.kind === 'command' && action.command === 'unlabelled-c' && before.reserve >= cost
      && before.context.terrain === terrain && (phase === null || before.context.phase === phase)) {
      after.reserve -= cost;
      if (delay) queued = { left: delay, x: dx, y: dy, subject: receiver };
      else {
        const actual = after.subjects.find(subject => subject.id === receiver);
        actual.position[0] += dx;
        actual.position[1] += dy;
      }
    }
    if (drift && before.tick >= 2) after.subjects[0].position[0] += 1;
    return after;
  };
  execute.calls = () => calls;
  return execute;
}

test('P09 uses measured movement to hold a support through a different cargo mechanism', () => {
  const execute = physicalExecutor();
  const result = verifyP05Composition({ scene: scene(), acquisition: acquisition(),
    availableReturnIds: ['return:link', 'return:boundary'], executeCommand: execute });
  assert.equal(result.success, true);
  assert.equal(result.commands, 5);
  assert.equal(execute.calls(), result.commands);
  assert.deepEqual(result.plan.map(entry => entry.action.kind),
    ['prepare-relay', 'command', 'charge-relay', 'load-cargo', 'deliver-cargo']);
  assert.equal(result.usedEffectId, 'effect:measured');
  assert.deepEqual(result.usedEvidenceIds, ['return:link']);
  assert.deepEqual(result.consumedConditions, [{ field: 'terrain', equals: 'mat' }]);
  assert.equal(result.returns.at(-1).observation.reserve, 3);
  assert.deepEqual(result.native, { tested: 0, wins: 0 });
});

test('removing only the linking return disables movement, preserving the public scene and relay offers', () => {
  const publicScene = scene();
  const before = JSON.stringify(publicScene);
  const execute = physicalExecutor();
  const result = verifyP05Composition({ scene: publicScene, acquisition: acquisition(),
    availableReturnIds: ['return:boundary'], executeCommand: execute });
  assert.equal(result.planned, false);
  assert.equal(result.success, false);
  assert.equal(execute.calls(), 0);
  assert.equal(JSON.stringify(publicScene), before);
  const problem = buildP05CompositionProblem({ scene: publicScene, acquisition: acquisition(),
    availableReturnIds: ['return:boundary'] });
  assert.deepEqual([...problem.choices(problem.initial)].map(entry => entry.action.kind), ['prepare-relay']);
});

test('planner has no physical executor and cannot ask hidden law for its choices', () => {
  const execute = physicalExecutor();
  const problem = buildP05CompositionProblem({ scene: scene(), acquisition: acquisition(),
    availableReturnIds: ['return:link'], executeCommand: execute });
  assert.ok(composePlan(problem));
  assert.equal(execute.calls(), 0);
});

test('a wrong acquired delta does not move the support target and fails independent replay', () => {
  const publicScene = scene({ support: { subjectId: 'carrier', position: [10, 7] } });
  const result = verifyP05Composition({ scene: publicScene, acquisition: acquisition({ delta: [6, 0] }),
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor() });
  assert.equal(result.planned, true);
  assert.equal(result.success, false);
  assert.match(result.firstMismatch.reason, /subject position/);
  assert.deepEqual(publicScene.support.position, [10, 7]);
});

test('conditions really constrain use in the second mechanic', () => {
  const different = initial();
  different.context.terrain = 'ice';
  const result = verifyP05Composition({ scene: scene({ initial: different }), acquisition: acquisition(),
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor({ terrain: 'ice' }) });
  assert.equal(result.planned, false);
});

test('a phase-dependent delayed command is combined with waiting and support maintenance', () => {
  const effect = acquisition({ delay: 3, conditions: [{ field: 'phase', equals: 2 }] });
  const timedScene = scene({ clock: { field: 'phase', period: 4 } });
  const result = verifyP05Composition({ scene: timedScene, acquisition: effect,
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor({ delay: 3, phase: 2, period: 4 }) });
  assert.equal(result.success, true);
  assert.ok(result.plan.some(entry => entry.action.kind === 'wait'));
  assert.equal(result.returns.find(entry => entry.action.kind === 'command').observation.context.phase, 3);
  assert.deepEqual(result.returns.at(-1).observation.subjects[0].position, [7, 7]);
  assert.deepEqual(result.consumedConditions, [{ field: 'phase', equals: 2 }]);
});

test('same geometry with insufficient reserve cannot fund both the acquired effect and delivery', () => {
  const poor = initial();
  poor.reserve = 3;
  const result = verifyP05Composition({ scene: scene({ initial: poor }),
    acquisition: acquisition({ resourceCost: 2 }), availableReturnIds: ['return:link'],
    executeCommand: physicalExecutor({ cost: 2 }) });
  assert.equal(result.planned, false);
});

test('underestimated resource cost is found at the first independent command return', () => {
  const result = verifyP05Composition({ scene: scene(), acquisition: acquisition(),
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor({ cost: 2 }) });
  assert.equal(result.planned, true);
  assert.equal(result.success, false);
  assert.equal(result.firstMismatch.reason, 'reserve');
});

test('a wrong receiver is observable even if another body makes the expected movement', () => {
  const publicScene = scene();
  publicScene.initial.subjects.push({ id: 'rival', position: [1, 2] });
  const result = verifyP05Composition({ scene: publicScene, acquisition: acquisition(),
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor({ receiver: 'rival' }) });
  assert.equal(result.success, false);
  assert.match(result.firstMismatch.reason, /subject position: carrier/);
});

test('an observed loss of support stops the cargo chain', () => {
  const result = verifyP05Composition({ scene: scene(), acquisition: acquisition(),
    availableReturnIds: ['return:link'], executeCommand: physicalExecutor({ drift: true }) });
  assert.equal(result.success, false);
  assert.equal(result.firstMismatch.reason, 'support lost during cargo transition');
  assert.equal(result.returns.some(entry => entry.action.kind === 'deliver-cargo'), false);
});

test('an unconfirmed recall and an absent acquisition cannot license P09 movement', () => {
  for (const effect of [acquisition({ status: 'recalled' }), null]) {
    const result = verifyP05Composition({ scene: scene(), acquisition: effect,
      availableReturnIds: ['return:link'], executeCommand: physicalExecutor() });
    assert.equal(result.planned, false);
  }
});

test('the command budget includes preparation, waits and cargo actions', () => {
  const result = verifyP05Composition({ scene: scene({ budget: { commands: 4, states: 2048 } }),
    acquisition: acquisition(), availableReturnIds: ['return:link'], executeCommand: physicalExecutor() });
  assert.equal(result.planned, false);
});
