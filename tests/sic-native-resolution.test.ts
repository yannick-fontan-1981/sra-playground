import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readNativeResolution } from '../src/sic/native-resolution.ts';

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
