import assert from 'node:assert/strict';
import test from 'node:test';
import { captureWorkshopPhase, observeWorkshopPhaseReturn, completeWorkshopPhase } from '../scripts/sic-workshop-phase-continuity.mjs';
import { workshopPhaseEvidence } from './helpers/sic-workshop-phase-evidence.mjs';

test('the passive workshop capture retains earlier proof and reads the complete public phase', () => {
  const f = workshopPhaseEvidence(), before = captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0));
  assert.deepEqual(before.actorBefore, [2, 20]);
  assert.deepEqual(before.stationsBefore, [[2, 2], [4, 6], [6, 10]]);
  assert.equal(before.reserveBefore, 24);
  f.proposal.glyphWorkshop.local.refs.push('not-yet-acquired');
  f.proposal.glyphWorkshop.local.cycle[0][0][0] = 99;
  assert.equal(before.learnedEvidence.length, 2);
  assert.equal(before.cycle[0][0][0], 2);
  const after = observeWorkshopPhaseReturn(before, f.frame(1));
  assert.deepEqual(after.actorAfter, [4, 20]);
  assert.deepEqual(after.stationsAfter, [[4, 2], [6, 6], [8, 10]]);
  assert.equal(after.reserveAfter, 23);
  assert.equal(after.glyphAfter, after.glyphBefore);
  assert.equal(Object.hasOwn(after, 'geometry'), false);
});

test('an open prefix never samples or claims acquired workshop state', () => {
  const f = workshopPhaseEvidence();
  const observed = observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)), f.frame(1));
  let reads = 0;
  const result = completeWorkshopPhase(observed, () => { reads++; return f.acquired; }, f.returned(0), 5);
  assert.equal(reads, 0);
  assert.equal(result.acquisition, null);
  assert.equal(result.afterRef, f.returned(0).outcome.observation_ref);
});

for (const change of [{ missingActor: true }, { duplicateActor: true }]) test('workshop evidence exposes an unreadable actor: ' + JSON.stringify(change), () => {
  const f = workshopPhaseEvidence();
  const result = observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)), f.frame(1, change));
  assert.equal(result.actorAfter, null);
  assert.deepEqual(result.expectedTo, [4, 20], 'The forecast remains distinct from the absent measurement');
});

for (const change of [{ missingStation: 1 }, { duplicateStation: 1 }]) test('workshop evidence exposes an unreadable station: ' + JSON.stringify(change), () => {
  const f = workshopPhaseEvidence();
  const result = observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)), f.frame(1, change));
  assert.equal(result.stationsAfter[1], null);
});

test('the observer preserves actual phase, glyph and reserve contradictions', () => {
  const f = workshopPhaseEvidence();
  const result = observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)),
    f.frame(1, { phase: 2, glyph: true, extraDebit: 1 }));
  assert.deepEqual(result.stationsAfter, [[6, 2], [8, 6], [2, 10]]);
  assert.notDeepEqual(result.stationsAfter, result.cycle[1]);
  assert.notEqual(result.glyphAfter, result.glyphBefore);
  assert.equal(result.reserveAfter, 22);
});

test('native closure samples and detaches the real acquired phase once', () => {
  const f = workshopPhaseEvidence();
  const result = completeWorkshopPhase(observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(2), f.frame(2)), f.frame(3)),
    () => f.acquired, f.returned(2), 5);
  assert.deepEqual(result.acquisition.at, [8, 20]);
  assert.deepEqual(result.acquisition.cycle[0], [[8, 2], [2, 6], [4, 10]]);
  f.acquired.glyphWorkshop.at[0] = 99;
  f.acquired.glyphWorkshop.cycle[0][0][0] = 99;
  f.acquired.glyphWorkshop.refs.push('later');
  assert.equal(result.acquisition.at[0], 8);
  assert.equal(result.acquisition.cycle[0][0][0], 8);
  assert.equal(result.acquisition.evidence.length, 5);
});

test('missing frames or acquisition remain missing rather than predicted', () => {
  const f = workshopPhaseEvidence();
  const observed = observeWorkshopPhaseReturn(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)), null);
  assert.equal(observed.actorAfter, null);
  assert.equal(observed.stationsAfter, null);
  assert.equal(observed.glyphAfter, null);
  assert.equal(observed.reserveAfter, null);
  const result = completeWorkshopPhase(observed, () => { throw Error('unavailable'); }, f.returned(2), 6);
  assert.equal(result.acquisition, null);
});

test('unknown periods, unitary probes and malformed geometry do not produce workshop phase evidence', () => {
  for (const mutate of [p => { delete p.glyphWorkshop.local.cycle; }, p => { p.actions = p.actions.slice(0, 1); },
    p => { p.glyphWorkshop.local.layout.positions.push(p.glyphWorkshop.local.layout.positions[0]); },
    p => { delete p.glyphWorkshop.local.cycle[1]; }, p => { p.glyphWorkshop.local.layout.stations[0].image = ',,,'; }]) {
    const f = workshopPhaseEvidence(); mutate(f.proposal);
    assert.equal(captureWorkshopPhase(f.proposal, f.ticket(0), f.frame(0)), null);
  }
});
