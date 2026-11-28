import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { P05AcquisitionLedger, ablateP05Return } from '../src/sic/p05-acquisition.ts';
import { behaviorSignature, digest, generateP05Situation, publicExperiment, publicProjection, randomSource } from '../scripts/sic-p05-laboratory.mjs';
import { certifyP05, verifyP05Claim } from '../scripts/sic-p05-oracle.mjs';
import { chooseP05BridgeAcquisition, chooseP05Command, compareP05Situation, evaluateP05Choice } from '../scripts/sic-p05-compare.mjs';
import { aggregateP05, summarizeP05 } from '../scripts/sic-p05-campaign.mjs';

const copy = value => structuredClone(value);
const cohort = Array.from({ length: 8 }, (_, index) => {
  const family = String(index + 1);
  const spec = generateP05Situation(family, randomSource(26112805 + (index + 1) * 1009), 1);
  const result = compareP05Situation(spec);
  result.row.behaviorHash = behaviorSignature(spec).hash;
  result.row.familyOrdinal = 1;
  return { family, spec, result };
});

test('eight real family comparisons use identical public traces and count all common-budget gestures', () => {
  for (const { family, spec, result: { row, evaluation } } of cohort) {
    assert.equal(row.certified, true, family);
    assert.equal(row.candidate.complete, true, family);
    assert.equal(row.candidate.qualifiedAcquisitions, row.expectedAcquisitions, family);
    assert.equal(row.candidate.erroneousAttributions, 0, family);
    assert.equal(row.candidate.unsupportedClaims, 0, family);
    assert.equal(row.actualGesturesEachArm, publicExperiment(spec.publicSpec).length);
    assert.equal(row.actualGesturesEachArm, row.oracleCertifiedGestures);
    assert.ok(row.actualGesturesEachArm <= row.commonCommandBudget);
    assert.equal(row.publicTraceHash, row.frozenPublicTraceHash);
    assert.equal(row.publicTraceHash, row.independentTraceHash);
    assert.equal(evaluation.publicHistory.length, row.actualGesturesEachArm);
    assert.deepEqual(row.native, { tested: 0, wins: 0 });
    assert.equal(row.oracleMinimality, 'not-claimed');
    assert.equal(row.frozen.qualifiedApiAvailable, false);
    assert.equal(row.frozen.nativeWorkerCompared, false);
  }
});

test('the frozen recorder retains ordinary motion, while delayed family-four motion is measured separately', () => {
  const immediate = cohort[0].result.row, delayed = cohort[3].result.row;
  assert.ok(immediate.frozen.expectedMotionRows > 0);
  assert.equal(immediate.frozen.recordedCorrectMotionRows, immediate.frozen.expectedMotionRows);
  assert.equal(immediate.frozen.recordedAllMotionRows, true);
  assert.ok(delayed.expectedAcquisitions > 0);
  assert.equal(delayed.frozen.recordedCorrectMotionRows, 0);
  assert.equal(delayed.candidate.qualifiedAcquisitions, delayed.expectedAcquisitions);
  const summary = summarizeP05(cohort.map(entry => entry.result.row));
  assert.equal(summary.oracleSolvable, 8);
  assert.equal(summary.candidateCompleteSituations, 8);
  assert.equal(summary.rawMotionAcquisitionGainSituations, 1);
  assert.equal(summary.newQualificationSituations, 8);
  assert.equal(summary.frozen.qualifiedSituationVerdict, 'not-representable-at-this-frozen-boundary');
  assert.equal(summary.native.wins, 0);
});

