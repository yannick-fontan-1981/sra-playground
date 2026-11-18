import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { projectionWithinLimit, radialSlotPermutations } from '../src/sic/slot-field-transforms.ts';

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
