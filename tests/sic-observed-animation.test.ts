import assert from 'node:assert/strict';
import test from 'node:test';
import { measureAnimatedCells } from '../src/sic/observed-animation.ts';

const points = [[0, 0], [1, 0], [2, 0]] as const;
const still = [[0, 0, 0]];
const first = [[7, 0, 0]];
const both = [[7, 7, 0]];

test('SIC measures cells activated only during a returned animation', () => {
  assert.deepEqual(measureAnimatedCells(still, still, [first, both, first, still], points), [0, 1]);
  assert.deepEqual(measureAnimatedCells(still, both, [first, both], points), []);
  assert.deepEqual(measureAnimatedCells(still, still, [both, [[0, 0, 7]], still], points), []);
});
