import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { median } from '../scripts/measure-native-loop-costs.mjs';

const proofPath = 'docs/recovery/lot9b-official-abba-performance-qualified.json';
const NUMERIC_TOLERANCE = 1e-9;

function delta(candidate, reference) {
  return 100 * (candidate / reference - 1);
}

function assertApproximatelyEqual(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= NUMERIC_TOLERANCE,
    `${label}: actual=${actual}, expected=${expected}`,
  );
}

test('official Lot 9B proof recomputes both strict per-game passes from every retained sample', async () => {
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  assert.equal(proof.status, 'official-performance-qualified');
  assert.equal(proof.accepted, true);
  assert.equal(proof.protocol.measuredSessions, 32);
  assert.equal(proof.protocol.measuredActions, 400);
  assert.equal(proof.protocol.warmupActions, 24);
  assert.equal(proof.protocol.sampleRemoval, 0);
  assert.equal(proof.protocol.retries, 0);

  for (const game of ['STCK', 'SMLP']) {
    const value = proof.games[game];
    assert.equal(value.referenceDurationsMs.length, 8);
    assert.equal(value.candidateDurationsMs.length, 8);
    const referenceMedian = median(value.referenceDurationsMs);
    const candidateMedian = median(value.candidateDurationsMs);
    const relativeIncreasePercent = delta(candidateMedian, referenceMedian);
    assertApproximatelyEqual(referenceMedian, value.referenceMedianMs, `${game} reference median`);
    assertApproximatelyEqual(candidateMedian, value.candidateMedianMs, `${game} candidate median`);
    assertApproximatelyEqual(
      relativeIncreasePercent,
      value.relativeIncreasePercent,
      `${game} relative increase`,
    );
    assert.ok(relativeIncreasePercent < 10, `${game} must remain strictly below +10%`);
    assert.equal(value.accepted, true);
  }

  assert.ok(proof.games.SMLP.candidateDurationsMs.includes(591.1));
  assert.equal(proof.games.SMLP.retainedOutlier.removed, false);
  assert.equal(proof.disposition.counter76Incremented, false);
  assert.equal(proof.disposition.nextLot, '9C joint_channels');
});

test('official proof retains all Region acquisitions', async () => {
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  assert.deepEqual(proof.candidateRegion.STCK, {
    actionsSeen: 86,
    action6Seen: 86,
    usefulEvidence: 86,
    boundEvidence: 86,
    acquisitions: 86,
    methods: 86,
  });
  assert.deepEqual(proof.candidateRegion.SMLP, {
    actionsSeen: 126,
    action6Seen: 126,
    usefulEvidence: 126,
    boundEvidence: 126,
    acquisitions: 126,
    methods: 126,
  });
});
