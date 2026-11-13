import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';
import { inferLabeledSequence, measureLabeledPredicateInduction } from '../src/logos-engine/v6-labeled-sequence-mechanics.ts';
import { DEFAULT_NATIVE_LABELED_COMPOSITION_OPTIONS, inferComposedLabeledSequence,
  measureNativeLabeledComposition } from '../src/logos-engine/v6-labeled-sequence-composition.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-labeled-composition-reference.json.gz', import.meta.url))).toString()) as R;
const cases = fixture.cases as R[];
const clone = <T>(value: T): T => structuredClone(value);
const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const byId = (id: string): R => {
  const value = cases.find(item => item.id === id); assert.ok(value, id); return value;
};
const conjunction = byId('all_atoms_refuted_but_conjunction_fits');
const disjunction = byId('all_atoms_refuted_but_disjunction_fits');
const ambiguous = byId('equal_training_predictions_diverge_on_query');
const measuredRequest = (c: R): R => ({ ...clone(c.batches[0].request),
  grammar: clone(c.atomicResult.grammar), predicate_root_refs: clone(c.domain.literalRefs) });
const infer = (c: R, prior: R | null = null, options: R = {}): R | null =>
  inferComposedLabeledSequence(clone(c.scene), clone(c.observation), 300000, clone(c.cfg), prior, () => 0, options);
const nodesOf = (c: R): Map<string, R> => {
  const nodes = new Map<string, R>();
  for (const batch of c.batches) for (const node of batch.request.grammar) {
    if (nodes.has(node.node_ref)) assert.deepEqual(nodes.get(node.node_ref), node);
    else nodes.set(node.node_ref, node);
  }
  return nodes;
};

function noAuthority(result: R): void {
  const values = result.induction.values;
  for (const key of ['unique_law_proved', 'rule_adoption_authorized', 'classification_submission_authorized', 'predicted_training_example_created']) {
    assert.equal(values[key], false, key);
  }
  assert.equal(result.induction.descriptive_facts.primitive_release_authorized, false);
  assert.equal(result.native_composition.primitiveReleaseAuthorized, false);
  assert.equal(result.native_composition.uniqueLawClaimed, false);
}

function interrupted(result: R): void {
  assert.equal(result.induction.status, 'NEEDS_EVIDENCE');
  assert.equal(result.induction.domain_complete, false);
  assert.equal(result.native_composition.complete, false);
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
  assert.deepEqual(result.induction.values.observation_compatible_version_space, []);
  assert.deepEqual(result.induction.values.label_predictions, []);
  assert.equal(result.fit, null);
  assert.equal(result.native_composition.fitTrainingReceiptDigest, null);
  assert.ok(result.grammar.every((node: R) => node.kind === 'ATOM' || node.kind === 'NOT'));
  noAuthority(result);
}

test('binary reference uses the unchanged pinned evaluator and explicitly separates its authored grammar from the original caller', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRun, false);
  assert.equal(fixture.qualification.nativeImplementationRun, false);
  assert.equal(fixture.qualification.solvedLevelsClaimed, false);
  assert.equal(fixture.qualification.universalLawClaimed, false);
  assert.match(fixture.qualification.sourceEvaluator, /Unmodified pinned/);
  assert.match(fixture.qualification.grammarGeneration, /not a claim that the original source caller/);
  assert.match(fixture.qualification.wholeDomain, /all source batches complete/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  assert.ok(Object.keys(fixture.sourceHashes).length >= 680);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
    assert.equal(manifest.files[path].sha256, expected, path);
  }
  assert.equal(hash(await readFile(new URL(fixture.generator, root))), fixture.generatorSha256);
  for (const input of fixture.inputs) assert.equal(hash(await readFile(new URL(input.path, root))), input.sha256);
  assert.equal(cases.length, 4);
  assert.equal(cases.reduce((n, c) => n + c.batches.length, 0), 65);
  assert.equal(cases.reduce((n, c) => n + c.domain.rootCount, 0), 7984);
});

