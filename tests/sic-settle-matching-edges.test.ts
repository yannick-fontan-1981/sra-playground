import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicSettleMatchingEdges } from '../src/sic/settle-matching-edges.ts';

test('attaching pieces requires both the panel change and the fixed piece marks', async () => {
  const hues = [8, 11, 14, 9] as const;
  const render = (indicator: boolean, fixed: boolean) => {
    const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
    for (let p = 8; p < 24; p++) {
      rows[6]![p] = rows[7]![p] = hues[0];
      rows[24]![p] = rows[25]![p] = hues[1];
      rows[p]![6] = rows[p]![7] = hues[2];
      rows[p]![24] = rows[p]![25] = hues[3];
    }
    for (const [x, y, ink] of [[12, 8, hues[0]], [16, 20, hues[1]]] as const) {
      for (let dy = 0; dy < 4; dy++) rows[y + dy]!.fill(ink, x, x + 4);
      rows[y + 1]![x + 1] = fixed ? 0 : 5;
    }
    for (const [i, [cx, cy]] of [[15, 2], [15, 29], [2, 15], [29, 15]].entries()) {
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        if (Number(Math.abs(x) === 2) + Number(Math.abs(y) === 2) === 1) rows[cy! + y]![cx! + x] = hues[i]!;
      }
    }
    for (let y = 27; y <= 30; y++) for (let x = 27; x <= 31; x++) {
      if (x === 27 || x === 31 || y === 30) rows[y]![x] = indicator ? 0 : 2;
    }
    if (indicator) rows[28]![29] = 14;
    return rows;
  };
  const directions = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
  const inputs = [...directions, 'ACTION5'].map(action_ref => ({ action_ref, data: {} }));
  const observe = (rows: number[][], revision: number) => measureNativeObservation({ frame_rows: rows,
    frame_hash: String(revision), level: 1, levels_completed: 0, available_action_refs: inputs.map(input => input.action_ref),
    state: 'NOT_FINISHED' }, revision);
  const family = createSicSettleMatchingEdges();
  family.restore!({ memory: { wins: 2, fit: hues.join(','), blockedEpoch: null, switchVerifiedAt: 1,
    switchRefs: { attach: { input: 'ACTION5', refs: ['off', 'on'] }, release: { input: 'ACTION5', refs: ['on', 'off'] } },
    controls: Object.fromEntries(directions.map((action, direction) => [action, { direction, refs: ['sample', 'return'] }])) } });
  const first = render(false, false), before = await observe(first, 1);
  const proposal = await family.propose(before, first, inputs, 12);
  assert.ok(proposal);
  assert.deepEqual(proposal.actions, [{ action_ref: 'ACTION5', data: {} }]);
  assert.equal(proposal.sicSituationCard.strategy, 'P02');
  const enabled = render(true, true), incomplete = render(true, false);
  assert.equal((await family.after(proposal, 0, before, await observe(incomplete, 2), first, incomplete)).matched, false);
  assert.equal((await family.after(proposal, 0, before, await observe(enabled, 2), first, enabled)).matched, true);
});
