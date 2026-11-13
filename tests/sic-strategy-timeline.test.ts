import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DirectionalReturn } from '../src/sic/directional-return.ts';
import { matchStrategy, strategyTimeline } from '../src/sic/strategy-timeline.ts';

function step(sequence: number, planRevision: number, stepIndex: number, matched: boolean | null, action = 'Right'): DirectionalReturn {
  return { sequence, sessionId: 'public', fromLevel: 1, toLevel: 1, command: 4, changes: null, translation: null, stationary: null,
    nativeCheck: { family: 'unknown-to-SIC', matched, reason: null },
    decision: { family: 'unknown-to-SIC', objective: 'G_official_completion', objectiveSource: 'native',
      operation: null, composition: null, question: 'An open question', proposalRef: null, planRevision,
      route: [], steps: [{ action, expected: 'Position (8, 10)' }], remainingSteps: 3 - stepIndex, stepIndex, sprites: [] } };
}

test('generic timeline joins a prefix, identifies the contradictory return and ties it to the revised plan', () => {
  const a = step(3, 1, 0, true), b = step(4, 1, 1, false), c = step(5, 2, 0, true, 'Up');
  const [original, revised] = strategyTimeline([a, b, c]);
  assert.equal(original?.first, a);
  assert.equal(original?.last, b);
  assert.equal(original?.status, 'contradicted');
  assert.equal(original?.next, c);
  assert.equal(revised?.rule?.id, 'replan');
  assert.equal(revised?.previous, b);
  const [probe, following] = strategyTimeline([{ ...b, nativeCheck: { ...b.nativeCheck!, matched: null } }, c]);
  assert.equal(probe?.status, 'replaced');
  assert.notEqual(following?.rule?.id, 'replan');
  assert.notEqual(strategyTimeline([b, { ...c, sessionId: 'different' }])[1]?.rule?.id, 'replan');
});

test('a custom configuration matches its own predicates without game or action ids', () => {
  const rule = { id: 'custom', title: 'Test', need: 'Learn', situation: 'A new plan', when: ['differentPlan'], whenAny: ['publishedQuestion'] };
  assert.equal(matchStrategy(new Set(['differentPlan', 'publishedQuestion']), [rule]), rule);
  assert.equal(matchStrategy(new Set(['differentPlan']), [rule]), null);
  assert.equal(matchStrategy(new Set(['differentPlan']), [{ ...rule, whenAny: ['unknown'] }]), null);
});
