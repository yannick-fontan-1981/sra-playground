import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseLineDrop } from '../src/sic/column-alignment-plan.ts';

const board = () => Array.from({ length: 6 }, () => Array<number>(7).fill(0));

test('reply to a playable winning threat before preparing an alignment', () => {
  const rows = board();
  for (const row of [3, 4, 5]) rows[row]![1] = -1;
  const choice = chooseLineDrop(rows, 4);
  assert.equal(choice?.reason, 'block');
  assert.deepEqual(choice?.cell, [2, 1]);
  assert.equal(choice?.line.length, 4);
  assert.equal(rows[2]![1], 0);
});

test('an immediate supported win takes precedence over the opponent’s threat', () => {
  const rows = board();
  for (const row of [3, 4, 5]) rows[row]![1] = -1;
  for (const col of [2, 3, 4]) rows[5]![col] = 1;
  const choice = chooseLineDrop(rows, 4);
  assert.equal(choice?.reason, 'complete');
  assert.deepEqual(choice?.cell, [5, 5]);
});
