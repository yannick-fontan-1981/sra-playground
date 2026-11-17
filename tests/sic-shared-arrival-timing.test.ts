import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfiguredScene } from '../src/logos-engine/v6-configured-arrivals.ts';
import { planTimedArrival, type ArrivalTiming, type TimedNetwork } from '../src/sic/shared-arrival-timing.ts';

test('a closed admission phase delays entry into the next cell', () => {
  const base = new Set(['0,0', '1,0', '2,0', '2,1', '2,2', '2,3']);
  const scene: ConfiguredScene = { grid: [1, 0, 0], actors: [[9, 0, 0], [10, 2, 3]], target: [2, 0],
    cells: new Map(), base, candidates: [], background: new Set(), floor: 0 };
  const network: TimedNetwork = { gates: [], pads: new Map(), nodes: base,
    clocks: new Map([['1,0', { point: [1, 0], mark: '1/5' }]]) };
  const timing: ArrivalTiming = { orders: [[[0, -1], [1, 0], [0, 1], [-1, 0]]], delays: {}, observed: [null, null],
    clocks: { '1,0': [true, false, true] } };
  assert.deepEqual(planTimedArrival(scene, network, timing, 1), { edits: [], ticks: [3], matchingOrders: 1 });
  assert.equal(planTimedArrival(scene, network, { ...timing, clocks: { '1,0': [false, true, false] } }, 1), null);
  assert.equal(planTimedArrival(scene, network, { ...timing, clocks: {} }, 1), null);

  network.pads.set('0,0', 'brake');
  assert.deepEqual(planTimedArrival(scene, network, { ...timing, delays: { brake: 1 } }, 1)?.ticks, [3]);
  assert.equal(planTimedArrival(scene, network, { ...timing, delays: { brake: 2 } }, 1), null);
});
