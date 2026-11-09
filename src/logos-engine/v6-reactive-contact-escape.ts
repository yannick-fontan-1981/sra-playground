/** Pinned V6 escape_domain and its consumed V5 finite topology measurement.
 * Conditional endpoint geometry is not a response law or a capture proof.
 */
import { compareUnicode } from './canonical.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import { occupied_union, translated_mask, support_collisions } from './v6-reactive-contact-geometry.ts';
type R = Record<string, any>;
type Point = readonly number[];
const key = (point: Point): string => point.join(',');
const sorted = (values: Iterable<string>): string[] => [...values].sort(compareUnicode);
const shift = (box: number[], delta: Point): number[] => box.map((v, i) => v + delta[i % 2]!);

export function measure_escape_topology(domain: R, budget: { visit(value: R): void }): R {
  const nodes = new Set<string>(domain.node_refs), region = new Set<string>(domain.region_node_refs),
    complete = new Set<string>(domain.complete_successor_node_refs ?? []), evidence = domain.completeness_evidence_refs ?? [];
  if (!Array.isArray(domain.node_refs) || nodes.size < 1 || nodes.size > 4096
    || !Array.isArray(domain.region_node_refs) || region.size < 1 || region.size > 4096
    || (domain.transitions ?? []).length > 65536 || !['terrain_only', 'current_occupancy'].includes(domain.occupancy_scope)) {
    throw new TypeError('Escape topology domain exceeds its source contract');
  }
  if (nodes.size !== domain.node_refs.length || region.size !== domain.region_node_refs.length) throw new TypeError('escape topology repeats a node');
  if (!region.has(domain.current_node_ref) || [...region].some(ref => !nodes.has(ref))) throw new TypeError('escape region must contain the actor and lie in the node domain');
  if ([...complete].some(ref => !nodes.has(ref))) throw new TypeError('successor completeness refers outside the node domain');
  if (complete.size && !evidence.length) throw new TypeError('closed successor domains require explicit completeness evidence');
  const pairs = new Set<string>(), outgoing = Object.fromEntries([...nodes].map(ref => [ref, [] as R[]]));
  for (const edge of domain.transitions ?? []) {
    const pair = JSON.stringify([edge.origin_ref, edge.destination_ref]);
    if (!nodes.has(edge.origin_ref) || !nodes.has(edge.destination_ref) || pairs.has(pair)) throw new TypeError('transition domain is contradictory or has an unbound endpoint');
    pairs.add(pair);
    if (!['free', 'blocked', 'unknown'].includes(edge.availability)) throw new TypeError('Unsupported escape transition availability');
    if (edge.availability !== 'unknown' && !truth(edge.evidence_refs)) throw new TypeError('free/blocked transitions require evidence');
    budget.visit({ escape_actor_ref: domain.actor_ref, origin_ref: edge.origin_ref }); outgoing[edge.origin_ref]!.push(edge);
  }
  const reached = new Set<string>([domain.current_node_ref]), queue = [domain.current_node_ref], gateways = new Set<string>(),
    boundary: [string, string][] = [], unknownOrigins = new Set<string>();
  for (let at = 0; at < queue.length; at++) {
    const origin = queue[at]!; budget.visit({ escape_actor_ref: domain.actor_ref, region_origin_ref: origin });
    for (const edge of outgoing[origin]!) {
      if (edge.availability === 'unknown') unknownOrigins.add(origin);
      if (edge.availability !== 'free' || edge.destination_ref === origin) continue;
      const destination = edge.destination_ref;
      if (!region.has(destination)) { gateways.add(destination); boundary.push([origin, destination]); }
      else if (!reached.has(destination)) { reached.add(destination); queue.push(destination); }
    }
  }
  const current = outgoing[domain.current_node_ref]!, free = sorted(current.filter(e => e.availability === 'free'
    && e.destination_ref !== domain.current_node_ref).map(e => e.destination_ref)), unknown = current.filter(e => e.availability === 'unknown').length;
  boundary.sort((a, b) => compareUnicode(a[0], b[0]) || compareUnicode(a[1], b[1]));
  return { model_ref: domain.model_ref, actor_ref: domain.actor_ref, current_node_ref: domain.current_node_ref,
    occupancy_scope: domain.occupancy_scope, current_free_relocation_refs: free, current_free_relocation_count: free.length,
    current_unknown_transition_count: unknown, current_successor_domain_complete: complete.has(domain.current_node_ref) && unknown === 0,
    reachable_region_node_refs: sorted(reached), boundary_transition_refs: boundary, egress_gateway_refs: sorted(gateways), egress_gateway_count: gateways.size,
    reachable_region_domain_complete: [...reached].every(ref => complete.has(ref)) && unknownOrigins.size === 0,
    completeness_evidence_refs: evidence, stationary_responses_excluded_from_relocations: true,
    capture_observation_established: false, primitive_release_authorized: false };
}

