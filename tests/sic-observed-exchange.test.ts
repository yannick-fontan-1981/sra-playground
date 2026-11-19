import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { assessExchange, chooseExchange, observeExchange, type ExchangePlan, type ObservedExchange } from '../src/sic/observed-exchange.ts';
import { observeTravel, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('position exchange learns both participants and composes with transport and a reflected route', async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS04', level: 1 });
  let travel: ObservedTravel | undefined, exchange: ObservedExchange | undefined, count = 0;
  const picture = (rows: typeof board.frame) => rows.map(row => [...row].reverse().map(ink => (ink + 5) % 16));
  async function learn(actionId: number, plan?: ExchangePlan) {
    const prior = travel, before = picture(board.frame), ref = `return:${++count}`;
    const command = { action_ref: `ACTION${actionId}`, data: {} };
    board = await game.dispatch({ type: 'action', actionId });
    if (board.levelsCompleted) return;
    const after = picture(board.frame);
    const returned = plan && assessExchange(exchange, prior, before, after, plan);
    travel = observeTravel(prior, before, after, command, ref);
    exchange = observeExchange(exchange, prior, travel, before, after, command, ref, board.frames.map(picture), plan?.prediction);
    return returned;
  }
  // Public actions from a run before exchange reasoning was available.
  const beforeFirstExchange = [
    1, 3, 2, 4, 1, 1, 1, 4, 1, 1, 4, 4, 2, 4, 1, 2, 2, 2, 1, 3, 2, 2, 4, 2, 2, 1, 3, 1,
  ];
  for (const input of beforeFirstExchange) {
    await learn(input);
    assert.equal(exchange, undefined);
  }
  await learn(3);
  assert.equal(exchange?.last.ref, 'return:29');
  assert.notEqual(exchange?.last.from, exchange?.last.to);
  assert.deepEqual(exchange?.last.turns, []);

  let sawTransport = false, sawReflection = false;
  for (let i = 0; i < 55 && !board.levelsCompleted; i++) {
    const plan = chooseExchange(exchange, travel, picture(board.frame));
    assert.ok(plan);
    const returned = await learn(Number(plan.command.action_ref.slice(6)), plan);
    if (plan.goal === 'test_transport' && returned?.satisfied) sawTransport = true;
    sawReflection ||= !!exchange?.last.turns.length;
  }
  assert.ok(sawTransport);
  assert.ok(sawReflection);
  assert.equal(board.levelsCompleted, 1);
});
