import assert from 'node:assert/strict';
import test from 'node:test';
import {
  certifyP05, createOracleWorld, observedP05OracleOutcomes, p05OraclePolicy,
  validateP05OracleContract, verifyP05Claim,
} from '../scripts/sic-p05-oracle.mjs';

// Evaluator fixtures are authored independently of the campaign generator.
const context = (id, fields = {}, selected = 'a', reserve = 5) => ({ id, selected,
  subjects: [{ id: 'a', position: [2, 4] }, { id: 'b', position: [8, 1] }],
  context: { terrain: 'firm', phase: 0, ...fields }, reserve, remote: 10 });
function fixture({ contexts = [context('one')], maxLatency = 2, commandBudget = 100,
  delta = [3, 0], delay = 0, resourceCost = 1, remoteDelta = 0, remotePerTick = 2 } = {}) {
  return { schema: 'sic-p05-lab-v1', id: 'test', family: 'evaluator-authored',
    publicSpec: { commands: ['opaque'], contexts, maxLatency, commandBudget },
    privateSpec: {
      laws: contexts.map(setup => ({ contextId: setup.id, command: 'opaque', receiver: 'selected',
        delta, delay, resourceCost, remoteDelta })),
      ambient: contexts.map(setup => ({ contextId: setup.id, remotePerTick })),
    } };
}
const command = { kind: 'command', command: 'opaque' };
const wait = { kind: 'wait', command: 'WAIT' };
const prepare = contextId => ({ kind: 'prepare', command: 'PREPARE', contextId });
const pos = (observation, id = 'a') => observation.subjects.find(subject => subject.id === id).position;
function claimFor(row, extras = {}) {
  return { effectId: 'independent-fixture-claim', command: row.command, receiver: row.receiver,
    effectKind: row.effectKind, delta: row.delta, delay: row.delay, resourceCost: row.resourceCost,
    remoteDelta: row.remoteDelta, conditions: row.conditions, supportingReturnIds: row.supportingReturnIds,
    limitingReturnIds: [], status: 'restricted', ...extras };
}

test('oracle policy depends only on public actions and counts all preparation and waiting gestures', () => {
  const spec = fixture({ contexts: [context('one'), context('two', { terrain: 'loose' })] });
  const policy = p05OraclePolicy(spec.publicSpec), mutant = structuredClone(spec);
  mutant.privateSpec.laws[0].delta = [-9, 0];
  mutant.privateSpec.laws[1].delay = 2;
  mutant.privateSpec.ambient[0].remotePerTick = -5;
  assert.deepEqual(p05OraclePolicy(mutant.publicSpec), policy);
  assert.equal(policy.length, 2 * (1 + 1) * (2 + 2));
  assert.equal(policy.filter(action => action.kind === 'prepare').length, 4);
  assert.equal(certifyP05(spec).commandUpperBound, policy.length);
  assert.equal(certifyP05(spec).minimality, 'not-claimed');
});

test('independent interpreter charges resource now and applies delayed motion at the specified tick', () => {
  const world = createOracleWorld(fixture({ delay: 2, remoteDelta: 7 }));
  const first = world.step(command);
  assert.equal(first.id, 'r1');
  assert.equal(first.after.ref, 'e0:t1');
  assert.equal(first.after.reserve, 4);
  assert.deepEqual(pos(first.after), [2, 4]);
  assert.equal(first.after.remote, 12);
  assert.deepEqual(pos(world.step(wait).after), [2, 4]);
  const third = world.step(wait);
  assert.deepEqual(pos(third.after), [5, 4]);
  assert.equal(third.after.remote, 23);
});

test('PREPARE is a counted action that resets geometry and clears pending impulses', () => {
  const world = createOracleWorld(fixture({ delay: 2 }));
  world.step(command);
  const reset = world.step(prepare('one'));
  assert.equal(reset.id, 'r2');
  assert.equal(reset.contextId, 'one');
  assert.equal(reset.elapsed, 1);
  assert.equal(reset.after.epoch, 'e1');
  assert.equal(reset.after.tick, 0);
  assert.equal(reset.after.reserve, 5);
  for (let tick = 0; tick < 4; tick++) world.step(wait);
  assert.deepEqual(pos(world.observation()), [2, 4]);
});

