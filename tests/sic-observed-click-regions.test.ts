import assert from 'node:assert/strict';
import test from 'node:test';
import { markerDisplacement, singleChangedPoint } from '../src/sic/observed-click-regions.ts';

test('a single click marker can track motion when its surroundings change', () => {
  const initial = [[2, 2, 2, 0, 0, 0]];
  const selected = [[2, 7, 2, 0, 0, 0]];
  assert.deepEqual(singleChangedPoint(initial, selected), [1, 0]);
  assert.equal(singleChangedPoint(selected, selected), null);
  assert.equal(singleChangedPoint(initial, [[2, 7, 7, 0, 0, 0]]), null);
  assert.deepEqual(markerDisplacement(selected, [[0, 0, 2, 7, 2, 0]], [1, 0], [1, 0], 5), [2, 0]);
  assert.equal(markerDisplacement(selected, [[2, 7, 2, 7, 0, 0]], [1, 0], [1, 0], 5), null);
  assert.equal(markerDisplacement(selected, [[2, 2, 2, 7, 7, 0]], [1, 0], [1, 0], 5), null);
});
