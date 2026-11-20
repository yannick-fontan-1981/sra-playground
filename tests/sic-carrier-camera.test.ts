import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeReductionScene, packReductionState, reductionScan, reductionState, reductionSuccessors,
  type ReductionModel, type ReductionScene } from '../src/logos-engine/v6-reduction-transport.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { acquireCarrierView, carrierView, reconcileCarrierTraffic, unpackCarrierView } from '../src/sic/carrier-camera.ts';

test('a measured auxiliary peer jump preserves both auxiliaries and the population objective', () => {
  const scene: ReductionScene = { floor: new Set(['1,1', '2,1', '3,1']), pegs: new Set(['0,0', '4,0']),
    carriers: [], rails: new Set(), edges: new Set(), auxiliaries: new Set(['1,1', '2,1']) };
  const state = reductionState(scene);
  assert.equal([...reductionSuccessors(state, scene)].length, 0);
  const [step] = [...reductionSuccessors(state, { ...scene, allowAuxiliaryPeerJump: true })];
  assert.ok(step);
  assert.deepEqual(step[1], ['jump', [1, 1], [3, 1]]);
  assert.deepEqual(packReductionState(step[0]), [[[0, 0], [4, 0]], [], [], [[2, 1], [3, 1]]]);
});

test('a partially visible plot is reclassified as cargo and survives later clipping', async () => {
  const model: ReductionModel = { unit: 2, pitch: 4, phase: [1, 2], width: 18, height: 12,
    floor: 3, token: 7, ring: 11, rail: 5, trackClippedCarrierRows: true,
    plot: { ink: 8, offset: [0, 0], mask: [[0, 0], [1, 0], [0, 1]] } };
  const floors = [[0, 1], [3, 1], [0, 2], [1, 2], [2, 2], [0, 3], [3, 3], [1, 4], [3, 4]];
  const makeFrame = (offset: number, outline: boolean) => {
    const rows = Array.from({ length: model.height }, () => Array<number>(model.width).fill(0));
    for (const [x, y] of floors) {
      const left = 1 + 4 * x!, top = 2 + 4 * (y! - offset);
      if (top < 1 || top + 2 > model.height) continue;
      rows[top]!.fill(model.floor, left, left + 2);
      rows[top + 1]!.fill(model.floor, left, left + 2);
    }
    const left = 9, top = 2 + 4 * (3 - offset);
    if (outline) for (let y = -1; y <= 2; y++) for (let x = -1; x <= 2; x++) {
      if (y === -1 || y === 2 || x === -1 || x === 2) {
        if (rows[top + y]) rows[top + y]![left + x] = model.ring!;
      }
    }
    for (const [x, y] of model.plot!.mask) rows[top + y]![left + x] = model.plot!.ink;
    return rows;
  };
  const observe = (rows: number[][], revision: number) => measureNativeObservation({
    frame_rows: rows, frame_hash: 'frame-' + revision, level: 1, levels_completed: 0, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION6'],
  }, revision);
  const clipped = makeFrame(1, false);
  assert.deepEqual(reductionScan(makeFrame(1, true), model).carriers, [[2, 2]]);
  const before = carrierView([0, 1], mergeReductionScene(null, reductionScan(clipped, model), model, [0, 1]));
  assert.deepEqual(before.memory.carriers, []);
  assert.deepEqual(before.memory.plots, ['2,3']);
  const full = makeFrame(2, true);
  const revealed = acquireCarrierView(full, await observe(full, 2), model, before, [[], []], [0, 1]);
  assert.ok(revealed?.matches);
  assert.equal(revealed.enteringCarriers, 1);
  assert.deepEqual(revealed.view.memory.plots, []);
  assert.deepEqual(revealed.view.memory.carriedPlots, ['2,3']);
  const expected = packReductionState(reductionState(unpackCarrierView(revealed.view)));
  const hidden = acquireCarrierView(clipped, await observe(clipped, 3), revealed.nextModel, revealed.view, expected, [0, -1]);
  assert.ok(hidden?.matches);
  assert.deepEqual(hidden.view.memory.carriers, [[2, 3]]);
  const stationary = acquireCarrierView(clipped, await observe(clipped, 4), hidden.nextModel, hidden.view, expected);
  assert.ok(stationary?.matches);
  assert.deepEqual(stationary.view.memory.carriedPlots, ['2,3']);
});

test('a measured incoming lane admits a loaded departure with a following carrier only when the visible state agrees', async () => {
  const model: ReductionModel = { unit: 2, pitch: 4, phase: [1, 1], width: 18, height: 16,
    floor: 3, token: 7, ring: 11, rail: 5, auxiliary: 9 };
  const frame = (carriers: number[], fixedAuxiliary = true) => {
    const rows = Array.from({ length: model.height }, () => Array<number>(model.width).fill(0));
    const fill = (x: number, y: number, color: number) => {
      rows[y]!.fill(color, x, x + 2);
      rows[y + 1]!.fill(color, x, x + 2);
    };
    for (const [x, y] of [[1, 1], [5, 5], [1, 9], [13, 9], [5, 13]] as const) fill(x, y, model.floor);
    if (fixedAuxiliary) fill(13, 5, model.auxiliary!);
    for (const row of rows) row[10] = model.rail!;
    for (const y of carriers.map(cell => 1 + cell * model.pitch)) {
      for (let dy = -1; dy <= 2; dy++) rows[y + dy]!.fill(model.ring!, 8, 12);
      fill(9, y, model.auxiliary!);
    }
    return rows;
  };
  const observe = (rows: number[][]) => measureNativeObservation({
    frame_rows: rows, frame_hash: 'observed-departure', level: 1, levels_completed: 0, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2'],
  }, 2);
  const before = carrierView([0, 0], mergeReductionScene(null, reductionScan(frame([2, 3]), model), model, [0, 0]));
  const expected = packReductionState(reductionState(unpackCarrierView(before)));
  const departed = frame([3]);
  const next = await observe(departed);
  assert.equal(reconcileCarrierTraffic(departed, next, model, before, expected, [0, 1], undefined, true)?.matches, false);
  const traffic = { cell: '2,3', inward: [0, -1] as [number, number] };
  const verified = reconcileCarrierTraffic(departed, next, model, before, expected, [0, 1], traffic, true);
  assert.equal(verified?.matches, true);
  assert.equal(verified?.leavingCarriers, 1);
  assert.deepEqual(verified?.view.memory.carriers, [[2, 3]]);
  const unrelatedChange = frame([3], false);
  assert.equal(reconcileCarrierTraffic(unrelatedChange, await observe(unrelatedChange), model,
    before, expected, [0, 1], traffic, true)?.matches, false);
});
