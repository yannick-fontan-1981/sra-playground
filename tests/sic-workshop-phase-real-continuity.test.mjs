import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { measureWorkshopPhaseContinuity, workshopPhaseContinuity } from '../scripts/sic-workshop-phase-continuity-contract.mjs';

const recorded = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-workshop-phase-continuity-public.json.gz', import.meta.url))));
const fixture = () => structuredClone(recorded);
function measureLevel(run, level) {
  const issued = run.executedTickets.filter(ticket => ticket.level === level), groups = new Map();
  for (const ticket of issued) {
    if (!groups.has(ticket.decisionRevision)) groups.set(ticket.decisionRevision, []);
    groups.get(ticket.decisionRevision).push(ticket);
  }
  return measureWorkshopPhaseContinuity(run, issued, groups);
}
const measured = run => run.executedTickets.filter(ticket => ticket.workshop);
const occludedStart = run => measured(run).find(ticket => ticket.workshop.stationsBefore.some(position => position === null));

test('the seven-level collector contains 393 actual returns and eleven fully observed phase continuations at level six', () => {
  const run = fixture();
  assert.equal(run.solver, 'sic');
  assert.equal(run.start, 1);
  assert.equal(run.executedTickets.length, 393);
  assert.equal(run.steps.length, 393);
  assert.deepEqual(run.levels.map(row => [row.actions, row.won]), workshopPhaseContinuity.map(([commands]) => [commands, true]));
  assert.deepEqual(run.levels.map(row => [row.actions, measureLevel(run, row.level).reduce((sum, series) => sum + series.continued, 0)]),
    workshopPhaseContinuity);
  const phase = measureLevel(run, 6);
  assert.deepEqual(phase.map(series => series.last - series.first + 1), [5, 7, 2, 3, 2, 2, 7, 3, 5, 7, 5]);
  assert.ok(phase.every(series => series.period === 8));
  assert.equal(measured(run).length, 48);
});

test('three initial stations remain unmeasured under the actor and all counted continuations use visible positions', () => {
  const run = fixture(), hidden = measured(run).filter(ticket => ticket.workshop.stationsBefore.some(position => position === null));
  assert.equal(hidden.length, 3);
  for (const ticket of hidden) {
    const p = ticket.workshop, role = p.stationsBefore.findIndex(position => position === null);
    assert.equal(ticket.actionIndex, 0);
    assert.deepEqual(p.cycle[0][role], p.actorBefore);
    assert.ok(p.stationsAfter.every(Array.isArray));
  }
  assert.ok(measured(run).filter(ticket => ticket.actionIndex > 0).every(ticket =>
    ticket.workshop.stationsBefore.every(Array.isArray) && ticket.workshop.stationsAfter.every(Array.isArray)));
  assert.equal(measureLevel(run, 6).reduce((sum, series) => sum + series.continued, 0), 37);
  assert.equal(occludedStart(run).workshop.stationsBefore.filter(position => position === null).length, 1,
    'The contract does not replace a missing station with a forecast');
});

const counterexamples = {
  'another missing initial role beside the covered station': run => {
    const p = occludedStart(run).workshop;
    p.stationsBefore[p.stationsBefore.findIndex(position => position !== null)] = null;
  },
  'a null station outside the actual actor cell': run => {
    const ticket = measured(run).find(ticket => ticket.actionIndex === 0 && ticket.workshop.stationsBefore.every(Array.isArray));
    ticket.workshop.stationsBefore[0] = null;
  },
  'a covered station that stays absent after departure': run => {
    const p = occludedStart(run).workshop;
    p.stationsAfter[p.stationsBefore.findIndex(position => position === null)] = null;
  },
  'a station disappearing during a continuing move': run => {
    measured(run).find(ticket => ticket.actionIndex === 1).workshop.stationsBefore[0] = null;
  },
  'the old phase repeated on the second physical return': run => {
    const ticket = measured(run).find(ticket => ticket.actionIndex === 1);
    ticket.workshop.stationsAfter = structuredClone(ticket.workshop.cycle[1]);
  },
  'reversing the real acquired prefix references': run => {
    measured(run).find(ticket => ticket.workshop.acquisition).workshop.acquisition.evidence.reverse();
  },
};
for (const [name, change] of Object.entries(counterexamples)) test('the recorded phase contract rejects ' + name, () => {
  const run = fixture(); change(run);
  assert.throws(() => measureLevel(run, 6));
});
