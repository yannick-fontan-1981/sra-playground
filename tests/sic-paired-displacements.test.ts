import {
  recognizeProjection,
  images,
  applyImages,
} from '../src/sic/paired-previews.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fresh,
  key,
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

test('a visible landing becomes a prediction at another distance only after displacement', () => {
  const room: Scene = {
    ...s,
    other: [16],
    initial: Array(35).fill('4,4,4,4,4,4,4,4,4'),
    goals: [5, 6],
  };
  room.initial[16] = 'pivot';
  const before: Reading = {
    subjects: [0, 1],
    active: 0,
    pieces: [30],
    supports: [],
    opened: [],
    anchor: -1,
  };
  const tiles = [...room.initial];
  tiles[18] = '9,9,9,9,2,9,9,9,9';
  assert.deepEqual(
    recognizeProjection(room, before, before, tiles, 'no motion'),
    [],
  );
  const rules = recognizeProjection(
    room,
    before,
    { ...before, pieces: [18] },
    tiles,
    'observed',
  );
  assert.equal(rules.length, 1);
  const later = { ...before, pieces: [23] };
  assert.deepEqual(applyImages(later, images(room, later, rules))?.pieces, [
    17,
  ]);
});
import {
  startPassage,
  recallProjectedPassage,
  projectedPassage,
  watchPassage,
} from '../src/sic/prepare-projected-passage.ts';
test('an imagined landing needs a visible indication on supported ground before the operation', () => {
  const room: Scene = {
    ...s,
    ground: [0, 1, 2, 7, 8, 9, 16, 18, 19, 25, 26],
    goals: [19, 26],
    other: [16],
    initial: Array(35).fill('2,2,2,2,2,2,2,2,2'),
  };
  room.initial[16] = 'pivot';
  const m = fresh(),
    v: Reading = {
      subjects: [2, 7],
      active: 0,
      pieces: [],
      supports: [],
      opened: [],
      anchor: -1,
    };
  m.motors['ACTION2'] = { dx: 0, dy: 1, ref: 'observed' };
  m.passage = startPassage(room);
  watchPassage(room, m, v, v, room.initial, 'observation', 'ACTION2');
  assert.notEqual(
    projectedPassage(room, m, v, 'observation', 20, 100)?.command,
    'ACTION5',
  );
  const image = room.initial.slice();
  image[18] = '2,4,2,4,4,4,2,4,2';
  watchPassage(room, m, v, v, image, 'indication', 'ACTION2');
  assert.equal(
    projectedPassage(room, m, v, 'indication', 20, 100)?.command,
    'ACTION5',
  );
  watchPassage(
    room,
    m,
    v,
    { ...v, subjects: [18, 7] },
    room.initial,
    'crossed',
    'ACTION5',
  );
  assert.equal(m.passage?.evidence, 'crossed');
  assert.deepEqual(m.passage?.orientation, [0, 3]);
});

test('switching the operator requires a reachable arrangement while the first subject stays put', () => {
  const room: Scene = {
    ...s,
    ground: [8, 10, 24, 34],
    goals: [24],
    other: [9, 20],
    initial: Array(35).fill('floor'),
  };
  room.initial[9] = 'striped fixture';
  room.initial[20] = 'round fixture';
  const v: Reading = {
    subjects: [34, 8], active: 0, pieces: [], supports: [], opened: [], anchor: -1,
  };
  const m = fresh();
  m.evidence = [{ walk: 2 }, { push: 2 }];
  m.motors.ACTION3 = { dx: -1, dy: 0, ref: 'walked left' };
  m.motors.ACTION4 = { dx: 1, dy: 0, ref: 'walked right' };
  m.projections = [{ pivotForm: 'striped fixture', from: 2, to: 1, ref: 'crossing observed' }];
  assert.equal(recallProjectedPassage(room, m, v, room.initial), undefined);
  m.visits[key(v)] = 2;
  m.passage = recallProjectedPassage(room, m, v, room.initial);
  assert.equal(m.passage?.pivot, 9);
  const firstContact: Reading = { ...v, subjects: [8, 34] };
  watchPassage(room, m, firstContact, firstContact, room.initial, 'first subject blocked', 'ACTION4');
  const action = projectedPassage(room, m, v, 'seen', 8, 40);
  assert.deepEqual(action?.expected.subjects, v.subjects);
  assert.equal(action?.expected.active, 1);
  assert.ok(action?.evidence.includes('crossing observed'));
  assert.deepEqual(action?.projectedSetup, {
    operator: 1, pivot: 10, launch: 8, landing: 24, firstCommand: 'ACTION4',
  });
  const selected = { ...v, active: 1 as const };
  assert.equal(projectedPassage(room, m, selected, 'selection confirmed', 8, 40)?.command, 'ACTION4');
  watchPassage(room, m, selected, selected, room.initial, 'second subject also blocked', 'ACTION4');
  assert.equal(projectedPassage(room, m, v, 'same room, contact refuted', 8, 40), undefined);
});
