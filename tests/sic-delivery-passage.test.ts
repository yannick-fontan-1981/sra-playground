import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { measureDeliveryPassage } from '../src/sic/delivery-passage.ts';

test('delivery passage uses the visible opening and separates the two work areas', () => {
  const targets: NativePoint[] = [[1, 2], [1, 3], [1, 4]];
  const actor: NativePoint = [8, 4], peer: NativePoint = [3, 4];
  const parts: NativePoint[] = [[7, 5], [8, 2]];
  const rows = Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => x === 5 && y !== 4 && y !== 5 ? 0 : 1));
  const geometry = { pitch: 1, phase: [0, 0] as const, background: 1, targets };
  const passage = measureDeliveryPassage(rows, geometry, actor, parts, [peer]);
  assert.deepEqual(passage?.mouths, [[6, 4], [6, 5]]);
  assert.ok(passage?.floor.includes('5,5'));
  assert.ok(!passage?.floor.includes('5,3'));
  assert.ok(!passage?.source.includes('5,5'));
  assert.ok(passage?.source.includes('7,5'));
  assert.equal(measureDeliveryPassage(rows, geometry, actor, parts, [[7, 4]]), null);

  const transpose = ([x, y]: NativePoint): NativePoint => [y, x];
  const columns = rows[0]!.map((_, x) => rows.map(row => row[x]!));
  const vertical = measureDeliveryPassage(columns, { ...geometry, targets: targets.map(transpose) },
    transpose(actor), parts.map(transpose), [transpose(peer)]);
  assert.deepEqual(vertical?.mouths, [[4, 6], [5, 6]]);
});
