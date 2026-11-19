import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseTurningRoute, initialTurningPose, moveTurningPose, projectTurningPose, turningEdge,
  type TurningLayout } from '../src/sic/turning-extensions.ts';

const button = { box: [0, 24, 2, 26] as const, at: [1, 25] as const };
const buttons = { extend: button, retract: button, turn: button };
const layout: TurningLayout = {
  field: [0, 0, 29, 23], width: 30, obstacles: Array<string>(24).fill('.'.repeat(30)),
  quantum: 3, floor: 0, capInk: 1, markerInk: 2,
  segments: [
    { ink: 3, pivot: [12, 20], direction: [0, -1], length: 5, buttons },
    { ink: 4, pivot: [12, 14], direction: [1, 0], length: 5, buttons },
    { ink: 5, pivot: [18, 14], direction: [0, 1], length: 5, buttons },
  ],
  marker: [18, 17], target: [15, 8], marks: [[14, 8], [16, 8], [15, 7], [15, 9]],
};

test('a quarter-turn leaves predecessors fixed and carries a descendant around the pivot', () => {
  const start = initialTurningPose(layout), before = projectTurningPose(layout, start);
  const after = projectTurningPose(layout, moveTurningPose(start, { body: 1, operation: 'turn' }, 1));
  assert.deepEqual(after.parts[0], before.parts[0]);
  assert.deepEqual(after.parts[1]!.pivot, [12, 14]);
  assert.deepEqual(after.parts[1]!.box, [11, 10, 13, 14]);
  assert.deepEqual(after.parts[2]!.box, [12, 7, 16, 9]);
  assert.deepEqual(after.marker, layout.target);
  const extended = projectTurningPose(layout, moveTurningPose(start, { body: 0, operation: 'extend' }, 1));
  assert.deepEqual(extended.parts[2]!.pivot, [18, 11]);
  assert.deepEqual(extended.marker, [18, 14]);
});

test('the search uses a clear turn and excludes one contradicted at the current pose', async () => {
  const start = initialTurningPose(layout), move = { body: 1, operation: 'turn' as const };
  assert.deepEqual(await chooseTurningRoute(layout, start, 1, [], 1), [move]);
  assert.deepEqual(await chooseTurningRoute(layout, start, 1, [turningEdge(start, move)], 1), []);
  const obstacles = [...layout.obstacles];
  obstacles[7] = '.'.repeat(15) + '#' + '.'.repeat(14);
  assert.deepEqual(await chooseTurningRoute({ ...layout, obstacles }, start, 1, [], 1), []);
});

test('a linked turn skips the orientation towards its parent while keeping another target aligned', async () => {
  const target = [6, 11] as const, reserved = [24, 16] as const;
  const mixed: TurningLayout = { ...layout, target, segments: [
    { ...layout.segments[0]!, buttons: {}, parent: null },
    { ...layout.segments[1]!, buttons: { turn: button }, parent: 0 },
    { ...layout.segments[2]!, buttons: {}, parent: 1 },
    { ink: 6, pivot: [24, 16], direction: [-1, 0], length: 2, parent: null, buttons: {} },
  ], alignments: [{ body: 2, marker: layout.marker, target }, { body: 3, marker: reserved, target: reserved }] };
  const start = initialTurningPose(mixed);
  const move = { body: 1, operation: 'turn' as const, quarterTurns: 2 };
  assert.deepEqual(await chooseTurningRoute(mixed, start, -1, [], 1), [move]);
  const projected = projectTurningPose(mixed, moveTurningPose(start, move, -1));
  assert.deepEqual(projected.markers, [target, reserved]);
  assert.deepEqual(await chooseTurningRoute(mixed, start, -1, [turningEdge(start, move)], 1), []);
});

test('turning follows physical attachment and extension follows the shared button', async () => {
  const shared: TurningLayout = { ...layout, panels: [], marker: [20, 4], target: [20, 7], marks: [],
    alignments: [{ body: 2, marker: [20, 4], target: [20, 7] }],
    segments: [
      { ink: 3, fixedBox: [10, 10, 12, 12], pivot: [11, 11], direction: [1, 0], length: 3, parent: null, buttons: { turn: button } },
      { ink: 4, pivot: [14, 11], direction: [1, 0], length: 2, parent: 0, buttons: { extend: button } },
      { ink: 4, pivot: [20, 4], direction: [0, 1], length: 2, parent: null, buttons: { extend: button } },
      { ink: 6, fixedBox: [19, 6, 21, 8], pivot: [20, 7], direction: [0, 1], length: 3, parent: 2, buttons: {} },
    ] };
  const start = initialTurningPose(shared), before = projectTurningPose(shared, start);
  const rotated = projectTurningPose(shared, moveTurningPose(start, { body: 0, operation: 'turn' }, 1));
  assert.deepEqual(rotated.parts[1]!.box, [10, 7, 12, 8]);
  assert.deepEqual(rotated.parts.slice(2), before.parts.slice(2));

  const extend = { body: 1, operation: 'extend' as const, receivers: [1, 2] };
  assert.deepEqual(await chooseTurningRoute(shared, start, 1, [], 1), [extend]);
  const extended = projectTurningPose(shared, moveTurningPose(start, extend, 1));
  assert.deepEqual(extended.parts[1]!.box, [14, 10, 18, 12]);
  assert.deepEqual(extended.parts[2]!.box, [19, 4, 21, 8]);
  assert.deepEqual(extended.parts[3]!.box, [19, 9, 21, 11]);
  assert.deepEqual(extended.marker, shared.target);
});
