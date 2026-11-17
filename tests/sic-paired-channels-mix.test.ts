import assert from 'node:assert/strict';
import test from 'node:test';
import { createSicVerifyChannelAccess } from '../src/sic/paired-channels.ts';

const pitch = 3;
const tile = (x: number, color: number, count = 9) => ({
  point: [x, 0] as const, box: [x, 0, x + pitch - 1, pitch - 1] as const, color, count, accents: [],
});

function verifyMixture(secondSource: number[][]) {
  const family = createSicVerifyChannelAccess();
  type Verification = Parameters<typeof family.after>;
  const from = tile(0, 8, 5), other = tile(3, 0), opening = tile(6, 2, 8), to = tile(9, 5);
  const pair = { from, other, to, color: 7 };
  const proposal = { tile: opening, pair, merging: true, completes: false,
    state: { layout: { pitch, closed: 2, pairs: [pair], tiles: [from, other, opening, to] } },
  } as Verification[0];
  const observation = { levels_completed: 5 } as Verification[2];
  const white = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const earth = [[2, 2, 2], [2, 2, 2], [2, 2, 5]];
  const pink = [[7, 7, 7], [7, 7, 7], [7, 7, 7]];
  const before = [[8, 8, 0], [8, 8, 0], [8, 0, 0]].map((row, y) => [...row, ...white[y]!, ...earth[y]!, 5, 5, 5]);
  const after = [[7, 7, 0], [7, 7, 0], [8, 0, 0]].map((row, y) => [...row, ...secondSource[y]!, ...pink[y]!, 5, 5, 5]);
  return family.after(proposal, 0, observation, observation, before, after);
}

test('a channel confirms the mixture from pigment changes beneath a dominant source marker', async () => {
  const result = await verifyMixture([[7, 7, 0], [7, 7, 0], [0, 0, 0]]);
  assert.equal(result.matched, true);
  assert.equal(result.reason, 'source_mixture_observed');
});

test('a pink passage alone cannot confirm pigment participation from both sources', async () => {
  const unchanged = await verifyMixture([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  assert.equal(unchanged.matched, false);
  const unexpected = await verifyMixture([[7, 7, 0], [7, 0, 0], [0, 0, 15]]);
  assert.equal(unexpected.matched, false);
});
