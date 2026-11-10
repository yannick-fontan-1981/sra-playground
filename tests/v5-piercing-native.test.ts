import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { normalizePiercingConfiguration, normalizePiercingCommandEffect, normalizePiercingConditionalModel,
  simulatePiercingModel, measurePiercingGoal, measurePiercingIntersections, searchPiercingPlans } from '../src/logos-engine/v5-piercing-plan.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v5-piercing-reference.json.gz', import.meta.url))).toString());

test('piercing expectations are exported from the unchanged pinned V5 source', () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.originalFilesVerifiedBefore, 1786);
  assert.equal(fixture.originalFilesVerifiedAfter, 1786);
  assert.ok(fixture.cases.length >= 20);
  for (const [path, digest] of Object.entries(fixture.sourceFiles)) {
    const bytes = readFileSync(new URL('../reference/v6/' + fixture.sourceCommit + '/source/' + path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, path);
  }
});

for (const item of fixture.cases as R[]) test('piercing source parity: ' + item.id, () => {
  const a = structuredClone(item.arguments);
  let actual: unknown;
  switch (item.operation) {
    case 'configuration': actual = normalizePiercingConfiguration(a.value); break;
    case 'effect': actual = normalizePiercingCommandEffect(a.value); break;
    case 'model': actual = normalizePiercingConditionalModel(a.value); break;
    case 'simulate': actual = simulatePiercingModel(a.request, a.model); break;
    case 'intersections': actual = measurePiercingIntersections(a.request); break;
    case 'goal': actual = measurePiercingGoal(a.request); break;
    case 'search': actual = searchPiercingPlans(a.request); break;
    default: throw new Error('Unknown piercing fixture operation: ' + item.operation);
  }
  assert.deepEqual(actual, item.expected, item.id);
  assert.deepEqual(a, item.arguments, 'Native mechanics must not revise caller-owned contracts');
});

function inputs(): { configuration: R; effect: R; model: R; search: R } {
  const configuration = {
    configuration_ref: 'configuration:budget', rods: [{ rod_ref: 'r', root_ref: 'root', root_to_tip_positions: [[0, 0]] }],
    pieces: [{ piece_ref: 'p', type_ref: 'target', occupied_positions: [[0, 1]], support_refs: [] }],
    domain_positions: Array.from({ length: 7 }, (_, c) => [0, c]), root_footprints: [['root', [[0, 0]]]], movable_piece_refs: ['p'],
  };
  const effect = { effect_ref: 'extend', action_ref: 'opaque-command', rod_ref: 'r', extent_delta: 1, axis_direction: [0, 1], resource_cost: 3 };
  const model = { model_ref: 'source-law', push_enabled: true, entry_enabled: true, entry_requires_stop: false,
    entry_attaches: true, carry_on_root_translation: true, retain_on_retraction: true, withdraw_requires_reverse_stop: true,
    possible_support_mode: 'carried' };
  const search = { configuration, effects: [effect], models: [model], goal_requested_root_ref: 'root', goal_requested_type_order: ['target'],
    max_microsteps: 3, max_depth: 3, max_nodes: 20, max_plans: 1 };
  return { configuration, effect, model, search };
}

test('native deadline exposes an unexpanded frontier without claiming a complete result', () => {
  const { search } = inputs();
  const result = searchPiercingPlans(search, { deadlineMs: 4, now: () => 4 });
  assert.equal(result.expanded_node_count, 0);
  assert.equal(result.open_frontier_count, 1);
  assert.deepEqual(result.open_frontier_model_refs, ['source-law']);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.plans, []);
  assert.deepEqual(result.exhausted_bound_refs, ['bound.native_interruption']);
  assert.deepEqual(result.missing_premise_refs, ['bound.native_interruption']);
});

test('native interruption inside an effect does not invent a microstep bound or enqueue a partial plan', () => {
  const { search } = inputs();
  let checks = 0;
  const result = searchPiercingPlans(search, { shouldStop: () => ++checks >= 4 });
  assert.equal(result.expanded_node_count, 1);
  assert.equal(result.open_frontier_count, 1);
  assert.deepEqual(result.unresolved_model_refs, ['source-law']);
  assert.deepEqual(result.plans, []);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.exhausted_bound_refs, ['bound.native_interruption']);
  assert.deepEqual(result.missing_premise_refs, ['bound.native_interruption']);
});

