import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { exposureBearings, exposureRules, readExposureBoard, type ExposureScene } from '../src/sic/coupled-exposure.ts';

test('a retained coupling can propagate a push after contact creates a new linked pair', () => {
  const linked = 2, released = 6, shadow = 3, lit = 10;
  const scene: ExposureScene = { origin: [0, 0], size: [11, 9], pitch: 4, actor: [1, 2],
    bodies: [
      { pos: [3, 2], color: shadow }, { pos: [4, 2], color: released }, { pos: [6, 2], color: released },
      { pos: [8, 6], color: linked }, { pos: [4, 7], color: shadow }, { pos: [6, 7], color: shadow },
    ],
    slots: [
      { pos: [6, 2], color: shadow }, { pos: [7, 2], color: linked }, { pos: [8, 2], color: linked },
      { pos: [9, 6], color: released }, { pos: [4, 7], color: shadow }, { pos: [8, 7], color: lit },
    ],
    dial: exposureBearings.map((vector, i) => ({ point: [i, 0] as NativePoint, vector, active: i === 0 })),
    walls: [], actor_color: 15, layout: 'test' };
  assert.equal(readExposureBoard(scene, { shadow, lit }), null);
  const [board, before] = readExposureBoard(scene, { shadow, lit }, { linked, released })!;
  const { project } = exposureRules(board);
  const first = project(before, 7);
  assert.equal(first.actor, before.actor);
  assert.deepEqual(first.pieces.slice(0, 4), [
    { cell: 26, color: lit }, { cell: 27, color: linked }, { cell: 28, color: linked }, { cell: 74, color: linked },
  ]);
  assert.deepEqual(project(first, 4).pieces.slice(0, 4), [
    { cell: 27, color: lit }, { cell: 28, color: linked }, { cell: 29, color: linked }, { cell: 75, color: linked },
  ]);
});
