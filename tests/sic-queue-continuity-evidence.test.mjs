import assert from 'node:assert/strict';
import test from 'node:test';
import { captureQueuedControl, completeQueuedControl } from '../scripts/sic-continuity-evidence.mjs';
import { requireExecutedPrefix } from '../scripts/verify-sic-continuity.mjs';

function receipt() {
  const beforeRef = 'public:epoch:2:revision:20', afterRef = 'public:epoch:2:revision:21';
  const proposal = { kind: 'sic_queued_placement', actions: [{ action_ref: 'ACTION3' }, { action_ref: 'ACTION2' }],
    binding: { level_epoch: 2 }, model: { epoch: 2, controls: { ACTION2: { kind: 'receive', acquisition_epoch: 1,
      evidence: ['public:epoch:1:revision:3', 'public:epoch:1:revision:4'] } } } };
  const ticket = { actionIndex: 1, actionRef: 'ACTION2', observationRef: beforeRef, levelsCompleted: 1 };
  const returned = { sealCount: 1, outcome: { observation_ref: afterRef, matched: null } };
  const owner = { epoch: 2, last_transition: 'received_then_automatic_or_return_unknown', controls: {
    ACTION2: { kind: 'receive', acquisition_epoch: 1, revalidated_epoch: 2, evidence: [beforeRef, afterRef] } } };
  return { proposal, ticket, returned, owner, beforeRef, afterRef };
}

test('queue diagnostics retain the role known before dispatch while independently recording its current acquisition', () => {
  const r = receipt(), captured = captureQueuedControl(r.proposal, r.ticket);
  const previousEvidence = [...captured.learnedEvidence];
  r.proposal.model.controls.ACTION2.evidence[0] = 'later-mutation';
  const result = completeQueuedControl(captured, () => r.owner, r.returned, 1);
  r.owner.controls.ACTION2.evidence[1] = 'later-owner-mutation';
  assert.deepEqual(result.learnedEvidence, previousEvidence);
  assert.equal(result.role, 'receive');
  assert.equal(result.acquisitionEpoch, 1);
  assert.equal(result.levelEpoch, 2);
  assert.deepEqual(result.acquisition, { epoch: 2, kind: 'receive', revalidatedEpoch: 2,
    transition: 'received_then_automatic_or_return_unknown', evidence: [r.beforeRef, r.afterRef] });
});

test('an unsealed queue prefix does not read or imply a new acquired relation', () => {
  const r = receipt(), captured = captureQueuedControl(r.proposal, r.ticket);
  let reads = 0;
  const result = completeQueuedControl(captured, () => { reads++; return r.owner; }, { ...r.returned, sealCount: 0 }, 1);
  assert.equal(reads, 0);
  assert.equal(result.acquisition, null);
  assert.equal(result.beforeRef, r.beforeRef);
  assert.equal(result.afterRef, r.afterRef);
});

test('stale queue proof keeps its old epoch and observations rather than claiming current revalidation', () => {
  const r = receipt(), captured = captureQueuedControl(r.proposal, r.ticket);
  r.owner.controls.ACTION2.revalidated_epoch = 1;
  r.owner.controls.ACTION2.evidence = [...captured.learnedEvidence];
  const result = completeQueuedControl(captured, r.owner, r.returned, 1);
  assert.equal(result.acquisition.revalidatedEpoch, 1);
  assert.deepEqual(result.acquisition.evidence, captured.learnedEvidence);
  assert.notDeepEqual(result.acquisition.evidence, [result.beforeRef, result.afterRef]);
});

test('unknown queue controls, missing epochs and absent scores stay unknown', () => {
  const r = receipt(); delete r.proposal.model.controls.ACTION2; delete r.ticket.levelsCompleted;
  const captured = captureQueuedControl(r.proposal, r.ticket);
  assert.equal(captured.role, null);
  assert.equal(captured.acquisitionEpoch, null);
  assert.deepEqual(captured.learnedEvidence, []);
  const result = completeQueuedControl(captured, null, r.returned, undefined);
  assert.equal(result.acquisition, null);
  assert.equal(result.scoreBefore, null);
  assert.equal(result.scoreAfter, null);
});

test('queue evidence refuses a different owner or command and cannot throw into native execution', () => {
  const r = receipt();
  assert.equal(captureQueuedControl({ ...r.proposal, kind: 'unrelated_family' }, r.ticket), null);
  assert.equal(captureQueuedControl(r.proposal, { ...r.ticket, actionRef: 'ACTION5' }), null);
  assert.equal(completeQueuedControl(captureQueuedControl(r.proposal, r.ticket), () => { throw Error('unreadable'); }, r.returned, 1), null);
});

test('an official score is preserved separately from a stale or missing queue acquisition', () => {
  const r = receipt(), captured = captureQueuedControl(r.proposal, r.ticket);
  const result = completeQueuedControl(captured, null, { ...r.returned,
    outcome: { ...r.returned.outcome, observation_ref: 'public:epoch:3:revision:21', matched: true, reason: 'official_boundary' } }, 2);
  assert.equal(result.scoreBefore, 1); assert.equal(result.scoreAfter, 2);
  assert.equal(result.acquisition, null);
  assert.equal(result.afterRef, 'public:epoch:3:revision:21');
});

test('the shared prefix check permits a final unscored contact and forbids continuing after it', () => {
  const group = [0, 1].map(index => ({ actionIndex: index, planId: 'public-plan', outcomeCount: 1,
    outcome: { sic_plan: 'public-plan', index, matched: index ? null : true, seal_prefix: index === 1 },
    sealCount: index ? 1 : 0, sealed: index ? 2 : null }));
  assert.doesNotThrow(() => requireExecutedPrefix('COLM', group));
  group[0].outcome.matched = null;
  assert.throws(() => requireExecutedPrefix('COLM', group), /without a confirmed return/);
});
