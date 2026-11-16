import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distributedSpanLoad, type SpanLayout } from '../src/sic/supported-span.ts';

const beam = (x: number, y: number, w: number) => ({ x, y, w, h: 2 });
const layout: SpanLayout = {
  pitch: 4, width: 12, h: 2,
  bases: [beam(0, 8, 4), beam(8, 8, 4)],
  fixture: { x: 5, y: 4, w: 2, h: 1 },
  bars: [], goal: beam(9, 0, 2), slots: [], stock: [], validPaint: 1,
};
const bridge = [beam(0, 6, 5), beam(7, 6, 5), beam(1, 4, 4), beam(7, 4, 4), beam(3, 2, 6)];

test('routes an off-center bridge load to the lower branches when the fixed support no longer covers it', () => {
  const initial = distributedSpanLoad(layout, bridge);
  const shifted = distributedSpanLoad(layout, [...bridge, beam(6, 0, 5)]);
  assert.ok(initial && shifted);
  assert.deepEqual(initial.beams[4], { x: 6, onFixture: true });
  assert.equal(shifted.beams[4]?.onFixture, false);
  assert.ok(shifted.beams[4]!.x > 7);
  assert.ok(shifted.pressure > initial.pressure);
});

test('rejects an upper span with no contact under its resultant', () => {
  assert.equal(distributedSpanLoad(layout, [...bridge, beam(8, 0, 4)]), null);
});
