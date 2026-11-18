import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFields } from '../src/logos-engine/v6-field-constraints.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { binaryChanges, followsBinaryEffect, protectedWindowBoxes, solveBinaryField, type BinaryField } from '../src/sic/binary-field-effects.ts';

test('a grouped effect restores already-correct carriers and can change an unconstrained one', () => {
  const controls: BinaryField['controls'] = [0, 2, 4].map(x => ({ address: `${x},0`, point: [x, 0],
    box: [x, 0, x, 0], value: 0, marked: x === 2 }));
  const [left, marked, right] = controls;
  const constraints: BinaryField['constraints'] = new Map(controls.map(control => [control.address, {
    actual: 0, eq: new Set([control.marked || control === right ? 1 : 0]), ne: new Set(), sources: new Set(),
  }]));
  const field: BinaryField = { controls, constraints, pitch: [2, 2], colors: [0, 1] };
  assert.deepEqual(solveBinaryField(field), [left, marked]);
  constraints.delete(left!.address);
  assert.deepEqual(solveBinaryField(field), [marked]);

  const changes = binaryChanges(field, marked!);
  assert.equal(followsBinaryEffect([0, 0, 4, 0], changes, [[0, 5, 0, 5, 0]], [[1, 5, 1, 5, 1]]), true);
  assert.equal(followsBinaryEffect([0, 0, 4, 0], changes, [[0, 5, 0, 5, 0]], [[1, 5, 1, 1, 1]]), false);
});

test('a repeated action mark leaves the neighboring instructions outside local repair', () => {
  const marked = { shape: [3, 3] as const, glyph: [[0, 6, 0], [6, 0, 6], [0, 6, 0]] };
  const instruction = { shape: [3, 3] as const, glyph: [[2, 3, 2], [2, 0, 2], [2, 3, 3]] };
  const cells = new Map([['0,0', marked], ['8,0', instruction], ['16,0', { value: 0 }], ['24,0', marked], ['32,0', instruction]]);
  assert.deepEqual(protectedWindowBoxes({ size: [6, 6], pitch: [8, 8], groups: [cells] }), [[8, 0, 13, 5], [32, 0, 37, 5]]);
});

test('a grid of marked carriers can be measured from their repeated outlines', async () => {
  const rows = Array.from({ length: 24 }, () => Array<number>(24).fill(5));
  for (const y of [4, 12]) for (const x of [4, 12]) {
    for (let j = y; j < y + 6; j++) rows[j]!.fill(11, x, x + 6);
    for (let j = y; j < y + 2; j++) rows[j]!.fill(6, x + 2, x + 4);
  }
  const observation = await measureNativeObservation({
    frame_rows: rows, frame_hash: 'directed-carriers', level: 2, levels_completed: 1,
    state: 'NOT_FINISHED', available_action_refs: ['ACTION6'],
  }, 1);
  assert.deepEqual(extractFields(observation, rows), []);
  const [field] = extractFields(observation, rows, [3, 3]);
  assert.deepEqual(field?.size, [6, 6]);
  assert.deepEqual(field?.pitch, [8, 8]);
  assert.equal(field?.groups[0]?.size, 4);
});

test('a one-sided mark predicts a toggle only on the clicked cell and its measured neighbor', () => {
  const controls: BinaryField['controls'] = [0, 2, 4].map(y => ({ address: `0,${y}`, point: [0, y],
    box: [0, y, 0, y], value: 0, marked: true, offsets: [[0, -1]] }));
  const field: BinaryField = { controls, pitch: [2, 2], colors: [0, 1], constraints: new Map(controls.map(control => [
    control.address, { actual: 0, eq: new Set([1]), ne: new Set(), sources: new Set() },
  ])) };
  assert.deepEqual(solveBinaryField(field), [controls[0], controls[2]]);
  assert.deepEqual(binaryChanges(field, controls[1]!, new Map([['0,0', 1]])), [
    { box: [0, 0, 0, 0], from: 1, to: 0 }, { box: [0, 2, 0, 2], from: 0, to: 1 },
  ]);
});
