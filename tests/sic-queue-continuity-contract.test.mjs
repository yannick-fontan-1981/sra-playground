import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const witness = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-queue-continuity-public.json.gz', import.meta.url))));
const sample = () => structuredClone(witness.run);
const receive = run => run.executedTickets.find(ticket => ticket.actionIndex > 0
  && ticket.queued?.role === 'receive' && ticket.outcome.reason !== 'official_boundary');
const preparation = run => run.executedTickets.find(ticket => ticket.actionIndex === 0
  && ticket.sealed === null && ticket.queued?.role === 'translate');
const boundaries = run => run.executedTickets.filter(ticket => ticket.outcome.reason === 'official_boundary');

test('the public queue campaign keeps 103 commands and 29 prepared receives with 57 continued commands', () => {
  const report = checkRun(sample());
  assert.deepEqual(report.map(row => row.commands), [17, 17, 20, 23, 10, 16]);
  assert.deepEqual(report.map(row => row.continued), [7, 11, 9, 13, 7, 10]);
  assert.deepEqual(report.map(row => row.series), [4, 5, 5, 6, 3, 6]);
  assert.ok(report.every(row => row.physical.split(', ').length === row.series));
  assert.ok(report.every(row => row.physical.includes('queue preparation then receive')));
});

test('the same successful queue commands cannot be split into one decision per command', () => {
  const run = sample();
  for (const [index, ticket] of run.executedTickets.entries()) {
    ticket.decisionRevision = 1000 + index; ticket.actionIndex = 0;
    ticket.sealed = 1; ticket.sealCount = 1; ticket.planId = 'isolated-' + index;
    Object.assign(ticket.outcome, { sic_plan: ticket.planId, index: 0, seal_prefix: true });
  }
  assert.throws(() => checkRun(run), /COLM lost its move series/);
});

test('a preparation cannot omit its known receive or claim knowledge acquired only afterwards', () => {
  const missing = sample(); receive(missing).queued.role = 'reorder';
  assert.throws(() => checkRun(missing), /preparation lost the receive contact/);
  for (const corrupt of [
    q => { q.learnedEvidence = []; }, q => { q.acquisitionEpoch = q.levelEpoch + 1; },
    q => { q.actionRef = 'ACTION5'; },
    q => { q.learnedEvidence = q.learnedEvidence.map(ref => ref.replace(/^.*?:epoch:/, 'foreign:epoch:')); },
    q => { q.learnedEvidence[1] = q.afterRef; },
  ]) {
    const run = sample(); corrupt(receive(run).queued);
    assert.throws(() => checkRun(run), /receive lost its actual contact/);
  }
});

test('current receive acquisition must bind the actual command and both observations at the current epoch', () => {
  for (const corrupt of [
    q => { q.acquisition = null; }, q => { q.acquisition.epoch = 0; },
    q => { q.acquisition.revalidatedEpoch = 0; }, q => { q.acquisition.kind = 'reorder'; },
    q => { q.acquisition.transition = 'single_public_preparation'; },
    q => { q.acquisition.evidence = [...q.learnedEvidence]; },
    q => { q.afterRef = 'unrelated-observation'; },
  ]) {
    const run = sample(); corrupt(receive(run).queued);
    assert.throws(() => checkRun(run), /receive lost its actual contact/);
  }
});

test('each official receive score closes the prefix even without current owner reacquisition', () => {
  const run = sample();
  assert.equal(boundaries(run).length, 6);
  for (const ticket of boundaries(run)) ticket.queued.acquisition = null;
  assert.deepEqual(checkRun(run), checkRun(sample()));
});

test('a score value without the native official boundary cannot replace receive acquisition', () => {
  const run = sample(), ticket = boundaries(run)[0];
  ticket.outcome.reason = 'observe_queued_control_or_reception';
  ticket.queued.acquisition = null;
  assert.throws(() => checkRun(run), /receive lost its actual contact/);
  const missingScore = sample(); boundaries(missingScore)[0].queued.scoreAfter = null;
  assert.throws(() => checkRun(missingScore), /receive lost its actual contact/);
});

test('unrelated movement series cannot replace continuous queue preparation', () => {
  const run = sample(), first = preparation(run);
  for (const [index, ticket] of run.executedTickets.entries()) {
    if (ticket.level !== first.level || ticket.decisionRevision !== first.decisionRevision) continue;
    ticket.outcome.family = 'sic_verify_coupled_route'; run.steps[index].family = ticket.outcome.family;
    delete ticket.queued;
  }
  assert.throws(() => checkRun(run), /lost continuous preparation followed by receive/);
});

test('known preparation must change the matching physical observation before the same receive', () => {
  for (const corrupt of [
    (run, ticket, index) => { run.steps[index].pixels = 0; },
    (run, ticket, index) => { run.steps[index].from = 'unrelated-frame'; },
    (run, ticket) => { ticket.queued.learnedEvidence = []; },
    (run, ticket) => { ticket.queued.beforeRef = ticket.queued.beforeRef.replace(/^.*?:epoch:/, 'foreign:epoch:'); },
    (run, ticket) => { ticket.queued.role = 'receive'; },
  ]) {
    const run = sample(), ticket = preparation(run), index = run.executedTickets.indexOf(ticket);
    corrupt(run, ticket, index);
    assert.throws(() => checkRun(run), /known physical preparation|receive lost its actual contact/);
  }
});

test('queue continuation stops at contradiction or requested closure and retains return identity', () => {
  for (const corrupt of [
    ticket => { ticket.outcome.matched = false; }, ticket => { ticket.outcome.seal_prefix = true; },
    ticket => { ticket.outcomeCount = 2; }, ticket => { ticket.outcome.sic_plan = 'another-plan'; },
  ]) {
    const run = sample(); corrupt(preparation(run));
    assert.throws(() => checkRun(run), /confirmed return|owner closed the prefix|actual return/);
  }
});

test('receive reconciliation covers only the actually executed prefix and occurs once', () => {
  const partial = sample(); receive(partial).sealed--;
  assert.throws(() => checkRun(partial), /Missing final reconciliation/);
  const repeated = sample(); receive(repeated).sealCount = 2;
  assert.throws(() => checkRun(repeated), /exactly one final reconciliation/);
});

test('queue qualification preserves the original chronological session and per-level action ceilings', () => {
  const direct = sample(); direct.start = 2;
  assert.throws(() => checkRun(direct), /start at level one/);
  const reset = sample(); reset.executedTickets[9].resets = 1;
  assert.throws(() => checkRun(reset), /action ceiling or reset/);
});
