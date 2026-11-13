/** Explicit native extension of the pinned atomic/complement learner.
 * Its finite language contains every supplied literal and one AND/OR node over
 * each unordered pair of distinct literals. No fitting prefix authorizes an
 * answer; all compatible expressions remain distinct until the current query.
 */
import { compareUnicode } from './canonical.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { inferLabeledSequence, labeledSequenceScope } from './v6-labeled-sequence-mechanics.ts';

type R = Record<string, any>;
type Clock = () => number;
type Scalar = boolean | number | string | null;
type Truth = boolean | null;
type Vector = { yes: bigint; no: bigint };
type Root = { ref: string; kind: 'LITERAL'; literal: string } | { ref: string; kind: 'AND' | 'OR'; children: [string, string] };
export interface NativeLabeledCompositionOptions {
  readonly connectives: readonly ('AND' | 'OR')[];
  readonly literalBound: number;
  readonly rootBound: number;
  readonly retainedBound: number;
  readonly exampleBound: number;
  readonly nodeBound: number;
  readonly timeBoundMs: number;
}
export const DEFAULT_NATIVE_LABELED_COMPOSITION_OPTIONS: Readonly<NativeLabeledCompositionOptions> = Object.freeze({
  connectives: Object.freeze(['AND', 'OR'] as const), literalBound: 128, rootBound: 16384,
  retainedBound: 256, exampleBound: 128, nodeBound: 100000, timeBoundMs: 300000,
});
const RESULT_SCHEMA = 'logos-engine.native.labeled-binary-composition-result.v1';
const RECEIPT_SCHEMA = 'logos-engine.native.labeled-binary-composition.v1';
const FIT_SCHEMA = 'logos-engine.native.labeled-binary-composition-fit.v1';
const OPERATION = 'mechanics.native_labeled_sequence.bounded_binary_composition';
const GRAMMAR_SCOPE = 'Every supplied ATOM or NOT(ATOM) literal, plus one AND/OR over every unordered pair of distinct literals; no deeper composition.';
const pairKey = (example: string, feature: string) => JSON.stringify([example, feature]);
const clone = <T>(value: T): T => structuredClone(value);

class Interrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R = {}) { super(cause); this.cause = cause; this.frontier = frontier; }
}
class Budget {
  examined = 0;
  private readonly deadline: number;
  private readonly options: NativeLabeledCompositionOptions;
  private readonly now: Clock;
  constructor(options: NativeLabeledCompositionOptions, deadlineMs: number, now: Clock) {
    this.options = options; this.now = now;
    this.deadline = Math.min(deadlineMs, now() + options.timeBoundMs);
  }
  check(frontier: R = {}): void {
    if (this.now() >= this.deadline) throw new Interrupted('NATIVE_COMPOSITION_TIME_BOUND', frontier);
  }
  visit(frontier: R = {}): void {
    if (this.examined >= this.options.nodeBound) throw new Interrupted('NATIVE_COMPOSITION_NODE_BOUND', frontier);
    this.check(frontier); this.examined++;
  }
}
function optionsOf(input: Partial<NativeLabeledCompositionOptions>): NativeLabeledCompositionOptions {
  const options = { ...DEFAULT_NATIVE_LABELED_COMPOSITION_OPTIONS, ...input };
  if (Object.keys(input).some(key => !Object.hasOwn(DEFAULT_NATIVE_LABELED_COMPOSITION_OPTIONS, key))) throw new TypeError('Unknown native composition option');
  for (const [key, max] of [['literalBound', 128], ['rootBound', 16384], ['retainedBound', 16384], ['exampleBound', 128], ['nodeBound', 100000], ['timeBoundMs', 300000]] as const) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 1 || options[key] > max) throw new TypeError('Native composition bounds must be exact positive bounded integers');
  }
  if (!Array.isArray(options.connectives) || !options.connectives.length || options.connectives.length > 2
    || new Set(options.connectives).size !== options.connectives.length || options.connectives.some(kind => kind !== 'AND' && kind !== 'OR')) throw new TypeError('Native composition connectives must be a distinct declared subset of AND/OR');
  return { ...options, connectives: ['AND', 'OR'].filter(kind => options.connectives.includes(kind as 'AND' | 'OR')) as ('AND' | 'OR')[] };
}
function scalar(value: unknown): asserts value is Scalar {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || Number.isSafeInteger(value)) return;
  throw new TypeError('Native composition uses only canonical boolean, exact integer, string or null features');
}
function ref(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.trim() !== value) throw new TypeError('Native composition requires nonempty canonical references');
}
function atomValue(node: R, current: Scalar): Truth {
  if (current === null || node.value === null) return null;
  if (node.comparator === 'EQ') return typeof current === typeof node.value && current === node.value;
  if (node.comparator === 'NE') return typeof current !== typeof node.value || current !== node.value;
  if (typeof current !== 'number' || typeof node.value !== 'number') return null;
  if (node.comparator === 'LT') return current < node.value;
  if (node.comparator === 'LE') return current <= node.value;
  if (node.comparator === 'GT') return current > node.value;
  return current >= node.value;
}
function combined(kind: 'AND' | 'OR', left: Truth, right: Truth): Truth {
  if (kind === 'AND') return left === false || right === false ? false : left === null || right === null ? null : true;
  return left === true || right === true ? true : left === null || right === null ? null : false;
}
function composedRef(kind: 'AND' | 'OR', children: [string, string]): string {
  return 'P_native_binary:' + identity([kind, children]);
}
function composedNode(root: Root): R | null {
  return root.kind === 'LITERAL' ? null : { node_ref: root.ref, kind: root.kind, feature_ref: null,
    comparator: null, value: null, child_refs: [...root.children] };
}
function fitPayload(fit: R): R { return Object.fromEntries(Object.entries(fit).filter(([key]) => key !== 'fit_ref')); }