for (const c of cases) {
  test(`independent binary domain covers every root exactly once: ${c.id}`, () => {
    const graph = nodesOf(c), literalRefs = c.domain.literalRefs as string[];
    assert.deepEqual(literalRefs, [...literalRefs].sort());
    assert.equal(literalRefs.length, c.atomicResult.grammar.length);
    const expected: string[] = [...literalRefs];
    for (let left = 0; left < literalRefs.length; left++) for (let right = left + 1; right < literalRefs.length; right++) {
      for (const kind of ['AND', 'OR']) {
        const children = [literalRefs[left], literalRefs[right]];
        const nodeRef = 'P_native_binary:' + symbolicDigest([kind, children]);
        expected.push(nodeRef);
        assert.deepEqual(graph.get(nodeRef), { node_ref: nodeRef, kind, feature_ref: null,
          comparator: null, value: null, child_refs: children });
      }
    }
    assert.deepEqual(c.domain.rootRefs, expected);
    assert.equal(new Set(expected).size, expected.length);
    assert.equal(expected.length, literalRefs.length ** 2);
    assert.equal(c.domain.compositionCount, literalRefs.length * (literalRefs.length - 1));
    assert.equal(c.domain.rootDefinitionsSha256, symbolicDigest(expected.map(ref => graph.get(ref))));
    assert.deepEqual(c.batches.flatMap((batch: R) => batch.request.predicate_root_refs), expected);
    const covered = c.batches.flatMap((batch: R) => [
      ...batch.result.values.observation_compatible_version_space,
      ...batch.result.values.elimination_certificates,
    ].map(row => row.predicate_ref));
    assert.equal(covered.length, expected.length);
    assert.deepEqual(new Set(covered), new Set(expected));
    assert.deepEqual(c.aggregate.compatibleVersionSpace, c.batches.flatMap((batch: R) => batch.result.values.observation_compatible_version_space));
    assert.deepEqual(c.aggregate.eliminationCertificates, c.batches.flatMap((batch: R) => batch.result.values.elimination_certificates));
    assert.deepEqual(c.aggregate.labelPredictions, c.batches.flatMap((batch: R) => batch.result.values.label_predictions));
    assert.equal(c.aggregate.allBatchesComplete, true);
    assert.equal(c.aggregate.compatibleCount + c.aggregate.eliminatedCount, expected.length);
  });

  for (const batch of c.batches as R[]) test(`unchanged source evaluator ↔ native faithful evaluator: ${c.id} / batch ${batch.index}`, () => {
    assert.ok(batch.request.predicate_root_refs.length <= 128);
    assert.equal(batch.result.status, 'COMPLETE');
    assert.equal(batch.result.domain_complete, true);
    assert.deepEqual(measureLabeledPredicateInduction(clone(batch.request), () => 0), batch.result);
  });

  test(`native composed fitting retains exactly the independently source-evaluated versions and answers: ${c.id}`, () => {
    const actual = infer(c)!;
    assert.ok(actual);
    assert.deepEqual(actual.source_induction, c.atomicResult.induction, 'The original complete contradiction receipt is preserved separately');
    assert.equal(actual.induction.schema_version, 'logos-engine.native.labeled-binary-composition-result.v1');
    assert.equal(actual.induction.status, 'COMPLETE');
    assert.equal(actual.induction.domain_complete, true);
    assert.deepEqual(actual.induction.values.observation_compatible_version_space, c.aggregate.compatibleVersionSpace);
    assert.deepEqual(actual.induction.values.label_predictions, c.aggregate.labelPredictions);
    assert.equal(actual.induction.values.robust_answer_and_submission_agreement, c.aggregate.robustAgreement);
    assert.equal(actual.native_composition.literalCount, c.domain.literalCount);
    assert.equal(actual.native_composition.candidateRootCount, c.domain.rootCount);
    assert.equal(actual.native_composition.examinedRootCount, c.domain.rootCount);
    assert.equal(actual.native_composition.retainedRootCount, c.aggregate.compatibleCount);
    assert.equal(actual.native_composition.eliminatedRootCount, c.aggregate.eliminatedCount);
    assert.equal(actual.native_composition.complete, true);
    assert.match(actual.native_composition.grammarProjection, /compatible binary nodes only/);
    const graph = nodesOf(c);
    assert.deepEqual(actual.grammar, [...c.atomicResult.grammar,
      ...c.aggregate.compatibleVersionSpace.map((row: R) => graph.get(row.predicate_ref))]);
    assert.equal(actual.training_cache.native_composition.compatible_roots.length, c.aggregate.compatibleCount);
    assert.equal(actual.training_cache.native_composition.complete, true);
    assert.match(actual.scope, /current query only/);
    noAuthority(actual);
  });
}

