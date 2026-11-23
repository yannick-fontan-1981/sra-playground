import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { chooseCoverage, coveragePullPremise, coveragePullReturn, coveragePushPremise, coveragePushReturn,
  hasObservedCoverage, observeCoverage, retainCoverageAfterReset,
  type CoverageLearning, type PullStep } from '../src/sic/observed-coverage.ts';
import { chooseTravelTrial, observeTravel, readTravelGrid, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('placement observes a pair of targets, verifies an irreversible corner and reuses evidence after RESET', async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS02', level: 1 });
  let travel: ObservedTravel | undefined, knowledge: CoverageLearning | undefined, step = 0;
  const command = (id: number): NativeCommand => ({ action_ref: `ACTION${id}`, data: {} });
  async function learn(input: NativeCommand) {
    const before = board.frame, prior = travel, ref = `return:${++step}`;
    board = await game.dispatch({ type: 'action', actionId: Number(input.action_ref.slice(6)) });
    if (board.levelsCompleted) return;
    travel = observeTravel(prior, before, board.frame, input, ref);
    knowledge = observeCoverage(knowledge, prior, travel, before, board.frame, input, ref);
  }
  // The old public replay pushes one piece into a corner after discovering the crossing.
  const replay = [1, 3, 2, 4, 2, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 4, 2, 4, 2, 2];
  for (const [index, action] of replay.entries()) {
    await learn(command(action));
    assert.equal(knowledge?.deadlock, undefined);
    if (index === 8) {
      assert.ok(knowledge && travel);
      assert.equal(knowledge.supports.length, 1);
      assert.equal(knowledge.layout?.marks.length, 2);
    }
  }
  for (let i = 0; i < 6 && !knowledge?.deadlock; i++) {
    const probe = chooseCoverage(knowledge, travel, board.frame);
    assert.ok(probe?.verifyBarrier);
    await learn(probe.command);
  }
  assert.ok(knowledge?.deadlock && travel);
  assert.ok(Object.values(knowledge.walls).some(positions => new Set(positions).size >= 2));
  const blocked = knowledge.deadlock.key;
  board = await game.dispatch({ type: 'reset' });
  assert.equal(board.levelsCompleted, 0);
  knowledge = retainCoverageAfterReset(knowledge);
  assert.equal(knowledge.supports.length, 0);
  assert.deepEqual(knowledge.recovered, [blocked]);
  const player = readTravelGrid(board.frame, travel.grid).pieces[0]!;
  travel = { ...travel, actor: player, visited: [player], tested: {}, stalled: 0 };

  let covered = false, checkedPrefix = false;
  for (let i = 0; i < 45 && !board.levelsCompleted; i++) {
    const plan = chooseCoverage(knowledge, travel, board.frame);
    const input = plan?.command ?? chooseTravelTrial(travel, board.frame, board.availableActionIds.map(command), false)?.command;
    assert.ok(input && !plan?.verifyBarrier);
    covered ||= plan?.covered === true;
    const prefix = plan?.pushSeries;
    if (!checkedPrefix && prefix && knowledge && travel) {
      const first = prefix[0]!, before = board.frame, measured = knowledge, traveller = travel;
      assert.ok(coveragePushPremise(measured, traveller, before, first));
      const changed = before.map(row => [...row]), [x, y] = first.landing.split(',').map(Number) as [number, number];
      changed[y]![x] = (changed[y]![x]! + 1) % 16;
      assert.equal(coveragePushPremise(measured, traveller, changed, first), false);
      await learn(input);
      assert.ok(coveragePushReturn(measured, traveller, before, board.frame, first));
      assert.equal(coveragePushReturn(measured, traveller, before, before, first), false);
      checkedPrefix = true;
      continue;
    }
    await learn(input);
    assert.equal(knowledge?.deadlock, undefined);
  }
  assert.ok(covered);
  assert.ok(checkedPrefix);
  assert.equal(board.levelsCompleted, 1);
});

