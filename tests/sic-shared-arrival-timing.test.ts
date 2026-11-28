import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfiguredScene } from '../src/logos-engine/v6-configured-arrivals.ts';
import { planTimedArrival, timedNetwork, type ArrivalTiming, type TimedNetwork } from '../src/sic/shared-arrival-timing.ts';

test('a closed admission phase delays entry into the next cell', () => {
  const base = new Set(['0,0', '1,0', '2,0', '2,1', '2,2', '2,3']);
  const scene: ConfiguredScene = { grid: [1, 0, 0], actors: [[9, 0, 0], [10, 2, 3]], target: [2, 0],
    cells: new Map(), base, candidates: [], background: new Set(), floor: 0 };
  const network: TimedNetwork = { gates: [], pads: new Map(), nodes: base,
    clocks: new Map([['1,0', { point: [1, 0], mark: '1/5' }]]) };
  const timing: ArrivalTiming = { orders: [[[0, -1], [1, 0], [0, 1], [-1, 0]]], delays: {}, observed: [null, null],
    clocks: { '1,0': [true, false, true] } };
  assert.deepEqual(planTimedArrival(scene, network, timing, 1), { edits: [], ticks: [3], matchingOrders: 1 });
  assert.equal(planTimedArrival(scene, network, timing, 1, undefined, [], () => true), null);
  assert.equal(planTimedArrival(scene, network, { ...timing, clocks: { '1,0': [false, true, false] } }, 1), null);
  assert.equal(planTimedArrival(scene, network, { ...timing, clocks: {} }, 1), null);

  network.pads.set('0,0', 'brake');
  assert.deepEqual(planTimedArrival(scene, network, { ...timing, delays: { brake: 1 } }, 1)?.ticks, [3]);
  assert.equal(planTimedArrival(scene, network, { ...timing, delays: { brake: 2 } }, 1), null);
});

test('arrival planning consumes the observed prefix before the steady admission cycle', () => {
  const base = new Set(['0,0', '1,0', '2,0', '2,1', '2,2', '2,3', '2,4']);
  const scene: ConfiguredScene = { grid: [1, 0, 0], actors: [[9, 0, 0], [10, 2, 4]], target: [2, 0],
    cells: new Map(), base, candidates: [], background: new Set(), floor: 0 };
  const network: TimedNetwork = { gates: [], pads: new Map(), nodes: base,
    clocks: new Map([['1,0', { point: [1, 0], mark: '1/5' }]]) };
  const timing: ArrivalTiming = { orders: [[[0, -1], [1, 0], [0, 1], [-1, 0]]], delays: {}, observed: [null, null],
    clocks: { '1,0': [true, false, true] } };
  assert.equal(planTimedArrival(scene, network, timing, 1), null);
  assert.deepEqual(planTimedArrival(scene, network, { ...timing, clockPrefixes: { '1,0': [true, false, false] } }, 1)?.ticks, [4]);
  assert.equal(planTimedArrival(scene, network, { ...timing, clockPrefixes: { '1,0': [true, null, false] } }, 1), null);
});

test('measure a wider gate network when there is a periodic admission mark', () => {
  const scene: ConfiguredScene = { grid: [3, 1, 1], actors: [[9, 1, 4], [10, 4, 4], [11, 7, 4]], target: [10, 4],
    cells: new Map(), base: new Set(), candidates: [], background: new Set([0, 4]), floor: 0 };
  for (let i = 0; i < 13; i++) {
    const point = [1 + 3 * i, 1];
    scene.cells.set(point.join(','), { point, open: true, patch: [[0, 6, 0], [0, 4, 0], [0, 6, 0]] });
  }
  scene.cells.set('13,4', { point: [13, 4], open: false, patch: [[4, 4, 4], [4, 7, 4], [4, 4, 4]] });
  assert.equal(timedNetwork(scene), null);
  scene.cells.set('16,4', { point: [16, 4], open: true, patch: [[0, 6, 0], [0, 9, 0], [0, 6, 0]] });
  const network = timedNetwork(scene);
  assert.equal(network?.gates.length, 13);
  assert.equal(network?.clocks.size, 1);
});
