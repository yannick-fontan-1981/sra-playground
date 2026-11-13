import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeSpace } from '../src/sic/space-return.ts';
import { compareStckRank } from '../src/sic/stck-stack.ts';

function frame(cards: readonly number[], focus: number | null, player?: readonly [number, number, number]) {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  for (const [index, color] of cards.entries()) for (let y = 48 - 6 * index; y <= 52 - 6 * index; y++) {
    for (let x = 1; x <= 8; x++) rows[y]![x] = color === focus && (x === 1 || x === 8) ? 0 : color;
  }
  if (player) {
    const [x, y, color] = player;
    rows[y + 1]![x] = 0;
    rows[y]![x - 1] = rows[y]![x + 1] = 0;
    rows[y]![x] = rows[y - 2]![x] = color;
    rows[y - 1]![x - 1] = rows[y - 1]![x] = rows[y - 1]![x + 1] = color;
  }
  return rows;
}

test('rank distinguishes an emptied slot from a same-color replacement', () => {
  const before = frame([9, 9, 8], null);
  const lower = compareStckRank(before, frame([9, 8], null), [4, 50], 1);
  assert.equal(lower?.expected, 'same-color');
  assert.equal(lower?.actual, 'same-color');
  assert.equal(lower?.stackShiftMatched, true);
  const top = compareStckRank(before, frame([9, 9], null), [4, 38], 1);
  assert.equal(top?.expected, 'emptied');
  assert.equal(top?.actualColor, null);
  assert.equal(compareStckRank(before, before, [46, 56], 1), null);
});

test('Space links a visible highlight to same-frame changes and keeps the tower track across movement', () => {
  const before = frame([9, 9], null, [25, 20, 9]);
  const highlight = frame([9, 9], 9, [25, 20, 9]);
  const moved = frame([9, 9], 9, [29, 22, 9]);
  const changed = frame([9, 9], null, [29, 22, 8]);
  const scope = { sessionId: 's', sequence: 3, fromLevel: 1, toLevel: 2 };
  const animation = observeSpace(scope, before, [highlight, moved, changed, before]);
  assert.deepEqual(animation.frames[0]?.focus.map(item => item.rank), [1, 2]);
  assert.equal(animation.frames[0]?.sprites.length, 0);
  const movement = animation.frames[1]?.sprites[0];
  assert.deepEqual([movement?.effect, movement?.before?.anchor, movement?.after?.anchor],
    ['moved', [25, 20], [29, 22]]);
  assert.ok(movement?.before?.rows.length && movement.after?.rows.length);
  assert.equal(animation.frames[2]?.sprites[0]?.effect, 'changed');
  assert.equal(animation.frames[2]?.sprites[0]?.track, movement.track);
  assert.equal(animation.frames[3]?.boundary, true);
  assert.deepEqual(animation.frames[3]?.sprites, []);
});

test('a full-board flash pauses matching and a same-level reset ends the tracks', () => {
  const before = frame([9], null, [25, 20, 9]);
  const obscured = before.map((row, y) => row.map(pixel => y < 54 && pixel !== 5 ? 8 : pixel));
  const animation = observeSpace({ sessionId: 's', sequence: 4, fromLevel: 2, toLevel: 2 }, before,
    [obscured, before, frame([9], null, [29, 22, 9])]);
  assert.equal(animation.frames[0]?.obscured, true);
  assert.deepEqual(animation.frames[0]?.sprites, []);
  assert.deepEqual(animation.frames[1]?.sprites, []);
  assert.equal(animation.frames[2]?.boundary, true);
});
