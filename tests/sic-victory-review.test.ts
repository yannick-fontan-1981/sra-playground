import assert from 'node:assert/strict';
import test from 'node:test';
import { sicNeedId, type NeedIdentity } from '../src/sic/need-identity.ts';
import { buildVictoryReview } from '../src/sic/victory-review.ts';

const ref = (level: number, action: number) => `session:epoch:${level}:revision:${action + 1}:frame:observed`;
const identity: NeedIdentity = { kind: 'repair_by_correspondence', scope: 'session:epoch:1', subjects: ['paired_cells'],
  parentObjective: 'G_official_completion', satisfactionContract: 'official_progress_after_confirmed_repairs' };
const build = (contract = identity.satisfactionContract, satisfied = true) => {
  const goal = { ...identity, satisfactionContract: contract };
  return buildVictoryReview({
    level: 1, score: 1, winningAction: 5, command: 'ACTION6', beforeRef: ref(1, 4), afterRef: ref(2, 5),
    need: { ...goal, id: sicNeedId(goal), evidence: [ref(1, 0)], status: 'assigned' },
    label: 'Restore the paired cells', satisfied,
    returns: [
      { after: ref(1, 2), outcome: { matched: true, reason: 'matching_repair' } },
      { after: ref(1, 1), outcome: { matched: false, reason: 'different_effect' } },
      { after: ref(1, 3), outcome: { matched: null }, observedEffect: 'The visible group changed.' },
      { after: ref(2, 5), outcome: { matched: true, reason: 'official_boundary' } },
    ],
  });
};

test('the victory keeps evidence from the scored level distinct from the official boundary', () => {
  const review = build();
  assert.equal(review.hypothesis?.label, 'Restore the paired cells');
  assert.deepEqual(review.checks.map(check => [check.action, check.matched]), [[1, false], [2, true], [3, null]]);
  assert.equal(review.checks.at(-1)?.reason, 'The visible group changed.');
  assert.equal(review.afterRef, ref(2, 5));
});

test('an exploratory need or missing satisfaction leaves the winning condition open', () => {
  assert.equal(build('observe_a_clicked_control').hypothesis, null);
  assert.equal(build(undefined, false).hypothesis, null);
});
