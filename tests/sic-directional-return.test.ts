import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeDirectionalReturn } from '../src/sic/directional-return.ts';

test('directional observations retain public changes and stop at level transitions', () => {
  const scope = { sessionId: 'session', sequence: 1, command: 1, fromLevel: 1, toLevel: 1 };
  const before = [[0, 2, 0], [0, 0, 0], [0, 0, 0]];
  const after = [[0, 0, 0], [0, 0, 0], [0, 2, 0]];
  const receipt = observeDirectionalReturn(scope, before, after, false);
  assert.equal(receipt.changes?.totalPixels, 2);
  assert.equal(receipt.changes?.regionCount, 2);
  assert.deepEqual(receipt.changes?.samples.map(({ before, after }) => [before, after]), [
    [[[2]], [[0]]],
    [[[0]], [[2]]],
  ]);
  assert.equal(observeDirectionalReturn({ ...scope, toLevel: 2 }, before, after, true).changes, null);
  assert.equal(observeDirectionalReturn(scope, before, [[0]], false).changes, null);
});
