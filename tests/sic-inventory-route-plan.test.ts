import assert from 'node:assert/strict';
import test from 'node:test';
import { planInventoryRoute, type InventoryPosition, type InventoryRouteMap } from '../src/sic/inventory-route-plan.ts';

test('a retained key serves two gates while a second key uses the free slot', () => {
  const map: InventoryRouteMap = {
    nodes: [null, 0, null, 1, 2, null].map((gate, column) => ({
      at: [0, column], ordinary: gate === null, gate, charge: false,
    })),
    goal: 5,
    recharge: 0,
    gateKeys: [0, 1, 0],
    reusable: [0],
  };
  const start: InventoryPosition = { at: 0, held: [null, null], objects: [0, 2], opened: 0, charged: false, energy: 8 };
  const moves: Parameters<typeof planInventoryRoute>[2] = [{ input: 'ACTION4', delta: [0, 1] }];
  const route = planInventoryRoute(map, start, moves, 'ACTION5', 7);
  assert.ok(route);
  assert.deepEqual(route.map(step => [step.kind, step.position.held]), [
    ['pick', [0, null]],
    ['unlock', [0, null]],
    ['walk', [0, null]],
    ['pick', [0, 1]],
    ['unlock', [0, null]],
    ['unlock', [0, null]],
    ['finish', [0, null]],
  ]);
  assert.equal(planInventoryRoute({ ...map, reusable: [] }, start, moves, 'ACTION5', 7), null);
});
