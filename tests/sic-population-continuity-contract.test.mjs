import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const witness = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-population-continuity-public.json.gz', import.meta.url))));
const sample = () => structuredClone(witness.run);
const selection = run => run.executedTickets.find((ticket, index, tickets) => ticket.action === 'ACTION6'
  && ticket.actionIndex === 0 && ticket.population && tickets[index + 1]?.decisionRevision === ticket.decisionRevision);
const movement = run => run.executedTickets[run.executedTickets.indexOf(selection(run)) + 1];
const response = run => run.executedTickets.find(ticket => ticket.population?.changedNeighbors?.length > 0);

test('the actual population campaign preserves 196 commands and 29 selections followed by 116 movements', () => {
  const rows = checkRun(sample());
  assert.deepEqual(rows.map(row => row.commands), [14, 18, 34, 23, 36, 71]);
  assert.deepEqual(rows.map(row => row.continued), [5, 6, 22, 16, 26, 55]);
  assert.deepEqual(rows.map(row => row.preparedSelections), [0, 0, 6, 4, 6, 13]);
  assert.deepEqual(rows.map(row => row.movementsAfterSelection), [0, 0, 21, 15, 26, 54]);
  assert.equal(rows.reduce((sum, row) => sum + row.neighborEffects, 0), 25);
  assert.equal(rows[5].unknownSupportTickets, 71);
});

test('a separate decision for every successful command loses population continuity', () => {
  const run = sample();
  for (const [index, ticket] of run.executedTickets.entries()) {
    ticket.decisionRevision = 1000 + index; ticket.actionIndex = 0;
    ticket.sealed = 1; ticket.sealCount = 1; ticket.planId = 'isolated-' + index;
    Object.assign(ticket.outcome, { sic_plan: ticket.planId, index: 0, seal_prefix: true });
  }
  assert.throws(() => checkRun(run), /VOIS lost its move series/);
});

test('the actual selection must be unique and correspond to the executed click', () => {
  for (const corrupt of [
    p => { p.after.markerCount = 2; }, p => { p.after.selected = [99, 99]; },
    p => { p.point = { x: 0, y: 0 }; },
  ]) {
    const run = sample(); corrupt(selection(run).population);
    assert.throws(() => checkRun(run), /unique physical selection|selection mark/);
  }
});

test('a forecast or an unselected body cannot substitute for the measured movement', () => {
  for (const corrupt of [
    p => { p.movement = null; }, p => { p.movement.to = [...p.movement.from]; },
    p => { p.before.selected = [99, 99]; }, p => { p.knownDelta = [9, 9]; },
  ]) {
    const run = sample(); corrupt(movement(run).population);
    assert.throws(() => checkRun(run), /actual selected position/);
  }
});

test('the stationary neighbor response must be acquired from its exact sealed return', () => {
  const run = sample(); response(run).population.acquisition.neighborEffectRef = 'unrelated';
  assert.throws(() => checkRun(run), /actual return/);
});

test('the last level must retain the measured dependency when it admits an unmeasured support', () => {
  const run = sample();
  for (const ticket of run.executedTickets) if (ticket.level === 6 && ticket.population) ticket.population.support = null;
  assert.throws(() => checkRun(run), /reuse of the observed neighbor response/);
});

test('unrelated mixed commands cannot replace the calibrated physical selection and movement', () => {
  const run = sample(), first = selection(run);
  for (const [index, ticket] of run.executedTickets.entries()) if (ticket.decisionRevision === first.decisionRevision) {
    delete ticket.population;
    ticket.outcome.family = 'sic_unrelated_public_trial'; run.steps[index].family = ticket.outcome.family;
  }
  assert.throws(() => checkRun(run), /measured selection followed by learned movements/);
});

test('population continuation keeps exact return identities and one final acquisition', () => {
  for (const corrupt of [
    run => { selection(run).outcomeCount = 2; },
    run => { selection(run).outcome.sic_plan = 'another-plan'; },
    run => { selection(run).outcome.matched = false; },
    run => { selection(run).outcome.seal_prefix = true; },
    run => { response(run).sealCount = 2; },
  ]) {
    const run = sample(); corrupt(run);
    assert.throws(() => checkRun(run), /actual return|exactly one|confirmed return|owner closed/);
  }
});

test('population qualification preserves the chronological entry, worker, zero resets and all action ceilings', () => {
  const direct = sample(); direct.start = 2;
  assert.throws(() => checkRun(direct), /start at level one/);
  const parallel = sample(); parallel.parallelWorkers = 2;
  assert.throws(() => checkRun(parallel), /one native worker/);
  const reset = sample(); reset.executedTickets[9].resets = 1;
  assert.throws(() => checkRun(reset), /action ceiling or reset/);
  const excess = sample(), last = excess.executedTickets.at(-1);
  for (let index = 0; index < 10; index++) {
    const extra = structuredClone(last);
    extra.decisionRevision = 1000 + index; extra.actionIndex = 0; extra.sealed = 1; extra.sealCount = 1;
    extra.planId = 'extra-' + index; extra.outcome.sic_plan = extra.planId; extra.outcome.index = 0;
    excess.executedTickets.push(extra);
  }
  excess.levels.at(-1).actions += 10; excess.issued += 10; excess.sic += 10;
  assert.throws(() => checkRun(excess), /action ceiling or reset/);
});
