import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';
import { workshopPhaseCeilings } from '../scripts/sic-workshop-phase-continuity-contract.mjs';

const original = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-workshop-phase-continuity-public.json.gz', import.meta.url))));
const copy = () => structuredClone(original);

test('the gate accepts all seven chronological workshop scores and measured phase walking at L6', () => {
  const result = checkRun(copy());
  assert.deepEqual(result.map(row => row.commands), [15, 45, 41, 43, 48, 94, 107]);
  assert.equal(result.length, 7);
  assert.equal(result[5].physical.split(', ').length, 11);
  assert.equal(result[6].series, 0, 'The measured last level is allowed to remain unitary');
  assert.deepEqual(workshopPhaseCeilings, [20, 54, 50, 52, 58, 113, 129]);
});

for (const [field, value, reason] of [['start', 6, /level one/], ['initialCompleted', 5, /chronological session/],
  ['parallelWorkers', 2, /one native worker/]]) test('the workshop gate rejects a changed ' + field, () => {
  const run = copy(); run[field] = value;
  assert.throws(() => checkRun(run), reason);
});

test('the workshop gate requires the final public score', () => {
  const run = copy(); run.levels[6].won = false;
  assert.throws(() => checkRun(run), /L7 failed to win/);
});

test('a reset cannot preserve the workshop continuity qualification', () => {
  const run = copy(); run.executedTickets.find(ticket => ticket.level === 6).resets = 1;
  assert.throws(() => checkRun(run), /ceiling or reset/);
});

test('the original per-level action ceiling still rejects excess unitary work', () => {
  const run = copy(), index = run.executedTickets.findIndex(ticket => ticket.level === 7);
  const source = run.executedTickets.find(ticket => ticket.level === 6 && ticket.sealed === 1 && !ticket.workshop);
  const extra = workshopPhaseCeilings[5] + 1 - run.levels[5].actions;
  const tickets = Array.from({ length: extra }, (_, i) => {
    const ticket = structuredClone(source);
    ticket.decisionRevision = 10000 + i; ticket.actionIndex = 0;
    ticket.planId += ':extra:' + i; ticket.outcome.sic_plan = ticket.planId; ticket.outcome.index = 0;
    return ticket;
  });
  run.executedTickets.splice(index, 0, ...tickets);
  run.levels[5].actions += extra; run.issued += extra; run.sic += extra;
  assert.throws(() => checkRun(run), /verified action ceiling/);
});

test('winning commands and generic continued motion cannot replace the measured workshop phase', () => {
  const run = copy(); run.executedTickets.forEach(ticket => { delete ticket.workshop; });
  assert.throws(() => checkRun(run), /measured station-phase walking/);
});

test('the same winning commands split into unitary decisions fail the workshop continuity gate', () => {
  const run = copy();
  for (const [index, ticket] of run.executedTickets.entries()) if (ticket.workshop) {
    ticket.decisionRevision = index + 1000; ticket.actionIndex = 0;
    ticket.planId = 'sic-plan:' + ticket.workshop.beforeRef;
    ticket.outcome.sic_plan = ticket.planId; ticket.outcome.index = 0; ticket.outcome.seal_prefix = true;
    ticket.sealCount = 1; ticket.sealed = 1; delete ticket.workshop;
  }
  assert.throws(() => checkRun(run), /lost its move series|measured station-phase walking/);
});

test('the workshop gate enforces native identity and exactly one final reconciliation', () => {
  for (const mutate of [
    ticket => { ticket.outcome.sic_plan += ':other'; },
    ticket => { ticket.sealCount = 2; },
  ]) {
    const run = copy(), ticket = run.executedTickets.find(ticket => ticket.workshop && ticket.sealed !== null);
    mutate(ticket);
    assert.throws(() => checkRun(run), /ticket identity|exactly one final reconciliation/);
  }
});
