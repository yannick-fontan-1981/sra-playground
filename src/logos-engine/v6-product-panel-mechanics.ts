/** Called V5 cyclic product-sweep compiler, with its original descriptive receipts.
 * This transfers the COMPILE contract used by product_panel_methods. The other
 * cyclic_configuration_coverage operations and Pydantic coercions are not ported.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';

type R = Record<string, any>;
type Clock = () => number;
const OPERATION = 'mechanics.cyclic_configuration_coverage.product_sweep';
const clone = <T>(value: T): T => structuredClone(value);
const tupleKey = (value: readonly string[]): string => JSON.stringify(value);
const compare = (a: readonly (string | number)[], b: readonly (string | number)[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return typeof a[i] === 'string' && typeof b[i] === 'string'
      ? compareUnicode(a[i] as string, b[i] as string) : a[i]! < b[i]! ? -1 : 1;
  }
  return a.length - b.length;
};
const contains = (values: readonly string[][], value: readonly string[]): boolean => values.some(item => equal(item, value));
const unique = (values: readonly string[][]): string[][] => [...new Map(values.map(value => [tupleKey(value), [...value]])).values()];
const sameSet = <T>(a: Set<T>, b: Set<T>): boolean => a.size === b.size && [...a].every(value => b.has(value));
class Prerequisite extends Error {}
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
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new TypeError('Product mechanic requires exact bounded integers');
}
function array(value: unknown, minimum: number, maximum: number): asserts value is any[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Product mechanic input domain bounds');
}
function state(value: R | null): R | null {
  if (value === null) return null;
  array(value.current, 1, 16); array(value.visited, 0, 4096); integer(value.reserve, 0);
  for (const row of [value.current, ...value.visited]) {
    array(row, 0, 16);
    if (row.some(item => typeof item !== 'string')) throw new TypeError('Product tuple refs must be strings');
  }
  return value;
}
function normalize(input: R): R {
  const q: R = { schema_version: 'yf_arc3_v5.cyclic_coverage_request.v1', observations: [], resume_frontier: {},
    models: [], state: null, prior_state: null, action_ref: null, primitive_word: [], comparison_word: null,
    factor_order: [], observed_catalogue: [], factor_vocabularies: [], reset_boundary_ref: null, frame: null,
    layer_regions: [], frame_ref: null, frame_epoch: null, control_layouts: [], ...clone(input),
    scope: { assumption_refs: [], ...clone(input.scope) } };
  for (const [key, max] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) integer(q[key], 1, max);
  integer(q.scope.epoch, 0);
  array(q.models, 0, 32); array(q.factor_order, 0, 16); array(q.observations, 0, 4096);
  for (const value of q.factor_order) if (!Number.isSafeInteger(value)) throw new TypeError('Factor order requires exact integers');
  q.state = state(q.state); q.prior_state = state(q.prior_state);
  q.models = q.models.map((model: R) => {
    const m: R = { bindings: [], costs: [], independent: null, initial_credited: null, terminal_order: [], catalogue: [],
      debit_rule: null, sweep_actions: [], reset_action_ref: null, reset_state: null, reset_cost: null,
      reset_lifecycle_ref: null, reset_contract_ref: null, reset_evidence_refs: [], ...model };
    if (typeof m.model_ref !== 'string') throw new TypeError('Model identity must be a string');
    array(m.factors, 1, 16); array(m.bindings, 0, 64); array(m.costs, 0, 64); array(m.catalogue, 0, 4096);
    array(m.sweep_actions, 0, 16); array(m.terminal_order, 0, 2); array(m.reset_evidence_refs, 0, 64);
    for (const domain of [...m.factors, ...m.catalogue]) {
      if (!Array.isArray(domain) || domain.some((ref: unknown) => typeof ref !== 'string')) throw new TypeError('Product vocabulary requires string refs');
    }
    for (const pair of [...m.bindings, ...m.costs]) if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || !Number.isSafeInteger(pair[1])) throw new TypeError('Product binding and cost require exact pairs');
    for (const key of ['independent', 'initial_credited']) if (m[key] !== null && typeof m[key] !== 'boolean') throw new TypeError('Product conditional flag must be boolean or null');
    if (m.reset_cost !== null) integer(m.reset_cost, 0);
    m.reset_state = state(m.reset_state);
    return m;
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
function inputDigest(q: R): string {
  return identity(Object.fromEntries(Object.entries(q).filter(([key]) => !['node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'].includes(key))));
}
function resume(q: R): R[] {
  const frontier = q.resume_frontier;
  if (!Object.keys(frontier).length) return [];
  if (frontier.input_digest !== inputDigest(q)) throw new Prerequisite('RESUME_INPUT_OR_REVISION_MISMATCH');
  const rows = frontier.completed_model_results ?? [];
  if (!equal(rows.map((row: R) => row.model_ref), q.models.slice(0, rows.length).map((model: R) => model.model_ref))) throw new Prerequisite('RESUME_MODEL_PREFIX_MISMATCH');
  return clone(rows);
}
function frontier(q: R, rows: readonly R[], model: string | null, work: R = {}): R {
  return { input_digest: inputDigest(q), completed_model_results: rows.filter(row => row.model_ref !== null && row.model_ref !== undefined),
    unfinished_model_ref: model, work_frontier: work, resume_strategy: 'reuse_complete_prefix_restart_unfinished_pure_model',
    caller_next_item_ref: q.scope.caller_next_item_ref, evidence_revision_ref: q.scope.evidence_revision_ref, model_revision_ref: q.scope.model_revision_ref };
}
function productDomain(model: R, q: R, budget: Budget): string[][] {
  if (model.independent !== true) throw new Prerequisite('INDEPENDENCE_NOT_SUPPLIED');
  if (model.factors.some((values: string[]) => !values.length || new Set(values).size !== values.length)) throw new Prerequisite('FACTOR_VOCABULARY_NOT_BIJECTIVE');
  const count = model.factors.reduce((total: number, domain: string[]) => {
    const value = total * domain.length;
    if (!Number.isSafeInteger(value)) throw new TypeError('Product cardinality exceeds the native exact-integer domain');
    return value;
  }, 1);
  if (count > q.domain_bound) throw new Interrupted('FACTOR_PRODUCT_DOMAIN_BOUND', { product_count: count });
  let tuples: string[][] = [[]];
  for (const domain of model.factors as string[][]) tuples = tuples.flatMap(tuple => domain.map(value => [...tuple, value]));
  for (const _tuple of tuples) budget.visit();
  return tuples;
}
function seedCurrent(model: R, current: R): R {
  if (model.initial_credited === null && !contains(current.visited, current.current)) throw new Prerequisite('INITIAL_CREDIT_LAW_MISSING');
  if (model.initial_credited === true && !contains(current.visited, current.current)) return { ...current, visited: [...current.visited, current.current].sort(compare) };
  return current;
}
function press(model: R, current: R, action: string, budget: Budget): { state: R; event: R } {
  budget.visit();
  if (model.initial_credited === null && !contains(current.visited, current.current) || !['saturating', 'reject_if_insufficient'].includes(model.debit_rule)) throw new Prerequisite('INITIAL_CREDIT_OR_DEBIT_LAW_MISSING');
  if (current.current.length !== model.factors.length || current.current.some((value: string, i: number) => !model.factors[i].includes(value))) throw new Prerequisite('CURRENT_TUPLE_OUTSIDE_MODEL');
  if ([...current.visited, ...model.catalogue].some((values: string[]) => values.length !== model.factors.length || values.some((value, i) => !model.factors[i].includes(value)))) throw new Prerequisite('VISIT_OR_CATALOGUE_TUPLE_OUTSIDE_MODEL');
  if (new Set(model.catalogue.map(tupleKey)).size !== model.catalogue.length) throw new Prerequisite('CATALOGUE_TUPLE_IDENTITY_AMBIGUOUS');
  const bindings = model.bindings.filter(([ref]: [string, number]) => ref === action).map((pair: [string, number]) => pair[1]);
  const costs = model.costs.filter(([ref]: [string, number]) => ref === action).map((pair: [string, number]) => pair[1]);
  if (bindings.length !== 1 || costs.length !== 1 || costs[0] < 0) throw new Prerequisite('PRESS_BINDING_OR_COST_NOT_UNIQUE');
  const index = bindings[0];
  if (index < 0 || index >= model.factors.length) throw new Prerequisite('PRESS_FACTOR_OUTSIDE_MODEL');
  if (current.reserve === 0 || model.debit_rule === 'reject_if_insufficient' && costs[0] > current.reserve) throw new Prerequisite('INPUT_RESOURCE_PRECONDITION_FAILED');
  if (!model.catalogue.length) throw new Prerequisite('ACCEPTANCE_CATALOGUE_MISSING');
  if (model.terminal_order.length !== 2 || !sameSet(new Set(model.terminal_order), new Set(['acceptance', 'exhaustion']))) throw new Prerequisite('TERMINAL_EVENT_ORDER_MISSING');
  const tuple = [...current.current], cycle = model.factors[index];
  tuple[index] = cycle[(cycle.indexOf(tuple[index]) + 1) % cycle.length];
  const before = unique([...current.visited, ...(model.initial_credited ? [current.current] : [])]);
  const visited = unique([...before, tuple]), reserve = Math.max(0, current.reserve - costs[0]);
  let lifecycle = 'active';
  for (const event of model.terminal_order) {
    if (event === 'acceptance' && model.catalogue.every((value: string[]) => contains(visited, value))) { lifecycle = 'accepted'; break; }
    if (event === 'exhaustion' && reserve === 0) { lifecycle = 'exhausted'; break; }
  }
  return { state: { current: tuple, visited: visited.sort(compare), reserve }, event: { owner_ref: budget.request.scope.event_owner_ref,
    action_ref: action, factor_index: index, before_tuple: current.current, after_tuple: tuple, new_visit: !contains(before, tuple),
    debit: costs[0], reserve_before: current.reserve, reserve_after: reserve, lifecycle,
    automatic_pass_already_owned: true, cost_already_owned: true } };
}

/** Exact called finite product-sweep branch on canonical, safe-integer JSON. */
export function measureCyclicProductSweep(input: R, now: Clock = () => performance.now()): R {
  const q = normalize(input);
  if (q.operation_ref !== OPERATION || q.mode_ref !== 'COMPILE' || q.requested_result_type !== 'DMechanicalResult') return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (new Set(q.models.map((model: R) => model.model_ref)).size !== q.models.length) return result(q, 'NEEDS_EVIDENCE', 'DUPLICATE_MODEL_IDENTITY');
  const budget = new Budget(q, now);
  let rows: R[] = [], currentModel: string | null = null;
  try {
    if (!q.models.length) throw new Prerequisite('SCOPED_FACTOR_MODELS_MISSING');
    rows = resume(q);
    const descriptors = new Set<string>(rows.map(row => row.result.compiled_word_descriptor).filter(value => value !== null && value !== undefined));
    for (const model of (q.models as R[]).slice(rows.length)) {
      currentModel = model.model_ref; budget.visit();
      if (q.state === null) throw new Prerequisite('CURRENT_COVERAGE_STATE_MISSING');
      productDomain(model, q, budget);
      if (!sameSet(new Set(q.factor_order), new Set(model.factors.map((_value: unknown, i: number) => i)))
        || q.factor_order.length !== model.factors.length || model.sweep_actions.length !== model.factors.length) throw new Prerequisite('DECLARED_FACTOR_ORDER_OR_SWEEP_BINDINGS_MISSING');
      const descriptor = identity([q.factor_order.filter((i: number) => model.factors[i].length > 1)
        .map((i: number) => [model.factors[i].length, model.sweep_actions[i]]), model.initial_credited === false && !contains(q.state.visited, q.state.current)]);
      if (!descriptors.has(descriptor) && descriptors.size >= 3) throw new Prerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION');
      descriptors.add(descriptor);
      let word: string[] = [];
      for (const index of q.factor_order as number[]) {
        const pieces: string[] = [];
        for (let slice = 0; slice < model.factors[index].length; slice++) {
          pieces.push(...word);
          if (slice + 1 < model.factors[index].length) pieces.push(model.sweep_actions[index]);
        }
        word = pieces;
        if (word.length > q.depth_bound) throw new Interrupted('WORD_DEPTH_BOUND', { factor_index: index });
      }
      if (model.initial_credited === false && !contains(q.state.visited, q.state.current)) {
        const prefix = [...word];
        for (const index of q.factor_order as number[]) {
          const advances = word.filter(action => action === model.sweep_actions[index]).length;
          const length = model.factors[index].length, count = ((-advances % length) + length) % length;
          for (let i = 0; i < count; i++) prefix.push(model.sweep_actions[index]);
        }
        word = prefix;
      }
      let working = seedCurrent(model, clone(q.state)), wordComplete = true;
      const trace: R[] = [];
      for (const [index, action] of word.entries()) {
        if (index >= q.depth_bound) throw new Interrupted('WORD_DEPTH_BOUND', { word_index: index });
        const value = press(model, working, action, budget); working = value.state; trace.push(value.event);
        if (value.event.lifecycle !== 'active') { wordComplete = index + 1 === word.length; break; }
      }
      rows.push({ model_ref: model.model_ref, result: { primitive_word: word, state: working, event_trace: trace,
        word_complete: wordComplete, actual_cost: trace.reduce((sum, event) => sum + event.debit, 0),
        coverage_complete: model.catalogue.every((value: string[]) => contains(working.visited, value)),
        fresh_product_bound_is_not_a_residual_minimum: true, compiled_word_descriptor: descriptor } });
    }
    if (new Set(rows.map(row => JSON.stringify(row.result.primitive_word))).size > 3) throw new Prerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION');
    budget.finish();
    return result(q, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED', { model_correlated_results: rows }, true, budget.examined);
  } catch (error) {
    if (error instanceof Prerequisite) return result(q, 'NEEDS_EVIDENCE', error.message, {}, false, budget.examined, frontier(q, rows, currentModel));
    if (error instanceof Interrupted) return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, frontier(q, rows, currentModel, error.frontier));
    throw error;
  }
}

