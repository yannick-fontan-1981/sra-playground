/**
 * Own public measurements from envelope_fill_observation, field_service_access
 * and service_transfer_access at pinned V6 786dcf51. Palette values are measured
 * locally; the observations assign no physical quantity, capacity or flow law.
 */
import { geometricComponents, projection, validateRows } from './v6-native-observer.ts';
import { bandQuantities } from './v6-band-transfer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;

/**
 * Source identity on the own safe-integer JSON recipes. Public raster support is
 * the observer's rectangular uint8 domain of at most 65,536 pixels. This is not
 * a claim about arbitrary Python float spelling, huge integers or ancestor IDs.
 */
export const fieldServiceDigest = identity;

export function fieldCrop(rows: NativeRows, box: readonly number[]): number[][] {
  return projection(rows, box);
}

/** Source min((x,y)) order, including equal-palette-change connected regions. */
export function fieldChangeGroups(before: NativeRows, after: NativeRows): R[] {
  validateRows(before); validateRows(after);
  const height = before.length, width = before[0]!.length, pending = new Set<number>(), found: R[] = [];
  // Insertion order is lexicographic (x,y); removing neighbours preserves it.
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    if (before[y]![x] !== after[y]![x]) pending.add(x * height + y);
  }
  while (pending.size) {
    const seed = pending.values().next().value!; pending.delete(seed);
    const sx = Math.floor(seed / height), sy = seed % height;
    const pair = [before[sy]![sx]!, after[sy]![sx]!], stack = [seed];
    let area = 0, left = sx, top = sy, right = sx, bottom = sy;
    while (stack.length) {
      const point = stack.pop()!, x = Math.floor(point / height), y = point % height;
      area++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      for (const [u, v] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as [number, number][]) {
        if (u < 0 || v < 0 || u >= width || v >= height) continue;
        const key = u * height + v;
        if (pending.has(key) && before[v]![u] === pair[0] && after[v]![u] === pair[1]) {
          pending.delete(key); stack.push(key);
        }
      }
    }
    if (area === (right - left + 1) * (bottom - top + 1) && area >= 4) {
      found.push({ bbox: [left, top, right, bottom], area, palette_pair: pair });
    }
  }
  return found;
}

export function fieldState(rows: NativeRows, field: R): R {
  const crop = fieldCrop(rows, field.bbox), axis = field.axis;
  const cross = axis === 0 ? crop.length : crop[0]!.length;
  const end = field.side === 0 ? (axis === 0 ? crop[0]!.length - 1 : crop.length - 1) : 0;
  const lengths: number[] = [];
  for (let k = 0; k < cross; k++) {
    lengths.push(bandQuantities(crop, { axis, probes: [[k]], side: field.side, end, fill: field.fill_palette })[0]!);
  }
  const observed = new Set(crop.flat()), known = new Set([field.fill_palette, field.alternative_fill_palette, ...(field.initial_other_palettes ?? [])]);
  const opaque = [...observed].some(value => !known.has(value));
  return { pixel_extent_interval: opaque ? [0, null] : [Math.min(...lengths), Math.max(...lengths)],
    pixel_extent_profiles: opaque ? null : lengths, appearance_digest: identity(crop), opaque_replacement: opaque,
    physical_quantity_interval: [0, null], capacity: null, calibration: 'unknown', envelope_complete: false };
}

