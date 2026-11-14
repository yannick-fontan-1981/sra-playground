import assert from 'node:assert/strict';
import test from 'node:test';
import { auditStrategyGraph, compileStrategyGraph, resolveStrategyGraph } from '../src/sic/strategy-agenda.ts';
import { selectFrontierStrategy } from '../src/sic/frontier-strategy.ts';

const dimensions = ['contact', 'room'] as const;
const graph = compileStrategyGraph<'direct' | 'detour', typeof dimensions[number]>({
  id: 'test-access',
  version: 1,
  order: 'FALLBACK',
  priorities: ['direct', 'detour'],
  strategies: {
    direct: [{ fact: 'contact', expected: true, label: 'Contact proved' }],
    detour: [{ fact: 'room', expected: true, label: 'Room proved' }],
  },
}, dimensions);

test('unproved guards and shadow evaluation never invoke the planners', () => {
  const planners = { direct: () => assert.fail('direct planner called'), detour: () => assert.fail('detour planner called') };
  const shadow = resolveStrategyGraph({ graph, facts: { contact: { value: true, evidence: ['return:1'] } }, mode: 'shadow', planners });
  assert.equal(shadow.selected, null);
  assert.deepEqual(shadow.entries.map(entry => [entry.id, entry.applicability, entry.result]),
    [['direct', 'applicable', 'shadow'], ['detour', 'undetermined', 'skipped']]);
  const active = resolveStrategyGraph({ graph, facts: { contact: { value: false, evidence: ['return:2'] } }, mode: 'active', planners });
  assert.equal(active.selected, null);
  assert.deepEqual(active.entries.map(entry => entry.applicability), ['inapplicable', 'undetermined']);
});

test('the graph uses the next proven strategy only when the first has no admissible plan', () => {
  const resolution = resolveStrategyGraph({
    graph, mode: 'active', planners: { direct: () => null, detour: () => 'access' },
    facts: { contact: { value: true, evidence: ['return:1'] }, room: { value: true, evidence: ['return:2'] } },
  });
  assert.deepEqual(resolution.selected, { id: 'detour', plan: 'access' });
  assert.deepEqual(resolution.entries.map(entry => [entry.result, entry.evidence]), [
    ['no_plan', ['return:1']], ['selected', ['return:2']],
  ]);
  assert.throws(() => compileStrategyGraph({ ...graph, priorities: ['direct', 'direct'] }, dimensions), /strategy order/);
  assert.throws(() => compileStrategyGraph(graph, ['room']), /applicability conditions/);
});

test('the declarative audit counts each situation once and exposes fallback overlap', () => {
  assert.deepEqual(auditStrategyGraph(graph), {
    dimensions, combinations: 4, covered: 3, uncovered: 1, overlapping: 1,
    matches: [{ id: 'direct', applicable: 2, first: 2 }, { id: 'detour', applicable: 2, first: 1 }],
  });
});

test('frontier access needs a witnessed route before its agenda can select a plan', () => {
  const exhausted = selectFrontierStrategy<string, string>(undefined, null, 'return:1');
  assert.equal(exhausted.selected, null);
  assert.equal(exhausted.entries.find(entry => entry.id === 'reach_open_input')?.result, 'no_plan');
  const route = { path: ['edge:1'], question: 'probe:1' };
  assert.deepEqual(selectFrontierStrategy(undefined, route, 'return:2').selected,
    { id: 'reach_open_input', plan: route });
  assert.deepEqual(selectFrontierStrategy('probe:2', route, 'return:3').selected,
    { id: 'test_local_input', plan: { path: [], question: 'probe:2' } });
});