test('first deviation stores the actual shortest prefix with a new qualified acquisition', () => {
  for (const { spec, result: { row, evaluation } } of cohort) {
    const first = evaluation.firstDeviation;
    assert.equal(first.kind, 'qualified-effect-contract');
    assert.equal(first.gesture, row.firstAcquisitionGesture);
    assert.equal(first.publicHistory.length, first.gesture);
    assert.deepEqual(first.publicHistory, evaluation.publicHistory.slice(0, first.gesture));
    const ledger = new P05AcquisitionLedger(spec.publicSpec);
    for (const receipt of first.publicHistory.slice(0, -1)) ledger.addReturn(receipt);
    assert.equal(ledger.claims().length, 0);
    ledger.addReturn(first.publicHistory.at(-1));
    assert.ok(ledger.claims().length > 0);
    assert.deepEqual(first.frozenQualifiedClaims, []);
  }
});

test('ablation removes exactly one observation node and its aliases, retaining all other public values', () => {
  for (const { spec, result: { row, evaluation } } of cohort) {
    const original = evaluation.publicHistory, id = row.ablation.decisiveReturnId;
    const removedRef = original.find(receipt => receipt.id === id).after.ref;
    const changed = ablateP05Return(original, id);
    assert.equal(changed.length, original.length);
    for (let index = 0; index < original.length; index++) {
      const expected = copy(original[index]);
      if (expected.after?.ref === removedRef) expected.after = null;
      if (expected.before?.ref === removedRef) {
        expected.beforeRef = expected.before.ref;
        expected.epoch = expected.before.epoch;
        expected.tick = expected.before.tick;
        expected.before = null;
      }
      assert.deepEqual(changed[index], expected);
    }
    assert.equal(changed.some(receipt => receipt.before?.ref === removedRef || receipt.after?.ref === removedRef), false);
    const target = evaluation.claims.find(claim => claim.effectId === row.ablation.targetEffectId);
    assert.equal(verifyP05Claim(spec, original, target).valid, true);
    assert.equal(verifyP05Claim(spec, changed, target).justified, false);
    assert.equal(row.ablation.retainedAllActions, true);
    assert.equal(row.ablation.success, true);
    assert.equal(row.ablation.p09WithoutOnlyCausalEvidence.success, false);
    assert.equal(row.ablation.observedReacquisition, false);
  }
});

test('P09 really consumes a validated acquired effect in the separate support-and-cargo mechanism', () => {
  for (const { result: { row, evaluation } } of cohort) {
    assert.equal(row.p09.tested, true);
    assert.equal(row.p09.success, true);
    assert.equal(evaluation.p09.usedEffect, true);
    assert.ok(evaluation.p09.plan.some(step => step.action.kind === 'command'));
    assert.ok(evaluation.p09.plan.some(step => step.action.kind === 'deliver-cargo'));
    assert.equal(evaluation.p09.acquisition.effectId, row.p09.usedEffectId);
    assert.deepEqual(row.p09.usedEvidenceIds, evaluation.p09.acquisition.supportingReturnIds);
    assert.ok(row.p09.commands <= 16);
    assert.deepEqual(evaluation.p09.native, { tested: 0, wins: 0 });
  }
});

test('family-eight choice is public-only and independently executed to the visible target', () => {
  const { spec, result } = cohort[7];
  const decision = chooseP05Command(publicProjection(spec), result.evaluation.claims);
  const evaluated = evaluateP05Choice(spec, result.evaluation.publicHistory, result.evaluation.claims);
  assert.equal(decision.chosenCommand, result.row.choice.chosenCommand);
  assert.equal(evaluated.chosenCommand, decision.chosenCommand);
  assert.equal(evaluated.physicalSuccess, true);
  assert.equal(evaluated.acquisitionVerdict.valid, true);
  assert.equal(evaluated.success, true);
  assert.equal(evaluated.replayBudgetSeparateFromAcquisition, true);
  assert.equal(evaluated.replayGestures, spec.publicSpec.maxLatency + 2);
  const observed = evaluated.returns.at(-1).after;
  assert.deepEqual(observed.subjects.find(subject => subject.id === spec.publicSpec.selectionObjective.receiver).position,
    spec.publicSpec.selectionObjective.target);
});

