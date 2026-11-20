import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicNestedPassage } from '../src/sic/nested-passage.ts';

test('an external marker can identify an opening in a one-pixel frame', async () => {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  function frame(left: number, top: number, right: number, bottom: number, ink: number, opening: number) {
    rows[top]!.fill(ink, left, right + 1);
    rows[bottom]!.fill(ink, left, right + 1);
    for (let y = top + 1; y < bottom; y++) {
      if (y !== opening) rows[y]![left] = ink;
      rows[y]![right] = ink;
    }
  }
  frame(6, 6, 57, 51, 3, 23);
  frame(9, 9, 50, 44, 15, 23);
  frame(14, 14, 22, 22, 8, 17);
  for (let y = 22; y <= 24; y++) rows[y]!.fill(12, 0, 3);
  rows[17]![17] = 15;
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'thin-external-exit',
    level: 1, levels_completed: 0, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'] }, 1);
  const plan = await createSicNestedPassage().propose(observation, rows, [], 40);
  assert.equal(plan?.local.layout.pitch, 1);
  assert.deepEqual(plan?.local.layout.exit, [0, 17]);
  assert.deepEqual(plan?.actions, [{ action_ref: 'ACTION5', data: {} }]);
});
