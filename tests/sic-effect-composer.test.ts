import assert from 'node:assert/strict';
import test from 'node:test';
import { composePlan, type ComposableEffect, type CompositionProblem } from '../src/sic/effect-composer.ts';

type Pose = { actor: 'bank' | 'exit'; weight: 'plate' | 'bank'; ticks: number };
const opening = { relation: 'the plate is occupied within the window', holds: (pose: Pose) => pose.weight === 'plate' && pose.ticks > 0 };
const reached = { relation: 'actor reaches the other bank', holds: (pose: Pose) => pose.actor === 'exit' };
const key = ({ actor, weight, ticks }: Pose) => [actor, weight, ticks].join('/');

function crossing(before: Pose, expireDuring = false): ComposableEffect<Pose, string> {
  return {
    action: 'cross',
    after: { ...before, actor: 'exit', ticks: before.ticks - 1 },
    during: expireDuring ? [{ ...before, ticks: 0 }] : [],
    maintains: [opening],
    ensures: [reached],
    evidence: ['plate-observed', 'window-observed'],
  };
}

function search(initial: Pose, expireDuring = false, budget = { commands: 2, states: 4 }) {
  return composePlan<Pose, string>({
    initial, key, goal: reached, budget,
    *choices(before) {
      yield crossing(before, expireDuring);
      if (before.weight === 'bank') {
        yield { action: 'reserve', after: { ...before, weight: 'plate' }, ensures: [opening], evidence: ['weight-observed'] };
      }
    },
  });
}

test('composes a required preparation with a crossing that keeps the opening', () => {
  const plan = search({ actor: 'bank', weight: 'bank', ticks: 2 });
  assert.equal(plan?.explored, 3);
  assert.deepEqual(plan?.effects.map(effect => [effect.action, effect.evidence]), [
    ['reserve', ['weight-observed']],
    ['cross', ['plate-observed', 'window-observed']],
  ]);
  assert.equal(plan?.end.weight, 'plate');
  assert.equal(search({ actor: 'bank', weight: 'bank', ticks: 2 }, false, { commands: 1, states: 4 }), undefined);
});

test('a crossing with an expired window is refused at the start, during, or at the end', () => {
  const pose: Pose = { actor: 'bank', weight: 'plate', ticks: 2 };
  assert.deepEqual(search(pose)?.effects.map(effect => effect.action), ['cross']);
  assert.equal(search({ ...pose, ticks: 0 }), undefined);
  assert.equal(search(pose, true), undefined);
  assert.equal(search({ ...pose, ticks: 1 }), undefined);
});

test('requires and ensures reject edges before deduplication and tied choices retain the caller order', () => {
  const initial: Pose = { actor: 'bank', weight: 'plate', ticks: 2 };
  const move = crossing(initial);
  const never = { relation: 'absent evidence', holds: () => false };
  const choices = [{ ...move, action: 'missing', requires: [never] }, { ...move, action: 'invalid', ensures: [never] },
    { ...move, action: 'first' }, { ...move, action: 'second' }];
  const solve = (choicesInOrder: typeof choices, states: number) => composePlan({
    initial, key, goal: reached, budget: { commands: 1, states }, choices: () => choicesInOrder,
  });
  assert.equal(solve(choices, 1), undefined);
  assert.equal(solve(choices, 2)?.effects[0]?.action, 'first');
  assert.equal(solve(choices.toReversed(), 2)?.effects[0]?.action, 'second');
});

test('the state ceiling counts positions examined in breadth-first order', () => {
  const problem: CompositionProblem<number, number> = {
    initial: 0, key: value => value, goal: { relation: 'reach third position', holds: value => value === 2 },
    choices: () => [{ action: 1, after: 1 }, { action: 2, after: 2 }],
    budget: { commands: 1, states: 2 },
  };
  assert.equal(composePlan(problem), undefined);
  assert.equal(composePlan({ ...problem, budget: { commands: 1, states: 3 } })?.explored, 3);
});
