/** Mechanical V5 geometry consumed by V6 OutlineService.
 * Pixel tuples are [row,column]; public boxes are [left,top,right,bottom].
 * This ports both measurements and their bounded route/identity closure. The
 * contact-overlay call has no point/prior-sprite branch, exactly as in V5. */
import { detectV5Components } from './v6-native-observer.ts';
import type { V5BoundingBox, V5Component } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import { symbolicDigest } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { outlineEqual as same, outlineUnique as unique, outlineTupleCompare as compare, outlineTruthy as truth,
  outlineMemorialReferenceMeasurements, outlineGeometryDescriptionsCompatible } from './v6-outline-identity.ts';

type R = Record<string, any>;
type Box = V5BoundingBox;
type Point = readonly [number, number];
type Component = V5Component;
export interface OutlineBox extends R { bbox: number[]; value: number; width: number; height: number; signature: string; interior: number[][]; component_ref: string }
export type OutlineFields = Readonly<Record<string, any>>;
/** The observed source contract breach is distinguishable from malformed
 * inputs and other geometry errors. Its message preserves the strict port. */
export class OutlineMeasurementDomainError extends TypeError {
  readonly field = 'observed_controlled_translation_count';
  readonly limit = 64;
  readonly value: number;
  constructor(value: number) {
    super('Outline interaction measurement count exceeds its source contract');
    this.name = 'OutlineMeasurementDomainError'; this.value = value;
  }
}
const box = (left: number, top: number, right: number, bottom: number): Box => ({ left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 });
const asBox = (value: any): Box => Array.isArray(value) ? box(value[0], value[1], value[2], value[3]) : box(value.left, value.top, value.right, value.bottom);
const boxes = (value: any): Box[] => (value ?? []).map(asBox);
const pose = (b: Box): number[] => [b.top, b.left, b.bottom, b.right];
const key = (p: readonly number[]): string => p.join(',');
const entryOrder = (a: [string, any], b: [string, any]): number => compareUnicode(a[0], b[0]);
const frameRows = (value: any, fallback: NativeRows): NativeRows => value == null ? fallback : Array.isArray(value) ? value : value.rows;
const perimeter = (h: number, w: number): Point[] => {
  const out: Point[] = []; for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (r === 0 || c === 0 || r === h - 1 || c === w - 1) out.push([r, c]); return out;
};
const pixelSet = (pixels: readonly Point[]): Set<string> => new Set(pixels.map(key));
const samePixels = (a: readonly Point[], b: readonly Point[]): boolean => { const left = pixelSet(a), right = pixelSet(b); return left.size === right.size && [...left].every(p => right.has(p)); };
const contains = (b: Box, r: number, c: number): boolean => b.top <= r && r <= b.bottom && b.left <= c && c <= b.right;

/** Consumed InteractionProbeInput bounds, before either measurement executes.
 * A bound is a contract refusal, never permission to truncate alternatives. */
function validateInteractionFields(fields: OutlineFields): void {
  if (!Array.isArray(fields.available_action_refs) || !fields.available_action_refs.length) throw new TypeError('Outline interaction requires available actions');
  const bounds: Record<string, number> = { canonical_provisional_control_term_facts: 64, canonical_provisional_control_geometry_bboxes: 3,
    current_action_conditioned_control_outline_bboxes: 64, translated_entity_bboxes: 64, observed_translated_entity_bboxes: 64,
    input_aligned_entity_bboxes: 64, known_effectful_point_loci: 32, prior_observed_exact_perimeter_components: 16,
    completed_standard_bfs_aligned_entry_region_bboxes: 3, current_input_aligned_underlay_values: 64, episode_input_aligned_underlay_values: 64 };
  for (const [field, bound] of Object.entries(bounds)) if (fields[field] !== undefined && (!Array.isArray(fields[field]) || fields[field].length > bound)) throw new TypeError(`Outline interaction ${field} exceeds its source contract`);
  const count = fields.observed_controlled_translation_count ?? 0, distinct = fields.observed_distinct_translated_entity_count ?? 0, quantum = fields.retained_action_quantized_grid_quantum ?? 0;
  if (Number.isSafeInteger(count) && count > 64) throw new OutlineMeasurementDomainError(count);
  if (!Number.isSafeInteger(count) || count < 0 || count > 64 || !Number.isSafeInteger(distinct) || distinct < 0 || !Number.isSafeInteger(quantum) || quantum < 0 || quantum > 32) throw new TypeError('Outline interaction measurement count exceeds its source contract');
}

export async function outlineBoxes(rows: NativeRows): Promise<OutlineBox[]> {
  const out: OutlineBox[] = [];
  for (const c of (await detectV5Components(rows, 4)).components) {
    const b = c.bbox, w = b.width, h = b.height;
    if (w < 3 || w > 16 || h < 3 || h > 16 || !samePixels(c.relative_pixels, perimeter(h, w))) continue;
    out.push({ bbox: [b.left, b.top, b.right, b.bottom], value: c.value, width: w, height: h,
      signature: symbolicDigest([w, h, c.value]), interior: rows.slice(b.top + 1, b.bottom).map(row => [...row.slice(b.left + 1, b.right)]), component_ref: c.component_id });
  }
  return out;
}

export function outlineSameBox(rows: NativeRows, location: readonly number[], value: number): boolean {
  const [l, t, r, b] = location as [number, number, number, number];
  if (!(0 <= l && l <= r && r < rows[0]!.length && 0 <= t && t <= b && b < rows.length)) return false;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if ((x === l || x === r || y === t || y === b) && rows[y]![x] !== value) return false;
  return true;
}

/** Exact current-box invocation of enclosure_family.measure_contact_overlay_supports.
 * The route caller supplies no point or prior sprites; those unreachable
 * branches are not advertised as implemented by this consumed closure. */
