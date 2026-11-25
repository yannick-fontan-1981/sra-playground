import assert from 'node:assert/strict';
import test from 'node:test';
import { replayCampaignBudgets, replayLevelBudget } from '../scripts/sic-replay-budgets.mjs';

test('budgets allow measured margins and use explicit fallback limits when a reference is absent', () => {
  assert.deepEqual(replayLevelBudget({ actions: 22, timeMs: 24_000, source: 'qualified_win' }),
    { actions: 27, activeTimeMs: 33_000, timeBasis: 'measured', source: 'qualified_win' });
  assert.deepEqual(replayLevelBudget({ actions: 486, timeMs: 320_000, source: 'long_qualified_win' }),
    { actions: 516, activeTimeMs: 432_000, timeBasis: 'measured', source: 'long_qualified_win' });
  assert.deepEqual(replayLevelBudget({ actions: 12, source: 'verified_oracle' }),
    { actions: 17, activeTimeMs: 27_000, timeBasis: 'estimated_from_actions', source: 'verified_oracle' });
  assert.deepEqual(replayLevelBudget(null), { actions: 80, activeTimeMs: 90_000, source: 'no_level_reference' });
  assert.throws(() => replayLevelBudget({ actions: 0, source: 'unfinished' }), /witnessed actions/);
});

test('a supplied reference overrides only its own level and empty levels retain documented limits', () => {
  const known = new Map([['PUZZLE', [{ actions: 30, source: 'prior' }, { actions: 11, source: 'prior' }]]]);
  const caps = replayCampaignBudgets('PUZZLE', 3, known,
    { PUZZLE: [{ actions: 8, source: 'verified_oracle' }, null] });
  assert.deepEqual(caps.map(cap => [cap.actions, cap.source]), [[13,'verified_oracle'],[16,'prior'],[80,'no_level_reference']]);
});
