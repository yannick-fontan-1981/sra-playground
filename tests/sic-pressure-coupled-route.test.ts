import assert from 'node:assert/strict';
import test from 'node:test';
import { measurePressureField, pressureCellBox, projectPressureControl, readPressureResponse, verifyPressureFrame,
  type PressureField } from '../src/sic/pressure-coupled-route.ts';

const width = 5;
const index = (x: number, y: number) => y * width + x;
const plate = index(1, 3), gate = index(3, 2);
const terrain = Array<number>(25).fill(5);
terrain[plate] = 2;
terrain[gate] = 2;
terrain[index(1, 2)] = 8;
terrain[index(4, 2)] = 8;
const gates = Array<number>(25).fill(-1);
gates[gate] = 0;
const field: PressureField = { unit: 2, width, height: 5, origin: [0, 0], floor: 5, paint: 9,
  terrain, gateOf: gates, relations: [{ ink: 2, plates: [plate], gates: [gate] }] };

test('use a directional stop to keep one piece on its plate while the other crosses', () => {
  const start = [plate, index(3, 3)] as const;
  const moved = projectPressureControl(field, start, 'up', [[0, -1], [0, -1]]);
  assert.deepEqual(moved, { command: 'up', positions: [plate, gate], changes: [], gateCrossings: [0] });
  const leave = projectPressureControl(field, moved!.positions, 'leave', [[1, 0], [0, -1]]);
  assert.deepEqual(leave, { command: 'leave', positions: [index(2, 3), index(3, 1)], changes: [0], gateCrossings: [] });
});

test('release an opening on entry to its plate and refuse to close a gate on an occupant', () => {
  const approach = projectPressureControl(field, [index(0, 3), index(3, 3)], 'approach', [[1, 0], [0, -1]]);
  assert.deepEqual(approach, { command: 'approach', positions: [plate, index(3, 3)], changes: [0], gateCrossings: [] });
  assert.equal(projectPressureControl(field, [plate, gate], 'release', [[1, 0], [1, 0]]), null);
});

test('a returned frame confirms both pieces and the held passage together', () => {
  const after = [plate, gate] as const, before = [plate, index(3, 3)] as const;
  const rows = Array.from({ length: 10 }, () => Array<number>(10).fill(field.floor));
  const paint = (cell: number, ink: number) => {
    const [l, t, r, b] = pressureCellBox(field, cell);
    for (let y = t; y <= b; y++) rows[y]!.fill(ink, l, r + 1);
  };
  terrain.forEach((ink, cell) => paint(cell, after.includes(cell) ? field.paint : ink));
  assert.ok(verifyPressureFrame(rows, field, after));
  assert.deepEqual(readPressureResponse(rows, field, before)?.positions, after);
  paint(gate, 2);
  assert.equal(verifyPressureFrame(rows, field, after), false);
});

test('pair geometry groups same-appearance plates and bars without palette identities', () => {
  const rows = Array.from({ length: 12 }, () => Array<number>(14).fill(7));
  const put = (x: number, y: number, ink: number) => {
    for (let row = 2 * y; row < 2 * y + 2; row++) rows[row]!.fill(ink, 2 * x, 2 * x + 2);
  };
  for (const [x, y, ink] of [[1, 1, 4], [3, 2, 4], [4, 2, 4], [6, 3, 8], [2, 4, 8], [3, 4, 8], [1, 5, 6], [5, 5, 6]]) {
    put(x!, y!, ink!);
  }
  const layout = measurePressureField(rows, { value: 6, size: 2, boxes: [[10, 2, 11, 3], [10, 10, 11, 11]] }, 7);
  assert.ok(layout);
  assert.deepEqual(layout.field.relations.map(item => [item.plates.length, item.gates.length]), [[1, 2], [1, 2]]);
  assert.ok(verifyPressureFrame(rows, layout.field, layout.positions));
});
