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
  const levels = Array.from({ length: 7 }, (_, index) => ({ level: index + 1, won: true, actions: index === 3 ? 1 : 2 }));
  const executedTickets = levels.flatMap(({ level, actions }) => Array.from({ length: actions }, (_, actionIndex) => ({
    level, decisionRevision: level * 10, actionIndex, action: 'ACTION4', resets: 0,
    sealed: actionIndex === actions - 1 ? actions : null, sealCount: actionIndex === actions - 1 ? 1 : 0,
    planId: 'observed-plan-' + level, outcomeCount: 1,
    outcome: { matched: true, family: 'sic_verify_oriented_delivery', sic_plan: 'observed-plan-' + level, index: actionIndex },
    oriented: { poseBefore: [actionIndex, 2], poseAfter: [actionIndex + 1, 2],
      cargoBefore: [actionIndex + 1, 2], cargoAfter: [actionIndex + 2, 2] },
  })));
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
  assert.throws(() => checkRun(contradiction), /continued after a contradicted return/);
});

test('a peer changing pixels cannot stand in for measured motion of the controlled carrier', () => {
  const stationary = orientedRun();
  for (const ticket of stationary.executedTickets.filter(ticket => ticket.level === 1)) {
    ticket.oriented.poseAfter = ticket.oriented.poseBefore;
  }
  assert.throws(() => checkRun(stationary), /measured own-carrier series/);
  for (const invalidate of [
    ticket => { ticket.planId = null; ticket.outcome.sic_plan = null; },
    ticket => { ticket.outcome.sic_plan = 'another-plan'; },
    ticket => { ticket.outcome.index = 99; },
    ticket => { ticket.outcome.matched = false; },
    ticket => { ticket.outcomeCount = 2; },
    ticket => { ticket.oriented = null; },
  ]) {
    const run = orientedRun();
    invalidate(run.executedTickets[1]);
    assert.throws(() => checkRun(run), /measured own-carrier series/);
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
