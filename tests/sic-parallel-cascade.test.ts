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
