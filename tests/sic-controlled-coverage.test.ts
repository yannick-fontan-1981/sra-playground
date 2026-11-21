import test from 'node:test';
import assert from 'node:assert/strict';
import { contactStanceCost } from '../src/sic/coverage-contact-stance.ts';
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

test('joint movement binds a contact capability to the actual subject', () => {
  const a = scene(0),
    b = scene(1),
    c = registerCoverage(a, b, [3, 9, 5, 11], [9, 9, 11, 11], 'choose')!;
  c.testContacts = true;
  c.motors['ACTION4'] = { dx: 1, dy: 0, ref: 'calibrate' };
  function adjacent(x: number) {
    const rows = scene(0);
    for (let y = 9; y < 12; y++) rows[y]!.fill(1, 3, 18);
    for (const [i, n] of [x, x + 1].entries()) {
      const ink = i === 0 ? 11 : 12;
      [1, ink, 1, ink, i === 0 ? 15 : ink, ink, 1, ink, 1].forEach((v, k) => {
        rows[9 + Math.floor(k / 3)]![3 * n + (k % 3)] = v;
      });
    }
    return rows;
  }
  const before = adjacent(2),
    after = adjacent(3);
  observeCoverage(c, before, after, 'ACTION4', 'joint');
  assert.equal(c.peerPush?.[0], 'joint');
  assert.equal(c.peerPush?.[1], undefined);
  assert.equal(c.discovery, undefined);
});

test('the first useful stance for a cornered piece belongs to a subject that can pull it', () => {
  const cost = contactStanceCost(
    {
      grid: { left: 0, top: 0, pitch: 1, columns: 6, rows: 3 },
      terrain: [1, 2, 3, 4, 5, 13, 14, 15],
      controls: [3, 15],
    },
    ['push', 'pull'],
  )!;
  const layout = {
    subjects: [13, 2] as [number, number],
    pieces: [1, 15],
    supports: [],
  };
  assert.ok(cost({ ...layout, active: 1 }) < cost({ ...layout, active: 0 }));
  assert.ok(
    cost({ ...layout, subjects: [13, 4], active: 1 }) >
      cost({ ...layout, active: 1 }),
  );
});
