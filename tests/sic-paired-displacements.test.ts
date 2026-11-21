import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fresh,
  geometry,
  imagine,
  localEffects,
  law,
} from '../src/sic/paired-displacements.ts';
import type { Scene, Reading } from '../src/sic/paired-scene.ts';
import { carryPair, inquiry } from '../src/sic/probe-paired-displacements.ts';
const s: Scene = {
  grid: { pitch: 3, left: 0, top: 0, columns: 7, rows: 5 },
  floor: 2,
  bodies: [9, 3],
  accent: 4,
  cargo: 'crate',
  ground: Array.from({ length: 35 }, (_, i) => i),
  medium: [],
  goals: [6, 34],
  doors: [],
  other: [],
  origin: [0, 16],
  features: [],
  initial: Array(35).fill(''),
};
test('a common displacement discriminates a field from direct contact and carries only witnessed effects', () => {
  const m = fresh();
  m.motors['ACTION4'] = { dx: 1, dy: 0, ref: 'earlier move' };
  m.scope = 'area seen';
  m.radius = 1;
  const before: Reading = {
    subjects: [0, 16],
    active: 1,
    pieces: [9, 23, 33],
    supports: [],
    opened: [],
    anchor: -1,
  };
  const next = imagine(s, geometry(s), before, 'ACTION4', m, 'field')!;
  assert.deepEqual(next.pieces, [10, 24, 33]);
  localEffects(s, m, before, next, 'ACTION4', 'two remote objects moved');
  assert.equal(law(m, 1), 'field');
  const q = inquiry();
  q.scene = s;
  q.learning = m;
  assert.equal(carryPair(q, 'level advanced'), undefined);
  q.active = 'selection_exposes_a_spatial_scope';
  const carry = carryPair(q, 'level advanced')!;
  assert.deepEqual(carry.evidence, m.evidence);
  assert.equal('pieces' in carry, false);
  assert.equal('plan' in carry, false);
});
