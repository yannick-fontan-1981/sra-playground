import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesWorkshopState, planWorkshopTurn, type WorkshopLayout } from '../src/sic/stocked-service-turn.ts';

const shop: WorkshopLayout = { unit: 3, materials: [4, 6],
  rooms: [{ marker: 10, places: [[0, 0], [3, 0]], slots: [3], fuel: 1, input: 0, output: 1, furnace: [9, 0], cold: [],
    burn: [[1, 1]], rewrite: [[2, 2]] }] };
const workers = [0, 0], stop = () => false;

test('two workers may reserve distinct copies of the same material in one turn', () => {
  const starting = { stock: [[2, 0]], workers, hot: [false] };
  const turn = planWorkshopTurn(shop, starting, 4, stop);
  assert.deepEqual(turn?.jobs.map(job => job?.kind), ['rewrite', 'rewrite']);
  assert.deepEqual(turn?.expected.stock, [[0, 2]]);
  assert.equal(planWorkshopTurn(shop, starting, 3, stop), null);
});

test('a cooling furnace remains unavailable and consumes at most one crate when ready', () => {
  const warm = { stock: [[0, 2]], workers, hot: [true] };
  const pause = planWorkshopTurn(shop, warm, 4, stop);
  assert.deepEqual(pause?.jobs, [null, null]);
  assert.deepEqual(pause?.expected, { stock: [[0, 2]], workers, hot: [false] });
  const ready = planWorkshopTurn(shop, pause!.expected, 3, stop);
  assert.equal(ready?.jobs.filter(job => job?.kind === 'burn').length, 1);
  assert.deepEqual(ready?.expected.stock, [[0, 1]]);
  assert.deepEqual(ready?.expected.hot, [true]);
});

test('turn reconciliation compares the measured fields regardless of key order in persisted evidence', () => {
  const measured = { stock: [[1, 0]], workers, hot: [true] };
  const persisted = { hot: [true], stock: [[1, 0]], workers };
  assert.equal(matchesWorkshopState(measured, persisted), true);
  assert.equal(matchesWorkshopState(measured, { ...persisted, hot: [false] }), false);
  assert.equal(matchesWorkshopState(measured, { ...persisted, stock: [[2, 0]] }), false);
});
