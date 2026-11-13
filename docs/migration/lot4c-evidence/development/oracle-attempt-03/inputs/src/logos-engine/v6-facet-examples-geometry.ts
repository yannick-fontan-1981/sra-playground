/** Visible face correspondences from pinned V6 facet_examples/geometry.py.
 * Measurements describe colored contributions, never hidden solid occupancy. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeBox, NativeEntity, NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';
import type { FacetCompoundProjection } from './v6-facet-examples-compound.ts';

export type FacetPoint = [number, number];
export type FacetTriple = [number, number, number];
export interface FacetOffer extends NativeRecord {
  kind: string; support: NativeEntity; point: FacetPoint; assumptions: string[]; risks: string[];
}
export interface FacetProjection {
  world: NativeBox; example_box: NativeBox; example_parts: readonly NativeEntity[];
  reference_parts: readonly NativeEntity[]; scale_hypothesis: number | null;
  reference_role?: string; offer: FacetOffer; observation_ref: string; level_epoch: number; scope_ref: string;
  compound?: FacetCompoundProjection;
}
export const facetPointKey = (x: number, y: number): string => `${x},${y}`;
export const facetLexicographic = (a: readonly number[], b: readonly number[]): number => {
  for (let index = 0; index < Math.min(a.length, b.length); index++) if (a[index] !== b[index]) return a[index]! - b[index]!;
  return a.length - b.length;
};
export function facetCounts(values: Iterable<number>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
export function facetBackground(rows: NativeRows): number {
  const counts = facetCounts(rows.flat()); let selected: number | undefined, maximum = -1;
  // Counter.most_common preserves the first observed value when frequencies tie.
  for (const [value, count] of counts) if (count > maximum) { selected = value; maximum = count; }
  if (selected === undefined) throw new RangeError('A face observation requires a nonempty raster');
  return selected;
}
/** Python 3.12's compensated sum on the finite positive width ratios measured
 * here. Sequential JS addition can change the observable scale by one ulp. */
export function facetScaleMean(scales: readonly number[]): number {
  let total = 0, correction = 0;
  for (const value of scales) {
    const next = total + value;
    correction += Math.abs(total) >= Math.abs(value) ? (total - next) + value : (value - next) + total;
    total = next;
  }
  return (total + correction) / scales.length;
}
export function facetInside(a: NativeBox, b: NativeBox): boolean {
  return b[0] < a[0] && b[1] < a[1] && a[2] < b[2] && a[3] < b[3];
}
export function facetBox(parts: readonly NativeEntity[]): [number, number, number, number] {
  if (!parts.length) throw new RangeError('A visible face bound requires measured parts');
  return [Math.min(...parts.map(e => e.bbox[0])), Math.min(...parts.map(e => e.bbox[1])),
    Math.max(...parts.map(e => e.bbox[2])), Math.max(...parts.map(e => e.bbox[3]))];
}
export function facetShape(entity: NativeEntity): FacetPoint[] {
  return entity.mask.map(([x, y]): FacetPoint => [x, y]).sort(facetLexicographic);
}
export function facetCenter(entity: NativeEntity): FacetPoint {
  const points = facetShape(entity), n = points.length;
  if (!n) throw new RangeError('An empty mask has no measured face center');
  const sx = points.reduce((sum, p) => sum + p[0], 0), sy = points.reduce((sum, p) => sum + p[1], 0);
  const rank = ([x, y]: FacetPoint): number[] => [(n * x - sx) ** 2 + (n * y - sy) ** 2, y, x];
  let selected = points[0]!;
  for (const point of points.slice(1)) if (facetLexicographic(rank(point), rank(selected)) < 0) selected = point;
  return [entity.bbox[0] + selected[0], entity.bbox[1] + selected[1]];
}
export function facetRectangles(obs: NativeObservation): NativeEntity[] {
  const result: NativeEntity[] = [];
  for (const entity of obs.entities) {
    const [l, t, r, b] = entity.bbox, width = r - l + 1, height = b - t + 1;
    if (Math.min(width, height) < 3 || entity.area !== 2 * width + 2 * height - 4) continue;
    const edges = new Set<string>();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) edges.add(facetPointKey(x, y));
    }
    const mask = new Set(entity.mask.map(([x, y]) => facetPointKey(x, y)));
    if (mask.size === edges.size && [...mask].every(point => edges.has(point))) result.push(entity);
  }
  return result;
}

