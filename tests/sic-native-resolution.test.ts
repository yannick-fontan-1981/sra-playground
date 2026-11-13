import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureDecisionSprites, readNativeResolution } from '../src/sic/native-resolution.ts';
import { explainDecision, orientationAfter, strategyEpisodes, strategyLinks, strategyOutcome } from '../src/sic/decision-configurations.ts';
import type { DirectionalReturn } from '../src/sic/directional-return.ts';

test('native explanation separates the pending step, its guard, and the latest observed result', () => {
  const command = { action_ref: 'ACTION1' };
  const info = readNativeResolution({
    sessionId: 's', sequence: 2, level: 1, lastDecision: 'morphology', phase: 'authorised_not_executed',
    proposal: { kind: 'morphology_probe', actions: [command, command],
      steps: [{ expected_after: { position: [10, 15] } }, { expected_after: null }] },
    trace: [
      { kind: 'proposal', family: 'morphology' },
      { kind: 'actual_outcome', family: 'other', matched: false, observation_ref: 'old:epoch:1:revision:3:frame:1' },
      { kind: 'actual_outcome', family: 'morphology', matched: true, observation_ref: 's:epoch:1:revision:3:frame:2' },
      { kind: 'before_guard', family: 'morphology', index: 1, reason: 'current_geometry_bound', admitted: true },
    ],
  });
  assert.equal(info?.guard, 'current_geometry_bound');
  assert.equal(info?.nextIndex, 1);
  assert.deepEqual(info?.steps, [{ action: 'Up', expected: 'Position (10, 15)' }, { action: 'Up', expected: null }]);
  assert.equal(info?.outcome?.matched, true);
});

test('a released plan without a morphology proposal can show its expected destination', () => {
  const command = { action_ref: 'ACTION4' };
  const state = readNativeResolution({
    sessionId: 's', sequence: 2, level: 1, lastDecision: 'support', phase: 'authorised_not_executed',
    proposal: { actions: [command, command], support_plan: { body_type: [4, 1, 1] },
      steps: [{ from: [0, 0], to: [1, 0] }, { expected_before: { body_position: [1, 0] }, expected_after: { body_position: [2, 0] } }] },
    trace: [{ kind: 'proposal', family: 'support' },
      { kind: 'why_act_release', admitted: true, decision_revision: 5 },
      { kind: 'before_guard', family: 'support', index: 1, admitted: true }],
  })!;
  const receipt = captureDecisionSprites(state, [[0, 4, 0]], [[4, 0, 0]]);
  assert.equal(receipt.planRevision, 5);
  assert.equal(receipt.steps[0]?.expected, 'Position (2, 0)');
  assert.deepEqual(receipt.sprites.find(sprite => sprite.label === 'Predicted destination')?.after, [[0]]);
});

test('an authorized proposal keeps its objective, operation and bounded native sprite evidence', () => {
  const snapshot = {
    sessionId: 's', sequence: 5, level: 2, lastDecision: 'morphology', phase: 'authorised_not_executed',
    trace: [{ kind: 'proposal', family: 'morphology' }, { kind: 'before_guard', family: 'morphology', index: 0, admitted: true }],
    proposal: { actions: [{ action_ref: 'ACTION1' }], binding: { observation_ref: 's:epoch:2:revision:6:frame:b' },
      bundle_template: { objective_ref: 'G_official_completion', operation_key: 'OP18', composition_ref: 'composition:morphology:test' },
      morphology_plan: { pair: { sites: [[0, 0, 1, 1], [12, 12, 15, 15]] }, steps: [{ from: [1, 1] }], size: [2, 2],
        access_phase: 'contact', physical_effect: 'modifier', entry_model: { residual: 2, entry_delta: 1, observation_ref: 's:epoch:2:revision:6:frame:b',
          evidence: ['s:epoch:2:revision:6:frame:b', 's:epoch:2:revision:4:frame:a', 's:epoch:1:revision:2:frame:z'] } } },
  };
  const decision = readNativeResolution(snapshot)!;
  assert.equal(decision.objectiveSource, 'native');
  assert.equal(decision.operation, 'OP18');
  const captured = captureDecisionSprites(decision, [[0, 1, 2], [1, 2, 3], [2, 3, 4]], null);
  assert.equal(captured.sprites.length, 2);
  assert.deepEqual(captured.sprites[0]?.before, [[0, 1], [1, 2]]);
  assert.equal(captured.sprites[0]?.after, null);
  assert.deepEqual(captured.context?.entryActions, [3]);
  assert.deepEqual(explainDecision(captured).map(rule => rule.when), ['orientationContact', 'levelObjective']);
  assert.equal(readNativeResolution({ ...snapshot, level: 3 })?.subjects.length, 0);
  const withoutObjective = readNativeResolution({ ...snapshot, proposal: {
    actions: snapshot.proposal.actions, question: { reason: 'Find a route to the next known position' },
  } })!;
  assert.equal(withoutObjective.objectiveSource, 'question');
  assert.equal(withoutObjective.objective, 'Find a route to the next known position');
});

