import assert from 'node:assert/strict';
import test from 'node:test';
import { inferRelayBindings, type RelayScene } from '../src/sic/relay-configuration.ts';
import type { NativeBox, NativePoint } from '../src/logos-engine/v6-native-types.ts';

test('visible wire pixels bind controllers even when the frame covers part of each wire', () => {
  const support = (ref: string, x: number, y: number) => ({
    ref, point: [x, y] as NativePoint, bbox: [x - 1, y - 1, x + 1, y + 1] as NativeBox,
  });
  const source = support('source', 10, 3), goal = support('goal', 10, 8);
  const scene: RelayScene = {
    objects: [support('right', 15, 6), goal, source, support('left', 4, 6)],
    controls: [{ ...support('first', 4, 20), radius: 1 }, { ...support('second', 15, 20), radius: 1 }],
    goal, background: 0, frame: [0, 0, 19, 12],
  };
  const rows = Array.from({ length: 23 }, () => Array<number>(20).fill(0));
  for (let y = 6; y <= 20; y++) {
    rows[y]![4] = 3;
    rows[y]![15] = 3;
  }
  rows[12]!.fill(8);

  assert.deepEqual(inferRelayBindings(scene, source, rows), { 0: 'left', 1: 'right' });
  rows[10]![4] = scene.background;
  assert.deepEqual(inferRelayBindings(scene, source, rows), {});
});