for (const [c, kind] of [[conjunction, 'AND'], [disjunction, 'OR']] as const) test(`individually refuted literals remain necessary building blocks for ${kind}`, () => {
  assert.equal(c.atomicResult.induction.status, 'COMPLETE');
  assert.equal(c.atomicResult.induction.cause, 'MODEL_CONTRADICTION');
  assert.deepEqual(c.atomicResult.induction.values.observation_compatible_version_space, []);
  const refuted = new Set(c.atomicResult.induction.values.elimination_certificates.map((row: R) => row.predicate_ref));
  assert.equal(refuted.size, c.domain.literalCount);
  const value = infer(c)!;
  const survivors = value.grammar.filter((node: R) => node.kind === kind);
  assert.equal(survivors.length, 9);
  assert.ok(survivors.every((node: R) => node.child_refs.every((ref: string) => refuted.has(ref))));
  assert.equal(value.induction.values.robust_answer_and_submission_agreement, true);
  assert.equal(value.induction.values.label_predictions[0].predicted_label_ref, '14');
});

test('all fitting training signatures may be identical while their current-query predictions disagree', () => {
  const q = measuredRequest(ambiguous), graph = nodesOf(ambiguous);
  const values = new Map(q.models[0].feature_values.map(([example, feature, value]: [string, string, unknown]) => [JSON.stringify([example, feature]), value]));
  // Deliberately scalar and recursive: independent of the production truth-vector fitting implementation.
  const evaluate = (ref: string, example: string): boolean => {
    const node = graph.get(ref)!;
    if (node.kind === 'NOT') return !evaluate(node.child_refs[0], example);
    if (node.kind === 'AND') return node.child_refs.every((child: string) => evaluate(child, example));
    if (node.kind === 'OR') return node.child_refs.some((child: string) => evaluate(child, example));
    const current = values.get(JSON.stringify([example, node.feature_ref]));
    assert.equal(typeof current, 'number');
    assert.equal(typeof node.value, 'number');
    assert.ok(node.comparator === 'EQ' || node.comparator === 'GE');
    return node.comparator === 'EQ' ? current === node.value : (current as number) >= node.value;
  };
  const refs = ambiguous.aggregate.compatibleVersionSpace.map((row: R) => row.predicate_ref) as string[];
  const signatures = new Set(refs.map(ref => JSON.stringify(q.examples.map((example: R) => evaluate(ref, example.example_ref)))));
  const predictions = new Set(refs.map(ref => evaluate(ref, q.query_example_ref)));
  assert.equal(refs.length, 18);
  assert.equal(signatures.size, 1, 'Quotienting by training outcomes would retain only one signature');
  assert.equal(predictions.size, 2, 'Both alternatives must remain when the current query separates them');
  assert.ok(ambiguous.batches.some((batch: R) => batch.result.values.robust_answer_and_submission_agreement));
  assert.equal(ambiguous.aggregate.robustAgreement, false, 'Agreement within one batch is not global agreement');
  const actual = infer(ambiguous)!;
  assert.equal(actual.native_composition.retainedRootCount, 18);
  assert.equal(actual.native_composition.examinedRootCount, 784);
  assert.equal(actual.induction.cause, 'NATIVE_COMPOSITION_QUERY_DISAGREEMENT');
  assert.equal(actual.induction.values.robust_answer_and_submission_agreement, false);
});

