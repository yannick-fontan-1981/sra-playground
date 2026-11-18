import assert from 'node:assert/strict';
import test from 'node:test';
import { findPassage, measurePassage, passageThresholds, readPassage, samePassage, type PassageLayout } from '../src/sic/band-passage.ts';

function layout(): PassageLayout {
  return {
    view: { axis: 1, reverse: false, breadth: 13, depth: 10 },
    bands: [[0, 5], [7, 12]],
    unit: 1,
    fill: 0,
    controls: [
      { kind: 'transfer', box: [5, 9, 5, 9], index: 0 },
      { kind: 'transfer', box: [7, 9, 7, 9], index: 1 },
      { kind: 'door', box: [6, 6, 6, 7], edge: 0, amount: 2 },
    ],
    markers: [2, 3].map((cap, i) => ({
      cap, thickness: 1, width: 2, accent: 4, pixels: [[0, 0]], height: 1, target: [6, 5, 6, 5],
      targets: { bands: [1 - i], amount: 2 },
    })),
  };
}

const initial = { quantities: [2, 2], carried: [0, 1], markerBoxes: [] };

test('a balanced door can swap two distinct markers while preserving both quantities', () => {
  const geometry = layout();
  const plan = findPassage(geometry, initial, 'into_clicked', [], 4);
  assert.deepEqual(plan, { steps: [{ index: 2, next: { quantities: [2, 2], carried: [1, 0] } }], distance: 1, gate: 2 });

  const rows = Array.from({ length: 10 }, (_, y) => Array<number>(13).fill(y >= 8 ? 0 : 9));
  for (const [x, cap] of [[3, 3], [9, 2]] as const) {
    rows[7]![x] = rows[7]![x + 1] = cap;
    rows[6]![x] = 4;
  }
  assert.ok(samePassage(plan!.steps[0]!.next, readPassage(rows, geometry)));
  rows[7]![9] = rows[7]![10] = 3;
  assert.equal(readPassage(rows, geometry), null);
});

test('a proved intake limit only applies to the receiving band and its current marker', () => {
  const geometry = layout();
  geometry.markers[0]!.targets = { bands: [0], amount: 3 };
  geometry.markers[1]!.targets = { bands: [1], amount: 1 };
  assert.equal(findPassage(geometry, initial, 'into_clicked', [], 4)?.distance, 1);
  assert.equal(findPassage(geometry, initial, 'into_clicked', [], 4, [{ band: 0, occupant: 0, amount: 2 }]), null);
  assert.equal(findPassage(geometry, initial, 'into_clicked', [], 4, [{ band: 0, occupant: 1, amount: 2 }])?.distance, 1);
});

test('paired controls and a transverse wall give each side of a door its local threshold', () => {
  const rows = Array.from({ length: 26 }, () => Array<number>(40).fill(3));
  const paint = (left: number, top: number, right: number, bottom: number, color: number) => {
    for (let y = top; y <= bottom; y++) rows[y]!.fill(color, left, right + 1);
  };
  paint(0, 0, 1, 10, 0);
  paint(14, 0, 15, 10, 5);
  paint(16, 0, 25, 10, 0);
  paint(0, 13, 13, 25, 0);
  paint(0, 11, 39, 12, 5);
  paint(4, 11, 9, 12, 1);
  paint(20, 11, 25, 12, 1);
  paint(30, 11, 30, 12, 11);
  paint(2, 4, 2, 7, 11);
  paint(3, 4, 3, 7, 4);
  paint(4, 4, 4, 4, 4);
  for (const left of [0, 16]) {
    paint(left, 9, left + 1, 10, 9);
    paint(left, 13, left + 1, 14, 9);
  }
  const transverse = measurePassage(rows);
  assert.ok(transverse);
  const initial = readPassage(rows, transverse);
  assert.deepEqual(initial?.quantities, [2, 10, 14]);
  assert.deepEqual(transverse.controls.flatMap(control => control.kind === 'door' ? [passageThresholds(control)] : []), [
    [{ band: 0, amount: 4 }, { band: 2, amount: 4 }],
    [{ band: 1, amount: 4 }, { band: 2, amount: 20 }],
  ]);
  const route = findPassage(transverse, initial!, 'into_clicked', [], 40);
  const doors = route?.steps.filter(({ index }) => transverse.controls[index]!.kind === 'door');
  assert.deepEqual(doors?.map(({ next }) => next.carried), [[2], [1]]);
});