export function facetProject(obs: NativeObservation, rows: NativeRows): FacetProjection | null {
  const frames = facetRectangles(obs);
  if (frames.length < 2) return null;
  const ordered = [...frames].sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])
    - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));
  const world = ordered[0]!.bbox, background = facetBackground(rows), candidates: FacetProjection[] = [];
  for (const frame of ordered.slice(1)) {
    if (facetInside(frame.bbox, world)) continue;
    const parts = obs.entities.filter(e => facetInside(e.bbox, frame.bbox)
      && ![background, frame.palette_value, ordered[0]!.palette_value].includes(e.palette_value) && e.area >= 3);
    const palette = new Set(parts.map(e => e.palette_value));
    if (parts.length < 3 || palette.size !== parts.length) continue;
    const reference = obs.entities.filter(e => palette.has(e.palette_value) && !facetInside(e.bbox, world) && !facetInside(e.bbox, frame.bbox));
    const counts = facetCounts(reference.map(e => e.palette_value));
    if (counts.size !== palette.size || [...palette].some(value => counts.get(value) !== 1)) continue;
    if (reference.some(e => frames.some(f => facetInside(e.bbox, f.bbox)))) continue;
    const paired = parts.map(p => [p, reference.find(e => e.palette_value === p.palette_value)!] as const);
    const scales = paired.map(([a, b]) => (b.bbox[2] - b.bbox[0] + 1) / (a.bbox[2] - a.bbox[0] + 1));
    const scale = facetScaleMean(scales);
    if (Math.max(...scales) - Math.min(...scales) > 0.15 || !(0 < scale && scale < 1)) continue;
    const extension: [NativeEntity, NativeEntity, number][] = [], constant: [NativeEntity, NativeEntity, number][] = [];
    for (const [source, target] of paired) {
      const sy = source.bbox[3] - source.bbox[1] + 1, ty = target.bbox[3] - target.bbox[1] + 1, residual = ty / scale - sy;
      (residual > 2 / scale ? extension : constant).push([source, target, residual]);
    }
    if (constant.length !== 1 || extension.length < 2) continue;
    const [cap, referenceCap] = constant[0]!;
    if (extension.some(([p, q]) => facetCenter(cap)[1] >= facetCenter(p)[1] || facetCenter(referenceCap)[1] >= facetCenter(q)[1])) continue;
    const unit = facetBox(parts), heightExtra = Math.max(...extension.map(([, , value]) => value));
    const worldParts = obs.entities.filter(e => facetInside(e.bbox, world) && palette.has(e.palette_value));
    let offer: FacetOffer;
    if (worldParts.length) {
      const by = facetCounts(worldParts.map(e => e.palette_value));
      if (by.size !== palette.size || [...palette].some(value => !by.has(value)) || by.get(cap.palette_value) !== 1) continue;
      const currentCap = worldParts.find(e => e.palette_value === cap.palette_value)!;
      if (!equal(facetShape(currentCap), facetShape(cap))) continue;
      // Connected side contributions are not converted into an inferred cube count.
      const stillMissing: number[] = []; let sideValid = true;
      for (const [source, target] of extension) {
        const contributions = worldParts.filter(e => e.palette_value === source.palette_value).sort((a, b) => a.bbox[1] - b.bbox[1]);
        const bounds = facetBox(contributions);
        if (new Set(contributions.map(e => facetPointKey(e.bbox[0], e.bbox[2]))).size !== 1
          || contributions.slice(1).some((b, index) => b.bbox[1] > contributions[index]!.bbox[3] + 1)) { sideValid = false; break; }
        if (!(currentCap.bbox[1] < bounds[1] && bounds[1] <= currentCap.bbox[3] + 1)) { sideValid = false; break; }
        stillMissing.push((target.bbox[3] - target.bbox[1] + 1) / scale - (bounds[3] - bounds[1] + 1));
      }
      if (!sideValid || Math.min(...stillMissing) <= 1 / scale) continue;
      if (currentCap.bbox[1] - world[1] < Math.ceil(Math.min(...stillMissing))) continue;
      offer = { kind: 'probe_visible_cap', support: currentCap, point: facetCenter(currentCap), unresolved_visible_height: stillMissing,
        assumptions: ['clicking_current_cap_may_extend_corresponding_sides'],
        risks: ['may_replace_or_delete_instead_of_extend', 'sampling_and_outline_differences', 'hidden_owner_unknown'] };
    } else {
      const seeds: { margin: number; entity: NativeEntity; estimate: number[] }[] = [];
      for (const entity of obs.entities) {
        if (entity.palette_value !== background || !facetInside(entity.bbox, world) || !equal(facetShape(entity), facetShape(cap))) continue;
        const dx = entity.bbox[0] - cap.bbox[0], dy = entity.bbox[1] - cap.bbox[1];
        const estimate = [unit[0] + dx, unit[1] + dy - Math.ceil(heightExtra), unit[2] + dx, unit[3] + dy];
        const margin = Math.min(estimate[0]! - world[0] - 1, estimate[1]! - world[1] - 1, world[2] - estimate[2]! - 1, world[3] - estimate[3]! - 1);
        if (margin < 1) continue;
        seeds.push({ margin, entity, estimate });
      }
      if (!seeds.length) continue;
      const rank = (seed: typeof seeds[number]): number[] => [seed.margin,
        -Math.abs(seed.entity.bbox[0] + seed.entity.bbox[2] - world[0] - world[2]), -seed.entity.bbox[0]];
      let best = seeds[0]!;
      for (const seed of seeds.slice(1)) if (facetLexicographic(rank(seed), rank(best)) > 0) best = seed;
      offer = { kind: 'probe_congruent_empty_face', support: best.entity, point: facetCenter(best.entity),
        estimated_reference_envelope: best.estimate, margin: best.margin,
        assumptions: ['bounded_empty_face_is_editable', 'filled_example_describes_local_construction'],
        risks: ['face_may_not_accept_click', 'scale_is_correspondence_not_exact_bitmap', 'growth_direction_unconfirmed'] };
    }
    candidates.push({ world, example_box: frame.bbox, example_parts: parts, reference_parts: reference, scale_hypothesis: scale,
      reference_role: 'hypothesis_from_shared_parts_and_relative_proportions', offer, observation_ref: obs.observation_ref,
      level_epoch: obs.level_epoch, scope_ref: identity([obs.level_epoch, world, frame.bbox, reference.map(e => [e.bbox, e.palette_value, e.mask])]) });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
