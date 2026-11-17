import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicMergeForDemand } from '../src/sic/merge-for-demand.ts';

test('a diversion records both mobiles without inserting an undefined single-mobile state', async () => {
  const render = (left: number, right: number) => {
    const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
    for (const x of [left, right]) {
      rows[12]![x] = rows[12]![x + 1] = rows[13]![x] = 5;
    }
    for (const y of [12, 13]) rows[y]![15] = rows[y]![16] = 6;
    return rows;
  };
  const first = render(8, 24), second = render(3, 22);
  const observe = (frame_rows: number[][], revision: number) => measureNativeObservation({ frame_rows,
    frame_hash: String(revision), level: 1, levels_completed: 0, available_action_refs: ['ACTION6'], state: 'NOT_FINISHED' }, revision);
  const before = await observe(first, 1), after = await observe(second, 2);
  const family = createSicMergeForDemand();
  const member = { color: 6, side: 2, box: [15, 12, 16, 13] as const, point: [15.5, 12.5] as const };
  const scene = { samples: [member], demand: member, receptor: [12, 3, 18, 9] as const, field: [10, 28] as const,
    probeRange: 4, requirements: [member], screenWidth: 32 };
  const mobiles = before.entities.filter(item => item.palette_value === 5).map(item => ({
    body: { color: 5, mask: item.mask, box: item.bbox }, travel: 2, diversion: 4, attempts: [], refs: [before.observation_ref],
  }));
  const memory = { epoch: before.level_epoch, scene, recipes: [], motion: [], tried: [], count: 0, mobiles,
    radius: { lower: 5, upper: 7, refs: [before.observation_ref] } };
  const action = { action_ref: 'ACTION6', data: { x: 4, y: 12 } };
  const proposal = { status: 'proposed', kind: family.id, actions: [action], memory, stock: [member], needId: 'test', attempt: 'test',
    choice: { intent: 'divert', member, partner: null, point: [4, 12], expected: null } } as const;
  const outcome = await family.after!(proposal, 0, before, after, first, second, []);
  assert.equal(outcome.matched, true);
  await family.record!(before, after, action, first, second, proposal, 0, []);
  const recorded = family.state!().state as { mobiles: { body: { box: readonly number[] } }[] };
  assert.equal(Object.hasOwn(recorded, 'pressure'), false);
  assert.deepEqual(recorded.mobiles.map(mobile => mobile.body.box[0]), [3, 22]);
});
