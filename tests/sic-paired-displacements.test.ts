import {
  recognizeProjection,
  images,
  applyImages,
} from '../src/sic/paired-previews.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fresh,
  key,
  geometry,
  imagine,
  localEffects,
  unresolvedMotionTest,
  viableMotionLaws,
  law,
} from '../src/sic/paired-displacements.ts';
import type { Scene, Reading } from '../src/sic/paired-scene.ts';
import { observeRelease, recordReleaseTest } from '../src/sic/test-released-subject.ts';
import { carryPair, compareAfterControl, inquiry, pairProposal } from '../src/sic/probe-paired-displacements.ts';
import { planDisplacements } from '../src/sic/plan-paired-displacements.ts';
const s: Scene = {
  grid: { pitch: 3, left: 0, top: 0, columns: 7, rows: 5 },
  floor: 2,
  bodies: [9, 3],
  accent: 4,
  cargo: 'crate',
  ground: Array.from({ length: 35 }, (_, i) => i),
  medium: [],
  goals: [6, 34],
  doors: [],
  other: [],
  origin: [0, 16],
  features: [],
  initial: Array(35).fill(''),
};
test('test a held passage with a stationary change of control, then use the observed outcome', () => {
  const room: Scene = { ...s, doors: [{ site: 10, controls: [0], closed: 'shut' }] };
  const at: Reading = { subjects: [0, 23], active: 0, pieces: [], supports: [], opened: [10], anchor: -1 };
  const make = (solves = false) => {
    const q = inquiry();
    q.scene = room;
    q.reading = at;
    q.active = 'known joint movement';
    q.selectionWitness = 'registered selection';
    const m = q.learning;
    for (const [i, [dx, dy]] of [[0,-1],[0,1],[-1,0],[1,0]].entries())
      m.motors['ACTION'+(i+1)] = { dx: dx!, dy: dy!, ref: 'measured motor' };
    m.openings = { bySubject: { 10: 'holder opened the passage' } };
    m.planSolves = solves;
    m.plan = [{ from: key(at), command: 'ACTION2', expected: { ...at, subjects: [7,23] } },
      { from: 'later', command: 'ACTION4', expected: { ...at, subjects: [0,10] } }];
    return q;
  };
  const available = ['ACTION1','ACTION2','ACTION3','ACTION4','ACTION6'];
  for (const open of [true, false]) {
    const q = make(), m = q.learning;
    const trial = pairProposal(q, 'before', 4, 60, 2, available)!;
    assert.equal(trial.gateSelectionTest?.gate, 10);
    assert.equal(trial.open.length, 2);
    assert.ok(trial.evidence.includes('holder opened the passage'));
    const next: Reading = { ...at, active: 1, opened: open ? [10] : [] };
    assert.equal(localEffects(room, m, at, next, trial.command, 'return', trial), open
      ? 'the_unselected_holder_kept_the_passage_open' : 'the_passage_closed_when_control_left_the_stationary_holder');
    const elsewhere: Reading = { ...at, subjects: [0,20] };
    assert.deepEqual(imagine(room, geometry(room), elsewhere, 'select', m, 'walk')!.opened, next.opened);
    assert.equal(at.opened.length, 1);
  }
  for (const [q,min,keys] of [[make(true),2,available],[make(),3,available],[make(),2,available.slice(0,4)]] as const) {
    assert.equal(pairProposal(q,'before',4,60,min,keys)?.command,'ACTION2');
  }
  const q = make();
  const trial = pairProposal(q,'before',4,60,2,available)!;
  const moved: Reading = { ...at, active: 1, subjects: [0,10], opened: [] };
  assert.equal(localEffects(room,q.learning,at,moved,trial.command,'ambiguous',trial),'selection_did_not_isolate_the_passage_effect');
  assert.equal(q.learning.selectionReturns,undefined);
});
test('an incomplete route yields to an untried comparison, while a scoring route is played', () => {
  const room: Scene = { ...s, ground: [0, 1, 2, 3, 7, 8, 9, 10, 33, 34], goals: [33, 34] };
  const v: Reading = { subjects: [0, 7], active: 0, pieces: [1], supports: [], opened: [], anchor: -1 };
  const m = fresh();
  for (const [i, [dx, dy]] of [[0, -1], [0, 1], [-1, 0], [1, 0]].entries())
    m.motors['ACTION' + (i + 1)] = { dx: dx!, dy: dy!, ref: 'directions measured' };
  const test = planDisplacements(room, m, v, 'now', 5, 20, 2)!;
  assert.ok(test.motionTest);
  assert.ok(new Set(test.motionTest.predictions.map(p => p.pose)).size >= 2);
  const arrived = imagine(room, geometry(room), v, test.command, m, 'push') ?? v;
  assert.equal(localEffects(room, m, v, arrived, test.command, 'observed', test), 'motion_test_discriminated_public_effects');
  assert.ok(m.checked.includes('test-motion/' + test.key));
  const finish = planDisplacements({ ...room, goals: [7, 1] }, m, v, 'now', 5, 20, 2)!;
  assert.equal(finish.command, 'ACTION4');
  assert.equal(finish.motionTest, undefined);
});
test('a common displacement discriminates a field from direct contact and carries only witnessed effects', () => {
  const m = fresh();
  m.motors['ACTION4'] = { dx: 1, dy: 0, ref: 'earlier move' };
  m.scope = 'area seen';
  m.radius = 1;
  const before: Reading = {
    subjects: [0, 16],
    active: 1,
    pieces: [9, 23, 33],
    supports: [],
    opened: [],
    anchor: -1,
  };
  const next = imagine(s, geometry(s), before, 'ACTION4', m, 'field')!;
  assert.deepEqual(next.pieces, [10, 24, 33]);
  localEffects(s, m, before, next, 'ACTION4', 'two remote objects moved');
  assert.equal(law(m, 1), 'field');
  const q = inquiry();
  q.scene = s;
  q.learning = m;
  assert.equal(carryPair(q, 'level advanced'), undefined);
  q.active = 'selection_exposes_a_spatial_scope';
  const carry = carryPair(q, 'level advanced')!;
  assert.deepEqual(carry.evidence, m.evidence);
  assert.equal('pieces' in carry, false);
  assert.equal('plan' in carry, false);
});

