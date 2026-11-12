import assert from 'node:assert/strict';
import test from 'node:test';
import { buildActionRequest } from '../src/runtime/browser-games.ts';

test('simple browser action request omits coordinate data', () => {
  assert.deepEqual(buildActionRequest(4), {
    type: 'action',
    actionId: 4,
  });
});

test('ACTION6 browser request preserves click coordinates', () => {
  assert.deepEqual(buildActionRequest(6, { x: 17, y: 23 }), {
    type: 'action',
    actionId: 6,
    data: { x: 17, y: 23 },
  });
});

test('ACTION6 preserves zero coordinates rather than dropping them as falsy', () => {
  assert.deepEqual(buildActionRequest(6, { x: 0, y: 0 }), {
    type: 'action',
    actionId: 6,
    data: { x: 0, y: 0 },
  });
});
