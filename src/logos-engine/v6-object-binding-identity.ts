/** Exact visible-shape alternatives from guarded_binding/identity.py. */
import { enclosing_contours } from './v6-object-binding-geometry.ts';
import { bindingCompare as compare, bindingEqual as same, bindingKey as key,
  type BindingRecord as R, type BindingWork } from './v6-object-binding-common.ts';
import type { NativeRows } from './v6-native-types.ts';

export function unchanged(entity: R, observation: R, work?: BindingWork): boolean {
  return observation.entities.some((item: R) => { work?.tick(); return item.signature === entity.signature && same(item.bbox, entity.bbox); });
}
export function compatible(source: R, candidate: R, first: NativeRows, second: NativeRows, before: R, after: R,
  body_before: R, body_after: R, work?: BindingWork): R | null {
  const value = source.palette_value, old = source.bbox, next = candidate.bbox, occlusions = [body_before.bbox, body_after.bbox],
    contours = [enclosing_contours(before, body_before, work), enclosing_contours(after, body_after, work)];
  const shifts = [...new Set([[next[0] - old[0], next[1] - old[1]], [next[2] - old[2], next[1] - old[1]],
    [next[0] - old[0], next[3] - old[3]], [next[2] - old[2], next[3] - old[3]]].map(key))]
    .map(item => JSON.parse(item) as number[]).sort(compare), accepted: R[] = [];
  const visible = (rows: NativeRows, x: number, y: number, box: number[], values: number[]): boolean =>
    x >= 0 && x < rows[0]!.length && y >= 0 && y < rows.length
      && !(box[0]! <= x && x <= box[2]! && box[1]! <= y && y <= box[3]!) && !values.includes(rows[y]![x]!);
  for (const [dx, dy] of shifts) {
    work?.node(); const l = Math.min(old[0], next[0] - dx!), t = Math.min(old[1], next[1] - dy!),
      r = Math.max(old[2], next[2] - dx!), b = Math.max(old[3], next[3] - dy!), matching: number[][] = [];
    let background = 0, hidden = 0, contradicted = false;
    for (let y = t; y <= b; y++) {
      for (let x = l; x <= r; x++) {
        work?.tick(); const xx = x + dx!, yy = y + dy!;
        if (!visible(first, x, y, occlusions[0], contours[0]!) || !visible(second, xx, yy, occlusions[1], contours[1]!)) { hidden++; continue; }
        const a = first[y]![x] === value, c = second[yy]![xx] === value;
        if (a !== c) { contradicted = true; break; }
        if (a) matching.push([x, y]); else background++;
      }
      if (contradicted) break;
    }
    if (!contradicted && new Set(matching.map(p => p[0])).size > 1 && new Set(matching.map(p => p[1])).size > 1)
      accepted.push({ translation: [dx, dy], matching_visible_foreground: matching,
        matching_visible_background_count: background, unobservable_points: hidden });
  }
  return accepted.length ? { status: 'visible_shape_compatible_under_bounded_translation', alternatives: accepted,
    scope: 'visible_part_only_occluded_part_unknown' } : null;
}
