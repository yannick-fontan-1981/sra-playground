/** Public-raster measurements consumed by pinned V6 common_crossed_prefix.py.
 * Field, miniature reference and aligned color-run addresses are measurements;
 * controller roles and prefix/crossing mechanics remain hypotheses. Coordinates
 * use [x, y]. No palette role, game identity or advancing input is supplied. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

export type CrossedPrefixPoint = [number, number];
export interface CrossedPrefixReference {
  origin: CrossedPrefixPoint; scale: CrossedPrefixPoint;
  values: number[][]; palette: number[];
}
export interface CrossedPrefixController {
  key: string; axis: 0 | 1; lane: number; side: -1 | 1;
  point: CrossedPrefixPoint; color: number; length: number;
  alternatives: { point: CrossedPrefixPoint; color: number }[];
  button?: CrossedPrefixPoint; alternative?: number;
}
export interface CrossedPrefixLayout {
  origin: CrossedPrefixPoint; shape: CrossedPrefixPoint; size: CrossedPrefixPoint;
  pitch: CrossedPrefixPoint; empty_appearance: number;
  reference: CrossedPrefixReference; background: number;
  controllers: CrossedPrefixController[]; ref: string;
}
export type CrossedPrefixControlLayout = Pick<CrossedPrefixLayout,
  'origin' | 'shape' | 'size' | 'pitch' | 'reference'>;
export type CrossedPrefixSlotLayout = Pick<CrossedPrefixLayout, 'origin' | 'size' | 'pitch'>;

/** Counter.most_common ties keep the first encounter, including row-major
 * background ties and equal-frequency gaps in sorted coordinate sequences. */
function firstMode(values: Iterable<number>): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let selected: number | undefined, maximum = -1;
  for (const [value, count] of counts) if (count > maximum) { selected = value; maximum = count; }
  if (selected === undefined) throw new RangeError('A nonempty crossed-prefix measurement is required');
  return selected;
}

function measuredPixel(rows: NativeRows, x: number, y: number): number {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0
    || y >= rows.length || x >= rows[y]!.length) {
    throw new RangeError('Retained crossed-prefix address is outside the current public raster');
  }
  return rows[y]![x]!;
}

/** The source trusts its retained layout. Native retained coordinates are
 * bounded integers and cannot use Python negative-index wrapping. Slice
 * helpers below retain source slice clipping, including empty slices. */
function pair(value: readonly number[], positive = false): void {
  if (!Array.isArray(value) || value.length !== 2
    || value.some(item => !Number.isSafeInteger(item) || (positive && item < 1))) {
    throw new TypeError('Crossed-prefix geometry requires a pair of bounded integers');
  }
}

