import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { workshopPhaseOwners } from './sic-workshop-phase-continuity.mjs';

export const workshopPhaseCeilings = [20, 54, 50, 52, 58, 113, 129];
// Actual [commands, continued phase walks] in the chronological collector
// de683d72 / GitHub 2d0a2542, 2026-11-27; no phase walk is inferred at L7.
export const workshopPhaseContinuity = [[15, 0], [45, 0], [41, 0], [43, 0], [48, 0], [94, 37], [107, 0]];
const moves = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
const point = value => Array.isArray(value) && value.length === 2 && Array.from(value).every(Number.isSafeInteger);
const snapshot = value => Array.isArray(value) && value.length === 3 && Array.from(value).every(point);
const digest = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

// Only confirmed, physically observed walks through a measured station cycle
// count here. Other framed roles and unitary information gathering stay separate.
export function measureWorkshopPhaseContinuity(run, issued, groups) {
  const offset = run.executedTickets.indexOf(issued[0]);
  const effects = new Map(issued.map((ticket, index) => [ticket, run.steps?.[offset + index]]));
  const series = [];
  for (const group of groups.values()) {
    if (!group.some(ticket => ticket.workshop)) continue;
    requireExecutedPrefix('LS20 workshop', group);
    assert.ok(group.every((ticket, index) => ticket.workshop && workshopPhaseOwners.has(ticket.outcome?.family)
      && ticket.actionIndex === index && ticket.planId === group[0].planId
      && ticket.decisionRevision === group[0].decisionRevision && ticket.outcome.family === group[0].outcome.family)
      && group.length <= 16, 'LS20 workshop lost its bounded prefix identity');
    assert.equal(group.at(-1).sealed, group.length, 'LS20 workshop must acquire each executed command once');
    const first = group[0].workshop, initial = continuityObservation(first.bindingRef);
    assert.ok(initial && first.beforeRef === first.bindingRef && group[0].planId === 'sic-plan:' + first.bindingRef,
      'LS20 workshop lost the initial bound observation');
    assert.ok(Array.isArray(first.cycle) && first.cycle.length >= 2 && first.cycle.length <= 12
      && Array.from(first.cycle).every(snapshot)
      && first.cycle.some(phase => JSON.stringify(phase) !== JSON.stringify(first.cycle[0])),
      'LS20 workshop lost its measured moving period');
    assert.ok(digest(first.roleFingerprint) && Array.isArray(first.roles) && first.roles.length === 3
      && new Set(first.roles).size === 3 && first.roles.every(role => ['shape', 'color', 'rotation'].includes(role)),
      'LS20 workshop lost the observed actor and station roles');
    assert.ok(Array.isArray(first.learnedEvidence) && first.learnedEvidence.length >= 2
      && new Set(first.learnedEvidence).size === first.learnedEvidence.length
      && first.learnedEvidence.every(ref => {
        const learned = continuityObservation(ref);
        return learned && learned.scope === initial.scope && learned.epoch === initial.epoch
          && learned.revision <= initial.revision;
      }), 'LS20 workshop needs already acquired phase evidence in the current session and epoch');
    for (const [index, ticket] of group.entries()) {
      const p = ticket.workshop, before = continuityObservation(p.beforeRef), after = continuityObservation(p.afterRef);
      const move = moves[ticket.action], effect = effects.get(ticket);
      assert.ok(move && p.actionRef === ticket.action && p.strategy === 'P07'
        && before && after && before.scope === initial.scope && after.scope === initial.scope
        && before.epoch === ticket.level && after.epoch === before.epoch && p.levelEpoch === ticket.level
        && p.scoreBefore === ticket.level - 1 && p.scoreAfter === p.scoreBefore && after.revision === before.revision + 1
        && ticket.outcome.observation_ref === p.afterRef && ticket.outcome.matched === true,
      'LS20 workshop lost the current confirmed physical return');
      assert.equal(p.bindingRef, first.bindingRef, 'LS20 workshop changed the bound plan');
      assert.equal(p.roleFingerprint, first.roleFingerprint, 'LS20 workshop changed its measured role geometry');
      assert.equal(p.pitch, first.pitch, 'LS20 workshop changed its observed lattice');
      assert.equal(p.reserveCost, first.reserveCost, 'LS20 workshop changed its observed movement debit');
      assert.deepEqual(p.roles, first.roles, 'LS20 workshop changed its station identities');
      assert.deepEqual(p.cycle, first.cycle, 'LS20 workshop replaced the phase law within a prefix');
      assert.deepEqual(p.learnedEvidence, first.learnedEvidence, 'LS20 workshop acquired a forecast before sealing');
      assert.ok(effect?.a === Number(ticket.action.slice(6)) && effect.family === ticket.outcome.family
        && effect.pixels > 0 && effect.from === before.frame && effect.to === after.frame,
      'LS20 workshop lost the actual pixel effect bound to its ticket');
      assert.ok(Number.isSafeInteger(p.pitch) && p.pitch > 0 && point(p.actorBefore) && point(p.actorAfter),
        'LS20 workshop actor is absent or ambiguous');
      assert.deepEqual(p.actorBefore, p.expectedFrom, 'LS20 workshop did not start at the observed actor');
      assert.deepEqual(p.actorAfter, p.expectedTo, 'LS20 workshop did not reach its declared landing');
      assert.deepEqual(p.actorAfter, p.actorBefore.map((value, axis) => value + move[axis] * p.pitch),
        'LS20 workshop is not one actual lattice step');
      const expectedBefore = first.cycle[index % first.cycle.length];
      assert.ok(Array.isArray(p.stationsBefore) && p.stationsBefore.length === 3,
        'LS20 workshop lost its observed starting station roles');
      const hidden = Array.from(p.stationsBefore).flatMap((position, role) => position === null ? [role] : []);
      // The carrier may completely cover one station when leaving a contact.
      // Preserve that missing measurement; only the subsequent, fully visible
      // returns count as continuous phase walking. Never fill it from the cycle.
      assert.ok(!hidden.length || index === 0 && hidden.length === 1
        && JSON.stringify(expectedBefore[hidden[0]]) === JSON.stringify(p.actorBefore),
      'LS20 workshop lost a station outside the initial actor occlusion');
      for (const [role, position] of Array.from(p.stationsBefore).entries()) {
        if (position !== null) assert.deepEqual(position, expectedBefore[role], 'LS20 workshop started from a different station phase');
      }
      assert.deepEqual(p.stationsAfter, first.cycle[(index + 1) % first.cycle.length], 'LS20 workshop returned a different station phase');
      assert.ok(digest(p.glyphBefore) && p.glyphAfter === p.glyphBefore
        && Number.isSafeInteger(p.reserveBefore) && p.reserveBefore >= 0 && Number.isSafeInteger(p.reserveAfter) && p.reserveAfter >= 0
        && Number.isSafeInteger(p.reserveCost) && p.reserveCost > 0
        && p.reserveBefore - p.reserveAfter === p.reserveCost,
      'LS20 workshop changed the displayed glyph or contradicted the measured reserve debit');
      if (index > 0) {
        const previous = group[index - 1].workshop;
        assert.equal(p.beforeRef, previous.afterRef, 'LS20 workshop lost the ordered return chain');
        assert.deepEqual(p.actorBefore, previous.actorAfter, 'LS20 workshop lost actor continuity');
        assert.deepEqual(p.stationsBefore, previous.stationsAfter, 'LS20 workshop lost station continuity');
        assert.equal(p.glyphBefore, previous.glyphAfter, 'LS20 workshop lost glyph continuity');
        assert.equal(p.reserveBefore, previous.reserveAfter, 'LS20 workshop lost reserve continuity');
      }
      if (index < group.length - 1) assert.equal(p.acquisition, null, 'LS20 workshop published before its native closure');
      else {
        const acquired = p.acquisition;
        assert.ok(acquired?.epoch === p.levelEpoch && Array.isArray(acquired.evidence)
          && acquired.evidence.every(ref => {
            const learned = continuityObservation(ref);
            return learned && learned.scope === after.scope && learned.epoch === after.epoch && learned.revision <= after.revision;
          }),
        'LS20 workshop lost its ordered acquired observations');
        const retainedRefs = group.slice(-8).map(returned => returned.workshop.afterRef);
        assert.deepEqual(acquired.evidence.slice(-retainedRefs.length), retainedRefs,
          'LS20 workshop did not acquire its physical returns in native order');
        assert.deepEqual(acquired.at, p.actorAfter, 'LS20 workshop acquired a different actor position');
        const shift = group.length % first.cycle.length;
        assert.deepEqual(acquired.cycle, [...first.cycle.slice(shift), ...first.cycle.slice(0, shift)],
          'LS20 workshop did not acquire the successive observed phases in order');
      }
    }
    if (group.length > 1) {
      const start = issued.indexOf(group[0]);
      series.push({ kind: 'observed workshop phase walking', first: start, last: start + group.length - 1,
        continued: group.length - 1, period: first.cycle.length });
    }
  }
  return series;
}
