/** Pinned D layered catalogue projection and the current-view caller request. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type P = readonly [number, number];
type Clock = () => number;
const OPERATION = 'mechanics.transform_pose_candidates.occluded_catalogue_projection';
const pointKey = ([x, y]: P): string => `${x},${y}`;
const pointOf = (key: string): P => key.split(',').map(Number) as unknown as P;
const compare = (a: P, b: P): number => a[0] - b[0] || a[1] - b[1];
const sortedPoints = (cells: Set<string>): P[] => [...cells].map(pointOf).sort(compare);

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
function integer(value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) throw new TypeError('Catalogue projection requires an exact bounded integer');
}
function list(value: unknown, minimum: number, maximum: number): asserts value is any[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) throw new TypeError('Catalogue projection array bounds');
}
function point(value: unknown): asserts value is P {
  list(value, 2, 2); integer(value[0]); integer(value[1]);
}
function reference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('Catalogue projection requires a nonempty reference');
  return value.trim();
}
function sameMembers(first: readonly string[], second: readonly string[]): boolean {
  const one = new Set(first), two = new Set(second); return one.size === two.size && [...one].every(value => two.has(value));
}
function normalize(input: R): R {
  const q: R = { schema_version: 'yf_arc3_v5.occluded_catalogue_projection_request_d.v1', observations: [], resume_frontier: {},
    ...structuredClone(input), scope: { assumption_refs: [], ...structuredClone(input.scope) } };
  for (const [name, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) integer(q[name], 1, maximum);
  for (const name of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref', 'caller_next_item_ref',
    'evidence_revision_ref', 'model_revision_ref', 'model_status_ref', 'event_owner_ref']) q.scope[name] = reference(q.scope[name]);
  integer(q.scope.epoch, 0);
  if (typeof q.scope.input_domain_complete !== 'boolean') throw new TypeError('Catalogue projection scope completeness must be explicit');
  list(q.scope.assumption_refs, 0, 64); q.scope.assumption_refs = q.scope.assumption_refs.map(reference);
  q.operation_ref = reference(q.operation_ref); q.requested_result_type = reference(q.requested_result_type);
  if (q.mode_ref !== null) q.mode_ref = reference(q.mode_ref);
  if (q.phase_ref !== 'REGISTERED_LAYERED_VIEWS') throw new TypeError('Catalogue projection phase mismatch');
  list(q.observations, 0, 4096); list(q.masks, 1, 128); list(q.models, 1, 128); list(q.registered_views, 1, 128); list(q.requested_view_refs, 1, 128);
  if (!q.resume_frontier || typeof q.resume_frontier !== 'object' || Array.isArray(q.resume_frontier)) throw new TypeError('Catalogue projection frontier must be a map');
  q.requested_view_refs = q.requested_view_refs.map(reference);
  for (const mask of q.masks as R[]) {
    mask.candidate_ref = reference(mask.candidate_ref); mask.mask_provenance_ref = reference(mask.mask_provenance_ref);
    list(mask.pixels, 1, 4096); list(mask.supported_integer_scales, 1, 128);
    for (const pixel of mask.pixels) { point(pixel.point); pixel.value_ref = reference(pixel.value_ref); }
    for (const scale of mask.supported_integer_scales) integer(scale, 1);
    if (new Set(mask.pixels.map((pixel: R) => pointKey(pixel.point))).size !== mask.pixels.length) throw new TypeError('Candidate mask/scale grammar invalid');
  }
  const masks = new Map<string, R>(q.masks.map((mask: R) => [mask.candidate_ref, mask]));
  for (const view of q.registered_views as R[]) {
    view.view_ref = reference(view.view_ref); view.evidence_revision_ref = reference(view.evidence_revision_ref); integer(view.epoch, 0);
    if (typeof view.sealed !== 'boolean') throw new TypeError('Catalogue view sealing must be explicit');
    view.visible_present ??= []; view.visible_absent ??= []; view.unobserved_cells ??= [];
    list(view.viewport_cells, 1, 4096); list(view.queried_object_refs, 1, 128);
    list(view.visible_present, 0, 4096); list(view.visible_absent, 0, 4096); list(view.unobserved_cells, 0, 4096);
    for (const cell of [...view.viewport_cells, ...view.visible_absent, ...view.unobserved_cells]) point(cell);
    view.queried_object_refs = view.queried_object_refs.map(reference);
    for (const pixel of view.visible_present) { point(pixel.point); pixel.value_ref = reference(pixel.value_ref); }
  }
  const viewIds = new Set<string>(q.registered_views.map((view: R) => view.view_ref));
  if (masks.size !== q.masks.length || viewIds.size !== q.registered_views.length || q.requested_view_refs.some((ref: string) => !viewIds.has(ref))) throw new TypeError('Catalogue/view identity domain invalid');
  for (const model of q.models as R[]) {
    model.model_ref = reference(model.model_ref); list(model.views, 1, 128);
    for (const view of model.views as R[]) {
      view.view_ref = reference(view.view_ref); view.occluder_provenance_ref = reference(view.occluder_provenance_ref);
      list(view.poses, 1, 128); list(view.top_to_bottom_object_refs, 1, 128); view.top_to_bottom_object_refs = view.top_to_bottom_object_refs.map(reference);
      for (const pose of view.poses as R[]) {
        pose.object_ref = reference(pose.object_ref); pose.candidate_ref = reference(pose.candidate_ref); pose.pose_provenance_ref = reference(pose.pose_provenance_ref);
        integer(pose.scale, 1); point(pose.translation);
        if (typeof pose.opaque !== 'boolean') throw new TypeError('Catalogue pose opacity must be explicit');
        if (!masks.has(pose.candidate_ref) || !masks.get(pose.candidate_ref)!.supported_integer_scales.includes(pose.scale)) throw new TypeError('Unavailable catalogue transform is outside the assignment domain');
      }
      const ids = view.poses.map((pose: R) => pose.object_ref);
      if (new Set(ids).size !== ids.length || view.top_to_bottom_object_refs.length !== ids.length || !sameMembers(ids, view.top_to_bottom_object_refs)) throw new TypeError('Layer order must bind each persistent object exactly once');
    }
    if (new Set(model.views.map((view: R) => view.view_ref)).size !== model.views.length) throw new TypeError('Model view assignment duplicated');
  }
  if (q.mode_ref === 'COMPARE' && !sameMembers(q.requested_view_refs, [...viewIds])) throw new TypeError('Compare must preserve every registered view');
  return q;
}

/** Full mask/subpixel order is retained, including projections outside the viewport. */
export function* iterIntegerCatalogueProjection(points: readonly P[], scale: number, translation: P): Generator<P> {
  integer(scale, 1); point(translation);
  const coordinate = (offset: number, origin: number, subpixel: number): number => {
    const product = offset * scale, shifted = origin + product, value = shifted + subpixel;
    if (Number.isSafeInteger(product) && Number.isSafeInteger(shifted) && Number.isSafeInteger(value)) return value;
    // Cancellation can produce a safe result even when its intermediate
    // product is outside Float64's exact integers. Preserve that result.
    const exact = BigInt(offset) * BigInt(scale) + BigInt(origin) + BigInt(subpixel);
    if (exact < BigInt(Number.MIN_SAFE_INTEGER) || exact > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError('Catalogue projection leaves the exact native integer domain');
    return Number(exact);
  };
  for (const source of points) {
    point(source);
    const [row, col] = source;
    for (let sr = 0; sr < scale; sr++) for (let sc = 0; sc < scale; sc++) yield [coordinate(row, translation[0], sr), coordinate(col, translation[1], sc)];
  }
}

export function measureOccludedCatalogueProjection(input: R, now: Clock = () => performance.now()): R {
  const q = normalize(input);
  if (q.operation_ref !== OPERATION || !['DOMAIN', 'COMPARE'].includes(q.mode_ref) || q.requested_result_type !== 'DMechanicalResult') return result(q, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!q.scope.input_domain_complete) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(key => !q.scope[key])) return result(q, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (new Set(q.models.map((model: R) => model.model_ref)).size !== q.models.length) return result(q, 'NEEDS_EVIDENCE', 'DUPLICATE_MODEL_IDENTITY');
  if (Math.max(q.masks.reduce((sum: number, mask: R) => sum + mask.pixels.length, 0), q.registered_views.reduce((sum: number, view: R) => sum + view.viewport_cells.length, 0)) > q.domain_bound) return result(q, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (truth(q.resume_frontier)) return result(q, 'NEEDS_EVIDENCE', 'RESTART_CORRELATED_LAYER_ASSIGNMENTS');
  const budget = new Budget(q, now);
  try {
    const masks = new Map<string, R>(q.masks.map((mask: R) => [mask.candidate_ref, mask]));
    const views = new Map<string, R>(q.registered_views.map((view: R) => [view.view_ref, view])), rows: R[] = [];
    let unresolvedAny = false;
    for (const model of q.models as R[]) {
      const assigned = new Map<string, R>(model.views.map((view: R) => [view.view_ref, view])), contradictions: R[] = [], unresolved: string[] = [], checks: R[] = [];
      for (const ref of q.requested_view_refs as string[]) {
        const view = views.get(ref)!, layout = assigned.get(ref);
        if (!view.sealed || view.epoch !== q.scope.epoch || !layout) { unresolved.push(ref); continue; }
        const viewport = new Set<string>(view.viewport_cells.map(pointKey)), unknown = new Set<string>(view.unobserved_cells.map(pointKey));
        const query = new Set<string>(view.queried_object_refs);
        if ([...query].some(ref => !layout.top_to_bottom_object_refs.includes(ref))) { unresolved.push(ref); continue; }
        const rendered = new Map<string, [string, string, string, string]>(), poses = new Map<string, R>(layout.poses.map((pose: R) => [pose.object_ref, pose]));
        for (const objectRef of [...layout.top_to_bottom_object_refs].reverse() as string[]) {
          const pose = poses.get(objectRef)!, mask = masks.get(pose.candidate_ref)!;
          for (const pixel of mask.pixels as R[]) for (const point of iterIntegerCatalogueProjection([pixel.point], pose.scale, pose.translation)) {
            budget.visit({ stage: 'licensed_full_mask_projection', model_ref: model.model_ref, view_ref: ref, object_ref: objectRef });
            const key = pointKey(point);
            if (viewport.has(key) && (pose.opaque || !rendered.has(key))) rendered.set(key, [pixel.value_ref, objectRef, mask.mask_provenance_ref, pose.pose_provenance_ref]);
          }
        }
        const present = new Map<string, string>(view.visible_present.map((pixel: R) => [pointKey(pixel.point), pixel.value_ref]));
        const observed = new Set<string>([...present.keys(), ...view.visible_absent.map(pointKey)]);
        for (const point of sortedPoints(observed)) {
          budget.visit({ stage: 'truly_visible_observation', view_ref: ref, point });
          const key = pointKey(point); if (!viewport.has(key) || unknown.has(key)) continue;
          const prediction = rendered.get(key);
          if (prediction && !query.has(prediction[1])) continue;
          const positive = present.has(key), mismatch = positive ? !prediction || prediction[0] !== present.get(key) : prediction !== undefined;
          const row = { view_ref: ref, evidence_revision_ref: view.evidence_revision_ref, point, observed_present: positive,
            expected_value_ref: present.get(key) ?? null, projected_pixel: prediction ?? null, occluder_provenance_ref: layout.occluder_provenance_ref };
          checks.push(row); if (mismatch) contradictions.push(row);
        }
      }
      unresolvedAny ||= unresolved.length > 0;
      rows.push({ model_ref: model.model_ref, contradicting_visible_pixels: contradictions, checked_view_pixels: checks, unresolved_view_refs: unresolved, consistent: contradictions.length === 0 });
    }
    budget.finish();
    return result(q, unresolvedAny ? 'NEEDS_EVIDENCE' : 'COMPLETE', unresolvedAny ? 'UNREGISTERED_OR_UNSEALED_VIEW' : 'LAYER_CORRELATED_CATALOGUE_DOMAIN',
      { assignment_rows: rows, consistent_model_refs: rows.filter(row => row.consistent).map(row => row.model_ref),
        occluded_or_clipped_pixel_used_as_negative: false, intermediate_registered_view_discarded: false, reference_restoration_target_created: false }, !unresolvedAny, budget.examined);
  } catch (error) {
    if (!(error instanceof Interrupted)) throw error;
    return result(q, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, { restart_layered_projection: true, work: error.frontier });
  }
}

export function certifyOccludedCatalogue(scene: R, rows: NativeRows, observation: R, backgrounds: readonly number[], fits: readonly R[],
  deadlineMs: number, now: Clock = () => performance.now()): R | null {
  const color = scene.palette, unique = new Map<string, number[]>();
  for (const fit of fits) { const pose = [fit.scale, ...fit.translation]; unique.set(JSON.stringify(pose), pose); }
  const poses = [...unique.values()].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
  const revision = observation.observation_ref, object = 'O_catalogue_subject', view = 'V_current', value = `palette:${color}`;
  const masks = (scene.cards as R[]).map((card, i) => ({ candidate_ref: `M${i}`, pixels: card.mask.map((point: P) => ({ point, value_ref: value })),
    supported_integer_scales: [...new Set(poses.map(pose => pose[0]!))].sort((a, b) => a - b), mask_provenance_ref: revision }));
  const models: R[] = [], viewport = new Set<string>();
  for (const [i, card] of (scene.cards as R[]).entries()) for (const [scale, x, y] of poses as [number, number, number][]) {
    for (const point of iterIntegerCatalogueProjection(card.mask, scale, [x, y])) viewport.add(pointKey(point));
    models.push({ model_ref: `A${i}_${scale}_${x}_${y}`, views: [{ view_ref: view, poses: [{ object_ref: object, candidate_ref: `M${i}`, scale,
      translation: [x, y], opaque: true, pose_provenance_ref: revision }], top_to_bottom_object_refs: [object], occluder_provenance_ref: 'other_values_unobserved_no_layer_order_claim' }] });
  }
  if (!models.length || models.length > 128) return null;
  const [l, t, r, b] = scene.field, present = new Set<string>();
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) if (rows[y]![x] === color) present.add(pointKey([x, y]));
  for (const point of present) viewport.add(point);
  const absent = new Set([...viewport].filter(key => { const [x, y] = pointOf(key); return backgrounds.includes(rows[y]![x]!); }));
  const unknown = new Set([...viewport].filter(point => !present.has(point) && !absent.has(point)));
  const scope = { request_ref: 'projection:' + identity([revision, scene.geometry_ref, fits]), caller_ref: 'public_catalogue_question', parent_consumer_ref: 'SRC_composition',
    parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'compare_current_partial_projection', caller_next_item_ref: revision, epoch: observation.level_epoch,
    evidence_revision_ref: revision, model_revision_ref: identity([masks, poses]), model_status_ref: 'conditional_observed_catalogue_and_reciprocal_substrate_hypothesis',
    event_owner_ref: 'SRC', input_domain_complete: true, assumption_refs: ['largest_frame_as_subject_field', 'aligned_same_palette_catalogue_as_shape_alternatives',
      'integer_scale_orientation_preserved', 'reciprocal_exposed_value_as_open_substrate', 'other_values_remain_unobserved'] };
  return measureOccludedCatalogueProjection({ scope, operation_ref: OPERATION, mode_ref: 'COMPARE', phase_ref: 'REGISTERED_LAYERED_VIEWS', requested_result_type: 'DMechanicalResult',
    node_bound: 100000, depth_bound: 4096, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))), masks, models,
    registered_views: [{ view_ref: view, evidence_revision_ref: revision, epoch: observation.level_epoch, sealed: true, viewport_cells: sortedPoints(viewport), queried_object_refs: [object],
      visible_present: sortedPoints(present).map(point => ({ point, value_ref: value })), visible_absent: sortedPoints(absent), unobserved_cells: sortedPoints(unknown) }], requested_view_refs: [view] }, now);
}
