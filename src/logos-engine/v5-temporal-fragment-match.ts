/**
 * V5 TemporalFragment's exact_candidates/MATCH path consumed by FramedWindow.
 * Pinned source: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * Retains model correlation, first-difference witnesses, the D result envelope,
 * finite work checks and complete-model-prefix resume. Other temporal/photo
 * operations, their request submodels and Python coercions are not transferred.
 * Inputs use the native portable JSON integer/Ref domain.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { immutableJson } from './canonical.ts';
import { PopulationWorkBudget, PopulationWorkInterrupted } from './v5-reference-population-calculus.ts';

type R = Record<string, any>;
export type TemporalFragmentClock = () => number;
export const TEMPORAL_FRAGMENT_EXACT_OPERATION = 'mechanics.temporal_fragment_match.exact_candidates';
export const TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION = 'native_temporal_fragment_interrupted_pixel_frontier';

const SIGNATURES: Readonly<Record<string, string>> = {
  measure_regions: 'MEASURE', ingest_packet: 'OBSERVE', read_photo_control: 'MEASURE', exact_candidates: 'MATCH',
  discriminants: 'COMPARE', transport_model: 'PREDICT', information_request: 'PROBE', compile_proposal: 'COMPILE',
  reconcile_feedback: 'RECONCILE', memory_scope: 'RETAIN', external_primitive: 'STEP',
};
const REQUEST_DEFAULTS: R = {
  schema_version: 'yf_arc3_v5.temporal_fragment_request.v1', observations: [], resume_frontier: {}, models: [],
  state: null, reference: null, reference_revision_ref: null, photos: [], windows: [], primitive: null,
  information_words: [], unseen_indices: [], current_question_ref: null, bound_window: null,
  candidate_evidence_revision_ref: null, local_interior_point: null, preparation_word: null,
  post_preparation_observation_required: null, input_bindings: [], transforms: [], observed_frame: null,
  frame_ref: null, frame_epoch: null, frame_evidence_revision_ref: null, observed_scene_ref: null,
  panel_layouts: [], permitted_geometry_status_refs: [], prior_archive_refs: [], acquired_packet_ref: null,
  packet_owner_ref: null, memory_items: [], memory_records: [], memory_owner_scope_values: {}, feedback_contract: null,
};
const REQUEST_REQUIRED = ['scope', 'operation_ref', 'mode_ref', 'requested_result_type', 'node_bound',
  'depth_bound', 'domain_bound', 'time_bound_ms'];
const CONSUMED_FIELDS = new Set(['schema_version', 'observations', 'resume_frontier', 'models', 'state',
  'reference', 'reference_revision_ref', 'photos', 'windows']);
const MODEL_DEFAULTS: R = {
  palette_relation: [], descriptive_distance_ref: null, navigation_law_ref: null, direct_seek_law_ref: null,
  playback_law_ref: null, playback_order: [], playback_includes_start: null, channel_retention_ref: null,
  input_costs: [], proposal_law_ref: null, terminal_after_acceptance_ref: null, required_acceptances: null,
  reset_state: null, reset_cost: null,
};
const SCOPE_REQUIRED = ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref',
  'parent_contribution_ref', 'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref',
  'model_status_ref', 'event_owner_ref', 'input_domain_complete'];

function fields(value: unknown, allowed: readonly string[], required: readonly string[] = []): R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![null, Object.prototype].includes(Object.getPrototypeOf(value))) throw new TypeError('Temporal fragment contract requires an object');
  const row = value as R;
  if (Object.keys(row).some(name => !allowed.includes(name)) || required.some(name => !Object.hasOwn(row, name))) {
    throw new TypeError('Temporal fragment contract has missing or unknown fields');
  }
  return row;
}
function integer(value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError('Temporal fragment integer is outside the native portable domain');
  }
  return value as number;
}
function ref(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Temporal fragment requires a nonempty Ref');
  return value.trim();
}
function array(value: unknown, maximum: number, minimum = 0): any[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Temporal fragment array bounds');
  return value;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new TypeError('Temporal fragment requires an explicit boolean');
  return value;
}
function map(value: unknown): R {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Temporal fragment requires a map');
  return immutableJson(value) as R;
}
function frame(value: R): R {
  value = fields(value, ['rows', 'schema_version'], ['rows']);
  const rows = array(value.rows, Number.MAX_SAFE_INTEGER, 1).map(row => array(row, Number.MAX_SAFE_INTEGER, 1).map(pixel => integer(pixel)));
  if (rows.some(row => row.length !== rows[0]!.length)) throw new TypeError('Temporal fragment frame must be rectangular');
  return { rows, schema_version: ref(value.schema_version === undefined ? 'yf_arc3_v5.frame_grid.v1' : value.schema_version) };
}
function controlState(value: R): R {
  const required = ['scene_ref', 'film_revision_ref', 'reference_revision_ref', 'current_index'];
  value = fields(value, [...required, 'accepted_count', 'attempt_count'], required);
  return { scene_ref: ref(value.scene_ref), film_revision_ref: ref(value.film_revision_ref),
    reference_revision_ref: ref(value.reference_revision_ref), current_index: integer(value.current_index, 0, 4095),
    accepted_count: integer(value.accepted_count === undefined ? 0 : value.accepted_count, 0),
    attempt_count: integer(value.attempt_count === undefined ? 0 : value.attempt_count, 0) };
}
function model(value: R): R {
  const required = ['model_ref', 'photo_count', 'equality_law_ref'];
  value = fields(value, [...required, ...Object.keys(MODEL_DEFAULTS)], required);
  const output: R = { ...structuredClone(MODEL_DEFAULTS), ...value,
    model_ref: ref(value.model_ref), photo_count: integer(value.photo_count, 1, 4096) };
  for (const key of ['equality_law_ref', 'descriptive_distance_ref', 'navigation_law_ref', 'direct_seek_law_ref',
    'playback_law_ref', 'channel_retention_ref', 'proposal_law_ref', 'terminal_after_acceptance_ref']) {
    if (output[key] !== null) output[key] = ref(output[key]);
  }
  output.palette_relation = array(output.palette_relation, 256).map(pair => {
    array(pair, 2, 2); return [integer(pair[0]), integer(pair[1])];
  });
  output.playback_order = array(output.playback_order, 4096).map(value => integer(value));
  output.input_costs = array(output.input_costs, 8).map(pair => {
    array(pair, 2, 2); return [ref(pair[0]), integer(pair[1])];
  });
  if (output.playback_includes_start !== null) output.playback_includes_start = bool(output.playback_includes_start);
  if (output.required_acceptances !== null) output.required_acceptances = integer(output.required_acceptances, 1);
  if (output.reset_cost !== null) output.reset_cost = integer(output.reset_cost, 0);
  if (output.reset_state !== null) output.reset_state = controlState(output.reset_state);
  return output;
}

/** Full source defaults participate in resumable input identity. Only fields
 * consumed by exact_candidates may carry nondefault request submodels. */