function currentContactOverlaySupports(components: readonly Component[], rows: NativeRows, bindings: readonly R[], sizes: readonly Point[], controls: readonly Box[]): Component[] {
  if (components.length > 128 || bindings.length > 8) return [];
  const variants: R[] = [...bindings];
  const centerAndRelative = (h: number, w: number): [Point[], Point[]] => {
    const center: Point[] = [], relative: Point[] = [];
    for (let r = Math.floor((h - 1) / 2); r <= Math.floor(h / 2); r++) for (let c = Math.floor((w - 1) / 2); c <= Math.floor(w / 2); c++) center.push([r, c]);
    const mid = pixelSet(center); for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (!mid.has(key([r, c]))) relative.push([r, c]);
    return [center, relative];
  };
  if (sizes.length <= 8 && controls.length <= 8) for (const binding of bindings) {
    let location = ['bbox_top', 'bbox_left', 'bbox_height', 'bbox_width'].map(k => binding[k]);
    const sourceRef = binding.entity_ref || binding.term_ref;
    if (!sourceRef || !truth(binding.role_premise_claim_refs)) continue;
    if (!location.every(n => typeof n === 'number' && Number.isInteger(n) || typeof n === 'boolean')) {
      const matches = unique(controls.filter(b => same([b.height, b.width], [binding.bbox_height, binding.bbox_width])).map(b => [b.top, b.left, b.height, b.width]));
      if (matches.length !== 1) continue; location = matches[0]!;
    }
    const [bt, bl, bh, bw] = location.map(Number) as [number, number, number, number];
    for (const [h, w] of sizes) {
      if (h - bh < 0 || w - bw < 0 || h - bh + w - bw > 1 || Math.min(h, w) < 3 || h * w > 256) continue;
      const [center, relative] = centerAndRelative(h, w);
      for (let top = bt + bh - h; top <= bt; top++) for (let left = bl + bw - w; left <= bl; left++) {
        if (top < 0 || left < 0 || top + h > rows.length || left + w > rows[0]!.length) continue;
        const marks = new Set(center.map(([r, c]) => rows[top + r]![left + c]!));
        const colors = new Set(relative.map(([r, c]) => rows[top + r]![left + c]!).filter(color => !marks.has(color)));
        if (marks.size !== 1 || colors.size !== 1) continue; const color = [...colors][0]!;
        if (binding.observed_value != null && !same(binding.observed_value, color)) continue;
        variants.push({ ...binding, observed_value: color, bbox_height: h, bbox_width: w, shape_digest: symbolicDigest(relative).slice(0, 16), entity_ref: String(sourceRef), exact_scene_box: [top, left, h, w] });
      }
    }
  }
  const found: Component[] = [];
  for (const binding of variants) {
    const h = Number(binding.bbox_height ?? 0), w = Number(binding.bbox_width ?? 0), color = binding.observed_value;
    if (!truth(binding.role_premise_claim_refs) || Math.min(h, w) < 3 || h * w > 256) continue;
    const [center, relative] = centerAndRelative(h, w);
    if (!binding.shape_digest || !symbolicDigest(relative).startsWith(String(binding.shape_digest))) continue;
    const candidates: Component[] = [];
    for (const raw of components) {
      if (raw.value !== color) continue; const b = raw.bbox;
      if (!(h - 1 <= b.height && b.height <= h && w - 1 <= b.width && b.width <= w)) continue;
      for (let top = b.bottom - h + 1; top <= b.top; top++) for (let left = b.right - w + 1; left <= b.left; left++) {
        if (truth(binding.exact_scene_box) && !same([top, left, h, w], binding.exact_scene_box)) continue;
        if (top < 0 || left < 0 || top + h > rows.length || left + w > rows[0]!.length) continue;
        const marks = new Set(center.map(([r, c]) => rows[top + r]![left + c]!));
        if (marks.size !== 1 || marks.has(color)) continue; const marker = [...marks][0]!;
        const missing = relative.filter(([r, c]) => rows[top + r]![left + c] !== color);
        if (!missing.length || missing.some(([r, c]) => rows[top + r]![left + c] !== marker)) continue;
        const sides = [missing.every(([r]) => r === 0), missing.every(([r]) => r === h - 1), missing.every(([, c]) => c === 0), missing.every(([, c]) => c === w - 1)]
          .map((holds, i) => holds ? i : -1).filter(i => i >= 0);
        if (sides.length !== 1) continue;
        const [dy, dx] = ([[-1, 0], [1, 0], [0, -1], [0, 1]] as Point[])[sides[0]!]!;
        if (!missing.some(([r, c]) => top + r + dy >= 0 && top + r + dy < rows.length && left + c + dx >= 0 && left + c + dx < rows[0]!.length && rows[top + r + dy]![left + c + dx] === color)) continue;
        const logical = relative.map(([r, c]) => [top + r, left + c] as Point), logicalSet = pixelSet(logical);
        if (!raw.pixels.every(p => logicalSet.has(key(p)))) continue;
        candidates.push({ ...raw, value: color, bbox: box(left, top, left + w - 1, top + h - 1), pixels: logical, relative_pixels: relative, area: relative.length, touches_frame_boundary: false,
          source_control_entity_ref: String(binding.entity_ref), overlay_pixels: missing.map(([r, c]) => [top + r, left + c]).sort(compare) } as Component);
      }
    }
    if (candidates.length === 1) found.push(candidates[0]!);
  }
  const result: Component[] = [];
  for (const c of found) if (!result.some(v => same([v.bbox, v.value, v.relative_pixels, (v as unknown as R).overlay_pixels], [c.bbox, c.value, c.relative_pixels, (c as unknown as R).overlay_pixels]))) result.push(c);
  return result;
}

function uniqueTranslationQuantum(fields: OutlineFields): number | null {
  const quanta = new Set<number>();
  for (const [, row, col] of fields.known_action_translation_deltas ?? []) if ((Number(row) === 0) !== (Number(col) === 0) && Math.abs(Number(row) || Number(col)) > 1) quanta.add(Math.abs(Number(row) || Number(col)));
  const retained = Number(fields.retained_action_quantized_grid_quantum || 0); if (retained > 1) quanta.add(retained);
  const observed = fields.observed_input_aligned_action_translation;
  if (observed != null) {
    const [, row, col] = observed, amount = Math.abs(Number(row) || Number(col));
    const retainedBoxes = boxes(fields.canonical_provisional_control_geometry_bboxes), aligned = retainedBoxes.length ? retainedBoxes : boxes(fields.input_aligned_entity_bboxes);
    if ((Number(row) === 0) !== (Number(col) === 0) && amount > 1 && (!aligned.length || aligned.length <= 4
      && Math.max(...aligned.map(b => b.bottom)) - Math.min(...aligned.map(b => b.top)) + 1 <= amount
      && Math.max(...aligned.map(b => b.right)) - Math.min(...aligned.map(b => b.left)) + 1 <= amount)) quanta.add(amount);
  }
  if (!quanta.size) return null; const primitive = Math.min(...quanta); return [...quanta].every(q => q % primitive === 0) ? primitive : null;
}

