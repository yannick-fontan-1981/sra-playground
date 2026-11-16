import assert from 'node:assert/strict';
import test from 'node:test';
import { describeRankOrder, observeRankOrder, projectRankOrder } from '../src/sic/profile-rank-order.ts';

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
