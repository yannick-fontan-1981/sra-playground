import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRoomStep, type RoomRoute } from '../src/sic/revealed-compartment-route.ts';

const route: RoomRoute = {
  grid: { side: 5, start: [5, 5], goal: [25, 5] },
  rooms: [{ box: [5, 5, 9, 9], ink: 7, floor: [[5, 5]], controls: [] }],
  phase: 'survey', control: [20, 5], tried: [], capacity: null, passage: [10, 5], stopped: false,
  resources: {
    meter: { bar: [0, 30, 15, 31], capacity: [20, 30, 21, 31], ink: 6, pips: [[20, 30]], freeInk: 11 },
    reserve: 12, free: 1, refills: [], opened: [[10, 5]],
    controls: [{ point: [20, 5], identity: [9, 11, 9], active: false }],
  },
  dark: { candidates: [[15, 5], [10, 10], [15, 10], [20, 10]], reached: [], refused: [] },
};

test('an uncharted approach probes just the next tile and heads around a refused tile', () => {
  const first = nextRoomStep(route, [10, 5]);
  assert.deepEqual(first?.at, [15, 5]);
  assert.equal(first?.probe, true);
  assert.equal(first?.contact, false);
  const revised = nextRoomStep({ ...route, dark: { ...route.dark!, refused: ['10,5>15,5'] } }, [10, 5]);
  assert.deepEqual(revised?.at, [10, 10]);
  assert.deepEqual(revised?.target, [20, 5]);
  assert.equal(revised?.probe, true);
});

test('a remembered landing is reusable on the way to a distant control', () => {
  const next = nextRoomStep({ ...route, dark: { ...route.dark!, reached: [[15, 5]] } }, [10, 5]);
  assert.deepEqual(next?.at, [15, 5]);
  assert.equal(next?.probe, undefined);
});
