import assert from 'node:assert/strict';
import test from 'node:test';
import { codeMaskRotation, rotatedCodeMask } from '../src/logos-engine/v6-code-program.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { codeInstructionEffect } from '../src/sic/code-demonstration.ts';
import { observeProgramHazard } from '../src/sic/program-timing.ts';

test('a repeated band blocks only the instruction phases where that band appears', () => {
  const before = Array.from({ length: 4 }, () => Array<number>(8).fill(0));
  const active = before.map(row => [...row]);
  active[2]!.splice(0, 8, 2, 3, 2, 3, 2, 3, 2, 3);
  const lattice = { origin: [0, 0] as const, shape: [4, 2] as const, size: 2 };
  const observed = observeProgramHazard(before, new Map([[0, before], [1, active], [2, active]]), 1, [2, 1], lattice, 'return');
  const cells = [[0, 1], [1, 1], [2, 1], [3, 1]];
  assert.deepEqual(observed, { ref: 'return', steps: [{ instruction: 1, cells }, { instruction: 2, cells }] });
  assert.equal(observeProgramHazard(before, new Map([[0, before], [1, active], [2, before]]), 1, [2, 1], lattice, 'return'), null);
});

test('an asymmetric normalized silhouette retains its orientation', () => {
  const mask: NativePoint[] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]];
  for (const angle of [0, 1, 2, 3]) {
    assert.equal(codeMaskRotation(mask, rotatedCodeMask(mask, 3, angle), 3), angle);
  }
  const symmetric: NativePoint[] = [[0, 0], [0, 1], [1, 0], [1, 1]];
  assert.equal(codeMaskRotation(symmetric, symmetric, 2), null);
});

test('an anchored turn and recolor are distinct effects on the same silhouette', () => {
  const before = { scale: 1, hue: 7, rotation: 3 };
  assert.deepEqual(codeInstructionEffect([0, 0], before, { ...before, rotation: 0 }, true),
    { motion: [0, 0], turn: 1, fromRotation: 3 });
  assert.deepEqual(codeInstructionEffect([0, 0], before, { ...before, hue: 0 }, true), { motion: [0, 0], hue: 0 });
  assert.deepEqual(codeInstructionEffect([0, 0], before, { ...before, scale: 2 }, true),
    { motion: [0, 0], resize: 1, fromScale: 1 });
  assert.equal(codeInstructionEffect([0, 0], before, before, true), null);
  assert.equal(codeInstructionEffect([0, 1], before, { ...before, hue: 0 }, true), null);
});
