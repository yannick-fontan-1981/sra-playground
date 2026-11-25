import assert from 'node:assert/strict';
import test from 'node:test';
import { planTurnPostLayout } from '../src/sic/arrange-turn-posts.ts';

const [background, wall] = [0, 9];
const rows = () => Array.from({ length: 30 }, () => Array<number>(30).fill(background));
const scene = (shift = 0): Parameters<typeof planTurnPostLayout>[0] => ({
  pitch: 4, start: [6, 10 + shift], heading: 0, exit: [14, 27, 14, 29], exitHeading: 1,
  width: 30, height: 30, wall, marker: 6, actorMask: [[0, 0]],
  posts: [
    { color: 4, quarters: 1, point: [14, 14 + shift], mask: [[0, 0]] },
    { color: 2, quarters: 2, point: [22, 6], mask: [[0, 0]] },
  ],
});

test('turn placement uses the projected path and retains the post outside that path', () => {
  for (const shift of [0, 4]) {
    const input = scene(shift);
    assert.deepEqual(planTurnPostLayout(input, rows(), input.posts, []), [[10, 14 + shift], [22, 6]]);
  }
});

test('a closed exit invalidates the cached paths and an expired search returns without moves', () => {
  const input = scene();
  const board = rows();
  board[26]!.fill(wall);
  assert.equal(planTurnPostLayout(input, board, input.posts, []), null);
  assert.equal(planTurnPostLayout(input, rows(), input.posts, [], {
    now: () => 10, deadlineMs: 10, yieldControl: async () => {},
  }), null);
});