test('a native fit may be reused but every changed current query is remeasured and re-evaluated', () => {
  const first = infer(disjunction)!;
  const changed = clone(disjunction);
  changed.scene.query.words[0].values = [0];
  changed.observation.observation_ref += ':later-query';
  changed.observation.frame_hash = 'changed-public-query';
  const second = infer(changed, clone(first.training_cache))!;
  assert.equal(second.training_reused, true);
  assert.equal(second.native_composition.reused, true);
  assert.deepEqual(second.training_cache.native_composition, first.training_cache.native_composition);
  assert.deepEqual(second.induction.values.observation_compatible_version_space, first.induction.values.observation_compatible_version_space);
  assert.notDeepEqual(second.query_features, first.query_features);
  assert.equal(first.induction.values.label_predictions[0].predicted_label_ref, '14');
  assert.ok(second.induction.values.label_predictions.every((row: R) => row.predicted_label_ref === '15'));
  assert.equal(second.induction.values.robust_answer_and_submission_agreement, true);
  assert.ok(second.native_composition.examinedWork < first.native_composition.examinedWork);
  assert.ok(second.native_composition.examinedWork >= second.native_composition.retainedRootCount);
  // Cached witnesses continue to point to the observations that actually fitted them.
  assert.ok(second.training_cache.native_composition.training_receipt_refs.every((ref: string) => ref.startsWith(disjunction.observation.observation_ref + '/')));
  assert.equal(first.native_composition.candidateEnumeration, 'current_call');
  assert.equal(second.native_composition.candidateEnumeration, 'retained_complete_fit');
  assert.equal(second.native_composition.retainedOriginalWitnesses, true);
  assert.equal(second.native_composition.currentTrainingContentRevalidated, true);
  assert.equal(first.native_composition.fitTrainingReceiptDigest, first.native_composition.currentTrainingReceiptDigest);
  assert.equal(second.native_composition.fitTrainingReceiptDigest, first.native_composition.fitTrainingReceiptDigest);
  assert.notEqual(second.native_composition.currentTrainingReceiptDigest, first.native_composition.currentTrainingReceiptDigest);
  const currentReceipts = second.training_cache.native_composition.training_receipt_refs.map((ref: string) =>
    ref.replace(disjunction.observation.observation_ref + '/', changed.observation.observation_ref + '/'));
  assert.equal(second.native_composition.currentTrainingReceiptDigest, symbolicDigest(currentReceipts));
  noAuthority(second);
});

const evidenceChanges: [string, (q: R) => void][] = [
  ['epoch', q => { q.scope.epoch++; q.examples.forEach((row: R) => { row.epoch++; }); }],
  ['context', q => { q.scope.model_revision_ref += ':different-context'; }],
  ['assignment identity', q => { q.models[0].model_ref += ':different-assignment'; }],
  ['training values', q => { q.models[0].feature_values.find((row: any[]) => row[0] !== q.query_example_ref && row[1] === 'COUNT:1')[2] = 2; }],
  ['training labels', q => { q.examples[0].label_ref = q.negative_label_ref; }],
  ['grammar node content', q => { q.grammar.find((node: R) => node.kind === 'ATOM').value = 99; }],
  ['literal root domain', q => { q.predicate_root_refs = q.predicate_root_refs.slice(1); }],
  ['positive/negative interpretation', q => { [q.positive_label_ref, q.negative_label_ref] = [q.negative_label_ref, q.positive_label_ref]; }],
];
for (const [name, change] of evidenceChanges) test(`a prior fitting cache is invalidated by changed ${name}`, () => {
  const q = measuredRequest(conjunction), first = measureNativeLabeledComposition(q, 300000, {}, null, () => 0);
  const changed = clone(q); change(changed);
  const second = measureNativeLabeledComposition(changed, 300000, {}, clone(first.fit), () => 0);
  assert.equal(first.native_composition.reused, false);
  assert.equal(second.native_composition.reused, false);
  assert.ok(second.native_composition.examinedWork > 0);
  assert.equal(second.induction.status, 'COMPLETE');
  assert.notEqual(second.fit.input_ref, first.fit.input_ref);
  const fresh = measureNativeLabeledComposition(changed, 300000, {}, null, () => 0);
  assert.deepEqual(second, fresh, 'An incompatible cache cannot change the fresh result');
});

