import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { observeSurfaceBoard, captureSurfaceContinuity, observeSurfaceReturn, completeSurfaceContinuity } from '../scripts/sic-surface-continuity.mjs';

const run = JSON.parse(gunzipSync(readFileSync(new URL('../docs/diagnostics/sic-surface-goal-access-20261127/public-map-level5-before.json.gz', import.meta.url))));
const sample = run.samples[2], roles = run.roles;
const paint = (rows, cell, color) => {
  const x = roles.origin[0] + cell[0] * roles.pitch + 1, y = roles.origin[1] + cell[1] * roles.pitch + 1;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) rows[y + dy][x + dx] = color;
};

test('surface observer independently locates every actor and surface in the public failure replay', () => {
  for (const entry of run.samples) {
    assert.deepEqual(observeSurfaceBoard(entry.before.frame, roles)?.address, entry.first.address);
    assert.deepEqual(observeSurfaceBoard(entry.after.frame, roles)?.address, entry.returned.address);
  }
});

test('surface observer preserves missing and ambiguous public actors', () => {
  const missing = structuredClone(sample.before.frame);
  paint(missing, sample.first.address.cell, roles.support);
  assert.equal(observeSurfaceBoard(missing, roles), null);
  const ambiguous = structuredClone(sample.before.frame);
  const cell = sample.first.surface.free.map(value => value.split(',').map(Number))
    .find(value => value.join(',') !== sample.first.address.cell.join(','));
  paint(ambiguous, cell, roles.actor);
  assert.equal(observeSurfaceBoard(ambiguous, roles), null);
});

test('surface evidence distinguishes predicted destinations and actual returns and reads acquisition only at closure', () => {
  const step = sample.plan, actionRef = 'ACTION' + sample.action.id;
  const proposal = { kind: 'sic_switched_surface', actions: [{ action_ref: actionRef }], binding: { level_epoch: 5 },
    transfer: { roles, view: sample.first, walk: [step], local: { memory: sample.memoryBefore, refs: ['local'] } }, route_refs: ['current'] };
  const state = { witness: { epoch: 5, score: 4, refs: ['role'] }, mapped: { epoch: 5, refs: ['before', 'after'],
    memory: { steps: { [sample.first.address.floor + '/' + sample.first.address.cell.join(',') + '/' + step.direction]: sample.returned.address } } } };
  const capture = captureSurfaceContinuity(proposal, { actionIndex: 0, actionRef, observationRef: 'before', levelsCompleted: 4 }, sample.before.frame, state);
  assert.ok(capture); assert.equal(capture.expectedTo, null);
  const observed = observeSurfaceReturn(capture, sample.after.frame);
  assert.deepEqual(observed.after.address, sample.returned.address);
  assert.notEqual(observed.before.address.floor, observed.after.address.floor);
  let reads = 0;
  const owner = () => { reads++; return state; };
  assert.equal(completeSurfaceContinuity(observed, owner, { sealCount: 0 }, 4).acquisition, null);
  assert.equal(reads, 0);
  const complete = completeSurfaceContinuity(observed, owner, { sealCount: 1, outcome: { observation_ref: 'after' } }, 4);
  assert.equal(reads, 1); assert.deepEqual(complete.acquisition.step, observed.after.address);
  const stationary = observeSurfaceReturn(capture, sample.before.frame);
  assert.deepEqual(stationary.after.address, stationary.before.address, 'A prediction never substitutes for the public return');
});