test('selected receiver changes while a repeatedly exhausted command has no further effect', () => {
  const spec = fixture({ contexts: [context('a-selected', {}, 'a', 1), context('b-selected', {}, 'b', 1)] });
  const world = createOracleWorld(spec);
  assert.deepEqual(pos(world.step(command).after), [5, 4]);
  const exhausted = world.step(command);
  assert.equal(exhausted.after.reserve, 0);
  assert.deepEqual(pos(exhausted.after), [5, 4]);
  world.step(prepare('b-selected'));
  const other = world.step(command);
  assert.deepEqual(pos(other.after, 'a'), [2, 4]);
  assert.deepEqual(pos(other.after, 'b'), [11, 1]);
});

test('matched WAIT control removes remote cochange and retains the command-caused remote effect', () => {
  const spec = fixture({ delay: 1, remoteDelta: 7, remotePerTick: 9 });
  const result = certifyP05(spec), row = result.expectedAcquisitions[0];
  assert.equal(result.solvable, true);
  assert.equal(row.delay, 1);
  assert.equal(row.remoteDelta, 7);
  assert.equal(row.resourceCost, 1);
  assert.deepEqual(row.delta, [3, 0]);
  assert.equal(verifyP05Claim(spec, result.history, claimFor(row)).valid, true);
});

test('scalar resource and remote effects are acquired without inventing a subject displacement', () => {
  for (const options of [
    { delta: [0, 0], delay: 2, resourceCost: 2, remoteDelta: 0 },
    { delta: [0, 0], delay: 2, resourceCost: 0, remoteDelta: 4 },
  ]) {
    const spec = fixture(options), result = certifyP05(spec), row = result.expectedAcquisitions[0];
    assert.equal(result.solvable, true);
    assert.equal(row.stationary, true);
    assert.equal(row.noEffect, false);
    assert.deepEqual(row.delta, [0, 0]);
    assert.equal(row.delay, options.remoteDelta ? 2 : 0);
    assert.equal(verifyP05Claim(spec, result.history, claimFor(row)).valid, true);
  }
});

test('a fully stationary command remains a separate control, never a successful acquisition', () => {
  const spec = fixture({ delta: [0, 0], resourceCost: 0 }), result = certifyP05(spec);
  assert.equal(result.solvable, false);
  assert.equal(result.reason, 'no-nonzero-effect');
  assert.equal(result.expectedAcquisitions.length, 0);
  assert.equal(result.stationaryAttempts.length, 1);
  const row = result.outcomes[0];
  assert.equal(verifyP05Claim(spec, result.history, claimFor(row, { delay: 0 })).reason,
    'stationary-is-not-an-acquisition');
});

test('budget failure rejects the quota entry without claiming impossibility or a minimal cost', () => {
  const spec = fixture({ commandBudget: 7 }), result = certifyP05(spec);
  assert.equal(result.solvable, false);
  assert.equal(result.reason, 'policy-exceeds-budget');
  assert.equal(result.commandUpperBound, 8);
  assert.equal(result.minimality, 'not-claimed');
  assert.deepEqual(result.history, []);
});

test('a hidden effect beyond the public latency bound invalidates the experiment contract', () => {
  const spec = fixture({ maxLatency: 1, delay: 2 });
  assert.ok(validateP05OracleContract(spec).includes('effect-outside-public-horizon'));
  assert.equal(certifyP05(spec).reason, 'invalid-contract');
  assert.throws(() => createOracleWorld(spec), /effect-outside-public-horizon/);
});

test('a true hidden-law guess without a received experiment is not justified', () => {
  const spec = fixture(), result = certifyP05(spec), claim = claimFor(result.expectedAcquisitions[0]);
  const verdict = verifyP05Claim(spec, [], claim);
  assert.equal(verdict.valid, false);
  assert.equal(verdict.correctEffect, true);
  assert.equal(verdict.justified, false);
  assert.equal(verdict.reason, 'no-complete-matched-public-measurement');
});