test('an agreed preparatory movement can make two previously identical predictions diverge', () => {
  const room = { ...s, ground: [0, 1, 2, 3, 4, 32, 33, 34], goals: [32, 33] };
  const v: Reading = { subjects: [0, 34], active: 0, pieces: [2], supports: [], opened: [], anchor: -1 };
  const m = fresh();
  m.evidence[0] = { push: 1, walk: 1 };
  for (const [i, [dx, dy]] of [[0, -1], [0, 1], [-1, 0], [1, 0]].entries())
    m.motors['ACTION' + (i + 1)] = { dx: dx!, dy: dy!, ref: 'observed' };
  const approach = planDisplacements(room, m, v, 'before', 6, 100, 2)!;
  assert.equal(approach.command, 'ACTION4');
  assert.equal(approach.motionPreparation?.steps, 1);
  assert.equal(approach.motionPreparation?.test, 'ACTION4');
  assert.equal(approach.motionTest, undefined);
  const near = imagine(room, geometry(room), v, approach.command, m, 'walk')!;
  assert.deepEqual(near, imagine(room, geometry(room), v, approach.command, m, 'push'));
  localEffects(room, m, v, near, approach.command, 'approach verified', approach);
  const probe = planDisplacements(room, m, near, 'now', 6, 100, 2)!;
  assert.equal(probe.command, 'ACTION4');
  assert.deepEqual(probe.motionTest?.predictions, approach.motionPreparation?.predictions);
});

