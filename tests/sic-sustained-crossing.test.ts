import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerCrossing,
  observeCrossing,
  proposeCrossing,
} from '../src/sic/sustained-crossing.ts';
import type { TransportMemory } from '../src/sic/transport-observations.ts';

function room(onControl: boolean) {
  const width = 10,
    height = 8,
    rows = Array.from({ length: height * 3 }, () =>
      Array<number>(width * 3).fill(0),
    );
  const draw = (x: number, y: number, t: number[]) =>
    t.forEach((v, i) => {
      rows[3 * y + Math.floor(i / 3)]![x * 3 + (i % 3)] = v;
    });
  const tile = (a: number, b = a) =>
    Array.from({ length: 9 }, (_, i) => (i === 4 ? b : a));
  for (let y = 1; y <= 4; y++)
    for (let x = 1; x <= 8; x++) draw(x, y, tile(x >= 4 && x <= 5 ? 2 : 1));
  for (const y of [2, 3, 4]) draw(2, y, tile(6, 10));
  draw(7, 2, tile(11, 1));
  draw(8, 3, tile(11, 1));
  draw(3, 2, tile(onControl ? 1 : 8, onControl ? 1 : 7));
  draw(1, 6, [1, 8, 1, 8, 7, 8, 1, 8, 1]);
  draw(2, 6, tile(1));
  draw(1, 3, [1, 3, 1, 3, 3, 3, 1, 3, 1]);
  draw(onControl ? 1 : 2, 6, [1, 5, 1, 5, 9, 5, 1, 5, 1]);
  return rows;
}
test('a remote observed gate change permits a forecast with two missing terrain cells', () => {
  const m: TransportMemory = {
    grid: { pitch: 3, left: 0, top: 0, columns: 10, rows: 8 },
    inks: [3, 5],
    active: 1,
    mark: 9,
    selection: 'selected',
    motors: {},
    verified: [true, true],
    denied: {},
  };
  for (const [i, [dx, dy]] of (
    [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const
  ).entries())
    m.motors['ACTION' + (i + 1)] = { dx, dy, ref: 'known' };
  const initial = room(false),
    opened = room(true),
    c = registerCrossing(m, initial);
  assert.ok(c);
  assert.equal(c.control, 61);
  assert.equal(c.gate, 23);
  assert.equal(c.initialPusher, 0);
  assert.ok(c.corridors.some((p) => p.material.length === 2));
  assert.equal(proposeCrossing(c, m, initial, 60, 1000), undefined);
  observeCrossing(c, m, initial, opened, 'ACTION3', 'opening');
  assert.equal(c.opened, 'opening');
  const f = proposeCrossing(c, m, opened, 60, 1000);
  assert.ok(f?.crossing);
  assert.equal(f.crossing.missing.length, 2);
  assert.ok(f.evidence.includes('opening'));
});
