import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { chooseGlyphRoute, observeGlyphRoute, readGlyph, type GlyphRouteState, type GlyphRouteStep } from '../src/sic/managed-glyph-access.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { measureGlyphStationCycle, observeGlyphWorkshop, type GlyphWorkshopState } from '../src/sic/managed-glyph-workshop.ts';

test('a glyph occupying the corner keeps its foreground when the display background is known', () => {
  const rows = [[8, 8, 5, 5], [8, 8, 5, 5], [5, 5, 8, 8], [5, 5, 8, 8]];
  assert.deepEqual(readGlyph(rows, [0, 0, 3, 3], 2, 5), { ink: 8, mask: '0,0;1,1' });
});

test('the joint station cycle is measured through occlusion using separated repeats', () => {
  const full: [number, number][][] = Array.from({ length: 6 }, (_, i) => [[i % 2, 0], [0, i % 3]]);
  const history = Array.from({ length: 13 }, (_, i) => full[i % 6]!.map(point => point as [number, number] | null));
  history[2]![0] = null;
  history[7]![1] = null;
  assert.equal(measureGlyphStationCycle(history.slice(0, -1)), undefined);
  assert.deepEqual(measureGlyphStationCycle(history), full);
  history[12]![0] = [3, 0];
  assert.equal(measureGlyphStationCycle(history), undefined);
});

test('tracking before the station period is known publishes valid retained state', () => {
  const frame = (x: number, reserve: number) => {
    const rows = Array.from({ length: 10 }, () => Array<number>(10).fill(0));
    rows[1]![1] = 7;
    for (let y = 3; y < 6; y++) rows[y]!.fill(2, x, x + 3);
    rows[9]!.fill(1, 0, reserve);
    return rows;
  };
  const state: GlyphWorkshopState = {
    epoch: 1, at: [0,3], refs: [], history: [[]], shapes: [], colors: [], landings: [], acquired: 0, spent: 0, blocked: [], visits: [],
    layout: {
      epoch: 0, evidence: 'previous-win', pitch: 3, actor: Array<number>(9).fill(2), floor: 0, peerScale: 1,
      bandInks: [], directions: ['ACTION4'], reserve: { row: 9, left: 0, right: 6, active: 1, depleted: 0, cost: 1, samples: 1 },
      display: { point: [0,0], scale: 1, side: 3 }, shownBox: [0,0,2,2], exit: [6,3], exitBox: [6,3,8,5],
      positions: [[0,3],[3,3]], cells: [[0,3],[3,3]], goals: [], stations: [], charges: [], turn: 1,
    },
  };
  const observed = observeGlyphWorkshop(frame(0, 6), frame(3, 5), state, {
    action: 'ACTION4', entry: [3,3], step: [3,3], effect: null, purpose: 'track_stations', target: [3,3], units: 6, distance: 1, goal: 0,
  }, 'after-move');
  assert.ok(observed?.matched);
  assert.deepEqual(retainNativeJson(observed.state).at, [3,3]);
  assert.equal(Object.hasOwn(observed.state, 'cycle'), false);
});

const left: NativePoint = [0, 6], middle: NativePoint = [3, 6], right: NativePoint = [6, 6];
const start: NativePoint = [0, 9], adjacent: NativePoint = [3, 9], exit: NativePoint = [6, 9];
const directions = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] as const;
const body = Array<number>(9).fill(7), station = [1, 1, 1, 1, 3, 1, 1, 1, 1];
const shape = '0,0;0,1;1,1', turned = '0,0;0,1;1,0';

function frame(actor: NativePoint, patrol: NativePoint, units: number, orientation = shape) {
  const rows = Array.from({ length: 24 }, () => Array<number>(24).fill(1));
  const paintTile = ([x, y]: NativePoint, pixels: number[]) => pixels.forEach((pixel, i) => {
    rows[y + Math.floor(i / 3)]![x + i % 3] = pixel;
  });
  paintTile(patrol, station);
  paintTile(actor, body);
  for (const point of orientation.split(';')) {
    const [x, y] = point.split(',').map(Number);
    rows[y! + 17]![x! + 3] = 6;
  }
  rows[20]!.fill(9, 0, units);
  return rows;
}

function initial(): GlyphRouteState {
  const cells = [left, middle, right, start, adjacent, exit];
  return { epoch: 2, at: start, landings: [], blocked: [], spent: [], shapeEffects: [], colorEffects: [], refs: ['prior'],
    layout: { epoch: 1, evidence: 'prior', actor: body, floor: 1, pitch: 3, peerScale: 2, directions: [...directions], bandInks: [],
      reserve: { row: 20, left: 0, right: 24, active: 9, depleted: 1, cost: 1, samples: 1 }, positions: cells, cells,
      charges: [], shape: [9, 3], color: [12, 3], exit, shownBox: [2, 16, 5, 19], exitBox: [6, 9, 8, 11],
      display: { point: [2, 16], side: 4, scale: 1 }, wanted: { mask: turned, ink: 6 } },
    rotation: { rule: { shape, station, delta: 1, peerScale: 2, evidence: 'prior' }, sites: [left], observations: [left], witnesses: [] } };
}

test('moving rotation retains both visits to the middle and verifies phase before continuing a route', () => {
  const path = [middle, right, middle, left, middle, right, middle, left];
  let state = initial(), rows = frame(start, left, 24);
  for (const [i, site] of path.entries()) {
    const point = i % 2 ? start : adjacent;
    const step: GlyphRouteStep = { action: i % 2 ? 'ACTION3' : 'ACTION4', step: point, entry: point, target: exit,
      units: 24 - i, distance: 1, purpose: 'exit', effect: null };
    const next = frame(point, site, 23 - i);
    const result = observeGlyphRoute(rows, next, state, step, 'return-' + i);
    assert.ok(result?.matched);
    state = result.state;
    rows = next;
    assert.equal(state.rotation?.period, i === 7 ? 4 : undefined);
  }
  const plan = chooseGlyphRoute(frame(adjacent, left, 16), { ...state, at: adjacent }, directions, 'current', 16);
  assert.deepEqual(plan?.rotationAfter, middle);
  assert.equal(plan?.effect, 'rotation');

  const walk: GlyphRouteStep = { action: 'ACTION4', step: adjacent, entry: adjacent, target: exit,
    units: 16, distance: 1, purpose: 'exit', effect: null, rotationAfter: middle };
  const drift = observeGlyphRoute(rows, frame(adjacent, left, 15), state, walk, 'unexpected');
  assert.equal(drift?.matched, false);
  assert.equal(drift?.reason, 'rotation_phase_changed');
  assert.equal(drift?.state.rotation?.period, undefined);

  const contact: GlyphRouteStep = { action: 'ACTION1', step: middle, entry: middle, target: middle,
    units: 16, distance: 1, purpose: 'test_rotation', effect: 'rotation', rotationAfter: middle };
  const hidden = observeGlyphRoute(frame(adjacent, left, 16), frame(middle, middle, 15, turned),
    { ...state, at: adjacent }, contact, 'overlap');
  assert.ok(hidden?.matched);
  assert.equal(hidden.reason, 'rotation_contact_observed');
  assert.equal(hidden.state.rotation?.period, 4);
});
