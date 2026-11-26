import assert from 'node:assert/strict';
import test from 'node:test';
import { nextRendezvousStep, type RendezvousField } from '../src/sic/marker-rendezvous.ts';
import { assessMarkerStep, readMarkerField, retainMarkerStep, type MarkerField, type MarkerStep } from '../src/sic/observed-marker-field.ts';
import { continueMarkedField, createSicVerifyMarkedLattice } from '../src/sic/marked-lattice.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint } from '../src/logos-engine/v6-native-types.ts';

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

function sampleMarkedField() {
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
  return { rows, fill, box, actor, control, patrol, markers };
}

test('recover the board pitch from sparse markers and relearn the patrol after a mode change', () => {
  const { rows, fill, box, actor, control, patrol, markers } = sampleMarkedField();
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

for (const relocated of [false, true]) test('a witnessed marker field resumes in a compatible layout' + (relocated ? ' after relocation and recoloring' : ''), async () => {
  const scene = sampleMarkedField();
  if (relocated) {
    scene.fill(scene.rows, [33, 9, 35, 11], 1);
    scene.fill(scene.rows, scene.box([33, 9]), 12);
    scene.fill(scene.rows, scene.box(scene.actor), 1);
    scene.fill(scene.rows, [9, 10, 11, 10], 5);
    scene.fill(scene.rows, [10, 9, 10, 11], 5);
  }
  const transform = (rows: number[][]) => relocated ? rows.map(row => row.map(ink => ink === 0 ? 0 : 16 - ink)) : rows;
  const rows = transform(scene.rows);
  const inputRefs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
  const inputs = inputRefs.map(action_ref => ({ action_ref, data: {} }));
  const observation = { level_epoch: 2, levels_completed: 1, observation_ref: 'current', available_action_refs: inputRefs } as NativeObservation;
  const family = createSicVerifyMarkedLattice();
  await family.attachPrograms!(new NativeKnowledgeStore('marked-field-test', 'current'));
  const propose = (board: number[][], present = observation) =>
    family.proposeInSubquestion!('test', continueMarkedField, present, board, inputs, 12);
  assert.equal(await propose(rows), null);

  family.restore({ ...family.state(), transfer: { completed: 1, evidence: ['prior-score'], movements: inputRefs.slice(0, 4) } });
  assert.equal(await propose(rows, { ...observation, levels_completed: 2 }), null);
  const plan = await propose(rows);
  assert.ok(plan);
  assert.ok(plan.actions.length > 2 && plan.actions.length <= 12);
  assert.equal(plan.actions[0]?.action_ref, relocated ? 'ACTION3' : 'ACTION4');
  assert.ok((plan.route_refs as string[]).includes('prior-score'));

  const ambiguous = scene.rows.map(row => row.slice());
  scene.fill(ambiguous, scene.box([13, 9]), 12);
  assert.equal(await propose(transform(ambiguous)), null);

  const learned = family.state();
  const after = { ...observation, observation_ref: 'blocked' };
  const outcome = await family.after(plan, 0, observation, after, rows, rows);
  assert.equal(outcome.reason, 'marker_field_blocked');
  await family.record(observation, after, plan.actions[0]!, rows, rows, plan, 0, []);
  const next = await propose(rows, after);
  assert.ok(next);
  assert.notEqual(next.actions[0]?.action_ref, plan.actions[0]?.action_ref);

  family.restore(learned);
  const origin = relocated ? [33, 9] as const : scene.actor;
  const translated = (count: number) => {
    const board = scene.rows.map(row => row.slice());
    scene.fill(board, scene.box(origin), 1);
    scene.fill(board, scene.box([origin[0] + (relocated ? -4 : 4) * count, origin[1]]), 12);
    return board;
  };
  const moved = { ...observation, observation_ref: 'first-return' };
  const second = { ...observation, observation_ref: 'second-return' };
  const firstFrame = transform(translated(1)), secondFrame = transform(translated(2));
  assert.equal((await family.after(plan, 0, observation, moved, rows, firstFrame)).seal_prefix, false);
  const check = (frame_rows: number[][]) => family.before(plan, 1,
    { frame_rows } as Parameters<NativeFamily['before']>[2], moved);
  assert.equal((await check(firstFrame)).admitted, true);
  assert.equal((await check(rows)).admitted, false);
  const changedCounter = translated(1);
  scene.fill(changedCounter, [5, 43, 5, 43], 3);
  assert.equal((await check(transform(changedCounter))).admitted, false);
  const changedMarker = translated(1), x = relocated ? 10 : 34;
  scene.fill(changedMarker, [x, 10, x, 10], 1);
  assert.equal((await check(transform(changedMarker))).admitted, false);
  await family.record(observation, moved, plan.actions[0]!, rows, firstFrame, plan, 0, []);
  await family.record(moved, second, plan.actions[1]!, firstFrame, secondFrame, plan, 1, []);
  const measured = family.state().measured as MarkerField;
  assert.equal(measured.count, 2);
  assert.equal(measured.evidence.at(-1), 'second-return');
});