test('every declared native option participates in the cache policy, even when its bound does not truncate this case', () => {
  const q = measuredRequest(conjunction), first = measureNativeLabeledComposition(q, 300000, {}, null, () => 0);
  const changes: R[] = [
    { connectives: ['AND'] }, { literalBound: 127 }, { rootBound: 16383 }, { retainedBound: 255 },
    { exampleBound: 127 }, { nodeBound: 99999 }, { timeBoundMs: 299999 },
  ];
  for (const options of changes) {
    const second = measureNativeLabeledComposition(q, 300000, options, clone(first.fit), () => 0);
    assert.equal(second.native_composition.reused, false, JSON.stringify(options));
    assert.equal(second.induction.status, 'COMPLETE');
    assert.notEqual(second.native_composition.policy_ref, first.native_composition.policy_ref);
    assert.notEqual(second.fit.input_ref, first.fit.input_ref);
  }
  assert.equal(Object.keys(DEFAULT_NATIVE_LABELED_COMPOSITION_OPTIONS).length, changes.length);
});

test('a declared connective subset is complete only for that subset, and cannot borrow a fitting excluded operator', () => {
  const q = measuredRequest(disjunction);
  const onlyAnd = measureNativeLabeledComposition(q, 300000, { connectives: ['AND'] }, null, () => 0);
  const onlyOr = measureNativeLabeledComposition(q, 300000, { connectives: ['OR'] }, null, () => 0);
  for (const result of [onlyAnd, onlyOr]) {
    assert.equal(result.native_composition.candidateRootCount, 210);
    assert.equal(result.native_composition.examinedRootCount, 210);
    assert.equal(result.native_composition.complete, true);
    assert.equal(result.induction.status, 'COMPLETE');
  }
  assert.equal(onlyAnd.native_composition.retainedRootCount, 0);
  assert.equal(onlyAnd.induction.cause, 'NATIVE_COMPOSITION_MODEL_CONTRADICTION');
  assert.equal(onlyAnd.induction.values.robust_answer_and_submission_agreement, false);
  assert.equal(onlyOr.native_composition.retainedRootCount, 9);
  assert.equal(onlyOr.induction.values.robust_answer_and_submission_agreement, true);
  assert.notEqual(onlyAnd.native_composition.grammar_ref, onlyOr.native_composition.grammar_ref);
});

test('fit schema and acquired integrity failures force recomputation instead of retaining an altered survivor list', () => {
  const q = measuredRequest(conjunction), first = measureNativeLabeledComposition(q, 300000, {}, null, () => 0);
  const mutations: ((fit: R) => void)[] = [
    fit => { fit.schema += ':old'; },
    fit => { fit.compatible_roots = fit.compatible_roots.slice(0, 1); },
    fit => { fit.complete = false; },
    fit => { fit.elimination_witness_digest = 'modified'; },
  ];
  for (const mutate of mutations) {
    const fit = clone(first.fit); mutate(fit);
    const result = measureNativeLabeledComposition(q, 300000, {}, fit, () => 0);
    assert.equal(result.native_composition.reused, false);
    assert.deepEqual(result, first);
  }
});

