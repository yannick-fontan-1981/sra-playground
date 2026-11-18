import assert from 'node:assert/strict';
import test from 'node:test';
import { seekQueueHorizon } from '../src/sic/queue-horizon.ts';

test('preserve an entry for a later clear even when the active group earns no immediate credit', () => {
  const scene = {
    geometry: { shape: [3, 4] },
    grid: [[5, 5, 14], [5, 5, 5], [5, 5, 5], [8, 8, 5]],
    mark: { values: [14], column: 2, rows: [0] },
    preview_alternatives: [{ orientation: [true, true], members: [[8]] }],
  };
  const state = { empty: 5, gravity: 1, spawn_column_observed: 2, preview_orientations: [[true, true]],
    controls: { LEFT: { kind: 'translate', delta: -1 }, RIGHT: { kind: 'translate', delta: 1 }, DROP: { kind: 'receive' } },
    closure_models: [{ directions: [[0, 1]], minimum_line: 3, gravity: 1 }] };
  const plan = seekQueueHorizon(scene, state, 8, 100, () => 0);
  assert.deepEqual(plan?.actions.map(action => action.action_ref), ['LEFT', 'DROP']);
  assert.equal(plan?.projected, 3);
  assert.equal(plan?.groups, 2);
  assert.equal(seekQueueHorizon(scene, { ...state, preview_orientations: [] }, 8, 100, () => 0), null);

  const last = seekQueueHorizon({ ...scene, preview_alternatives: [] }, state, 8, 100, () => 0);
  assert.deepEqual(last?.actions.map(action => action.action_ref), ['DROP']);
  assert.equal(last?.groups, 1);
});
