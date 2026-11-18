import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseGravityReversal, gravityReturn, gravityStateKey, gravityTerrain,
  type GravityHistory, type GravityStep, type GravityView } from '../src/sic/reversible-gravity.ts';

test('protects the actor before reversing toward an offscreen exit', () => {
  const tiles: GravityView['tiles'] = Array(21).fill('wall');
  const actor = 10, ceiling = 7, inverter = 14;
  tiles[4] = 'danger';
  tiles[ceiling] = 'ceiling_open';
  tiles[actor] = 'air';
  tiles[inverter] = 'inverter';
  const view: GravityView = { origin: [2, 2], pitch: 6, width: 3, tiles, at: actor, actor: [8, 18, 9, 21], exit: null, inverterInk: 2 };
  const memory: GravityHistory = { direction: 1, rowOrigin: 0, highest: 3, lowest: 3, inverted: true, denied: [],
    seen: [gravityStateKey(view, 0, 1)], terrain: gravityTerrain(view, 0, { '1,-4': 'exit' }) };

  const prepare = chooseGravityReversal(view, memory, 9, true);
  assert.deepEqual([prepare?.index, prepare?.edit, prepare?.direction], [ceiling, 'solidify', 1]);

  const protectedTiles = [...tiles];
  protectedTiles[ceiling] = 'ceiling_solid';
  const reverse = chooseGravityReversal({ ...view, tiles: protectedTiles }, memory, 8, true);
  assert.deepEqual([reverse?.index, reverse?.edit, reverse?.direction, reverse?.landing], [inverter, 'invert', -1, actor]);
});

test('recover a landing from successive visible overlaps across an animated scroll', () => {
  const width = 4, height = 6, at = width * 2 + 1;
  const scene = (firstRow: number): GravityView => ({
    width, origin: [2, 2], pitch: 6, at, actor: [8, 12, 9, 15], exit: null, inverterInk: 2,
    tiles: Array.from({ length: width * height }, (_, index) =>
      (firstRow + Math.floor(index / width)) & (1 << (index % width)) ? 'wall' : 'danger'),
  });
  const before = scene(0), after = scene(9);
  const memory: GravityHistory = { direction: -1, rowOrigin: 0, highest: 2, lowest: 2, inverted: false,
    seen: [], denied: [], terrain: gravityTerrain(before, 0) };
  const step: GravityStep = { command: { action_ref: 'ACTION6', data: { x: 2, y: 8 } }, index: 4,
    landing: 21, direction: 1, frontier: true, edit: 'invert' };
  assert.equal(gravityReturn(before, after, step, memory), null);
  const aligned = gravityReturn(before, after, step, memory, () => [scene(3), scene(6)]);
  assert.deepEqual([aligned?.shift, aligned?.landing, aligned?.matched, aligned?.alignedThroughAnimation], [9, 11, true, true]);
  const recalled = gravityReturn(before, after, step, {
    ...memory, reversedHere: true, terrain: gravityTerrain(after, 9, memory.terrain),
  });
  assert.deepEqual([recalled?.shift, recalled?.landing, recalled?.matched, recalled?.alignedThroughMemory], [9, 11, true, true]);
});

test('align a frontier fall with remembered terrain in the direction of travel', () => {
  const width = 4, height = 7;
  const tiles: GravityView['tiles'] = Array.from({ length: width * height }, (_, i) =>
    (Math.floor(i / width) + 1) & (1 << (i % width)) ? 'wall' : 'danger');
  const before: GravityView = { width, tiles, origin: [2, 2], pitch: 6, at: 21, actor: [8, 30, 9, 33],
    exit: null, inverterInk: 2 };
  const after: GravityView = { ...before, at: 9, actor: [8, 12, 9, 15] };
  const memory: GravityHistory = { direction: 1, supportHeading: -1, rowOrigin: 0, highest: 5, lowest: 5,
    inverted: true, reversedHere: true, seen: [], denied: [],
    terrain: gravityTerrain(after, 10, gravityTerrain(before, 0)) };
  const step: GravityStep = { command: { action_ref: 'ACTION4', data: {} }, index: 21,
    landing: 25, direction: 1, frontier: true, edit: null };
  const aligned = gravityReturn(before, after, step, memory);
  assert.deepEqual([aligned?.shift, aligned?.landing, aligned?.matched, aligned?.alignedThroughMemory], [10, 12, true, true]);
});

test('prepare a landing above a visible hazard before the first inversion of a new board', () => {
  const width = 3, at = 7;
  const tiles: GravityView['tiles'] = [
    'wall', 'wall', 'wall',
    'inverter', 'wall', 'wall',
    'wall', 'air', 'air',
    'wall', 'air', 'air',
    'wall', 'ceiling_open', 'air',
    'wall', 'danger', 'air',
  ];
  const view: GravityView = { origin: [2, 2], pitch: 6, width, tiles, at, actor: [8, 12, 9, 15], exit: null, inverterInk: 2 };
  const memory: GravityHistory = { direction: -1, rowOrigin: 0, highest: 2, lowest: 2, inverted: true, denied: [],
    seen: [gravityStateKey(view, 0, -1)], terrain: gravityTerrain(view, 0) };
  const prepare = chooseGravityReversal(view, memory, 9, true);
  assert.deepEqual([prepare?.edit, prepare?.index], ['solidify', 13]);
  const supported = { ...view, tiles: tiles.map((tile, index) => index === 13 ? 'ceiling_solid' as const : tile) };
  const turn = chooseGravityReversal(supported, memory, 8, true);
  assert.deepEqual([turn?.edit, turn?.index, turn?.landing], ['invert', 3, 10]);
});

test('remove the inverter blocking a visible exit when an observed corridor permits a safe detour', () => {
  const width = 5, at = 19, exit = 15, gate = 17;
  const tiles: GravityView['tiles'] = Array(30).fill('wall');
  tiles[at] = 'air'; tiles[exit] = 'exit';
  tiles[16] = 'air'; tiles[18] = 'air'; tiles[gate] = 'inverter'; tiles[13] = 'air'; tiles[14] = 'air';
  const view: GravityView = { origin: [2, 2], pitch: 6, width, tiles, at, actor: [26, 18, 27, 21], exit, inverterInk: 2 };
  const memory: GravityHistory = { direction: 1, rowOrigin: 0, highest: 3, lowest: 3, inverted: true, reversedHere: true,
    seen: [gravityStateKey(view, 0, 1)], denied: [], terrain: gravityTerrain(view, 0) };
  const plan = chooseGravityReversal(view, memory, 9, true);
  assert.deepEqual([plan?.edit, plan?.index, plan?.landing], ['invert', gate, 14]);
});
