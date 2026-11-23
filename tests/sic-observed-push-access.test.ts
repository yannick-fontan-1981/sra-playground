import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeCommand, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import type { CoverageTransfer } from '../src/sic/observed-coverage.ts';
import { choosePushAccess, matchesPushAccess, observePushAccess, type PushAccessKnowledge } from '../src/sic/observed-push-access.ts';
import { observeTravel, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';

const input = (id: number): NativeCommand => ({ action_ref: `ACTION${id}`, data: {} });
const inputs = [1, 2, 3, 4].map(input);
const prefix = [2, 2, 4, 2, 1, 3, 2, 4, 1, 4, 3, 2, 2, 4, 1, 1, 3, 3, 4, 4, 2, 4, 4];

for (const mirrored of [false, true]) {
  test(`learned pushing preserves access to the marked destination${mirrored ? ' after mirroring and recoloring' : ''}`, async () => {
    const game = createGameDispatcher(async () => { throw new Error('Expected the native game'); });
    let board = await game.dispatch({ type: 'load', code: 'SS02', level: 2 });
    let travel: ObservedTravel | undefined, knowledge: PushAccessKnowledge | undefined;
    const ink = (n: number) => mirrored ? (n + 5) % 16 : n;
    const observed = (rows: NativeRows) => mirrored ? rows.map(row => [...row].reverse().map(ink)) : rows;
    const transfer: CoverageTransfer = { epoch: 1, motion: 'push', ref: 'prior-observed-score',
      exitPattern: [11, 11, 11, 11, 3, 11, 11, 11, 11].map(ink).join(',') };
    let actions = 0;
    async function act(command: NativeCommand) {
      const before = observed(board.frame);
      board = await game.dispatch({ type: 'action', actionId: Number(command.action_ref.slice(6)) });
      const after = observed(board.frame), ref = `step:${++actions}`;
      const updated = observeTravel(travel, before, after, command, ref);
      knowledge = observePushAccess(knowledge, travel, updated, before, after, command, ref);
      travel = updated;
    }
    for (const action of prefix) await act(input(action));
    assert.equal(knowledge?.push?.chain, true);
    assert.ok(knowledge?.wall && travel);
    const first = choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 120);
    assert.ok(first?.blocked);
    assert.equal(first.blocked.blockedBy.action_ref, 'ACTION4');
    assert.ok(first.steps.length > 1);
    assert.equal(first.steps.at(-1)?.pushed, true);
    assert.ok(matchesPushAccess(knowledge, travel, observed(board.frame), first, first.start));
    assert.equal(matchesPushAccess(knowledge, travel, observed(board.frame), first, first.steps[0]!.after), false);
    assert.equal(choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 1), undefined);

    while (board.level === 2 && actions < 65) {
      const plan = choosePushAccess(knowledge, transfer, travel, observed(board.frame), inputs, 120 - actions, first.goal);
      assert.ok(plan);
      for (const step of plan.steps) {
        await act(step.command);
        if (board.level === 2) assert.ok(knowledge && travel && matchesPushAccess(knowledge, travel, observed(board.frame), plan, step.after));
      }
    }
    assert.equal(board.levelsCompleted, 1);
  });
}
