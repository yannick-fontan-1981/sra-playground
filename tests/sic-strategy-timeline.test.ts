import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DirectionalReturn } from '../src/sic/directional-return.ts';
import { defaultStrategyRules, matchStrategy, matchesStrategyRule, strategyClassificationChanges, strategyTimeline } from '../src/sic/strategy-timeline.ts';

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

test('edited conditions reclassify past episodes without changing their native evidence', () => {
  const first = step(1, 1, 0, false), next = step(2, 2, 0, true, 'Up');
  const history = [first, next];
  const rules = defaultStrategyRules.map(rule => rule.id === 'replan'
    ? { ...rule, need: 'Check the next step', when: ['explicitPrediction'] } : rule);
  const original = strategyTimeline(history);
  const edited = strategyTimeline(history, rules);
  assert.equal(original[0]?.rule?.id, 'check-plan');
  assert.equal(edited[0]?.rule?.id, 'replan');
  assert.equal(edited[0]?.rule?.need, 'Check the next step');
  assert.equal(edited[0]?.last, first);
  assert.equal(edited[0]?.next, next);
  assert.equal(edited[0]?.status, 'contradicted');
  assert.equal(matchesStrategyRule(edited[0]!.facts, defaultStrategyRules[1]!), true);
  assert.equal(matchStrategy(edited[0]!.facts, rules)?.id, 'replan');
});

test('swapping identically configured rules previews only the episodes whose winner changes', () => {
  const check = { ...defaultStrategyRules[1]!, when: ['explicitPrediction'], whenAny: [] };
  const probe = { ...defaultStrategyRules[2]!, when: ['explicitPrediction'] };
  const withPrediction = step(1, 1, 0, false);
  const withoutPrediction = step(2, 2, 0, true);
  const timeline = strategyTimeline([
    withPrediction,
    { ...withoutPrediction, decision: { ...withoutPrediction.decision!, steps: [{ action: 'Right', expected: null }] } },
  ], [check, probe]);
  const changes = strategyClassificationChanges(timeline, [probe, check]);
  assert.deepEqual(changes.map(change => [change.episode.first.sequence, change.saved?.id, change.proposed?.id]),
    [[1, 'check-plan', 'probe']]);
  assert.equal(changes[0]?.episode.last, withPrediction);
  assert.equal(timeline[0]?.rule?.id, 'check-plan');
  assert.equal(timeline[1]?.rule, null);
  assert.equal(strategyClassificationChanges(timeline, [check, probe]).length, 0);
});
