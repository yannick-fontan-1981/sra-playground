/** Pinned V5 ordered descriptors and finite labeled-predicate calculations.
 * All eight requested feature kinds and FIT/PREDICT/PARTITION are transferred
 * on canonical JSON contracts with exact JavaScript integers. General Pydantic
 * coercions and arbitrary Python integers are outside that native boundary.
 * Results remain descriptive: agreement never releases a physical command.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';

type R = Record<string, any>;
type Clock = () => number;
type Scalar = boolean | number | string | null;
const FEATURES_OPERATION = 'mechanics.visual_sequence.ordered_predicate_features';
const INDUCTION_OPERATION = 'mechanics.visual_sequence.labeled_predicate_induction';
const FEATURE_KINDS = ['LENGTH', 'TYPE_COUNT', 'ENDPOINT_EQUAL', 'ADJACENT_EQUAL_PAIRS',
  'ALL_ADJACENT_DIFFERENT', 'MAXIMAL_RUNS', 'TYPE_RUN_COUNT', 'ONE_CONTIGUOUS_RUN_PER_TYPE'];
const COMPARISONS = ['EQ', 'NE', 'LT', 'LE', 'GT', 'GE'];
const clone = <T>(value: T): T => structuredClone(value);
const pairKey = (left: string, right: string): string => JSON.stringify([left, right]);

class Interrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R = {}) { super(cause); this.cause = cause; this.frontier = frontier; }
}
class Budget {
  examined = 0;
  private readonly started: number;
  readonly request: R;
  readonly now: Clock;
  constructor(request: R, now: Clock) { this.request = request; this.now = now; this.started = now(); }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new Interrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void { if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND'); }
}

function record(value: unknown, fields?: readonly string[]): asserts value is R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError('Labeled mechanic requires a canonical JSON object');
  if (fields && Object.keys(value).some(key => !fields.includes(key))) throw new TypeError('Labeled mechanic contract contains undeclared fields');
}
function array(value: unknown, minimum: number, maximum: number): asserts value is any[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Labeled mechanic input domain bounds');
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new TypeError('Labeled mechanic requires an exact bounded integer');
}
function flag(value: unknown): asserts value is boolean {
  if (typeof value !== 'boolean') throw new TypeError('Labeled mechanic requires a canonical boolean');
}
function ref(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) throw new TypeError('Labeled mechanic requires a canonical nonempty reference');
}
function nullableRef(value: unknown): void { if (value !== null) ref(value); }
function scalar(value: unknown): asserts value is Scalar {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return;
  throw new TypeError('Labeled scalar domain is boolean, exact integer, string or null');
}
function literal(value: unknown, values: readonly string[]): void {
  if (typeof value !== 'string' || !values.includes(value)) throw new TypeError('Labeled mechanic literal outside declared contract');
}
function distinct(values: readonly unknown[], message: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(message);
}
function normalizeBase(input: R, induction: boolean): R {
  const fields = ['schema_version', 'scope', 'operation_ref', 'mode_ref', 'requested_result_type', 'node_bound', 'depth_bound',
    'domain_bound', 'time_bound_ms', 'observations', 'resume_frontier', 'phase_ref', 'models',
    ...(induction ? ['grammar', 'predicate_root_refs', 'positive_label_ref', 'negative_label_ref', 'examples',
      'query_example_ref', 'contrasts', 'grammar_domain_complete', 'assignment_domain_complete'] : ['queries'])];
  record(input, fields);
  record(input.scope, ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'model_status_ref', 'event_owner_ref',
    'input_domain_complete', 'assumption_refs']);
  const q: R = { schema_version: induction ? 'yf_arc3_v5.labeled_predicate_induction_request_d.v1'
    : 'yf_arc3_v5.ordered_predicate_features_request_d.v1', observations: [], resume_frontier: {},
    ...(induction ? { examples: [], contrasts: [] } : {}), ...clone(input),
    scope: { assumption_refs: [], ...clone(input.scope) } };
  for (const key of ['schema_version', 'operation_ref', 'requested_result_type']) ref(q[key]);
  nullableRef(q.mode_ref);
  for (const [key, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) integer(q[key], 1, maximum);
  for (const key of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'evidence_revision_ref', 'model_revision_ref', 'model_status_ref', 'event_owner_ref']) ref(q.scope[key]);
  integer(q.scope.epoch, 0); flag(q.scope.input_domain_complete);
  array(q.scope.assumption_refs, 0, 64); q.scope.assumption_refs.forEach(ref);
  array(q.observations, 0, 4096); q.observations.forEach((observation: unknown) => record(observation));
  record(q.resume_frontier);
  array(q.models, 1, 128);
  return q;
}
function normalizeFeatures(input: R): R {
  const q = normalizeBase(input, false);
  literal(q.phase_ref, ['FINITE_ORDERED_FEATURES']);
  array(q.queries, 1, 128);
  q.models = q.models.map((model: R) => {
    record(model, ['model_ref', 'tokens', 'order_and_segmentation_complete']);
    const value: R = { tokens: [], ...model };
    ref(value.model_ref); flag(value.order_and_segmentation_complete); array(value.tokens, 0, 4096);
    for (const token of value.tokens) {
      record(token, ['occurrence_ref', 'type_ref', 'visible']);
      ref(token.occurrence_ref); nullableRef(token.type_ref); flag(token.visible);
    }
    distinct(value.tokens.map((token: R) => token.occurrence_ref), 'Ordered token occurrence identity duplicated');
    return value;
  });
  for (const query of q.queries) {
    record(query, ['feature_ref', 'kind', 'type_ref']);
    ref(query.feature_ref); literal(query.kind, FEATURE_KINDS); nullableRef(query.type_ref);
    if (['TYPE_COUNT', 'TYPE_RUN_COUNT'].includes(query.kind) && query.type_ref === null) throw new TypeError('Requested feature has unbound type scope');
  }
  distinct(q.queries.map((query: R) => query.feature_ref), 'Requested feature grammar duplicates an identity');
  return q;
}
function normalizeInduction(input: R): R {
  const q = normalizeBase(input, true);
  literal(q.phase_ref, ['FINITE_LABELED_GRAMMAR']);
  array(q.grammar, 1, 4096); array(q.predicate_root_refs, 1, 128);
  array(q.examples, 0, 4096); array(q.contrasts, 0, 4096);
  ref(q.positive_label_ref); ref(q.negative_label_ref); nullableRef(q.query_example_ref);
  flag(q.grammar_domain_complete); flag(q.assignment_domain_complete);
  q.grammar = q.grammar.map((node: R) => {
    record(node, ['node_ref', 'kind', 'feature_ref', 'comparator', 'value', 'child_refs']);
    const value: R = { child_refs: [], ...node };
    ref(value.node_ref); literal(value.kind, ['ATOM', 'AND', 'OR', 'NOT']); nullableRef(value.feature_ref);
    if (value.comparator !== null) literal(value.comparator, COMPARISONS);
    scalar(value.value); array(value.child_refs, 0, 128); value.child_refs.forEach(ref);
    return value;
  });
  q.predicate_root_refs.forEach(ref);
  const nodes = new Map<string, R>(q.grammar.map((node: R) => [node.node_ref, node]));
  if (nodes.size !== q.grammar.length || q.predicate_root_refs.some((root: string) => !nodes.has(root))
    || q.positive_label_ref === q.negative_label_ref) throw new TypeError('Finite grammar/root/label identity invalid');
  const closed = new Set<string>();
  for (const node of q.grammar as R[]) {
    if (node.kind === 'ATOM' && (node.feature_ref === null || node.comparator === null || node.child_refs.length)) throw new TypeError('Atomic predicate needs only its declared feature/comparator');
    if (node.kind === 'NOT' && node.child_refs.length !== 1 || ['AND', 'OR'].includes(node.kind) && !node.child_refs.length) throw new TypeError('Licensed logical predicate arity invalid');
    const pending: [string, boolean][] = [[node.node_ref, false]], active = new Set<string>();
    while (pending.length) {
      const [current, leaving] = pending.pop()!;
      if (leaving) { active.delete(current); closed.add(current); continue; }
      if (closed.has(current)) continue;
      if (!nodes.has(current) || active.has(current)) throw new TypeError('Grammar is not an acyclic supplied expression graph');
      active.add(current); pending.push([current, true]);
      for (const child of nodes.get(current)!.child_refs) pending.push([child, false]);
    }
  }
  for (const example of q.examples) {
    record(example, ['example_ref', 'receipt_ref', 'label_ref', 'sealed', 'epoch']);
    ref(example.example_ref); ref(example.receipt_ref); ref(example.label_ref); flag(example.sealed); integer(example.epoch, 0);
    if (![q.positive_label_ref, q.negative_label_ref].includes(example.label_ref)) throw new TypeError('Actual label outside the supplied binary class domain');
  }
  for (const contrast of q.contrasts) {
    record(contrast, ['example_ref', 'actual_observation_channel_ref', 'descriptive_only']);
    ref(contrast.example_ref); nullableRef(contrast.actual_observation_channel_ref); flag(contrast.descriptive_only);
  }
  q.models = q.models.map((model: R) => {
    record(model, ['model_ref', 'feature_values', 'submission_preconditions', 'measurement_complete']);
    const value: R = { feature_values: [], submission_preconditions: [], ...model };
    ref(value.model_ref); flag(value.measurement_complete);
    array(value.feature_values, 0, 4096); array(value.submission_preconditions, 0, 128);
    for (const assignment of value.feature_values) {
      array(assignment, 3, 3); ref(assignment[0]); ref(assignment[1]); scalar(assignment[2]);
    }
    for (const prerequisite of value.submission_preconditions) {
      array(prerequisite, 2, 2); ref(prerequisite[0]); if (prerequisite[1] !== null) flag(prerequisite[1]);
    }
    distinct(value.feature_values.map((assignment: any[]) => pairKey(assignment[0], assignment[1])), 'Joint feature assignment duplicated');
    distinct(value.submission_preconditions.map((prerequisite: any[]) => prerequisite[0]), 'Submission precondition duplicated');
    return value;
  });
  return q;
}

function result(q: R, status: string, cause: string, values: R = {}, complete = false, examined = 0, frontier: R = {}): R {
  const facts: R = {};
  for (const key of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref']) facts[key] = q.scope[key];
  Object.assign(facts, { operation_ref: q.operation_ref, mode_ref: q.mode_ref, status, cause, domain_complete: complete,
    examined_count: examined, primitive_release_authorized: false, retained_model_refs: q.models.map((model: R) => model.model_ref) });
  return { schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope: clone(q.scope), operation_ref: q.operation_ref,
    mode_ref: q.mode_ref, status, cause, values, domain_complete: complete, examined_count: examined, frontier,
    descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null };
}
function validate(q: R, operation: string, modes: readonly string[]): R | null {
  if (q.operation_ref !== operation || !modes.includes(q.mode_ref) || q.requested_result_type !== 'DMechanicalResult') return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (new Set(q.models.map((model: R) => model.model_ref)).size !== q.models.length) return result(q, 'NEEDS_EVIDENCE', 'DUPLICATE_MODEL_IDENTITY');
  return null;
}

function orderedFeatureValues(model: R, queries: readonly R[], budget: Budget): R[] {
  const tokens: R[] = model.tokens, complete = model.order_and_segmentation_complete;
  const known = tokens.map(token => token.visible && token.type_ref !== null), fullyRead = complete && known.every(Boolean);
  const counts = new Map<string, number>();
  for (const [index, token] of tokens.entries()) {
    budget.visit({ stage: 'requested_ordered_token', model_ref: model.model_ref, index });
    if (known[index]) counts.set(token.type_ref, (counts.get(token.type_ref) ?? 0) + 1);
  }
  const adjacent: R[] = [];
  for (let i = 0; i < tokens.length - 1; i++) adjacent.push({ positions: [i, i + 1],
    equal: known[i] && known[i + 1] && complete ? tokens[i]!.type_ref === tokens[i + 1]!.type_ref : null });
  const runs: R[] = [];
  if (fullyRead) for (const [index, token] of tokens.entries()) {
    const last = runs.at(-1);
    if (!last || last.type_ref !== token.type_ref) runs.push({ type_ref: token.type_ref, first_position: index, last_position: index, length: 1 });
    else { last.last_position = index; last.length++; }
  }
  const runCounts = new Map<string, number>();
  for (const run of runs) runCounts.set(run.type_ref, (runCounts.get(run.type_ref) ?? 0) + 1);
  const rows: R[] = [];
  for (const query of queries) {
    budget.visit({ stage: 'requested_feature', feature_ref: query.feature_ref });
    let value: unknown = null, witnesses: number[][] = [], lower: number | null = null, upper: number | null = null;
    if (query.kind === 'LENGTH') {
      value = complete ? tokens.length : null; lower = tokens.length; upper = complete ? tokens.length : null;
    } else if (query.kind === 'TYPE_COUNT') {
      lower = counts.get(query.type_ref) ?? 0;
      upper = complete ? lower + known.filter(item => !item).length : null;
      value = fullyRead ? lower : null;
    } else if (query.kind === 'ENDPOINT_EQUAL') {
      if (complete && tokens.length && known[0] && known.at(-1)) {
        value = tokens[0]!.type_ref === tokens.at(-1)!.type_ref;
        if (!value) witnesses.push([0, tokens.length - 1]);
      }
    } else if (query.kind === 'ADJACENT_EQUAL_PAIRS') value = complete ? adjacent : null;
    else if (query.kind === 'ALL_ADJACENT_DIFFERENT') {
      witnesses = adjacent.filter(row => row.equal === true).map(row => row.positions);
      value = witnesses.length ? false : fullyRead ? true : null;
    } else if (query.kind === 'MAXIMAL_RUNS') value = fullyRead ? runs : null;
    else if (query.kind === 'TYPE_RUN_COUNT') value = fullyRead ? runCounts.get(query.type_ref) ?? 0 : null;
    else if (fullyRead) {
      const repeated = new Set([...runCounts.entries()].filter(([_key, count]) => count > 1).map(([key]) => key));
      value = repeated.size === 0;
      witnesses = runs.filter(run => repeated.has(run.type_ref)).map(run => [run.first_position, run.last_position]);
    }
    rows.push({ feature_ref: query.feature_ref, kind: query.kind, value, lower_bound: lower,
      upper_bound: upper, counterexample_positions: witnesses, requested_type_ref: query.type_ref });
  }
  return rows;
}

/** Complete requested ordered-feature calculation on the declared native domain. */
export function measureOrderedPredicateFeatures(input: R, now: Clock = () => performance.now()): R {
  const q = normalizeFeatures(input), refusal = validate(q, FEATURES_OPERATION, ['EVALUATE']);
  if (refusal) return refusal;
  if (Math.max(q.models.length, q.models.reduce((sum: number, model: R) => sum + model.tokens.length, 0), q.queries.length) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (Object.keys(q.resume_frontier).length) return result(q, 'NEEDS_EVIDENCE', 'RESTART_ORDERED_FEATURES_FROM_ASSIGNMENTS');
  const budget = new Budget(q, now);
  try {
    const rows: R[] = []; let unknown = false;
    for (const model of q.models as R[]) {
      const features = orderedFeatureValues(model, q.queries, budget);
      unknown ||= features.some(feature => feature.value === null);
      rows.push({ model_ref: model.model_ref, features });
    }
    budget.finish();
    return result(q, unknown ? 'NEEDS_EVIDENCE' : 'COMPLETE', unknown ? 'UNREAD_OR_UNSEGMENTED_SEQUENCE' : 'ORDERED_FEATURE_RESULT',
      { model_feature_rows: rows, assigned_class_label: null, sequence_order_replaced_by_histogram: false,
        sequence_is_world_time_series: false }, !unknown, budget.examined);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, { restart_ordered_features: true, work: error.frontier });
  }
}

