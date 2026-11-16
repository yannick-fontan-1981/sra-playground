import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRendezvousStep, type RendezvousField } from '../src/sic/marker-rendezvous.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';

test('the same contact site permits preparation and completion at different phases', () => {
  const at: NativePoint = [9, 4];
  const initial = JSON.stringify([[4, 4], [4, 4]]);
  const field: RendezvousField = {
    epoch: 1, at, history: [], fixedTested: [], evidence: [], movements: [], count: 0, stopped: false,
    cycle: { positions: [[4, 4], at, at, [14, 4], at], phase: 1 },
    scene: { sites: ['4,4', '9,4', '14,4'], pitch: 5, actorColor: 12, groundColor: 4,
      markerColor: 9, tag: 6, size: 3, fixed: [], counter: [[2, 12, 3, 13]], preparation: [[2, 15, 3, 16]] },
    initialCounter: [initial], counter: [initial], initialPreparation: [initial], prepared: null,
  };
  const rows = Array.from({ length: 18 }, () => Array<number>(20).fill(4));
  for (let y = 3; y <= 5; y++) rows[y]!.fill(11, 8, 11);
  rows[4]![9] = 12;
  const inputs = ['ACTION3', 'ACTION4', 'ACTION5'].map(action_ref => ({ action_ref, data: {} }));
  const open = nextRendezvousStep(field, rows, inputs, 10);
  assert.equal(open?.command.action_ref, 'ACTION5');
  assert.equal(open?.window, true);

  const closing = { ...field, cycle: { ...field.cycle!, phase: 2 } };
  const later = nextRendezvousStep(closing, rows, inputs, 10);
  assert.ok(later);
  assert.deepEqual(later.target, at);
  assert.equal(later.window, undefined);

  rows[15]![2] = 0;
  const finish = nextRendezvousStep({ ...closing, prepared: { at, kind: 'mobile' } }, rows, inputs, 10);
  assert.equal(finish?.command.action_ref, 'ACTION5');
  assert.equal(finish?.finish, true);
});