test('a fitting cache never caches readiness of the currently observed submission control', () => {
  const q = measuredRequest(conjunction), first = measureNativeLabeledComposition(q, 300000, {}, null, () => 0);
  q.models[0].submission_preconditions.forEach((row: any[]) => { row[1] = false; });
  const result = measureNativeLabeledComposition(q, 300000, {}, first.fit, () => 0);
  assert.equal(result.native_composition.reused, true);
  assert.equal(result.induction.status, 'COMPLETE');
  assert.equal(result.induction.cause, 'NATIVE_SUBMISSION_PRECONDITION_FALSE');
  assert.ok(result.induction.values.label_predictions.every((row: R) => row.submission_precondition === false));
  assert.equal(result.induction.values.robust_answer_and_submission_agreement, false);
  noAuthority(result);
});

test('exhausting any native bound clears partial fitting, survivors, predictions and cache', () => {
  const q = measuredRequest(conjunction);
  const limits: [R, string][] = [
    [{ literalBound: 19 }, 'NATIVE_COMPOSITION_LITERAL_BOUND'],
    [{ rootBound: 399 }, 'NATIVE_COMPOSITION_ROOT_BOUND'],
    [{ retainedBound: 1 }, 'NATIVE_COMPOSITION_RETAINED_BOUND'],
    [{ exampleBound: 4 }, 'NATIVE_COMPOSITION_EXAMPLE_BOUND'],
    [{ nodeBound: 1 }, 'NATIVE_COMPOSITION_NODE_BOUND'],
  ];
  for (const [options, cause] of limits) {
    const value = measureNativeLabeledComposition(q, 300000, options, null, () => 0);
    interrupted(value); assert.equal(value.induction.cause, cause);
  }
  let tick = 0;
  const timed = measureNativeLabeledComposition(q, 300000, { timeBoundMs: 1 }, null, () => tick++);
  interrupted(timed); assert.equal(timed.induction.cause, 'NATIVE_COMPOSITION_TIME_BOUND');
});

test('an interruption during current-query evaluation discards even a complete newly computed or reused fit', () => {
  const q = measuredRequest(conjunction), complete = measureNativeLabeledComposition(q, 300000, {}, null, () => 0);
  const duringQuery = measureNativeLabeledComposition(q, 300000, { nodeBound: complete.native_composition.examinedWork - 1 }, null, () => 0);
  interrupted(duringQuery);
  assert.equal(duringQuery.native_composition.examinedRootCount, 400, 'Training enumeration had already completed');
  assert.equal(duringQuery.induction.frontier.work.stage, 'compatible_current_query');
  let tick = 0;
  const reused = measureNativeLabeledComposition(q, 5, {}, complete.fit, () => tick++);
  interrupted(reused);
  assert.equal(reused.native_composition.reused, true, 'The cache was validated before the current query interrupted');
  assert.equal(reused.native_composition.examinedRootCount, 400);
});

test('the extension activates only for a complete atomic contradiction, preserving an existing atomic answer or ambiguity', () => {
  const fitting = clone(conjunction); fitting.cfg.features = ['LENGTH'];
  const unsure = clone(conjunction);
  unsure.scene.panels[0].words = [{ values: [0, 1], boxes: [] }];
  unsure.scene.panels[1].words = [{ values: [0, 2], boxes: [] }];
  unsure.scene.query.words[0].values = [0, 1, 2];
  unsure.scene.context_ref = symbolicDigest([unsure.scene.panels, unsure.scene.buttons]);
  for (const [c, agreement] of [[fitting, true], [unsure, false]] as const) {
    const source = inferLabeledSequence(clone(c.scene), clone(c.observation), 300000, clone(c.cfg), null, () => 0)!;
    assert.equal(source.induction.status, 'COMPLETE');
    assert.ok(source.induction.values.observation_compatible_version_space.length > 0);
    assert.equal(source.induction.values.robust_answer_and_submission_agreement, agreement);
    const value = infer(c)!;
    assert.deepEqual(value, source);
    assert.equal(Object.hasOwn(value, 'native_composition'), false);
  }
  const outsideAtomicBound = clone(conjunction); outsideAtomicBound.cfg.root_bound = 1;
  assert.equal(infer(outsideAtomicBound), null);
});
