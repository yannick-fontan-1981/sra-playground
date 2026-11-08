/** Native V5 ray_capture_domain_d.py and its called D contract/budget functions. */
type R = Record<string, any>;
type P = [number, number];
const key = (p: readonly number[]): string => p.join(',');
const has = (s: Set<string>, p: P): boolean => s.has(key(p));
const sortedPoints = (s: Set<string>): P[] => [...s].map(v => v.split(',').map(Number) as P).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
class Interrupted extends Error { readonly cause: string; readonly frontier: R; constructor(cause: string, frontier: R = {}) { super(cause); this.cause = cause; this.frontier = frontier; } }
class WorkBudget {
  examined = 0; private started: number;
  readonly request: R; readonly now: () => number;
  constructor(request: R, now: () => number) { this.request = request; this.now = now; this.started = now(); }
  visit(frontier: R = {}): void { if (this.examined >= this.request.node_bound) throw new Interrupted('NODE_BOUND', frontier); if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND', frontier); this.examined++; }
  finish(): void { if (this.now() - this.started >= this.request.time_bound_ms) throw new Interrupted('TIME_BOUND'); }
}
function result(request: R, status: string, cause: string, values: R = {}, complete = false, examined = 0, frontier: R = {}): R {
  const scope = request.scope, facts: R = {};
  for (const field of ['request_ref', 'caller_ref', 'parent_consumer_ref', 'parent_goal_ref', 'parent_contribution_ref', 'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref']) facts[field] = scope[field];
  Object.assign(facts, { operation_ref: request.operation_ref, mode_ref: request.mode_ref, status, cause, domain_complete: complete, examined_count: examined, primitive_release_authorized: false, retained_model_refs: [] });
  return { schema_version: 'yf_arc3_v5.d_mechanical_result.v1', scope: structuredClone(scope), operation_ref: request.operation_ref, mode_ref: request.mode_ref, status, cause, values, domain_complete: complete, examined_count: examined, frontier, descriptive_facts: facts, source_disposition_ref: null, source_policy_ref: null };
}
/** Construction validation used before the original pure measurement boundary. */
function validateShape(request: R): void {
  for (const [field, maximum] of [['node_bound', 100000], ['depth_bound', 4096], ['domain_bound', 4096], ['time_bound_ms', 300000]] as const) if (!Number.isInteger(request[field]) || request[field] < 1 || request[field] > maximum) throw new TypeError(`Invalid ${field}`);
  const tuple = (p: unknown): p is P => Array.isArray(p) && p.length === 2 && p.every(Number.isSafeInteger);
  for (const [field, required, maximum] of [['population', true, 4096], ['board_cells', true, 4096], ['ray_passage_cells', false, 4096], ['landing_support_cells', false, 4096], ['eligible_victim_refs', false, 4096], ['directions', false, 64], ['short_relations', false, 128]] as const) {
    if (!Array.isArray(request[field]) || (required && !request[field].length) || request[field].length > maximum) throw new TypeError(`Invalid ${field}`);
  }
  if (!['SHORT', 'RAY'].includes(request.range_kind) || request.phase_ref !== 'CURRENT_CAPTURE_DOMAIN' || !Number.isInteger(request.scope.epoch) || request.scope.epoch < 0) throw new TypeError('Invalid capture scope');
  if (request.maximum_ray_distance !== null && request.maximum_ray_distance !== undefined && (!Number.isInteger(request.maximum_ray_distance) || request.maximum_ray_distance < 1)) throw new TypeError('Invalid maximum ray distance');
  if (request.proposed_landing !== null && !tuple(request.proposed_landing)) throw new TypeError('Invalid proposed landing');
  for (const name of ['board_cells', 'ray_passage_cells', 'landing_support_cells']) if (request[name].some((p: unknown) => !tuple(p))) throw new TypeError('Invalid capture coordinate');
  if (request.directions.some((p: P) => !tuple(p) || Math.max(Math.abs(p[0]), Math.abs(p[1])) !== 1)) throw new TypeError('ray directions must be supplied unit lattice directions');
  const members = new Set<string>(), occupied = new Set<string>();
  for (const body of request.population) {
    if (typeof body.member_ref !== 'string' || !body.member_ref || members.has(body.member_ref) || !tuple(body.origin) || !Array.isArray(body.occupied_offsets) || !body.occupied_offsets.length || body.occupied_offsets.length > 4096 || body.occupied_offsets.some((p: unknown) => !tuple(p))) throw new TypeError('capture population/focus identity invalid');
    members.add(body.member_ref); const local = new Set<string>();
    for (const [x, y] of body.occupied_offsets) { const k = key([body.origin[0] + x, body.origin[1] + y]); if (local.has(key([x, y]))) throw new TypeError('physical body footprint duplicated'); if (occupied.has(k)) throw new TypeError('overlapping logical occupant masks require separate model assignments'); local.add(key([x, y])); occupied.add(k); }
  }
  if (!members.has(request.native_focus_ref) || request.eligible_victim_refs.some((r: string) => !members.has(r))) throw new TypeError('capture population/focus identity invalid');
  for (const relation of request.short_relations) if (!tuple(relation.intermediate_delta) || !tuple(relation.landing_delta)) throw new TypeError('Invalid short capture relation');
}

export function measureRayCaptureDomain(input: R, now: () => number = () => performance.now()): R {
  const request: R = { ray_passage_cells: [], landing_support_cells: [], eligible_victim_refs: [], directions: [], short_relations: [], maximum_ray_distance: null, observations: [], resume_frontier: {}, ...input, scope: { assumption_refs: [], ...input.scope } };
  validateShape(request);
  if (request.operation_ref !== 'mechanics.typed_jump_carriers.ray_capture_domain' || !['DOMAIN', 'PRECONDITION'].includes(request.mode_ref) || request.requested_result_type !== 'DMechanicalResult') return result(request, 'NOT_APPLICABLE', 'SIGNATURE_MISMATCH');
  if (!request.scope.input_domain_complete) return result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_INCOMPLETE');
  if (['evidence_revision_ref', 'model_revision_ref', 'event_owner_ref', 'caller_next_item_ref'].some(k => !request.scope[k])) return result(request, 'NEEDS_EVIDENCE', 'REQUEST_SCOPE_INCOMPLETE');
  if (Math.max(request.board_cells.length, request.ray_passage_cells.length, request.landing_support_cells.length, request.population.reduce((n: number, b: R) => n + b.occupied_offsets.length, 0)) > request.domain_bound) return result(request, 'NEEDS_EVIDENCE', 'INPUT_DOMAIN_BOUND');
  if (request.mode_ref === 'PRECONDITION' && request.proposed_landing === null) return result(request, 'NEEDS_EVIDENCE', 'PROPOSED_LANDING_NOT_BOUND');
  if (Object.keys(request.resume_frontier).length) return result(request, 'NEEDS_EVIDENCE', 'RESTART_CAPTURE_DOMAIN_FROM_BOUND_POPULATION');
  const budget = new WorkBudget(request, now), bodies = new Map<string, R>(request.population.map((b: R) => [b.member_ref, b])), actor = bodies.get(request.native_focus_ref)!;
  try {
    const board = new Set<string>(request.board_cells.map(key)), passage = new Set<string>(request.ray_passage_cells.map(key)), support = new Set<string>(request.landing_support_cells.map(key));
    const occupied = new Map<string, string>(), rows: R[] = [], witnesses: R[] = [];
    if (actor.rank !== request.range_law_rank) { budget.finish(); return result(request, 'NEEDS_EVIDENCE', 'RANGE_LAW_SCOPE_MISMATCH', { capture_incidences: [], limiting_witnesses: [{ code: 'RANGE_LAW_RANK_SCOPE_MISMATCH' }], proposed_landing_admitted: request.proposed_landing === null ? null : false, later_terminal_class_not_evaluated: true, adversarial_turn_added: false }); }
    for (const body of request.population) for (const [x, y] of body.occupied_offsets) { budget.visit({ stage: 'logical_occupancy', member_ref: body.member_ref }); occupied.set(key([body.origin[0] + x, body.origin[1] + y]), body.member_ref); }
    const append = (victim: string, point: P, relation: string | null, distance: number | null) => {
      const footprint: P[] = []; for (const [x, y] of actor.occupied_offsets) { budget.visit({ stage: 'complete_landing_mask', victim_ref: victim }); footprint.push([point[0] + x, point[1] + y]); }
      const rejected = sortedPoints(new Set(footprint.filter(p => !has(support, p)).map(key))), collision = footprint.filter(p => { const owner = occupied.get(key(p)); return owner !== undefined && owner !== actor.member_ref && owner !== victim; });
      if (rejected.length || collision.length) witnesses.push({ code: 'LANDING_PERMISSION_OR_OCCUPANCY', landing: point, rejected_support_cells: rejected, collision_cells: collision });
      else rows.push({ actor_ref: actor.member_ref, victim_ref: victim, landing: point, relation_ref: relation, ray_distance: distance });
    };
    if (request.range_kind === 'SHORT') {
      for (const relation of request.short_relations) {
        budget.visit({ stage: 'short_capture', relation_ref: relation.relation_ref });
        const middle: P = [actor.origin[0] + relation.intermediate_delta[0], actor.origin[1] + relation.intermediate_delta[1]], landing: P = [actor.origin[0] + relation.landing_delta[0], actor.origin[1] + relation.landing_delta[1]], victim = occupied.get(key(middle)) ?? null;
        if (!has(board, middle) || !has(board, landing) || occupied.has(key(landing)) || !request.eligible_victim_refs.includes(victim) || victim === actor.member_ref) witnesses.push({ code: 'SHORT_INTERMEDIATE_INELIGIBLE', relation_ref: relation.relation_ref, intermediate: middle, victim_ref: victim });
        else append(victim!, landing, relation.relation_ref, null);
      }
    } else {
      for (const direction of request.directions) {
        let victim: string | null = null, stopped = false;
        for (let distance = 1; distance <= request.depth_bound; distance++) {
          budget.visit({ stage: 'ordered_ray', direction, distance });
          const p: P = [actor.origin[0] + distance * direction[0], actor.origin[1] + distance * direction[1]];
          if (request.maximum_ray_distance !== null && distance > request.maximum_ray_distance) { stopped = true; break; }
          if (!has(board, p) || !has(passage, p)) { witnesses.push({ code: 'RAY_BOUNDARY_OR_PASSAGE', point: p, direction }); stopped = true; break; }
          const occupant = occupied.get(key(p)) ?? null;
          if (occupant === actor.member_ref || occupant !== null && occupant === victim) continue;
          if (occupant !== null) { if (victim !== null || !request.eligible_victim_refs.includes(occupant)) { witnesses.push({ code: 'NEAREST_OR_SECOND_OCCUPANT_BLOCKS', point: p, member_ref: occupant, direction }); stopped = true; break; } victim = occupant; }
          else if (victim !== null) append(victim, p, null, distance);
        }
        if (!stopped && (request.maximum_ray_distance === null || request.depth_bound < request.maximum_ray_distance)) throw new Interrupted('RAY_DEPTH_BOUND', { direction });
      }
    }
    budget.finish(); return result(request, 'COMPLETE', 'CAPTURE_DOMAIN', { capture_incidences: rows, limiting_witnesses: witnesses, proposed_landing_admitted: request.proposed_landing === null ? null : rows.some(r => key(r.landing) === key(request.proposed_landing)), later_terminal_class_not_evaluated: true, adversarial_turn_added: false }, true, budget.examined);
  } catch (error) { if (!(error instanceof Interrupted)) throw error; return result(request, 'NEEDS_EVIDENCE', error.cause, {}, false, budget.examined, { restart_capture_domain: true, work: error.frontier }); }
}