export function crossedPrefixGeometry(rows: NativeRows): CrossedPrefixLayout | null {
  const parts = geometricComponents(rows), height = rows.length, width = rows[0]!.length;
  const groups = new Map<string, { size: CrossedPrefixPoint; color: number; points: CrossedPrefixPoint[] }>();
  for (const part of parts) {
    const [x, y, right, bottom] = part.bbox, cw = right - x + 1, ch = bottom - y + 1;
    if (Math.min(cw, ch) < 2 || part.area !== cw * ch) continue;
    const key = `${cw}:${ch}:${part.color}`;
    const group: { size: CrossedPrefixPoint; color: number; points: CrossedPrefixPoint[] } =
      groups.get(key) ?? { size: [cw, ch], color: part.color, points: [] };
    group.points.push([x, y]); groups.set(key, group);
  }
  type Field = Pick<CrossedPrefixLayout, 'origin' | 'shape' | 'size' | 'pitch' | 'empty_appearance'>;
  let board: Field | null = null, boardWeight = -1;
  for (const { size: [cw, ch], color, points } of groups.values()) {
    const xs = [...new Set(points.map(([x]) => x))].sort((a, b) => a - b);
    const ys = [...new Set(points.map(([, y]) => y))].sort((a, b) => a - b);
    if (points.length < 4 || Math.min(xs.length, ys.length) < 2) continue;
    const dx = firstMode(xs.slice(1).map((x, index) => x - xs[index]!));
    const dy = firstMode(ys.slice(1).map((y, index) => y - ys[index]!));
    if (dx <= cw || dy <= ch || points.some(([x, y]) => (x - xs[0]!) % dx !== 0 || (y - ys[0]!) % dy !== 0)) continue;
    const nx = (xs.at(-1)! - xs[0]!) / dx + 1, ny = (ys.at(-1)! - ys[0]!) / dy + 1;
    if (points.length * 2 < nx * ny) continue;
    const weight = points.length * cw * ch;
    // max(..., key=weight) retains the first maximum; there is no retry of a
    // smaller candidate if the selected field later has no valid reference.
    if (weight > boardWeight) {
      boardWeight = weight;
      board = { origin: [xs[0]!, ys[0]!], shape: [nx, ny], size: [cw, ch], pitch: [dx, dy], empty_appearance: color };
    }
  }
  if (board === null) return null;
  const [x0, y0] = board.origin, [nx, ny] = board.shape, [cw, ch] = board.size, [dx, dy] = board.pitch;
  const right = x0 + (nx - 1) * dx + cw, bottom = y0 + (ny - 1) * dy + ch;
  const inside = (x: number, y: number): boolean => x0 <= x && x < right && y0 <= y && y < bottom;
  const background = firstMode(rows.flat()), visited = new Uint8Array(width * height);
  const references: CrossedPrefixReference[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const start = y * width + x, value = rows[y]![x]!;
    if (visited[start] || inside(x, y) || value === background || value === board.empty_appearance) continue;
    const queue: CrossedPrefixPoint[] = [[x, y]], region: CrossedPrefixPoint[] = [];
    visited[start] = 1;
    let left = x, top = y, maxX = x, maxY = y;
    for (let at = 0; at < queue.length; at++) {
      const [u, v] = queue[at]!; region.push([u, v]);
      left = Math.min(left, u); top = Math.min(top, v); maxX = Math.max(maxX, u); maxY = Math.max(maxY, v);
      for (const [a, b] of [[u - 1, v], [u + 1, v], [u, v - 1], [u, v + 1]]) {
        if (a! < 0 || a! >= width || b! < 0 || b! >= height || visited[b! * width + a!] || inside(a!, b!)) continue;
        const candidate = rows[b!]![a!]!;
        if (candidate === background || candidate === board.empty_appearance) continue;
        visited[b! * width + a!] = 1; queue.push([a!, b!]);
      }
    }
    const rw = maxX - left + 1, rh = maxY - top + 1;
    const palette = [...new Set(region.map(([a, b]) => rows[b]![a]!))].sort((a, b) => a - b);
    if (region.length !== rw * rh || palette.length < 2 || rw % nx !== 0 || rh % ny !== 0) continue;
    const sx = rw / nx, sy = rh / ny;
    if (sx >= cw || sy >= ch || sx * ch !== sy * cw) continue;
    const target: number[][] = [];
    let uniform = true;
    for (let j = 0; j < ny && uniform; j++) {
      const line: number[] = [];
      for (let i = 0; i < nx; i++) {
        const first = rows[top + j * sy]![left + i * sx]!;
        for (let b = top + j * sy; b < top + (j + 1) * sy && uniform; b++) {
          for (let a = left + i * sx; a < left + (i + 1) * sx; a++) {
            if (rows[b]![a] !== first) { uniform = false; break; }
          }
        }
        if (!uniform) break;
        line.push(first);
      }
      if (uniform) target.push(line);
    }
    if (uniform) references.push({ origin: [left, top], scale: [sx, sy], values: target, palette });
  }
  if (!references.length || new Set(references.map(reference => identity(reference.values))).size !== 1) return null;
  const measured = { ...board, reference: references[0]!, background };
  const controllers = crossedPrefixMeasureControls(rows, measured);
  if (controllers === null) return null;
  const layout = { ...measured, controllers };
  return { ...layout, ref: identity(layout) };
}