test('test an unclassified tile only when it can open access to an objective, then reuse the observed entry', () => {
  const room = { ...s, ground: [7, 8, 10, 11, 34], other: [9, 15], goals: [11, 34] };
  const v: Reading = { subjects: [7, 34], active: 0, pieces: [], supports: [], opened: [], anchor: -1 };
  const learn = () => {
    const m = fresh();
    m.evidence[0].walk = 1;
    for (const [i, [dx, dy]] of [[0, -1], [0, 1], [-1, 0], [1, 0]].entries())
      m.motors['ACTION' + (i + 1)] = { dx: dx!, dy: dy!, ref: 'direction measured' };
    return m;
  };
  const m = learn();
  const approach = planDisplacements(room, m, v, 'initial', 7, 100, 2)!;
  assert.equal(approach.motionPreparation?.steps, 1);
  assert.deepEqual(approach.target, [11]);
  const near: Reading = { ...v, subjects: [8, 34] };
  const boundary = planDisplacements(room, m, near, 'adjacent', 7, 100, 2)!;
  assert.equal(boundary.regionEntry?.site, 9);
  assert.deepEqual(boundary.regionEntry?.objectives, [11]);
  assert.equal(boundary.command, 'ACTION4');
  assert.equal(planDisplacements(room, learn(), near, 'stricter', 7, 100, 3)?.regionEntry, undefined);
  const blocked = learn();
  assert.equal(localEffects(room, blocked, near, near, boundary.command, 'closed', boundary), 'observed_ordinary_motion_at_the_boundary');
  assert.equal(planDisplacements(room, blocked, near, 'after failure', 7, 100, 2)?.regionEntry, undefined);
  const entered: Reading = { ...v, subjects: [9, 34] };
  assert.equal(localEffects(room, m, near, entered, boundary.command, 'open', boundary), 'entered_the_tested_boundary_site');
  const reused = planDisplacements(room, m, near, 'same shore', 7, 100, 2)!;
  assert.equal(m.planSolves, true);
  assert.equal(reused.expected.subjects[0], 9);
  assert.equal(reused.regionEntry, undefined);
  const decoy = { ...room, goals: [7, 34] };
  assert.equal(planDisplacements(decoy, learn(), near, 'empty region beyond', 7, 100, 2)?.regionEntry, undefined);
});

test('a verified selection enables a discriminating experiment before a paired model takes control', () => {
  const q = inquiry();
  q.scene = { ...s, ground: [7, 8, 10, 11, 34], other: [9], goals: [11, 34] };
  q.reading = { subjects: [8, 34], active: 0, pieces: [], supports: [], opened: [], anchor: -1 };
  q.learning.motors.ACTION4 = { dx: 1, dy: 0, ref: 'observed direction' };
  const controls = ['ACTION4'];
  assert.equal(compareAfterControl(q, 'now', 2, controls), undefined);
  q.controlProof = { selection: 'mark transferred', motion: 'selected body moved' };
  assert.equal(compareAfterControl(q, 'now', 3, controls), undefined);
  assert.equal(compareAfterControl(q, 'now', 2, ['ACTION2']), undefined);
  const test = compareAfterControl(q, 'now', 2, controls)!;
  assert.equal(test.command, 'ACTION4');
  assert.deepEqual(test.regionEntry?.objectives, [11]);
  assert.deepEqual(test.controlComparison, q.controlProof);
  assert.ok(test.evidence.includes(q.controlProof.selection) && test.evidence.includes(q.controlProof.motion));
  assert.equal(new Set(test.motionTest?.predictions.map(p => p.pose)).size, 2);
  assert.equal(q.active, undefined);
  q.active = 'existing inquiry';
  assert.equal(compareAfterControl(q, 'now', 2, controls), undefined);
});

