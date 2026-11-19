import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { assessPressurePlan, choosePressureReserve, observePressureReserve, retainPressureReserve,
  type PressurePlan, type PressureReserve } from '../src/sic/observed-pressure-reserve.ts';
import { annotateTravelMarks, observedTravelActor, observeTravel, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('a proved shortage restores a movable weight, then the other piece becomes the crossing', async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS05', level: 1 });
  let travel: ObservedTravel | undefined, model: PressureReserve | undefined, sequence = 0;
  const picture = (rows: typeof board.frame) => rows.map(row => row.map(ink => (ink + 5) % 16));
  const input = (id: number): NativeCommand => ({ action_ref: `ACTION${id}`, data: {} });
  const inputs = board.availableActionIds.map(input);
  async function move(command: NativeCommand, plan?: PressurePlan) {
    const before = picture(board.frame), ref = `return:${++sequence}`;
    board = await game.dispatch({ type: 'action', actionId: Number(command.action_ref.slice(6)) });
    if (board.levelsCompleted) return;
    const after = picture(board.frame);
    if (plan && model && travel) assert.equal(assessPressurePlan(model, travel, after, plan), true);
    travel = annotateTravelMarks(observeTravel(travel, before, after, command, ref), before);
    model = observePressureReserve(model, travel, before, after, command, ref, plan);
  }
  for (const action of [1, 2, 3, 4, 2, 4, 1, 1, 1, 1, 3, 3, 3]) {
    await move(input(action));
    assert.equal(model?.shortage, undefined);
  }
  assert.ok(model?.gate && model.bridge && travel);
  const release = choosePressureReserve(model, travel, picture(board.frame), inputs);
  assert.ok(release?.goal === 'verify_gate_release');
  await move(release.command, release);
  assert.equal(model?.shortage, 'return:14');

  board = await game.dispatch({ type: 'reset' });
  model = retainPressureReserve(model!);
  assert.equal(model.shortage, undefined);
  const actor = observedTravelActor(travel, picture(board.frame))!;
  travel = { ...travel, actor, visited: [actor], supports: [], tested: {}, altered: [], controls: [], completed: [], switches: {}, stalled: 0 };
  let crossed = false;
  for (let i = 0; i < 45 && !board.levelsCompleted; i++) {
    const plan = choosePressureReserve(model, travel, picture(board.frame), inputs);
    assert.ok(plan);
    if (plan.goal === 'cross_to_exit') {
      assert.ok(plan.expected.pieces.includes(model!.gate!.mark));
      crossed ||= plan.expected.supports.includes(plan.expected.actor);
    }
    await move(plan.command, plan);
    assert.equal(model?.shortage, undefined);
  }
  assert.ok(crossed);
  assert.equal(board.levelsCompleted, 1);
});
