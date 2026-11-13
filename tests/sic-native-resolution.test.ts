import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureDecisionSprites, readNativeResolution } from '../src/sic/native-resolution.ts';

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

test('an authorized proposal keeps its objective, operation and bounded native sprite evidence', () => {
  const snapshot = {
    sessionId: 's', sequence: 5, level: 2, lastDecision: 'morphology', phase: 'authorised_not_executed',
    trace: [{ kind: 'proposal', family: 'morphology' }, { kind: 'before_guard', family: 'morphology', index: 0, admitted: true }],
    proposal: { actions: [{ action_ref: 'ACTION1' }], binding: { observation_ref: 's:epoch:2:revision:6:frame:b' },
      bundle_template: { objective_ref: 'G_official_completion', operation_key: 'OP18', composition_ref: 'composition:morphology:test' },
      morphology_plan: { pair: { sites: [[0, 0, 1, 1], [12, 12, 15, 15]] }, steps: [{ from: [1, 1] }], size: [2, 2] } },
  };
  const decision = readNativeResolution(snapshot)!;
  assert.equal(decision.objectiveSource, 'native');
  assert.equal(decision.operation, 'OP18');
  const captured = captureDecisionSprites(decision, [[0, 1, 2], [1, 2, 3], [2, 3, 4]], null);
  assert.equal(captured.sprites.length, 2);
  assert.deepEqual(captured.sprites[0]?.before, [[0, 1], [1, 2]]);
  assert.equal(captured.sprites[0]?.after, null);
  assert.equal(readNativeResolution({ ...snapshot, level: 3 })?.subjects.length, 0);
  const withoutObjective = readNativeResolution({ ...snapshot, proposal: {
    actions: snapshot.proposal.actions, question: { reason: 'Find a route to the next known position' },
  } })!;
  assert.equal(withoutObjective.objectiveSource, 'question');
  assert.equal(withoutObjective.objective, 'Find a route to the next known position');
});