/** A single measured assignment, explicit literal roots, and real labeled examples.
 * Input uses the source request's grammar/examples/models fields. Native bounds,
 * result schema and grammar domain are separate from the source 128-root method.
 */
export function measureNativeLabeledComposition(input: R, deadlineMs: number,
  suppliedOptions: Partial<NativeLabeledCompositionOptions> = {}, priorFit: R | null = null,
  now: Clock = () => performance.now()): R {
  if (!Number.isFinite(deadlineMs)) throw new TypeError('Native composition requires a finite shared deadline');
  const options = optionsOf(suppliedOptions), budget = new Budget(options, deadlineMs, now);
  const q = input, scope = q.scope;
  if (!scope || !Number.isSafeInteger(scope.epoch) || scope.epoch < 0) throw new TypeError('Native composition needs a current scoped epoch');
  for (const value of [scope.model_revision_ref, scope.observation_ref ?? scope.evidence_revision_ref,
    q.positive_label_ref, q.negative_label_ref, q.query_example_ref]) ref(value);
  if (q.positive_label_ref === q.negative_label_ref) throw new TypeError('Native composition needs distinct labels');
  if (!Array.isArray(q.grammar) || !Array.isArray(q.predicate_root_refs) || !Array.isArray(q.examples)
    || !Array.isArray(q.models) || q.models.length !== 1 || q.grammar.length > 4096
    || q.predicate_root_refs.length > 4096 || q.examples.length > 4096) throw new TypeError('Native composition needs one explicit bounded measured assignment');
  const model: R = q.models[0]; ref(model.model_ref);
  if (typeof model.measurement_complete !== 'boolean' || !Array.isArray(model.feature_values)
    || !Array.isArray(model.submission_preconditions) || model.feature_values.length > 4096
    || model.submission_preconditions.length > 128) throw new TypeError('Native composition assignment is incomplete or outside the bounded domain');
  const graph = new Map<string, R>();
  for (const node of q.grammar as R[]) {
    ref(node.node_ref);
    if (graph.has(node.node_ref) || !Array.isArray(node.child_refs)) throw new TypeError('Native literal identity must be distinct');
    if (node.kind === 'ATOM') {
      ref(node.feature_ref); scalar(node.value);
      if (node.child_refs.length || !['EQ', 'NE', 'LT', 'LE', 'GT', 'GE'].includes(node.comparator)) throw new TypeError('Native literal atom has invalid declared comparison');
    } else if (node.kind !== 'NOT' || node.child_refs.length !== 1) throw new TypeError('Native grammar accepts only atomic literals and their direct complements');
    graph.set(node.node_ref, node);
  }
  const literals: string[] = [...q.predicate_root_refs]; literals.forEach(ref); literals.sort(compareUnicode);
  if (!literals.length || new Set(literals).size !== literals.length) throw new TypeError('Native literal root identities must be distinct and nonempty');
  for (const root of literals) {
    const node = graph.get(root);
    if (!node || node.kind === 'NOT' && graph.get(node.child_refs[0])?.kind !== 'ATOM') throw new TypeError('Native root must be an atom or its direct complement');
  }
  const actual = (q.examples as R[]).filter(example => example.sealed === true && example.epoch === scope.epoch);
  const exampleRefs = new Set<string>();
  for (const example of actual) {
    ref(example.example_ref); ref(example.receipt_ref);
    if (exampleRefs.has(example.example_ref) || ![q.positive_label_ref, q.negative_label_ref].includes(example.label_ref)) throw new TypeError('Native measured example has ambiguous identity or label');
    exampleRefs.add(example.example_ref);
  }
  const features = new Map<string, Scalar>();
  for (const item of model.feature_values as unknown[]) {
    if (!Array.isArray(item) || item.length !== 3) throw new TypeError('Native feature assignment requires an explicit triple');
    const [example, feature, value] = item; ref(example); ref(feature); scalar(value);
    const key = pairKey(example, feature);
    if (features.has(key)) throw new TypeError('Native feature assignment has duplicate identities');
    features.set(key, value);
  }
  const prerequisites = new Map<string, boolean | null>();
  for (const item of model.submission_preconditions as unknown[]) {
    if (!Array.isArray(item) || item.length !== 2) throw new TypeError('Native submission prerequisite requires a pair');
    const [label, value] = item; ref(label);
    if (value !== null && typeof value !== 'boolean' || prerequisites.has(label)) throw new TypeError('Native submission prerequisite is ambiguous');
    prerequisites.set(label, value);
  }
  const candidateCount = literals.length + options.connectives.length * literals.length * (literals.length - 1) / 2;
  const descriptor = { schema: RECEIPT_SCHEMA, scope: GRAMMAR_SCOPE, connectives: options.connectives,
    logicalDepthBound: 2, binaryLayers: 1, pairOrder: 'unordered_distinct_literals',
    rootOrder: 'unicode_literals_then_lexicographic_pairs_then_AND_OR', constants: 'supplied_measured_training_constants' };
  const grammarRef = identity([descriptor, literals, q.grammar]);
  const policyRef = identity([FIT_SCHEMA, options]);
  const evidenceRef = identity([scope.epoch, scope.model_revision_ref, q.positive_label_ref, q.negative_label_ref,
    model.model_ref, model.measurement_complete, actual.map(example => [example.example_ref, example.label_ref]),
    (model.feature_values as R[]).filter(item => exampleRefs.has(item[0]))]);
  const inputRef = identity([grammarRef, policyRef, evidenceRef]);
  let examinedRoots = 0, reused = false, eliminatedCount = 0;
  let roots: Root[] = [], fit: R | null = null, eliminationDigest: string | null = null;
  let trainingComplete = model.measurement_complete, version: R[] = [], predictions: R[] = [];

  const answer = (status: string, cause: string, complete: boolean, frontier: R = {}): R => {
    const outcomes = new Set(predictions.map(row => JSON.stringify([row.predicted_label_ref, row.submission_precondition])));
    const robust = status === 'COMPLETE' && complete && version.length > 0 && outcomes.size === 1
      && predictions.length === version.length && predictions.every(row => row.predicted_label_ref !== null && row.submission_precondition === true);
    const receipt = { schema: RECEIPT_SCHEMA, grammar_scope: GRAMMAR_SCOPE, grammar_ref: grammarRef,
      policy_ref: policyRef, evidence_ref: evidenceRef, complete, literalCount: literals.length,
      candidateRootCount: candidateCount, examinedRootCount: examinedRoots, retainedRootCount: version.length,
      eliminatedRootCount: eliminatedCount, examinedWork: budget.examined, reused, bounds: clone(options),
      eliminationWitnessDigest: eliminationDigest, grammarProjection: 'source literal graph plus compatible binary nodes only; the complete candidate domain is the declared language',
      candidateEnumeration: reused ? 'retained_complete_fit' : 'current_call',
      fitTrainingReceiptDigest: fit === null ? null : identity(fit.training_receipt_refs),
      currentTrainingReceiptDigest: identity(actual.map(example => example.receipt_ref)),
      retainedOriginalWitnesses: reused, currentTrainingContentRevalidated: reused,
      observationCompletenessRequired: true, uniqueLawClaimed: false, primitiveReleaseAuthorized: false };
    const induction = { schema_version: RESULT_SCHEMA, scope: clone(scope), operation_ref: OPERATION, mode_ref: 'PREDICT',
      status, cause, domain_complete: complete, examined_count: budget.examined, frontier,
      values: { observation_compatible_version_space: version, label_predictions: predictions,
        robust_answer_and_submission_agreement: robust, elimination_summary: { count: eliminatedCount,
          witness_digest: eliminationDigest, every_elimination_has_actual_training_counterexample: complete && eliminatedCount > 0 },
        unique_law_proved: false, rule_adoption_authorized: false, classification_submission_authorized: false,
        predicted_training_example_created: false },
      descriptive_facts: { native_extension: true, declared_candidate_count: candidateCount, enumerated_candidate_count: examinedRoots,
        complete, reused_training_fit: reused, primitive_release_authorized: false } };
    return { induction, native_composition: receipt, grammar: [...clone(q.grammar), ...roots.map(composedNode).filter(node => node !== null)],
      fit: fit === null ? null : clone(fit) };
  };
  try {
    budget.check();
    if (scope.input_domain_complete !== true) return answer('NEEDS_EVIDENCE', 'NATIVE_INPUT_DOMAIN_INCOMPLETE', false);
    if (!actual.length) return answer('NEEDS_EVIDENCE', 'NATIVE_SEALED_LABELED_EXAMPLES_REQUIRED', false);
    if (literals.length > options.literalBound) throw new Interrupted('NATIVE_COMPOSITION_LITERAL_BOUND');
    if (actual.length > options.exampleBound) throw new Interrupted('NATIVE_COMPOSITION_EXAMPLE_BOUND');
    if (candidateCount > options.rootBound) throw new Interrupted('NATIVE_COMPOSITION_ROOT_BOUND', { required_roots: candidateCount });
    const validCachedRoot = (root: R): boolean => {
      if (root.kind === 'LITERAL') return literals.includes(root.literal) && root.ref === root.literal;
      return options.connectives.includes(root.kind) && Array.isArray(root.children) && root.children.length === 2
        && root.children.every((child: string) => literals.includes(child)) && compareUnicode(root.children[0], root.children[1]) < 0
        && root.ref === composedRef(root.kind, root.children as [string, string]);
    };
    if (priorFit?.schema === FIT_SCHEMA && priorFit.input_ref === inputRef && priorFit.complete === true
      && priorFit.candidate_root_count === candidateCount && priorFit.examined_root_count === candidateCount
      && Array.isArray(priorFit.compatible_roots) && priorFit.compatible_roots.length <= options.retainedBound
      && priorFit.eliminated_root_count + priorFit.compatible_roots.length === candidateCount
      && priorFit.compatible_roots.every(validCachedRoot)
      && new Set(priorFit.compatible_roots.map((root: R) => root.ref)).size === priorFit.compatible_roots.length
      && priorFit.fit_ref === identity(fitPayload(priorFit))) {
      reused = true; roots = clone(priorFit.compatible_roots); fit = clone(priorFit);
      examinedRoots = priorFit.examined_root_count; eliminatedCount = priorFit.eliminated_root_count;
      eliminationDigest = priorFit.elimination_witness_digest;
    } else {
      const vectors = new Map<string, Vector>(), atomVectors = new Map<string, Vector>();
      const all = (1n << BigInt(actual.length)) - 1n;
      let positive = 0n, negative = 0n;
      const firstWitness = new Map<bigint, number>();
      for (const [index, example] of actual.entries()) {
        const bit = 1n << BigInt(index); firstWitness.set(bit, index);
        if (example.label_ref === q.positive_label_ref) positive |= bit; else negative |= bit;
      }
      for (const literal of literals) {
        const node = graph.get(literal)!, atom = node.kind === 'ATOM' ? node : graph.get(node.child_refs[0])!;
        let vector = atomVectors.get(atom.node_ref);
        if (!vector) {
          vector = { yes: 0n, no: 0n };
          for (const [index, example] of actual.entries()) {
            budget.visit({ stage: 'literal_training', literal_ref: literal, example_ref: example.example_ref });
            const value = atomValue(atom, features.get(pairKey(example.example_ref, atom.feature_ref)) ?? null);
            if (value === true) vector.yes |= 1n << BigInt(index);
            else if (value === false) vector.no |= 1n << BigInt(index);
          }
          atomVectors.set(atom.node_ref, vector);
        }
        vectors.set(literal, node.kind === 'ATOM' ? vector : { yes: vector.no, no: vector.yes });
      }
      const witnesses: number[][] = [];
      const accept = (vector: Vector, makeRoot: () => Root): void => {
        budget.visit({ stage: 'candidate_training', candidate_index: examinedRoots });
        const ordinal = examinedRoots++, wrong = vector.yes & negative | vector.no & positive;
        if (wrong !== 0n) { witnesses.push([ordinal, firstWitness.get(wrong & -wrong)!]); eliminatedCount++; return; }
        if ((vector.yes | vector.no) !== all) trainingComplete = false;
        roots.push(makeRoot());
        if (roots.length > options.retainedBound) throw new Interrupted('NATIVE_COMPOSITION_RETAINED_BOUND', { candidate_index: ordinal, retained_count: roots.length });
      };
      for (const literal of literals) accept(vectors.get(literal)!, () => ({ ref: literal, kind: 'LITERAL', literal }));
      for (let left = 0; left < literals.length; left++) for (let right = left + 1; right < literals.length; right++) {
        const leftRef = literals[left]!, rightRef = literals[right]!, a = vectors.get(leftRef)!, b = vectors.get(rightRef)!;
        for (const kind of options.connectives) {
          const vector = kind === 'AND' ? { yes: a.yes & b.yes, no: a.no | b.no } : { yes: a.yes | b.yes, no: a.no & b.no };
          accept(vector, () => ({ ref: composedRef(kind, [leftRef, rightRef]), kind, children: [leftRef, rightRef] }));
        }
      }
      if (examinedRoots !== candidateCount) throw new TypeError('Native composition enumeration did not exhaust the declared domain');
      eliminationDigest = identity([grammarRef, evidenceRef, actual.map(example => example.receipt_ref), witnesses]);
      if (trainingComplete) {
        const value: R = { schema: FIT_SCHEMA, input_ref: inputRef, grammar_ref: grammarRef, policy_ref: policyRef,
          evidence_ref: evidenceRef, complete: true, epoch: scope.epoch, context_ref: scope.model_revision_ref,
          candidate_root_count: candidateCount, examined_root_count: examinedRoots, compatible_roots: clone(roots),
          eliminated_root_count: eliminatedCount, elimination_witness_digest: eliminationDigest,
          training_receipt_refs: actual.map(example => example.receipt_ref), fitting_work: budget.examined };
        fit = { ...value, fit_ref: identity(value) };
      }
    }
    const queryValues = new Map<string, Truth>(), queryAtoms = new Map<string, Truth>();
    const queryLiteral = (literal: string): Truth => {
      if (queryValues.has(literal)) return queryValues.get(literal)!;
      const node = graph.get(literal)!, atom = node.kind === 'ATOM' ? node : graph.get(node.child_refs[0])!;
      if (!queryAtoms.has(atom.node_ref)) {
        budget.visit({ stage: 'literal_current_query', literal_ref: literal });
        queryAtoms.set(atom.node_ref, atomValue(atom, features.get(pairKey(q.query_example_ref, atom.feature_ref)) ?? null));
      }
      const atomic = queryAtoms.get(atom.node_ref)!, value = node.kind === 'ATOM' || atomic === null ? atomic : !atomic;
      queryValues.set(literal, value); return value;
    };
    let queryComplete = true;
    for (const root of roots) {
      budget.visit({ stage: 'compatible_current_query', predicate_ref: root.ref });
      const value = root.kind === 'LITERAL' ? queryLiteral(root.literal) : combined(root.kind, queryLiteral(root.children[0]), queryLiteral(root.children[1]));
      const label = value === null ? null : value ? q.positive_label_ref : q.negative_label_ref;
      const ready = label === null ? null : prerequisites.get(label) ?? null;
      if (value === null || ready === null) queryComplete = false;
      version.push({ model_ref: model.model_ref, predicate_ref: root.ref, observation_check_complete: trainingComplete });
      predictions.push({ model_ref: model.model_ref, predicate_ref: root.ref, query_ref: q.query_example_ref,
        predicted_label_ref: label, submission_precondition: ready, actual_training_receipt: false });
    }
    budget.check();
    const complete = trainingComplete && queryComplete;
    if (!complete) return answer('NEEDS_EVIDENCE', 'NATIVE_INCOMPLETE_LABELED_MEASUREMENTS', false);
    const outcomeCount = new Set(predictions.map(row => JSON.stringify([row.predicted_label_ref, row.submission_precondition]))).size;
    const cause = !version.length ? 'NATIVE_COMPOSITION_MODEL_CONTRADICTION'
      : outcomeCount > 1 ? 'NATIVE_COMPOSITION_QUERY_DISAGREEMENT'
      : predictions.some(row => row.submission_precondition !== true) ? 'NATIVE_SUBMISSION_PRECONDITION_FALSE'
      : 'NATIVE_FINITE_LABELED_COMPOSITION_RESULT';
    return answer('COMPLETE', cause, true);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    // No unfinished fit, partial survivor list or partial agreement is retained.
    roots = []; version = []; predictions = []; fit = null;
    return answer('NEEDS_EVIDENCE', error.cause, false, { restart_native_composition_from_measured_assignments: true,
      completed_training_fit_reused: reused, work: error.frontier });
  }
}