function bfsResidualPath(start: Point, deltas: R, maximumDepth: number, maximumStates: number, legal: (before: Point, after: Point) => boolean): string[] {
  if (same(start, [0, 0])) return [];
  const moves = Object.entries(deltas).sort(entryOrder).map(([ref, delta]) => [ref, 2 * delta[0], 2 * delta[1]] as const);
  const queue: [Point, number][] = [[start, 0]], parents = new Map<string, [Point, string] | null>([[key(start), null]]); let cursor = 0;
  while (cursor < queue.length) {
    const [position, depth] = queue[cursor++]!; if (depth >= maximumDepth) continue;
    for (const [action, dr, dc] of moves) {
      const state: Point = [position[0] - dr, position[1] - dc];
      if (parents.has(key(state)) || !legal(position, state)) continue;
      if (same(state, [0, 0])) {
        const suffix = [action]; let predecessor = parents.get(key(position))!;
        while (predecessor !== null) { suffix.push(predecessor[1]); predecessor = parents.get(key(predecessor[0]))!; }
        return suffix.reverse();
      }
      if (parents.size >= maximumStates) throw new RangeError('residual BFS state expansion bound exceeded');
      parents.set(key(state), [position, action]); queue.push([state, depth + 1]);
    }
  }
  return [];
}

function sweptRouteFacts(rows: NativeRows, fields: OutlineFields, policy: R, mover: Box, target: Component, bodies: readonly Box[], floor: Set<number>): R {
  const contract = policy.control_zone_cell_swept_route ?? {};
  if (contract.target_mask !== 'exact_assigned_enclosing_support_overlay' || contract.traversal_order !== 'candidate_ref_ascending') return {};
  const quantum = uniqueTranslationQuantum(fields); if (quantum === null) return {};
  const deltas: R = {};
  for (const [ref, row, col] of fields.interface_action_translation_deltas ?? []) if ((fields.available_action_refs ?? []).includes(ref) && Math.abs(Number(row)) + Math.abs(Number(col)) === 1) deltas[String(ref)] = [Number(row) * quantum, Number(col) * quantum];
  if (!Object.keys(deltas).length) return {};
  const frame = frameRows(fields.current_observed_frame, rows), destination: Point = [target.bbox.top + 1, target.bbox.left + 1], blocked = new Set<string>();
  for (let r = 0; r < frame.length; r++) for (let c = 0; c < frame[0]!.length; c++) if (!floor.has(frame[r]![c]!) && !contains(mover, r, c) && !contains(target.bbox, r, c)) blocked.add(key([r, c]));
  for (const body of [...bodies].sort((a, b) => compare(pose(a), pose(b)))) if (!same(body, mover)) for (let r = body.top; r <= body.bottom; r++) for (let c = body.left; c <= body.right; c++) blocked.add(key([r, c]));
  const clearance = new Map<string, boolean>();
  const clear = (position: Point): boolean => {
    const k = key(position); if (clearance.has(k)) return clearance.get(k)!;
    const [top, left] = position; let okay = top >= 0 && top <= frame.length - mover.height && left >= 0 && left <= frame[0]!.length - mover.width;
    for (let r = top; okay && r < top + mover.height; r++) for (let c = left; okay && c < left + mover.width; c++) if (blocked.has(key([r, c]))) okay = false;
    clearance.set(k, okay); return okay;
  };
  const legal = (before: Point, after: Point): boolean => {
    const source: Point = [destination[0] - Math.floor(before[0] / 2), destination[1] - Math.floor(before[1] / 2)];
    const target: Point = [destination[0] - Math.floor(after[0] / 2), destination[1] - Math.floor(after[1] / 2)];
    const dr = target[0] - source[0], dc = target[1] - source[1], distance = Math.abs(dr) + Math.abs(dc);
    if (!distance || dr !== 0 && dc !== 0) return false;
    for (let step = 1; step <= distance; step++) if (!clear([source[0] + step * Math.floor(dr / distance), source[1] + step * Math.floor(dc / distance)])) return false;
    return true;
  };
  let route: string[];
  try { route = bfsResidualPath([2 * (destination[0] - mover.top), 2 * (destination[1] - mover.left)], deltas, Number(contract.maximum_depth), Number(contract.maximum_states), legal); }
  catch (error) { if (error instanceof RangeError) return {}; throw error; }
  if (!route.length) return {};
  return { control_zone_cell_swept_route_length: route.length, control_zone_cell_swept_route_action_refs: route,
    control_zone_cell_swept_route_candidate_refs: route.map(ref => `probe:discrete:${ref}`), control_zone_cell_swept_route_action_payloads: route.map(() => ({})),
    control_zone_cell_swept_route_full_footprint_checked: true, control_zone_cell_swept_route_origin_bbox_tuples: [pose(mover)],
    control_zone_cell_swept_route_first_delta_row: deltas[route[0]!][0], control_zone_cell_swept_route_first_delta_col: deltas[route[0]!][1] };
}

