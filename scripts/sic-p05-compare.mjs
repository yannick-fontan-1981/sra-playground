import { P05AcquisitionLedger, ablateP05Return, p05ConditionsHold } from '../src/sic/p05-acquisition.ts';
import { FrozenP05MotionAdapter, frozenP05Provenance } from '../src/sic/p05-frozen-adapter.ts';
import { createLaboratory, publicProjection, publicExperiment, digest } from './sic-p05-laboratory.mjs';
import { certifyP05, createOracleWorld, verifyP05Claim } from './sic-p05-oracle.mjs';
import { verifyP05Composition } from './sic-p05-p09-bridge.mjs';

const normalized = value => Array.isArray(value) ? value.map(normalized) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalized(value[key])])) : value;
const same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
const value = observation => ({ ...observation, ref: observation.ref ?? 'scene', epoch: observation.epoch ?? 'scene', tick: observation.tick ?? 0 });
const copy = data => structuredClone(data);

function claimCovers(claim, verdict, row) {
  return verdict.valid && verdict.matchedContextIds.includes(row.contextId) && claim.command === row.command
    && same(claim.delta, row.delta) && claim.delay === row.delay && claim.resourceCost === row.resourceCost
    && claim.remoteDelta === row.remoteDelta && (claim.receiver === row.receiver
      || claim.receiver === 'selected' && row.receiver === row.selected);
}

function validateClaims(spec, history, claims, expected) {
  const verdicts = claims.map(claim => verifyP05Claim(spec, history, claim));
  const covered = expected.map(row => claims.some((claim, index) => claimCovers(claim, verdicts[index], row)));
  return { verdicts, covered, correctlyAcquired: covered.filter(Boolean).length,
    erroneousAttributions: verdicts.filter(verdict => !verdict.correctEffect).length,
    unsupportedClaims: verdicts.filter(verdict => verdict.correctEffect && !verdict.justified).length,
    complete: covered.every(Boolean) && verdicts.every(verdict => verdict.valid) };
}

function rawFrozenCoverage(adapter, oracle) {
  const effects = adapter.observedEffects(), vectors = adapter.vectors();
  const rows = oracle.expectedAcquisitions.filter(row => row.delta.some(Boolean));
  const covered = rows.filter(row => effects.some(effect => effect.command === row.command && effect.receiver === row.receiver
    && same(effect.delta, row.delta) && effect.supportingReturnIds.includes(row.commandReturnId)));
  const selected = rows.filter(row => vectors.some(vector => vector.command === row.command && vector.receiver === row.receiver
    && same(vector.delta, row.delta) && vector.observedReturnIds.includes(row.commandReturnId)));
  return { expectedMotionRows: rows.length, recordedCorrectMotionRows: covered.length,
    selectedCorrectMotionRows: selected.length, recordedAllMotionRows: covered.length === rows.length,
    vectors: copy(vectors), observedEffects: copy(effects) };
}

/** Public scene is fixed BEFORE the candidate is executed. No candidate delta sets the goal. */
export function prepareP09Check(spec) {
  const contexts = [...spec.publicSpec.contexts].sort((a, b) => a.id.localeCompare(b.id));
  for (const context of contexts) for (const command of [...spec.publicSpec.commands].sort()) {
    const law = spec.privateSpec.laws.find(item => item.contextId === context.id && item.command === command);
    if (!law.delta.some(Boolean) || law.resourceCost > context.reserve) continue;
    const receiver = law.receiver === 'selected' ? context.selected : law.receiver;
    const body = context.subjects.find(subject => subject.id === receiver);
    const scene = { initial: value({ ...copy(context), ref: 'e1:t0', epoch: 'e1', tick: 0 }),
      support: { subjectId: receiver, position: [body.position[0] + law.delta[0], body.position[1] + law.delta[1]] },
      deliveryResourceCost: 0, budget: { commands: 16, states: 4096 } };
    delete scene.initial.id;
    return { contextId: context.id, scene };
  }
  return null;
}

export function chooseP05BridgeAcquisition(scene, claims, availableReturnIds) {
  return claims.find(claim => p05ConditionsHold(claim.conditions, scene.initial)
    && claim.delta.some(Boolean) && claim.supportingReturnIds.every(id => availableReturnIds.includes(id))
    && (() => {
      const receiver = claim.receiver === 'selected' ? scene.initial.selected : claim.receiver;
      const body = scene.initial.subjects.find(subject => subject.id === receiver);
      return receiver === scene.support.subjectId && body
        && same([body.position[0] + claim.delta[0], body.position[1] + claim.delta[1]], scene.support.position);
    })()) ?? null;
}

