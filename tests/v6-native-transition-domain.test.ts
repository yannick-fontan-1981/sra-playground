import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { assessNativeTransitionDomain } from '../src/logos-engine/v6-native-transition-domain.ts';
import { assessTransition, checkNeutralTransition, NeutralEntityDomainError } from '../src/logos-engine/v6-transition-learning.ts';

type R = Record<string, any>;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-transition-reference.json', import.meta.url), 'utf8'));
const witness = JSON.parse(gunzipSync(await readFile(new URL('../docs/migration/native-campaigns-v35/dico-domain-public-witness.json.gz', import.meta.url))).toString());

for (const item of fixture.cases.filter((row: R) => row.function === 'assess_transition' && !row.error)) {
  test(`V7 bounded assessment preserves in-domain original output: ${item.name}`, async () => {
    const [before, after, command] = structuredClone(item.args), prior = structuredClone(item.kwargs.prior_rules ?? []);
    const originalInputs = structuredClone([before, after, command, prior]);
    const result = await assessNativeTransitionDomain(before, after, command, prior, [], true);
    assert.equal(result.updateRegistries, true);
    const { addressed_assessment, property_rules, ...mechanisms } = result.assessment;
    assert.deepEqual(mechanisms, item.expected);
    if (command.action_ref === 'ACTION6') {
      assert.deepEqual(property_rules, addressed_assessment.property_rules);
      const propertyOracle = fixture.cases.find((row: R) => row.name === item.name.replace(/_mechanisms$/, '_properties'));
      if (propertyOracle) assert.deepEqual(addressed_assessment, propertyOracle.expected);
    }
    assert.deepEqual([before, after, command, prior], originalInputs);
  });
}

test('the public dense witness still receives the exact pure-function refusal', async () => {
  assert.equal(witness.neutralBefore.entities.length, 530);
  assert.equal(witness.neutralAfter.entities.length, 531);
  await assert.rejects(assessTransition(witness.neutralBefore, witness.neutralAfter, witness.command),
    error => error instanceof RangeError && error instanceof NeutralEntityDomainError
      && error.limit === 512 && error.message === 'Neutral entity measurement domain exceeded');
});

test('V7 retains unknown without altering either registry or any public entity', async () => {
  const prior = [fixture.cases.find((row: R) => row.name === 'translation_candidate').expected];
  const property = [fixture.cases.find((row: R) => row.name === 'property_conditional_prediction').args[0]];
  const inputs = structuredClone([witness.neutralBefore, witness.neutralAfter, witness.command, prior, property]);
  const result = await assessNativeTransitionDomain(witness.neutralBefore, witness.neutralAfter, witness.command, prior, property, true);
  assert.equal(result.updateRegistries, false);
  assert.equal(result.assessment.status, 'unknown');
  assert.equal(result.assessment.release_authority, false);
  assert.deepEqual(result.assessment.evidence_refs, [witness.neutralBefore.observation_ref, witness.neutralAfter.observation_ref]);
  assert.deepEqual(result.assessment.domain, { status: 'outside_source_domain', source_limit: 512, before_entities: 530, after_entities: 531,
    source_error: 'Neutral entity measurement domain exceeded', adaptation: 'v7_local_unknown_instead_of_source_caller_abort' });
  assert.deepEqual(result.assessment.retained_rule_ids, prior.map(rule => rule.rule_id));
  assert.deepEqual(result.assessment.addressed_assessment.retained_rule_ids, property.map(rule => rule.rule_id));
  assert.equal(Object.hasOwn(result.assessment, 'empirical_rules'), false, 'No old rule is presented as a new assessment');
  assert.equal(Object.hasOwn(result.assessment, 'property_rules'), false);
  assert.deepEqual(result.predictionChecks.map(check => [check.status, check.validation_performed]), [['unknown', false]]);
  assert.deepEqual([witness.neutralBefore, witness.neutralAfter, witness.command, prior, property], inputs);
  const continuation = await assessNativeTransitionDomain(witness.neutralBefore, witness.neutralAfter, witness.command, prior, property, false);
  assert.deepEqual(continuation.predictionChecks, [], 'Later primitives cannot invent frozen prediction checks');
});

test('512 remains accepted by the source domain and either 513 side remains refused', () => {
  const from = (count: number): R => ({ ...witness.neutralBefore, entities: witness.neutralBefore.entities.slice(0, count) });
  assert.doesNotThrow(() => checkNeutralTransition(from(512) as any, from(512) as any, witness.command));
  for (const [left, right] of [[513, 512], [512, 513]]) {
    assert.throws(() => checkNeutralTransition(from(left!) as any, from(right!) as any, witness.command), NeutralEntityDomainError);
  }
});

test('invalid neutral input and later evidence errors still stop acquisition', async () => {
  const item = fixture.cases.find((row: R) => row.name === 'library_rigid_movement');
  const [before, after, command] = structuredClone(item.args);
  await assert.rejects(assessNativeTransitionDomain({ ...witness.neutralBefore, game_id: 'forbidden' }, witness.neutralAfter, witness.command, [], [], true), /Non-neutral input fields/);
  await assert.rejects(assessNativeTransitionDomain(witness.neutralBefore, witness.neutralAfter, { action_ref: '' }, [], [], true), /Action requires/);
  await assert.rejects(assessNativeTransitionDomain({ ...before, entities: [{ position: [0, 0] }] }, after, command, [], [], true), /measured signature/);
  await assert.rejects(assessNativeTransitionDomain(before, { ...after, observation_ref: before.observation_ref }, command, [], [], true), /distinct observation events/);
  await assert.rejects(assessNativeTransitionDomain(before, after, command, [{}], [], true), TypeError);
});
