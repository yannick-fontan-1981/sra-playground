import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { createSicOutlineService } from '../src/sic/outline-service.ts';
import { createSicObservedRouteIntervention } from '../src/sic/observed-route-intervention.ts';

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
    await family.record(first, next, start.actions[0]!, initial, rows, start, 0, []);
    assert.equal((await family.propose(next, rows, inputs, 9))?.strategy, translated ? 'approach_framed_locus' : undefined);
  }
});

test('a rival cue drawn over the convoy does not erase either role', async () => {
  const size = 7, pitch = 4, span = size * pitch + 2;
  const rows = Array.from({ length: span }, (_, y) => Array.from({ length: span }, (_, x) =>
    x === 0 || y === 0 || x === span - 1 || y === span - 1 ? 7 : 0));
  const paint = (x: number, y: number, color: number, outline = false) => {
    for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
      if (!outline || dx === 0 || dy === 0 || dx === pitch - 1 || dy === pitch - 1) {
        rows[1 + y * pitch + dy]![1 + x * pitch + dx] = color;
      }
    }
  };
  paint(2, 3, 3);
  paint(2, 3, 2, true);
  paint(2, 2, 6);
  paint(3, 3, 4);
  paint(4, 3, 3, true);
  rows[3 * pitch + 3]![2 * pitch + 3] = 6;
  rows[3 * pitch + 2]![1 * pitch + 2] = 3;

  const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].map(action_ref => ({ action_ref, data: {} }));
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'overlapping-cue',
    level: 5, levels_completed: 4, available_action_refs: inputs.map(command => command.action_ref), state: 'NOT_FINISHED' }, 1);
  const family = createSicObservedRouteIntervention(), cell = 3 * size + 2;
  family.restore!({ roles: { epoch: observation.level_epoch, score: 4, actor: 2, carrier: 3, wall: 4, pitch, refs: [] },
    state: { epoch: observation.level_epoch, grid: { bounds: [0, 0, span - 1, span - 1], pitch, width: size, height: size,
      floor: 0, inset: 1, frame: 7 }, cells: { walls: [], rails: [], exit: -1 }, visited: [], intercept: null, caged: [], refs: [],
      count: 1, shelter: { phase: 'meet', cell } } });
  const proposal = await family.propose(observation, rows, inputs, 8);
  assert.equal(proposal?.choice.kind, 'hold');
  assert.equal(proposal?.choice.rival?.cue, cell);
  assert.equal(proposal?.choice.carrier, cell);
  assert.equal(proposal?.actions[0]?.action_ref, 'ACTION5');
});
