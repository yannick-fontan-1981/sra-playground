import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseFeedbackTrial, type FeedbackConfiguration } from '../src/logos-engine/v6-feedback-sequences-finite.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

test('a bounded comparison of equivalent outcomes selects the full minimax trial', () => {
  const configuration: FeedbackConfiguration = { stages: [], allocation_orders: ['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT'],
    measures: ['WORST_NONWINNING_RESIDUAL', 'SUM_SQUARED_RESIDUALS', 'NONWINNING_BRANCHES'], maximum_candidates: 4096,
    maximum_trials: 256, maximum_evaluations: 65536, maximum_bundle: 1, group_equivalent_trials: true, question: 'Compare trials' };
  const assess = (settings: FeedbackConfiguration) => chooseFeedbackTrial([0, 1, 2, 3, 4], 5, [], [],
    [null, null, null, null, null], true, {} as NativeObservation, 30, settings);
  const limited = assess(configuration);
  const exhaustive = assess({ ...configuration, maximum_evaluations: 200000 });
  const optimized = assess({ ...configuration, prune_dominated_trials: true });
  assert.equal(limited.status, 'partition_bound');
  assert.equal(optimized.status, 'proposed');
  assert.equal(optimized.candidate_count, 3125);
  assert.deepEqual(optimized.trial, exhaustive.trial);
  assert.deepEqual(optimized.minimax, exhaustive.minimax);
  assert.equal(optimized.partition_count, exhaustive.partition_count);
});
