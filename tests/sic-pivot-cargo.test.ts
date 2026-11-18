import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeObservation, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { createSicPivotCargo } from '../src/sic/pivot-cargo.ts';

test('a checked attachment separates touching loads and keeps both delivery obligations', async () => {
  const actor: NativePoint = [1, 1], adjacent: NativePoint = [2, 1], resting: NativePoint = [3, 1];
  const at = { actor, cargo: [[adjacent, resting]], held: -1, delivered: 0 };
  const pitch = 3, floor = Array.from({ length: 30 }, (_, cell) => [cell % 6, Math.floor(cell / 6)].join(','));
  const destinations = [['3,3', '4,3']], actorColor = 10, freeColor = 7, heldColor = 6, core = 0;
  const layout = { origin: [0, 0], pitch, floor, destinations, pivot: [], actorColor, core, initial: at,
    freeColors: [freeColor], receiverColors: [13] };
  const action = { action_ref: 'ACTION5', data: {} };
  const family = createSicPivotCargo();
  family.restore!({ witness: null, state: { epoch: 1, layout, at, refs: [], moves: true, interactions: [], failed: false,
    steps: [{ input: action.action_ref, intent: 'attach', subject: 0, next: { ...at, held: 0 } }] } });
  const rows = Array.from({ length: 5 * pitch }, () => Array<number>(6 * pitch).fill(5));
  function token(frame: number[][], [x, y]: NativePoint, color: number) {
    for (let i = 0; i < pitch; i++) frame[y * pitch + i]!.fill(color, x * pitch, (x + 1) * pitch);
    frame[y * pitch + 1]![x * pitch + 1] = core;
  }
  token(rows, actor, actorColor);
  token(rows, adjacent, freeColor);
  token(rows, resting, freeColor);
  const next = rows.map(row => row.slice());
  token(next, adjacent, heldColor);
  const observation = (revision: number): NativeObservation => ({
    revision, frame_hash: 'frame-' + revision, observation_ref: 'board:revision:' + revision, level_epoch: 1,
    coordinate_basis: 'screen', entities: [], available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
    state: 'NOT_FINISHED', levels_completed: 0, unknowns: [], provenance: 'fixture',
  });
  const before = observation(1), after = observation(2);
  const probe = await family.propose(before, rows, [], 50);
  assert.ok(probe);

  const changedTerrain = next.map(row => row.slice());
  changedTerrain[0]![0] = 8;
  const contradicted = await family.after(probe, 0, before, after, rows, changedTerrain);
  assert.equal(contradicted.matched, false);

  const confirmed = await family.after(probe, 0, before, after, rows, next);
  assert.equal(confirmed.reason, 'attachment_distinguishes_touching_loads');
  assert.equal(confirmed.seal_prefix, true);
  await family.record(before, after, action, rows, next, probe, 0);
  const replanned = await family.propose(after, next, [], 49);
  assert.ok(replanned);
  assert.deepEqual(replanned.local.at, { ...at, held: 0, cargo: [[adjacent], [resting]] });
  assert.deepEqual(replanned.local.layout.destinations, [destinations[0], destinations[0]]);
  assert.equal(replanned.local.steps.filter(step => step.intent === 'drop').length, 2);
});
