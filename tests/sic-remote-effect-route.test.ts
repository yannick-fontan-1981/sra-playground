import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { aimRoute, readGauge, type AimPose, type RemoteRoute } from '../src/sic/remote-effect-route.ts';

test('changing the movement scale can make a previously unreachable firing line reachable', () => {
  const rows: NativeRows = Array.from({ length: 10 }, () => Array<number>(14).fill(0));
  const route: RemoteRoute = { field: [0, 0, 13, 9], target: [10, 2, 13, 5], core: [11, 3, 12, 4],
    barrier: [9, 6, 9, 9], exit: [10, 6, 13, 9], floor: 0,
    witness: { epoch: 1, side: 4, unit: 4, frontInk: 6, backInk: 7, refs: [] } };
  const large: AimPose = { box: [0, 1, 3, 4], heading: 'ACTION4' };
  const small: AimPose = { box: [0, 1, 1, 2], heading: 'ACTION4' };
  const directions = ['ACTION2', 'ACTION4'];
  assert.equal(aimRoute(rows, route, large, directions, 'aim', 10), null);
  const fine = { ...route, witness: { ...route.witness, side: 2, unit: 2 } };
  assert.equal(aimRoute(rows, fine, small, directions, 'aim', 10)?.action, 'ACTION2');
});

test('a resource contact and an opened exit are separate goals for the smaller footprint', () => {
  const rows = Array.from({ length: 2 }, () => [0, 0, 0, 0, 0, 0, 5, 5, 8, 8, 9, 9, 9, 9]);
  const route: RemoteRoute = { field: [0, 0, 13, 1], target: [0, 0, 1, 1], core: [0, 0, 0, 0],
    barrier: [8, 0, 9, 1], exit: [10, 0, 13, 1], supply: [6, 0, 7, 1], floor: 0,
    witness: { epoch: 1, side: 2, unit: 2, frontInk: 6, backInk: 7, refs: [] } };
  const actor: AimPose = { box: [0, 0, 1, 1], heading: 'ACTION4' };
  assert.equal(aimRoute(rows, route, actor, ['ACTION4'], 'supply', 10)?.distance, 3);
  assert.equal(aimRoute(rows, route, actor, ['ACTION4'], 'exit', 10), null);
  assert.equal(aimRoute(rows, route, actor, ['ACTION4'], 'exit', 10, true)?.distance, 5);
  assert.equal(readGauge([[0, 0], [5, 0], [5, 5], [5, 5]], [0, 0, 1, 3], 5), 2);
});
