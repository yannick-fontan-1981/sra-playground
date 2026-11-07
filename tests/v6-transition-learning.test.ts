import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as native from '../src/logos-engine/v6-transition-learning.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-transition-reference.json', import.meta.url), 'utf8'));
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/', import.meta.url);
const functions = {
  construct_empirical_rule: native.constructEmpiricalRule,
  predict_candidate_rule: native.predictCandidateRule,
  apply_empirical_rule: native.applyEmpiricalRule,
  validate_empirical_rule: native.validateEmpiricalRule,
  assess_transition: (before, after, action, kwargs) => native.assessTransition(before, after, action, kwargs.prior_rules ?? []),
  construct_property_rule: native.constructPropertyRule,
  predict_property_rule: native.predictPropertyRule,
  apply_property_rule: native.applyPropertyRule,
  validate_property_rule: native.validatePropertyRule,
  assess_property_transition: (before, after, action, kwargs) => native.assessPropertyTransition(before, after, action, kwargs.prior_rules ?? []),
  question_key: native.ControlDependencies.questionKey,
  condition_measure: native.preservationConditionMeasure,
  authorized_revision: native.authorizedPreservationRevision,
  bind: native.bindPreservation,
  check: native.checkPreservation,
};

test('transition-learning fixtures bind all four unchanged original modules', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [name, expected] of Object.entries(fixture.sourceSha256)) {
    assert.equal(createHash('sha256').update(await readFile(new URL(name, source))).digest('hex'), expected, name);
  }
});

for (const item of fixture.cases) {
  test(`V6 original/native transition differential: ${item.name}`, async () => {
    const args = structuredClone(item.args), kwargs = structuredClone(item.kwargs);
    const beforeArguments = structuredClone([args, kwargs]);
    const handler = functions[item.function];
    assert.ok(handler, item.function);
    const invoke = () => {
      if (item.function === 'assess_transition' || item.function === 'assess_property_transition' || item.function === 'check') return handler(...args, kwargs);
      return handler(...args);
    };
    if (item.error) {
      await assert.rejects(async () => invoke(), undefined, `expected ${item.error.type}: ${item.error.message}`);
    } else assert.deepEqual(await invoke(), item.expected);
    assert.deepEqual([args, kwargs], beforeArguments, 'observed inputs and frozen rules must not be mutated');
  });
}

const methods = { change: 'change', offer: 'offer', evaluate: 'evaluate', record_attempt: 'recordAttempt' };
for (const item of fixture.controlCases) {
  test(`V6 original/native intervention memory: ${item.name}`, async () => {
    const control = new native.ControlDependencies();
    for (const [index, step] of item.steps.entries()) {
      const invoke = () => control[methods[step.method]](...structuredClone(step.args));
      if (step.error) await assert.rejects(async () => invoke(), undefined, `step ${index}: ${step.error.message}`);
      else assert.deepEqual((await invoke()) ?? null, step.expected, `step ${index}: ${step.method}`);
      assert.deepEqual({ pending: control.pending, attempted: [...control.attempted].sort() }, step.state, `retained state at step ${index}`);
    }
  });
}

test('the comparison ledger contains real public transitions and all preservation boundary verdicts', () => {
  const actual = fixture.cases.filter(item => item.name.startsWith('actual_public_'));
  assert.equal(actual.length, 12);
  for (const item of actual) assert.equal(item.expected.release_authority, false);
  const acquired = fixture.cases.find(item => item.name === 'changed_positions_acquire_translation');
  assert.equal(acquired.expected.status, 'mechanism_acquired');
  const refuted = fixture.cases.find(item => item.name === 'failed_frozen_translation_refutes');
  assert.equal(refuted.expected.status, 'refuted');
  assert.equal(refuted.expected.predictive_use_allowed, false);
  const invisible = fixture.cases.find(item => item.name === 'fully_occluded_condition_seals_prefix');
  assert.deepEqual(invisible.expected.occluded_unknown_refs, ['P_measured']);
  assert.equal(invisible.expected.admitted, true);
  assert.equal(invisible.expected.seal_prefix, true);
});

test('immutable occurrence caches preserve exact results and never retain mutable measurements or returned rules', async () => {
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  for (const name of ['translation_candidate', 'conditional_prediction', 'contact_push_is_compatibility_not_cause', 'actual_public_HANO_0_mechanisms']) {
    const item = fixture.cases.find(row => row.name === name), args = freeze(structuredClone(item.args)), kwargs = freeze(structuredClone(item.kwargs));
    const invoke = () => item.function === 'assess_transition' ? functions[item.function](...args, kwargs) : functions[item.function](...args);
    const first = await invoke(); assert.deepEqual(first, item.expected, name);
    // A caller may edit an owned returned record; it must not poison a cached
    // normalized mask or rule used by a later invocation on the same objects.
    const corrupt = value => { if (value && typeof value === 'object') { for (const key of Object.keys(value)) { if (key === 'position' && Array.isArray(value[key])) value[key][0] = 999; else corrupt(value[key]); } } };
    corrupt(first); assert.deepEqual(await invoke(), item.expected, `${name}: independent result`);
  }
  const item = fixture.cases.find(row => row.name === 'conditional_prediction'), args = structuredClone(item.args);
  for (const entity of args[1].entities) Object.freeze(entity); // Its coordinate arrays remain mutable.
  await native.predictCandidateRule(...args);
  args[1].entities[0].position[0] += 7;
  assert.deepEqual(await native.predictCandidateRule(...args), await native.predictCandidateRule(...structuredClone(args)));
});
