import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const witness = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-profile-continuity-public.json.gz', import.meta.url))));
const sample = () => structuredClone(witness.run);
const continued = run => run.executedTickets.find(ticket => ticket.level === 6 && ticket.actionIndex === 1);

test('the public profile campaign retains six official scores, 119 commands and 78 confirmed continuations', () => {
  const report = checkRun(sample());
  assert.deepEqual(report.map(row => row.commands), [8, 8, 20, 29, 24, 30]);
  assert.deepEqual(report.map(row => row.continued), [0, 5, 14, 20, 17, 22]);
  assert.ok(report.slice(1).every(row => row.physical.includes('profile preparation with grip')));
});

test('the same successful profile commands cannot be split into one decision per command', () => {
  const run = sample();
  for (const [index, ticket] of run.executedTickets.entries()) {
    ticket.decisionRevision = 1000 + index; ticket.actionIndex = 0;
    ticket.sealed = 1; ticket.sealCount = 1; ticket.planId = 'isolated-' + index;
    Object.assign(ticket.outcome, { sic_plan: ticket.planId, index: 0, seal_prefix: true });
  }
  assert.throws(() => checkRun(run), /LKEY lost its move series/);
});

test('profile continuation requires the exact acknowledged return of every executed ticket', () => {
  for (const corrupt of [
    ticket => { ticket.outcomeCount = 2; },
    ticket => { ticket.outcome.sic_plan = 'unrelated-plan'; },
    ticket => { ticket.outcome.index = 99; },
  ]) {
    const run = sample(); corrupt(continued(run));
    assert.throws(() => checkRun(run), /actual return/);
  }
});

test('a profile series cannot continue after a contradiction or an owner-requested closure', () => {
  const contradicted = sample(); continued(contradicted).outcome.matched = false;
  assert.throws(() => checkRun(contradicted), /without a confirmed return/);
  const closed = sample(); continued(closed).outcome.seal_prefix = true;
  assert.throws(() => checkRun(closed), /owner closed the prefix/);
});

test('profile reconciliation must cover the actual prefix once at its end', () => {
  const partial = sample(); partial.executedTickets.at(-1).sealed--;
  assert.throws(() => checkRun(partial), /Missing final reconciliation/);
  const repeated = sample(); repeated.executedTickets.at(-1).sealCount = 2;
  assert.throws(() => checkRun(repeated), /exactly one final reconciliation/);
});

test('walking or unchanged pixels cannot replace the observed profile grip preparation', () => {
  const walking = sample();
  for (const [index, ticket] of walking.executedTickets.entries()) if (ticket.action === 'ACTION5') {
    ticket.action = 'ACTION1'; walking.steps[index].a = 1;
  }
  assert.throws(() => checkRun(walking), /confirmed profile preparation series/);
  const unchanged = sample();
  for (const [index, ticket] of unchanged.executedTickets.entries()) if (ticket.action === 'ACTION5') unchanged.steps[index].pixels = 0;
  assert.throws(() => checkRun(unchanged), /confirmed profile preparation series/);
});

test('the profile witness must preserve the original chronological session without resetting', () => {
  const direct = sample(); direct.start = 2;
  assert.throws(() => checkRun(direct), /start at level one/);
  const reset = sample(); reset.executedTickets[9].resets = 1;
  assert.throws(() => checkRun(reset), /action ceiling or reset/);
});
