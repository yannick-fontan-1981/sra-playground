import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { measurePassageContinuity, passageContinuity } from '../scripts/sic-passage-continuity-contract.mjs';

const original = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-passage-continuity-public.json.gz', import.meta.url))));
const copy = () => structuredClone(original);
function groups(issued) {
  const result = new Map();
  for (const ticket of issued) {
    const group = result.get(ticket.decisionRevision) ?? [];
    group.push(ticket); result.set(ticket.decisionRevision, group);
  }
  return result;
}
function measure(run) {
  return run.levels.map(level => {
    const issued = run.executedTickets.filter(ticket => ticket.level === level.level);
    const physical = measurePassageContinuity(run, issued, groups(issued));
    return [level.actions, physical.reduce((sum, series) => sum + series.continued, 0),
      physical.filter(series => series.neutral).reduce((sum, series) => sum + series.continued, 0)];
  });
}
const series = (run, boundary = false) => [...groups(run.executedTickets).values()].find(group => group.length > 1
  && (group.at(-1).outcome.reason === 'official_boundary') === boundary);
const reject = (change, pattern) => { const run = copy(); change(run, series(run)); assert.throws(() => measure(run), pattern); };

test('real chronological PORT returns retain all six levels of known walking', () => {
  assert.equal(original.start, 1);
  assert.equal(original.initialCompleted, 0);
  assert.equal(original.resets, 0);
  assert.equal(original.issued, 116);
  assert.ok(original.levels.every(level => level.won));
  assert.deepEqual(measure(copy()), passageContinuity);
});

test('the same winning public commands split into unitary decisions supply no continuity witness', () => {
  const run = copy();
  for (const [index, ticket] of run.executedTickets.entries()) if (ticket.passage) {
    ticket.decisionRevision = index + 1000; ticket.actionIndex = 0;
    ticket.planId = 'sic-plan:' + ticket.passage.beforeRef;
    ticket.outcome.sic_plan = ticket.planId; ticket.outcome.index = 0; ticket.outcome.seal_prefix = true;
    ticket.sealCount = 1; ticket.sealed = 1;
  }
  assert.deepEqual(measure(run), passageContinuity.map(([actions]) => [actions, 0, 0]));
});

test('foreign or future learned passage evidence cannot justify the measured walk', () => {
  reject((_, group) => { group[0].passage.learnedEvidence = ['other:epoch:1:revision:1:frame:abc']; }, /current session/);
  reject((_, group) => { group[0].passage.learnedEvidence = [group[0].passage.afterRef]; }, /current session/);
  reject((_, group) => { group[0].passage.learnedEvidence = []; }, /current session/);
});

test('a walking series cannot contain a switch or crossing contact', () => {
  reject((_, group) => { group[1].passage.role = 'crossing'; }, /inside a walking series/);
  reject((_, group) => { group[1].passage.role = 'switch'; }, /inside a walking series/);
});

test('the actual contact after the walking approach must still be executed and confirmed', () => {
  reject((run, group) => { run.executedTickets[run.executedTickets.indexOf(group.at(-1)) + 1].outcome.matched = false; }, /separate actual passage contact/);
  reject((run, group) => { run.executedTickets[run.executedTickets.indexOf(group.at(-1)) + 1].passage.beforeRef = group[0].passage.beforeRef; }, /separate actual passage contact/);
});

test('the separate passage contact remains in the actual epoch and preserves the public score', () => {
  reject((run, group) => {
    const contact = run.executedTickets[run.executedTickets.indexOf(group.at(-1)) + 1];
    contact.passage.afterRef = contact.passage.afterRef.replace(/:epoch:\d+:/, ':epoch:99:');
    contact.outcome.observation_ref = contact.passage.afterRef;
  }, /separate actual passage contact/);
  reject((run, group) => { run.executedTickets[run.executedTickets.indexOf(group.at(-1)) + 1].passage.scoreAfter += 1; }, /separate actual passage contact/);
  reject((run, group) => { run.executedTickets[run.executedTickets.indexOf(group.at(-1)) + 1].passage.levelEpoch += 1; }, /separate actual passage contact/);
});

test('passage returns remain bound to the executed plan and action index', () => {
  reject((_, group) => { group[1].outcome.sic_plan += ':foreign'; }, /ticket identity/);
  reject((_, group) => { group[1].outcome.index += 1; }, /ticket identity/);
  reject((_, group) => { group[1].outcomeCount = 2; }, /exactly one actual return/);
});

test('a contradiction or an early closure prevents credit for later walking', () => {
  reject((_, group) => { group[0].outcome.matched = false; }, /without a confirmed return/);
  reject((_, group) => { group[0].outcome.seal_prefix = true; }, /closed the prefix/);
  reject((_, group) => { group[0].sealCount = 1; }, /before its series ended/);
});

test('walking acquisitions occur once and retain the final actual return', () => {
  reject((_, group) => { group.at(-1).sealCount = 2; }, /exactly one final reconciliation/);
  reject((_, group) => { group.at(-1).sealed -= 1; }, /lost executed commands/);
  reject((_, group) => { group.at(-1).passage.acquisition.evidence = []; }, /not reacquired/);
});

test('a predicted landing cannot substitute for an absent or stationary public actor', () => {
  reject((_, group) => { group[0].passage.actorAfter = null; }, /changed its actor/);
  reject((_, group) => { group[0].passage.actorAfter = group[0].passage.actorBefore; }, /changed its actor/);
});

test('changes of passage partners or indicators remain visible during walking', () => {
  reject((_, group) => { group[0].passage.contextAfter = '0'.repeat(64); }, /partners or contact context/);
});

test('walking is bound to changed public pixels and the exact observation hashes', () => {
  reject((run, group) => { run.steps[run.executedTickets.indexOf(group[0])].pixels = 0; }, /physical effect/);
  reject((run, group) => { run.steps[run.executedTickets.indexOf(group[0])].to = 'other'; }, /physical effect/);
});

test('the official score uses its retained success witness without inventing a final visible actor', () => {
  const run = copy(), scored = series(run, true).at(-1);
  assert.equal(scored.passage.actorAfter, null);
  assert.equal(scored.passage.contextAfter, null);
  assert.deepEqual(measure(run), passageContinuity);
  scored.passage.acquisition.successRef = 'foreign';
  assert.throws(() => measure(run), /exact retained passage witness/);
});

test('ordinary walking cannot compensate for loss of neutral-passage continuity', () => {
  const run = copy();
  for (const ticket of run.executedTickets) if (ticket.passage) ticket.passage.neutral = false;
  assert.deepEqual(measure(run), passageContinuity.map(([actions, continued]) => [actions, continued, 0]));
  reject((_, group) => { group[1].passage.neutral = !group[0].passage.neutral; }, /known role/);
});
