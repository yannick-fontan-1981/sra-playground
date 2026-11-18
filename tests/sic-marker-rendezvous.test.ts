import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRendezvousStep, type RendezvousField } from '../src/sic/marker-rendezvous.ts';
import { assessMarkerStep, readMarkerField, retainMarkerStep, type MarkerStep } from '../src/sic/observed-marker-field.ts';
import type { NativeBox, NativePoint } from '../src/logos-engine/v6-native-types.ts';

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

test('recover the board pitch from sparse markers and relearn the patrol after a mode change', () => {
  const rows = Array.from({ length: 50 }, () => Array<number>(45).fill(0));
  const fill = (frame: number[][], [l, t, r, b]: NativeBox, ink: number) => {
    for (let y = t; y <= b; y++) frame[y]!.fill(ink, l, r + 1);
  };
  const box = ([x, y]: NativePoint): NativeBox => [x, y, x + 1, y + 1];
  const rim = ([l, t, r, b]: NativeBox) => {
    fill(rows, [l, t, r, b], 6);
    fill(rows, [l + 1, t + 1, r - 1, b - 1], 0);
  };
  fill(rows, [8, 8, 35, 35], 1);
  const markers: NativePoint[] = [[17, 9], [25, 9], [9, 17], [17, 17], [9, 25], [25, 25]];
  for (const at of markers) fill(rows, box(at), 9);
  const actor: NativePoint = [9, 9], control: NativePoint = [33, 17];
  fill(rows, box(actor), 12);
  fill(rows, [33, 17, 34, 19], 5);
  fill(rows, [33, 10, 35, 10], 5);
  fill(rows, [34, 9, 34, 11], 5);
  const patrol: NativePoint = [25, 17];
  fill(rows, box(patrol), 9);
  rows[17]![25] = 10;
  rim([3, 42, 20, 46]);
  rim([25, 42, 28, 45]);
  rim([30, 42, 33, 45]);
  for (const x of [5, 8, 11, 14]) fill(rows, [x, 43, x + 1, 45], 2);
  const field = readMarkerField(rows, 1, ['visible'], []);
  assert.ok(field);
  assert.equal(field.scene.pitch, 4);
  assert.deepEqual(field.mobile?.history, [patrol]);

  const before = rows.map(row => row.slice());
  fill(before, box(actor), 1);
  fill(before, box(control), 12);
  const nextPatrol: NativePoint = [29, 29];
  const after = before.map(row => row.slice());
  fill(after, box(patrol), 1);
  fill(after, box(nextPatrol), 9);
  after[29]![29] = 10;
  fill(after, box(markers[0]!), 1);
  const traveling = { ...field, at: control, mobile: { ...field.mobile!, history: [patrol, [29, 17] as NativePoint] } };
  const switchMode: MarkerStep = { target: { kind: 'mode', point: control }, landing: null, command: { action_ref: 'ACTION5', data: {} } };
  const result = assessMarkerStep(traveling, switchMode, before, after);
  assert.equal(result.kind, 'mode_changed');
  const retained = retainMarkerStep(traveling, switchMode, result, 'switched', after);
  assert.equal(retained.mobile?.tag, field.mobile?.tag);
  assert.deepEqual(retained.mobile?.history, [nextPatrol]);
});