export function crossedPrefixMeasureControls(rows: NativeRows, layout: CrossedPrefixControlLayout): CrossedPrefixController[] | null {
  pair(layout.origin); pair(layout.shape, true); pair(layout.size, true); pair(layout.pitch, true);
  const [x0, y0] = layout.origin, [nx, ny] = layout.shape, [cw, ch] = layout.size, [dx, dy] = layout.pitch;
  const palette = new Set(layout.reference.palette), result: CrossedPrefixController[] = [];
  for (const axis of [0, 1] as const) {
    const count = axis === 0 ? ny : nx, family: CrossedPrefixController[][] = [];
    for (const side of [-1, 1] as const) {
      const candidates: CrossedPrefixController[] = [];
      for (let lane = 0; lane < count; lane++) {
        const fixed = axis === 0 ? y0 + lane * dy + Math.floor((ch - 1) / 2) : x0 + lane * dx + Math.floor((cw - 1) / 2);
        const start = axis === 0 ? side < 0 ? x0 - 1 : x0 + (nx - 1) * dx + cw
          : side < 0 ? y0 - 1 : y0 + (ny - 1) * dy + ch;
        const limit = axis === 0 ? rows[0]!.length : rows.length;
        const runs: [number, number][] = [];
        let i = start;
        while (i >= 0 && i < limit) {
          const value = axis === 0 ? measuredPixel(rows, i, fixed) : measuredPixel(rows, fixed, i);
          if (!palette.has(value)) { i += side; continue; }
          const first = i;
          let length = 0;
          while (i >= 0 && i < limit && (axis === 0 ? measuredPixel(rows, i, fixed) : measuredPixel(rows, fixed, i)) === value) {
            length++; i += side;
          }
          if (length >= 2) runs.push([first + side * Math.floor(length / 2), value]);
        }
        if (!runs.length) break;
        const coordinate = (position: number): CrossedPrefixPoint => axis === 0 ? [position, fixed] : [fixed, position];
        const controller: CrossedPrefixController = { key: `${axis}:${lane}:${side}`, axis, lane, side,
          point: coordinate(runs[0]![0]), color: runs[0]![1], length: axis === 0 ? nx : ny,
          alternatives: runs.slice(1).map(([position, color]) => ({ point: coordinate(position), color })) };
        if (runs.length > 1) { controller.button = coordinate(runs[1]![0]); controller.alternative = runs[1]![1]; }
        candidates.push(controller);
      }
      if (candidates.length === count) family.push(candidates);
    }
    if (family.length !== 1) return null;
    result.push(...family[0]!);
  }
  return result;
}

export function crossedPrefixReferencePresent(rows: NativeRows, layout: Pick<CrossedPrefixLayout, 'reference'>): boolean {
  const reference = layout.reference, [x, y] = reference.origin, [width, height] = reference.scale;
  pair(reference.origin); pair(reference.scale, true);
  for (let j = 0; j < reference.values.length; j++) for (let i = 0; i < reference.values[j]!.length; i++) {
    for (let v = 0; v < height; v++) for (let u = 0; u < width; u++) {
      if (measuredPixel(rows, x + i * width + u, y + j * height + v) !== reference.values[j]![i]) return false;
    }
  }
  return true;
}

/** layout is intentionally unused, as in the original address projection. */
export function crossedPrefixCell(controller: Pick<CrossedPrefixController, 'side' | 'length' | 'axis' | 'lane'>,
  index: number, _layout?: CrossedPrefixControlLayout): CrossedPrefixPoint {
  if (!Number.isSafeInteger(index)) throw new TypeError('A crossed-prefix index must be a bounded integer');
  const along = controller.side < 0 ? index : controller.length - 1 - index;
  return controller.axis === 0 ? [along, controller.lane] : [controller.lane, along];
}

export function crossedPrefixSlot(rows: NativeRows, layout: CrossedPrefixSlotLayout, position: readonly number[]): number[][] {
  pair(layout.origin); pair(layout.size, true); pair(layout.pitch, true); pair(position);
  const x = layout.origin[0] + position[0]! * layout.pitch[0], y = layout.origin[1] + position[1]! * layout.pitch[1];
  return rows.slice(y, y + layout.size[1]).map(row => row.slice(x, x + layout.size[0]));
}

export function crossedPrefixInputCandidates(rows: NativeRows, available: readonly string[]): { action_ref: 'ACTION6'; data: { x: number; y: number } }[] {
  if (!available.includes('ACTION6')) return [];
  const layout = crossedPrefixGeometry(rows);
  if (layout === null) return [];
  const points = new Map<string, CrossedPrefixPoint>();
  for (const controller of layout.controllers) {
    points.set(controller.point.join(','), controller.point);
    for (const alternative of controller.alternatives) points.set(alternative.point.join(','), alternative.point);
  }
  return [...points.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([x, y]) => ({ action_ref: 'ACTION6', data: { x, y } }));
}