export function acquireFields(before: NativeRows, after: NativeRows, refs: readonly string[]): R[] {
  const changes = fieldChangeGroups(before, after), parts = geometricComponents(before), pairCounts = new Map<string, number>(), fields: R[] = [];
  for (const group of changes) {
    const key = JSON.stringify(group.palette_pair); pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  for (const group of changes) {
    const [l, t, r, b] = group.bbox, [old, next] = group.palette_pair;
    let best: { area: number; part: (typeof parts)[number]; axis: number; side: number } | null = null;
    for (const part of parts) {
      const [x, y, X, Y] = part.bbox, w = X - x + 1, h = Y - y + 1;
      if (part.color !== old || !(x <= l && l <= r && r <= X && y <= t && t <= b && b <= Y)
        || part.area < group.area || Math.max(w, h) > Math.max(before.length, before[0]!.length) / 2) continue;
      const axes: [number, number][] = [];
      if (h === b - t + 1 && w > r - l + 1 && (l === x || r === X)) axes.push([0, l === x ? 1 : 0]);
      if (w === r - l + 1 && h > b - t + 1 && (t === y || b === Y)) axes.push([1, t === y ? 1 : 0]);
      for (const [axis, side] of axes) {
        // Python min(..., key=area) keeps the first component on equal areas.
        if (best === null || w * h < best.area) best = { area: w * h, part, axis, side };
      }
    }
    if (best === null) continue;
    const { part, axis, side } = best, repeated = pairCounts.get(JSON.stringify(group.palette_pair))! > 1;
    const field: R = { id: identity([part.bbox, refs]), bbox: part.bbox, axis, side: repeated ? side : 1 - side,
      fill_palette: repeated ? next : old, alternative_fill_palette: repeated ? old : next,
      polarity_hypothesis: repeated ? 'repeated_new_content' : 'single_old_content', evidence: refs,
      scope: 'Observed persistent support and contiguous pixel extent. Color polarity is provisional; no units, capacity or flow law supplied.' };
    field.initial_other_palettes = [...new Set(fieldCrop(before, part.bbox).flat())].filter(value => value !== old && value !== next).sort((a, b) => a - b);
    field.initial_state = fieldState(before, field); field.observed_state = fieldState(after, field); fields.push(field);
  }
  return fields;
}

export function fieldStates(rows: NativeRows, fields: readonly R[]): R {
  return Object.fromEntries(fields.map(field => [field.id, fieldState(rows, field)]));
}

export function fieldDirections(old: R, next: R): R {
  const out: R = {};
  for (const [ref, previous] of Object.entries(old)) {
    const aa: number[] | null = previous.pixel_extent_profiles, bb: number[] | null = next[ref].pixel_extent_profiles;
    if (aa === null || bb === null) { out[ref] = null; continue; }
    const delta = aa.slice(0, Math.min(aa.length, bb.length)).map((value, i) => bb[i]! - value);
    out[ref] = delta.every(value => value >= 0) && delta.some(value => value > 0) ? 1
      : delta.every(value => value <= 0) && delta.some(value => value < 0) ? -1
        : delta.every(value => value === 0) ? 0 : null;
  }
  return out;
}

export function pairedControls(rows: NativeRows): R[] {
  const parts = geometricComponents(rows), result: R[] = [];
  const order = (a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]!;
  for (const [i, a] of parts.entries()) {
    const [l, t, r, b] = a.bbox, w = r - l + 1, h = b - t + 1;
    if (a.area < 2 || a.area >= w * h) continue;
    for (const z of parts.slice(i + 1)) {
      const [L, T, R, B] = z.bbox;
      if (z.color !== a.color || z.area !== a.area) continue;
      const vertical = L === l && R === r && T - b === 2 && B - T + 1 === h
        && equal(a.mask.map(([x, y]) => [x, h - 1 - y]).sort(order), z.mask);
      const horizontal = T === t && B === b && L - r === 2 && R - L + 1 === w
        && equal(a.mask.map(([x, y]) => [w - 1 - x, y]).sort(order), z.mask);
      if (vertical || horizontal) result.push({ bbox: [l, t, R, B], point: [Math.floor((l + R) / 2), Math.floor((t + B) / 2)],
        orientation: vertical ? 'vertical' : 'horizontal', evidence_components: [a.id, z.id] });
    }
  }
  return result;
}

export function linkedControl(field: R, controls: readonly R[]): R | null {
  const [l, t, r, b] = field.bbox, cx = Math.floor((l + r) / 2), cy = Math.floor((t + b) / 2);
  const matches: { distance: number; control: R }[] = [];
  for (const control of controls) {
    const [x, y] = control.point;
    if (x === cx && (y < t || y > b)) matches.push({ distance: Math.min(Math.abs(y - t), Math.abs(y - b)), control });
    else if (y === cy && (x < l || x > r)) matches.push({ distance: Math.min(Math.abs(x - l), Math.abs(x - r)), control });
  }
  matches.sort((a, b) => a.distance - b.distance);
  return matches.length && (matches.length === 1 || matches[0]!.distance < matches[1]!.distance) ? matches[0]!.control : null;
}

export function sameFieldShape(component: R, template: R): boolean {
  const [l, t, r, b] = component.bbox;
  return equal([r - l + 1, b - t + 1], template.extent) && component.area === template.area && component.color === template.background;
}

export function fieldShape(component: R): R {
  const [l, t, r, b] = component.bbox;
  return { extent: [r - l + 1, b - t + 1], area: component.area, background: component.color };
}

export function currentControl(rows: NativeRows, prior: R): R | null {
  const point = prior.point, [l, t, r, b] = prior.bbox, half = Math.floor(Math.max(r - l, b - t) / 2), [x, y] = point;
  const L = x - half, T = y - half, R = x + half, B = y + half;
  if (L < 0 || T < 0 || R >= rows[0]!.length || B >= rows.length) return null;
  const local = pairedControls(fieldCrop(rows, [L, T, R, B])), matches: R[] = [];
  for (const control of local) {
    if (!equal([control.point[0] + L, control.point[1] + T], point)) continue;
    matches.push({ ...control, point, bbox: [control.bbox[0] + L, control.bbox[1] + T, control.bbox[2] + L, control.bbox[3] + T],
      measurement_scope: 'current crop rebound from prior measured control extent; no global component identity' });
  }
  return matches.length === 1 ? structuredClone(matches[0]!) : null;
}
