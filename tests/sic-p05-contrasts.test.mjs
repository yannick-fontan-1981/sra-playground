import assert from 'node:assert/strict';
import test from 'node:test';
import { compareP05IndiscerniblePair, p05ContrastActions, runP05Contrasts } from '../scripts/sic-p05-contrasts.mjs';
import { generateP05Situation, randomSource } from '../scripts/sic-p05-laboratory.mjs';

test('development contrast registers stay outside quotas and distinguish abstention from stationary scalar effects', () => {
  const report = runP05Contrasts({ seed: 26112805, countPerKind: 4 });
  assert.equal(report.firstFailure, null);
  assert.equal(report.config.mainQuotaContribution, 0);
  assert.equal(report.config.sealedOperatorCasesGenerated, 0);
  assert.equal(report.config.sealedNativeGamesTested, 0);
  assert.equal(report.indiscernible.tested, 4);
  assert.equal(report.indiscernible.worlds, 8);
  assert.equal(report.indiscernible.verifiedPairs, 4);
  assert.equal(report.indiscernible.justifiedAbstentions, 4);
  assert.equal(report.indiscernible.futureDivergenceWitnesses, 4);
  assert.equal(report.indiscernible.publicHistoryPrefixes, report.indiscernible.abstainingPrefixes);
  assert.equal(report.indiscernible.publicHistoryPrefixes, report.indiscernible.simulatorAgreementPrefixes);
  assert.equal(report.stationary.tested, 4);
  assert.equal(report.stationary.oracleNoEffect, 4);
  assert.equal(report.stationary.justifiedAbstentions, 4);
  assert.equal(report.stationary.noGlobalCommandBlacklist, 4);
  assert.ok(report.stationary.stationaryReturnIds > 0);
  assert.equal(report.stale.tested, 4);
  assert.equal(report.stale.justifiedAbstentions, 4);
  assert.equal(report.stale.oldProofsRetainedSeparately, 4);
  assert.equal(report.stale.currentAcquisitions, 0);
  assert.ok(report.stale.unconfirmedRecallScopes.every(item => item.newObservations === 0 && item.recalls.length > 0));
  assert.equal(report.scalarEffects.tested, 2);
  assert.equal(report.scalarEffects.correctlyAcquired, 2);
  assert.equal(report.scalarEffects.geometricStationarityPreserved, 2);
});

test('indiscernibility enumerates the entire public action tree, not only a selected witness', () => {
  const left = generateP05Situation('1', randomSource(817), 0);
  for (const law of left.privateSpec.laws) Object.assign(law, { delay: 3, resourceCost: 0, remoteDelta: 0 });
  const right = structuredClone(left);
  right.privateSpec.laws[0].delta = [99, 0];
  const actions = p05ContrastActions(left.publicSpec);
  const result = compareP05IndiscerniblePair(left, right, 2);
  assert.equal(result.verified, true);
  assert.equal(result.checked, 1 + actions.length + actions.length ** 2);
  assert.ok(actions.some(action => action.kind === 'prepare'));
  assert.ok(actions.some(action => action.kind === 'wait'));
  assert.equal(actions.filter(action => action.kind === 'command').length, left.publicSpec.commands.length);
});

test('a readily distinguishable pair is rejected instead of being called an abstention success', () => {
  const left = generateP05Situation('1', randomSource(819), 0);
  const right = structuredClone(left);
  right.privateSpec.laws[0].delta = [99, 0];
  const result = compareP05IndiscerniblePair(left, right, 2);
  assert.equal(result.verified, false);
  assert.equal(result.firstDifference.reason, 'different-public-history');
});

test('contrast generation is exactly reproducible for a fixed development seed', () => {
  const first = runP05Contrasts({ seed: 42, countPerKind: 2 });
  const repeated = runP05Contrasts({ seed: 42, countPerKind: 2 });
  assert.deepEqual(first, repeated);
  assert.equal(first.firstFailure, null);
});
