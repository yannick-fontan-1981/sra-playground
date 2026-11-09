/** Consumed V5 reactive_pursuit_observation and rigid_grasp_geometry primitives.
 * Pure measurements; no control role, physical outcome or action authority. */
import { supportParts, supportCompare } from './v6-support-measurements.ts';
import { outlineEqual as same, outlineTruthy as truth } from './v6-outline-identity.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
type Points = readonly (readonly number[])[];
const key = (p: readonly number[]) => p.join(',');
const orderedUnique = (points: Points): number[][] => [...new Map(points.map(p => [key(p), [...p]])).values()].sort(supportCompare);

export function occupied_union(carrier: Points, part: Points = [], extra: Points = []): number[][] { return orderedUnique([...carrier, ...part, ...extra]); }
export function translated_mask(mask: Points, delta: readonly number[]): number[][] { return mask.map(([x, y]) => [x! + delta[0]!, y! + delta[1]!]); }
export function support_collisions(carrier: Points, part: Points, terrain: ReadonlyMap<string, any> | R, obstacles: Points = [], extra: Points = []): [number[][], number[][]] {
  const blocked: number[][] = [], unknown: number[][] = [], obstacleSet = new Set(obstacles.map(key));
  for (const point of occupied_union(carrier, part, extra)) {
    const supplied = terrain instanceof Map ? terrain.get(key(point)) : (terrain as R)[key(point)];
    if (obstacleSet.has(key(point)) || supplied != null && supplied[0] === 'BLOCKED') blocked.push(point);
    else if (supplied == null || supplied[0] !== 'SUPPORTED' || !truth(supplied[1])) unknown.push(point);
  }
  return [blocked, unknown];
}
export function candidate_grasp_roots(carrier_offsets: Points, part_cells: Points, vectors: Points, maximum_evaluations: number): [number[][], number, boolean] {
  const roots: number[][] = [], seen = new Set<string>(); let work = 0;
  for (const [px, py] of part_cells) for (const [cx, cy] of carrier_offsets) for (const [dx, dy] of vectors) {
    if (work >= maximum_evaluations) return [roots, work, false];
    const root = [px! - cx! - dx!, py! - cy! - dy!], k = key(root);
    if (!seen.has(k)) { seen.add(k); roots.push(root); } work++;
  }
  return [roots, work, true];
}

/** InteractionProbeInput-shaped consumed measurement. Boxes are xyxy or source
 * bbox objects; components retain exact V5 IDs and row/column pixels. */
