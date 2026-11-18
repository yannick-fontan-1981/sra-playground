import assert from 'node:assert/strict';
import test from 'node:test';
import { describeRankOrder, observeHeightInversion, observeRankOrder, projectHeightInversion, projectRankOrder,
  resizeRankOrder } from '../src/sic/profile-rank-order.ts';

test('a height-changing tool can complement selected ranks while leaving the others in place', () => {
  const first = [2, 4, 1, 5, 3], second = [4, 4, 5, 5, 3];
  const partial = observeHeightInversion(first, second, 6);
  assert.deepEqual(partial, [true, false, true, false, null]);
  assert.equal(observeRankOrder(first, second), null);
  assert.equal(projectHeightInversion([4, 1, 5, 2, 4], partial!, 6), null);
  const refined = observeHeightInversion([4, 1, 5, 2, 4], [2, 1, 1, 2, 2], 6, partial!);
  assert.deepEqual(refined, [true, false, true, false, true]);
  assert.deepEqual(projectHeightInversion([1, 2, 3, 4, 5], refined!, 6), [5, 2, 3, 4, 1]);
  assert.equal(observeHeightInversion(first, [4, 2, 5, 5, 3], 6, refined!), null);
});

test('a second profile distinguishes rank mappings hidden by repeated tooth heights', () => {
  const first = [1, 1, 2, 4], shifted = [4, 1, 1, 2];
  const uncertain = observeRankOrder(first, shifted);
  assert.deepEqual(uncertain, [[3], [0, 1], [0, 1], [2]]);
  assert.deepEqual(projectRankOrder(first, uncertain!), shifted);
  assert.equal(projectRankOrder([1, 2, 3, 4], uncertain!), null);

  const confirmed = observeRankOrder(shifted, [2, 4, 1, 1], uncertain!);
  assert.deepEqual(confirmed, [[3], [0], [1], [2]]);
  assert.deepEqual(projectRankOrder([1, 2, 3, 4], confirmed!), [4, 1, 2, 3]);
  assert.equal(describeRankOrder(confirmed!), 'Move the last tooth to the front and shift the others one place');
});

test('equal height counts do not establish a reordering that reuses a source rank', () => {
  const prior = [[0, 2], [0, 3], [1, 2], [2, 3]];
  assert.equal(observeRankOrder([1, 1, 2, 2], [1, 1, 2, 2], prior), null);
});

test('resizing a rank order requires a unique measured pattern', () => {
  assert.deepEqual(resizeRankOrder([[3], [2], [1], [0]], 5), [[4], [3], [2], [1], [0]]);
  assert.deepEqual(resizeRankOrder([[3], [0], [1], [2]], 5), [[4], [0], [1], [2], [3]]);
  assert.equal(resizeRankOrder([[1], [0]], 5), null);
});
