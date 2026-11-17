import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeBox, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { linkedWindowCoverage, linkedWindowProjection, measureLinkedWindows, type RailWindow } from '../src/sic/linked-window-rail.ts';

function railScene() {
  const base = 4, track = 3, marker = 7;
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(base));
  rows[0]![0] = 5;
  const path: NativePoint[] = [];
  for (let x = 4; x <= 60; x += 4) path.push([x, 21]);
  for (let y = 25; y <= 37; y += 4) path.push([60, y]);
  for (let x = 56; x >= 4; x -= 4) path.push([x, 37]);
  for (let y = 41; y <= 53; y += 4) path.push([4, y]);
  for (let x = 8; x <= 60; x += 4) path.push([x, 53]);
  for (const [index, [x, y]] of path.entries()) {
    rows[y]![x] = track;
    const next = path[index + 1];
    if (!next) continue;
    const dx = Math.sign(next[0] - x), dy = Math.sign(next[1] - y);
    for (let i = 1; i < 4; i++) rows[y + dy * i]![x + dx * i] = track;
  }
  for (let y = 51; y <= 55; y++) rows[y]![62] = track;
  for (let x = 30; x <= 50; x++) rows[24]![x] = marker;
  rows[22]![30] = rows[23]![30] = rows[25]![50] = marker;
  const boxes = ([[2, 11, 18, 18], [22, 11, 38, 18], [42, 11, 58, 18],
    [6, 27, 22, 34], [26, 27, 42, 34], [46, 27, 62, 34]] as NativeBox[]).map((bbox): RailWindow => {
    const [left, top, right, bottom] = bbox;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y]![x] = 9;
    return { bbox, base, unit: 2, slots: [1, 5].map(dx => ({ box: [left + dx, bottom - 2, left + dx + 1, bottom - 1] })) };
  });
  boxes[1]!.signal_marker = { point: [30, 18], ink: marker };
  return { rows, boxes, path };
}

test('linked receivers recover covered rail centers only with evidence on both sides', () => {
  const { rows, boxes, path } = railScene();
  const rail = measureLinkedWindows(rows, boxes);
  assert.deepEqual(rail?.path, path);
  assert.deepEqual(rail.positions, [0, 5, 10, 28, 23, 18]);

  rows[35]![60] = rows[36]![60] = 4;
  assert.equal(measureLinkedWindows(rows, boxes), null);
});

test('the horizontal signal link remains identifiable when a preview covers its stubs', () => {
  const { rows, boxes } = railScene();
  rows[22]![30] = rows[23]![30] = 4;
  for (let x = 30; x <= 50; x++) {
    rows[24]![x] = 5;
    rows[25]![x] = 7;
  }
  assert.deepEqual(measureLinkedWindows(rows, boxes)?.links, [{ from: 2, to: 1, box: [30, 25, 50, 25] }]);
});

test('one signal backbone connects each marked receiver to its neighbor toward the visible source', () => {
  const { rows, boxes } = railScene();
  for (let x = 10; x <= 50; x++) {
    rows[24]![x] = 5;
    rows[25]![x] = 7;
  }
  boxes[0]!.signal_marker = { point: [10, 18], ink: 7 };
  assert.deepEqual(measureLinkedWindows(rows, boxes)?.links.map(link => [link.from, link.to]), [[1, 0], [2, 1]]);

  boxes[2]!.signal_marker = { point: [50, 18], ink: 7 };
  assert.equal(measureLinkedWindows(rows, boxes), null);

  delete boxes[0]!.signal_marker;
  assert.deepEqual(measureLinkedWindows(rows, boxes)?.links.map(link => [link.from, link.to]), [[0, 1], [1, 2]]);
});

test('the projected rail combines paint and capture with a same-beat dependency', () => {
  const { rows, boxes } = railScene();
  const rail = measureLinkedWindows(rows, boxes);
  assert.ok(rail);
  const colors = [8, 8, 9, 9, 14, 14, 11, 11, 11, 15, 15, 15, 14];
  const paint = [true, false, false, false, false, true];
  const [covered, events] = linkedWindowCoverage(rail, colors, paint,
    [[2, 8, 9], [3, 11, null], [4, 9, null], [4, 14, null], [2, 14, null], [3, 15, 14]]);
  assert.equal(covered, true);
  assert.deepEqual(events.map(event => [event.receiver_ref, event.action]), [
    ['receiver:0', 'PAINT'], ['receiver:2', 'CAPTURE'], ['receiver:1', 'CAPTURE'],
    ['receiver:4', 'CAPTURE'], ['receiver:5', 'PAINT'], ['receiver:3', 'CAPTURE'],
  ]);
  assert.equal(events[1]!.beat, events[2]!.beat);
  assert.deepEqual(linkedWindowCoverage(rail, colors, paint,
    [[2, 8, 14], [3, 11, null], [4, 9, null], [4, 14, null], [2, 14, null], [3, 15, 14]]), [false, []]);
});

test('pigment bounds preserve valid coverage that leaves a painter unused', () => {
  const { path } = railScene();
  const rail = { path, positions: [0, 5], order: [0, 1], links: [] };
  const project = linkedWindowProjection(rail, [8, 8], [true, false]);
  assert.equal(project(null, [[1, 9, 14], [2, 8, null]])[0], true);
  assert.equal(project(null, [[1, 9, 14], [2, null, null]])[0], true);
  assert.deepEqual(project(null, [[1, 9, 14], [2, 14, null]]), [false, []]);
});
