import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
import { matchesReflectedWorld, measureReflectedLattice, reflectCoverPoints, reflectedFocus } from '../src/logos-engine/v6-reflected-cover.ts';
import { checkObservedMotion, chooseObservedMotion, observedMotionModule } from '../src/sic/reflected-motion-card.ts';

test('the motion card chooses one admissible step and preserves uncertain returns', async () => {
  const module = await observedMotionModule();
  const choose = async (move: boolean, select: boolean, test: boolean) =>
    (await executeWorkflow(module, chooseObservedMotion, { situation: { move, select, test } }, {})).value;
  assert.equal(await choose(true, true, true), 'place_reflected_contributor');
  assert.equal(await choose(false, true, true), 'select_reflected_contributor');
  assert.equal(await choose(false, false, true), 'test_reflected_displacement');
  assert.equal(await choose(false, false, false), null);
  for (const matched of [true, false, null]) {
    const result = await executeWorkflow(module, checkObservedMotion, { outcome: { matched } }, {});
    assert.equal(result.value, matched);
  }
});

test('SIC keeps an occluded axis when the marker moves onto a body', () => {
  const world = {
    pitch: 2, phase: [0, 0], nx: 16, ny: 16, axis: 9, dim: 1, axis_color: 6, background: 0,
    direct: 5, image: 4, target: 2, marker_value: 15, focus: 'axis',
    bodies: [new Set(['2,8', '2,9', '3,9', '4,9']), new Set(['7,9', '8,9', '9,9', '9,8'])],
    targets: new Set(['12,9', '13,9', '12,8', '13,10']),
  };
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(world.background));
  const pixel = (cell: string) => cell.split(',').map(value => Number(value) * world.pitch) as [number, number];
  const paint = (cell: string, value: number) => {
    const [x, y] = pixel(cell);
    for (let dy = 0; dy < world.pitch; dy++) rows[y + dy]!.fill(value, x, x + world.pitch);
  };
  for (let x = 0; x < world.nx; x++) paint(`${x},${world.axis}`, world.axis_color);
  for (const body of world.bodies) for (const cell of reflectCoverPoints(body, world.axis, world.dim)) paint(cell, world.image);
  for (const cell of world.targets) paint(cell, world.target);
  for (const body of world.bodies) for (const cell of body) paint(cell, world.direct);
  for (const cell of world.bodies[0]!) {
    const [x, y] = pixel(cell);
    rows[y]![x] = world.marker_value;
  }
  const [vacatedX, vacatedY] = pixel('9,9');
  rows[vacatedY]![vacatedX] = world.background;

  assert.equal(measureReflectedLattice(rows, world), null);
  const observed = measureReflectedLattice(rows, world, true);
  assert.ok(observed);
  assert.ok(matchesReflectedWorld(world, observed));
  assert.equal(observed.axis, world.axis);
  assert.equal(reflectedFocus(world, observed), 0);

  for (const cell of world.bodies[0]!) paint(cell, world.direct);
  assert.equal(measureReflectedLattice(rows, world, true), null);
  const retained = { ...world, focus: 0, markerOffset: [0, 0] };
  const covered = measureReflectedLattice(rows, retained, true);
  assert.ok(covered);
  assert.ok(matchesReflectedWorld(retained, covered));
  assert.equal(reflectedFocus(retained, covered, true), 0);
});
