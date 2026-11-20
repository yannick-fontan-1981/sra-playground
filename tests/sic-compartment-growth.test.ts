import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { measureCompartments, readInhabitants } from '../src/sic/compartment-growth.ts';

test('measure short room bands from aligned floors and repeated separators', () => {
  const rows = Array.from({ length: 32 }, () => Array<number>(22).fill(2));
  const bands = [[3, 11], [13, 21], [23, 28]] as const, columns = [[1, 9], [11, 19]] as const;
  for (const [top, bottom] of bands) for (const [left, right] of columns) {
    for (let y = top; y <= bottom; y++) rows[y]!.fill(4, left, right + 1);
  }
  const draw = ([x, y]: NativePoint, [dx, dy]: NativePoint) => {
    for (const offset of [-2, -1, 1, 2]) rows[y + offset * dx]![x + offset * dy] = 13;
    rows[y]![x] = 7;
  };
  draw([10, 7], [1, 0]);
  draw([10, 17], [1, 0]);
  draw([5, 12], [0, 1]);
  draw([15, 22], [0, 1]);
  draw([10, 25], [1, 0]);
  rows[26]![15] = 8;

  const layout = measureCompartments(rows)!;
  assert.equal(layout.rooms.length, 6);
  assert.equal(layout.gates.length, 5);
  assert.ok(layout.gates.some(gate => gate.point[0] === 10 && gate.point[1] === 25));
  assert.ok(readInhabitants(layout, rows).some(sprite => sprite.color === 8 && sprite.room === 5));

  rows[22]![15] = 2;
  assert.equal(measureCompartments(rows)?.rooms.length, 4);
});