test('an observed exchange opens a test of whether intervening terrain matters', () => {
  const room = { ...s, ground: s.ground.filter(site => site !== 16) };
  const origin: Reading = { subjects: [7, 34], active: 0, pieces: [9, 23], supports: [], opened: [], anchor: -1 };
  const after: Reading = { ...origin, subjects: [9, 34], pieces: [7, 23] };
  for (const requiresClearPath of [true, false]) {
    const m = fresh();
    m.motors.ACTION2 = { dx: 0, dy: 1, ref: 'direction measured' };
    localEffects(room, m, origin, after, 'ACTION4', 'exchange across open ground');
    assert.deepEqual(viableMotionLaws(m, 0), ['exchange', 'clear_path_exchange']);
    const test = unresolvedMotionTest(room, m, after, 'before barrier test', 2)!;
    assert.equal(test.command, 'ACTION2');
    const passed: Reading = { ...after, subjects: [23, 34], pieces: [7, 9] };
    assert.deepEqual(test.motionTest!.predictions.map(p => p.pose), [key(passed), key(after)]);
    assert.equal(unresolvedMotionTest(room, m, after, 'higher threshold', 3), undefined);
    const observed = requiresClearPath ? after : passed;
    localEffects(room, m, after, observed, test.command, 'measured across terrain', test);
    assert.equal(law(m, 0), requiresClearPath ? 'clear_path_exchange' : 'exchange');
    assert.equal(key(imagine(room, geometry(room), after, test.command, m, law(m, 0)) ?? after), key(observed));
  }
});

test('experiment on a previously confined partner without undoing the access that was just gained', () => {
  const room = { ...s, ground: [0, 14, 15, 16, 17, 18, 19, 20], goals: [6, 34] };
  const before: Reading = { subjects: [0, 14], active: 1, pieces: [], supports: [], opened: [], anchor: -1 };
  const exchanged: Reading = { ...before, subjects: [14, 0] };
  const available = ['ACTION1', 'ACTION4', 'ACTION6'];
  const q = inquiry();
  q.scene = room; q.active = 'two subjects registered'; q.reading = exchanged;
  q.selectionWitness = 'selection measured';
  const m = q.learning;
  m.motors.ACTION4 = { dx: 1, dy: 0, ref: 'east' };
  q.released = observeRelease(room, m, before, exchanged, 'exchanged');
  assert.equal(q.released?.before, 1);
  assert.equal(q.released?.after, 7);
  const selected = pairProposal(q, 'now', 6, 50, 2, available)!;
  assert.equal(selected.releasedAccess?.phase, 'select');
  assert.deepEqual(selected.expected.subjects, exchanged.subjects);
  const handoff: Reading = { ...exchanged, active: 0 };
  assert.equal(recordReleaseTest(m, q.released!, exchanged, handoff, selected, 'selection'), 'selected_the_released_subject_without_moving_either');
  q.reading = handoff;
  const test = pairProposal(q, 'selected', 6, 50, 2, available)!;
  assert.equal(test.command, 'ACTION4');
  const result: Reading = { ...handoff, subjects: [15, 0] };
  localEffects(room, m, handoff, result, test.command, 'result', test);
  assert.equal(recordReleaseTest(m, q.released!, handoff, result, test, 'result'), 'independent_motion_in_the_new_region_verified');
  assert.equal(m.denied[test.key], undefined);
  assert.equal(observeRelease(room, m, before, exchanged, 'same opportunity'), undefined);
  assert.equal(observeRelease(room, fresh(), handoff, result, 'same region'), undefined);
});
test('a visible landing becomes a prediction at another distance only after displacement', () => {
  const room: Scene = {
    ...s,
    other: [16],
    initial: Array(35).fill('4,4,4,4,4,4,4,4,4'),
    goals: [5, 6],
  };
  room.initial[16] = 'pivot';
  const before: Reading = {
    subjects: [0, 1],
    active: 0,
    pieces: [30],
    supports: [],
    opened: [],
    anchor: -1,
  };
  const tiles = [...room.initial];
  tiles[18] = '9,9,9,9,2,9,9,9,9';
  assert.deepEqual(
    recognizeProjection(room, before, before, tiles, 'no motion'),
    [],
  );
  const rules = recognizeProjection(
    room,
    before,
    { ...before, pieces: [18] },
    tiles,
    'observed',
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.subjectWitness, undefined);
  const later = { ...before, pieces: [23] };
  assert.deepEqual(applyImages(later, images(room, later, rules))?.pieces, [
    17,
  ]);
});
import {
  startPassage,
  recallProjectedPassage,
  projectedPassage,
  watchPassage,
} from '../src/sic/prepare-projected-passage.ts';
test('an imagined landing needs a visible indication on supported ground before the operation', () => {
  const room: Scene = {
    ...s,
    ground: [0, 1, 2, 7, 8, 9, 16, 18, 19, 25, 26],
    goals: [19, 26],
    other: [16],
    initial: Array(35).fill('2,2,2,2,2,2,2,2,2'),
  };
  room.initial[16] = 'pivot';
  const m = fresh(),
    v: Reading = {
      subjects: [2, 7],
      active: 0,
      pieces: [],
      supports: [],
      opened: [],
      anchor: -1,
    };
  m.motors['ACTION2'] = { dx: 0, dy: 1, ref: 'observed' };
  m.passage = startPassage(room);
  watchPassage(room, m, v, v, room.initial, 'observation', 'ACTION2');
  assert.notEqual(
    projectedPassage(room, m, v, 'observation', 20, 100)?.command,
    'ACTION5',
  );
  const image = room.initial.slice();
  image[18] = '2,4,2,4,4,4,2,4,2';
  watchPassage(room, m, v, v, image, 'indication', 'ACTION2');
  assert.equal(
    projectedPassage(room, m, v, 'indication', 20, 100)?.command,
    'ACTION5',
  );
  watchPassage(
    room,
    m,
    v,
    { ...v, subjects: [18, 7] },
    room.initial,
    'crossed',
    'ACTION5',
  );
  assert.equal(m.passage?.evidence, 'crossed');
  assert.deepEqual(m.passage?.orientation, [0, 3]);
});

