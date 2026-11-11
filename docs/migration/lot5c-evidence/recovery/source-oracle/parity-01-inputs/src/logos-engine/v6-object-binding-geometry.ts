/** Consumed public measurements from guarded_binding/geometry.py and the
 * locate helper in family.py. No game identity or hidden geometry enters here. */
import { compareUnicode } from './canonical.ts';
import { sha256Bytes } from './v6-hash.ts';
import { unique as measuredUnique, find_body as measuredBody, moved_core as measuredMotion,
  revalidate_frame as measuredFrame, locate as measuredLocate } from './v6-inventory-measurements.ts';
import { bindingCompare as compare, bindingEqual as same, bindingKey as key,
  type BindingRecord as R, type BindingFloatPath, type BindingWork } from './v6-object-binding-common.ts';
import type { NativeRows } from './v6-native-types.ts';

/** Python compact sorted ensure_ascii JSON. Source divisions produce float
 * centres even when their numeric value is integral; those paths are explicit
 * at each consumed digest call rather than changing the transported values. */
export function digest(value: unknown, floatPaths: readonly BindingFloatPath[] = []): string {
  const floats = new Set(floatPaths.map(path => JSON.stringify(path.map(String))));
  const ascii = (text: string): string => JSON.stringify(text).replace(/[\u007f-\uffff]/g,
    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const number = (n: number, floating: boolean): string => {
    if (!Number.isFinite(n)) throw new TypeError('Binding digest requires finite numbers');
    if (!floating && Number.isInteger(n)) {
      if (!Number.isSafeInteger(n)) throw new TypeError('Binding integer digest exceeds the exact native domain');
      return String(n);
    }
    if (Object.is(n, -0)) return '-0.0';
    const absolute = Math.abs(n);
    if (absolute !== 0 && (absolute < 1e-4 || absolute >= 1e16)) {
      const [mantissa, rawExponent] = n.toExponential().split('e');
      const exponent = Number(rawExponent);
      return mantissa + 'e' + (exponent < 0 ? '-' : '+') + String(Math.abs(exponent)).padStart(2, '0');
    }
    return Number.isInteger(n) ? String(n) + '.0' : String(n);
  };
  const encode = (item: any, path: string[]): string => {
    if (item === null) return 'null';
    if (typeof item === 'string') return ascii(item);
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'number') return number(item, floats.has(JSON.stringify(path)) || !Number.isInteger(item));
    if (Array.isArray(item)) return '[' + item.map((part, index) => encode(part, [...path, String(index)])).join(',') + ']';
    if (item && typeof item === 'object') return '{' + Object.keys(item).sort(compareUnicode)
      .map(name => ascii(name) + ':' + encode(item[name], [...path, name])).join(',') + '}';
    throw new TypeError('Binding digest requires explicit JSON values');
  };
  return sha256Bytes(new TextEncoder().encode(encode(value, []))).slice(0, 24);
}
export const center = (box: readonly number[]): number[] => [(box[0]! + box[2]!) / 2, (box[1]! + box[3]!) / 2];
export const contains = (outer: readonly number[], inner: readonly number[]): boolean =>
  outer[0]! <= inner[0]! && outer[1]! <= inner[1]! && outer[2]! >= inner[2]! && outer[3]! >= inner[3]!;
export const intersects = (a: readonly number[], b: readonly number[]): boolean =>
  a[0]! <= b[2]! && b[0]! <= a[2]! && a[1]! <= b[3]! && b[1]! <= a[3]!;
export const near = (a: readonly number[], b: readonly number[]): boolean =>
  Math.max(0, b[0]! - a[2]!, a[0]! - b[2]!) === 0 && Math.max(0, b[1]! - a[3]!, a[1]! - b[3]!) === 0;
