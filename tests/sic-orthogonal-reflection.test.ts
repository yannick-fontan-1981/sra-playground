import assert from 'node:assert/strict';
import test from 'node:test';
import { reflectCoverPoints, shiftReflectionPoints } from '../src/logos-engine/v6-reflected-cover.ts';
import { supportPoint } from '../src/logos-engine/v6-support-measurements.ts';
import {
  measureOrthogonalReflection, moveOrthogonalContributor, planOrthogonalReflection, reconcileOrthogonalReflection,
  selectOrthogonalContributor, type OrthogonalWorld,
} from '../src/sic/orthogonal-reflection.ts';

function copies(body: Set<string>, [x, y]: OrthogonalWorld['axes']) {
  const first = reflectCoverPoints(body, x, 0);
  return [...first, ...reflectCoverPoints(body, y, 1), ...reflectCoverPoints(first, y, 1)];
}

const body = ['9,10', '10,10', '9,11'];
const goalPiece = shiftReflectionPoints(new Set(body), [-5, -6]);
const world: OrthogonalWorld = {
  axes: [2, 3], pitch: 3, phase: [0, 0], size: [13, 13], focus: 1,
  axisInk: 6, background: 0, marker: 3, direct: 5, image: 4, target: 7, body,
  targets: [...new Set([...goalPiece, ...copies(goalPiece, [6, 6])])],
};

function render(model: OrthogonalWorld) {
  const { pitch, axes, size, focus } = model;
  const rows = Array.from({ length: size[1] * pitch }, () => Array<number>(size[0] * pitch).fill(model.background));
  function paint(x: number, y: number, ink: number, marked = false) {
    if (x < 0 || y < 0 || x >= size[0] || y >= size[1]) return;
    for (let dy = 0; dy < pitch; dy++) rows[y * pitch + dy]!.fill(ink, x * pitch, (x + 1) * pitch);
    if (marked) rows[y * pitch + 1]![x * pitch + 1] = model.marker;
  }
  for (const key of model.targets) {
    const [x, y] = supportPoint(key);
    paint(x!, y!, model.target);
  }
  for (let y = 0; y < size[1]; y++) paint(axes[0], y, model.axisInk, focus === 0);
  for (let x = 0; x < size[0]; x++) paint(x, axes[1], model.axisInk, focus === 1);
  for (const key of copies(new Set(model.body), axes)) {
    const [x, y] = supportPoint(key);
    paint(x!, y!, model.image);
  }
  for (const key of model.body) {
    const [x, y] = supportPoint(key);
    paint(x!, y!, model.direct, focus === 'piece');
  }
  return rows;
}

test('derive a cover by composing the two independently measured reflections', () => {
  const measured = measureOrthogonalReflection(render(world), world);
  assert.ok(measured);
  const plan = planOrthogonalReflection(measured);
  assert.ok(plan);
  assert.deepEqual(plan.axes, [6, 6]);
  const moved = shiftReflectionPoints(new Set(measured.body), [...plan.translation]);
  const covered = new Set([...moved, ...copies(moved, plan.axes)]);
  assert.ok(world.targets.every(cell => covered.has(cell)));

  const prediction = moveOrthogonalContributor(measured, [0, 1]);
  assert.deepEqual(prediction.axes, [2, 4]);
  assert.deepEqual(prediction.body, measured.body);
  assert.equal(reconcileOrthogonalReflection(prediction, render(measured), measured), null);
  assert.ok(reconcileOrthogonalReflection(prediction, render(prediction), measured));
  assert.equal(selectOrthogonalContributor(prediction, render(prediction)), null);
  assert.equal(selectOrthogonalContributor(prediction, render({ ...prediction, focus: 0 }))?.focus, 0);
});

test('admit a newly visible mark only where the previous layout could have hidden it', () => {
  const hidden = { ...world, targets: [...world.targets, '5,3'] };
  const measured = measureOrthogonalReflection(render(hidden), hidden);
  assert.ok(measured);
  assert.ok(!measured.targets.includes('5,3'));
  const forecast = moveOrthogonalContributor(measured, [0, 1]);
  const actual = moveOrthogonalContributor(hidden, [0, 1]);
  assert.ok(reconcileOrthogonalReflection(forecast, render(actual), measured)?.targets.includes('5,3'));
  assert.equal(reconcileOrthogonalReflection(forecast, render({ ...actual, targets: [...actual.targets, '0,0'] }), measured), null);
});