export function _mask(entity: R): number[][] {
  const box = entity.bbox, points = entity.mask;
  if (!truth(points)) throw new TypeError('exact occupied mask required; bbox is not a collision mask');
  const result = points.map(([x, y]: number[]) => [box[0] + x!, box[1] + y!]);
  if (result.some(([x, y]: number[]) => !(box[0] <= x! && x! <= box[2] && box[1] <= y! && y! <= box[3]))) {
    throw new TypeError('mask is not local xy inside supplied bbox');
  }
  return result;
}

export function project(scene: R | null, recipe: R | null, observation_ref: string, epoch: number): R {
  const base: R = { status: 'unknown', binding: { observation_ref, epoch }, current: null, placements: [], unknowns: [],
    primitive_release_authorized: false, capture_established: false };
  if (!truth(scene) || !truth(observation_ref)) return { ...base, unknowns: ['current_scene_or_observation_missing'] };
  const s = scene!, tiles = s.tiles as Record<string, R>, pitch = s.pitch;
  if (!Number.isSafeInteger(pitch) || pitch <= 0 || Object.keys(tiles).length > 4096) return { ...base, unknowns: ['unqualified_or_oversized_lattice'] };
  const body = s.body, peer = s.peer;
  let bm: number[][], pm: number[][], stones: [R, number[][]][];
  try { bm = _mask(body); pm = _mask(peer); stones = s.stones.map((stone: R) => [stone, _mask(stone)]); }
  catch (error) { return { ...base, unknowns: ['occupied_mask_unavailable:' + (error as Error).message] }; }
  const anchor: Record<string, number[]> = Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, [t.box[0], t.box[1]]])),
    byAnchor = new Map(Object.entries(anchor).map(([k, point]) => [key(point), k]));
  if (Object.keys(anchor).length !== byAnchor.size || !Object.hasOwn(tiles, s.bodykey) || !Object.hasOwn(tiles, s.peerkey)) {
    return { ...base, unknowns: ['ambiguous_current_lattice_binding'] };
  }
  const vectors = [[pitch, 0], [-pitch, 0], [0, pitch], [0, -pitch]], support = new Map<string, [string, string]>();
  for (const k of s.admitted) for (let x = tiles[k]!.box[0]; x <= tiles[k]!.box[2]; x++) {
    for (let y = tiles[k]!.box[1]; y <= tiles[k]!.box[3]; y++) support.set(key([x, y]), ['SUPPORTED', observation_ref]);
  }
  const candidates = [...stones];
  for (const entity of s.current_entities ?? []) {
    if (candidates.some(([stone]) => eq(entity.bbox, stone.bbox) && eq(entity.signature ?? null, stone.signature ?? null))) continue;
    if (truth(recipe) && eq(entity.bbox, recipe!.subject_box ?? [])) {
      try { candidates.push([entity, _mask(entity)]); } catch { /* Source declines this exact missing-mask candidate. */ }
    }
  }
  const matches = truth(recipe) && recipe!.status === 'observed_nonpushing_common_translation' && recipe!.scope === epoch && truth(recipe!.evidence)
    ? candidates.filter(([stone]) => eq(stone.bbox, recipe!.subject_box ?? [])
      && eq(stone.palette_value ?? null, recipe!.subject_value ?? recipe!.value ?? null)
      && eq(recipe!.offset ?? [], [stone.bbox[0] - body.bbox[0], stone.bbox[1] - body.bbox[1]])) : [];
  let subject: [R, number[][]] | null = matches.length === 1 ? matches[0]! : null;
  if (subject && (eq(subject[0].bbox, peer.bbox) || eq(subject[0].bbox, body.bbox))) subject = null;
  if (subject && !stones.some(([stone]) => stone === subject![0])) stones.push(subject);
  const origin = anchor[s.bodykey]!, peerOrigin = anchor[s.peerkey]!, allStones = occupied_union([], [], stones.flatMap(([, pixels]) => pixels));
  function graph(obstacles: Point[], terrain: Map<string, [string, string]>, model_ref: string): R {
    const edges: R[] = [], outgoing: Record<string, string[]> = {}, unknown: Record<string, R[]> = {};
    for (const [k, [x, y]] of Object.entries(anchor)) {
      outgoing[k] = []; unknown[k] = [];
      const atOrigin = translated_mask(pm, [x! - peerOrigin[0]!, y! - peerOrigin[1]!]),
        [originBlocked, originMissing] = support_collisions(atOrigin, [], terrain, obstacles);
      if (truth(originBlocked) || truth(originMissing)) { unknown[k]!.push({ reason: 'origin_configuration_not_geometrically_admitted' }); continue; }
      for (const [dx, dy] of vectors) {
        const dest = byAnchor.get(key([x! + dx!, y! + dy!]));
        if (dest === undefined) { unknown[k]!.push({ delta: [dx, dy], reason: 'outside_observed_lattice' }); continue; }
        const da = anchor[dest]!, moved = translated_mask(pm, [da[0]! - peerOrigin[0]!, da[1]! - peerOrigin[1]!]),
          [blocked, missing] = support_collisions(moved, [], terrain, obstacles), status = truth(blocked) ? 'blocked' : truth(missing) ? 'unknown' : 'free';
        edges.push({ origin: k, destination: dest, status });
        if (status === 'free') outgoing[k]!.push(dest);
        if (status === 'unknown') unknown[k]!.push({ destination: dest, reason: 'unmeasured_support' });
      }
    }
    const budget = { count: 0, visit(_value: R) { this.count++; } };
    const measured = measure_escape_topology({ model_ref, actor_ref: peer.signature, current_node_ref: s.peerkey,
      node_refs: sorted(Object.keys(tiles)), transitions: edges.map(e => ({ origin_ref: e.origin, destination_ref: e.destination,
        availability: e.status, evidence_refs: [observation_ref] })), region_node_refs: sorted(Object.keys(tiles)),
      complete_successor_node_refs: [], completeness_evidence_refs: [], occupancy_scope: 'current_occupancy' }, budget);
    const deadends = Object.entries(outgoing).filter(([, v]) => v.length === 1).map(([k, v]) => ({ node: k, sole_geometric_exit: v[0],
      unknown_successors: unknown[k], response_domain_complete: false }));
    return { nodes: sorted(Object.keys(tiles)), edges, measurement: measured, cul_de_sac_candidates: deadends, outgoing,
      unknown_successors: unknown, evaluations: budget.count, scope: 'conditional_cardinal_endpoint_geometry_not_response_policy' };
  }
  const current = graph(occupied_union(bm, allStones), support, 'escape.current.partial'); base.current = current;
  base.unknowns = ['peer_response_policy', 'response_clock_and_order', 'noncardinal_or_unobserved_successors',
    'swept_collision_between_endpoints', 'support_below_opaque_occupants', 'detachment_or_deposit_effect', 'capture_condition'];
  base.provenance = { calculators: ['escape_topology.measure_escape_topology', 'rigid_grasp_geometry.support_collisions',
    'rigid_grasp_geometry.translated_mask', 'rigid_grasp_geometry.occupied_union'], meaning_contract: 'policy.escape_topology_meaning',
    model_prior: 'cardinal_lattice_endpoint_comparison_only', evidence_refs: [observation_ref, ...(subject ? recipe!.evidence ?? [] : [])] };
  if (subject === null) return { ...base, status: 'partial_geometry_only', unknowns: [...base.unknowns, 'current_transport_recipe_not_uniquely_revalidated'] };
  const [member, sm] = subject, transportSupport = new Map(support);
  for (const point of sm) transportSupport.set(key(point), ['SUPPORTED', observation_ref]);
  const obstacles = occupied_union(pm, [], stones.filter(([other]) => other !== member).flatMap(([, pixels]) => pixels)),
    parents = new Map<string, string | null>([[s.bodykey, null]]), queue = [s.bodykey];
  for (let at = 0; at < queue.length; at++) {
    const k = queue[at]!, [x, y] = anchor[k]!;
    for (const [dx, dy] of vectors) {
      const next = byAnchor.get(key([x! + dx!, y! + dy!])); if (next === undefined || parents.has(next)) continue;
      const pos = anchor[next]!, delta = [pos[0]! - origin[0]!, pos[1]! - origin[1]!],
        [blocked, missing] = support_collisions(translated_mask(bm, delta), translated_mask(sm, delta), transportSupport, obstacles);
      if (truth(blocked) || truth(missing)) continue; parents.set(next, k); queue.push(next);
    }
  }
  const before = current.outgoing[s.peerkey] as string[];
  for (const k of sorted(parents.keys())) {
    if (k === s.bodykey) continue;
    const pos = anchor[k]!, delta = [pos[0]! - origin[0]!, pos[1]! - origin[1]!], bodyBox = shift(body.bbox, delta), subjectBox = shift(member.bbox, delta),
      contained = Object.entries(tiles).filter(([, t]) => t.box[0] <= subjectBox[0]! && subjectBox[0]! <= subjectBox[2]!
        && subjectBox[2]! <= t.box[2] && t.box[1] <= subjectBox[1]! && subjectBox[1]! <= subjectBox[3]! && subjectBox[3]! <= t.box[3]).map(([name]) => name),
      after = graph(occupied_union(translated_mask(bm, delta), translated_mask(sm, delta),
        stones.filter(([other]) => other !== member).flatMap(([, pixels]) => pixels)), transportSupport, 'escape.placement.' + k), route = [k];
    while (parents.get(route.at(-1)!) !== null) route.push(parents.get(route.at(-1)!)!);
    route.reverse(); const exits = after.outgoing[s.peerkey] as string[];
    base.placements.push({ body_key: k, subject_key: contained.length === 1 ? contained[0] : null, body_box: bodyBox,
      subject_box: subjectBox, delta, route_keys: route, geometry: { peer_degree_before: before.length, peer_degree_after: exits.length,
        removed_peer_destinations: sorted(new Set(before.filter(v => !exits.includes(v)))), added_peer_destinations: sorted(new Set(exits.filter(v => !before.includes(v)))),
        unknown_successors: after.unknown_successors[s.peerkey] }, measurement: after.measurement, cul_de_sac_candidates: after.cul_de_sac_candidates,
      conditional: true, release_authorized: false, falsifiers: ['common_offset_changes', 'unexpected_occupancy_or_support',
        'peer_uses_unmodelled_transition', 'detachment_changes_geometry'], scope: 'peer_held_at_current_pose_for_comparison_not_a_dynamics_prediction' });
  }
  base.status = 'partial_geometry_with_conditional_placements'; return base;
}

export const measureEscapeTopology = measure_escape_topology, exactMask = _mask;
