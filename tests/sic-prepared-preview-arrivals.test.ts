import { newPreviewLearning, type PreviewWitness } from '../src/sic/witnessed-preview-transfer.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  newOccupancyMemory,
  observePoses,
  offerPreparedPreview,
  offerOccupancy,
  finishOccupancy,
} from '../src/sic/occupancy-programs.ts';
const allowed = new Set(['west', 'south', 'read', 'walk']);
const pose = (p: number, r: number, y = 4) => ({
  subject: [p, 4] as [number, number],
  mark: [r, y] as [number, number],
});
function sample() {
  const m = newOccupancyMemory();
  observePoses(m, 0, 1, pose(8, 2), pose(8, 1), 'west', 2);
  observePoses(m, 2, 3, pose(8, 3), pose(8, 3, 5), 'south', 4);
  observePoses(m, 4, 5, pose(8, 5), pose(5, 8), 'read', 6);
  observePoses(m, 6, 7, pose(12, 15), pose(13, 15), 'walk', 8);
  observePoses(m, 8, 9, pose(13, 15), pose(14, 15), 'walk', 10);
  m.layouts[10] = pose(8, 5);
  return m;
}
test('precommits distinct future marks and a continuation before the preparation', () => {
  const m = sample(),
    first = offerPreparedPreview(m, 10, allowed, 20, 20)?.occupancy;
  assert.ok(first);
  const plan = first.plan,
    detail = plan.preparedPreview!;
  assert.equal(detail.directBasis, 'witnessed_at_this_pose');
  assert.deepEqual(detail.direct, [5, 4]);
  assert.equal(detail.alternatives.length, 2);
  assert.deepEqual(detail.alternatives.map((c) => c.arrival).sort(), [
    [4, 4],
    [5, 5],
  ]);
  const [write, read, use] = plan.steps;
  assert.ok(write && read && use);
  assert.deepEqual(write.nextP, write.p);
  assert.deepEqual(write.nextR, read.nextP);
  assert.deepEqual(use.nextP, [read.nextP[0] + 1, read.nextP[1]]);
  const written = { subject: write.p, mark: write.nextR! };
  observePoses(m, 10, 11, m.layouts[10]!, written, write.op, 11);
  assert.equal(finishOccupancy(m, first, written, true, false, 11).matched, true);
  const second = offerOccupancy(m, 11, allowed, 20, 20)!.occupancy!;
  assert.equal(second.index, 1);
  assert.deepEqual(second.plan.preparedPreview, detail);
  const arrived = { subject: read.nextP, mark: write.p };
  observePoses(m, 11, 12, written, arrived, read.op, 12);
  assert.equal(finishOccupancy(m, second, arrived, true, false, 12).matched, true);
  const third = offerOccupancy(m, 12, allowed, 20, 20)!.occupancy!;
  assert.equal(third.index, 2);
  assert.equal(finishOccupancy(m, third, { subject: use.nextP }, true, false, 13).matched, true);
});
test('a motionless control contradicts the proposed indicator displacement and a failed preparation stops the plan', () => {
  const m = sample();
  observePoses(m, 13, 13, pose(10, 12), pose(10, 12), 'west', 11);
  const first = offerPreparedPreview(m, 10, allowed, 20, 20)!.occupancy!;
  assert.deepEqual(
    first.plan.preparedPreview!.alternatives.map((c) => c.write),
    ['south']
  );
  assert.equal(finishOccupancy(m, first, pose(8, 5), true, false, 12).matched, false);
  assert.equal(m.active, null);
  assert.notEqual(offerPreparedPreview(m, 10, allowed, 20, 20)?.occupancy?.plan.key, first.plan.key);
});
test('keeps an earlier-level read separate from the current evidence for moving its mark', () => {
  const mem = newOccupancyMemory();
  observePoses(mem, 0, 1, pose(8, 2), pose(8, 1), 'west', 15);
  mem.layouts[2] = pose(8, 5);
  const proof: PreviewWitness = {
    before: 'run:epoch:1:revision:2:frame:old',
    after: 'run:epoch:1:revision:3:frame:new',
    epoch: 1,
    command: 'read',
    from: [8, 4],
    arrived: [5, 4],
    indicated: [5, 4],
    peers: [],
    fromBox: [4, 2, 4, 2],
    arrivedBox: [2, 2, 3, 2],
    indicatorForm: 'mark',
    subjectForm: 'subject',
    indicatorChanged: true,
  };
  const learning = newPreviewLearning();
  learning.bindings['role/mark'] = {
    relation: 'indicator_marks_subject_arrival_after_action',
    actor: 'subject',
    indicator: 'mark',
    gesture: { op: 'read' },
    witnesses: [proof],
  };
  const job = offerPreparedPreview(mem, 2, allowed, 20, 20, undefined, {
    epoch: 2,
    memory: learning,
  })!.occupancy!;
  assert.equal(job.plan.preparedPreview?.priorRead?.before, proof.before);
  assert.deepEqual(job.plan.refs, [15]);
  assert.deepEqual(job.plan.landing, [4, 4]);
});
test('prefers a modeled disconnected region to an ordinary new position for the same subject', () => {
  const m = sample(),
    foreign = {
      role: 'subject',
      homeSize: 6,
      outsideSize: 4,
      contains: (site: [number, number]) => site[0] === 4 && site[1] === 4,
    };
  const best = offerPreparedPreview(m, 10, allowed, 20, 20, foreign)!.occupancy!.plan;
  assert.equal(best.steps[0]!.op, 'west');
  assert.equal(best.preparedPreview?.alternatives[0]?.opensMeasuredRegion, true);
  assert.equal(
    offerPreparedPreview(m, 10, allowed, 20, 20, { ...foreign, role: 'other' })!.occupancy!.plan.steps[0]!.op,
    'south'
  );
});
