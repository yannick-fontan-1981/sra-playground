import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseGravityReversal, gravityStateKey, gravityTerrain, type GravityHistory, type GravityView } from '../src/sic/reversible-gravity.ts';

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
