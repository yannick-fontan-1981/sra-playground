import assert from 'node:assert/strict';
import test from 'node:test';
import { measureStockedPiercing, planStockedPiercing, predictStockedPiercing, stockedPiercingMoves,
  type StockedPiercingScene } from '../src/sic/stocked-piercing.ts';
import { crossedRailStepSupported, observeCrossedStockBoundary, predictCrossedPiercing,
  type CrossedPiercingLayout } from '../src/sic/crossed-piercing.ts';

test('a cube at a crossing moves along the other shaft and stays in place across it', () => {
  const layout: CrossedPiercingLayout = {
    origin: [0,0], stride: 6, width: 5, height: 5, floor: 0, materials: [1], obstacles: [19],
    shafts: [{ axis: 0, targets: [0], select: [0,0], links: [false,true,true,true] },
      { axis: 1, targets: [0], select: [0,0], links: [false,true,true,true] }],
  };
  const pose = { heads: [{ line: 2, reach: 3 }, { line: 3, reach: 2 }], cubes: [{ at: 13, type: 0 }] };
  assert.deepEqual(predictCrossedPiercing(layout, pose, 0, [1,0]), {
    ...pose, heads: [{ line: 2, reach: 4 }, pose.heads[1]],
  });
  assert.deepEqual(predictCrossedPiercing(layout, pose, 0, [0,1]), {
    heads: [{ line: 3, reach: 3 }, pose.heads[1]], cubes: [{ at: 18, type: 0 }],
  });
  assert.equal(predictCrossedPiercing(layout, { ...pose, heads: [{ line: 2, reach: 4 }, pose.heads[1]!] }, 0, [0,1]), null);
});

test('a retraction can disclose that cubes cannot enter the guide cells', () => {
  const layout: CrossedPiercingLayout = {
    origin: [0, 0], stride: 4, width: 5, height: 5, floor: 0, materials: [1], obstacles: [],
    shafts: [{ axis: 0, targets: [0], select: [0, 0], links: [false, true, true, true] },
      { axis: 1, targets: [0], select: [4, 0], links: [false, true, true, true] }],
  };
  const starting = { heads: [{ line: 4, reach: 1 }, { line: 3, reach: 2 }], cubes: [{ at: 8, type: 0 }, { at: 13, type: 0 }] };
  const expected = predictCrossedPiercing(layout, starting, 1, [0, -1]);
  assert.ok(expected);
  assert.equal(expected.cubes[0]?.at, 3);
  const actual = { ...starting, heads: [starting.heads[0]!, { line: 3, reach: 1 }] };
  const constrained = observeCrossedStockBoundary(layout, starting, expected, actual, 1);
  assert.ok(constrained);
  assert.deepEqual(predictCrossedPiercing(constrained, starting, 1, [0, -1]), actual);
  assert.equal(observeCrossedStockBoundary(layout, starting, expected, starting, 1), null);
});

test('a retained move checks the connection it uses against the observed rail', () => {
  const layout: CrossedPiercingLayout = {
    origin: [0, 0], stride: 6, width: 5, height: 5, floor: 0, materials: [1], obstacles: [],
    shafts: [{ axis: 0, targets: [0], select: [0, 0], links: [false, true, true, false] },
      { axis: 1, targets: [0], select: [6, 0], links: [false, true, true, true] }],
  };
  const pose = { heads: [{ line: 2, reach: 1 }, { line: 3, reach: 0 }], cubes: [{ at: 11, type: 0 }] };
  const prediction = predictCrossedPiercing(layout, pose, 0, [0, 1]);
  assert.ok(prediction);
  const step = { action: 'slide', active: 0, pose: prediction };
  const withLinks = (links: boolean[]) => ({
    ...layout, shafts: [{ ...layout.shafts[0]!, links }, layout.shafts[1]!],
  });
  assert.equal(crossedRailStepSupported(withLinks([false, true, true, true]), pose, step), true);
  assert.equal(crossedRailStepSupported(withLinks([false, true, false, true]), pose, step), false);
});

const scene: StockedPiercingScene = {
  layout: { left: 0, top: 0, stride: 6, width: 5, height: 3, tracks: [true, true],
    obstacles: [9], order: [0, 1, 0], reference: 'repeated-reference' },
  placement: { row: 1, tip: 0, stock: [
    { type: 1, at: 1 }, { type: 0, at: 6 }, { type: 1, at: 7 }, { type: 0, at: 8 },
  ] },
};
const moves = stockedPiercingMoves(scene.layout, [
  { action_ref: 'extend', extent_delta: 6, root_translation: [0, 0] },
  { action_ref: 'withdraw', extent_delta: -6, root_translation: [0, 0] },
  { action_ref: 'lower', extent_delta: 0, root_translation: [6, 0] },
]);

test('the plan assembles a repeated order from interchangeable stock when an obstacle prevents a push', () => {
  const route = planStockedPiercing(scene, moves, 12, () => false);
  assert.deepEqual(route?.map(leg => leg.action), ['extend', 'extend', 'extend']);
  assert.deepEqual(route?.at(-1)?.expected, { ...scene.placement, tip: 3 });
  assert.equal(predictStockedPiercing({ ...scene, placement: { ...scene.placement, tip: 3 } }, moves[0]!), null);
});

test('the rod collides along its span even when the handle has access to the next rail position', () => {
  assert.equal(predictStockedPiercing({ ...scene, placement: { ...scene.placement, row: 0, tip: 4 } }, moves[2]!), null);
});

test('a balanced meter stripe still separates the repeated reference from the stock', () => {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  const fill = (x: number, y: number, width: number, height: number, ink: number) => {
    for (let i = y; i < y + height; i++) rows[i]!.fill(ink, x, x + width);
  };
  const root = (x: number, y: number) => {
    fill(x, y, 1, 6, 6);
    fill(x + 5, y, 1, 6, 6);
    fill(x, y + 5, 6, 1, 6);
    fill(x, y, 3, 1, 6);
  };
  fill(11, 6, 42, 42, 4);
  fill(0, 54, 64, 10, 4);
  fill(29, 24, 6, 6, 5);
  for (let y = 10; y < 44; y += 6) fill(7, y, 2, 4, 3);
  root(5, 24);
  root(20, 56);
  for (const x of [12, 18, 24]) fill(x, 25, 4, 4, 9);
  for (const x of [36, 42, 48]) fill(x, 25, 4, 4, 8);
  for (const x of [16, 22, 28]) fill(x, 26, 1, 2, 6);
  fill(27, 57, 4, 4, 8);
  fill(33, 57, 4, 4, 9);
  fill(39, 57, 4, 4, 8);
  fill(0, 53, 64, 1, 2);
  const full = measureStockedPiercing(rows);
  assert.deepEqual(full?.layout.order, [0, 1, 0]);
  assert.equal(full.placement.stock.length, 6);
  fill(32, 53, 32, 1, 3);
  assert.deepEqual(measureStockedPiercing(rows), full);
});
