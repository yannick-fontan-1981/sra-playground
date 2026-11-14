import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { createSicOutlineService } from '../src/sic/outline-service.ts';

test('an outlined piece can only approach a frame after its predicted translation is seen', async () => {
  const board = (shift: number, peer = true) => Array.from({ length: 30 }, (_, y) =>
    Array.from({ length: 34 }, (_, x) => {
      if (x >= 5 && x <= 10 && y >= 5 && y <= 10 && (x === 5 || x === 10 || y === 5 || y === 10)) return 8;
      if (x >= 10 && x <= 13 && y >= 18 + shift && y <= 21 + shift
        && (x === 10 || x === 13 || y === 18 + shift || y === 21 + shift)) return 3;
      if (peer && x >= 26 && x <= 29 && y >= 6 && y <= 9 && (x === 26 || x === 29 || y === 6 || y === 9)) return 5;
      return x === 3 && y >= 7 && y <= 9 ? 5 : 0;
    }));
  const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].map(action_ref => ({ action_ref, data: {} }));
  const observe = (rows: NativeRows, revision: number) => measureNativeObservation({
    frame_rows: rows, frame_hash: String(revision), level: 1, levels_completed: 0,
    available_action_refs: inputs.map(command => command.action_ref), state: 'NOT_FINISHED',
  }, revision);
  const initial = board(0), first = await observe(initial, 1), changed = board(-4), second = await observe(changed, 2);
  const noPeer = board(0, false);
  assert.equal(await createSicOutlineService().propose(await observe(noPeer, 1), noPeer, inputs, 10), null);
  for (const translated of [true, false]) {
    const family = createSicOutlineService();
    const start = await family.propose(first, initial, inputs, 10);
    assert.ok(start);
    assert.equal(start.strategy, 'test_outline_motion');
    const rows = translated ? changed : initial;
    const next = translated ? second : await observe(initial, 2);
    assert.equal((await family.after(start, 0, first, next, initial, rows)).matched, translated);
    await family.record(first, next, start.move.command, initial, rows, start, 0, []);
    assert.equal((await family.propose(next, rows, inputs, 9))?.strategy, translated ? 'approach_framed_locus' : undefined);
  }
});
