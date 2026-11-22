import test from 'node:test';
import assert from 'node:assert/strict';
import { transportLandingPlan } from '../src/sic/transport-landing-plan.ts';
import type { Board } from '../src/sic/contact-frontier-search.ts';

// A horizontal exchanger is fixed in a narrow corridor. A single parcel
// must be sent beyond the corridor before its owner can reach the far dock.
const width = 9;
const square = (x: number, y: number) => y * width + x;
function corridor(): Board {
  const floor = new Set([
    square(8, 1),
    ...[1, 2, 3, 4, 5].map((x) => square(x, 1)),
    square(1, 0),
    square(2, 0),
  ]);
  return {
    width,
    height: 3,
    floor,
    goals: [square(8, 1)],
    actor: square(1, 0),
    parts: [square(4, 1), square(1, 1)],
    roles: ['station', 'parcel'],
    pivotIndex: 0,
    motors: [
      { op: 'up', delta: -width },
      { op: 'down', delta: width },
      { op: 'left', delta: -1 },
      { op: 'right', delta: 1 },
    ],
    transport: {
      op: 'exchange',
      land: (p, c) => {
        if (Math.floor(p / width) !== Math.floor(c / width) || p === c) return null;
        const x = 2 * (c % width) - (p % width);
        return x >= 0 && x < width ? square(x, Math.floor(c / width)) : null;
      },
    },
  };
}
const limits = { maxNodes: 100, maxDepth: 20 };
const witnesses = new Map([['parcel', 'prior dry transfer']]);
const permits = (role: string, at: number) => role === 'parcel' && at === square(7, 1);
test('inverts a horizontal transfer to make a landing before the subject uses it', () => {
  const project = transportLandingPlan(corridor(), witnesses, permits, new Set(), limits);
  assert.deepEqual(project?.landing, {
    pivot: square(4, 1),
    launch: square(1, 1),
    arrival: square(7, 1),
    witness: 'prior dry transfer',
  });
  assert.deepEqual(
    project.steps.map((s) => s.op),
    ['exchange', 'down', 'exchange', 'right'],
  );
  assert.equal(project.steps[0]?.from, project.steps[0]?.to);
  assert.equal(project.steps[0]?.boundary, true);
  assert.equal(project.steps.at(-1)?.to, square(8, 1));
});
test('abstains without the cargo witness, the substrate permission or enough search budget', () => {
  assert.equal(transportLandingPlan(corridor(), new Map(), permits, new Set(), limits), null);
  assert.equal(
    transportLandingPlan(corridor(), witnesses, () => false, new Set(), limits),
    null,
  );
  assert.equal(
    transportLandingPlan(corridor(), witnesses, permits, new Set(), { ...limits, maxDepth: 3 }),
    null,
  );
});