/** Source-compatible default behaviour, with one separately identified fallback. */
export function inferComposedLabeledSequence(scene: R, observation: R, deadlineMs: number, cfg: R,
  prior: R | null = null, now: Clock = () => performance.now(), options: Partial<NativeLabeledCompositionOptions> = {}): R | null {
  const source = inferLabeledSequence(scene, observation, deadlineMs, cfg, prior, now);
  if (!source || source.induction.status !== 'COMPLETE' || source.induction.cause !== 'MODEL_CONTRADICTION'
    || !source.induction.domain_complete || source.induction.values.observation_compatible_version_space.length !== 0) return source;
  const examples: R[] = [], assignments: [string, string, Scalar][] = [];
  for (const panel of scene.panels as R[]) for (const [index] of (panel.words as R[]).entries()) {
    const ref = 'example:' + panel.label + ':' + index;
    examples.push({ example_ref: ref, receipt_ref: observation.observation_ref + '/' + ref,
      label_ref: String(panel.label), sealed: true, epoch: observation.level_epoch });
  }
  for (const row of [...source.training_cache.training_features.values.model_feature_rows, ...source.query_features.values.model_feature_rows] as R[]) {
    for (const feature of row.features as R[]) assignments.push([row.model_ref, feature.feature_ref, feature.value]);
  }
  const labels: string[] = scene.panels.map((panel: R) => String(panel.label));
  const request = { scope: labeledSequenceScope(observation, scene, 'native_binary_induction'), grammar: source.grammar,
    predicate_root_refs: source.grammar.map((node: R) => node.node_ref), positive_label_ref: labels[0], negative_label_ref: labels[1],
    examples, models: [{ model_ref: scene.context_ref, feature_values: assignments,
      submission_preconditions: labels.map(label => [label, true]), measurement_complete: true }], query_example_ref: 'current_query' };
  const composition = measureNativeLabeledComposition(request, deadlineMs, options, prior?.native_composition ?? null, now);
  const cache = { ...source.training_cache, ...(composition.fit === null ? {} : { native_composition: composition.fit }) };
  return { ...source, training_cache: cache, source_induction: source.induction, induction: composition.induction, grammar: composition.grammar,
    native_composition: { ...composition.native_composition, sourceContradictionRef: identity(source.induction) },
    scope: 'Native bounded binary AND/OR language over the measured source literals. Every declared candidate is fitted or explicitly interrupted; retained alternatives are re-evaluated for this current query only. Agreement does not establish a unique universal law.' };
}