function predicateValue(root: string, nodes: Map<string, R>, features: Map<string, Scalar>, example: string,
  budget: Budget, depthBound: number): boolean | null {
  const memo = new Map<string, boolean | null>(), pending: [string, boolean, number][] = [[root, false, 0]];
  while (pending.length) {
    const [ref, leaving, depth] = pending.pop()!;
    if (memo.has(ref)) continue;
    if (depth > depthBound) throw new Interrupted('PREDICATE_DEPTH_BOUND', { node_ref: ref });
    const node = nodes.get(ref)!;
    budget.visit({ stage: 'licensed_predicate', node_ref: ref, example_ref: example });
    if (node.kind === 'ATOM') {
      const current = features.get(pairKey(example, node.feature_ref)) ?? null;
      let value: boolean | null = null;
      if (current === null || node.value === null) value = null;
      else if (node.comparator === 'EQ') value = typeof current === typeof node.value && current === node.value;
      else if (node.comparator === 'NE') value = typeof current !== typeof node.value || current !== node.value;
      else if (typeof current === 'number' && typeof node.value === 'number') {
        if (node.comparator === 'LT') value = current < node.value;
        else if (node.comparator === 'LE') value = current <= node.value;
        else if (node.comparator === 'GT') value = current > node.value;
        else if (node.comparator === 'GE') value = current >= node.value;
      }
      memo.set(ref, value);
    } else if (!leaving) {
      pending.push([ref, true, depth]);
      for (const child of node.child_refs) pending.push([child, false, depth + 1]);
    } else {
      const values = (node.child_refs as string[]).map(child => memo.get(child) as boolean | null);
      if (node.kind === 'NOT') memo.set(ref, values[0] === null ? null : !values[0]);
      else if (node.kind === 'AND') memo.set(ref, values.includes(false) ? false : values.includes(null) ? null : true);
      else memo.set(ref, values.includes(true) ? true : values.includes(null) ? null : false);
    }
  }
  return memo.get(root)!;
}