test('a wrong prioritary claim is chosen publicly and fails replay instead of being silently removed by the oracle', () => {
  const { spec, result } = cohort[7], claims = result.evaluation.claims;
  const decision = chooseP05Command(spec.publicSpec, claims);
  const correct = claims.find(claim => claim.effectId === decision.chosenEffectId);
  const wrongCommand = spec.publicSpec.commands.find(command => command !== correct.command);
  const wrong = { ...copy(correct), command: wrongCommand, effectId: 'mutant:wrong-command' };
  const poisoned = [wrong, ...claims];
  assert.equal(chooseP05Command(spec.publicSpec, poisoned).chosenCommand, wrongCommand);
  const evaluated = evaluateP05Choice(spec, result.evaluation.publicHistory, poisoned);
  assert.equal(evaluated.chosenCommand, wrongCommand);
  assert.equal(evaluated.physicalSuccess, false);
  assert.equal(evaluated.acquisitionVerdict.valid, false);
  assert.equal(evaluated.success, false);
  const unsupported = { ...copy(correct), effectId: 'mutant:missing-proof', supportingReturnIds: ['invented:return'] };
  const physicallyRight = evaluateP05Choice(spec, result.evaluation.publicHistory, [unsupported, ...claims]);
  assert.equal(physicallyRight.physicalSuccess, true);
  assert.equal(physicallyRight.acquisitionVerdict.valid, false);
  assert.equal(physicallyRight.success, false);
});

test('P09 public selection does not consult oracle truth to remove a false offered command', () => {
  const { spec, result } = cohort[0], scene = result.evaluation.p09.scene;
  const original = result.evaluation.p09.acquisition;
  const wrongCommand = spec.publicSpec.commands.find(command => command !== original.command);
  const wrong = { ...copy(original), command: wrongCommand, effectId: 'mutant:p09-wrong-command' };
  const publicIds = result.evaluation.publicHistory.filter(receipt => receipt.after).map(receipt => receipt.id);
  const chosen = chooseP05BridgeAcquisition(scene, [wrong, original], publicIds);
  assert.equal(chosen.effectId, wrong.effectId);
  assert.equal(verifyP05Claim(spec, result.evaluation.publicHistory, chosen).valid, false);
});

test('public projection and policy cannot inspect hidden laws or copy private answers', () => {
  const spec = copy(cohort[3].spec), publicExpected = copy(spec.publicSpec);
  Object.defineProperty(spec, 'privateSpec', { get() { throw new Error('private evaluation accessed'); } });
  Object.defineProperty(spec, 'family', { get() { throw new Error('family label accessed'); } });
  Object.defineProperty(spec, 'id', { get() { throw new Error('seed or case identity accessed'); } });
  const projected = publicProjection(spec);
  assert.deepEqual(projected, publicExpected);
  assert.ok(!Object.hasOwn(projected, 'privateSpec'));
  assert.ok(!Object.hasOwn(projected, 'laws'));
  assert.ok(!Object.hasOwn(projected, 'family'));
  assert.ok(!Object.hasOwn(projected, 'solution'));
  assert.deepEqual(publicExperiment(projected), publicExperiment(publicExpected));
  projected.contexts[0].reserve++;
  assert.notEqual(projected.contexts[0].reserve, publicExpected.contexts[0].reserve);
});

test('a corrupted evaluator return is rejected at its first gesture instead of entering metrics', () => {
  const spec = cohort[0].spec, certificate = certifyP05(spec);
  certificate.history[2].after.remote++;
  assert.throws(() => compareP05Situation(spec, certificate), /Independent transition disagreement at gesture 3/);
});