test('strategy configurations tie recharge and color to separate, scoped public returns', () => {
  const snapshots = (route: string, sequence: number, guardIndex: number, extra = {}, facts = {}) => readNativeResolution({
    sessionId: 's', sequence, level: 3, lastDecision: 'morphology', phase: 'authorised_not_executed',
    trace: [{ kind: 'proposal', family: 'morphology' }, { kind: 'before_guard', family: 'morphology', admitted: true, index: guardIndex }],
    proposal: { proposal_id: route, actions: [{ action_ref: 'ACTION4' }, { action_ref: 'ACTION4' }],
      binding: { observation_ref: 's:epoch:3:revision:9:frame:b' },
      morphology_plan: { route_key: route, access_phase: 'contact', pair: { sites: [[0, 0, 1, 1], [2, 0, 3, 1]] }, size: [1, 1],
        steps: [{ from: [0, 2], to: [1, 2] }, { from: [1, 2], to: [2, 2] }], ...extra },
      morphology: { measured_facts: { color_relation: 'different', pair_ref: 'pair', feature_residuals: { observed_colors: [1, 3] },
        capacity_needed: true, direct_goal_cost_lower_bound: 6,
        meter_forecast: { measured_strip: ['x', 3, 4, 'hi', 4], steps_before_empty: 2, current_units: 2, loss_per_step: 1, capacity_steps: 4 },
        feature_reaccess: { effect_after: 'old:epoch:3:revision:5:frame:a' }, ...facts } } },
  })!;
  const before = [[1, 0, 3, 0], [0, 1, 0, 3], [2, 0, 8, 0], [0, 0, 4, 4]];
  const nearing = [...before.slice(0, 3), [0, 0, 0, 4]];
  const charged = [...before.slice(0, 3), [4, 4, 4, 4]];
  const recolored = [[3, 0, 3, 0], [0, 3, 0, 3], ...nearing.slice(2)];
  const receipt = (sequence: number, decision: DirectionalReturn['decision'], sessionId = 's'): DirectionalReturn => ({
    sessionId, sequence, command: 4, fromLevel: 3, toLevel: 3, decision, changes: null, translation: null, stationary: null,
  });
  const returns = [
    receipt(9, captureDecisionSprites(snapshots('capacity_probe', 8, 0), before, nearing)),
    receipt(10, captureDecisionSprites(snapshots('capacity_probe', 9, 1), nearing, charged)),
    receipt(11, captureDecisionSprites(snapshots('feature_probe', 10, 1), before, recolored)),
    receipt(12, captureDecisionSprites(snapshots('capacity_probe', 11, 1), nearing, charged), 'other'),
  ];
  const episodes = strategyEpisodes(returns, 's');
  assert.deepEqual(episodes.map(({ configuration, first, last }) => [configuration.when, first.sequence, last.sequence]),
    [['reserveContact', 9, 10], ['colorContact', 11, 11]]);
  assert.match(strategyOutcome(episodes[0]!.configuration, returns[0]!), /Only steps/);
  assert.match(strategyOutcome(episodes[0]!.configuration, returns[1]!), /gauge rose/);
  assert.deepEqual(returns[1]!.decision?.strategyMeter, { unitsBefore: 1, unitsAfter: 4, before: [[0, 0, 0, 4]], after: [[4, 4, 4, 4]] });
  assert.deepEqual(returns[1]!.decision?.strategyTarget?.before, [[8]]);
  assert.match(strategyOutcome(episodes[1]!.configuration, returns[2]!), /changed color in place/);
  assert.match(strategyOutcome(episodes[1]!.configuration, { ...returns[2]!, toLevel: 4 }), /cannot be separated/);
  assert.equal(snapshots('managed_access', 10, 1).context?.strategy?.colorWitness, null);
  assert.deepEqual(explainDecision(snapshots('capacity_access_probe', 9, 0)).map(rule => rule.when), ['reserveAccess']);

  const aligned = { color_relation: 'equal', orientation_relation: 'aligned', feature_residuals: { observed_colors: [3, 3] },
    single_pattern_change_observation_ref: 's:epoch:3:revision:11:frame:b' };
  const exit = { ...receipt(13, captureDecisionSprites(snapshots('peer', 12, 0, {}, aligned), recolored, null)), toLevel: 4 };
  const timeline = [...returns, exit];
  const linked = strategyEpisodes(timeline, 's');
  const final = linked.at(-1)!;
  assert.deepEqual(strategyLinks(final, linked, timeline).map(link => [link.kind, link.source.sequence]),
    [['nativePattern', 10], ['color', 11]]);
  assert.match(strategyOutcome(final.configuration, exit), /advanced the game to level 4/);
  assert.deepEqual(strategyLinks(final, linked, [...returns, { ...returns[3]!, sessionId: 's', restart: {} as NonNullable<DirectionalReturn['restart']> }, exit])
    .map(link => [link.kind, link.source.sequence]), [['nativePattern', 10]]);
  const afterRecharge = { ...receipt(12, captureDecisionSprites(snapshots('peer', 11, 0, {}, {
    ...aligned, single_pattern_change_observation_ref: 'other:epoch:3:revision:11:frame:b',
    meter_forecast: { measured_strip: ['x', 3, 4, 'hi', 4], steps_before_empty: 4, current_units: 4, loss_per_step: 1, capacity_steps: 4 },
  }), [...recolored.slice(0, 3), [4, 4, 4, 4]], null)), toLevel: 4 };
  const history = [...returns, afterRecharge];
  const episodesAfterRecharge = strategyEpisodes(history, 's');
  assert.deepEqual(strategyLinks(episodesAfterRecharge.at(-1)!, episodesAfterRecharge, history).map(link => [link.kind, link.source.sequence]),
    [['gauge', 10], ['color', 11]]);
  assert.equal(orientationAfter(returns[2]!, history), 'aligned');
  assert.equal(orientationAfter(returns[2]!, [...returns, { ...afterRecharge, sessionId: 'other' }]), null);
});