test('removing only the decisive return breaks the link even when later before snapshots expose its result', () => {
  const spec = fixture({ delay: 1 }), result = certifyP05(spec), row = result.expectedAcquisitions[0];
  const ablated = result.history.map(receipt => receipt.id === row.decisiveReturnId ? { ...receipt, after: null } : receipt);
  assert.equal(ablated.length, result.history.length);
  assert.equal(ablated.filter(receipt => receipt.after === null).length, 1);
  assert.deepEqual(ablated.map(receipt => [receipt.kind, receipt.command]),
    result.history.map(receipt => [receipt.kind, receipt.command]));
  assert.equal(observedP05OracleOutcomes(spec.publicSpec, ablated).length, 0);
  const verdict = verifyP05Claim(spec, ablated, claimFor(row));
  assert.equal(verdict.correctEffect, true);
  assert.equal(verdict.justified, false);
});

test('uncited decisive evidence and fabricated public observations are rejected independently', () => {
  const spec = fixture(), result = certifyP05(spec), row = result.expectedAcquisitions[0];
  const claim = claimFor(row, { supportingReturnIds: row.supportingReturnIds.filter(id => id !== row.decisiveReturnId) });
  assert.equal(verifyP05Claim(spec, result.history, claim).reason, 'missing-or-uncited-command-effect-return');
  const tampered = structuredClone(result.history);
  tampered.find(receipt => receipt.id === row.decisiveReturnId).after.subjects[0].position[0]++;
  assert.equal(verifyP05Claim(spec, tampered, claimFor(row)).reason, 'history-disagrees-with-independent-replay');
  assert.equal(verifyP05Claim(spec, result.history, claimFor(row, { status: 'recalled' })).reason, 'invalid-claim');
  assert.equal(verifyP05Claim(spec, result.history, claimFor(row, { effectKind: 'resource' })).reason, 'incorrect-effect-kind');
});

test('omitting a terrain condition cannot extend a correct effect to a contradictory public context', () => {
  const spec = fixture({ contexts: [context('firm'), context('loose', { terrain: 'loose' })] });
  spec.privateSpec.laws[1].delta = [0, 2];
  const result = certifyP05(spec), row = result.expectedAcquisitions[0];
  assert.equal(result.solvable, true);
  const claim = claimFor(row, { conditions: row.conditions.filter(condition => condition.field !== 'context.terrain') });
  assert.equal(verifyP05Claim(spec, result.history, claim).reason, 'incorrect-effect-or-overbroad-scope');
});

test('indistinguishable guard descriptors with different geometric laws cannot enter this claim-language quota', () => {
  const contexts = [context('one'), context('two')];
  contexts[1].subjects[0].position = [4, 7];
  const spec = fixture({ contexts });
  spec.privateSpec.laws[1].delta = [-1, 0];
  const result = certifyP05(spec);
  assert.equal(result.solvable, false);
  assert.equal(result.reason, 'scope-not-expressible');
});

test('the selected-role claim requires contrasting actual selections', () => {
  const single = fixture(), singleResult = certifyP05(single);
  assert.equal(verifyP05Claim(single, singleResult.history,
    claimFor(singleResult.expectedAcquisitions[0], { receiver: 'selected' })).reason, 'selection-role-not-contrasted');
  const spec = fixture({ contexts: [context('one', {}, 'a'), context('two', {}, 'b')] }), result = certifyP05(spec);
  assert.equal(verifyP05Claim(spec, result.history,
    claimFor(result.expectedAcquisitions[0], { receiver: 'selected' })).valid, true);
});

test('an old claim never substitutes for a current observation or countertrial', () => {
  const spec = fixture(), result = certifyP05(spec), claim = claimFor(result.expectedAcquisitions[0]);
  spec.publicSpec.priorClaims = [claim];
  assert.equal(verifyP05Claim(spec, [], claim).valid, false);
  const noControl = result.history.map(receipt => receipt.kind === 'wait' && receipt.before.epoch === 'e1'
    ? { ...receipt, after: null } : receipt);
  assert.equal(verifyP05Claim(spec, noControl, claim).justified, false);
});