export async function measureOutlineControlZoneRoutes(rows: NativeRows, fields: OutlineFields, routeConfig: R = fields.route_generation_policy ?? {}): Promise<[R, R]> {
  validateInteractionFields(fields);
  const components = (await detectV5Components(rows, 4)).components;
  const terms: R[] = fields.canonical_provisional_control_term_facts ?? [];
  const retained = boxes(fields.canonical_provisional_control_geometry_bboxes), aligned = boxes(fields.input_aligned_entity_bboxes);
  const translated = boxes(fields.translated_entity_bboxes), observed = boxes(fields.observed_translated_entity_bboxes);
  const loci: any[] = fields.known_effectful_point_loci ?? [], lastPoint = fields.last_point_position ?? null;
  let empty: R = {
    canonical_provisional_control_term_count: terms.length, ...outlineMemorialReferenceMeasurements(terms),
    current_input_aligned_control_candidate_count: aligned.length,
    current_action_conditioned_control_translation_count: Number(fields.observed_controlled_translation_count ?? 0),
    current_translated_control_candidate_count: translated.length,
    observed_distinct_translated_entity_count: fields.observed_distinct_translated_entity_count ?? 0,
    known_effectful_point_locus_count: loci.length,
    completed_standard_bfs_cell_zone_count: (fields.completed_standard_bfs_aligned_entry_region_bboxes ?? []).length,
    compatible_control_zone_cell_count: 0, retained_compatible_control_zone_cell_count: 0, compatible_control_zone_cell_memory_used: false,
    compatible_control_zone_cell_assignment_body_count: 0, compatible_control_zone_cell_perfect_matching_count: 0,
    compatible_control_zone_cell_assignment_uses_confirmed_floor_graph: false, compatible_control_zone_cell_open_assigned_body_bboxes: [],
    reachable_compatible_control_zone_cell_count: 0, current_body_exactly_occupies_compatible_control_zone_cell: false,
    confirmed_floor_graph_evidence_present: false, current_translated_transparent_control_underlay_present: false,
    compatible_control_zone_cell_reachable_on_confirmed_floor_graph: false, compatible_control_zone_cell_requires_relational_mechanism: false,
  };
  if (!terms.length) return [{}, empty];
  const currentFrame = frameRows(fields.current_observed_frame, rows);
  const contacts = routeConfig.measure_contact_overlay_from_current_canonical_box === true && retained.length === 1
    ? currentContactOverlaySupports(components, currentFrame, terms, [[retained[0]!.height, retained[0]!.width]], retained).filter(c => same(c.bbox, retained[0])) : [];
  empty = { ...empty, current_input_aligned_control_bbox_tuples: aligned.map(pose), last_point_position_tuple: lastPoint };
  const exact = aligned.filter(b => !retained.length || retained.length === 1 && b.height === retained[0]!.height && b.width === retained[0]!.width);
  const translatedExtent = translated.filter(b => retained.length === 1 && b.height === retained[0]!.height && b.width === retained[0]!.width);
  const visibleRetained = retained.filter(b => components.some(c => same(c.bbox, b) && samePixels(c.relative_pixels, perimeter(c.bbox.height, c.bbox.width))));
  const extents = unique(retained.map(b => [b.height, b.width]));
  let selectedVisual: Box[] = [];
  if (extents.length === 1 && fields.last_action_ref === 'ACTION6' && lastPoint !== null && loci.some(([, r, c]) => same([Number(r), Number(c)], lastPoint))) {
    const [h, w] = extents[0]! as [number, number], rim = perimeter(h, w);
    selectedVisual = components.filter(c => c.bbox.height === h && c.bbox.width === w && samePixels(c.relative_pixels, rim)
      && same(lastPoint, [Math.floor((c.bbox.top + c.bbox.bottom) / 2), Math.floor((c.bbox.left + c.bbox.right) / 2)])
      && components.some(marker => marker.area === 1 && marker.value !== c.value && same(marker.pixels[0], lastPoint))).map(c => c.bbox);
  }
  let centered: Box[] = [];
  if (extents.length === 1 && aligned.length === 1) {
    const [h, w] = extents[0]! as [number, number], overlay = aligned[0]!;
    if (overlay.height <= h && overlay.width <= w && !same([overlay.height, overlay.width], [h, w])) {
      centered = components.filter(c => c.bbox.height === h && c.bbox.width === w
        && contains(c.bbox, overlay.top, overlay.left) && contains(c.bbox, overlay.bottom, overlay.right)
        && c.bbox.top + c.bbox.bottom === overlay.top + overlay.bottom && c.bbox.left + c.bbox.right === overlay.left + overlay.right).map(c => c.bbox);
    }
  }
  if (aligned.length === 1) {
    const overlay = aligned[0]!;
    centered = unique([...centered, ...[...observed, ...translated].filter(b => b.height >= overlay.height && b.width >= overlay.width
      && !same([b.height, b.width], [overlay.height, overlay.width]) && contains(b, overlay.top, overlay.left) && contains(b, overlay.bottom, overlay.right)
      && b.top + b.bottom === overlay.top + overlay.bottom && b.left + b.right === overlay.left + overlay.right)]);
  }
  const selectedCentered = centered.length === 1 && fields.last_action_ref === 'ACTION6' && lastPoint !== null
    && same(lastPoint, [Math.floor((centered[0]!.top + centered[0]!.bottom) / 2), Math.floor((centered[0]!.left + centered[0]!.right) / 2)])
    && loci.some(([, r, c]) => same([Number(r), Number(c)], lastPoint));
  let mover: Box;
  if (contacts.length === 1) mover = contacts[0]!.bbox;
  else if (selectedVisual.length === 1) mover = selectedVisual[0]!;
  else if (exact.length === 1) mover = exact[0]!;
  else if (selectedCentered) mover = centered[0]!;
  else if (visibleRetained.length === 1) mover = visibleRetained[0]!;
  else if (translatedExtent.length === 1) mover = translatedExtent[0]!;
  else if (centered.length === 1) mover = centered[0]!;
  else if (retained.length === 1) mover = retained[0]!;
  else if (aligned.length === 1) mover = aligned[0]!;
  else return [{}, empty];
  const height = mover.height, width = mover.width;
  if (height <= 0 || width <= 0) return [{}, empty];
  const overlaps = components.filter(c => c.bbox.height === height && c.bbox.width === width).map(c => ({ bbox: c.bbox,
    overlap: Math.max(0, Math.min(mover.bottom, c.bbox.bottom) - Math.max(mover.top, c.bbox.top) + 1)
      * Math.max(0, Math.min(mover.right, c.bbox.right) - Math.max(mover.left, c.bbox.left) + 1) }));
  const greatest = Math.max(0, ...overlaps.map(v => v.overlap)), nearest = overlaps.filter(v => greatest > 0 && v.overlap === greatest);
  if (nearest.length === 1) mover = nearest[0]!.bbox;
  const declaredExtents = unique(terms.filter(f => Number(f.bbox_height || 0) > 0 && Number(f.bbox_width || 0) > 0).map(f => [Number(f.bbox_height || 0), Number(f.bbox_width || 0)]));
  if (declaredExtents.length && !declaredExtents.some(e => same(e, [height, width]))) return [{}, empty];
  let translatedControl = translated.filter(b => b.height === height && b.width === width);
  if (!translatedControl.length) translatedControl = translated;
  empty.current_translated_control_candidate_count = translatedControl.length;
  const exactPerimeter = (c: Component): boolean => {
    if (c.bbox.height !== height + 2 || c.bbox.width !== width + 2) return false;
    const expected = perimeter(c.bbox.height, c.bbox.width), seen = pixelSet(c.relative_pixels), wanted = pixelSet(expected);
    if (seen.size === wanted.size && [...seen].every(p => wanted.has(p))) return true;
    if (!seen.size || [...seen].some(p => !wanted.has(p))) return false;
    const missing = expected.filter(p => !seen.has(key(p)));
    return missing.length > 0 && missing.every(([r, col]) => contains(mover, c.bbox.top + r, c.bbox.left + col));
  };
  const currentCandidates = components.filter(c => !c.touches_frame_boundary && exactPerimeter(c) && !same(c.bbox, mover) && !translated.some(b => same(b, c.bbox)));
  const currentComponents = (await detectV5Components(currentFrame, 4)).components;
  const overlayMover = currentComponents.find(c => same(c.bbox, mover));
  const morphologyPeers = currentComponents.filter(c => overlayMover && !c.touches_frame_boundary && c.value === overlayMover.value
    && c.bbox.height === height && c.bbox.width === width && samePixels(c.relative_pixels, overlayMover.relative_pixels)).map(c => c.bbox);
  const overlays = unique([...aligned, ...observed, ...translated, ...retained, ...morphologyPeers].filter(b => b.height === height && b.width === width));
  const retainedNotContradicted = (c: Component): boolean => samePixels(c.relative_pixels, perimeter(c.bbox.height, c.bbox.width))
    && c.relative_pixels.every(([r, col]) => Number(currentFrame[c.bbox.top + r]![c.bbox.left + col]) === Number(c.value)
      || overlays.some(b => contains(b, c.bbox.top + r, c.bbox.left + col)));
  const retainedByGeometry = new Map<string, { order: any[]; component: Component }>();
  for (const c of [...(fields.prior_observed_exact_perimeter_components ?? []).map((v: R) => ({ ...v, bbox: asBox(v.bbox) })), ...components] as Component[]) {
    const order = [c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right, Number(c.value), c.relative_pixels];
    retainedByGeometry.set(JSON.stringify(order), { order, component: c });
  }
  const retainedCandidates = [...retainedByGeometry.values()].sort((a, b) => compare(a.order, b.order)).map(v => v.component)
    .filter(c => !c.touches_frame_boundary && c.bbox.height === height + 2 && c.bbox.width === width + 2 && !same(c.bbox, mover)
      && !currentCandidates.some(v => same(v.bbox, c.bbox)) && !translated.some(b => same(b, c.bbox)) && retainedNotContradicted(c));
  const candidates = [...currentCandidates, ...retainedCandidates];
  let summary: R = { ...empty, compatible_control_zone_cell_count: candidates.length, retained_compatible_control_zone_cell_count: retainedCandidates.length,
    compatible_control_zone_cell_memory_used: retainedCandidates.length > 0, compatible_control_zone_cell_mover_bbox_tuple: pose(mover),
    compatible_control_zone_cell_middle_positions: candidates.slice(0, 8).map(c => [c.bbox.top + 1, c.bbox.left + 1]),
    current_body_exactly_occupies_compatible_control_zone_cell: translatedControl.length <= 1 && candidates.some(c => mover.top === c.bbox.top + 1 && mover.left === c.bbox.left + 1 && mover.bottom === c.bbox.bottom - 1 && mover.right === c.bbox.right - 1) };
  if (!candidates.length || !translatedControl.length) return [{}, summary];
  const start: Point = [mover.top, mover.left];
  const underlay = components.filter(c => translatedControl.some(b => same(b, mover)) && same(c.bbox, mover)
    && samePixels(c.relative_pixels, perimeter(c.bbox.height, c.bbox.width))).slice(0, 1).map(() => Number(currentFrame[mover.top + Math.floor(height / 2)]![mover.left + Math.floor(width / 2)]));
  const floor = new Set<number>([...(fields.episode_input_aligned_underlay_values ?? []), ...(fields.current_input_aligned_underlay_values ?? []), ...underlay].map(Number));
  summary = { ...summary, confirmed_floor_graph_evidence_present: floor.size > 0, compatible_control_zone_cell_confirmed_floor_values: [...floor].sort((a, b) => a - b), current_translated_transparent_control_underlay_present: underlay.length > 0 };
  if (routeConfig.observed_control_underlay_recurrence_grounds_confirmed_floor_graph !== true || !floor.size) return [{}, { ...summary, compatible_control_zone_cell_requires_relational_mechanism: true }];
  const steps: R = {};
  for (const [action, dr, dc] of fields.interface_action_translation_deltas ?? []) if ((fields.available_action_refs ?? []).includes(action)) steps[String(action)] = [Math.sign(Number(dr)) * height, Math.sign(Number(dc)) * width];
  if (!Object.keys(steps).length) return [{}, summary];
  const orderedSteps = Object.entries(steps).sort(entryOrder);
  const shortestRoute = (source: Point, target: Point): string[] | null => {
    const frontier: [Point, string[]][] = [[source, []]], visited = new Set([key(source)]); let index = 0;
    while (index < frontier.length && visited.size <= 256) {
      const [position, prefix] = frontier[index++]!; if (same(position, target)) return prefix;
      for (const [action, [dr, dc]] of orderedSteps) {
        const successor: Point = [position[0] + dr, position[1] + dc]; if (visited.has(key(successor))) continue;
        const [top, left] = successor; if (top < 0 || left < 0 || top + height > rows.length || left + width > rows[0]!.length) continue;
        if (!same(successor, target) && !floor.has(Number(currentFrame[top + Math.floor(height / 2)]![left + Math.floor(width / 2)]))) continue;
        visited.add(key(successor)); frontier.push([successor, [...prefix, action]]);
      }
    }
    return null;
  };
  let bodies = unique([...observed, ...(fields.translated_entity_bboxes_from_prior_frame ? [] : translated), ...contacts.map(c => c.bbox)].filter(b => b.height === height && b.width === width));
  const moverComponent = currentComponents.find(c => same(c.bbox, mover));
  const moverPixels = pixelSet(moverComponent?.relative_pixels ?? []), center = key([Math.floor(height / 2), Math.floor(width / 2)]);
  const morphology = currentComponents.filter(c => {
    if (!moverComponent || c.touches_frame_boundary || c.value !== moverComponent.value || c.bbox.height !== height || c.bbox.width !== width) return false;
    const pixels = pixelSet(c.relative_pixels); return [...pixels].every(p => moverPixels.has(p) || p === center) && [...moverPixels].every(p => pixels.has(p) || p === center);
  }).map(c => c.bbox);
  const pointPositions = loci.map(([, r, c]) => [Number(r), Number(c)]);
  const linkedMorphology = morphology.filter(b => bodies.some(v => same(v, b)) || pointPositions.some(p => same(p, [Math.floor((b.top + b.bottom) / 2), Math.floor((b.left + b.right) / 2)])));
  if (fields.nonlocal_quantized_translation_observed && morphology.length > 1 && (linkedMorphology.length === morphology.length || morphology.length <= (fields.observed_distinct_translated_entity_count ?? 0)) && morphology.length === candidates.length) bodies = unique([...bodies, ...morphology]);
  summary = { ...summary, compatible_control_zone_cell_assignment_body_count: bodies.length,
    compatible_control_zone_cell_causally_linked_morphology_count: linkedMorphology.length, compatible_control_zone_cell_current_morphology_count: morphology.length };
  if (bodies.length > 1 || candidates.length > 1) summary.compatible_control_zone_cell_assignment_uses_confirmed_floor_graph = true;
  let reachableRoutes: [Component, string[]][];
  if (bodies.length > 1 && bodies.length === candidates.length && candidates.length <= 8) {
    const orderedBodies = [...bodies].sort((a, b) => compare(pose(a), pose(b))), orderedCandidates = [...candidates].sort((a, b) => compareUnicode(a.component_id, b.component_id));
    const columns = orderedBodies.map(b => orderedCandidates.map((c, i) => shortestRoute([b.top, b.left], [c.bbox.top + 1, c.bbox.left + 1]) !== null ? i : -1).filter(i => i >= 0));
    let matchingStates = new Map<number, [number[], number]>([[0, [[], 1]]]);
    for (const bodyColumns of columns) {
      const advanced = new Map<number, [number[], number]>();
      for (const [mask, [selected, witnessCount]] of [...matchingStates].sort(([a], [b]) => a - b)) for (const column of bodyColumns) {
        if (mask & (1 << column)) continue; const nextMask = mask | (1 << column), prior = advanced.get(nextMask);
        advanced.set(nextMask, prior ? [prior[0], Math.min(2, prior[1] + witnessCount)] : [[...selected, column], witnessCount]);
      }
      matchingStates = advanced;
    }
    const matching = matchingStates.get((1 << orderedCandidates.length) - 1), count = matching?.[1] ?? 0;
    summary = { ...summary, compatible_control_zone_cell_perfect_matching_count: count, compatible_control_zone_cell_reachable_columns_by_body: columns,
      compatible_control_zone_cell_assignment_body_bboxes: orderedBodies.map(pose), compatible_control_zone_cell_assignment_target_bboxes: orderedCandidates.map(c => pose(c.bbox)) };
    if (!matching || count !== 1) return [{}, { ...summary, compatible_control_zone_cell_requires_relational_mechanism: !matching }];
    const assignmentRoutes = orderedBodies.map((b, i) => { const c = orderedCandidates[matching[0][i]!]!; return shortestRoute([b.top, b.left], [c.bbox.top + 1, c.bbox.left + 1]); });
    summary.compatible_control_zone_cell_open_assigned_body_bboxes = orderedBodies.filter((_, i) => truth(assignmentRoutes[i])).map(pose);
    const index = orderedBodies.findIndex(b => same(b, mover)); if (index < 0) return [{}, summary];
    const route = assignmentRoutes[index]; if (!route?.length) return [{}, summary];
    reachableRoutes = [[orderedCandidates[matching[0][index]!]!, route]];
  } else if (bodies.length > 1) return [{}, { ...summary, compatible_control_zone_cell_requires_relational_mechanism: true }];
  else reachableRoutes = candidates.slice(0, 8).flatMap(c => { const route = shortestRoute(start, [c.bbox.top + 1, c.bbox.left + 1]); return route?.length ? [[c, route] as [Component, string[]]] : []; });
  if (!reachableRoutes.length) return [{}, { ...summary, reachable_compatible_control_zone_cell_count: 0, compatible_control_zone_cell_reachable_on_confirmed_floor_graph: false, compatible_control_zone_cell_requires_relational_mechanism: true }];
  if (reachableRoutes.length !== 1) return [{}, { ...summary, reachable_compatible_control_zone_cell_count: reachableRoutes.length, compatible_control_zone_cell_reachable_on_confirmed_floor_graph: true, compatible_control_zone_cell_requires_relational_mechanism: false }];
  const [target, route] = reachableRoutes[0]!, series = sweptRouteFacts(rows, fields, routeConfig, mover, target, bodies, floor), first = route[0]!;
  return [{ [first]: { action_ref: first, compatible_control_zone_cell_route_present: true, compatible_control_zone_cell_route_length: route.length,
    compatible_control_zone_cell_route_first_action: first, compatible_control_zone_cell_route_action_refs: route, compatible_control_zone_cell_component_ref: target.component_id,
    compatible_control_zone_cell_route_bound_reached: false, compatible_control_zone_cell_reachable_on_confirmed_floor_graph: true, ...series,
    candidate_starts_control_zone_cell_swept_route: Boolean(series.control_zone_cell_swept_route_action_refs?.length && series.control_zone_cell_swept_route_action_refs[0] === first) } },
  { ...summary, reachable_compatible_control_zone_cell_count: 1, compatible_control_zone_cell_reachable_on_confirmed_floor_graph: true }];
}

