import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { chooseCoverage, observeCoverage, retainCoverageAfterReset, type CoverageLearning } from '../src/sic/observed-coverage.ts';
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

  let covered = false;
  for (let i = 0; i < 45 && !board.levelsCompleted; i++) {
    const plan = chooseCoverage(knowledge, travel, board.frame);
    const input = plan?.command ?? chooseTravelTrial(travel, board.frame, board.availableActionIds.map(command), false)?.command;
    assert.ok(input && !plan?.verifyBarrier);
    covered ||= plan?.covered === true;
    await learn(input);
    assert.equal(knowledge?.deadlock, undefined);
  }
  assert.ok(covered);
  assert.equal(board.levelsCompleted, 1);
});
