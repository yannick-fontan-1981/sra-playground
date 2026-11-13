import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareDirectionTargets, observeDirectionalReturn, summarizeDirections } from '../src/sic/directional-return.ts';

test('directional observations retain public changes and stop at level transitions', () => {
  const scope = { sessionId: 'session', sequence: 1, command: 1, fromLevel: 1, toLevel: 1 };
  const before = [[0, 2, 0], [0, 0, 0], [0, 0, 0]];
  const after = [[0, 0, 0], [0, 0, 0], [0, 2, 0]];
  const receipt = observeDirectionalReturn(scope, before, after, false);
  assert.equal(receipt.changes?.totalPixels, 2);
  assert.equal(receipt.changes?.regionCount, 2);
  assert.deepEqual(receipt.changes?.samples.map(({ before, after }) => [before, after]), [
    [[[2]], [[0]]],
    [[[0]], [[2]]],
  ]);
  assert.equal(observeDirectionalReturn({ ...scope, toLevel: 2 }, before, after, true).changes, null);
  assert.equal(observeDirectionalReturn(scope, before, [[0]], false).changes, null);
});

test('target comparison preserves both outcomes when the visible colors agree', () => {
  const base = { sessionId: 's', sequence: 1, command: 1, fromLevel: 1, toLevel: 1, changes: null };
  const target = [[1, 2], [1, 1]];
  const moved = { ...base, stationary: null, translation: {
    from: [2, 4, 3, 5] as const, to: [2, 2, 3, 3] as const, sprite: target, targetBefore: target,
  } };
  const stayed = { ...base, sequence: 2, translation: null, stationary: {
    box: [2, 2, 3, 3] as const, sprite: target, step: 2, ahead: [[2, 1], [2, 1]],
  } };
  assert.deepEqual(compareDirectionTargets([moved, stayed]), [
    { colors: [1, 2], moved: 1, stationary: 1, movedExample: moved, stationaryExample: stayed },
  ]);
});

test('touching sprite footprints are separated from a parallel change, and a following attempt can stay in place', () => {
  const board = (y: number, counter: number) => {
    const frame = Array.from({ length: 9 }, () => Array<number>(8).fill(0));
    frame[y]!.splice(2, 3, 2, 2, 2);
    frame[y + 1]!.splice(2, 3, 3, 3, 3);
    frame[8]![counter] = 4;
    return frame;
  };
  const scope = { sessionId: 's', sequence: 1, command: 1, fromLevel: 2, toLevel: 2 };
  const before = board(4, 1), middle = board(2, 2), end = board(0, 3), blocked = board(0, 4);
  const moved = observeDirectionalReturn(scope, before, middle, false);
  assert.deepEqual(moved.translation?.from, [2, 4, 4, 5]);
  assert.deepEqual(moved.translation?.to, [2, 2, 4, 3]);
  assert.equal(moved.changes?.totalPixels, 2);
  const again = observeDirectionalReturn({ ...scope, sequence: 2 }, middle, end, false, moved);
  const stays = observeDirectionalReturn({ ...scope, sequence: 3 }, end, blocked, false, again);
  assert.deepEqual(stays.stationary?.box, [2, 0, 4, 1]);
  assert.equal(stays.stationary?.ahead, null);
  assert.deepEqual(summarizeDirections([moved, again, stays]), [
    { command: 1, moved: 2, stationary: 1, unresolved: 0, repeated: true, shift: '0,-2' },
  ]);
  const unrelated = observeDirectionalReturn({ ...scope, sequence: 5 }, end, blocked, false, again);
  assert.equal(unrelated.stationary, null);
});
