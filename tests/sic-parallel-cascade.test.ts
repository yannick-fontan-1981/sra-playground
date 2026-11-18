import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { planParallelCascadeSetup, type CascadeTile } from '../src/sic/cascade-setup.ts';

test('a bridge serves both targets only when two arrivals open their shared junction', () => {
  const sources: NativePoint[] = [[1, 2], [2, 3]];
  const targets: NativePoint[] = [[2, 1], [5, 2]];
  const tiles: CascadeTile[] = [
    { at: sources[0]!, direction: [1, 0] }, { at: sources[1]!, direction: [0, -1] },
    { at: [2, 2], junction: true }, { at: [3, 2], direction: [1, 0] },
    { at: [4, 2] }, { at: [3, 3] },
    ...targets.map(at => ({ at, direction: [1, 0] as NativePoint })),
  ];
  const board = { pitch: 1, tiles, sources, target: targets[0]! };
  const plan = planParallelCascadeSetup(board, targets, [], () => false);
  assert.deepEqual(plan?.setup?.gap, [4, 2]);
  assert.deepEqual(plan?.setup?.sharedJunctions, [[2, 2]]);
  assert.deepEqual(plan?.setup?.guards, []);
  assert.equal(planParallelCascadeSetup({ ...board, sources: sources.slice(0, 1) }, targets, [], () => false), null);
});

test('a forced junction distributes a single arrival after a naturally opened junction', () => {
  const sources: NativePoint[] = [[1, 2], [2, 3]];
  const targets: NativePoint[] = [[2, 1], [5, 2], [4, 3]];
  const tiles: CascadeTile[] = [
    { at: sources[0]!, direction: [1, 0] }, { at: sources[1]!, direction: [0, -1] },
    { at: [2, 2], junction: true }, { at: [3, 2], direction: [1, 0] }, { at: [4, 2], junction: true },
    ...targets.map(at => ({ at, direction: [1, 0] as NativePoint })),
  ];
  const board = { pitch: 1, tiles, sources, target: targets[0]! };
  const plan = planParallelCascadeSetup(board, targets, [], () => false);
  assert.equal(plan?.setup?.forceJunction, true);
  assert.deepEqual(plan?.setup?.gap, [4, 2]);
  assert.deepEqual(plan?.setup?.sharedJunctions, [[2, 2], [4, 2]]);
  assert.equal(planParallelCascadeSetup({ ...board, sources: sources.slice(0, 1) }, targets, [], () => false), null);
});

test('a movable guard preserves simultaneous arrivals for a later relay', () => {
  const sources: NativePoint[] = [[1, 3], [3, 1], [4, 3]];
  const targets: NativePoint[] = [[2, 4], [4, 4], [3, 5]];
  const tiles: CascadeTile[] = [
    { at: sources[0]!, direction: [1, 0] }, { at: [2, 3], direction: [1, 0] },
    { at: sources[1]!, direction: [0, 1] }, { at: [3, 2], direction: [0, 1] },
    { at: sources[2]!, direction: [-1, 0] },
    { at: [3, 3], junction: true }, { at: [3, 4], junction: true },
    ...targets.map(at => ({ at, direction: [1, 0] as NativePoint })),
  ];
  const board = { pitch: 1, tiles, sources, target: targets[0]! };
  const peers = [{ at: [5, 3] as NativePoint, mark: 10 }, { at: [5, 4] as NativePoint, mark: 20 }];
  assert.equal(planParallelCascadeSetup(board, targets, peers, () => false), null);
  const plan = planParallelCascadeSetup(board, targets, peers, () => false, 10);
  assert.deepEqual(plan?.setup?.guards, [[4, 3]]);
  assert.deepEqual(plan?.setup?.gap, [3, 4]);
  assert.deepEqual(plan?.setup?.sharedJunctions, [[3, 3], [3, 4]]);
  assert.equal(plan?.setup?.forceJunction, true);
});
