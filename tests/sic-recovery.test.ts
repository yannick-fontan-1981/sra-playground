import assert from 'node:assert/strict';
import { test } from 'node:test';
import { firstRecovery, objectiveHistory, observeLs20Restart } from '../src/sic/recovery.ts';
import type { DirectionalReturn } from '../src/sic/directional-return.ts';
import type { DecisionSprites } from '../src/sic/native-resolution.ts';

const board = Array.from({ length: 64 }, () => Array<number>(64).fill(3));
const yellow = board.map(row => row.map(() => 11));
const decision: DecisionSprites = { family: 'morphology', objective: 'G_official_completion', objectiveSource: 'native',
  question: 'test contact', operation: 'OP18', composition: null, proposalRef: null, route: [[1, 1], [2, 1]],
  steps: [{ action: 'Right', expected: 'Position (2, 1)' }], remainingSteps: 1, sprites: [] };

test('a restart ends the old episode but preserves an explicitly reused objective', () => {
  const restart = observeLs20Restart(board, board, [yellow, yellow, board]);
  assert.ok(restart);
  assert.equal(observeLs20Restart(board, board, [yellow, board]), undefined);
  const action = (sequence: number, overrides: Partial<DirectionalReturn> = {}): DirectionalReturn => ({
    sessionId: 's', sequence, command: 4, fromLevel: 2, toLevel: 2, changes: null, translation: null, stationary: null, decision, ...overrides,
  });
  const returned = [action(38), action(39, { restart }), action(40), action(41, { toLevel: 3 })];
  assert.deepEqual(objectiveHistory(returned).map(item => [item.first, item.last, item.interrupted, item.advanced]),
    [[38, 39, true, false], [40, 41, false, true]]);
  assert.equal(firstRecovery(returned, 2)?.retained, true);
  assert.equal(firstRecovery([action(39, { restart, decision: { ...decision, objective: 'G_protocol_completion' } }), action(40)], 2)?.retained, true);
  const uncertain = [returned[1]!, action(40, { decision: { ...decision, objectiveSource: 'question' } })];
  assert.equal(firstRecovery(uncertain, 2)?.retained, false);
});
