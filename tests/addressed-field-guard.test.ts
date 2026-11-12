import assert from 'node:assert/strict';
import test from 'node:test';
import { AddressedFieldGuard, type AddressedFieldGuardProposal } from '../src/logos-engine/addressed-field-guard.ts';
import type { PublicFrameLike, PublicObservationLike } from '../src/logos-engine/linked-preparation.ts';

const observation = (overrides: Partial<PublicObservationLike> = {}): PublicObservationLike => ({
  observation_ref: 'obs-1',
  revision: 1,
  level_epoch: 2,
  levels_completed: 3,
  state: 'NOT_FINISHED',
  frame_hash: 'h1',
  available_action_refs: ['ACTION6'],
  entities: [],
  ...overrides,
});

const model = {
  palette: 7,
  mask: [[0, 0], [1, 0]] as const,
  exemplar: {
    position: [0, 1] as const,
    mask: [[0, 0]] as const,
    palette_value: 4,
    bbox: [0, 1, 0, 1] as const,
  },
  goal: {
    shadow: {
      position: [3, 1] as const,
      mask: [[0, 0]] as const,
      palette_value: 5,
      bbox: [3, 1, 3, 1] as const,
    },
  },
};

const proposal: AddressedFieldGuardProposal = {
  field_plan: { model },
  binding: { observation_ref: 'obs-1', level_epoch: 2, levels_completed: 3 },
  steps: [
    { action: { action_ref: 'ACTION6' }, from: [1, 2], to: [2, 2] },
    { action: { action_ref: 'ACTION6' }, from: [2, 2], to: [3, 2] },
  ],
};

function frame(): PublicFrameLike {
  return {
    frame_rows: [
      [0, 0, 0, 0, 0],
      [4, 0, 0, 5, 0],
      [0, 7, 7, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    level: 2,
    levels_completed: 3,
    state: 'NOT_FINISHED',
    frame_hash: 'h1',
    available_action_refs: ['ACTION6'],
  };
}

test('footprintMatches requires the complete bound palette footprint inside the board', () => {
  const rows = frame().frame_rows;
  assert.equal(AddressedFieldGuard.footprintMatches(rows, model, [1, 2]), true);
  assert.equal(AddressedFieldGuard.footprintMatches(rows, model, [2, 2]), false);
  assert.equal(AddressedFieldGuard.footprintMatches(rows, model, [-1, 2]), false);
});

test('before admits only the current bound level, observation, action, body and stable references', () => {
  const guard = new AddressedFieldGuard();
  assert.deepEqual(guard.before(proposal, 0, frame(), observation()), {
    admitted: true,
    reason: 'measured_receiver_reference_and_address_bound',
  });

  assert.equal(guard.before(proposal, 0, frame(), observation({ observation_ref: 'other' })).admitted, false);
  assert.equal(guard.before(proposal, 0, { ...frame(), available_action_refs: [] }, observation()).admitted, false);

  const changed = frame();
  const changedRows = changed.frame_rows.map(row => [...row]);
  changedRows[1]![3] = 9;
  assert.equal(guard.before(proposal, 0, { ...changed, frame_rows: changedRows }, observation()).admitted, false);
});

test('after seals immediately on an official boundary', () => {
  const guard = new AddressedFieldGuard();
  assert.deepEqual(
    guard.after(proposal, 0, observation(), observation({ level_epoch: 3 }), frame().frame_rows, frame().frame_rows),
    { matched: null, seal_prefix: true, reason: 'official_boundary' },
  );
});

test('after compares the frozen prediction and keeps a matched non-final prefix open', () => {
  const guard = new AddressedFieldGuard();
  const second = [
    [0, 0, 0, 0, 0],
    [4, 0, 0, 5, 0],
    [0, 0, 7, 7, 0],
    [0, 0, 0, 0, 0],
  ];
  assert.deepEqual(
    guard.after(proposal, 0, observation(), observation({ observation_ref: 'obs-2' }), frame().frame_rows, second),
    {
      matched: true,
      seal_prefix: false,
      reason: 'compare_stable_receiver_with_frozen_field_prediction',
    },
  );
});

test('after seals a mismatched or final step', () => {
  const guard = new AddressedFieldGuard();
  const rows = frame().frame_rows;
  assert.equal(guard.after(proposal, 0, observation(), observation({ observation_ref: 'obs-2' }), rows, rows).seal_prefix, true);

  const finalSecond = [
    [0, 0, 0, 0, 0],
    [4, 0, 0, 5, 0],
    [0, 0, 0, 7, 7],
    [0, 0, 0, 0, 0],
  ];
  const final = guard.after(proposal, 1, observation(), observation({ observation_ref: 'obs-2' }), rows, finalSecond);
  assert.equal(final.matched, true);
  assert.equal(final.seal_prefix, true);
});
