import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { chooseContactDemand, contactMobileBox, measureContactDemand, observeContactDemand } from '../src/sic/contact-demand.ts';
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

test('an expanded palette and a matching mobile request support a verified rank change', async () => {
  function render(converted: boolean, mobileVisible = true) {
    const rows = Array.from({ length: 48 }, (_, y) => Array<number>(48).fill(y < 8 ? 1 : y === 47 ? 12 : 0));
    function paint(left: number, top: number, width: number, height: number, ink: number) {
      for (let y = top; y < top + height; y++) rows[y]!.fill(ink, left, left + width);
    }
    function glyph(left: number, top: number, ink: number) {
      paint(left + 2, top, 1, 1, ink);
      paint(left, top + 1, 5, 1, ink);
      paint(left, top + 2, 5, 1, 7);
    }
    for (const [index, ink] of [3, 6, 10].entries()) paint(3 + index * 4, 1, 2, 2, ink);
    paint(16, 4, 3, 3, 6);
    glyph(25, 4, 4);
    for (const [left, top] of [[3, 12], [36, 35]] as const) {
      paint(left + 1, top, 7, 9, 9);
      paint(left, top + 1, 9, 7, 9);
    }
    const side = converted ? 3 : 5;
    paint(15, 21, side, side, converted ? 6 : 10);
    if (mobileVisible) glyph(28, 24, 8);
    return rows;
  }
  const observe = (frame_rows: number[][], revision: number) => measureNativeObservation({ frame_rows,
    frame_hash: String(revision), level: 2, levels_completed: 1, available_action_refs: ['ACTION6'], state: 'NOT_FINISHED' }, revision);
  const first = render(false), before = await observe(first, 1);
  const calibration = { palette: [3, 6], radius: { lower: 7, upper: 10 },
    mobileEffect: { travel: Math.sqrt(32), diversion: 12, refs: ['previous_motion'] } };
  const demand = measureContactDemand(before, first, calibration);
  assert.ok(demand);
  assert.deepEqual(contactMobileBox(demand.scene, demand.world.mobile.at), [28, 24, 32, 26]);
  assert.equal(demand.world.square.rank, 2);
  const choice = chooseContactDemand(demand, () => false);
  assert.ok(choice);
  const second = render(true), after = await observe(second, 2);
  const returned = observeContactDemand(demand, choice, after, second);
  assert.equal(returned?.converted, true);
  assert.equal(returned?.next.world.square.rank, 1);
  assert.equal(returned?.next.world.mobile.visible, 11);
  const hidden = render(false, false);
  assert.equal(measureContactDemand(await observe(hidden, 3), hidden, calibration), null);
});
