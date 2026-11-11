/** Pixel contrasts from guarded_binding/reception.py. These results are
 * selected-site observations, never a universal completion law. */
import { digest, enclosing_contours } from './v6-object-binding-geometry.ts';
import { bindingCompare as compare, bindingEqual as same, bindingKey as key, bindingUnique as unique,
  type BindingRecord as R, type BindingWork } from './v6-object-binding-common.ts';
import type { NativeRows } from './v6-native-types.ts';

export function in_box(point: readonly number[], box: readonly number[]): boolean {
  return box[0]! <= point[0]! && point[0]! <= box[2]! && box[1]! <= point[1]! && point[1]! <= box[3]!;
}
export function coloured(rows: NativeRows, box: readonly number[], value: number, work?: BindingWork): Set<string> {
  const result = new Set<string>(), [l, t, r, b] = box;
  for (let y = Math.max(0, t!); y < Math.min(rows.length, b! + 1); y++)
    for (let x = Math.max(0, l!); x < Math.min(rows[0]!.length, r! + 1); x++) {
      work?.tick(); if (rows[y]![x] === value) result.add(key([x, y]));
    }
  return result;
}
const points = (values: Iterable<string>): number[][] => [...values].map(value => JSON.parse(value) as number[]).sort(compare);
export function arrival(held: R, first: NativeRows, second: NativeRows, body_before: R, body_after: R,
  regions: readonly number[][], evidence: readonly string[], work?: BindingWork): R | null {
  work?.node(); if (held.status !== 'joint_transport_observed' || !same(body_before.bbox, body_after.bbox)) return null;
  const frame = held.frame, value = held.palette_value, inside = frame.interior_bbox, outer = frame.bbox,
    oldSite = coloured(first, inside, value, work), newSite = coloured(second, inside, value, work),
    gained = new Set([...newSite].filter(point => !oldSite.has(point))),
    outside = new Set([...coloured(first, held.bbox, value, work)].filter(point => !in_box(JSON.parse(point), outer)));
  if (!gained.size || !outside.size || points(outside).some(([x, y]) => second[y!]![x!] === value)) return null;
  for (const [l, t, r, b] of regions) for (let y = t!; y <= b!; y++) for (let x = l!; x <= r!; x++) {
    work?.tick(); if (first[y]![x] !== second[y]![x]) return null;
  }
  return { ref: 'reception_transition:' + digest(evidence), frame, palette_value: value,
    site_pixels: points(newSite), gained_pixels: points(gained), vacated_carried_pixels: points(outside),
    object_ref: held.ref, evidence: [...evidence], status: 'arrival_at_selected_site_requires_separation',
    alternatives: ['object_detached_at_selected_reception_site', 'object_still_bound_with_changed_relative_pose'],
    preservation_regions: regions };
}
export function separation(pending: R, rows: NativeRows, observation: R, body: R, delta: readonly number[],
  local_delta: readonly number[] | null | undefined, evidence: readonly string[], work?: BindingWork): R {
  work?.node();
  if (!delta.some(Boolean) || !same(delta, local_delta)) return { status: 'separation_unresolved',
    reason: 'current_motion_not_local_revalidated', evidence: [...evidence] };
  const values = enclosing_contours(observation, body, work), value = pending.palette_value,
    site = new Set<string>(pending.site_pixels.map(key)), shifted = new Set(points(site).map(([x, y]) => key([x! + delta[0]!, y! + delta[1]!])));
  const visible = (entry: string): boolean => {
    work?.tick(); const point = JSON.parse(entry) as number[], [x, y] = point;
    return !in_box(point, body.bbox) && x! >= 0 && x! < rows[0]!.length && y! >= 0 && y! < rows.length
      && !values.includes(rows[Math.trunc(y!)]![Math.trunc(x!)]!);
  };
  const fixed = new Set([...site].filter(visible)), moved = new Set([...shifted].filter(visible));
  const hasValue = (entry: string): boolean => { const [x, y] = JSON.parse(entry); return rows[Math.trunc(y)]![Math.trunc(x)] === value; };
  const fixedYes = new Set([...fixed].filter(hasValue)), fixedNo = new Set([...fixed].filter(point => !fixedYes.has(point))),
    movedNo = new Set([...moved].filter(point => !hasValue(point)));
  if (fixedYes.size && !fixedNo.size && movedNo.size) return { status: 'reception_confirmed_by_separation',
    frame_ref: pending.frame.ref, object_ref: pending.object_ref, site_pixels_retained: points(fixedYes),
    bound_translation_counterexamples: points(movedNo), evidence: unique([...pending.evidence, ...evidence]),
    scope: 'selected_object_and_site_only_not_universal_terminal_rule' };
  if (fixedNo.size && moved.size && !movedNo.size) return { status: 'reception_refuted_object_moves_with_body',
    evidence: unique([...pending.evidence, ...evidence]) };
  return { status: 'separation_unresolved', reason: 'stationary_and_bound_explanations_not_distinguished', evidence: [...evidence] };
}
