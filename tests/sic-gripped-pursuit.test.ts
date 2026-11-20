import assert from 'node:assert/strict';
import test from 'node:test';
import { planGrippedPursuit, readGripState, type GripState, type GripTerrain } from '../src/sic/gripped-pursuit.ts';
import { pursuitDirections } from '../src/sic/pursuit-forecast.ts';

const corridor: GripTerrain = { actor: 5, peer: 8, obstacle: 2, wall: 3, floor: 0, size: 1, pitch: 1,
  cells: { '1,0': true, '1,1': true, '1,2': true, '1,3': true }, fixed: [[0, 0]] };

test('the stone must travel with the actor to close the last retreat cell', () => {
  const start: GripState = { actor: [1, 2], peers: [[1, 0]], obstacles: [[1, 3]], held: null };
  assert.equal(planGrippedPursuit(start, corridor, pursuitDirections, new Set(), 2), null);
  const plan = planGrippedPursuit(start, corridor, pursuitDirections, new Set(), 3);
  assert.deepEqual(plan?.map(step => step.input), ['ACTION5', 'ACTION1', 'ACTION1']);
  assert.deepEqual(plan?.at(-1)?.expected.held, [1, 1]);
  assert.deepEqual(plan?.at(-1)?.expected.peers, []);
});

test('the carried state is read from a distinct observed color and checked against the wall', () => {
  const rows = [[3, 8], [0, 0], [0, 5], [0, 14], [0, 2]];
  const terrain = { ...corridor, cells: { ...corridor.cells, '1,4': true } };
  const grip = readGripState(rows, terrain);
  assert.equal(grip?.heldInk, 14);
  assert.deepEqual(grip?.state.held, [1, 3]);
  assert.equal(readGripState(rows, terrain, 13), null);
  rows[0]![0] = 0;
  assert.equal(readGripState(rows, terrain), null);
});

test('a second reactive sprite occupies the escape cell and the plan reaches both', () => {
  const rows = [[3, 8], [0, 7], [0, 5], [0, 14], [0, 2]];
  const terrain = { ...corridor, peerInks: [7, 8], cells: { ...corridor.cells, '1,4': true } };
  const start = readGripState(rows, terrain)?.state;
  assert.ok(start);
  assert.deepEqual(start.peers, [[1, 0], [1, 1]]);
  assert.equal(planGrippedPursuit(start, terrain, pursuitDirections, new Set(), 1), null);

  const plan = planGrippedPursuit(start, terrain, pursuitDirections, new Set(), 2);
  assert.deepEqual(plan?.map(leg => leg.input), ['ACTION1', 'ACTION1']);
  assert.deepEqual(plan?.map(leg => leg.expected.peers), [[[1, 0]], []]);
});