for (const mirrored of [false, true]) test(`a measured pull binds guarded series with a different palette${mirrored ? ' and mirrored geometry' : ''}`, async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS03', level: 1 });
  let travel: ObservedTravel | undefined, knowledge: CoverageLearning | undefined, step = 0;
  const recolor = (rows: typeof board.frame) => rows.map(row => (mirrored ? [...row].reverse() : row).map(ink => (ink + 5) % 16));
  async function learn(actionId: number, route?: readonly PullStep[], acceptReturn = (_before: number[][], _after: number[][]) => true) {
    const before = recolor(board.frame), prior = travel, ref = `return:${++step}`;
    const command = { action_ref: `ACTION${actionId}`, data: {} };
    board = await game.dispatch({ type: 'action', actionId });
    if (board.levelsCompleted) return true;
    const after = recolor(board.frame);
    const matched = acceptReturn(before, after);
    travel = observeTravel(prior, before, after, command, ref);
    knowledge = observeCoverage(knowledge, prior, travel, before, after, command, ref, route, matched);
    return matched;
  }
  const beforeFirstPull = [
    1, 3, 2, 4, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 2, 2, 1, 3, 2, 1, 3, 2, 2, 4,
    4, 2, 2, 3, 1, 3, 1, 1, 1, 1, 1, 3, 3, 1, 1, 3, 2, 3, 1, 3, 1, 4, 2, 4, 4, 1, 3,
  ];
  for (const action of beforeFirstPull) {
    await learn(action);
    assert.equal(knowledge?.motion, undefined);
  }
  await learn(4);
  assert.equal(knowledge?.motion, 'pull');
  assert.equal(knowledge?.lastPull?.ref, 'return:55');
  assert.equal(knowledge?.layout?.marks.length, 3);
  assert.equal(hasObservedCoverage(knowledge, travel, recolor(board.frame)), false);
  let covered = false, checkedGate = false, checkedPulls = false;
  for (let i = 0; i < 65 && !board.levelsCompleted; i++) {
    const rows = recolor(board.frame);
    const route = chooseCoverage(knowledge, travel, rows);
    assert.ok(route?.motion === 'pull' && route.pullRoute?.length);
    if (route.covered) {
      covered = true;
      assert.ok(hasObservedCoverage(knowledge, travel, recolor(board.frame)));
    }
    const bound = route.pullSeries;
    if (!bound) {
      await learn(Number(route.command.action_ref.slice(6)), route.pullRoute);
      continue;
    }
    const measuredCoverage = knowledge!, measuredTravel = travel!;
    let changedGate: ((frame: number[][]) => number[][]) | undefined;
    if (!checkedGate) {
      const [x, y] = bound.gates[0]!.cell.split(',').map(Number) as [number, number];
      changedGate = frame => frame.map((row, j) => j !== y ? row : row.map((ink, k) => k === x ? (ink + 1) % 16 : ink));
      assert.equal(coveragePullPremise(measuredCoverage, measuredTravel, changedGate(rows), bound, 0), false);
      const first = bound.steps[0]!;
      const [bx, by] = first.before.arrangement.split(';')[0]!.split(',').map(Number) as [number, number];
      const changedBody = rows.map((row, j) => j !== by ? row : row.map((ink, k) => k === bx ? (ink + 1) % 16 : ink));
      assert.equal(coveragePullPremise(measuredCoverage, measuredTravel, changedBody, bound, 0), false);
    }
    let previousPull = false;
    for (const [index, movement] of bound.steps.entries()) {
      assert.ok(coveragePullPremise(measuredCoverage, measuredTravel, recolor(board.frame), bound, index));
      const matched = await learn(Number(movement.command.action_ref.slice(6)), route.pullRoute.slice(index),
        (before, after) => {
          const match = coveragePullReturn(measuredCoverage, measuredTravel, before, after, bound, index);
          if (match && changedGate && !checkedGate) {
            const altered = changedGate(after);
            assert.equal(coveragePullReturn(measuredCoverage, measuredTravel, before, altered, bound, index), false);
            const command = movement.command, observed = observeTravel(measuredTravel, before, altered, command, 'changed-gate');
            const acquired = observeCoverage(measuredCoverage, measuredTravel, observed, before, altered, command, 'changed-gate',
              route.pullRoute.slice(index), false);
            assert.equal(acquired?.pullRoute, undefined);
            assert.deepEqual(acquired?.pullRefusals, measuredCoverage.pullRefusals);
            checkedGate = true;
          }
          return match;
        });
      if (!matched || board.levelsCompleted) break;
      const pulled = movement.before.arrangement !== movement.after.arrangement;
      checkedPulls ||= previousPull && pulled;
      previousPull = pulled;
    }
  }
  assert.ok(covered);
  assert.ok(checkedGate);
  assert.ok(checkedPulls);
  assert.equal(board.levelsCompleted, 1);
});