test('switching the operator requires a reachable arrangement while the first subject stays put', () => {
  const room: Scene = {
    ...s,
    ground: [8, 10, 24, 34],
    goals: [24],
    other: [9, 20],
    initial: Array(35).fill('floor'),
  };
  room.initial[9] = 'striped fixture';
  room.initial[20] = 'round fixture';
  const v: Reading = {
    subjects: [34, 8], active: 0, pieces: [], supports: [], opened: [], anchor: -1,
  };
  const m = fresh();
  m.evidence = [{ walk: 2 }, { push: 2 }];
  m.motors.ACTION3 = { dx: -1, dy: 0, ref: 'walked left' };
  m.motors.ACTION4 = { dx: 1, dy: 0, ref: 'walked right' };
  m.projections = [{ pivotForm: 'striped fixture', from: 2, to: 1, ref: 'crossing observed' }];
  assert.equal(recallProjectedPassage(room, m, v, room.initial), undefined);
  m.visits[key(v)] = 2;
  assert.equal(recallProjectedPassage(room, m, v, room.initial), undefined);
  m.projections[0]!.subjectWitness = 'subject crossed';
  m.passage = recallProjectedPassage(room, m, v, room.initial);
  assert.equal(m.passage?.pivot, 9);
  const firstContact: Reading = { ...v, subjects: [8, 34] };
  watchPassage(room, m, firstContact, firstContact, room.initial, 'first subject blocked', 'ACTION4');
  const action = projectedPassage(room, m, v, 'seen', 8, 40);
  assert.deepEqual(action?.expected.subjects, v.subjects);
  assert.equal(action?.expected.active, 1);
  assert.ok(action?.evidence.includes('subject crossed'));
  assert.deepEqual(action?.projectedSetup, {
    operator: 1, pivot: 10, launch: 8, landing: 24, firstCommand: 'ACTION4',
  });
  const selected = { ...v, active: 1 as const };
  assert.equal(projectedPassage(room, m, selected, 'selection confirmed', 8, 40)?.command, 'ACTION4');
  watchPassage(room, m, selected, selected, room.initial, 'second subject also blocked', 'ACTION4');
  assert.equal(projectedPassage(room, m, v, 'same room, contact refuted', 8, 40), undefined);
});
