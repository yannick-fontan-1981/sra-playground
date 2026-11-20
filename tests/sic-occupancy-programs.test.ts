import assert from 'node:assert/strict';
import test from 'node:test';
import { poseFamilyKey } from '../src/sic/pose-families.ts';
import {
  finishOccupancy,
  newOccupancyMemory,
  observePoses,
  offerOccupancy,
  type PoseView,
} from '../src/sic/occupancy-programs.ts';

const choices = new Set(['move', 'activate']);
const pose = (p: number, r: number): PoseView => ({ person: [p, 4], indicator: [r, 4] });

test('a rotated, reflected or reordered footprint keeps its colour and identity', () => {
  const a = {
    palette_value: 4,
    bbox: [7, 8, 9, 9] as const,
    mask: [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ] as const,
  };
  const b = {
    palette_value: 4,
    bbox: [2, 6, 3, 8] as const,
    mask: [
      [0, 2],
      [1, 0],
      [0, 0],
      [0, 1],
    ] as const,
  };
  assert.equal(poseFamilyKey(a), poseFamilyKey(b));
  assert.notEqual(poseFamilyKey(a), poseFamilyKey({ ...b, palette_value: 8 }));
});

function demonstrated() {
  const m = newOccupancyMemory();
  observePoses(m, 0, 1, pose(0, 2), pose(2, 2), 'activate', 2);
  observePoses(m, 2, 3, pose(4, 6), pose(5, 7), 'move', 3);
  observePoses(m, 4, 4, pose(8, 10), pose(8, 10), 'activate', 4);
  return m;
}
test('a speculative layout is followed by its sealed use only after both coordinates match', () => {
  const m = demonstrated();
  const first = offerOccupancy(m, 4, choices, 20, 20)?.occupancy;
  assert.ok(first);
  assert.equal(first.plan.steps[0]?.stage, 'place');
  assert.equal(first.plan.steps[1]?.stage, 'occupy');
  const [place, arrive] = first.plan.steps;
  assert.ok(place?.nextR && arrive);
  assert.deepEqual(arrive.nextP, place.nextR);
  const after = { person: place.nextP, indicator: place.nextR };
  observePoses(m, 4, 5, pose(8, 10), after, place.op, 5);
  assert.equal(finishOccupancy(m, first, after, true, false, 5).matched, true);
  const continuation = offerOccupancy(m, 5, choices, 20, 20)?.occupancy;
  assert.ok(continuation);
  assert.deepEqual(continuation.plan, first.plan);
  assert.equal(continuation.index, 1);
  const actual = { person: arrive.nextP, indicator: arrive.r };
  assert.equal(finishOccupancy(m, continuation, actual, true, false, 6).matched, true);
});
test('a failed placement is remembered even when a different route predicts the same positions', () => {
  const m = demonstrated(),
    offer = offerOccupancy(m, 4, choices, 20, 20)?.occupancy;
  assert.ok(offer);
  const samePose = pose(8, 10);
  observePoses(m, 4, 4, samePose, samePose, 'move', 5);
  assert.equal(finishOccupancy(m, offer, samePose, true, false, 5).matched, false);
  assert.equal(m.active, null);
  assert.equal(offerOccupancy(m, 4, choices, 20, 20), null);
});
test('different returns from the same public scene invalidate its causal evidence', () => {
  const m = demonstrated();
  observePoses(m, 0, 6, pose(0, 2), pose(0, 2), 'activate', 8);
  assert.equal(m.observed['0/activate'], -1);
  assert.equal(m.pairs['person/indicator']!.hits.activate, undefined);
  assert.equal(offerOccupancy(m, 4, choices, 20, 20), null);
});
