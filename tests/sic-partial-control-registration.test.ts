import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pairedScene,
  picture,
  readPair,
  pointCommand,
} from '../src/sic/paired-scene.ts';
import { carryPair, inquiry, proposeLessonTest, seePair } from '../src/sic/probe-paired-displacements.ts';
import type { VisualLayout } from '../src/sic/witnessed-preview-transfer.ts';

const layout: VisualLayout = {
  square: [{ at: [1, 1], box: [0, 0, 2, 2], form: 'square' }],
};
function frame(active: number, indicator: boolean) {
  const tiles = Array.from({ length: 15 }, () => Array<number>(9).fill(2));
  function body(site: number, ink: number, decorated: boolean) {
    const tile = tiles[site]!;
    for (const i of [1, 3, 4, 5, 7]) tile[i] = ink;
    if (decorated) {
      tile[0] = 11;
      tile[8] = 11;
    }
    if (active === site) tile[1] = 12;
  }
  body(1, 8, false);
  body(7, 5, true);
  if (indicator) body(3, 6, false);
  for (const site of [9, 11]) {
    tiles[site]!.fill(3);
    tiles[site]![4] = 2;
  }
  return Array.from({ length: 9 }, (_, y) =>
    Array.from(
      { length: 15 },
      (_, x) =>
        tiles[Math.floor(y / 3) * 5 + Math.floor(x / 3)]![
          (y % 3) * 3 + (x % 3)
        ]!,
    ),
  );
}
test('selection is measurable on a decorated substrate without any cargo', () => {
  const before = frame(1, false),
    after = frame(7, false);
  const s = pairedScene(layout, before)!;
  assert.deepEqual(s.bodies, [8, 5]);
  assert.equal(s.cargo, undefined);
  assert.deepEqual(readPair(s, picture(s.grid, before))?.pieces, []);
  const q = inquiry();
  seePair(q, layout, before, after, pointCommand(s.grid, 7), 'selection');
  assert.equal(q.reading?.active, 1);
  assert.equal(
    q.active,
    'selection_moves_a_distinctive_mark_between_stationary_subjects',
  );
});
test('a verified transfer can replace a look-alike while preserving the distinction between a guess and an observation', () => {
  const before = frame(1, true),
    after = frame(7, true);
  const q = inquiry();
  q.scene = pairedScene(layout, before, 3)!;
  assert.deepEqual(q.scene.bodies, [8, 6]);
  q.learning.evidence[1].push = 9;
  seePair(
    q,
    layout,
    before,
    before,
    pointCommand(q.scene.grid, 3),
    'no change',
  );
  assert.equal(q.active, undefined);
  seePair(
    q,
    layout,
    before,
    after,
    pointCommand(q.scene.grid, 7),
    'control transferred',
  );
  assert.deepEqual(q.scene.bodies, [8, 5]);
  assert.equal(q.reading?.active, 1);
  assert.notEqual(q.learning.evidence[1].push, 9);
});

test('a selection witness can be retested without a carried field or projection', () => {
  const before = frame(1, false), after = frame(7, false);
  const known = inquiry();
  const scene = pairedScene(layout, before)!;
  const click = pointCommand(scene.grid, 7);
  seePair(known, layout, before, after, click, 'mark moved to the clicked subject');
  known.learning.motors.ACTION1 = { dx: 0, dy: -1, ref: 'old movement' };
  const lesson = carryPair(known, 'completed the room')!;
  assert.equal(lesson.radius, 0);
  assert.equal(lesson.projections, undefined);
  assert.equal(proposeLessonTest(inquiry({ ...lesson, selectionWitness: undefined }), layout, before, 'new room'), undefined);
  for (const changed of [false, true]) {
    const q = inquiry(lesson);
    const proposal = proposeLessonTest(q, layout, before, 'new room')!;
    assert.equal(proposal.command, click);
    assert.ok(proposal.evidence.includes('mark moved to the clicked subject'));
    seePair(q, layout, before, changed ? after : before, click, 'selection tested', proposal);
    assert.equal(Boolean(q.active), changed);
    assert.deepEqual(q.learning.motors, {});
    assert.equal(proposeLessonTest(q, layout, before, 'later'), undefined);
  }
});
