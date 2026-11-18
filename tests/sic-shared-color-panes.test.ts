import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseSharedColorMove, type SharedColorPanes } from '../src/sic/shared-color-panes.ts';

test('fit two panes on the same channel when one required position belongs to both', () => {
  const state: SharedColorPanes = {
    layer: 8, palette: [8], pitch: 1, area: [0, 0, 9, 8], frame: [0, 0, 7, 7], canvas: [1, 1, 6, 6],
    wanted: [[2, 3], [3, 3], [4, 3]], active: 0, marker: null,
    panes: [
      { points: [[1, 3], [2, 3]], box: [1, 3, 2, 3], measured: true },
      { points: [[7, 3], [8, 3]], box: [7, 3, 8, 3], measured: true },
    ],
  };
  const next = chooseSharedColorMove(state, []);
  assert.ok(next);
  assert.deepEqual(next.state.plan?.map(action => [action.index, action.command.action_ref]),
    [[0, 'ACTION4'], [1, 'ACTION3'], [1, 'ACTION3'], [1, 'ACTION3'], [1, 'ACTION3']]);
});
