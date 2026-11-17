import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCarriedStep, observeCarriedStep, type CarriedSupport } from '../src/sic/carried-support-route.ts';

function scene(actorY: number | null) {
  const rows = Array.from({ length: 10 }, () => Array<number>(16).fill(0));
  for (let y = 1; y <= 4; y++) rows[y]!.fill(5, 5, 9);
  rows[4]![8] = 0;
  rows[2]!.fill(7, 10, 12);
  rows[3]!.fill(7, 10, 12);
  if (actorY !== null) {
    rows[actorY]!.fill(3, 1, 3);
    rows[actorY + 1]!.fill(3, 1, 3);
  }
  return rows;
}

test('an animated loss and return blocks a switch only from the affected footing', () => {
  const state: CarriedSupport = {
    layout: {
      field: [0, 0, 13, 9], voids: [0], actorInk: 3, targetInk: 2, pitch: 2,
      toolInk: 5, handleInk: 7, handleArea: 4, railInk: 6, mouth: { axis: 0, high: true },
      supportMask: [[0, 0], [0, 1], [1, 0], [1, 1]], supportSize: [2, 2], priorControlInks: [],
      buttons: [], latch: [14, 3, 15, 4], switches: [{ ink: 9, box: [14, 0, 15, 1] }],
    },
    grip: 'held', graph: {}, vectors: {}, gripTests: [], rail: [], stableActor: true,
    gateTests: [], switchEffects: [], blocked: [], portals: [], usedPortals: [], markerTests: [],
  };
  const before = scene(1);
  const step = nextCarriedStep(state, before, 10);
  assert.equal(step?.kind, 'switch');
  assert.ok(step);

  const noChange = observeCarriedStep(state, step, before, before, 'no-change', [before]);
  assert.equal(noChange?.gateTests.length, 1);
  assert.equal(noChange?.interruptedSwitches, undefined);

  const restored = observeCarriedStep(state, step, before, before, 'restored', [scene(null), before]);
  assert.ok(restored);
  assert.deepEqual(restored.interruptedSwitches, [{ index: 0, actor: '1,1' }]);
  assert.deepEqual(restored.gateTests, []);
  assert.deepEqual(restored.switchEffects, []);
  assert.equal(nextCarriedStep(restored, before, 10), null);
  assert.equal(nextCarriedStep(restored, scene(5), 10)?.kind, 'switch');

  const updated = scene(1);
  updated[1]!.fill(4, 3, 5);
  updated[2]!.fill(4, 3, 5);
  const opened = observeCarriedStep(state, step, before, updated, 'opened', [scene(null), updated]);
  assert.equal(opened?.interruptedSwitches, undefined);
  assert.equal(opened?.switchEffects.length, 1);
});