/** Finite supplied grammar, with no invented observation or action authority. */
export function measureLabeledPredicateInduction(input: R, now: Clock = () => performance.now()): R {
  const q = normalizeInduction(input), refusal = validate(q, INDUCTION_OPERATION, ['FIT', 'PREDICT', 'PARTITION']);
  if (refusal) return refusal;
  if (Math.max(q.grammar.length, q.models.reduce((sum: number, model: R) => sum + model.feature_values.length, 0),
    q.examples.length, q.contrasts.length) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (Object.keys(q.resume_frontier).length) return result(q, 'NEEDS_EVIDENCE', 'RESTART_FINITE_VERSION_SPACE_FROM_ASSIGNMENTS');
  const budget = new Budget(q, now);
  try {
    const actual = (q.examples as R[]).filter(example => example.sealed && example.epoch === q.scope.epoch);
    if (!actual.length) return result(q, 'NEEDS_EVIDENCE', 'SEALED_LABELED_EXAMPLES_REQUIRED');
    if (q.mode_ref === 'PREDICT' && q.query_example_ref === null) return result(q, 'NEEDS_EVIDENCE', 'MEASURED_QUERY_NOT_BOUND');
    const nodes = new Map<string, R>(q.grammar.map((node: R) => [node.node_ref, node]));
    const version: R[] = [], eliminations: R[] = [], predictions: R[] = [];
    let incomplete = !q.grammar_domain_complete || !q.assignment_domain_complete;
    for (const model of q.models as R[]) {
      const features = new Map<string, Scalar>(model.feature_values.map(([example, feature, value]: [string, string, Scalar]) => [pairKey(example, feature), value]));
      const prerequisites = new Map<string, boolean | null>(model.submission_preconditions);
      for (const root of q.predicate_root_refs as string[]) {
        const counterexamples: string[] = []; let unknown = !model.measurement_complete;
        for (const example of actual) {
          const value = predicateValue(root, nodes, features, example.example_ref, budget, q.depth_bound);
          if (value === null) unknown = true;
          else if ((value ? q.positive_label_ref : q.negative_label_ref) !== example.label_ref) counterexamples.push(example.receipt_ref);
        }
        if (counterexamples.length) {
          eliminations.push({ model_ref: model.model_ref, predicate_ref: root, actual_counterexample_receipt_refs: counterexamples });
          continue;
        }
        version.push({ model_ref: model.model_ref, predicate_ref: root, observation_check_complete: !unknown });
        incomplete ||= unknown;
        const queryRefs: string[] = q.mode_ref === 'PREDICT' ? [q.query_example_ref] : q.contrasts.map((contrast: R) => contrast.example_ref);
        for (const query of queryRefs) {
          const value = predicateValue(root, nodes, features, query, budget, q.depth_bound);
          const label = value === null ? null : value ? q.positive_label_ref : q.negative_label_ref;
          const ready = label === null ? null : prerequisites.get(label) ?? null;
          predictions.push({ model_ref: model.model_ref, predicate_ref: root, query_ref: query,
            predicted_label_ref: label, submission_precondition: ready, actual_training_receipt: false });
          incomplete ||= value === null || ready === null;
        }
      }
    }
    const disagreement: R[] = [];
    if (q.mode_ref === 'PARTITION') for (const contrast of q.contrasts as R[]) {
      const rows = predictions.filter(prediction => prediction.query_ref === contrast.example_ref);
      const outcomes = new Set(rows.filter(prediction => prediction.predicted_label_ref !== null)
        .map(prediction => JSON.stringify([prediction.predicted_label_ref, prediction.submission_precondition])));
      if (outcomes.size > 1) disagreement.push({ query_ref: contrast.example_ref, assignment_predictions: rows,
        actual_observation_channel_ref: contrast.actual_observation_channel_ref,
        descriptive_counterexample_only: contrast.descriptive_only || contrast.actual_observation_channel_ref === null });
    }
    const labels = new Set(predictions.map(prediction => JSON.stringify([prediction.predicted_label_ref, prediction.submission_precondition])));
    const robust = q.mode_ref === 'PREDICT' && version.length > 0 && !incomplete && labels.size === 1;
    const contradiction = !version.length && q.grammar_domain_complete && q.assignment_domain_complete;
    budget.finish();
    return result(q, incomplete ? 'NEEDS_EVIDENCE' : 'COMPLETE', contradiction ? 'MODEL_CONTRADICTION'
      : incomplete ? 'INCOMPLETE_GRAMMAR_OR_MEASUREMENTS' : 'FINITE_LABELED_PREDICATE_RESULT',
    { observation_compatible_version_space: version, elimination_certificates: eliminations, label_predictions: predictions,
      robust_answer_and_submission_agreement: robust, distinguishing_queries: disagreement, unique_law_proved: false,
      rule_adoption_authorized: false, classification_submission_authorized: false, predicted_training_example_created: false },
    !incomplete, budget.examined);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined,
      { restart_finite_version_space: true, unexamined_assignments_remain: true, work: error.frontier });
  }
}

