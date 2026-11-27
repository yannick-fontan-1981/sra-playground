import assert from 'node:assert/strict';
import { continuityObservation, requireExecutedPrefix } from './sic-continuity-contract.mjs';
import { passengerArrangementMeasured, passengerOwners } from './sic-passenger-continuity.mjs';

export const passengerCeilings = [20, 21, 19, 23, 74, 48];
// Actual [commands, continued commands, loaded continuations, approach continuations].
// The guarded passenger role is present in the last two observed rooms.
export const passengerContinuity = [[15, 3, 0, 0], [16, 0, 0, 0], [15, 0, 0, 0], [18, 0, 0, 0],
  [61, 29, 22, 7], [42, 13, 12, 1]];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

export function measurePassengerContinuity(run, issued, groups) {
  const series = [];
  for (const group of groups.values()) {
    if (!group.some(ticket => ticket.passenger)) continue;
    requireExecutedPrefix('Passenger transport', group);
    assert.ok(group.length <= 16 && group.every((ticket, index) => ticket.passenger
      && passengerOwners.has(ticket.outcome?.family) && ticket.actionIndex === index
      && ticket.planId === group[0].planId && ticket.decisionRevision === group[0].decisionRevision
      && ticket.outcome.family === group[0].outcome.family), 'Passenger prefix lost its identity or bound');
    assert.equal(group.at(-1).sealed, group.length, 'Passenger prefix did not reconcile all executed commands once');
    const initial = group[0].passenger, scope = continuityObservation(initial.bindingRef);
    assert.ok(scope && initial.beforeRef === initial.bindingRef && group[0].planId === 'sic-plan:' + initial.bindingRef,
      'Passenger prefix lost its initial public observation');
    assert.ok(Array.isArray(initial.learnedEvidence) && initial.learnedEvidence.length > 0
      && initial.learnedEvidence.every(ref => {
        const learned = continuityObservation(ref);
        return learned && learned.scope === scope.scope && learned.epoch <= scope.epoch && learned.revision <= scope.revision;
      }), 'Passenger movement has no acquired evidence in the current session');
    if (group.length > 1) assert.ok(group.every(ticket => ticket.passenger.role === 'move'),
      'Passenger prefix crossed an unmeasured pickup, release or crossing');
    let continued = 0;
    for (const [index, ticket] of group.entries()) {
      const p = ticket.passenger, before = continuityObservation(p.beforeRef), after = continuityObservation(p.afterRef);
      const effect = run.steps?.[run.executedTickets.indexOf(ticket)];
      assert.ok(before && after && before.scope === scope.scope && after.scope === scope.scope
        && before.epoch === ticket.level && p.levelEpoch === ticket.level && p.scoreBefore === ticket.level - 1
        && p.actionRef === ticket.action && after.revision === before.revision + 1
        && p.afterRef === ticket.outcome.observation_ref
        && (p.boundary ? p.scoreAfter === p.scoreBefore + 1 : p.scoreAfter === p.scoreBefore && after.epoch === before.epoch)
        && effect?.a === Number(ticket.action.slice(6)) && effect.family === ticket.outcome.family
        && effect.from === before.frame && effect.to === after.frame,
      'Passenger measurement does not belong to its actual command and return');
      assert.equal(p.bindingRef, initial.bindingRef, 'Passenger prefix changed its binding');
      assert.equal(p.roleFingerprint, initial.roleFingerprint, 'Passenger prefix changed the acquired object identities');
      assert.deepEqual(p.learnedEvidence, initial.learnedEvidence, 'Passenger prefix published evidence before closure');
      if (index > 0) {
        const previous = group[index - 1].passenger;
        assert.equal(p.beforeRef, previous.afterRef, 'Passenger prefix skipped an actual return');
        assert.deepEqual(p.before, previous.after, 'Passenger prefix did not remeasure the preceding physical arrangement');
      }
      if (p.role === 'move') {
        assert.ok(passengerArrangementMeasured(p.before, p.expectedFrom, p.cargo),
          'Passenger movement began without an unambiguous physical arrangement');
        assert.ok(point(p.motion) && p.motion.some(value => value !== 0)
          && same(p.expectedTo.actor, p.expectedFrom.actor.map((value, axis) => value + p.motion[axis]))
          && p.expectedFrom.bank === p.expectedTo.bank && p.expectedFrom.held === p.expectedTo.held
          && same(p.expectedFrom.banks, p.expectedTo.banks),
        'Passenger move is not one previously acquired ordinary translation');
        if (ticket.outcome.matched === true && !p.boundary) {
          assert.ok(passengerArrangementMeasured(p.after, p.expectedTo, p.cargo),
            'Passenger movement has no matching public return');
          if (p.expectedFrom.held !== null) {
            const learned = continuityObservation(p.carriedEvidence?.ref);
            assert.ok(learned && learned.scope === scope.scope && learned.epoch === scope.epoch
              && learned.revision <= scope.revision && p.carriedEvidence.held === p.expectedFrom.held
              && initial.learnedEvidence.includes(p.carriedEvidence.ref), 'Passenger footprint has no acquired pickup offset');
            const moved = p.before.carried.footprint.map((value, axis) => value + p.motion[axis % 2]);
            assert.deepEqual(p.after.carried.footprint, moved, 'Passenger pixels were not measured in the translated footprint');
          }
          if (index > 0) continued++;
        } else assert.equal(index, group.length - 1, 'Passenger prefix continued after a contradicted physical return');
      }
      if (index < group.length - 1) assert.equal(p.acquisition, null, 'Passenger facts were published before closure');
      else if (!p.boundary) {
        const acquired = p.acquisition;
        assert.ok(acquired && acquired.epoch === ticket.level && acquired.frame === after.frame,
          'Passenger final acquisition has the wrong public scope');
        if (ticket.outcome.matched === true) {
          assert.deepEqual(acquired.at, p.expectedTo, 'Passenger final acquisition differs from its confirmed return');
          const tail = group.slice(-6).map(item => item.passenger.afterRef);
          assert.deepEqual(acquired.evidence.slice(-tail.length), tail, 'Passenger returns were not acquired in order');
        }
      }
    }
    if (continued > 0) series.push({ kind: initial.expectedFrom.held === null ? 'passenger approach' : 'loaded passenger walk',
      first: issued.indexOf(group[0]), last: issued.indexOf(group.at(-1)), continued });
  }
  return series;
}

export function requirePassengerContinuity(run, issued, groups) {
  const index = issued[0]?.level - 1, reference = passengerContinuity[index];
  assert.ok(reference && issued.length <= passengerCeilings[index]
    && issued.every(ticket => ticket.resets === 0), 'Passenger campaign exceeded its action ceiling or reset');
  const [actions, minimumContinued, minimumLoaded, minimumApproach] = reference;
  assert.ok(issued.length - groups.size >= Math.min(issued.length - 1, Math.ceil(minimumContinued * issued.length / actions)),
    'Passenger campaign lost its executed native continuation');
  const physical = measurePassengerContinuity(run, issued, groups);
  for (const [kind, minimum] of [['loaded passenger walk', minimumLoaded], ['passenger approach', minimumApproach]]) {
    assert.ok(physical.filter(effect => effect.kind === kind).reduce((sum, effect) => sum + effect.continued, 0)
      >= Math.min(issued.length - 1, Math.ceil(minimum * issued.length / actions)),
    'Passenger campaign lost its measured ' + kind);
  }
  return physical;
}
