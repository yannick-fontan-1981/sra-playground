import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { fitDisjointSlotCycles, projectionWithinLimit, radialSlotPermutations } from '../src/sic/slot-field-transforms.ts';

test('one control can advance two disjoint cycles while leaving a connected branch still', () => {
  const positions: NativePoint[] = [[0, 0], [1, 0], [2, 0], [0, 1], [4, 3], [5, 3], [5, 4], [4, 4]];
  const contours = [[0, 1, 2], [0, 1, 2, 3], [4, 5, 6, 7]];
  const values = [0, 1, 2, 3, 4, 5, 6, 7];
  const moved = [2, 0, 1, 3, 7, 4, 5, 6];
  assert.deepEqual(fitDisjointSlotCycles(values, moved, positions, contours), [moved]);
  assert.deepEqual(fitDisjointSlotCycles(values, [7, 0, 1, 3, 2, 4, 5, 6], positions, contours), []);
});

test('a nested layout distinguishes movement along rings and spokes and supports an adjacent link', () => {
  const basis: NativePoint[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const nested: NativePoint[] = [2, 4].flatMap(radius => basis.map(([x, y]): NativePoint => [x * radius, y * radius]));
  const target = nested.length;
  const permutations = radialSlotPermutations([...nested, [6, 6]], [target]);
  assert.ok(permutations.some(permutation => permutation[0] === 8 && permutation[1] === 9 && permutation[target] === target));
  assert.ok(permutations.some(permutation => permutation[0] === 1 && permutation[8] === 9 && permutation[target] === target));
  assert.ok(permutations.some(permutation => permutation[target] === 9 && permutation[9] === target && permutation[0] === 0));
  const operators = permutations.map(permutation => ({ permutation }));
  assert.equal(projectionWithinLimit(new Map([[target, 3]]), operators, 17), true);
  assert.equal(projectionWithinLimit(new Map([[target, 3]]), operators, 16), false);
});
