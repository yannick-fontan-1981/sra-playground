import assert from 'node:assert/strict';
import test from 'node:test';
import { hydrateNativeState, splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
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

function fixture(): CarriedSupport {
  return {
    layout: {
      field: [0, 0, 13, 9], voids: [0], actorInk: 3, targetInk: 2, pitch: 2,
      toolInk: 5, handleInk: 7, handleArea: 4, railInk: 6, mouth: { axis: 0, high: true },
      supportMask: [[0, 0], [0, 1], [1, 0], [1, 1]], supportSize: [2, 2], priorControlInks: [],
      buttons: [], latch: [14, 3, 15, 4], switches: [{ ink: 9, box: [14, 0, 15, 1] }],
    },
    grip: 'held', graph: {}, vectors: {}, gripTests: [], rail: [], stableActor: true,
    gateTests: [], switchEffects: [], blocked: [], portals: [], usedPortals: [], markerTests: [],
  };
}

test('an animated loss and return blocks a switch only from the affected footing', () => {
  const state = fixture();
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

test('support phase calibration keeps distinct steps with the same visible terrain', () => {
  let state = fixture(), before = scene(1);
  const next = nextCarriedStep(state, before, 30);
  assert.equal(next?.kind, 'switch');
  assert.ok(next?.kind === 'switch');
  for (const ink of [4, 4, 6, 0, 4, 4, 6, 0]) {
    const after = scene(1);
    after[1]!.fill(ink, 3, 5);
    after[2]!.fill(ink, 3, 5);
    after[3]!.fill(ink, 1, 3);
    after[4]!.fill(ink, 1, 3);
    const updated = observeCarriedStep(state, { ...next, measureCycle: true }, before, after, 'phase');
    assert.ok(updated);
    const saved = splitNativeState(updated, 'carried-support');
    before = after;
    state = hydrateNativeState(saved.root, id => saved.fragments.find(fragment => fragment.id === id)) as unknown as CarriedSupport;
  }
  const cycle = state.switchCycles?.[0];
  assert.equal(cycle?.period, 4);
  assert.equal(cycle?.current, 0);
  assert.deepEqual(cycle?.start, { '3,1': '0,0,0,0', '1,3': '0,0,0,0' });
  assert.deepEqual(cycle?.phases, [{}, { '3,1': '4,4,4,4', '1,3': '4,4,4,4' },
    { '3,1': '4,4,4,4', '1,3': '4,4,4,4' }, { '3,1': '6,6,6,6', '1,3': '6,6,6,6' }]);
});

test('a measured bridge can share the paint of the carried support', () => {
  const state = fixture();
  state.switchCycles = [{ index: 0, anchor: '1,5', period: 2, current: 0,
    start: { '3,5': '0,0,0,0', '5,5': '0,0,0,0' },
    phases: [{}, { '3,5': '7,7,7,7', '5,5': '7,7,7,7' }],
  }];
  const before = scene(5);
  before[5]!.fill(2, 7, 9);
  before[6]!.fill(2, 7, 9);
  const toggle = nextCarriedStep(state, before, 10);
  assert.ok(toggle?.kind === 'switch');
  assert.equal(toggle.expectedPhase, 1);

  const after = before.map(row => row.slice());
  after[5]!.fill(7, 3, 7);
  after[6]!.fill(7, 3, 7);
  const updated = observeCarriedStep(state, toggle, before, after, 'bridge');
  assert.ok(updated);
  const move = nextCarriedStep(updated, after, 10);
  assert.ok(move?.kind === 'walk');
  assert.deepEqual(move.expectedActor, [3, 5]);
  assert.equal(move.carried, false);
});
