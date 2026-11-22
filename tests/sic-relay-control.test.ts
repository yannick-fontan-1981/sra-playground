import test from 'node:test';
import assert from 'node:assert/strict';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { rememberRelayControl, type RelayControlMemory } from '../src/sic/relay-control.ts';

async function view(active: number, idle: number, revision: number) {
  const rows = Array.from({ length: 12 }, () => Array(20).fill(3));
  for (const x of [active, idle])
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      rows[4 + dy!]![x + dx!] = 7;
  rows[5]![active + 1] = 3;
  return measureNativeObservation(
    {
      level: 1,
      levels_completed: 0,
      state: 'NOT_FINISHED',
      frame_rows: rows,
      frame_hash: await publicFrameHash(rows),
      available_action_refs: ['move', 'select'],
    },
    revision,
    'test-control',
  );
}
test('retains a reusable role change only after the selected subject moves and the old one stays', async () => {
  const before = await view(2, 12, 1),
    swapped = await view(12, 2, 2),
    m: RelayControlMemory = {};
  rememberRelayControl(m, before, swapped, 'select', { x: 12, y: 4 });
  assert.ok(m.pendingControl);
  assert.equal(m.relayControl, undefined);
  rememberRelayControl(m, swapped, swapped, 'move');
  assert.equal(m.relayControl, undefined);
  const coupled = structuredClone(m);
  rememberRelayControl(coupled, swapped, await view(14, 5, 3), 'move');
  assert.equal(coupled.relayControl, undefined);
  const moved = await view(14, 2, 3);
  rememberRelayControl(m, swapped, moved, 'move');
  const witness = (m as RelayControlMemory).relayControl;
  assert.equal(witness?.op, 'select');
  assert.equal(witness?.verification, moved.observation_ref);
  assert.equal(witness?.click, swapped.observation_ref);
});
