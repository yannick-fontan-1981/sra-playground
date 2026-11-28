/** Development contrasts kept OUTSIDE the 8000 solvable-situation quota. */
import { isDeepStrictEqual } from 'node:util';
import { P05AcquisitionLedger } from '../src/sic/p05-acquisition.ts';
import { createLaboratory, digest, generateP05Situation, publicExperiment,
  publicProjection, randomSource } from './sic-p05-laboratory.mjs';
import { certifyP05, createOracleWorld, verifyP05Claim } from './sic-p05-oracle.mjs';

const copy = value => structuredClone(value);
const equal = isDeepStrictEqual;
const wait = { kind: 'wait', command: 'WAIT' };

function learnerFor(publicSpec, history = []) {
  const learner = new P05AcquisitionLedger({ maxLatency: publicSpec.maxLatency,
    priorClaims: publicSpec.priorClaims ?? [] });
  for (const receipt of history) learner.addReturn(receipt);
  return learner;
}

/** Full public action alphabet, including resets, without consulting any law. */
export function p05ContrastActions(publicSpec) {
  return [...publicSpec.contexts.map(context => ({ kind: 'prepare', command: 'PREPARE', contextId: context.id })),
    copy(wait), ...publicSpec.commands.map(command => ({ kind: 'command', command }))];
}

function* histories(actions, budget, prefix = []) {
  yield prefix;
  if (!budget) return;
  for (const action of actions) yield* histories(actions, budget - 1, [...prefix, action]);
}

/** Exhausting all histories proves equality for adaptive policies as well. */
export function compareP05IndiscerniblePair(left, right, cap = 2) {
  if (!equal(left.publicSpec, right.publicSpec)) throw new Error('An indiscernible pair needs the same public interface');
  if (!Number.isInteger(cap) || cap < 0 || cap > 4) throw new Error('Contrast history cap must be an integer in 0..4');
  const actions = p05ContrastActions(left.publicSpec);
  let checked = 0, abstentions = 0, simulatorAgreement = 0;
  for (const sequence of histories(actions, cap)) {
    const a = createOracleWorld(left), b = createOracleWorld(right);
    const laboratoryA = createLaboratory(left), laboratoryB = createLaboratory(right);
    const observedA = sequence.map(action => a.step(action));
    const observedB = sequence.map(action => b.step(action));
    const actualA = sequence.map(action => laboratoryA.step(action));
    const actualB = sequence.map(action => laboratoryB.step(action));
    checked++;
    if (!equal(a.observation(), b.observation()) || !equal(observedA, observedB)) {
      return { verified: false, checked, abstentions, simulatorAgreement, firstDifference: { sequence, reason: 'different-public-history' } };
    }
    if (!equal(observedA, actualA) || !equal(observedB, actualB)) {
      return { verified: false, checked, abstentions, simulatorAgreement, firstDifference: { sequence, reason: 'interpreter-disagreement' } };
    }
    simulatorAgreement++;
    const candidate = learnerFor(publicProjection(left), actualA);
    if (candidate.claims().length !== 0) {
      return { verified: false, checked, abstentions, simulatorAgreement,
        firstDifference: { sequence, reason: 'unjustified-acquisition-under-cap', claims: candidate.claims() } };
    }
    abstentions++;
  }
  return { verified: true, checked, abstentions, simulatorAgreement, firstDifference: null };
}

function observedTrial(spec) {
  const publicSpec = publicProjection(spec);
  const actions = publicExperiment(publicSpec);
  if (actions.length > publicSpec.commandBudget) throw new Error('Contrast experiment exceeds its declared budget');
  const world = createLaboratory(spec), history = actions.map(action => world.step(action));
  const oracle = certifyP05(spec), candidate = learnerFor(publicSpec, history);
  const claims = candidate.claims();
  return { oracle, history, candidate, claims, diagnostics: candidate.diagnostics(),
    interpreterAgreement: equal(history, oracle.history),
    verifications: claims.map(claim => verifyP05Claim(spec, history, claim)) };
}

function makeIndiscernible(draw, index) {
  const left = generateP05Situation('4', draw, index);
  left.id = `contrast-indiscernible-${index}-a`;
  left.publicSpec.commandBudget = 2;
  left.publicSpec.priorClaims = [];
  for (const law of left.privateSpec.laws) {
    law.delay = 3; law.resourceCost = 0; law.remoteDelta = 0;
  }
  for (const ambient of left.privateSpec.ambient) ambient.remotePerTick = 0;
  const contextId = left.publicSpec.contexts[0].id, command = left.publicSpec.commands[0];
  const changed = left.privateSpec.laws.find(law => law.contextId === contextId && law.command === command);
  changed.delta = [1 + draw(19), 0];
  const right = copy(left);
  right.id = `contrast-indiscernible-${index}-b`;
  right.privateSpec.laws.find(law => law.contextId === contextId && law.command === command).delta = [0, -(1 + draw(19))];
  return { left, right, futureWitness: [{ kind: 'command', command }, copy(wait), copy(wait), copy(wait)] };
}