function* permutations(values: readonly number[]): Generator<number[]> {
  if (!values.length) { yield []; return; }
  for (const [i, first] of values.entries()) for (const rest of permutations([...values.slice(0, i), ...values.slice(i + 1)])) yield [first, ...rest];
}

export function compileProductRoutes(scene: R, state: R, observation: R, remaining: number, deadlineMs: number,
  maxFactors: number, now: Clock = () => performance.now()): R | null {
  const n = scene.controls.length;
  if (n > maxFactors) return null;
  const factors: string[][] = scene.controls.map((control: R) => control.values.map(String));
  for (const [i, values] of factors.entries()) {
    const edges = state.edges.filter((edge: R) => edge.factor === i).map((edge: R) => [String(edge.from), String(edge.to)]);
    const fits = [values, [...values].reverse()].filter(variant => edges.every(([a, b]: string[]) => {
      const index = variant.indexOf(a!);
      if (index < 0) throw new TypeError('Observed product transition is outside the measured vocabulary');
      return variant[(index + 1) % variant.length] === b;
    }));
    if (!fits.length) return null;
    factors[i] = fits[0]!;
  }
  const model = { model_ref: 'conditional:' + identity([factors, state.edges]), factors,
    bindings: factors.map((_value, i) => [`factor:${i}`, i]), costs: factors.map((_value, i) => [`factor:${i}`, 1]),
    independent: true, initial_credited: true, catalogue: scene.catalogue.map((row: number[]) => row.map(String)),
    debit_rule: 'reject_if_insufficient', terminal_order: ['acceptance', 'exhaustion'], sweep_actions: factors.map((_value, i) => `factor:${i}`) };
  const scope = { request_ref: 'product:' + identity([observation.observation_ref, model, state.visited]), caller_ref: 'public_product_question',
    parent_consumer_ref: 'SRC_composition', parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'experimentally_cover_measured_catalogue',
    caller_next_item_ref: observation.observation_ref, epoch: observation.level_epoch, evidence_revision_ref: observation.observation_ref,
    model_revision_ref: identity(model), model_status_ref: 'conditional_local_cycle_and_independence_hypotheses', event_owner_ref: 'SRC',
    input_domain_complete: true, assumption_refs: ['measured_catalogue_equals_finite_product', 'legend_order_cycle_candidate_constrained_by_effects',
      'local_effect_independence_remains_conditional', 'acceptance_is_experimental_catalogue_goal_not_official_game_verdict',
      'reserve_counts_emitted_commands_not_unknown_internal_resource', 'initial_current_tuple_observed_not_assumed_game_credit'] };
  const coverage = { current: scene.current.map(String), visited: state.visited.map((row: number[]) => row.map(String)), reserve: remaining };
  let best: R | null = null;
  for (const order of permutations(Array.from({ length: n }, (_value, i) => i))) {
    if (now() >= deadlineMs) break;
    const receipt = measureCyclicProductSweep({ scope, operation_ref: OPERATION, mode_ref: 'COMPILE', requested_result_type: 'DMechanicalResult',
      node_bound: 100000, depth_bound: 4096, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))),
      models: [model], state: coverage, factor_order: order }, now);
    if (receipt.status !== 'COMPLETE') continue;
    const value = receipt.values.model_correlated_results[0].result;
    if (!value.coverage_complete) continue;
    const indices = value.primitive_word.slice(0, value.event_trace.length).map((ref: string) => Number(ref.split(':')[1]));
    if (best === null || indices.length < best.indices.length || indices.length === best.indices.length && compare(indices, best.indices) < 0) {
      best = { indices, trace: value.event_trace, receipt, factors };
    }
  }
  return best;
}
