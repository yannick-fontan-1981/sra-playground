import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { annotateTravelMarks, chooseAnnotatedMarkContact, observedTravelActor, observeTravel,
  type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('measured directions reach both decorated marks and keep tracking the actor on contact', async () => {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS05', level: 1 });
  let travel: ObservedTravel | undefined, revision = 0;
  const picture = (rows: typeof board.frame) => rows.map(row => row.map(ink => (ink + 5) % 16));
  const commands = board.availableActionIds.map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  async function move(input: NativeCommand) {
    const before = picture(board.frame);
    board = await game.dispatch({ type: 'action', actionId: Number(input.action_ref.slice(6)) });
    const after = picture(board.frame);
    const actor = observedTravelActor(travel, after);
    travel = annotateTravelMarks(observeTravel(travel, before, after, input, `return:${++revision}`), before);
    return actor;
  }
  for (const command of commands.filter(input => /^ACTION[1-4]$/.test(input.action_ref))) await move(command);
  const marked = Object.keys(travel?.grid.annotatedMarks ?? {});
  assert.equal(marked.length, 2);

  const reached = new Set<string>();
  for (let i = 0; i < 16 && reached.size < marked.length; i++) {
    const plan = chooseAnnotatedMarkContact(travel, picture(board.frame), commands);
    assert.ok(plan);
    const actor = await move(plan.command);
    assert.equal(actor, plan.expected);
    if (actor === plan.target) reached.add(actor);
  }
  assert.deepEqual([...reached].sort(), marked.sort());
  assert.equal(chooseAnnotatedMarkContact(travel, picture(board.frame), commands), undefined);
});
