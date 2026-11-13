import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeLabeledComposition } from '../src/logos-engine/v6-labeled-sequence-composition.ts';

type R = Record<string, any>;
function request(query: [boolean | number | null, boolean | number | null] = [true, true]): R {
  return { scope: { epoch: 1, model_revision_ref: 'current-visible-panel', evidence_revision_ref: 'public-observation', input_domain_complete: true },
    grammar: [
      { node_ref: 'a', kind: 'ATOM', feature_ref: 'A', comparator: 'EQ', value: true, child_refs: [] },
      { node_ref: 'b', kind: 'ATOM', feature_ref: 'B', comparator: 'EQ', value: true, child_refs: [] },
      { node_ref: 'not-a', kind: 'NOT', feature_ref: null, comparator: null, value: null, child_refs: ['a'] },
      { node_ref: 'not-b', kind: 'NOT', feature_ref: null, comparator: null, value: null, child_refs: ['b'] },
    ], predicate_root_refs: ['a', 'b', 'not-a', 'not-b'], positive_label_ref: 'positive', negative_label_ref: 'negative',
    examples: [
      { example_ref: 'TT', receipt_ref: 'seen:TT', label_ref: 'positive', sealed: true, epoch: 1 },
      ...['TF', 'FT', 'FF'].map(example => ({ example_ref: example, receipt_ref: 'seen:' + example, label_ref: 'negative', sealed: true, epoch: 1 })),
    ], models: [{ model_ref: 'observed-assignment', measurement_complete: true,
      feature_values: [['TT', 'A', true], ['TT', 'B', true], ['TF', 'A', true], ['TF', 'B', false],
        ['FT', 'A', false], ['FT', 'B', true], ['FF', 'A', false], ['FF', 'B', false], ['query', 'A', query[0]], ['query', 'B', query[1]]],
      submission_preconditions: [['positive', true], ['negative', true]] }], query_example_ref: 'query' };
}
const run = (input: R, options: R = {}, deadline = 300000) => measureNativeLabeledComposition(input, deadline, options, null, () => 0);

test('native conjunction propagates an unresolved query only when its label remains unknown', () => {
  const unknown = run(request([true, null]));
  assert.equal(unknown.induction.status, 'NEEDS_EVIDENCE');
  assert.equal(unknown.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(unknown.induction.values.label_predictions.length, 1);
  assert.equal(unknown.induction.values.label_predictions[0].predicted_label_ref, null);
  assert.equal(unknown.native_composition.complete, false);
  assert.equal(unknown.fit.complete, true, 'Only the fully known training fit is reusable; this does not authorize the unknown query');

  const determined = run(request([false, null]));
  assert.equal(determined.induction.status, 'COMPLETE');
  assert.equal(determined.induction.values.robust_answer_and_submission_agreement, true);
  assert.deepEqual(determined.induction.values.label_predictions.map((row: R) => row.predicted_label_ref), ['negative']);
});

test('unknown training assignments remain incomplete and produce no acquired fit', () => {
  const input = request();
  input.models[0].feature_values.find((row: R) => row[0] === 'TT' && row[1] === 'A')[2] = null;
  const result = run(input);
  assert.equal(result.induction.status, 'NEEDS_EVIDENCE');
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(result.native_composition.complete, false);
  assert.equal(result.fit, null);
});

test('atomic boolean and integer values keep the source exact-type distinction', () => {
  const input = request();
  input.grammar = [{ node_ref: 'number-one', kind: 'ATOM', feature_ref: 'X', comparator: 'EQ', value: 1, child_refs: [] }];
  input.predicate_root_refs = ['number-one'];
  input.examples = [{ example_ref: 'number', receipt_ref: 'actual:number', label_ref: 'positive', sealed: true, epoch: 1 },
    { example_ref: 'boolean', receipt_ref: 'actual:boolean', label_ref: 'negative', sealed: true, epoch: 1 }];
  input.models[0].feature_values = [['number', 'X', 1], ['boolean', 'X', true], ['query', 'X', true]];
  const result = run(input);
  assert.equal(result.induction.status, 'COMPLETE');
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, true);
  assert.equal(result.induction.values.label_predictions[0].predicted_label_ref, 'negative');

  input.grammar[0].comparator = 'GE';
  const unordered = run(input);
  assert.equal(unordered.induction.status, 'NEEDS_EVIDENCE');
  assert.equal(unordered.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(unordered.fit, null);
});

test('known false submission prerequisites do not create actionable agreement', () => {
  const input = request(); input.models[0].submission_preconditions = [['positive', false], ['negative', true]];
  const result = run(input);
  assert.equal(result.induction.status, 'COMPLETE');
  assert.equal(result.induction.cause, 'NATIVE_SUBMISSION_PRECONDITION_FALSE');
  assert.equal(result.induction.values.label_predictions[0].submission_precondition, false);
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(result.induction.values.classification_submission_authorized, false);
});

test('four literals declare exactly sixteen candidate roots without truncation at the root bound', () => {
  const refused = run(request(), { rootBound: 15 });
  assert.equal(refused.induction.cause, 'NATIVE_COMPOSITION_ROOT_BOUND');
  assert.equal(refused.native_composition.candidateRootCount, 16);
  assert.equal(refused.native_composition.examinedRootCount, 0);
  assert.equal(refused.fit, null);
  assert.deepEqual(refused.induction.values.observation_compatible_version_space, []);
  const complete = run(request(), { rootBound: 16 });
  assert.equal(complete.native_composition.candidateRootCount, 16);
  assert.equal(complete.native_composition.examinedRootCount, 16);
  assert.equal(complete.native_composition.complete, true);
});

test('an expired shared deadline returns no fit or partial answer', () => {
  const result = run(request(), {}, 0);
  assert.equal(result.induction.cause, 'NATIVE_COMPOSITION_TIME_BOUND');
  assert.equal(result.fit, null);
  assert.deepEqual(result.induction.values.observation_compatible_version_space, []);
  assert.deepEqual(result.induction.values.label_predictions, []);
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
  assert.throws(() => run(request(), {}, Number.NaN), /finite shared deadline/);
  assert.throws(() => run(request(), {}, Number.POSITIVE_INFINITY), /finite shared deadline/);
});

test('unsealed and other-epoch examples never supply vacuous training agreement', () => {
  const input = request(); input.examples.forEach((example: R, index: number) => index % 2 ? example.epoch = 0 : example.sealed = false);
  const result = run(input);
  assert.equal(result.induction.cause, 'NATIVE_SEALED_LABELED_EXAMPLES_REQUIRED');
  assert.equal(result.native_composition.complete, false);
  assert.equal(result.fit, null);
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
});

test('native fitting and cache reuse do not mutate measured assignments or retained evidence', () => {
  const input = request(), before = structuredClone(input), first = run(input);
  assert.deepEqual(input, before);
  const saved = structuredClone(first.fit);
  const again = measureNativeLabeledComposition(input, 300000, {}, first.fit, () => 0);
  assert.equal(again.native_composition.reused, true);
  assert.deepEqual(first.fit, saved);
  assert.deepEqual(input, before);
});
