import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const proofPath = 'docs/recovery/lot9c3-public-stck-joint-report.json';

async function proof() {
  return JSON.parse(await readFile(proofPath, 'utf8'));
}

test('Lot 9C3 durable proof identifies the real public STCK unique-card corpus', async () => {
  const value = await proof();
  assert.equal(value.corpus, 'real-public-stck-level-1-seed-0-unique-card-state');
  assert.equal(value.archive, 'public/python/custom-games.zip');
  assert.equal(value.game, 'STCK');
  assert.equal(value.gameId, 'stck-c0000001');
  assert.equal(value.seed, 0);
  assert.equal(value.selectedObservationSequence, 3);
});

test('Lot 9C3 proof keeps the ambiguity-reducing public prelude explicit', async () => {
  const value = await proof();
  assert.equal(value.publicPrelude.producer, 'region-public-action6-probe-v1');
  assert.equal(value.publicPrelude.actionCount, 3);
  assert.deepEqual(
    value.publicPrelude.actions.map(item => item.action),
    Array.from({ length: 3 }, () => ({ id: 6, data: { x: 4, y: 52 } })),
  );
  assert.deepEqual(
    value.publicPrelude.actions.map(item => item.changedPixelCount),
    [211, 138, 95],
  );
});

test('Lot 9C3 proof requires both distinct public channels', async () => {
  const value = await proof();
  assert.deepEqual(value.channels, [
    'public_stck_action_availability_v1',
    'public_stck_visible_target_v1',
  ]);
  assert.equal(value.jointAssessment.status, 'joint');
  assert.deepEqual(value.jointAssessment.channelIds, value.channels);
  assert.deepEqual(value.acquisitionChannels, value.channels);
  assert.equal(value.causalRemoval.availabilityMissingAction, null);
  assert.equal(value.causalRemoval.targetMissingAction, null);
});

test('Lot 9C3 proof preserves the unique public card action and observed return effect', async () => {
  const value = await proof();
  assert.deepEqual(value.selectedAction, { id: 6, data: { x: 4, y: 50 } });
  assert.equal(value.selectedTargetKind, 'stack_card');
  assert.equal(value.selectedTargetEvidenceRef, 'public-stck-stack-card:14:48-52');
  assert.equal(value.nextAction, null);
  assert.equal(value.nextTargetKind, null);
  assert.equal(value.nextDisposition, 'no_unique_stack_card');
  assert.equal(value.changedPixelCount, 64);
  assert.ok(value.changedPixelCount > 0);
});
