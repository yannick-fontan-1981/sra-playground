import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseOrientedCycleStep, observeOrientedCycleStep, type OrientedCycleState } from '../src/sic/inset-oriented-cycle.ts';

test('a capsule is reachable only while a unit of reserve remains on arrival', () => {
  const rows = Array.from({ length: 20 }, () => Array<number>(20).fill(5));
  for (let y = 4; y < 8; y++) rows[y]!.fill(6, 4, 8);
  rows[15]![1] = 9;
  rows[15]![2] = 10;
  rows[0]![1] = 15;
  const state: OrientedCycleState = {
    epoch: 1, at: [4, 4], spent: 0, seen: [], refs: [], stopped: false, transitions: { shape: {}, color: {} },
    layout: {
      epoch: 1, ref: 'fixture', pitch: 4, floor: 3,
      gauge: { line: 0, active: 15, depleted: 5, dots: [1, 2, 3, 4], perMove: 1, observations: 2 },
      body: Array<number>(16).fill(6), patternStation: [], exitRim: 5, fullReserve: 4,
      display: { point: [1, 15], side: 3, scale: 1, palette: [9, 10], target: '' },
      points: [[4, 4], [8, 4], [12, 4]], charges: [[8, 4]], exit: [12, 4],
      shape: [4, 0], color: [8, 0], orientation: [12, 0], orientationStamp: [],
      displayGround: 5, anchorInk: 9, wanted: { ink: 10, mask: '110000000', turn: 0 },
    },
  };

  const moves = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
  assert.equal(chooseOrientedCycleStep(rows, state, moves, 8), null);
  rows[0]![2] = 15;
  const step = chooseOrientedCycleStep(rows, state, moves, 8);
  assert.deepEqual(step, {
    action: 'ACTION4', step: [8, 4], target: [8, 4], purpose: 'recharge', units: 2, distance: 2, charge: 0, walk: [],
  });
  assert.ok(step);
  const next = structuredClone(rows);
  next[0]!.fill(15, 1, 5);
  for (let y = 4; y < 8; y++) {
    next[y]!.fill(5, 4, 8);
    next[y]!.fill(6, 8, 12);
  }
  const actual = observeOrientedCycleStep(rows, next, state, step);
  assert.ok(actual);
  assert.equal(Object.hasOwn(actual.state, 'rotation'), false);
  assert.equal(actual.state.spent, 1);
});
