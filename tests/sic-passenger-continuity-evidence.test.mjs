import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { capturePassengerContinuity, observePassengerReturn, completePassengerContinuity,
  passengerArrangementMeasured } from '../scripts/sic-passenger-continuity.mjs';

const capture = JSON.parse(gunzipSync(readFileSync(new URL(
  '../docs/diagnostics/sic-guarded-passenger-continuity-20261127/first-public-prefix.json.gz', import.meta.url))));
const samples = capture.publicEvidence.filter(sample => sample.proposal.guarded?.plan[0]?.role === 'move');
const ticket = sample => ({ actionIndex: 0, actionRef: 'ACTION' + sample.action.id,
  observationRef: sample.nativeObservation.observation_ref, levelsCompleted: sample.publicBefore.levelsCompleted });

for (const loaded of [false, true]) test('passive passenger observer measures a real ' + (loaded ? 'loaded' : 'empty') + ' movement', async () => {
  const sample = samples.find(item => (item.proposal.guarded.at.held !== null) === loaded);
  assert.ok(sample);
  const original = structuredClone(sample.proposal);
  const before = await capturePassengerContinuity(sample.proposal, ticket(sample), sample.publicBefore.frame);
  assert.ok(before);
  assert.ok(passengerArrangementMeasured(before.before, before.expectedFrom, before.cargo));
  const after = await observePassengerReturn(before, sample.publicAfter.frame, sample.publicAfter.levelsCompleted);
  assert.ok(passengerArrangementMeasured(after.after, after.expectedTo, after.cargo));
  assert.deepEqual(sample.proposal, original, 'Passive evidence cannot update the native proposal');
  assert.equal(after.geometry, undefined, 'Observer geometry is local instrumentation');
  if (loaded) assert.deepEqual(after.after.carried.box, after.before.carried.box.map((value, axis) => value + after.motion[axis % 2]));
});

test('passive passenger evidence retains missing and duplicate actors instead of a predicted landing', async () => {
  const sample = samples[0], initial = await capturePassengerContinuity(sample.proposal, ticket(sample), sample.publicBefore.frame);
  const body = sample.nativeObservation.entities.find(item => item.signature === sample.proposal.guarded.ferry.model.actor);
  assert.ok(body);
  const missing = structuredClone(sample.publicBefore.frame);
  for (let y = body.bbox[1]; y <= body.bbox[3]; y++) for (let x = body.bbox[0]; x <= body.bbox[2]; x++) {
    if (missing[y][x] === body.palette_value) missing[y][x] = sample.publicBefore.frame[0][0];
  }
  const absent = await capturePassengerContinuity(sample.proposal, ticket(sample), missing);
  assert.equal(absent.before.actor, null);
  assert.equal(passengerArrangementMeasured(absent.before, initial.expectedFrom, initial.cargo), false);
  const duplicate = structuredClone(sample.publicBefore.frame);
  for (let y = body.bbox[1]; y <= body.bbox[3]; y++) for (let x = body.bbox[0]; x <= body.bbox[2]; x++) {
    if (sample.publicBefore.frame[y][x] === body.palette_value) duplicate[y + 25][x] = body.palette_value;
  }
  const ambiguous = await capturePassengerContinuity(sample.proposal, ticket(sample), duplicate);
  assert.equal(ambiguous.before.actor, null);
  assert.equal(passengerArrangementMeasured(ambiguous.before, initial.expectedFrom, initial.cargo), false);
});

test('passive passenger acquisition is read once after a native seal', async () => {
  const sample = samples[0], captured = await capturePassengerContinuity(sample.proposal, ticket(sample), sample.publicBefore.frame);
  const observed = await observePassengerReturn(captured, sample.publicAfter.frame, sample.publicAfter.levelsCompleted);
  let reads = 0;
  const read = () => { reads++; return { guarded: { epoch: 5, frame: 'actual-return', at: captured.expectedTo,
    refs: ['actual-return-ref'], hazards: [], hazardRefs: [] } }; };
  const intermediate = completePassengerContinuity(observed, read, { sealCount: 0, outcome: { observation_ref: 'actual-return-ref' } });
  assert.equal(reads, 0); assert.equal(intermediate.acquisition, null);
  const final = completePassengerContinuity(observed, read, { sealCount: 1, outcome: { observation_ref: 'actual-return-ref' } });
  assert.equal(reads, 1); assert.deepEqual(final.acquisition.at, captured.expectedTo);
  const unavailable = completePassengerContinuity(observed, () => { throw Error('unavailable'); }, { sealCount: 1 });
  assert.equal(unavailable.acquisition, null);
});

test('passive passenger acquisition keeps the official boundary separate from the next board', async () => {
  const sample = samples[0], captured = await capturePassengerContinuity(sample.proposal, ticket(sample), sample.publicBefore.frame);
  const observed = await observePassengerReturn(captured, sample.publicAfter.frame, captured.scoreBefore + 1);
  assert.equal(observed.boundary, true); assert.equal(observed.after, null);
});
