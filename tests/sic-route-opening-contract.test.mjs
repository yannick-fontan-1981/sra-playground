import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { checkRun } from '../scripts/verify-sic-continuity.mjs';

const witness = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-route-opening-continuity-public.json.gz', import.meta.url))));
const sample = () => structuredClone(witness.run);
const preparation = run => run.executedTickets.find(ticket => ticket.opening?.prepared && ticket.actionIndex === 0);
const contact = run => run.executedTickets.find(ticket => ticket.opening?.prepared && ticket.action === 'ACTION5');

test('the actual opening campaign keeps six scores, 118 commands and its four- and six-command preparations', () => {
  const report = checkRun(sample());
  assert.deepEqual(report.map(row => row.commands), [16, 17, 21, 22, 17, 25]);
  assert.deepEqual(report.map(row => row.continued), [1, 0, 3, 0, 0, 5]);
  assert.deepEqual(report.map(row => row.longest), [2, 1, 4, 1, 1, 6]);
  assert.equal(report.filter(row => row.physical.includes('cursor preparation then observed opening')).length, 2);
});

test('successful commands split into separate decisions lose the observed opening continuity', () => {
  const run = sample();
  for (const [index, ticket] of run.executedTickets.entries()) {
    ticket.decisionRevision = 1000 + index; ticket.actionIndex = 0;
    ticket.sealed = 1; ticket.sealCount = 1; ticket.planId = 'isolated-' + index;
    Object.assign(ticket.outcome, { sic_plan: ticket.planId, index: 0, seal_prefix: true });
  }
  assert.throws(() => checkRun(run), /ESCT lost its move series/);
});

test('an unrelated walking series cannot substitute for a known opening preparation', () => {
  const run = sample(), first = preparation(run);
  for (const ticket of run.executedTickets) if (ticket.decisionRevision === first.decisionRevision)
    ticket.opening.prepared = false;
  assert.throws(() => checkRun(run), /lost cursor preparation followed by its observed opening/);
});

test('the opening requires both its own cursor motion and the same waiting carrier', () => {
  for (const corrupt of [
    p => { p.after.actor = [...p.before.actor]; }, p => { p.after.carrier = [9, 9]; },
    p => { p.before.actorCount = 2; }, p => { p.role.routeVerified = false; },
  ]) {
    const run = sample(); corrupt(preparation(run).opening);
    assert.throws(() => checkRun(run), /measured cursor preparation|learned role, measured grid or bound return/);
  }
});

test('the final contact must remove the measured wall and acquire the entire real prefix', () => {
  for (const corrupt of [
    p => { p.after.wall = null; }, p => { p.after.wall = true; },
    p => { p.acquisition = null; }, p => { p.acquisition.count--; },
    p => { p.acquisition.evidence.pop(); }, p => { p.acquisition.roleEvidence = []; },
  ]) {
    const run = sample(); corrupt(contact(run).opening);
    assert.throws(() => checkRun(run), /remove the measured target wall|final reconciliation/);
  }
});

test('opening evidence cannot migrate between sessions, frames or acquisition times', () => {
  for (const corrupt of [
    p => { p.role.evidence[0] = p.afterRef; },
    p => { p.retainedEvidence[0] = p.retainedEvidence[0].replace(/^.*?:epoch:/, 'foreign:epoch:'); },
    p => { p.before.frame = 'unrelated'; }, p => { p.afterRef = p.beforeRef; },
  ]) {
    const run = sample(); corrupt(preparation(run).opening);
    assert.throws(() => checkRun(run), /learned role, measured grid or bound return/);
  }
});

test('a real opening series still requires exact return identity and one complete final seal', () => {
  for (const corrupt of [
    run => { preparation(run).outcome.matched = false; },
    run => { preparation(run).outcomeCount = 2; },
    run => { preparation(run).outcome.sic_plan = 'other'; },
    run => { preparation(run).outcome.seal_prefix = true; },
    run => { contact(run).sealCount = 2; },
    run => { contact(run).sealed--; },
  ]) {
    const run = sample(); corrupt(run);
    assert.throws(() => checkRun(run), /confirmed return|actual return|exactly one|owner closed|Missing final reconciliation/);
  }
});

test('opening qualification preserves level-one entry, zero resets and the original ceilings', () => {
  const direct = sample(); direct.start = 2;
  assert.throws(() => checkRun(direct), /start at level one/);
  const reset = sample(); reset.executedTickets[9].resets = 1;
  assert.throws(() => checkRun(reset), /action ceiling or reset/);
  const excess = sample(), last = excess.executedTickets.at(-1);
  for (let index = 0; index < 6; index++) {
    const extra = structuredClone(last);
    extra.decisionRevision = 1000 + index; extra.actionIndex = 0; extra.sealed = 1; extra.sealCount = 1;
    extra.planId = 'extra-' + index; extra.outcome.sic_plan = extra.planId; extra.outcome.index = 0;
    excess.executedTickets.push(extra);
  }
  excess.levels.at(-1).actions += 6; excess.issued += 6; excess.sic += 6;
  assert.throws(() => checkRun(excess), /action ceiling or reset/);
});