test('native interruption retains only committed microsteps and does not alias its caller', () => {
  const { configuration, effect, model } = inputs();
  configuration.pieces[0].occupied_positions = [[0, 2]];
  effect.extent_delta = 2;
  const request = { configuration, effect, models: [model], max_microsteps: 3 }, before = structuredClone(request);
  let checks = 0;
  const result = simulatePiercingModel(request, model, { shouldStop: () => ++checks >= 2 });
  assert.equal(result.executed_microsteps, 1);
  assert.equal(result.requested_microsteps, 2);
  assert.equal(result.completed, false);
  assert.equal(result.truncated, true);
  assert.equal(result.intermediate_configurations.length, 1);
  assert.deepEqual(result.configuration.rods[0].root_to_tip_positions, [[0, 0], [0, 1]]);
  assert.deepEqual(result.missing_premise_refs, ['bound.native_interruption']);
  result.configuration.pieces[0].occupied_positions[0][0] = 999;
  assert.deepEqual(request, before);
});

test('a budget that never expires preserves every source field', () => {
  const { search } = inputs();
  const expected = searchPiercingPlans(search), actual = searchPiercingPlans(search, { deadlineMs: 100, now: () => 0, shouldStop: () => false });
  assert.equal(expected.plans.length, 1);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.plans[0].action_refs, ['opaque-command']);
  assert.equal(actual.plans[0].resource_cost_lower_bound, 3);
});

test('observed, possible and hypothetical support retain different goal claims', () => {
  const { configuration } = inputs();
  configuration.rods[0].root_to_tip_positions.push([0, 1]);
  const request = { configuration, requested_root_ref: 'root', requested_type_order: ['target'] };
  assert.equal(measurePiercingGoal(request).rooted_match, false, 'overlap is not support');
  configuration.pieces[0].support_refs = ['r'];
  assert.equal(measurePiercingGoal(request).rooted_match, true);
  configuration.hypothetical_support_pairs = [['r', 'p']];
  const hypothetical = measurePiercingGoal(request);
  assert.equal(hypothetical.rooted_match, false);
  assert.equal(hypothetical.predicted_rooted_match, true);
  configuration.possible_support_pairs = [['r', 'p']];
  assert.equal(measurePiercingGoal(request).predicted_rooted_match, false);
});

test('out of domain geometry remains unresolved when the boundary is unconfirmed', () => {
  const { configuration, effect, model } = inputs();
  configuration.domain_positions = [[0, 0], [0, 1]];
  configuration.domain_boundary_is_known = false;
  model.entry_enabled = false;
  const result = simulatePiercingModel({ configuration, effect, models: [model], max_microsteps: 3 }, model);
  assert.deepEqual(result.unresolved_refs, ['boundary.unconfirmed_domain']);
  assert.deepEqual(result.missing_premise_refs, ['premise.unknown_domain_exit_outcome']);
  assert.deepEqual(result.blocking_refs, []);
  assert.equal(result.executed_microsteps, 0);
});

test('native contracts reject missing laws only as unresolved premises and reject malformed geometry', () => {
  const { configuration, effect, search } = inputs();
  const unknown = normalizePiercingConditionalModel({ model_ref: 'unknown' });
  const result = simulatePiercingModel({ configuration, effect, models: [unknown], max_microsteps: 3 }, unknown);
  assert.deepEqual(result.missing_premise_refs, ['premise.push_enabled']);
  assert.throws(() => normalizePiercingCommandEffect({ ...effect, axis_direction: [1, 1] }), /cardinal/);
  assert.throws(() => normalizePiercingCommandEffect({ ...effect, extent_cross_section_offsets: [[0, 1]] }), /transverse/);
  assert.throws(() => normalizePiercingCommandEffect({ ...effect, extent_cross_section_offsets: [] }), /length/);
  assert.throws(() => normalizePiercingCommandEffect({ ...effect, root_translation: [Number.MAX_SAFE_INTEGER + 1, 0] }), /portable/);
  assert.throws(() => normalizePiercingCommandEffect({ ...effect, extent_delta: null }), /portable/);
  assert.throws(() => normalizePiercingConfiguration({ ...configuration, domain_positions: [[0, 0], [0, 0]] }), /Duplicate/);
  assert.throws(() => normalizePiercingConfiguration({ ...configuration, obstacles: null }), /array/);
  assert.throws(() => normalizePiercingConditionalModel({ model_ref: 'm', support_assignments: [['r', 'p', 'carried'], ['r', 'p', 'independent']] }), /Duplicate/);
  assert.throws(() => searchPiercingPlans({ ...search, staged_profiles: [{}] }), /non-staged/);
  assert.throws(() => searchPiercingPlans({ ...search, continuation: {} }), /continuations/);
  assert.throws(() => searchPiercingPlans({ ...search, work_slice_nodes: 1 }), /non-staged/);
});
