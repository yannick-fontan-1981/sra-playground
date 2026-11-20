import assert from 'node:assert/strict';
import test from 'node:test';
import { bases, type FrameEffect, type FramePose } from '../src/sic/motion-frames.ts';
import { stepsToReach } from '../src/sic/inverse-frame-sites.ts';
import type { XY } from '../src/sic/access-terrain.ts';

const role = { signature: 'traveller', fixed: [] };
function pose(i: number, from: XY, reference: XY): FramePose {
  return {
    scene: i,
    index: i,
    role,
    from,
    anchors: new Map<string, XY>([
      ['self', from],
      ['world', [0, 0]],
      ['reference', reference],
    ]),
  };
}
test('a command can land relative to a independently moved reference while the traveller stays put', () => {
  const first: FrameEffect = { ...pose(1, [2, 3], [4, 3]), to: [5, 3] };
  const second: FrameEffect = { ...pose(2, [2, 3], [7, 4]), to: [8, 4] };
  const now = pose(3, [2, 3], [10, 5]);
  const fitted = bases([first, second], now).find((m) => m.object === 'reference');
  assert.deepEqual(fitted?.to, [11, 5]);
  assert.deepEqual(fitted?.refs, [1, 2]);
});
test('a co-moving marker cannot identify which object controls the destination', () => {
  const first: FrameEffect = { ...pose(1, [2, 3], [5, 6]), to: [3, 4] };
  const second: FrameEffect = { ...pose(2, [4, 5], [7, 8]), to: [5, 6] };
  const now = pose(3, [5, 6], [8, 9]);
  assert.equal(
    bases([first, second], now).some((m) => m.object === 'reference'),
    false
  );
});
test('solve how many physical moves place both coordinates at the goal', () => {
  assert.equal(stepsToReach([3, 14], [2, -1], [19, 6]), 8);
  assert.equal(stepsToReach([3, 14], [2, -1], [19, 5]), null);
  assert.equal(stepsToReach([3, 14], [0, -2], [3, 6]), 4);
  assert.equal(stepsToReach([3, 14], [0, -2], [4, 6]), null);
});
