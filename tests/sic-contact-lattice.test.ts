import assert from 'node:assert/strict';
import test from 'node:test';
import { planOrderedLattice } from '../src/sic/contact-lattice.ts';

test('SIC plans selective displacement when a measured row has the reverse of the reference order', () => {
  const scene = {
    unit: 4, root: [5, 42, 10, 47], field: [11, 6, 52, 47], tip: 16,
    order: ['A', 'B', 'C', 'D'],
    pieces: [
      { id: 'A', type: 'A', bbox: [48, 25, 51, 28] },
      { id: 'B', type: 'B', bbox: [42, 25, 45, 28] },
      { id: 'C', type: 'C', bbox: [36, 25, 39, 28] },
      { id: 'D', type: 'D', bbox: [30, 25, 33, 28] },
    ],
  } as const;
  const effects = [
    { action_ref: 'up', root_translation: [-6, 0], extent_delta: 0 },
    { action_ref: 'extend', root_translation: [0, 0], extent_delta: 6 },
    { action_ref: 'retract', root_translation: [0, 0], extent_delta: -6 },
    { action_ref: 'down', root_translation: [6, 0], extent_delta: 0 },
  ] as const;
  const plan = planOrderedLattice(scene, effects, 88, 1000, () => false);
  assert.ok(plan);
  assert.ok(plan.distance > 1);
  assert.deepEqual(plan.prediction.pieces, scene.pieces.map(({ id, bbox }) => [id, bbox]));
  assert.equal(planOrderedLattice(scene, effects, 88, 1000, () => true), null);
  assert.equal(planOrderedLattice(scene, effects.slice(1, 2), 88, 1000, () => false), null);
});