export async function measureOutlinePerimeterAccompaniment(rows: NativeRows, fields: OutlineFields): Promise<[R, R]> {
  validateInteractionFields(fields);
  const empty: R = { same_value_compact_body_hollow_perimeter_marker_triplet_count: 0,
    controlled_lead_bbox_matches_cardinal_marker_cell: false, controlled_lead_bbox_is_compatible_with_announced_motion: false,
    compact_body_hollow_perimeter_marker_route_bound_reached: false, other_compact_body_marker_immediate_contact_count: 0,
    controlled_lead_covers_other_inset_on_body_target_segment: false, controlled_lead_contains_announced_contact_site: false };
  const terms: R[] = fields.canonical_provisional_control_term_facts ?? [], retained = boxes(fields.canonical_provisional_control_geometry_bboxes);
  if (!terms.length || retained.length !== 1) return [{}, empty];
  let lead = retained[0]!; const quantumRow = lead.height, quantumCol = lead.width;
  if (quantumRow < 3 || quantumCol < 3) return [{}, empty];
  const rim = perimeter(quantumRow, quantumCol);
  const exactPerimeter = (c: Component): boolean => c.bbox.height === quantumRow && c.bbox.width === quantumCol && samePixels(c.relative_pixels, rim);
  const currentFrame = frameRows(fields.current_observed_frame, rows), components = (await detectV5Components(currentFrame, 4)).components.filter(c => !c.touches_frame_boundary);
  if (terms.length !== 1 && !outlineGeometryDescriptionsCompatible(terms)) {
    let currentOutlines = boxes(fields.current_action_conditioned_control_outline_bboxes);
    if (!currentOutlines.length) { const exact = components.filter(exactPerimeter).map(c => c.bbox); if (exact.length === 1) currentOutlines = exact; }
    if (currentOutlines.length !== 1) return [{}, empty]; const currentOutline = currentOutlines[0]!;
    if (currentOutline.height !== quantumRow || currentOutline.width !== quantumCol) return [{}, empty];
    if (components.filter(c => same(c.bbox, currentOutline) && exactPerimeter(c)).length !== 1) return [{}, empty];
    lead = currentOutline;
  }
  const bodies = components.filter(c => c.bbox.height === quantumRow - 1 && c.bbox.width === quantumCol - 1 && c.area === (quantumRow - 1) * (quantumCol - 1)).slice(0, 64);
  const perimeters = components.filter(exactPerimeter).slice(0, 64);
  const embedded = components.filter(c => c.bbox.height === quantumRow && c.bbox.width === quantumCol && samePixels(c.relative_pixels, [...rim, [1, 1]])).slice(0, 64);
  const markers = components.filter(c => c.area === 1).slice(0, 64), directions: R = {};
  for (const [action, dr, dc] of fields.interface_action_translation_deltas ?? []) if ((fields.available_action_refs ?? []).includes(action)) directions[String(action)] = [Math.sign(Number(dr)), Math.sign(Number(dc))];
  const orderedDirections = Object.entries(directions).sort(entryOrder);
  let previousComponents: readonly Component[] | null = null;
  const previous = async (): Promise<readonly Component[]> => {
    if (fields.previous_action_observed_frame == null) return [];
    previousComponents ??= (await detectV5Components(frameRows(fields.previous_action_observed_frame, rows), 4)).components;
    return previousComponents;
  };
  const observedAnnouncement = async (body: Component): Promise<boolean> => {
    if (fields.previous_action_observed_frame == null) return false;
    const before = await previous();
    const oldMarkers = before.filter(c => c.value === body.value && c.area === 1 && same(c.pixels[0], [body.bbox.top, body.bbox.left]));
    const oldBodies = before.filter(c => c.value === body.value && c.bbox.height === quantumRow - 1 && c.bbox.width === quantumCol - 1
      && c.area === (quantumRow - 1) * (quantumCol - 1) && (body.bbox.top - c.bbox.top) % quantumRow === 0 && (body.bbox.left - c.bbox.left) % quantumCol === 0
      && Math.floor(Math.abs(body.bbox.top - c.bbox.top) / quantumRow) + Math.floor(Math.abs(body.bbox.left - c.bbox.left) / quantumCol) === 1);
    return oldMarkers.length === 1 && oldBodies.length === 1;
  };
  const witnesses: R[] = [];
  const exceeded = (): [R, R] => [{}, { ...empty, same_value_compact_body_hollow_perimeter_marker_triplet_count: witnesses.length, compact_body_hollow_perimeter_marker_route_bound_reached: true }];
  for (const body of bodies) {
    const origin: Point = [body.bbox.top - 1, body.bbox.left - 1];
    for (const marker of markers) {
      if (marker.value !== body.value) continue; const point = marker.pixels[0]!;
      for (const [action, [dr, dc]] of orderedDirections) {
        if ((dr === 0) === (dc === 0) || !same(point, [body.bbox.top + dr * quantumRow, body.bbox.left + dc * quantumCol])) continue;
        const cell = box(point[1] - 1, point[0] - 1, point[1] + quantumCol - 2, point[0] + quantumRow - 2);
        let relation = 'cardinal_marker_cell';
        if (!same(cell, lead)) {
          const offset: Point = [lead.top - origin[0], lead.left - origin[1]];
          if (offset[0] % quantumRow || offset[1] % quantumCol || Math.floor(Math.abs(offset[0]) / quantumRow) + Math.floor(Math.abs(offset[1]) / quantumCol) !== 1 || !await observedAnnouncement(body)) continue;
          relation = 'cardinal_offset_after_observed_announced_step';
        }
        for (const target of perimeters) {
          if (target.value !== body.value) continue;
          const position: Point = [target.bbox.top, target.bbox.left], rowGap = position[0] - origin[0], colGap = position[1] - origin[1];
          if (rowGap % quantumRow || colGap % quantumCol) continue;
          const distance = Math.floor(Math.abs(rowGap) / quantumRow) + Math.floor(Math.abs(colGap) / quantumCol);
          const nextOrigin: Point = [origin[0] + dr * quantumRow, origin[1] + dc * quantumCol];
          const nextDistance = Math.floor(Math.abs(position[0] - nextOrigin[0]) / quantumRow) + Math.floor(Math.abs(position[1] - nextOrigin[1]) / quantumCol);
          const nextLead: Point = [lead.top + dr * quantumRow, lead.left + dc * quantumCol];
          if (!(nextLead[0] >= 0 && nextLead[0] <= currentFrame.length - quantumRow && nextLead[1] >= 0 && nextLead[1] <= currentFrame[0]!.length - quantumCol)) continue;
          const leadDistance = Math.floor(Math.abs(position[0] - lead.top) / quantumRow) + Math.floor(Math.abs(position[1] - lead.left) / quantumCol);
          const nextLeadDistance = Math.floor(Math.abs(position[0] - nextLead[0]) / quantumRow) + Math.floor(Math.abs(position[1] - nextLead[1]) / quantumCol);
          if (relation === 'cardinal_marker_cell' && (nextDistance >= distance || nextLeadDistance >= leadDistance) && !await observedAnnouncement(body)) continue;
          witnesses.push({ action_ref: action, compact_body_component_ref: body.component_id, compact_body_origin: origin,
            hollow_perimeter_component_ref: target.component_id, cardinal_marker_component_ref: marker.component_id, controlled_lead_relation: relation,
            compact_body_to_hollow_perimeter_cell_distance: distance, compact_body_to_hollow_perimeter_next_cell_distance: nextDistance,
            controlled_lead_to_hollow_perimeter_cell_distance: leadDistance, controlled_lead_to_hollow_perimeter_next_cell_distance: nextLeadDistance });
          if (witnesses.length > 3) return exceeded();
        }
      }
    }
  }
  const inset = box(lead.left + 1, lead.top + 1, lead.right - 1, lead.bottom - 1);
  const overlaid = components.filter(c => same(c.bbox, inset) && c.area === Math.max(0, (quantumRow - 2) * (quantumCol - 2)));
  if (overlaid.length === 1) {
    const interior = overlaid[0]!, origin: Point = [lead.top, lead.left];
    const append = (action: string, target: Component, markerRef: string, distance: number, nextDistance: number): void => {
      witnesses.push({ action_ref: action, compact_body_component_ref: `overlaid_inset:${interior.component_id}`, compact_body_origin: origin,
        hollow_perimeter_component_ref: target.component_id, cardinal_marker_component_ref: markerRef, controlled_lead_relation: 'overlaid_compact_body_cell',
        compact_body_to_hollow_perimeter_cell_distance: distance, compact_body_to_hollow_perimeter_next_cell_distance: nextDistance,
        controlled_lead_to_hollow_perimeter_cell_distance: distance, controlled_lead_to_hollow_perimeter_next_cell_distance: nextDistance });
    };
    for (const marker of markers) {
      if (marker.value !== interior.value) continue; const point = marker.pixels[0]!;
      for (const [action, [dr, dc]] of orderedDirections) {
        if ((dr === 0) === (dc === 0) || !same(point, [lead.top + 1 + dr * quantumRow, lead.left + 1 + dc * quantumCol])) continue;
        for (const target of perimeters) {
          if (target.value !== interior.value) continue; const rowGap = target.bbox.top - origin[0], colGap = target.bbox.left - origin[1];
          if (rowGap % quantumRow || colGap % quantumCol) continue;
          const distance = Math.floor(Math.abs(rowGap) / quantumRow) + Math.floor(Math.abs(colGap) / quantumCol);
          const nextDistance = Math.floor(Math.abs(target.bbox.top - origin[0] - dr * quantumRow) / quantumRow) + Math.floor(Math.abs(target.bbox.left - origin[1] - dc * quantumCol) / quantumCol);
          if (nextDistance >= distance) continue; append(action, target, marker.component_id, distance, nextDistance);
          if (witnesses.length > 3) return exceeded();
        }
      }
    }
    for (const target of embedded) {
      if (target.value !== interior.value) continue; const rowGap = target.bbox.top - origin[0], colGap = target.bbox.left - origin[1];
      if (rowGap % quantumRow || colGap % quantumCol) continue;
      const distance = Math.floor(Math.abs(rowGap) / quantumRow) + Math.floor(Math.abs(colGap) / quantumCol);
      for (const [action, [dr, dc]] of orderedDirections) {
        if ((dr === 0) === (dc === 0) || !same([target.bbox.top + 1, target.bbox.left + 1], [lead.top + 1 + dr * quantumRow, lead.left + 1 + dc * quantumCol])) continue;
        const nextDistance = Math.floor(Math.abs(target.bbox.top - origin[0] - dr * quantumRow) / quantumRow) + Math.floor(Math.abs(target.bbox.left - origin[1] - dc * quantumCol) / quantumCol);
        if (nextDistance >= distance) continue; append(action, target, `embedded_inset:${target.component_id}`, distance, nextDistance);
        if (witnesses.length > 3) return exceeded();
      }
    }
  }
  const uniqueWitnesses = new Map<string, R>();
  for (const witness of witnesses) uniqueWitnesses.set(JSON.stringify(['action_ref', 'compact_body_component_ref', 'hollow_perimeter_component_ref', 'cardinal_marker_component_ref'].map(k => String(witness[k]))), witness);
  const one = uniqueWitnesses.size === 1, witness = [...uniqueWitnesses.values()][0];
  const summary: R = { ...empty, same_value_compact_body_hollow_perimeter_marker_triplet_count: uniqueWitnesses.size,
    controlled_lead_bbox_matches_cardinal_marker_cell: one && witness!.controlled_lead_relation === 'cardinal_marker_cell', controlled_lead_bbox_is_compatible_with_announced_motion: one };
  if (!one) return [{}, summary];
  const protectedRef = String(witness!.compact_body_component_ref), origin = witness!.compact_body_origin as Point,
    action = String(witness!.action_ref), direction = directions[action], destination: Point = [origin[0] + direction[0] * quantumRow, origin[1] + direction[1] * quantumCol];
  const accepted = new Set([...perimeters, ...embedded].map(c => c.component_id));
  const targets = components.filter(c => accepted.has(c.component_id) && c.component_id === witness!.hollow_perimeter_component_ref), target = targets.length === 1 ? targets[0]! : null;
  const direct = target !== null && (origin[0] === lead.top && lead.top === target.bbox.top && Math.min(origin[1], target.bbox.left) < lead.left && lead.left < Math.max(origin[1], target.bbox.left)
    || origin[1] === lead.left && lead.left === target.bbox.left && Math.min(origin[0], target.bbox.top) < lead.top && lead.top < Math.max(origin[0], target.bbox.top));
  if (target && direct && !same(destination, [lead.top, lead.left])) {
    const values = new Set<number>(); for (let r = lead.top + 1; r < lead.bottom; r++) for (let c = lead.left + 1; c < lead.right; c++) values.add(currentFrame[r]![c]!);
    if (values.size === 1 && !values.has(target.value)) {
      const covered = (await previous()).filter(c => values.has(c.value) && c.bbox.top === lead.top + 1 && c.bbox.left === lead.left + 1 && c.bbox.bottom === lead.bottom && c.bbox.right === lead.right && c.area === (quantumRow - 1) * (quantumCol - 1));
      summary.controlled_lead_covers_other_inset_on_body_target_segment = covered.length === 1;
    }
  }
  const otherRelations = new Map<string, [string, Point, Point]>(), allDirections = unique(Object.values(directions) as Point[]).sort(compare);
  for (const body of bodies) {
    if (body.component_id === protectedRef) continue; const bodyOrigin: Point = [body.bbox.top - 1, body.bbox.left - 1];
    for (const marker of markers) {
      if (marker.value !== body.value) continue; const [r, c] = marker.pixels[0]!;
      for (const [dr, dc] of allDirections) {
        const target: Point = [bodyOrigin[0] + dr * quantumRow, bodyOrigin[1] + dc * quantumCol];
        if (target[0] + 1 <= r && r <= target[0] + quantumRow - 2 && target[1] + 1 <= c && c <= target[1] + quantumCol - 2) {
          const relation: [string, Point, Point] = [body.component_id, bodyOrigin, target]; otherRelations.set(JSON.stringify(relation), relation);
        }
      }
    }
  }
  const contacts = [...otherRelations.values()].sort(compare).filter(relation => same(relation[2], origin) || same(relation[2], destination) || same(relation[1], destination));
  summary.other_compact_body_marker_immediate_contact_count = contacts.length;
  const sites = contacts.filter(relation => same(relation[2], origin) || same(relation[2], destination)).map(relation => relation[2]);
  if (contacts.some(relation => same(relation[1], destination))) sites.push(destination);
  summary.controlled_lead_contains_announced_contact_site = sites.some(site => same(site, [lead.top, lead.left]));
  return [{ [action]: witness! }, summary];
}