function makeStationary(draw, index) {
  const spec = generateP05Situation('1', draw, index);
  spec.id = `contrast-stationary-${index}`;
  spec.publicSpec.priorClaims = [];
  for (const law of spec.privateSpec.laws) Object.assign(law, { delta: [0, 0], delay: 0, resourceCost: 0, remoteDelta: 0 });
  for (const ambient of spec.privateSpec.ambient) ambient.remotePerTick = 0;
  return spec;
}

function contextCountertrial(stationary, draw) {
  const spec = copy(stationary), source = spec.publicSpec.contexts[0];
  const open = copy(source);
  open.id = 'additional-measured-setting';
  open.context.terrain = 'additional-observed-surface';
  open.context.blocked = false;
  spec.publicSpec.contexts.push(open);
  spec.privateSpec.ambient.push({ contextId: open.id, remotePerTick: 0 });
  for (const command of spec.publicSpec.commands) spec.privateSpec.laws.push({ contextId: open.id, command,
    receiver: open.selected, delta: [1 + draw(19), 0], delay: 0, resourceCost: 0, remoteDelta: 0 });
  return spec;
}

/**
 * These seeds belong to development contrasts only. There is deliberately no
 * holdout mode, reserved seed, native game import, or success-conditioned retry.
 */
export function runP05Contrasts({ seed = 26112805, countPerKind = 32 } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('Invalid development contrast seed');
  if (!Number.isInteger(countPerKind) || countPerKind < 1 || countPerKind > 1000) throw new Error('Invalid contrast count');
  const draw = randomSource((seed ^ 0x0c057a57) >>> 0);
  const report = {
    config: { protocol: 'sic-p05-development-contrasts-v1', seed, countPerKind,
      indiscernibleCommandCap: 2, delayedEffect: 3, mainQuotaContribution: 0,
      sealedOperatorCasesGenerated: 0, sealedNativeGamesTested: 0 },
    indiscernible: { tested: 0, worlds: 0, verifiedPairs: 0, justifiedAbstentions: 0,
      publicHistoryPrefixes: 0, abstainingPrefixes: 0, simulatorAgreementPrefixes: 0,
      futureDivergenceWitnesses: 0, examples: [] },
    stationary: { tested: 0, oracleNoEffect: 0, justifiedAbstentions: 0, attempts: 0,
      stationaryReturnIds: 0, contextCountertrials: 0, noGlobalCommandBlacklist: 0, examples: [] },
    stale: { tested: 0, justifiedAbstentions: 0, oldProofsRetainedSeparately: 0,
      currentAcquisitions: 0, unconfirmedRecallScopes: [] },
    scalarEffects: { tested: 0, oracleSolvable: 0, correctlyAcquired: 0, geometricStationarityPreserved: 0, cases: [] },
    firstFailure: null,
  };
  const fail = (kind, index, reason, detail) => {
    if (!report.firstFailure) report.firstFailure = { kind, index, reason, detail };
  };

  for (let index = 0; index < countPerKind; index++) {
    const pair = makeIndiscernible(draw, index);
    const compared = compareP05IndiscerniblePair(pair.left, pair.right, 2);
    const group = report.indiscernible;
    group.tested++; group.worlds += 2;
    group.publicHistoryPrefixes += compared.checked;
    group.abstainingPrefixes += compared.abstentions;
    group.simulatorAgreementPrefixes += compared.simulatorAgreement;
    if (compared.verified) group.verifiedPairs++;
    if (compared.abstentions === compared.checked) group.justifiedAbstentions++;
    const futureA = createOracleWorld(pair.left), futureB = createOracleWorld(pair.right);
    const laterA = pair.futureWitness.map(action => futureA.step(action));
    const laterB = pair.futureWitness.map(action => futureB.step(action));
    const futureDivergence = !equal(laterA, laterB);
    if (futureDivergence) group.futureDivergenceWitnesses++;
    if (!compared.verified || !futureDivergence) fail('indiscernible', index,
      compared.firstDifference?.reason ?? 'pair-never-diverges', compared.firstDifference);
    if (group.examples.length < 3) group.examples.push({ id: pair.left.id.replace(/-a$/, ''),
      publicInterfaceHash: digest(pair.left.publicSpec), histories: compared.checked,
      cap: 2, distinguishingReturnBeyondCap: 4 });

    const zero = makeStationary(draw, index), measured = observedTrial(zero);
    const stationary = report.stationary;
    stationary.tested++;
    stationary.attempts += measured.oracle.stationaryAttempts.length;
    stationary.stationaryReturnIds += measured.diagnostics.stationaryReturnIds.length;
    if (!measured.oracle.solvable && measured.oracle.reason === 'no-nonzero-effect') stationary.oracleNoEffect++;
    if (!measured.claims.length) stationary.justifiedAbstentions++;
    const contrast = observedTrial(contextCountertrial(zero, draw));
    stationary.contextCountertrials++;
    const localScopePreserved = contrast.oracle.solvable && contrast.claims.length === zero.publicSpec.commands.length
      && contrast.verifications.every(verdict => verdict.valid)
      && contrast.claims.every(claim => claim.limitingReturnIds.length > 0);
    if (localScopePreserved) stationary.noGlobalCommandBlacklist++;
    if (measured.oracle.reason !== 'no-nonzero-effect' || measured.claims.length || !measured.interpreterAgreement
      || !localScopePreserved) fail('stationary', index, 'stationarity-or-context-qualification-failed',
      { oracleReason: measured.oracle.reason, claims: measured.claims.length, localScopePreserved,
        contrastVerifications: contrast.verifications });
    if (stationary.examples.length < 3) stationary.examples.push({ id: zero.id,
      commands: measured.history.length, attempts: measured.oracle.stationaryAttempts.length,
      newContextAcquisitions: contrast.claims.length });

    const recalled = generateP05Situation('7', draw, index), publicRecall = publicProjection(recalled);
    const staleCandidate = learnerFor(publicRecall), staleDiagnostics = staleCandidate.diagnostics();
    const priorIds = [...new Set(publicRecall.priorClaims.flatMap(claim => claim.supportingReturnIds))].sort();
    const stale = report.stale;
    stale.tested++;
    const current = staleCandidate.claims().length;
    stale.currentAcquisitions += current;
    if (!current) stale.justifiedAbstentions++;
    if (equal([...staleDiagnostics.staleProofIds].sort(), priorIds)) stale.oldProofsRetainedSeparately++;
    stale.unconfirmedRecallScopes.push({ id: `contrast-stale-${index}`, newObservations: 0,
      currentAcquisitions: current,
      recalls: publicRecall.priorClaims.map(claim => ({ effectId: claim.effectId, command: claim.command,
        conditions: copy(claim.conditions), oldReturnIds: [...claim.supportingReturnIds] })) });
    if (current || staleDiagnostics.receipts || !equal([...staleDiagnostics.staleProofIds].sort(), priorIds)) {
      fail('stale', index, 'old-proof-promoted-without-current-measurement', staleDiagnostics);
    }
  }

  // Stationary geometry is not equivalent to absence of an acquired effect.
  for (const kind of ['resource', 'remote']) {
    const spec = makeStationary(draw, countPerKind);
    spec.id = `contrast-scalar-${kind}`;
    for (const law of spec.privateSpec.laws) Object.assign(law, kind === 'resource'
      ? { resourceCost: 1 + draw(5) } : { remoteDelta: 1 + draw(9), delay: 1 + draw(3) });
    for (const ambient of spec.privateSpec.ambient) ambient.remotePerTick = 1 + draw(4);
    const result = observedTrial(spec), group = report.scalarEffects;
    group.tested++;
    if (result.oracle.solvable) group.oracleSolvable++;
    const acquired = result.claims.length === result.oracle.expectedAcquisitions.length
      && result.claims.length > 0 && result.verifications.every(verdict => verdict.valid);
    if (acquired) group.correctlyAcquired++;
    if (result.claims.every(claim => claim.delta.every(value => value === 0))
      && result.diagnostics.stationaryReturnIds.length > 0) group.geometricStationarityPreserved++;
    group.cases.push({ kind, acquiredEffects: result.claims.length, commands: result.history.length,
      oracleExpectedEffects: result.oracle.expectedAcquisitions.length, acquired });
    if (!result.oracle.solvable || !acquired || !result.interpreterAgreement) {
      fail('scalar', kind, 'scalar-effect-erased-by-geometric-stationarity', result.verifications);
    }
  }
  return report;
}
