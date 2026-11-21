import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCoverage,
  readCoverage,
  observeCoverage,
} from '../src/sic/controlled-coverage.ts';
import {
  inferPieceLaw,
  proposeCoverage,
} from '../src/sic/plan-controlled-coverage.ts';
import type { PieceRelation } from '../src/sic/controlled-coverage.ts';
const width = 11,
  height = 8,
  pitch = 3;
function scene(side: number, shift = 0) {
  const rows = Array.from({ length: height * pitch }, () =>
    Array<number>(width * pitch).fill(0),
  );
  const draw = (x: number, y: number, values: number[]) => {
    for (let k = 0; k < 9; k++)
      rows[3 * y + Math.floor(k / 3)]![3 * x + (k % 3)] = values[k]!;
  };
  const ring = (outside: number, center: number) =>
    Array.from({ length: 9 }, (_, k) => (k === 4 ? center : outside));
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++)
      if (x !== 7) draw(x, y, Array<number>(9).fill(1));
  draw(7, 3, ring(6, 4));
  for (const y of [2, 4]) {
    draw(8, y, ring(5, 1));
    draw(5, y, [1, 6, 1, 6, 8, 6, 1, 6, 1]);
    draw(2 + shift, y, ring(9, 4));
  }
  for (const [i, x] of [1, 3 + shift].entries()) {
    const c = i === 0 ? 11 : 12;
    draw(x, 3, [1, c, 1, c, side === i ? 15 : c, c, 1, c, 1]);
  }
  return rows;
}
test('independent motion establishes a subject-specific range that can be reused to select an experiment', () => {
  const a = scene(0),
    b = scene(1),
    c = registerCoverage(a, b, [3, 9, 5, 11], [9, 9, 11, 11], 'selection');
  assert.ok(c);
  assert.deepEqual(c.controls, [27, 49]);
  assert.equal(readCoverage(c, b)?.active, 1);
  assert.equal(
    proposeCoverage(c, b, ['ACTION2', 'ACTION4', 'ACTION6'], 25, 250),
    undefined,
  );
  const after = scene(1, 1);
  observeCoverage(c, b, after, 'ACTION4', 'move');
  assert.equal(c.observations[1].filter((v) => v.moved).length, 2);
  assert.deepEqual(inferPieceLaw(c.observations[1]), {
    kind: 'range',
    radius: 1,
  });
  const proposal = proposeCoverage(
    c,
    after,
    ['ACTION2', 'ACTION4', 'ACTION6'],
    25,
    250,
  );
  assert.equal(proposal?.purpose, 'measure_direction_for_coverage');
  assert.ok(proposal.evidence.includes('move'));
  assert.equal(proposal?.command, 'ACTION2');
});
test('contact and traction remain distinct alternatives to a range model', () => {
  const sample = (x: number, y: number, moved: boolean): PieceRelation => ({
    x,
    y,
    dx: 1,
    dy: 0,
    free: true,
    moved,
    ref: 'seen',
  });
  assert.equal(
    inferPieceLaw([sample(1, 0, true), sample(-1, 0, false)]).kind,
    'push',
  );
  assert.equal(
    inferPieceLaw([sample(1, 0, false), sample(-1, 0, true)]).kind,
    'pull',
  );
  assert.deepEqual(
    inferPieceLaw([
      sample(2, -1, true),
      sample(-2, -2, true),
      sample(3, 0, false),
    ]),
    { kind: 'range', radius: 2 },
  );
});
