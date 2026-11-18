import assert from 'node:assert/strict';
import test from 'node:test';
import { planCoupledApproach } from '../src/sic/coupled-approach.ts';
import type { CoupledPiece } from '../src/sic/coupled-piece-settling.ts';

test('count selection and a measured turn to settle on the marked slot', async () => {
  const field = { floor: ['1,2', '2,2', '3,2', '1,1'], goal: [2, 2] as const, grid: { width: 5, height: 5 } };
  const pieces: CoupledPiece[] = [{ point: [1, 2], direction: 0, selected: false },
    { point: [3, 2], direction: 1, selected: false }, { point: [1, 1], direction: 2, selected: false }];
  const assess = (remaining: number) => planCoupledApproach(pieces, field, [['ACTION4', 1]], remaining, () => true, () => false);
  assert.equal(await assess(1), null);
  const route = await assess(2);
  assert.equal(route?.length, 1);
  assert.deepEqual(route[0]!.piece.point, [1, 2]);
  assert.ok(route[0]!.expected.some(piece => piece.point.join(',') === '2,2'));
});

test('a transition that crosses the target and settles beyond it does not complete the route', async () => {
  const field = { floor: Array.from({ length: 7 }, (_, i) => `1,${i + 1}`), goal: [1, 5] as const, grid: { width: 3, height: 9 } };
  const pieces: CoupledPiece[] = [{ point: [1, 1], direction: 2, selected: false }, { point: [1, 7], direction: 3, selected: true }];
  const route = await planCoupledApproach(pieces, field, [['ACTION3', -1]], 1, () => true, () => false);
  assert.equal(route, null);
});
