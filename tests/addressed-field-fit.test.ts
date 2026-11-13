import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filled,
  fitAddressedField,
  targetCandidates,
  transientContour,
  type AddressedFieldFitEntity,
} from '../src/logos-engine/addressed-field-fit.ts';
import type { PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const entity = (overrides: Partial<AddressedFieldFitEntity> = {}): AddressedFieldFitEntity => ({
  signature: 'body',
  position: [1, 1],
  bbox: [1, 1, 1, 1],
  mask: [[0, 0]],
  palette_value: 2,
  rectangular: true,
  ...overrides,
});

const observation = (ref: string, entities: readonly AddressedFieldFitEntity[]): PublicObservationLike => ({
  observation_ref: ref,
  revision: 1,
  level_epoch: 1,
  levels_completed: 0,
  state: 'NOT_FINISHED',
  frame_hash: ref,
  available_action_refs: ['ACTION6'],
  entities,
});

test('filled returns wall plus interior, matching the donor helper before wall subtraction', () => {
  const wall = [
    [0, 0], [1, 0], [2, 0],
    [0, 1],         [2, 1],
    [0, 2], [1, 2], [2, 2],
  ] as const;
  assert.deepEqual([...filled(wall, 3, 3)].sort(), ['0,0','0,1','0,2','1,0','1,1','1,2','2,0','2,1','2,2']);
});

test('targetCandidates requires same silhouette, different palette and centered containment', () => {
  const mobile = entity({ position: [1, 1], bbox: [1, 1, 1, 1], palette_value: 2 });
  const shadow = entity({ signature: 'shadow', position: [4, 4], bbox: [4, 4, 4, 4], palette_value: 3 });
  const enclosure = entity({
    signature: 'frame',
    position: [3, 3],
    bbox: [3, 3, 5, 5],
    palette_value: 8,
    mask: [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]],
  });
  const rows = Array.from({ length: 7 }, () => Array(7).fill(0));
  assert.deepEqual(targetCandidates(observation('o', [mobile, shadow, enclosure]), mobile, rows), [{ shadow, enclosure }]);
});

test('transientContour keeps only a disappearing centered square indicator', () => {
  const first = Array.from({ length: 5 }, () => Array(5).fill(0));
  const initial = first.map(row => [...row]);
  for (let i = 1; i <= 3; i += 1) {
    initial[1]![i] = 9; initial[3]![i] = 9; initial[i]![1] = 9; initial[i]![3] = 9;
  }
  const last = first.map(row => [...row]);
  const indicator = transientContour(first, [initial, last], [2, 2]);
  assert.equal(indicator?.palette, 9);
  assert.equal(indicator?.axis_extent, 1);
  assert.deepEqual(indicator?.first_box, [1, 1, 3, 3]);
});

test('fitAddressedField acquires one uniquely supported addressed model', () => {
  const old = entity({ position: [1, 1], bbox: [1, 1, 1, 1], palette_value: 2 });
  const next = entity({ position: [2, 1], bbox: [2, 1, 2, 1], palette_value: 2 });
  const exemplar = entity({ signature: 'body', position: [1, 4], bbox: [1, 4, 1, 4], palette_value: 2 });
  const shadow = entity({ signature: 'shadow', position: [4, 4], bbox: [4, 4, 4, 4], palette_value: 3 });
  const enclosure = entity({
    signature: 'frame', position: [3, 3], bbox: [3, 3, 5, 5], palette_value: 8,
    mask: [[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2]],
  });
  const before = observation('before', [old, exemplar, shadow, enclosure]);
  const after = observation('after', [next, exemplar, shadow, enclosure]);
  const rows = Array.from({ length: 7 }, () => Array(7).fill(0));
  const result = fitAddressedField(
    before,
    after,
    { action_ref: 'ACTION6', data: { x: 2, y: 1 } },
    rows,
    rows,
    null,
    () => ({ candidates: [{ before: old, after: next, stationary_same_signature: [exemplar], identity_status: 'unique' }], unresolved: [] }),
  );
  assert.equal(result?.model.signature, 'body');
  assert.deepEqual(result?.model.offset, [0, 0]);
  assert.deepEqual(result?.model.position, [2, 1]);
  assert.equal(result?.model.action_ref, 'ACTION6');
  assert.equal(result?.event.kind, 'addressed_field_candidate');
  assert.equal(result?.event.goal_status, 'centered_homologue_hypothesis');
});

test('fitAddressedField refuses an ambiguous or out-of-body acquisition', () => {
  const old = entity();
  const next = entity({ position: [2, 1], bbox: [2, 1, 2, 1] });
  const rows = Array.from({ length: 5 }, () => Array(5).fill(0));
  const before = observation('before', [old]);
  const after = observation('after', [next]);
  assert.equal(
    fitAddressedField(before, after, { action_ref: 'ACTION6', data: { x: 4, y: 4 } }, rows, rows, null,
      () => ({ candidates: [{ before: old, after: next, stationary_same_signature: [old] }], unresolved: [] })),
    null,
  );
});
