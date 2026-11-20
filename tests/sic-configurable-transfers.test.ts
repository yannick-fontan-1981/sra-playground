import test from 'node:test';
import assert from 'node:assert/strict';
import type { NativeEntity, NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import { initialMemory, recordExperiment, selectExperiment } from '../src/sic/preparation-experiments.ts';

const grid = Array.from({ length: 4 }, () => Array(20).fill(0));
const op = (i: number) => ({ action_ref: 'ACTION' + i, data: {} });
const controls = [op(1), op(2), op(3)];
function scene(revision: number, x: number, sites: number[]): NativeObservation {
  const object = (id: string, x: number, width: number): NativeEntity => ({
    id,
    signature: id,
    position: [x, 1],
    bbox: [x, 1, x + width - 1, 1],
    mask: Array.from({ length: width }, (_, i) => [i, 0] as [number, number]),
    area: width,
    scale: 1,
    palette_value: 2,
    rectangular: true,
    identity_ambiguous: false,
    identity_scope: 'observed',
  });
  return {
    revision,
    level_epoch: 1,
    frame_hash: [x, sites].join('/'),
    observation_ref: 'r' + revision,
    coordinate_basis: 'screen',
    entities: [object('traveller', x, 3), ...sites.map((p) => object('mark' + p, p, 1))],
    available_action_refs: controls.map((c) => c.action_ref),
    state: 'NOT_FINISHED',
    levels_completed: 0,
    unknowns: [],
    provenance: 'public',
  };
}
test('derives a new destination from independently configured sites and tests its next use', () => {
  const m = initialMemory(1);
  let before = scene(1, 2, []);
  const step = (i: number, after: NativeObservation, trial?: ReturnType<typeof selectExperiment>) => {
    const r = recordExperiment(m, before, after, op(i), grid, grid, trial ?? undefined);
    before = after;
    return r;
  };
  step(1, scene(2, 3, []));
  step(2, scene(3, 3, [5]));
  step(3, scene(4, 3, [5, 13]));
  const chosen = selectExperiment(m, before, controls, true, grid);
  assert.equal(chosen?.transfer?.plan.steps[0]?.stage, 'cross');
  assert.deepEqual(chosen?.transfer?.plan.desired, [12, 1]);
  assert.equal(step(1, scene(5, 12, [5, 13]), chosen)?.result, 'configured_cross_verified');
  const use = selectExperiment(m, before, controls, true, grid);
  assert.equal(use?.transfer?.plan.steps[use.transfer.index]?.stage, 'use');
  assert.equal(step(1, scene(6, 13, [5, 13]), use)?.result, 'configured_use_verified');
  assert.equal(m.transfers?.active, null);
});
test('one simultaneous appearance supplies no independent pair of interventions', () => {
  const m = initialMemory(1),
    a = scene(1, 2, []),
    b = scene(2, 3, []),
    c = scene(3, 3, [5, 13]);
  recordExperiment(m, a, b, op(1), grid, grid);
  recordExperiment(m, b, c, op(2), grid, grid);
  assert.equal(selectExperiment(m, c, controls, true, grid)?.transfer, undefined);
});