function runP09(spec, fixed, claims, history, removedReturnId) {
  if (!fixed) return { tested: false, success: false, reason: 'no-translation-in-public-task' };
  const availableReturnIds = history.filter(receipt => receipt.after).map(receipt => receipt.id);
  // Consumer choice sees public claims only. In particular an oracle verdict
  // cannot remove a false offer before planning; bad claims must fail replay.
  const acquisition = chooseP05BridgeAcquisition(fixed.scene, claims, availableReturnIds);
  const world = createOracleWorld(spec);
  world.step({ kind: 'prepare', command: 'PREPARE', contextId: fixed.contextId });
  const executeCommand = (_before, action) => world.step(action.kind === 'wait'
    ? { kind: 'wait', command: 'WAIT' } : action).after;
  const result = verifyP05Composition({ scene: fixed.scene, acquisition,
    availableReturnIds: removedReturnId ? availableReturnIds.filter(id => id !== removedReturnId) : availableReturnIds,
    executeCommand });
  const acquisitionVerdict = acquisition ? verifyP05Claim(spec, history, acquisition) : null;
  return { tested: true, ...result, physicalReplaySuccess: result.success,
    success: result.success && Boolean(acquisitionVerdict?.valid), acquisitionVerdict,
    acquisition: acquisition ? copy(acquisition) : null,
    scene: copy(fixed.scene), contextId: fixed.contextId };
}

export function chooseP05Command(publicSpec, claims) {
  const goal = publicSpec.selectionObjective;
  if (!goal) return null;
  const context = publicSpec.contexts.find(item => item.id === goal.contextId), before = value(context);
  const commands = [];
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    if (!p05ConditionsHold(claim.conditions, before)) continue;
    const receiver = claim.receiver === 'selected' ? before.selected : claim.receiver;
    const body = before.subjects.find(subject => subject.id === receiver);
    if (receiver === goal.receiver && body && same([body.position[0] + claim.delta[0], body.position[1] + claim.delta[1]], goal.target)) {
      commands.push({ command: claim.command, effectId: claim.effectId });
    }
  }
  return { contextId: goal.contextId, chosenCommand: commands[0]?.command ?? null,
    chosenEffectId: commands[0]?.effectId ?? null, alternativeCount: new Set(commands.map(item => item.command)).size };
}

export function evaluateP05Choice(spec, history, claims) {
  const decision = chooseP05Command(spec.publicSpec, claims);
  if (!decision) return null;
  if (!decision.chosenCommand) return { ...decision, success: false, replayGestures: 0, reason: 'abstained' };
  const world = createOracleWorld(spec);
  const returns = [world.step({ kind: 'prepare', command: 'PREPARE', contextId: decision.contextId }),
    world.step({ kind: 'command', command: decision.chosenCommand })];
  for (let tick = 0; tick < spec.publicSpec.maxLatency; tick++) returns.push(world.step({ kind: 'wait', command: 'WAIT' }));
  const goal = spec.publicSpec.selectionObjective;
  const actual = world.observation().subjects.find(subject => subject.id === goal.receiver)?.position;
  const physicalSuccess = same(actual, goal.target);
  const acquisitionVerdict = verifyP05Claim(spec, history, claims.find(claim => claim.effectId === decision.chosenEffectId));
  return { ...decision, success: physicalSuccess && acquisitionVerdict.valid, physicalSuccess,
    acquisitionVerdict, replayGestures: returns.length, replayBudgetSeparateFromAcquisition: true, returns };
}

