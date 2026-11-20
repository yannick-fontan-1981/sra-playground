import assert from 'node:assert/strict';
import test from 'node:test';
import { measureContextualCompartments } from '../src/logos-engine/v6-contextual-compartments.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeBox } from '../src/logos-engine/v6-native-types.ts';
import { createSicMarkedCompartmentFlow } from '../src/sic/marked-compartment-flow.ts';

test('retain the compartment clicked for official progress while other inputs are highlighted', async () => {
  const rows = Array.from({ length: 48 }, () => Array<number>(64).fill(5));
  const source: NativeBox = [4, 10, 9, 20], outlet: NativeBox = [55, 10, 59, 23];
  const chambers: NativeBox[] = [source, outlet, [16, 10, 20, 21], [25, 10, 29, 21],
    [34, 10, 38, 21], [43, 10, 47, 21], [34, 28, 38, 39]];
  for (const box of chambers) {
    const [l, t, r, b] = box;
    const highlighted = box === outlet || box === source;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      if (x === l || x === r || y === t || y === b) rows[y]![x] = highlighted ? 0 : 3;
      else if (highlighted) rows[y]![x] = box === outlet ? 14 : 12;
    }
  }
  const observe = (level: number, revision: number) => measureNativeObservation({ frame_rows: rows,
    frame_hash: `compartments-${revision}`, level, levels_completed: level - 1,
    available_action_refs: ['ACTION5', 'ACTION6'], state: 'NOT_FINISHED' }, revision);
  const before = await observe(2, 1), after = await observe(3, 2);
  assert.equal(await measureContextualCompartments(rows), null);
  assert.equal((await measureContextualCompartments(rows, 0))?.marked.length, 2);

  const family = createSicMarkedCompartmentFlow();
  family.restore!({ witness: { epoch: before.level_epoch, mark: 0, normal: 3, background: 5,
    chambers, outlet, wins: 1, refs: ['previous-before', 'previous-after'] }, attempted: [] });
  await family.observePublicOutcome!(before, after, { action_ref: 'ACTION6', data: { x: 57, y: 16 } }, rows, rows);
  const witness = family.state!().witness as { outlet: NativeBox; epoch: number; concurrentDelivery?: boolean; wins: number };
  assert.deepEqual(witness.outlet, outlet);
  assert.equal(witness.epoch, after.level_epoch);
  assert.equal(witness.concurrentDelivery, true);
  assert.equal(witness.wins, 2);
});