export function labeledSequenceScope(observation: R, scene: R, operation: string): R {
  return { request_ref: operation + ':' + identity([observation.observation_ref, scene.context_ref]), caller_ref: 'public_labeled_sequence_question',
    parent_consumer_ref: 'SRC_composition', parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'classify_current_measured_sequence',
    caller_next_item_ref: observation.observation_ref, epoch: observation.level_epoch, evidence_revision_ref: observation.observation_ref,
    model_revision_ref: scene.context_ref, model_status_ref: 'conditional_geometric_labels_and_finite_declared_grammar', event_owner_ref: 'SRC',
    input_domain_complete: true, assumption_refs: ['paired_panels_as_labeled_examples', 'uniform_squares_as_ordered_tokens_nonuniform_anchor_excluded',
      'same_palette_buttons_as_label_controls', 'finite_grammar_complete_only_as_declared_not_universal', 'agreement_does_not_prove_unique_law'] };
}
export function labeledSequenceFeatures(words: readonly (readonly [string, readonly number[]])[], queries: readonly R[], scene: R,
  observation: R, deadlineMs: number, now: Clock = () => performance.now()): R {
  const models = words.map(([ref, values]) => ({ model_ref: ref,
    tokens: values.map((value, index) => ({ occurrence_ref: ref + ':' + index, type_ref: String(value), visible: true })),
    order_and_segmentation_complete: true }));
  return measureOrderedPredicateFeatures({ scope: labeledSequenceScope(observation, scene, 'features'),
    operation_ref: FEATURES_OPERATION, mode_ref: 'EVALUATE', phase_ref: 'FINITE_ORDERED_FEATURES', requested_result_type: 'DMechanicalResult',
    node_bound: 100000, depth_bound: 128, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))), models, queries }, now);
}