/** Isolated public histories, identical actions and caps. No oracle object enters either learner. */
export function compareP05Situation(spec, certificate) {
  const oracle = certificate ?? certifyP05(spec);
  if (!oracle.solvable) return { certified: false, reason: oracle.reason, oracle };
  const fixedP09Scene = prepareP09Check(spec); // Precommit target before either arm runs.
  const pub = publicProjection(spec), actions = publicExperiment(pub);
  if (!same(actions, oracle.policy)) throw new Error('Independent public-policy disagreement');
  if (actions.length > pub.commandBudget) throw new Error('Public experiment exceeds common command cap');
  const candidate = new P05AcquisitionLedger({ maxLatency: pub.maxLatency, priorClaims: pub.priorClaims });
  const frozen = new FrozenP05MotionAdapter({ maxLatency: pub.maxLatency, priorClaims: pub.priorClaims });
  const candidateWorld = createLaboratory(spec), frozenWorld = createLaboratory(spec);
  const candidateHistory = [], frozenHistory = [];
  let firstDeviation = null, firstAcquisitionGesture = null;
  for (let index = 0; index < actions.length; index++) {
    const candidateReturn = candidateWorld.step(copy(actions[index]));
    const frozenReturn = frozenWorld.step(copy(actions[index]));
    if (!same(candidateReturn, oracle.history[index]) || !same(frozenReturn, oracle.history[index])) {
      throw new Error(`Independent transition disagreement at gesture ${index + 1}`);
    }
    candidateHistory.push(candidateReturn); frozenHistory.push(frozenReturn);
    candidate.addReturn(copy(candidateReturn)); frozen.addReturn(copy(frozenReturn));
    if (firstDeviation === null && candidateReturn.kind !== 'prepare' && candidateReturn.after.tick === pub.maxLatency + 1) {
      const current = candidate.claims();
      if (current.length) {
        firstAcquisitionGesture = index + 1;
        firstDeviation = { kind: 'qualified-effect-contract', gesture: index + 1,
          publicHistory: copy(candidateHistory), candidateClaims: copy(current),
          frozenQualifiedClaims: copy(frozen.claims()), frozenObservedEffects: copy(frozen.observedEffects()),
          meaning: 'New justified P05 contract at this subsystem boundary; not a native SIC victory or all-engine comparison.' };
      }
    }
  }
  const claims = candidate.claims(), frozenClaims = frozen.claims();
  const assessed = validateClaims(spec, candidateHistory, claims, oracle.expectedAcquisitions);
  const frozenAssessed = validateClaims(spec, frozenHistory, frozenClaims, oracle.expectedAcquisitions);
  const raw = rawFrozenCoverage(frozen, oracle);
  const diagnostics = candidate.diagnostics();
  const stationaryNoEffects = oracle.outcomes.filter(row => row.noEffect);
  const justifiedStationaryAbstentions = stationaryNoEffects.filter(row => row.supportingReturnIds
    .some(id => diagnostics.stationaryReturnIds.includes(id))).length;
  const choice = evaluateP05Choice(spec, candidateHistory, claims);
  const familyDecision = spec.family === '2'
    ? oracle.expectedAcquisitions.every(row => claims.some((claim, index) => claim.receiver === 'selected'
      && claimCovers(claim, assessed.verdicts[index], row)))
    : spec.family === '3' || spec.family === '5'
      ? claims.every(claim => claim.limitingReturnIds.length > 0)
      : choice ? choice.success : true;
  const p09 = runP09(spec, fixedP09Scene, claims, candidateHistory);
  // A gain is a newly qualified contract. Select the P09-consumed acquisition
  // when available, so the same causal link is tested at both P05 and P09.
  const target = p09.acquisition && p09.acquisitionVerdict?.valid ? p09.acquisition
    : claims.find((_, index) => assessed.verdicts[index].valid);
  let ablation = null;
  if (target) {
    const targetIndex = claims.findIndex(claim => claim.effectId === target.effectId);
    const decisiveReturnId = assessed.verdicts[targetIndex].decisiveReturnId;
    const ablatedHistory = ablateP05Return(candidateHistory, decisiveReturnId);
    const ablated = new P05AcquisitionLedger({ maxLatency: pub.maxLatency, priorClaims: pub.priorClaims });
    ablatedHistory.forEach(receipt => ablated.addReturn(receipt));
    const afterClaims = ablated.claims(), afterVerdicts = afterClaims.map(claim => verifyP05Claim(spec, ablatedHistory, claim));
    const targetRetained = afterClaims.some((claim, index) => afterVerdicts[index].valid
      && claim.effectId === target.effectId);
    const withheldSnapshotRef = candidateHistory.find(receipt => receipt.id === decisiveReturnId).after.ref;
    const residualCopies = ablatedHistory.filter(receipt => receipt.before?.ref === withheldSnapshotRef
      || receipt.after?.ref === withheldSnapshotRef).length;
    const ablatedP09 = runP09(spec, fixedP09Scene, afterClaims, ablatedHistory);
    // Re-test the ORIGINAL acquired offer with just its decisive evidence ID absent.
    // This keeps every other action/rule in P09 available.
    const evidenceAblatedP09 = runP09(spec, fixedP09Scene, [target], candidateHistory, decisiveReturnId);
    ablation = { decisiveReturnId, withheldSnapshotRef, retainedAllActions: same(actions,
      ablatedHistory.map(receipt => ({ kind: receipt.kind, command: receipt.command,
        ...(receipt.kind === 'prepare' ? { contextId: receipt.contextId } : {}) }))),
      residualCopies, targetEffectId: target.effectId, targetRetained, remainingClaims: afterClaims.length,
      oldClaimVerdictAfterWithdrawal: verifyP05Claim(spec, ablatedHistory, target),
      observedReacquisition: false, // No extra measurements were issued in this controlled replay.
      p09AfterWithdrawal: { success: ablatedP09.success, planned: ablatedP09.planned },
      p09WithoutOnlyCausalEvidence: { success: evidenceAblatedP09.success, planned: evidenceAblatedP09.planned },
      success: !targetRetained && residualCopies === 0 && !evidenceAblatedP09.success };
  }
  const proofLastGesture = claims.length ? Math.max(...claims.flatMap(claim =>
    claim.supportingReturnIds.concat(claim.limitingReturnIds).map(id => candidateHistory.findIndex(receipt => receipt.id === id) + 1))) : null;
  const row = {
    id: spec.id, family: spec.family, certified: true, expectedAcquisitions: oracle.expectedAcquisitions.length,
    commonCommandBudget: pub.commandBudget, oracleCertifiedGestures: oracle.commandUpperBound,
    oracleMinimality: oracle.minimality, actualGesturesEachArm: actions.length,
    firstAcquisitionGesture, acquisitionEvidenceCompleteGesture: proofLastGesture,
    frozen: { qualifiedAcquisitions: frozenAssessed.correctlyAcquired, complete: frozenAssessed.complete,
      erroneousAttributions: frozenAssessed.erroneousAttributions, unsupportedClaims: frozenAssessed.unsupportedClaims,
      expectedMotionRows: raw.expectedMotionRows, recordedCorrectMotionRows: raw.recordedCorrectMotionRows,
      selectedCorrectMotionRows: raw.selectedCorrectMotionRows, recordedAllMotionRows: raw.recordedAllMotionRows,
      qualifiedApiAvailable: false, nativeWorkerCompared: false },
    candidate: { qualifiedAcquisitions: assessed.correctlyAcquired, complete: assessed.complete && familyDecision,
      erroneousAttributions: assessed.erroneousAttributions, unsupportedClaims: assessed.unsupportedClaims,
      familyDecision, claims: claims.length },
    stationaryAttempts: oracle.stationaryAttempts.length, noEffectAttempts: stationaryNoEffects.length,
    justifiedStationaryAbstentions, staleProofs: diagnostics.staleProofIds.length,
    transfer: Object.fromEntries(['confirmed', 'refuted', 'restricted'].map(status =>
      [status, claims.filter(claim => claim.transferStatus === status).length])),
    p09: { tested: p09.tested, success: p09.success, commands: p09.commands, usedEffectId: p09.usedEffectId,
      usedEvidenceIds: p09.usedEvidenceIds, consumedConditions: p09.consumedConditions },
    choice, ablation, firstDeviationGesture: firstDeviation?.gesture ?? null,
    native: { tested: 0, wins: 0 },
    publicTraceHash: digest(normalized(candidateHistory)), frozenPublicTraceHash: digest(normalized(frozenHistory)),
    independentTraceHash: digest(normalized(oracle.history)),
  };
  return { row, evaluation: { spec, oracle: { reason: oracle.reason, policy: oracle.policy,
    assumptions: oracle.assumptions, outcomes: oracle.outcomes },
    publicHistory: candidateHistory, frozenProvenance: frozenP05Provenance,
    frozenObservedEffects: raw.observedEffects, frozenSelectedVectors: raw.vectors,
    claims, verdicts: assessed.verdicts, diagnostics, firstDeviation, p09, ablation } };
}
