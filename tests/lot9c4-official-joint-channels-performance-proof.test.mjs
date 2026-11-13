import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const proofPath = 'docs/recovery/lot9c4-official-joint-channels-performance-proof.json';

async function proof() {
  return JSON.parse(await readFile(proofPath, 'utf8'));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function relativeIncrease(reference, candidate) {
  return ((candidate - reference) / reference) * 100;
}

function approximately(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

test('Lot 9C4 proof freezes the accepted official run and artifact', async () => {
  const value = await proof();
  assert.equal(value.version, 1);
  assert.equal(value.status, 'official-performance-qualified');
  assert.equal(value.accepted, true);
  assert.equal(value.benchmark, 'lot9c4-strict-joint-channels-v1');
  assert.equal(value.generatedFromCommit, 'f98f490359908fd30e2177d819b98fdd958f6f20');
  assert.deepEqual(value.github, {
    runId: 43366962676,
    jobId: 131693534425,
    artifactId: 14010801556,
    artifactName: 'lot9c4-official-strict-joint-channels-abba',
    artifactDigest: 'sha256:9b85ab0a249da7b1f7e0362eb190bcc5ad6c768d04c8cea26f8e464c10826a1f',
    rawReportSha256: 'sha256:bff263b416755eddcbbb3f16f8aef03c31c51535283f3c58d44d6c53f9c31566',
  });
});

test('Lot 9C4 proof preserves the complete strict ABBA protocol', async () => {
  const value = await proof();
  assert.deepEqual(value.protocol.seriesOrder, ['A1', 'B1', 'B2', 'A2']);
  assert.deepEqual(value.protocol.variantBySeries, {
    A1: 'A', B1: 'B', B2: 'B', A2: 'A',
  });
  assert.equal(value.protocol.invocations, 40);
  assert.equal(value.protocol.warmupSessions, 8);
  assert.equal(value.protocol.measuredSessions, 32);
  assert.equal(value.protocol.warmupActions, 24);
  assert.equal(value.protocol.measuredActions, 400);
  assert.equal(value.protocol.thresholdPercent, 10);
  assert.equal(value.protocol.thresholdIsStrict, true);
  assert.equal(value.protocol.phaseOverrunIsBlocking, false);
  assert.equal(value.protocol.crossGameCompensationAllowed, false);
  assert.equal(value.protocol.measuredSampleRemovalAllowed, false);
  assert.equal(value.protocol.sampleRemoval, 0);
  assert.equal(value.protocol.retries, 0);
});

test('Lot 9C4 source identities isolate only the joint-channel candidate seam', async () => {
  const value = await proof();
  assert.equal(value.sourceRefs.contract, 'lot9c4-strict-joint-source-identity-v1');
  assert.notEqual(value.sourceRefs.reference, value.sourceRefs.candidate);
  assert.equal(value.runnerIdentities.A.STCK.jointChannels, 'disabled');
  assert.equal(value.runnerIdentities.A.SMLP.jointChannels, 'disabled');
  assert.equal(value.runnerIdentities.B.STCK.jointChannels, 'strict-unique-card');
  assert.equal(value.runnerIdentities.B.SMLP.jointChannels, 'qualified-row-major-gate');
  assert.match(value.runnerIdentities.invariant, /only B executes/);
  assert.equal(value.corpus.id, 'lot9c4-strict-public-joint-corpus-v1');
  assert.deepEqual(value.corpus.games, ['STCK', 'SMLP']);
  assert.equal(value.corpus.seed, 0);
  assert.equal(value.corpus.startLevel, 1);
});

test('Lot 9C4 proof retains all measured sessions and passes each game independently', async () => {
  const value = await proof();
  for (const game of ['STCK', 'SMLP']) {
    const result = value.games[game];
    assert.equal(result.referenceDurationsMs.length, 8);
    assert.equal(result.candidateDurationsMs.length, 8);
    const referenceMedian = median(result.referenceDurationsMs);
    const candidateMedian = median(result.candidateDurationsMs);
    const increase = relativeIncrease(referenceMedian, candidateMedian);
    approximately(referenceMedian, result.referenceMedianMs, `${game} reference median`);
    approximately(candidateMedian, result.candidateMedianMs, `${game} candidate median`);
    approximately(increase, result.relativeIncreasePercent, `${game} relative increase`);
    assert.ok(increase < 10, `${game} must remain strictly below +10%`);
    assert.equal(result.accepted, true);
  }
  assert.equal(value.games.STCK.relativeIncreasePercent, 5.5555555555270475);
  assert.equal(value.games.SMLP.relativeIncreasePercent, -0.10070493453666618);
});

test('Lot 9C4 proof demonstrates actual decision and acquisition coverage', async () => {
  const value = await proof();
  assert.deepEqual(value.candidateStats.STCK, {
    decisions: 86,
    acquisitions: 86,
    targetCycles: 86,
    excludedPreludeActions: 258,
    completedProtocolSessions: 10,
  });
  assert.deepEqual(value.candidateStats.SMLP, {
    decisions: 126,
    acquisitions: 126,
    targetCycles: 126,
    excludedPreludeActions: 0,
    completedProtocolSessions: 10,
  });
  assert.equal(value.corpus.stck.excludedPreludeActionsPerTarget, 3);
  assert.deepEqual(value.corpus.stck.excludedPreludeChangedPixels, [211, 138, 95]);
  assert.deepEqual(value.corpus.stck.targetAction, { id: 6, x: 4, y: 50 });
  assert.equal(value.corpus.stck.targetChangedPixels, 64);
  assert.equal(value.corpus.smlp.targetChangedPixels, 9);
});

test('Lot 9C4 proof closes only the reconstructed scope', async () => {
  const value = await proof();
  assert.deepEqual(value.disposition, {
    historicalParityClaimed: false,
    counter76Incremented: false,
    sitePublished: false,
    lot9cComplete: true,
    nextStep: 'rebuild current reconstruction registry before count claims',
  });
});
