import assert from 'node:assert/strict';
import { test } from 'node:test';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { distributedSpanLoad, measureSpan, readSpanPose, type SpanLayout } from '../src/sic/supported-span.ts';

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

function testFrame() {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  const fill = (left: number, top: number, w: number, h: number, ink: number) => {
    for (let y = top; y < top + h; y++) rows[y]!.fill(ink, left, left + w);
  };
  const outline = (left: number, top: number, w: number, h: number, ink: number) => {
    fill(left, top, w, 1, ink);
    fill(left, top + h - 1, w, 1, ink);
    fill(left, top + 1, 1, h - 2, ink);
    fill(left + w - 1, top + 1, 1, h - 2, ink);
  };
  fill(0, 60, 64, 4, 4);
  return { rows, fill, outline };
}

test('reads a one-cell support and counts stock against the space between the slots', () => {
  const { rows, fill, outline } = testFrame();
  outline(0, 44, 28, 8, 0);
  fill(28, 4, 12, 4, 14);
  fill(0, 12, 20, 4, 8);
  fill(44, 12, 20, 4, 8);
  fill(28, 36, 2, 4, 2);
  fill(30, 36, 2, 2, 14);
  fill(0, 52, 20, 2, 14);
  fill(44, 52, 20, 2, 14);
  for (const [x, stock] of [[40, 2], [48, 2], [56, 5]] as const) {
    outline(x, 60, 7, 4, x === 56 ? 0 : 3);
    fill(x + 1, 61, stock, 1, 14);
  }
  const parts = geometricComponents(rows), pose = readSpanPose(parts, 4, 8, 0);
  assert.ok(pose);
  const taken = measureSpan(rows, parts, { pitch: 4, beamHeight: 8, resize: 2, targetPaint: 14,
    barPaint: 8, validPaint: 0, completed: 4, refs: [] }, pose);
  assert.deepEqual(taken?.fixture, { x: 7, y: 9, w: 1, h: 1 });
  assert.deepEqual(taken?.stock, [2, 2, 5]);
});

test('recovers an invalid preview that touches a bar of the same color', () => {
  const { rows, fill, outline } = testFrame();
  fill(0, 12, 20, 4, 8);
  outline(20, 12, 20, 8, 8);
  outline(48, 60, 7, 4, 0);
  const parts = geometricComponents(rows);
  assert.equal(readSpanPose(parts, 4, 8, 0), null);
  assert.deepEqual(readSpanPose(parts, 4, 8, 0, { rows, slots: [{ box: [48, 60, 54, 63], width: 5, backing: 4 }] }),
    { box: [20, 12, 39, 19], x: 5, y: 3, w: 5, valid: false });
});
