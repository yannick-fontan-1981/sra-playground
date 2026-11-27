import assert from 'node:assert/strict';
import test from 'node:test';
import { capturePassageContinuity, observePassageReturn, completePassageContinuity } from '../scripts/sic-passage-continuity.mjs';

function example() {
  const image = actor => {
    const rows = Array.from({ length: 16 }, () => Array(16).fill(0));
    for (let y = 7; y <= 10; y++) for (let x = 1; x <= 4; x++) rows[y][x] = 7;
    for (let y = actor[1]; y < actor[1] + 2; y++) for (let x = actor[0]; x < actor[0] + 2; x++) rows[y][x] = 3;
    return rows;
  };
  const beforeRef = 'test:epoch:6:revision:101:frame:1111111111111111';
  const afterRef = 'test:epoch:6:revision:102:frame:2222222222222222';
  const evidence = ['test:epoch:5:revision:90:frame:3333333333333333'];
  const proposal = { kind: 'sic_paired_passage', binding: { level_epoch: 6 },
    actions: [{ action_ref: 'ACTION4' }], memory: { evidence }, sicSituationCard: { strategy: 'P07' },
    scene: { actor: { bbox: [1, 1, 2, 2], color: 3 }, pitch: 4, neutral: true,
      floor: { '1,1': [1, 1], '5,1': [5, 1], '9,1': [9, 1] }, pairs: [],
      flags: [{ bbox: [1, 7, 4, 10] }], goal: { point: [9, 1], box: [8, 0, 11, 3] } },
    route: { steps: [{ direction: ['ACTION4', 1, 0], point: [5, 1] }] } };
  const ticket = { actionRef: 'ACTION4', actionIndex: 0, observationRef: beforeRef, levelsCompleted: 5 };
  const returned = { sealCount: 1, outcome: { observation_ref: afterRef } };
  return { image, proposal, ticket, beforeRef, afterRef, returned };
}

test('passive passage evidence reads the actual actor and snapshots earlier proof', () => {
  const x = example();
  const captured = capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1]));
  x.proposal.memory.evidence.push(x.afterRef);
  const observed = observePassageReturn(captured, x.image([5, 1]));
  assert.deepEqual(observed.actorBefore, [1, 1]);
  assert.deepEqual(observed.actorAfter, [5, 1]);
  assert.equal(observed.contextAfter, observed.contextBefore);
  assert.equal(observed.learnedEvidence.length, 1);
  assert.equal(observed.role, 'walk');
  assert.ok(!Object.hasOwn(observed, 'geometry'));
});

test('passive passage evidence does not substitute its prediction for another observed landing', () => {
  const x = example(), captured = capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1]));
  const observed = observePassageReturn(captured, x.image([9, 1]));
  assert.deepEqual(observed.expectedTo, [5, 1]);
  assert.deepEqual(observed.actorAfter, [9, 1]);
  assert.notEqual(observed.contextAfter, observed.contextBefore);
});

test('passive passage evidence preserves absent or ambiguous actors as unreadable', () => {
  const x = example(), captured = capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1]));
  const absent = x.image([5, 1]);
  for (let y = 1; y <= 2; y++) for (let p = 5; p <= 6; p++) absent[y][p] = 0;
  assert.equal(observePassageReturn(captured, absent).actorAfter, null);
  const duplicate = x.image([5, 1]);
  for (let y = 1; y <= 2; y++) for (let p = 1; p <= 2; p++) duplicate[y][p] = 3;
  assert.equal(observePassageReturn(captured, duplicate).actorAfter, null);
});

test('passive passage evidence observes a changed indicator independently of the actor', () => {
  const x = example(), captured = capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1]));
  const changed = x.image([5, 1]); changed[7][1] = 8;
  const observed = observePassageReturn(captured, changed);
  assert.deepEqual(observed.actorAfter, [5, 1]);
  assert.notEqual(observed.contextBefore, observed.contextAfter);
});

test('passive passage evidence separates crossing and switch roles from walking', () => {
  const x = example();
  x.proposal.scene.switches = { sites: [[5, 1]] };
  assert.equal(capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1])).role, 'switch');
  x.proposal.route.steps[0].crossing = { pair: {} };
  assert.equal(capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1])).role, 'crossing');
});

test('passive passage evidence refuses a foreign owner or unbound action without mutating inputs', () => {
  const x = example(), saved = structuredClone(x.proposal);
  assert.equal(capturePassageContinuity({ ...x.proposal, kind: 'foreign' }, x.ticket, x.image([1, 1])), null);
  assert.equal(capturePassageContinuity(x.proposal, { ...x.ticket, actionRef: 'ACTION1' }, x.image([1, 1])), null);
  assert.deepEqual(x.proposal, saved);
});

test('passive passage acquisition is read only after final reconciliation and remains distinct from score', () => {
  const x = example(), observed = observePassageReturn(capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1])), x.image([5, 1]));
  let reads = 0;
  const state = { local: { epoch: 6, evidence: [x.beforeRef, x.afterRef] }, previous: { completed: 5, ref: 'earlier' } };
  const reader = () => { reads++; return state; };
  const pending = completePassageContinuity(observed, reader, { ...x.returned, sealCount: 0 }, 5);
  assert.equal(reads, 0);
  assert.equal(pending.acquisition, null);
  const acquired = completePassageContinuity(observed, reader, x.returned, 5);
  assert.equal(reads, 1);
  assert.deepEqual(acquired.acquisition.evidence, [x.beforeRef, x.afterRef]);
  state.local.evidence.push('later');
  assert.equal(acquired.acquisition.evidence.length, 2);
  const scored = completePassageContinuity(observed, { local: state.local,
    previous: { completed: 6, ref: x.afterRef } }, x.returned, 6);
  assert.equal(scored.scoreAfter, 6);
  assert.equal(scored.acquisition.completed, 6);
  assert.equal(scored.acquisition.successRef, x.afterRef);
});

test('an unavailable passive passage owner leaves acquisition unknown', () => {
  const x = example(), observed = observePassageReturn(capturePassageContinuity(x.proposal, x.ticket, x.image([1, 1])), x.image([5, 1]));
  const missing = completePassageContinuity(observed, () => { throw Error('unavailable'); }, x.returned, 5);
  assert.equal(missing.acquisition, null);
  assert.equal(missing.afterRef, x.afterRef);
});
