import assert from 'node:assert/strict';
import test from 'node:test';
import { carryOrientedFogGlyph, chooseFogGlyphStep, observeFogGlyphStep, readFogGlyphRoute } from '../src/sic/fog-glyph-route.ts';
import { chooseOrientedCycleStep, observeOrientedCycleStep, type OrientedCycleState } from '../src/sic/inset-oriented-cycle.ts';

const moves = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];

function cycleFixture() {
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
  return { rows, state };
}

test('a capsule is reachable only while a unit of reserve remains on arrival', () => {
  const { rows, state } = cycleFixture();
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

test('observe a missing color transition with enough reserve to return before planning the exit', () => {
  const { rows, state } = cycleFixture();
  state.layout.charges = [];
  state.layout.color = [8, 4];
  state.layout.wanted.ink = 11;
  rows[0]![2] = 15;
  assert.equal(chooseOrientedCycleStep(rows, state, moves, 8), null);

  rows[0]![3] = 15;
  const contact = chooseOrientedCycleStep(rows, state, moves, 8);
  assert.equal(contact?.purpose, 'test_color');
  assert.deepEqual(contact?.step, [8, 4]);
  assert.ok(contact);

  const observed = structuredClone(rows);
  observed[0]![3] = 5;
  observed[15]![2] = 11;
  for (let y = 4; y < 8; y++) {
    observed[y]!.fill(5, 4, 8);
    observed[y]!.fill(6, 8, 12);
  }
  const next = observeOrientedCycleStep(rows, observed, state, contact);
  assert.equal(next?.state.transitions.color[10], 11);
  assert.ok(next);
  assert.equal(chooseOrientedCycleStep(observed, next.state, moves, 8)?.purpose, 'exit');
});

test('a matching request is confirmed only when its marker disappears after departure', () => {
  const { rows, state } = cycleFixture();
  const first = { at: [8, 4] as const, wanted: state.layout.wanted };
  state.layout.requests = [first, { at: [16, 4], wanted: { ...first.wanted, ink: 11 } }];
  rows[0]!.fill(15, 1, 5);
  const enter = { action: 'ACTION4' as const, step: first.at, target: first.at, purpose: 'exit' as const,
    units: 4, distance: 1, charge: -1 };
  const onRequest = rows.map(row => row.slice());
  onRequest[0]![4] = 5;
  for (let y = 4; y < 8; y++) {
    onRequest[y]!.fill(3, 4, 8);
    onRequest[y]!.fill(6, 8, 12);
  }
  const entered = observeOrientedCycleStep(rows, onRequest, state, enter);
  assert.deepEqual(entered?.state.pendingExit, first.at);
  assert.equal(entered?.state.accepted, undefined);
  assert.ok(entered);
  const departed = onRequest.map(row => row.slice());
  departed[0]![3] = 5;
  for (let y = 4; y < 8; y++) {
    departed[y]!.fill(3, 8, 12);
    departed[y]!.fill(6, 12, 16);
  }
  const leave = { ...enter, step: [12, 4] as const, units: 3 };
  assert.equal(observeOrientedCycleStep(onRequest, departed, entered.state, leave)?.state.accepted?.length, 1);
  departed[4]![8] = state.layout.exitRim;
  assert.equal(observeOrientedCycleStep(onRequest, departed, entered.state, leave)?.state.accepted, undefined);
});

test('partial visibility preserves the oriented motif and counts only the learned reserve dots', () => {
  const { rows, state } = cycleFixture();
  state.rotation = 1;
  state.layout.gauge.dots = [1, 3, 5, 7];
  state.colorEffects = { left: { 10: 11, 12: 13 }, right: { 10: 14, 12: 13 } };
  rows[0]![3] = 15;
  rows[0]![5] = 15;
  rows[15]!.fill(5);
  rows[16]!.splice(1, 3, 9, 10, 10);
  state.layout.display.point = [1, 16];
  for (let y = 4; y < 8; y++) rows[y]!.fill(3, 8, 12);
  rows[5]![13] = 9;
  rows[5]![14] = 10;
  rows[5]![15] = 10;
  const carry = carryOrientedFogGlyph(state, rows, 'exit-confirmed');
  assert.ok(carry);
  assert.deepEqual(carry.oriented?.colors, { 12: 13 });
  assert.equal(readFogGlyphRoute(rows, carry, 2, 'background-without-occlusion'), null);
  rows[8]![4] = 3;
  const fog = readFogGlyphRoute(rows, carry, 2, 'fog-entry');
  assert.ok(fog);
  assert.equal(fog.units, 3);
  assert.deepEqual(fog.target?.at, [12, 4]);
  assert.deepEqual(fog.target?.glyph, fog.glyph);
  const step = chooseFogGlyphStep(fog, moves, 8);
  assert.equal(step?.need, 'exit');
  assert.deepEqual(step?.to, [8, 4]);
  assert.ok(step);

  const next = structuredClone(rows);
  next[0]![5] = 5;
  for (let y = 4; y < 8; y++) {
    next[y]!.fill(3, 4, 8);
    next[y]!.fill(6, 8, 12);
  }
  const measured = observeFogGlyphStep(next, fog, step, 'moved');
  assert.equal(measured?.matched, true);
  assert.equal(measured.state.units, 2);
});
