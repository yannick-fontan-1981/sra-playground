import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { exposureBearings, exposureRules, planExposure, readExposureBoard, type ExposureScene } from '../src/sic/coupled-exposure.ts';
import { observeExposureConditions } from '../src/sic/observed-exposure-conditions.ts';

test('two competing colour assignments are separated by a witnessed displacement and a change of orientation', () => {
  const observe = (actor: NativePoint, piece: NativePoint, color: number, facing: number): ExposureScene => ({
    origin: [0, 0], size: [7, 6], pitch: 4, actor, bodies: [{pos: piece, color}],
    slots: [{pos: [5, 4], color: 3}], walls: [], actor_color: 8, layout: 'same board',
    dial: exposureBearings.map((vector, i) => ({point: [4*i, 0], vector, active: i === facing})),
  });
  const start = observe([2, 2], [3, 2], 3, 0), moved = observe([2, 3], [3, 3], 3, 0);
  const lit = observe([2, 3], [4, 3], 7, 2);
  const move = {action_ref: 'ACTION2', data: {}}, orient = {action_ref: 'ACTION6', data: {x: 8, y: 0}};
  const memory = observeExposureConditions(null, 1, start, moved, move, 'move');
  assert.equal(memory?.calibrated, undefined);
  const accepted = observeExposureConditions(memory, 1, moved, lit, orient, 'orientation');
  assert.deepEqual(accepted?.calibrated, {shadow: 3, lit: 7, refs: ['move', 'orientation']});
  const other = observeExposureConditions(null, 1, start, moved, move, 'move');
  assert.equal(observeExposureConditions(other, 1, moved, observe([2, 3], [5, 3], 7, 2), orient, 'other')?.calibrated, undefined);
  assert.equal(observeExposureConditions(accepted, 2, start, moved, move, 'new epoch')?.calibrated, undefined);
});

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

test('the search keeps both families of receivers in an eight-piece arrangement', async () => {
  const linked = 2, released = 6, shadow = 3, lit = 10;
  const bodies = [
    { pos: [2, 2], color: shadow }, { pos: [4, 5], color: shadow }, { pos: [5, 6], color: shadow }, { pos: [6, 7], color: shadow },
    { pos: [7, 5], color: linked }, { pos: [8, 6], color: linked }, { pos: [9, 7], color: linked }, { pos: [10, 8], color: released },
  ] as ExposureScene['bodies'];
  const scene: ExposureScene = { origin: [0, 0], size: [15, 11], pitch: 4, actor: [1, 2], bodies,
    slots: [{ pos: [3, 2], color: shadow }, ...bodies.slice(1)],
    dial: exposureBearings.map((vector, i) => ({ point: [i, 0] as NativePoint, vector, active: i === 0 })),
    walls: [], actor_color: 15, layout: 'test' };
  const [board, start] = readExposureBoard(scene, { shadow, lit }, { linked, released })!;
  assert.deepEqual(await planExposure(board, start, [0, 1, 2, 3], 2), [3]);
});
