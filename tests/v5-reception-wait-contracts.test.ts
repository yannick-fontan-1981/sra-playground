import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { normalizeReceptionWaitBudget } from '../src/logos-engine/v5-reception-wait-contracts.ts';

const budget = () => ({ parent_goal_ref: 'G_completion', parent_contribution_ref: 'reception_experiment',
  consumer_request_ref: 'shape:current', level_scope_ref: '1', restore_epoch: 0, observed_clock: 4,
  maximum_total_wait_primitives: 128, spent_wait_primitives: 0, ledger_claim_ref: 'observed_wait:0' });
const source = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reception-service-reference.json.gz', import.meta.url))).toString());

for (const item of source.ledgerCases) test('original ReceptionWaitBudgetD ' + item.id, () => {
  if (item.expectedError) assert.throws(() => normalizeReceptionWaitBudget(item.arguments), RangeError);
  else assert.deepEqual(normalizeReceptionWaitBudget(item.arguments), item.expected);
});

test('V5 reception wait domain preserves the independent source counter bounds', () => {
  for (const [maximum, spent] of [[0, 0], [128, 0], [128, 128], [2, 3]]) {
    const value = { ...budget(), maximum_total_wait_primitives: maximum!, spent_wait_primitives: spent! };
    assert.deepEqual(normalizeReceptionWaitBudget(value), value);
  }
});

test('V5 wait ledger preserves its 128 ceiling despite a larger outer action budget', () => {
  for (const key of ['maximum_total_wait_primitives', 'spent_wait_primitives']) {
    for (const value of [-1, 129, 600, 1.5, NaN, Infinity, -0]) {
      assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), [key]: value }), /outside portable source domain/);
    }
  }
});

test('V5 wait ledger has explicit nonnegative current clock and restore scope', () => {
  for (const key of ['restore_epoch', 'observed_clock']) {
    for (const value of [-1, Number.MAX_SAFE_INTEGER + 1, NaN, 0.5, '0', true]) {
      assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), [key]: value }), /outside portable source domain/);
    }
    assert.equal(normalizeReceptionWaitBudget({ ...budget(), [key]: 0 })[key as 'restore_epoch'], 0);
  }
});

test('V5 wait references are required and normalized, foreign fields rejected', () => {
  for (const key of ['parent_goal_ref', 'parent_contribution_ref', 'consumer_request_ref', 'level_scope_ref', 'ledger_claim_ref']) {
    assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), [key]: '' }), /Ref/);
    assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), [key]: 4 }), /Ref/);
    assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), [key]: undefined }), /Ref/);
  }
  assert.equal(normalizeReceptionWaitBudget({ ...budget(), consumer_request_ref: '  shape:current  ' }).consumer_request_ref, 'shape:current');
  assert.throws(() => normalizeReceptionWaitBudget({ ...budget(), extra: 1 }), /Unknown reception wait field/);
  for (const value of [null, [], 1]) assert.throws(() => normalizeReceptionWaitBudget(value), /requires an object/);
});

test('V5 wait value is immutable and detached from caller ownership', () => {
  const source = budget(), retained = normalizeReceptionWaitBudget(source);
  source.spent_wait_primitives = 100;
  assert.equal(retained.spent_wait_primitives, 0); assert.ok(Object.isFrozen(retained));
  assert.throws(() => { (retained as any).spent_wait_primitives = 100; }, TypeError);
});
