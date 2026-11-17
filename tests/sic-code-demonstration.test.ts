import assert from 'node:assert/strict';
import test from 'node:test';
import { codeMaskRotation, rotatedCodeMask } from '../src/logos-engine/v6-code-program.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { codeInstructionEffect } from '../src/sic/code-demonstration.ts';

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
