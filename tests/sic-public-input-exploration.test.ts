import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicPublicInputExploration } from '../src/sic/public-input-exploration.ts';

test('SIC probes repeated interior markers while requiring independent visible arrangements', async () => {
  const board = (secondSquare: boolean) => Array.from({ length: 14 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      if ((x === 2 || x === 4) && (y === 2 || y === 4)) return 7;
      if ((x === 10 || x === 12) && (y === 6 || (secondSquare && y === 8))) return 7;
      if ((x === 0 || x === 2) && (y === 8 || y === 10)) return 7;
      return x >= 6 && x <= 7 && y >= 9 && y <= 10 ? 3 : 0;
    }),
  );
  for (const repeated of [true, false]) {
    const rows = board(repeated);
    const observation = await measureNativeObservation({
      frame_rows: rows, frame_hash: String(repeated), level: 1, levels_completed: 0,
      available_action_refs: ['ACTION6'], state: 'NOT_FINISHED',
    }, 1);
    const proposed = await createSicPublicInputExploration().propose(observation, rows, [], 12);
    assert.ok(proposed);
    assert.equal(proposed.sicSituationCard.strategy, repeated ? 'test_repeated_marker' : 'compare_public_input');
    assert.equal(rows[proposed.actions[0]!.data.y!]![proposed.actions[0]!.data.x!], repeated ? 7 : 3);
  }
});
