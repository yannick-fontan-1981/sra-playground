import assert from 'node:assert/strict';
import test from 'node:test';
import { orientedCouplingScene } from '../src/logos-engine/v6-oriented-coupling.ts';
import { bindContinuityPlan, collectContinuityReturn, observeOrientedContinuity, orientedContinuityEvidence } from '../scripts/sic-continuity-evidence.mjs';

const ticket = { sessionId: 'public-session', observationRef: 'public-frame-1', level: 2, decisionRevision: 7, actionIndex: 0 };
const planEvent = { kind: 'sic_native_plan', id: 'sic-plan:public-frame-1', family: 'sic_verify_oriented_delivery', index: 0 };

test('continuity retains the exact plan across later tickets even when the opening trace has expired', () => {
  const bound = bindContinuityPlan(ticket, [planEvent]);
  assert.equal(bound.id, planEvent.id);
  const next = { ...ticket, observationRef: 'public-frame-2', actionIndex: 1 };
  assert.equal(bindContinuityPlan(next, [], bound), bound);
  assert.equal(bindContinuityPlan({ ...next, decisionRevision: 8 }, [], bound), null);
  assert.equal(bindContinuityPlan({ ...ticket, observationRef: 'unknown' }, [planEvent]), null);
});

test('continuity correlates actual returns by plan, family and ticket index and counts only their seals', () => {
  const bound = bindContinuityPlan(ticket, [planEvent]);
  const next = { ...ticket, actionIndex: 2 };
  const actual = { kind: 'actual_outcome', sic_plan: planEvent.id, family: planEvent.family, index: 2,
    matched: false, seal_prefix: true, observation_ref: 'public-frame-4', reason: 'contradiction' };
  const seal = { kind: 'sealed_prefix', family: planEvent.family, revision: 7, acquired_actions: 3 };
  const trace = [{ ...actual, sic_plan: 'another-plan', matched: true }, { ...actual, index: 1, matched: true },
    { ...actual, family: 'another-family', matched: true }, actual, { ...seal, revision: 8 }, { ...seal, family: 'another-family' }, seal];
  const result = collectContinuityReturn(next, bound, trace);
  assert.equal(result.outcome.matched, false);
  assert.equal(result.outcome.index, 2);
  assert.equal(result.outcome.sic_plan, planEvent.id);
  assert.equal(result.outcomeCount, 1);
  assert.equal(result.sealCount, 1);
  assert.equal(result.sealed, 3);
  assert.equal(collectContinuityReturn(next, bound, [...trace, actual]).outcome, null, 'Duplicate matching returns are ambiguous');
  assert.equal(collectContinuityReturn(next, bound, [...trace, seal]).sealCount, 2, 'Duplicate closures remain visible');
  assert.equal(collectContinuityReturn(next, null, trace).outcome, null);
});

const geometry = { pitch: 4, phase: [0, 0], core: 9, rest_shell: 4, background: 1,
  initial_boxes: [[3, 2], [7, 5]], targets: [[10, 2]] };
const proposal = { local: { geometry, color: 14, held: [13, 13] },
  scene: { pose: [13, 13] }, walk: [{ after: { pose: [14, 14], boxes: {} }, cargoAfter: [15, 15] }] };
function frame(own, peer, { ambiguous = false, coupled = true } = {}) {
  const rows = Array.from({ length: 64 }, () => Array(64).fill(1));
  const tile = ([u, v], ink) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) rows[4 * v + y][4 * u + x] = ink(x, y); };
  const body = (x, _y) => x === 3 ? 0 : 14;
  const box = ink => (x, y) => x === 0 || y === 0 || x === 3 || y === 3 ? ink : 9;
  tile([own, 2], body);
  tile([own + 1, 2], box(coupled ? 0 : 4));
  tile([peer, 5], box(5));
  tile([peer - 1, 5], () => 15);
  if (ambiguous) tile([1, 9], body);
  return rows;
}

test('oriented evidence measures the own body and coupled crate from pixels independently of peer movement or predicted walk', () => {
  const before = observeOrientedContinuity(frame(2, 7), proposal, orientedCouplingScene);
  const after = observeOrientedContinuity(frame(3, 8), proposal, orientedCouplingScene);
  const result = orientedContinuityEvidence(before, after);
  assert.deepEqual(result.poseBefore, [2, 2]);
  assert.deepEqual(result.poseAfter, [3, 2]);
  assert.deepEqual(result.cargoBefore, [3, 2]);
  assert.deepEqual(result.cargoAfter, [4, 2]);
  const onlyPeerMoved = observeOrientedContinuity(frame(2, 8), proposal, orientedCouplingScene);
  assert.deepEqual(onlyPeerMoved, before, 'Peer-only pixel changes do not become an own translation');
  const uncoupled = observeOrientedContinuity(frame(2, 7, { coupled: false }), proposal, orientedCouplingScene);
  assert.deepEqual(uncoupled.pose, [2, 2]);
  assert.equal(uncoupled.cargo, null, 'A crate with a different shell is not an observed load');
});

test('missing or ambiguous public scenes remain null, including the unbound side of a level boundary', () => {
  assert.equal(observeOrientedContinuity(frame(2, 7, { ambiguous: true }), proposal, orientedCouplingScene), null);
  assert.equal(observeOrientedContinuity(frame(2, 7), {}, orientedCouplingScene), null);
  assert.equal(observeOrientedContinuity(null, proposal, orientedCouplingScene), null);
  const before = observeOrientedContinuity(frame(2, 7), proposal, orientedCouplingScene);
  const boundary = orientedContinuityEvidence(before, null);
  assert.deepEqual(boundary.poseBefore, [2, 2]);
  assert.equal(boundary.poseAfter, null);
  assert.equal(boundary.cargoAfter, null);
  assert.equal(orientedContinuityEvidence(null, null), null);
});
