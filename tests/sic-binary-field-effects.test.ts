import assert from 'node:assert/strict';
import test from 'node:test';
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
