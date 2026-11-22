import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

function sample(series) {
  const executedTickets = series.flatMap((length, decisionRevision) =>
    Array.from({ length }, (_, actionIndex) => ({
      level: 1,
      decisionRevision,
      actionIndex,
      action: 'ACTION6',
      sealed: actionIndex === length - 1 ? length : null,
    })),
  );
  return {
    code: 'HANO',
    solver: 'sic',
    executedTickets,
    levels: [{ level: 1, won: true, actions: executedTickets.length }],
    issued: executedTickets.length,
    sic: executedTickets.length,
  };
}
test('a win with identical commands but a new decision at every step fails the continuity gate', () => {
  assert.doesNotThrow(() => checkRun(sample([2, 2, 2])));
  assert.throws(() => checkRun(sample([1, 1, 1, 1, 1, 1])), /lost its click series/);
});
test('refuses early or incomplete reconciliation, a skipped ticket and an oversized series', () => {
  const early = sample([2]);
  early.executedTickets[0].sealed = 1;
  assert.throws(() => checkRun(early), /Reconciliation before end/);
  const partial = sample([3]);
  partial.executedTickets[2].sealed = 2;
  assert.throws(() => checkRun(partial), /Missing final reconciliation/);
  const gap = sample([3]);
  gap.executedTickets[1].actionIndex = 2;
  assert.throws(() => checkRun(gap), /Unexpected step/);
  assert.throws(() => checkRun(sample([17])), /More than 16/);
});
