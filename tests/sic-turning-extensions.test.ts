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
