import test from 'node:test';
import assert from 'node:assert/strict';
import { requireManipulation } from '../scripts/measure-ss01-manipulation.mjs';
import { checkRun, measureOrientedDelivery } from '../scripts/verify-sic-continuity.mjs';

function sample(series) {
  const executedTickets = series.flatMap((length, decisionRevision) =>
    Array.from({ length }, (_, actionIndex) => ({
      level: 1,
      decisionRevision,
      actionIndex,
      action: 'ACTION6',
      sealed: actionIndex === length - 1 ? length : null,
    })),
  );
  return {
    code: 'HANO',
    solver: 'sic',
    executedTickets,
    levels: [{ level: 1, won: true, actions: executedTickets.length }],
    issued: executedTickets.length,
    sic: executedTickets.length,
  };
}
test('a win with identical commands but a new decision at every step fails the continuity gate', () => {
  assert.doesNotThrow(() => checkRun(sample([2, 2, 2])));
  assert.throws(() => checkRun(sample([1, 1, 1, 1, 1, 1])), /lost its click series/);
});
test('refuses early or incomplete reconciliation, a skipped ticket and an oversized series', () => {
  const early = sample([2]);
  early.executedTickets[0].sealed = 1;
  assert.throws(() => checkRun(early), /Reconciliation before end/);
  const partial = sample([3]);
  partial.executedTickets[2].sealed = 2;
  assert.throws(() => checkRun(partial), /Missing final reconciliation/);
  const gap = sample([3]);
  gap.executedTickets[1].actionIndex = 2;
  assert.throws(() => checkRun(gap), /Unexpected step/);
  assert.throws(() => checkRun(sample([17])), /More than 16/);
});

test('walking continuity alone cannot satisfy an object or launch-positioning requirement', () => {
  for (const missing of ['crate', 'mirror', 'position']) {
    const retained = ['crate', 'mirror', 'position'].filter(k => k !== missing).map(kind => ({ kind, first: 1, last: 2 }));
    assert.throws(() => requireManipulation(retained, [missing], 8), /lost consecutive/);
  }
});

function orientedRun() {
  const levels = Array.from({ length: 9 }, (_, index) => ({ level: index + 1, won: true, actions: index === 3 ? 1 : 2 }));
  const executedTickets = levels.flatMap(({ level, actions }) => {
    const decisionRevision = level * 10;
    const planId = 'sic-plan:oriented-fixture:epoch:' + level + ':revision:' + decisionRevision + ':frame:abc0';
    return Array.from({ length: actions }, (_, actionIndex) => {
      const final = actionIndex === actions - 1;
      const observation_ref = 'oriented-fixture:epoch:' + level + ':revision:' + (decisionRevision + actionIndex + 1) + ':frame:abc1';
      return { level, decisionRevision, actionIndex, action: 'ACTION4', resets: 0,
        sealed: final ? actions : null, sealCount: final ? 1 : 0, planId, outcomeCount: 1,
        outcome: { matched: true, family: 'sic_verify_oriented_delivery', sic_plan: planId, index: actionIndex,
          observation_ref, seal_prefix: final },
        oriented: { poseBefore: [actionIndex, 2], poseAfter: [actionIndex + 1, 2],
          cargoBefore: [actionIndex + 1, 2], cargoAfter: [actionIndex + 2, 2] } };
    });
  });
  return { code: 'WA30', solver: 'sic', start: 1, initialCompleted: 0, levels, executedTickets,
    sic: executedTickets.length, issued: executedTickets.length };
}

test('oriented transport permits genuine unitary waits but requires one chronological session and one seal', () => {
  assert.doesNotThrow(() => checkRun(orientedRun()));
  const repeatedSeal = orientedRun();
  repeatedSeal.executedTickets.find(ticket => ticket.level === 4).sealCount = 2;
  assert.throws(() => checkRun(repeatedSeal), /exactly one final reconciliation/);
  const directEntry = orientedRun();
  directEntry.start = 2;
  assert.throws(() => checkRun(directEntry), /start at level one/);
  const reset = orientedRun();
  reset.executedTickets[1].resets = 1;
  assert.throws(() => checkRun(reset), /action ceiling or reset/);
  const contradiction = orientedRun();
  contradiction.executedTickets[0].outcome.matched = false;
  assert.throws(() => checkRun(contradiction), /continued without a confirmed return/);
});

test('a peer changing pixels cannot stand in for measured motion of the controlled carrier', () => {
  const stationary = orientedRun();
  for (const ticket of stationary.executedTickets.filter(ticket => ticket.level === 1)) {
    ticket.oriented.poseAfter = ticket.oriented.poseBefore;
  }
  assert.throws(() => checkRun(stationary), /measured own-carrier series/);
  for (const [invalidate, failure] of [
    [ticket => { ticket.planId = null; ticket.outcome.sic_plan = null; }, /executed ticket identity/],
    [ticket => { ticket.outcome.sic_plan = 'another-plan'; }, /executed ticket identity/],
    [ticket => { ticket.outcome.index = 99; }, /executed ticket identity/],
    [ticket => { ticket.outcome.matched = false; }, /measured own-carrier series/],
    [ticket => { ticket.outcomeCount = 2; }, /exactly one actual return/],
    [ticket => { ticket.oriented = null; }, /measured own-carrier series/],
  ]) {
    const run = orientedRun();
    invalidate(run.executedTickets[1]);
    assert.throws(() => checkRun(run), failure);
  }
});

test('physical accounting distinguishes continuous motion of the same cargo from walking', () => {
  const issued = orientedRun().executedTickets.slice(0, 2), groups = new Map([[10, issued]]);
  const measured = measureOrientedDelivery(issued, groups);
  assert.equal(measured.filter(effect => effect.kind === 'own carrier walk').length, 1);
  assert.equal(measured.filter(effect => effect.kind === 'same cargo translation').length, 1);
  issued[1].oriented.cargoBefore = [12, 2];
  issued[1].oriented.cargoAfter = [13, 2];
  const differentCargo = measureOrientedDelivery(issued, groups);
  assert.equal(differentCargo.filter(effect => effect.kind === 'own carrier walk').length, 1);
  assert.equal(differentCargo.filter(effect => effect.kind === 'same cargo translation').length, 0);
  const lostCargo = orientedRun();
  lostCargo.executedTickets[1].oriented = issued[1].oriented;
  assert.throws(() => checkRun(lostCargo), /consecutive translations of the same cargo/);
});
