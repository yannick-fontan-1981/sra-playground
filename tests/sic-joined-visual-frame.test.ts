import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { visualLayout } from '../src/logos-engine/v6-visual-sequences.ts';

test('measures an interior gap when an observed marker touches the matching frame border', async () => {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(5));
  function frame(x: number, y: number, color: number) {
    for (let i = 0; i < 5; i++) {
      rows[y]![x + i] = rows[y + 4]![x + i] = color;
      rows[y + i]![x] = rows[y + i]![x + 4] = color;
    }
  }
  for (const [i, x] of [3, 13, 23].entries()) {
    frame(x, 2, i === 1 ? 0 : 6);
    if (i !== 1) rows[3]![x + 2] = 6;
    frame(x, 12, 3);
    rows[14]![x + 2] = 9;
  }
  for (const x of [8, 18]) {
    frame(x, 30, 4);
    rows[32]![x + 2] = 8;
  }
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'fixture', level: 1,
    levels_completed: 0, available_action_refs: ['ACTION6'], state: 'NOT_FINISHED' }, 1);
  assert.equal(await visualLayout(observation, rows), null);
  const layout = await visualLayout(observation, rows, true);
  assert.ok(layout);
  assert.equal(layout.active.missing, 1);
  assert.deepEqual(layout.active.boxes[1], [13, 2, 17, 6]);
  assert.equal(layout.active.rasters[0]?.[0]?.[1], 6);
  assert.equal(layout.active.rasters[2]?.[0]?.[1], 6);
});
