import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { chooseReceptionSequence, recordReceptionSequence, type ReceptionSequence } from '../src/sic/reception-sequence.ts';

const first: NativePoint = [1, 1], start: NativePoint = [5, 1], second: NativePoint = [9, 1];
const initialBadge = [5, 3, 3, 3, 5, 5, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3];
const capturedBadge = initialBadge.map(ink => ink === 5 ? 0 : 14);
const remembered = { pitch: 4, supportInk: 9, controls: { ACTION3: [-4, 0], ACTION4: [4, 0] } as Record<string, NativePoint>, evidence: [] };

function frame([x, y]: NativePoint, leftBadge: number[]) {
  const rows = Array.from({ length: 12 }, () => Array<number>(14).fill(8));
  for (const dx of [0, 3]) for (const dy of [0, 3]) rows[y + dy]![x + dx] = 10;
  for (let i = 0; i < initialBadge.length; i++) {
    rows[7 + Math.floor(i / 4)]![1 + i % 4] = leftBadge[i]!;
    rows[7 + Math.floor(i / 4)]![8 + i % 4] = initialBadge[i]!;
  }
  return rows;
}

test('a receipt persists on departure and is cleared when the original display returns', () => {
  const state: ReceptionSequence = {
    epoch: 2, initialHash: 'initial', start, at: first, carrierInk: 10, visible: true,
    layout: { box: [0, 0, 13, 5], pitch: 4, cells: [first, start, second], background: 8, requests: [],
      support_candidates: [{ anchor: first, color: 9 }, { anchor: second, color: 9 }] },
    badges: [{ box: [1, 7, 4, 10], initial: initialBadge }, { box: [8, 7, 11, 10], initial: initialBadge }],
    supports: [first, second], walls: [], blocked: [], failures: [], exhausted: [], receipts: [],
    tick: 0, waits: 0, target: first, evidence: [],
  };
  const hold = { input: 'ACTION3', to: first, support: first, hold: true };
  const distorted = [...initialBadge];
  distorted[0] = 0;
  assert.equal(recordReceptionSequence(state, hold, frame(first, distorted), 'flash', 'flash').next.receipts.length, 0);

  const observed = recordReceptionSequence(state, hold, frame(first, capturedBadge), 'captured', 'capture').next;
  assert.deepEqual(observed.receipts.map(receipt => [receipt.badge, receipt.confirmed]), [[0, false]]);
  const route = chooseReceptionSequence(observed, remembered, ['ACTION3', 'ACTION4'], 10);
  assert.deepEqual(route, { input: 'ACTION4', to: start, support: second, hold: false });
  assert.ok(route);

  const confirmed = recordReceptionSequence(observed, route, frame(start, capturedBadge), 'departed', 'departure').next;
  assert.deepEqual(confirmed.receipts.map(receipt => [receipt.badge, receipt.confirmed]), [[0, true]]);
  const reset = recordReceptionSequence(confirmed, { ...route, to: second }, frame(start, initialBadge), 'initial', 'reset').next;
  assert.deepEqual(reset.receipts, []);
  assert.equal(reset.tick, 0);
  assert.deepEqual(reset.failures, ['3/9,1']);
  const activation = { ...state, at: start, inactiveEntry: { hash: 'inactive', at: first }, tick: 0 };
  const firstCrossing = { ...route, to: second };
  const withoutSupports = recordReceptionSequence(activation, firstCrossing, frame(start, initialBadge), 'inactive', 'entry');
  assert.deepEqual(withoutSupports.next.failures, ['1/9,1']);
  assert.deepEqual(withoutSupports.next.at, first);
  assert.equal(withoutSupports.next.tick, 0);
});