function makeShards() {
  const directory = mkdtempSync(join(tmpdir(), 'sic-p05-comparison-'));
  const shards = join(directory, 'shards'), out = join(directory, 'aggregate');
  mkdirSync(shards);
  const startedAt = Date.now() - 10_000;
  for (const [index, { family, result }] of cohort.entries()) {
    const path = join(shards, `family-${family}`);
    mkdirSync(path);
    const data = JSON.stringify(result.row) + '\n';
    const report = { protocol: 'P05-development-v1',
      configuration: { baseRevision: '20433007224accc36e3d7976696d9ee7a783a227', revision: 'test-fixture-revision',
        sourceFingerprint: 'test-fixture-sources', seed: 26112805, perFamily: 1, commonCommandBudget: 96,
        families: [family], count: 1 },
      corpus: { resultRowsSha256: digest(data), signatureSetSha256: digest([result.row.behaviorHash]), uniqueBehaviorSignatures: 1 },
      contrasts: { firstFailure: null, config: { mainQuotaContribution: 0 } },
      generation: { [family]: { attempted: 1, accepted: 1, duplicateBehaviorsRejected: 0, uncertifiedRejected: 0 } },
      firstDeviationExamples: {}, timing: { startedAt: new Date(startedAt + index * 100).toISOString(),
        finishedAt: new Date(startedAt + index * 100 + 50).toISOString(), wallSeconds: 0.05 } };
    writeFileSync(join(path, 'report.json'), JSON.stringify(report));
    writeFileSync(join(path, 'results.jsonl.gz'), gzipSync(data));
  }
  return { directory, shards, out };
}

function replaceShard(fixture, family, mutateRow, mutateReport = () => {}) {
  const path = join(fixture.shards, `family-${family}`);
  const row = copy(cohort[Number(family) - 1].result.row);
  mutateRow(row);
  const report = JSON.parse(readFileSync(join(path, 'report.json'), 'utf8'));
  const data = JSON.stringify(row) + '\n';
  report.corpus.resultRowsSha256 = digest(data);
  report.corpus.signatureSetSha256 = digest([row.behaviorHash]);
  mutateReport(report);
  writeFileSync(join(path, 'report.json'), JSON.stringify(report));
  writeFileSync(join(path, 'results.jsonl.gz'), gzipSync(data));
}

test('aggregation preserves exact family quotas and keeps an unsuccessful candidate in the solvable corpus', () => {
  const fixture = makeShards();
  try {
    replaceShard(fixture, '4', row => { row.candidate.complete = false; });
    const report = aggregateP05(fixture.shards, fixture.out);
    assert.equal(report.stats.situations, 8);
    assert.equal(report.stats.oracleSolvable, 8);
    assert.equal(report.stats.candidateCompleteSituations, 7);
    assert.equal(report.firstFailure.family, '4');
    assert.deepEqual(report.qualityFailures, []);
    for (const family of Object.values(report.families)) assert.equal(family.situations, 1);
    assert.equal(report.corpus.uniqueBehaviorSignatures, 8);
  } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
});

test('aggregation rejects mislabeled families, exceeded budgets, wrong hashes and duplicate behaviors', () => {
  const mutations = [
    fixture => replaceShard(fixture, '1', row => { row.family = '2'; }),
    fixture => replaceShard(fixture, '1', row => { row.actualGesturesEachArm = row.commonCommandBudget + 1; }),
    fixture => replaceShard(fixture, '1', () => {}, report => { report.corpus.resultRowsSha256 = '0'.repeat(64); }),
    fixture => replaceShard(fixture, '1', () => {}, report => { report.corpus.signatureSetSha256 = '0'.repeat(64); }),
    fixture => replaceShard(fixture, '8', row => { row.behaviorHash = cohort[0].result.row.behaviorHash; }),
    fixture => replaceShard(fixture, '8', () => {}, report => { report.configuration.revision = 'another-source'; }),
  ];
  for (const mutate of mutations) {
    const fixture = makeShards();
    try {
      mutate(fixture);
      assert.throws(() => aggregateP05(fixture.shards, fixture.out));
    } finally { rmSync(fixture.directory, { recursive: true, force: true }); }
  }
});
