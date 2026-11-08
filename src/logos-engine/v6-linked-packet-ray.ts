/** Conditional visible-support routes; no full optical state machine or game law. */
import { linkedPacketDigest as identity, linkedCircular as circular, linkedCopySign as copySign, linkedRound as round } from './v6-linked-packet-numeric.ts';
import { VisibleBoxRayBudget, visibleBoxFirstHit } from './v6-visible-box-ray.ts';

type R = Record<string, any>;
type Clock = () => number;
const ratio = (value: number): number[] => [round(value * 1_000_000), 1_000_000];

export function linkedLattice(outputs: R, steps: R): R | null {
  const values = Object.values(steps).filter(value => value.status === 'candidate' && 0.02 < Math.abs(value.delta) && Math.abs(value.delta) < Math.PI).map(value => Math.abs(value.delta));
  if (!values.length) return null;
  const count = round(2 * Math.PI / (values.reduce((sum, value) => sum + value, 0) / values.length));
  if (count < 3 || count > 128) return null;
  const step = 2 * Math.PI / count;
  if (values.some(value => Math.abs(value - step) > 0.1)) return null;
  const angles = Object.values(outputs).filter(value => Object.hasOwn(value, 'angle')).map(value => value.angle);
  if (!angles.length) return null;
  const residues = angles.map(angle => circular(angle * count) / count).sort((a, b) => a - b), origin = residues[Math.floor(residues.length / 2)]!;
  const alternatives = Array.from({ length: 126 }, (_, index) => index + 3).filter(n => values.every(value => Math.abs(value - 2 * Math.PI / n) <= 0.1));
  return { count, compatible_count_candidates: alternatives, chosen_count_status: 'experimental_fit_not_unique_law', angular_tolerance_radians: 0.1, step, origin,
    scope: 'Uniform cyclic angular spacing fitted as a hypothesis to measured output differences, not a creator calibration. Compatible alternative periods retained.' };
}

export function estimateLinkedPhase(drawing: string, outputs: R, edges: readonly R[], steps: R, grid: R): R | null {
  const known: Record<string, number> = Object.fromEntries(Object.entries(outputs).filter(([, value]) => Object.hasOwn(value, 'angle')).map(([key, value]) => [key, value.angle]));
  const todo = Object.keys(known);
  for (let cursor = 0; cursor < todo.length; cursor++) {
    const a = todo[cursor]!;
    for (const edge of edges) {
      if (edge.before !== a || Object.hasOwn(known, edge.after)) continue;
      const law = steps[edge.action];
      if (!law || law.status !== 'candidate') continue;
      known[edge.after] = circular(known[a]! + copySign(grid.step, law.delta)); todo.push(edge.after);
    }
  }
  if (!Object.hasOwn(known, drawing)) {
    const offsets: Record<string, number> = { [drawing]: 0 }, queue = [drawing], anchors: number[] = [], witnesses: string[] = [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const node = queue[cursor]!, offset = offsets[node]!, measured = outputs[node];
      if (measured && Object.hasOwn(measured, 'angle')) anchors.push(circular(measured.angle - offset));
      for (const edge of edges) {
        const law = steps[edge.action];
        if (!law || law.status !== 'candidate') continue;
        const delta = copySign(grid.step, law.delta);
        let other: string, nextOffset: number;
        if (edge.before === node) { other = edge.after; nextOffset = circular(offset + delta); }
        else if (edge.after === node) { other = edge.before; nextOffset = circular(offset - delta); }
        else continue;
        if (Object.hasOwn(offsets, other)) { if (Math.abs(circular(offsets[other]! - nextOffset)) > 0.1) return null; }
        else { offsets[other] = nextOffset; queue.push(other); witnesses.push(edge.evidence); }
      }
    }
    if (!anchors.length || anchors.some(angle => Math.abs(circular(angle - anchors[0]!)) > 0.1)) return null;
    return { angle: anchors[0], status: 'conditional_inverse_of_observed_input_relation', relation_evidence: [...new Set(witnesses)].sort(), anchor_count: anchors.length,
      scope: 'Algebraic inference under the same candidate increment, not an observed output or a reversible-action law. Later packet comparison required.' };
  }
  return { angle: known[drawing], status: Object.hasOwn(outputs, drawing) && Object.hasOwn(outputs[drawing], 'angle') ? 'measured' : 'conditional_from_observed_input_edges',
    scope: 'Predicted angular effect requires later packet comparison.' };
}