export function measure_reactive_pursuit_observation(value: R, options: { contact_quantum: number | null; contact_grid_current: boolean }): R {
  const base = { relative_escape_measurement_present: false, relative_escape_counteracted_approach_count: 0,
    relative_escape_transition_rows: [], relative_motion_pair_count: 0, relative_escape_contact_component_refs: [],
    relative_escape_contact_witnesses: [], relative_escape_contact_component_count: 0,
    relative_escape_contact_measurement_status: 'control_geometry_unavailable', relative_escape_manipulation_confirmed: false };
  const asBox = (b: any): R => Array.isArray(b) ? { left: b[0], top: b[1], right: b[2], bottom: b[3], width: b[2] - b[0] + 1, height: b[3] - b[1] + 1 } : b;
  const boxes: R[] = [];
  for (const raw of value.canonical_provisional_control_geometry_bboxes ?? []) { const b = asBox(raw); if (!boxes.some(x => same(x, b))) boxes.push(b); }
  boxes.sort((a, b) => supportCompare([a.top, a.left, a.bottom, a.right], [b.top, b.left, b.bottom, b.right]));
  if (boxes.length !== 1 || !truth(value.current_observation_frame_ref)) return base;
  const body = boxes[0]!, rawComponents = value.components?.components ?? value.components ?? supportParts(value.frame?.rows ?? value.frame);
  const components = Object.fromEntries(rawComponents.map((c: R) => [c.component_id, c])) as R;
  const translations = Object.fromEntries((value.current_exact_component_translations ?? []).map(([ref, dr, dc]: any[]) => [ref, [dr, dc]])) as R;
  const controlled = orderedUnique(Object.entries(translations).filter(([ref]) => components[ref] && same(components[ref].bbox, body)).map(([, delta]) => delta) as Points);
  const [dr, dc] = controlled.length === 1 ? controlled[0]! : [0, 0];
  const current = [body.top + body.bottom, body.left + body.right], previous = [current[0]! - 2 * dr!, current[1]! - 2 * dc!];
  const distance = (a: readonly number[], b: readonly number[]) => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!);
  const squared = (a: readonly number[]) => a[0]! ** 2 + a[1]! ** 2;
  const rows: R[] = [];
  if (controlled.length === 1) for (const ref of Object.keys(translations).sort()) {
    const component = components[ref]; if (!component || same(component.bbox, body)) continue;
    const [pr, pc] = translations[ref], b = component.bbox, afterPeer = [b.top + b.bottom, b.left + b.right], beforePeer = [afterPeer[0]! - 2 * pr, afterPeer[1]! - 2 * pc];
    const before = distance(previous, beforePeer), held = distance(current, beforePeer), after = distance(current, afterPeer);
    const beforeVector = [beforePeer[0]! - previous[0]!, beforePeer[1]! - previous[1]!], afterVector = [afterPeer[0]! - current[0]!, afterPeer[1]! - current[1]!], heldVector = [beforePeer[0]! - current[0]!, beforePeer[1]! - current[1]!];
    rows.push({ peer_component_ref: ref, controlled_component_refs: Object.keys(translations).filter(k => components[k] && same(components[k].bbox, body)).sort(), frame_ref: value.current_observation_frame_ref,
      distance_before_twice: before, distance_held_peer_twice: held, distance_after_twice: after, controlled_approach_twice: before - held, peer_separation_change_twice: after - held, distance_delta_twice: after - before,
      squared_distance_before_fourfold: squared(beforeVector), squared_distance_after_fourfold: squared(afterVector), squared_distance_delta_fourfold: squared(afterVector) - squared(beforeVector), controlled_squared_approach_fourfold: squared(beforeVector) - squared(heldVector),
      controlled_translation_rc: [dr, dc], peer_translation_rc: [pr, pc], relative_translation_rc: [pr - dr!, pc - dc!], controlled_translation_squared_norm: dr! * dr! + dc! * dc!, peer_translation_squared_norm: pr * pr + pc * pc,
      translation_squared_norm_difference: pr * pr + pc * pc - dr! * dr! - dc! * dc!, shared_translation: same([pr, pc], [dr, dc]), peer_counteracted_approach: !same([pr, pc], [dr, dc]) && before > held && after >= before });
  }
  const quantum = options.contact_quantum || 0, beforeFrame: NativeRows | null = value.previous_action_observed_frame?.rows ?? value.previous_action_observed_frame ?? null;
  const contacts: string[] = [], witnesses: R[] = [], core = Object.keys(components).filter(ref => same(components[ref].bbox, body)).sort();
  const actorPixels: number[][] = core.length === 1 ? components[core[0]!].pixels : [], boundary = new Map<string, number[]>();
  for (const [r, c] of [...actorPixels].sort(supportCompare)) for (const [dy, dx] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) { const k = key([r! + dy!, c! + dx!]); if (!boundary.has(k)) boundary.set(k, [r!, c!]); }
  const status = !options.contact_grid_current || quantum <= 0 ? 'grid_unqualified' : beforeFrame === null ? 'prior_observation_missing' : 'measured';
  if (status === 'measured') for (const ref of Object.keys(components).sort()) {
    const component = components[ref], b = component.bbox;
    if (same(b, body) || Object.hasOwn(translations, ref) || component.touches_frame_boundary) continue;
    const center = [b.top + b.bottom, b.left + b.right];
    const cellNeighbors = body.height <= quantum && body.width <= quantum && b.height <= quantum && b.width <= quantum && distance(current, center) === 2 * quantum && (center[0] === current[0] || center[1] === current[1]);
    let contactPixels = orderedUnique(component.pixels.filter((p: number[]) => boundary.has(key(p))));
    if (!cellNeighbors) {
      if (b.height <= quantum && b.width <= quantum || b.height % quantum || b.width % quantum || (b.top - body.top) % quantum || (b.left - body.left) % quantum || (value.current_input_aligned_underlay_values ?? []).includes(component.value)) continue;
      contactPixels = contactPixels.filter(([r, c]) => !(body.top <= r! && r! <= body.bottom && body.left <= c! && c! <= body.right));
    }
    if (!cellNeighbors && !contactPixels.length) continue;
    if (component.pixels.every(([r, c]: number[]) => r! >= 0 && r! < beforeFrame!.length && c! >= 0 && c! < beforeFrame![r!]!.length && beforeFrame![r!]![c!] === component.value)) {
      contacts.push(ref);
      if (core.length === 1) witnesses.push({ frame_ref: value.current_observation_frame_ref, actor_component_ref: core[0], subject_component_ref: ref,
        actor_bbox: [body.top, body.left, body.bottom, body.right], subject_bbox: [b.top, b.left, b.bottom, b.right], cell_pitch: quantum,
        ...(!cellNeighbors ? { contact_geometry_kind: 'observed_pixel_boundary', pixel_contact_pair: [boundary.get(key(contactPixels[0]!)), contactPixels[0]] } : {}) });
    }
  }
  const scalar = rows.length === 1 ? Object.fromEntries(Object.entries(rows[0]!).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => ['relative_motion_' + k, v])) : {};
  return { ...base, ...scalar, relative_motion_pair_count: rows.length, relative_escape_measurement_present: rows.length > 0, relative_escape_transition_rows: rows,
    relative_escape_counteracted_approach_count: rows.filter(r => r.peer_counteracted_approach).length, relative_escape_contact_component_refs: contacts, relative_escape_contact_witnesses: witnesses,
    relative_escape_contact_measurement_status: status, relative_escape_contact_component_count: contacts.length };
}
export { occupied_union as occupiedUnion, translated_mask as translatedMask, support_collisions as supportCollisions, candidate_grasp_roots as candidateGraspRoots, measure_reactive_pursuit_observation as measureReactivePursuitObservation };