export function normalizeTemporalFragmentExactRequest(input: R): R {
  input = fields(input, [...REQUEST_REQUIRED, ...Object.keys(REQUEST_DEFAULTS)], REQUEST_REQUIRED);
  const q: R = { ...structuredClone(REQUEST_DEFAULTS), ...structuredClone(input) };
  for (const [name, fallback] of Object.entries(REQUEST_DEFAULTS)) {
    if (!CONSUMED_FIELDS.has(name) && !equal(q[name], fallback)) {
      throw new TypeError(`Temporal fragment request submodel is outside the consumed exact-candidate contract: ${name}`);
    }
  }
  for (const [name, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) {
    q[name] = integer(q[name], 1, maximum);
  }
  const scope = fields(q.scope, [...SCOPE_REQUIRED, 'assumption_refs'], SCOPE_REQUIRED);
  q.scope = { ...scope, assumption_refs: array(scope.assumption_refs === undefined ? [] : scope.assumption_refs, 64).map(ref) };
  for (const key of SCOPE_REQUIRED) if (!['epoch', 'input_domain_complete'].includes(key)) q.scope[key] = ref(scope[key]);
  q.scope.epoch = integer(scope.epoch, 0); q.scope.input_domain_complete = bool(scope.input_domain_complete);
  q.schema_version = ref(q.schema_version); q.operation_ref = ref(q.operation_ref);
  q.requested_result_type = ref(q.requested_result_type); q.mode_ref = q.mode_ref === null ? null : ref(q.mode_ref);
  q.observations = array(q.observations, 4096).map(map); q.resume_frontier = map(q.resume_frontier);
  q.models = array(q.models, 32).map(model);
  q.state = q.state === null ? null : controlState(q.state);
  q.reference = q.reference === null ? null : frame(q.reference);
  q.reference_revision_ref = q.reference_revision_ref === null ? null : ref(q.reference_revision_ref);
  q.photos = array(q.photos, 256).map((photo: R) => {
    const names = ['photo_ref', 'scene_ref', 'film_revision_ref', 'photo_index', 'frame', 'evidence_ref', 'content_support_ref', 'content_kind_ref'];
    photo = fields(photo, names, names);
    return { photo_ref: ref(photo.photo_ref), scene_ref: ref(photo.scene_ref), film_revision_ref: ref(photo.film_revision_ref),
      photo_index: integer(photo.photo_index, 0, 4095), frame: frame(photo.frame), evidence_ref: ref(photo.evidence_ref),
      content_support_ref: ref(photo.content_support_ref), content_kind_ref: ref(photo.content_kind_ref) };
  });
  q.windows = array(q.windows, 4096).map((window: R) => {
    const names = ['window_ref', 'photo_ref', 'top', 'left']; window = fields(window, names, names);
    return { window_ref: ref(window.window_ref), photo_ref: ref(window.photo_ref), top: integer(window.top, 0), left: integer(window.left, 0) };
  });
  return q;
}

function result(q: R, status: string, cause: string, values: R = {}, complete = false, examined = 0, frontier: R = {}): R {
  const facts: R = {};
  for (const key of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref',
    'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref']) facts[key] = q.scope[key];
  Object.assign(facts, { operation_ref: q.operation_ref, mode_ref: q.mode_ref, status, cause, domain_complete: complete,
    examined_count: examined, primitive_release_authorized: false, retained_model_refs: q.models.map((model: R) => model.model_ref) });
  return { schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope: structuredClone(q.scope), operation_ref: q.operation_ref,
    mode_ref: q.mode_ref, status, cause, values, domain_complete: complete, examined_count: examined, frontier,
    descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null };
}
class FragmentPrerequisite extends Error {}
class FragmentDomainInterrupted extends Error {
  readonly cause = 'PHOTO_WINDOW_DOMAIN_BOUND';
  readonly frontier: R;
  constructor(frontier: R) { super('PHOTO_WINDOW_DOMAIN_BOUND'); this.frontier = frontier; }
}
function inputDigest(q: R): string {
  return identity(Object.fromEntries(Object.entries(q).filter(([name]) => !['node_bound', 'depth_bound', 'domain_bound', 'time_bound_ms', 'resume_frontier'].includes(name))));
}
function resumeRows(q: R): R[] {
  if (!truth(q.resume_frontier)) return [];
  if (q.resume_frontier.input_digest !== inputDigest(q)) throw new FragmentPrerequisite('RESUME_INPUT_OR_REVISION_MISMATCH');
  const rows: R[] = q.resume_frontier.completed_model_results ?? [];
  if (!equal(rows.map(row => row.model_ref), q.models.slice(0, rows.length).map((model: R) => model.model_ref))) {
    throw new FragmentPrerequisite('RESUME_MODEL_PREFIX_MISMATCH');
  }
  return [...rows];
}
function resumableFrontier(q: R, rows: R[], modelRef: string | null, work: R = {}): R {
  return { input_digest: inputDigest(q), completed_model_results: rows.filter(row => row.model_ref !== null && row.model_ref !== undefined),
    unfinished_model_ref: modelRef, work_frontier: work, resume_strategy: 'reuse_complete_prefix_restart_unfinished_pure_model',
    caller_next_item_ref: q.scope.caller_next_item_ref, evidence_revision_ref: q.scope.evidence_revision_ref,
    model_revision_ref: q.scope.model_revision_ref };
}
function compareWindow(model: R, q: R, window: R, budget: PopulationWorkBudget): R {
  if (q.reference === null || q.reference_revision_ref === null) throw new FragmentPrerequisite('CURRENT_REFERENCE_CONTENT_OR_REVISION_MISSING');
  if (q.state !== null && q.reference_revision_ref !== q.state.reference_revision_ref) throw new FragmentPrerequisite('REFERENCE_REVISION_NOT_CURRENT');
  const photos = q.photos.filter((photo: R) => photo.photo_ref === window.photo_ref);
  if (photos.length !== 1) throw new FragmentPrerequisite('ACQUIRED_PHOTO_IDENTITY_NOT_UNIQUE');
  const photo = photos[0]!;
  if (photo.content_kind_ref !== 'acquired_photo_content') throw new FragmentPrerequisite('REFERENCE_OR_FEEDBACK_NOT_ADMISSIBLE_PHOTO_CONTENT');
  if (q.state !== null && (photo.scene_ref !== q.state.scene_ref || photo.film_revision_ref !== q.state.film_revision_ref)) {
    throw new FragmentPrerequisite('PHOTO_SCENE_OR_FILM_REVISION_NOT_CURRENT');
  }
  const reference: number[][] = q.reference.rows, image: number[][] = photo.frame.rows;
  if (window.top + reference.length > image.length || window.left + reference[0]!.length > image[0]!.length) {
    throw new FragmentPrerequisite('REQUESTED_WINDOW_OUTSIDE_PHOTO_CONTENT');
  }
  if (!['exact_palette_value', 'declared_palette_relation'].includes(model.equality_law_ref)) throw new FragmentPrerequisite('COMPLETE_PIXEL_EQUALITY_LAW_MISSING');
  const relation = new Set<string>(model.palette_relation.map((pair: number[]) => JSON.stringify(pair)));
  if (model.equality_law_ref === 'declared_palette_relation' && relation.size === 0) throw new FragmentPrerequisite('DECLARED_PALETTE_RELATION_MISSING');
  const counterexamples: number[][] = [];
  let compared = 0;
  outer: for (let row = 0; row < reference.length; row++) for (let column = 0; column < reference[0]!.length; column++) {
    try { budget.visit({ window_ref: window.window_ref, next_pixel: [row, column] }); }
    catch (error) {
      if (!(error instanceof PopulationWorkInterrupted)) throw error;
      // The pinned source calls FrozenMap.overlay with a plain-dict fallback
      // here and raises AttributeError. Keep that exception in the oracle.
      // This named native adaptation returns an incomplete bounded receipt;
      // it never grants completeness, acquisition or a physical impossibility.
      throw new PopulationWorkInterrupted(error.cause, { ...error.frontier, counterexample_pixels: counterexamples,
        native_adaptation: TEMPORAL_FRAGMENT_NATIVE_INTERRUPTION });
    }
    const expected = reference[row]![column]!, actual = image[window.top + row]![window.left + column]!;
    compared++;
    const same = model.equality_law_ref === 'exact_palette_value' ? expected === actual : relation.has(JSON.stringify([expected, actual]));
    if (!same) { counterexamples.push([row, column, expected, actual]); break outer; }
  }
  return { window_ref: window.window_ref, photo_ref: photo.photo_ref, photo_index: photo.photo_index,
    photo_content_kind_ref: photo.content_kind_ref, photo_evidence_ref: photo.evidence_ref,
    photo_content_support_ref: photo.content_support_ref, photo_scene_ref: photo.scene_ref,
    photo_film_revision_ref: photo.film_revision_ref, window_top: window.top, window_left: window.left,
    reference_height: reference.length, reference_width: reference[0]!.length, compared_pixel_count: compared,
    comparison_stopped_on_first_difference: true, comparison_domain_pixel_count: reference.length * reference[0]!.length,
    reference_revision_ref: q.reference_revision_ref, exact_match: counterexamples.length === 0,
    counterexample_pixels: counterexamples, background_and_isolated_pixels_preserved: true };
}

