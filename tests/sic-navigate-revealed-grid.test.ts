import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];

function rowsAt(position: number, charge: boolean, open = false) {
  const rows = Array.from({ length: 10 }, () => Array<number>(12).fill(4));
  const x = position % 3 * 4, y = Math.floor(position / 3) * 4;
  rows[y + 1]![x + 1] = rows[y + 1]![x + 2] = rows[y + 2]![x + 1] = 0;
  rows[9]![0] = charge ? 10 : 2;
  if (open) for (let i = 1; i <= 2; i++) rows[i]![4] = rows[i]![7] = 12;
  return rows;
}

const observe = (rows: number[][], revision: number) => measureNativeObservation({
  frame_rows: rows, frame_hash: String(revision), level: 1, levels_completed: 0,
  available_action_refs: ['ACTION4', 'ACTION5'], state: 'NOT_FINISHED',
}, revision);

function fixture(kind: 'pulse' | 'move'): Proposal {
  const action = { action_ref: kind === 'pulse' ? 'ACTION5' : 'ACTION4', data: {} };
  return { status: 'proposed', kind: 'sic_navigate_revealed_grid', actions: [action], needId: 'test',
    choice: { action, target: 1, kind, uncertain: true },
    local: {
      epoch: 1, previousObstacle: null, consecutiveWaits: 0, refs: [],
      grid: { box: [0, 0, 11, 7], pitch: 4, columns: 3, size: 6, tint: 2, base: 4, actor: 0, enemy: 10, trail: 9, goal: 5,
        charges: [[0, 9]], actorPixels: [[1, 1], [2, 1], [1, 2]],
        mechanisms: { doors: kind === 'pulse' ? { 1: 12 } : {}, pads: kind === 'move' ? { 1: [1, 0] } : {} } },
      last: { position: 0, charges: 1, obstacle: null, obstacles: [], risk: [], memory: { 0: 'free', 1: 'free', 5: 'free' },
        closedDoors: kind === 'pulse' ? [1] : [], landings: {} },
      timing: { start: 0, scannedPads: [], patrols: [], walls: [] },
    },
  };
}

test('a pulse confirms a door opening even when it reveals no new cells', async () => {
  const family = createSicNavigateRevealedGrid(), proposal = fixture('pulse');
  const before = rowsAt(0, true), after = rowsAt(0, false, true);
  const receipt = await family.after(proposal, 0, await observe(before, 1), await observe(after, 2), before, after);
  assert.equal(receipt.matched, true);
});

test('a forced landing requires evidence at the marked cell during the return', async () => {
  const family = createSicNavigateRevealedGrid(), proposal = fixture('move');
  const first = rowsAt(0, true), landing = rowsAt(2, true), during = rowsAt(1, true);
  const before = await observe(first, 1), after = await observe(landing, 2);
  const state = () => family.state() as { state: { last: { landings: Record<number, number> } } };
  await family.record(before, after, proposal.actions[0]!, first, landing, proposal, 0, [first, landing]);
  assert.deepEqual(state().state.last.landings, {});
  await family.record(before, after, proposal.actions[0]!, first, landing, proposal, 0, [first, during, landing]);
  assert.deepEqual(state().state.last.landings, { 1: 2 });
});

test('a displacement after a blocked move does not make the attempted cell passable', async () => {
  const family = createSicNavigateRevealedGrid(), proposal = fixture('move');
  proposal.local.grid.mechanisms!.pads = {};
  proposal.local.timing!.clock = { turn: 0, rails: {}, crossed: [], visits: [0], scans: [] };
  const first = rowsAt(0, true), landing = rowsAt(3, true), contact = rowsAt(1, true);
  const before = await observe(first, 1), after = await observe(landing, 2);
  const state = () => family.state() as { state: { last: { memory: Record<number, string> } } };
  await family.record(before, after, proposal.actions[0]!, first, landing, proposal, 0, [first, landing]);
  assert.equal(state().state.last.memory[1], 'wall');
  await family.record(before, after, proposal.actions[0]!, first, landing, proposal, 0, [first, contact, landing]);
  assert.equal(state().state.last.memory[1], 'free');
});