test('withholding the observation node also removes its before alias without inventing a false replay', () => {
  const spec = fixture({ delay: 1 }), result = certifyP05(spec), row = result.expectedAcquisitions[0];
  const removedRef = result.history.find(receipt => receipt.id === row.decisiveReturnId).after.ref;
  const ablated = result.history.map(receipt => ({ ...receipt,
    ...(receipt.after?.ref === removedRef ? { after: null } : {}),
    ...(receipt.before?.ref === removedRef ? { before: null, beforeRef: removedRef,
      epoch: receipt.before.epoch, tick: receipt.before.tick } : {}),
  }));
  const verdict = verifyP05Claim(spec, ablated, claimFor(row));
  assert.equal(verdict.correctEffect, true);
  assert.equal(verdict.reason, 'no-complete-matched-public-measurement');
  assert.equal(ablated.some(receipt => receipt.after?.ref === removedRef || receipt.before?.ref === removedRef), false);
});

test('all public context-command pairs and ambient contexts need explicit private laws', () => {
  const missingLaw = fixture();
  missingLaw.privateSpec.laws.pop();
  assert.ok(validateP05OracleContract(missingLaw).includes('incomplete-private-law-table'));
  const missingAmbient = fixture();
  missingAmbient.privateSpec.ambient.pop();
  assert.ok(validateP05OracleContract(missingAmbient).includes('incomplete-ambient-law-table'));
});

test('independently implemented world matches the first 80 generated public traces, not hidden witnesses', async () => {
  // These integration imports are deliberately confined to the test. The
  // oracle implementation above was authored before reading the generator.
  const { createLaboratory, generateP05Situation, publicExperiment, randomSource } =
    await import('../scripts/sic-p05-laboratory.mjs');
  let compared = 0;
  for (let family = 1; family <= 8; family++) {
    const draw = randomSource(26112805 + family * 1009);
    for (let index = 0; index < 10; index++) {
      const spec = generateP05Situation(String(family), draw, index);
      const execution = createLaboratory(spec), oracle = createOracleWorld(spec);
      const policy = p05OraclePolicy(spec.publicSpec);
      assert.deepEqual(policy, publicExperiment(spec.publicSpec));
      assert.deepEqual(execution.observation(), oracle.observation());
      for (const action of policy) assert.deepEqual(execution.step(action), oracle.step(action),
        `independent return mismatch: family ${family}, case ${index}`);
      assert.equal(certifyP05(spec).solvable, true);
      compared++;
    }
  }
  assert.equal(compared, 80);
});

test('behavior signature ignores renaming/permutation but detects accessible physical mutations', async () => {
  const { behaviorSignature, generateP05Situation, randomSource, renameAndPermute } =
    await import('../scripts/sic-p05-laboratory.mjs');
  for (let family = 1; family <= 8; family++) {
    const spec = generateP05Situation(String(family), randomSource(26112805 + family * 1009));
    const signature = behaviorSignature(spec).hash;
    assert.equal(behaviorSignature(renameAndPermute(spec, 31 + family)).hash, signature);
    const changed = structuredClone(spec);
    const active = changed.privateSpec.laws.find(law => changed.publicSpec.contexts
      .find(context => context.id === law.contextId).reserve >= law.resourceCost
      && (law.delta[0] !== 0 || law.delta[1] !== 0));
    active.delta[0] += 1000;
    assert.notEqual(behaviorSignature(changed).hash, signature);
  }
  const stationary = generateP05Situation('3', randomSource(26112805));
  const oldSignature = behaviorSignature(stationary).hash;
  const inactive = stationary.privateSpec.laws.find(law => law.delta.every(value => value === 0));
  inactive.delay = stationary.publicSpec.maxLatency;
  assert.equal(behaviorSignature(stationary).hash, oldSignature, 'unobservable delay cannot create a quota entry');
});
