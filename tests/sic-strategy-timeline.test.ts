import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DirectionalReturn } from '../src/sic/directional-return.ts';
import { auditStrategyPriority, countStrategyFacts, measureStrategyCoverage } from '../src/sic/strategy-coverage.ts';
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

test('priority audit counts the actual winners across games and distinguishes an absent match', () => {
  const first = step(1, 1, 0, false), next = step(2, 2, 0, true);
  const otherGame: DirectionalReturn = {
    ...step(1, 1, 0, null), sessionId: 'other',
    decision: { ...first.decision!, remainingSteps: 1, steps: [{ action: 'Right', expected: null }] },
  };
  const as = countStrategyFacts(strategyTimeline([first, next]));
  const syme = countStrategyFacts(strategyTimeline([otherGame, { ...otherGame, sequence: 2 }]));
  const [replan, check, probe] = defaultStrategyRules;
  const equivalentCheck = { ...check!, when: ['publishedQuestion'], whenAny: [] };
  const rules = [replan!, equivalentCheck, probe!];
  const results = auditStrategyPriority([...as, ...syme], rules);
  assert.equal(results[2]?.matches, 4);
  assert.equal(results[2]?.first, 0);
  assert.deepEqual([...results[2]!.winners].map(([rule, count]) => [rule.id, count]), [['check-plan', 3], ['replan', 1]]);
  const onlySyme = auditStrategyPriority(syme, rules);
  assert.equal(onlySyme[0]?.matches, 0);
  assert.equal(onlySyme[1]?.first, 2);
  assert.equal(auditStrategyPriority([...as, ...syme], [probe!, replan!, equivalentCheck])[0]?.first, 4);
});

test('coverage counts actions once and excludes unmeasured games from the denominator', () => {
  const first = step(1, 1, 0, true), second = step(2, 1, 1, true);
  const recoveryDecision = { strategy: 'Revise contact', need: 'Restore a projection',
    objective: { id: 'seek', label: 'Find access', parent: 'G_official_completion' }, maxDepth: 88, maxNodes: 1000, packDigest: null };
  const history = strategyTimeline([
    { ...first, decision: { ...first.decision!, recoveryDecision } },
    { ...second, decision: { ...second.decision!, recoveryDecision } },
    step(3, 2, 0, null),
  ]);
  const length = (episode: typeof history[number]) => episode.last.sequence - episode.first.sequence + 1;
  const legacy = { groups: countStrategyFacts(history), actions: null, actionsByFacts: null, shownActions: null, shownActionsByFacts: null };
  const sample = { ...legacy, actions: 4, actionsByFacts: countStrategyFacts(history, length),
    shownActions: 2, shownActionsByFacts: countStrategyFacts(history.slice(0, 1), length) };
  assert.deepEqual(measureStrategyCoverage([legacy, sample], defaultStrategyRules), {
    measured: 1, actions: 4, configurable: 3, shown: 2, shownConfigurable: 2, active: 2, shownActive: 2,
  });
});
