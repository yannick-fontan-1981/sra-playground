import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesPeriodicContact, observePeriodicContact, periodicContactBox, planPeriodicContact, projectPeriodicSnapshot,
  type PeriodicContactMove, type PeriodicContactRoute } from '../src/sic/periodic-contact-route.ts';
import type { Direction } from '../src/sic/rectangular-contact-route.ts';

const directions: readonly Direction[] = [['U', 0, -1], ['D', 0, 1], ['L', -1, 0], ['R', 1, 0]];
const route: PeriodicContactRoute = {
  epoch: 1, origin: [0, 0], step: 2, size: [6, 6], field: Array<number>(36).fill(0), goal: 14,
  actorInk: 2, actorMarker: 0, sources: [{ size: [1, 1], axis: 1, inks: [6, 8] }],
  calibration: { band: 4, pitch: 2, steps: 2, evidence: 'calibration' },
  splits: [1], rhythms: [{ side: 0, period: 2, reach: 3 }], pose: { actor: 20, sources: [2], phases: [1] },
  evidence: [], observedControls: { U: 'up', D: 'down', L: 'left', R: 'right' }, stopped: false, samples: 0,
};

test('the same movement into an opening has two successors at two measured phases', () => {
  assert.deepEqual(planPeriodicContact(route, directions, 1), []);
  const ready = { ...route, pose: { ...route.pose, phases: [0] } };
  const path = planPeriodicContact(ready, directions, 1);
  assert.equal(path.length, 1);
  assert.equal(path[0]?.direction[0], 'U');
  assert.equal(path[0]?.pose.actor, route.goal);
  assert.deepEqual(path[0]?.pose.phases, [1]);
});

test('a periodic extension carries the actor past the band while a fitted payload stays in place', () => {
  const field = Array<number>(30).fill(0);
  field.fill(1, 10, 20);
  const room: PeriodicContactRoute = {
    ...route, size: [5, 6], field, goal: 7,
    rhythms: [{ side: 1, period: 2, reach: 1 }],
    payloads: [{ mask: [[0, 0], [1, 0], [0, 1]], ink: 7, goal: 0 }],
    pose: { actor: 22, sources: [27], phases: [1], payloads: [0] },
  };
  assert.deepEqual(planPeriodicContact(room, directions, 1), [{
    direction: directions[0], contact: null, automatic: [0], pose: { actor: 7, sources: [27], phases: [0], payloads: [0] },
  }]);
  assert.equal(planPeriodicContact({ ...room, payloads: [{ ...room.payloads![0]!, goal: 1 }] }, directions, 1).length, 0);
});

test('compose a contact across the learned continuation band and an independent voluntary move', () => {
  const corridor: PeriodicContactRoute = {
    ...route, size: [8, 1], field: [0, 0, 0, 1, 1, 1, 0, 0], goal: 2,
    sources: [{ size: [1, 1], axis: 0, inks: [6, 8] }],
    pose: { actor: 1, sources: [2], phases: [0] }, splits: [0], rhythms: [{ side: 0, period: 5, reach: 1 }],
  };
  const path = planPeriodicContact(corridor, directions, 2);
  assert.deepEqual(path.map(step => [step.direction[0], step.contact, step.pose.actor, step.pose.sources]), [
    ['R', 0, 1, [6]], ['R', null, 2, [6]],
  ]);
});

test('reconciliation checks phase as well as the positions of the controlled body and source', () => {
  const current = { ...route, splits: [0], pose: { ...route.pose, phases: [0] } };
  const rows = Array.from({ length: 12 }, () => Array<number>(12).fill(1));
  const [ax, ay, ar, ab] = periodicContactBox(current, current.pose.actor);
  for (let y = ay; y <= ab; y++) rows[y]!.fill(2, ax, ar + 1);
  rows[ay]![ax] = 0;
  const [sx, sy, sr, sb] = periodicContactBox(current, current.pose.sources[0]!);
  for (let y = sy; y <= sb; y++) rows[y]!.fill(8, sx, sr + 1);
  assert.ok(matchesPeriodicContact(current, rows));

  const move: PeriodicContactMove = { direction: directions[0]!, contact: null, automatic: [],
    pose: { ...current.pose, phases: [1] } };
  assert.equal(observePeriodicContact(current, rows, [], 'same', move), null);
  rows[sy]!.fill(6, sx, sr + 1);
  assert.ok(!matchesPeriodicContact(current, rows));
  assert.ok(matchesPeriodicContact(projectPeriodicSnapshot(current, move), rows));
  const observed = observePeriodicContact(current, rows, [], 'advanced', move);
  assert.deepEqual(observed?.pose, move.pose);
});