export function unique(observation: R, work?: BindingWork): R {
  work?.tick(observation.entities.length); return measuredUnique(observation);
}
export function find_body(observation: R, signature: string | null, work?: BindingWork): R | null {
  work?.tick(observation.entities.length); return measuredBody(observation, signature);
}
export function empty_frames(observation: R, rows: NativeRows, work?: BindingWork): R[] {
  const horizontal = new Map<number, number[][]>(), vertical = new Map<number, number[][]>();
  for (const entity of observation.entities as R[]) {
    work?.node(); const [l, t, r, b] = entity.bbox, value = entity.palette_value;
    if (t === b && r - l >= 2) { const lines = horizontal.get(value) ?? []; lines.push([l, t, r, b]); horizontal.set(value, lines); }
    if (l === r && b - t >= 2) { const lines = vertical.get(value) ?? []; lines.push([l, t, r, b]); vertical.set(value, lines); }
  }
  const frames: R[] = [];
  for (const [value, lines] of horizontal) {
    const upright = new Set((vertical.get(value) ?? []).map(key));
    for (const [left, top, right] of lines) for (const [l, bottom, rr] of lines) {
      work?.tick();
      if (l !== left || rr !== right || bottom! - top! < 4) continue;
      if (!upright.has(key([left! - 1, top! + 1, left! - 1, bottom! - 1]))
        || !upright.has(key([right! + 1, top! + 1, right! + 1, bottom! - 1]))) continue;
      const corners = [[left! - 1, top!], [right! + 1, top!], [left! - 1, bottom!], [right! + 1, bottom!]]
        .map(([x, y]) => rows[y!]![x!]!);
      if (new Set(corners).size !== 1) continue;
      const interior = new Set<number>();
      for (let y = top! + 1; y < bottom!; y++) for (let x = left!; x <= right!; x++) { work?.tick(); interior.add(rows[y]![x]!); }
      if (interior.size !== 1 || interior.has(value)) continue;
      const bbox = [left! - 1, top!, right! + 1, bottom!];
      frames.push({ ref: 'empty_frame:' + digest([value, left, top, right, bottom]), palette_value: value,
        bbox, interior_bbox: [left!, top! + 1, right!, bottom! - 1], center: center(bbox),
        corner_value: corners[0], interior_value: [...interior][0], evidence: observation.observation_ref });
    }
  }
  return frames;
}
export function enclosing_contours(observation: R, body: R, work?: BindingWork): number[] {
  const values: number[] = [];
  for (const entity of observation.entities as R[]) {
    work?.tick(); const [l, t, r, b] = entity.bbox, width = r - l + 1, height = b - t + 1;
    if (contains(entity.bbox, body.bbox) && width > 2 * (body.bbox[2] - body.bbox[0] + 1)
      && height > 2 * (body.bbox[3] - body.bbox[1] + 1) && entity.area < width * height / 4) values.push(entity.palette_value);
  }
  return values;
}
export function revalidate_frame(frame: R, rows: NativeRows, occluders: readonly number[][] = [], contour_values: readonly number[] = [], work?: BindingWork): R | null {
  if (!work) return measuredFrame(frame, rows, occluders, contour_values);
  const [l, t, r, b] = frame.bbox, measured: number[][] = []; let corners = 0;
  if (l < 0 || t < 0 || b >= rows.length || r >= rows[0]!.length) return null;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    work.tick(); if (x !== l && x !== r && y !== t && y !== b) continue;
    if (occluders.some(([a, d, c, e]) => a! <= x && x <= c! && d! <= y && y <= e!)) continue;
    if (contour_values.includes(rows[y]![x]!)) continue;
    const corner = (x === l || x === r) && (y === t || y === b);
    if (rows[y]![x] !== (corner ? frame.corner_value : frame.palette_value)) return null;
    measured.push([x, y]); corners += Number(corner);
  }
  return corners < 2 || measured.length < r - l + b - t ? null : { ...frame, current_unoccluded_perimeter: measured,
    status: occluders.length ? 'partially_occluded_frame_revalidated' : 'frame_revalidated' };
}
export function correspondence(observation: R, rows: NativeRows, controlled: string | null = null,
  known_frames: Iterable<R> = [], work?: BindingWork): R[] {
  const frames = empty_frames(observation, rows, work), result: R[] = [];
  const body = controlled ? find_body(observation, controlled, work) : null;
  if (body) {
    const current = new Set(frames.map(frame => frame.ref));
    for (const previous of known_frames) {
      work?.node(); if (current.has(previous.ref)) continue;
      const rebound = revalidate_frame(previous, rows, [body.bbox], enclosing_contours(observation, body, work), work);
      if (rebound) { frames.push(rebound); current.add(rebound.ref); }
    }
  }
  for (const frame of frames) {
    const box = frame.interior_bbox, width = box[2] - box[0] + 1, height = box[3] - box[1] + 1;
    for (const entity of observation.entities as R[]) {
      work?.node(); const [l, t, r, b] = entity.bbox;
      if (entity.signature === controlled || entity.palette_value !== frame.palette_value || entity.identity_ambiguous || entity.area < 4) continue;
      if (Math.min(r - l, b - t) < 1 || r - l + 1 > width || b - t + 1 > height || frames.some(f => intersects(entity.bbox, f.bbox))) continue;
      result.push({ ref: 'correspondence:' + digest([entity.signature, frame.ref]), object: {
        signature: entity.signature, bbox: entity.bbox, center: center(entity.bbox), area: entity.area, palette_value: entity.palette_value },
      frame, status: 'appearance_and_fit_suggest_reception_not_prove_goal', evidence: [observation.observation_ref] });
    }
  }
  return result;
}
export function moved_core(before: R, after: R, minimum_area = 4, preferred_minimum_area: number | null = null, work?: BindingWork): R | null {
  if (!work) return measuredMotion(before, after, minimum_area, preferred_minimum_area);
  const a = unique(before, work), b = unique(after, work); let moving: R[] = [];
  for (const signature of Object.keys(a)) {
    work.node(); if (!Object.hasOwn(b, signature)) continue;
    const first = a[signature], second = b[signature], p = center(first.bbox), q = center(second.bbox), delta = q.map((v, i) => v - p[i]!);
    if (same(delta, [0, 0]) || first.area < minimum_area) continue;
    moving.push({ signature, before_bbox: first.bbox, bbox: second.bbox, delta, area: first.area, palette_value: first.palette_value });
  }
  if (preferred_minimum_area !== null) { const preferred = moving.filter(item => item.area >= preferred_minimum_area); if (preferred.length) moving = preferred; }
  const cores = moving.filter(item => !moving.some(other => { work.tick(); return other !== item && contains(item.bbox, other.bbox)
    && !same(item.bbox, other.bbox) && same(item.delta, other.delta); }));
  return cores.length === 1 ? cores[0]! : null;
}
export function locate(rows: NativeRows, core: R, work?: BindingWork): number[] | null {
  if (!work) return measuredLocate(rows, core);
  const candidates: number[][] = [], seen = new Set<string>(), h = rows.length, w = rows[0]!.length, value = core.palette_value;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    work.tick(); if (seen.has(key([x, y])) || rows[y]![x] !== value) continue;
    const queue: number[][] = [[x, y]], cells: number[][] = []; seen.add(key([x, y]));
    for (let head = 0; head < queue.length; head++) {
      work.node(); const [a, b] = queue[head]!; cells.push([a!, b!]);
      for (const [xx, yy] of [[a! - 1, b!], [a! + 1, b!], [a!, b! - 1], [a!, b! + 1]]) {
        const id = key([xx!, yy!]);
        if (xx! >= 0 && xx! < w && yy! >= 0 && yy! < h && !seen.has(id) && rows[yy!]![xx!] === value) { seen.add(id); queue.push([xx!, yy!]); }
      }
    }
    if (cells.length !== core.area) continue;
    const box = [Math.min(...cells.map(p => p[0]!)), Math.min(...cells.map(p => p[1]!)), Math.max(...cells.map(p => p[0]!)), Math.max(...cells.map(p => p[1]!))];
    const offsets = cells.map(([xx, yy]) => [xx! - box[0]!, yy! - box[1]!]).sort(compare);
    if (same(offsets, [...core.offsets].sort(compare))) candidates.push(box);
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