export function linkedRelayRoute(state: R, target: R, outputs: R, steps: R, observation: R, deadlineMs: number, now: Clock = () => performance.now()): R | null {
  const grid = linkedLattice(outputs, steps), bindings = state.bindings, received = state.received_controls ?? [];
  if (!grid || !received.length) return null;
  const bodies: R = Object.fromEntries(Object.values(bindings as R).map(body => [body.ref, body])); bodies[target.ref] = target;
  const source = bindings[received[0]].ref, box = state.scene.frame, angles = Array.from({ length: grid.count }, (_, index) => grid.origin + index * grid.step);
  const context = identity([bodies, grid, source, box]), cached = state.geometric_route_cache;
  if (cached && cached.context === context) return { ...structuredClone(cached.value), kernel_calls_this_proposal: 0, geometry_reused: true };
  const model = {
    model_ref: 'visible_boxes:' + identity([bodies, grid]),
    receivers: Object.entries(bodies).map(([ref, body]) => ({ body_ref: ref, kind_ref: 'visible_support_hypothesis', center: body.point.map(ratio),
      shape_ref: 'axis_aligned_closed_box', box_bounds: body.bbox.map(ratio), geometry_evidence_ref: observation.observation_ref })),
    directions: angles.map((angle, index) => ({ direction_ref: `d${index}`, vector: [ratio(Math.cos(angle)), ratio(Math.sin(angle))], evidence_ref: 'conditional_angular_lattice:' + identity(grid) })),
    boundary_bounds: box.map(ratio), square_root_bits: 32, intersection_law_ref: 'positive_analytic_ray_intersections_before_box_exit',
    source_inside_receiver_law_ref: null, hit_tie_law_ref: null, receiver_tie_order: [],
  };
  const scope = { request_ref: 'visible-ray:' + identity([observation.observation_ref, grid]), caller_ref: 'public_packet_geometry', parent_consumer_ref: 'SRC_composition',
    parent_goal_ref: 'G_official_completion', parent_contribution_ref: 'experimental_relay_support_path', caller_next_item_ref: observation.observation_ref,
    epoch: observation.level_epoch, evidence_revision_ref: observation.observation_ref, model_revision_ref: model.model_ref,
    model_status_ref: 'conditional_ray_intersection_with_visible_boxes_only', event_owner_ref: 'SRC', input_domain_complete: true,
    assumption_refs: ['finite_visible_support_geometry', 'analytical_box_intersection_is_not_game_collision_law', 'uniform_angular_cycle_is_empirical_candidate', 'distinct_marker_as_terminal_remains_hypothesis'] };
  const request = { scope, operation_ref: 'mechanics.discrete_relay_optics.first_hit', mode_ref: 'FIRST_HIT', requested_result_type: 'DMechanicalResult',
    node_bound: 100000, depth_bound: 4096, domain_bound: 4096, time_bound_ms: Math.max(1, Math.min(300000, Math.trunc(deadlineMs - now()))) };
  const budget = new VisibleBoxRayBudget(request, now), arcs: Record<string, R[]> = Object.fromEntries(Object.keys(bodies).map(ref => [ref, []]));
  let calls = 0;
  for (const [ref, body] of Object.entries(bodies)) {
    if (ref === target.ref) continue;
    for (const [index, angle] of angles.entries()) {
      const ray = { origin: body.point.map(ratio), direction_ref: `d${index}`, excluded_source_body_ref: ref };
      const result = visibleBoxFirstHit(model, ray, budget), hit = result.first_receiver_ref; calls++;
      if (!result.complete_first_hit || !Object.hasOwn(bodies, hit)) continue;
      const dx = bodies[hit].point[0] - body.point[0], dy = bodies[hit].point[1] - body.point[1];
      if (Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle)) > 1) continue;
      arcs[ref]!.push({ source: ref, recipient: hit, angle: circular(angle), direction_ref: `d${index}`, geometry_result: result });
    }
  }
  const todo: [string, R[]][] = [[source, []]], seen = new Set([source]);
  let route: R[] | null = null;
  for (let cursor = 0; cursor < todo.length; cursor++) {
    const [node, path] = todo[cursor]!;
    if (node === target.ref) { route = path; break; }
    for (const edge of arcs[node]!) if (!seen.has(edge.recipient)) { seen.add(edge.recipient); todo.push([edge.recipient, [...path, edge]]); }
  }
  budget.finish();
  const result = route?.length ? { route, grid, kernel_calls: calls, kernel_calls_this_proposal: calls, geometry_reused: false,
    geometric_arcs: Object.values(arcs).reduce((sum, edges) => sum + edges.length, 0), method: 'discrete_relay_optics._first_hit exact internal geometry kernel',
    full_optical_state_machine_invoked: false,
    scope: 'Finite hypothetical angular rays through visible support centers. Rendering boxes are not claimed to be physical capture volumes. No drawing-cycle or reset-state premise supplied.' } : null;
  if (result) state.geometric_route_cache = { context, value: structuredClone(result) };
  return result;
}
