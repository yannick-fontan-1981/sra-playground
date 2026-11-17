import assert from 'node:assert/strict';
import test from 'node:test';
import { directedBranchWalk, projectDirectedBranches, verifyDirectedBranches,
  type DirectedBranchLayout } from '../src/sic/directed-branch-layout.ts';

const width = 9;
const cell = (x: number, y: number) => y * width + x;
const fixed = Array<number>(width ** 2).fill(1);
for (const [x, y] of [[0, 3], [1, 3], [0, 4], [0, 5], [1, 5]]) fixed[cell(x!, y!)] = 6;
fixed[cell(4, 7)] = 5;
fixed[cell(4, 8)] = 4;
const layout: DirectedBranchLayout = {
  width, height: width, unit: 2, origin: [0, 0], background: 1, focusInk: 9, focused: 0, fixed,
  pieces: [{ at: cell(6, 3), offsets: [[0, 0], [1, 0], [1, 1]], ink: 8, turn: true }],
  targets: [{ opening: cell(1, 4), incoming: 3 }], sources: [{ at: cell(4, 7), direction: 0 }],
};

test('a concave turn preserves the lateral direction through the receiver approach', () => {
  const at = cell(4, 3);
  const turned = projectDirectedBranches(layout, [at]);
  assert.deepEqual([...turned!.served], [0]);
  assert.equal(turned!.escaped, 0);
  const straight = projectDirectedBranches({ ...layout, pieces: [{ ...layout.pieces[0]!, turn: false }] }, [at]);
  assert.equal(straight!.served.size, 0);
  const wrongSide = projectDirectedBranches({ ...layout, targets: [{ ...layout.targets[0]!, incoming: 0 }] }, [at]);
  assert.equal(wrongSide!.served.size, 0);
});

test('route the complete corner footprint and compare its actual focus and empty cells', () => {
  const at = layout.pieces[0]!.at;
  const walk = directedBranchWalk(layout, [at], 0, cell(4, 3));
  assert.deepEqual(walk, [[-1, 0], [-1, 0]]);
  assert.equal(directedBranchWalk(layout, [at], 0, cell(2, 3)), null);
  const raster = Array.from({ length: width * 2 }, () => Array<number>(width * 2).fill(1));
  const paint = (at: number, ink: number) => {
    const x = (at % width) * 2, y = Math.floor(at / width) * 2;
    for (let row = y; row < y + 2; row++) raster[row]!.fill(ink, x, x + 2);
  };
  layout.fixed.forEach((ink, i) => paint(i, ink));
  for (const [x, y] of layout.pieces[0]!.offsets) paint(at + y * width + x, layout.focusInk);
  assert.ok(verifyDirectedBranches(raster, layout, [at], 0));
  paint(at + width, layout.focusInk);
  assert.equal(verifyDirectedBranches(raster, layout, [at], 0), false);
});