/** The ten other source operations return an explicitly native untransferred
 * refusal. No operation outside exact_candidates claims a source computation. */
export function measureTemporalFragmentMatch(input: R, now: TemporalFragmentClock = () => performance.now()): R {
  const q = normalizeTemporalFragmentExactRequest(input);
  const prefix = 'mechanics.temporal_fragment_match.', operation = q.operation_ref.startsWith(prefix) ? q.operation_ref.slice(prefix.length) : '';
  if (!Object.hasOwn(SIGNATURES, operation) || SIGNATURES[operation] !== q.mode_ref || q.requested_result_type !== 'DMechanicalResult') {
    return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  }
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) {
    return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  }
  if (new Set(q.models.map((model: R) => model.model_ref)).size !== q.models.length) return result(q, 'NEEDS_EVIDENCE', 'DUPLICATE_MODEL_IDENTITY');
  if (operation !== 'exact_candidates') return result(q, 'NEEDS_EVIDENCE', 'NATIVE_TEMPORAL_FRAGMENT_OPERATION_NOT_TRANSFERRED');
  const budget = new PopulationWorkBudget({ node_bound: q.node_bound, domain_bound: q.domain_bound, time_bound_ms: q.time_bound_ms, now });
  let rows: R[] = [], currentModel: string | null = null;
  try {
    if (!q.models.length) throw new FragmentPrerequisite('SCOPED_FRAGMENT_MODELS_MISSING');
    rows = resumeRows(q);
    for (const model of q.models.slice(rows.length) as R[]) {
      currentModel = model.model_ref; budget.visit();
      if (new Set(q.windows.map((window: R) => window.window_ref)).size !== q.windows.length) throw new FragmentPrerequisite('REQUESTED_WINDOW_IDENTITIES_NOT_UNIQUE');
      if (q.windows.length > q.domain_bound) throw new FragmentDomainInterrupted({ window_count: q.windows.length });
      const matches: R[] = q.windows.map((window: R) => compareWindow(model, q, window, budget));
      const exact = matches.filter(match => match.exact_match).map(match => match.window_ref);
      rows.push({ model_ref: model.model_ref, result: { window_results: matches, exact_window_refs: exact,
        covered_window_refs: q.windows.map((window: R) => window.window_ref), unique_in_declared_window_domain: exact.length === 1,
        absent_in_declared_window_domain: exact.length === 0 } });
    }
    budget.finish();
    return result(q, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED', { model_correlated_results: rows }, true, budget.examined);
  } catch (error) {
    if (error instanceof FragmentPrerequisite) return result(q, 'NEEDS_EVIDENCE', error.message, {}, false, budget.examined, resumableFrontier(q, rows, currentModel));
    if (error instanceof PopulationWorkInterrupted || error instanceof FragmentDomainInterrupted) {
      return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, resumableFrontier(q, rows, currentModel, error.frontier));
    }
    throw error;
  }
}