function scalarOrder(left: Scalar, right: Scalar): number {
  if (typeof left === 'string' && typeof right === 'string') return compareUnicode(left, right);
  if ((typeof left === 'number' || typeof left === 'boolean') && (typeof right === 'number' || typeof right === 'boolean')) return Number(left) - Number(right);
  if (left === right) return 0;
  throw new TypeError('Training feature values are not mutually sortable in the source scalar domain');
}

/** Reuse only an identical measured training context; the query is always read anew. */
export function inferLabeledSequence(scene: R, observation: R, deadlineMs: number, cfg: R,
  prior: R | null = null, now: Clock = () => performance.now()): R | null {
  const queries: R[] = (cfg.features as string[]).map(kind => ({ feature_ref: kind, kind, type_ref: null }));
  queries.push(...scene.palette.map((value: number) => ({ feature_ref: 'COUNT:' + value, kind: 'TYPE_COUNT', type_ref: String(value) })));
  const labels = scene.panels.map((panel: R) => String(panel.label)), examples: R[] = [], words: [string, number[]][] = [];
  for (const panel of scene.panels as R[]) for (const [index, word] of (panel.words as R[]).entries()) {
    const ref = 'example:' + panel.label + ':' + index;
    words.push([ref, word.values]); examples.push({ example_ref: ref, receipt_ref: observation.observation_ref + '/' + ref,
      label_ref: String(panel.label), sealed: true, epoch: observation.level_epoch });
  }
  const reused = prior !== null && prior.epoch === observation.level_epoch && prior.context_ref === scene.context_ref && equal(prior.queries, queries);
  const training = reused ? prior!.training_features : labeledSequenceFeatures(words, queries, scene, observation, deadlineMs, now);
  if (training.status !== 'COMPLETE') return null;
  const queryRef = 'current_query';
  const query = labeledSequenceFeatures([[queryRef, scene.query.words[0].values]], queries, scene, observation, deadlineMs, now);
  if (query.status !== 'COMPLETE') return null;
  const rows = [...training.values.model_feature_rows, ...query.values.model_feature_rows], assignments: [string, string, Scalar][] = [];
  const values = new Map<string, Scalar[]>();
  for (const row of rows as R[]) for (const feature of row.features as R[]) {
    // The caller's finite grammar admits scalar constants. Compound requested
    // feature results are not silently coerced into fabricated scalar features.
    scalar(feature.value);
    assignments.push([row.model_ref, feature.feature_ref, feature.value]);
    if (row.model_ref !== queryRef) {
      const seen = values.get(feature.feature_ref) ?? [];
      // Python sets identify bool/int equalities; retain the first scalar just
      // as the source does, before testing its exact type for comparator scope.
      if (!seen.some(value => equal(value, feature.value))) seen.push(feature.value);
      values.set(feature.feature_ref, seen);
    }
  }
  const grammar: R[] = [], roots: string[] = [];
  for (const [ref, seen] of [...values.entries()].sort(([a], [b]) => compareUnicode(a, b))) for (const value of [...seen].sort(scalarOrder)) {
    const comparisons = typeof value === 'boolean' ? ['EQ'] : cfg.comparisons;
    for (const comparison of comparisons as string[]) {
      const id = 'P:' + identity([ref, comparison, value]);
      grammar.push({ node_ref: id, kind: 'ATOM', feature_ref: ref, comparator: comparison, value, child_refs: [] }); roots.push(id);
      const inverse = id + ':NOT';
      grammar.push({ node_ref: inverse, kind: 'NOT', feature_ref: null, comparator: null, value: null, child_refs: [id] }); roots.push(inverse);
    }
  }
  if (roots.length > cfg.root_bound) return null;
  const induction = measureLabeledPredicateInduction({ scope: labeledSequenceScope(observation, scene, 'induction'),
    operation_ref: INDUCTION_OPERATION, mode_ref: 'PREDICT', phase_ref: 'FINITE_LABELED_GRAMMAR', requested_result_type: 'DMechanicalResult',
    node_bound: 100000, depth_bound: 128, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))),
    grammar, predicate_root_refs: roots, positive_label_ref: labels[0], negative_label_ref: labels[1], examples,
    models: [{ model_ref: scene.context_ref, feature_values: assignments, submission_preconditions: labels.map((label: string) => [label, true]), measurement_complete: true }],
    query_example_ref: queryRef, grammar_domain_complete: true, assignment_domain_complete: true }, now);
  return { training_cache: { epoch: observation.level_epoch, context_ref: scene.context_ref, queries, training_features: training, controls: scene.buttons },
    training_reused: reused, query_features: query, induction, grammar,
    scope: 'Finite atomic/complement grammar, constants from measured training feature values; no universal uniqueness or invented future query.' };
}
