/**
 * Exact framed cell patches from cell_patch_observation.py, pinned V6 source.
 * Geometry, patch equality and a uniform majority do not establish game roles.
 */
import { geometricComponents } from './v6-native-observer.ts';
import type { GeometricComponent } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';

type R = Record<string, any>;
export interface CellPatchGeometry {
  origin: readonly number[]; shape: readonly number[]; size: readonly number[]; pitch: readonly number[];
}
type RectangleGroup = { width: number; height: number; parts: GeometricComponent[] };
const sortedUnique = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
const pitch = (positions: number[]): number => positions.slice(1).map((value, index) => value - positions[index]!).reduce(gcd);
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;

export function cellPatchCenter(geometry: CellPatchGeometry, point: readonly number[]): number[] {
  return [0, 1].map(axis => geometry.origin[axis]! + point[axis]! * geometry.pitch[axis]! + Math.floor((geometry.size[axis]! - 1) / 2));
}

/** The consumed unoccluded, same-value branch of revalidate_frame. */
function samePerimeter(rows: NativeRows, box: readonly number[], value: number): boolean {
  const [left, top, right, bottom] = box as [number, number, number, number];
  if (left < 0 || top < 0 || bottom >= rows.length || right >= rows[0]!.length) return false;
  let corners = 0, measured = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x !== left && x !== right && y !== top && y !== bottom) continue;
    if (rows[y]![x] !== value) return false;
    measured++; if ((x === left || x === right) && (y === top || y === bottom)) corners++;
  }
  return corners >= 2 && measured >= right - left + bottom - top;
}

export function validateCellPatchGeometry(rows: NativeRows, geometry: CellPatchGeometry): boolean {
  const [x, y] = geometry.origin as [number, number], [w, h] = geometry.size as [number, number];
  const [dx, dy] = geometry.pitch as [number, number], [nx, ny] = geometry.shape as [number, number];
  const box = [x - 1, y - 1, x + (nx - 1) * dx + w, y + (ny - 1) * dy + h];
  if (box[0]! < 0 || box[1]! < 0 || box[2]! >= rows[0]!.length || box[3]! >= rows.length) return false;
  const value = rows[box[1]!]![box[0]!]!;
  if (!samePerimeter(rows, box, value)) return false;
  for (let v = y; v < box[3]!; v++) for (let u = x; u < box[2]!; u++) {
    if ((modulo(u - x, dx) >= w || modulo(v - y, dy) >= h) && rows[v]![u] !== value) return false;
  }
  return true;
}

function rectangles(parts: readonly GeometricComponent[]): RectangleGroup[] {
  const groups = new Map<string, RectangleGroup>();
  for (const part of parts) {
    const [left, top, right, bottom] = part.bbox, width = right - left + 1, height = bottom - top + 1;
    if (Math.min(width, height) < 2 || part.area !== width * height) continue;
    const key = `${width},${height}`, group = groups.get(key) ?? { width, height, parts: [] };
    group.parts.push(part); groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * queued_field_observation.measure's geometry-only consumed result. Its later
 * mark/preview descriptions never affect the returned geometry or its validity.
 */
function queuedGeometry(rows: NativeRows, groups: readonly RectangleGroup[]): CellPatchGeometry | null {
  const candidates: { area: number; geometry: CellPatchGeometry }[] = [];
  for (const { width: w, height: h, parts } of groups) {
    const xs = sortedUnique(parts.map(part => part.bbox[0])), ys = sortedUnique(parts.map(part => part.bbox[1]));
    if (Math.min(xs.length, ys.length) < 2 || parts.length !== xs.length * ys.length) continue;
    const dxs = new Set(xs.slice(1).map((value, index) => value - xs[index]!));
    const dys = new Set(ys.slice(1).map((value, index) => value - ys[index]!));
    if (dxs.size !== 1 || dys.size !== 1) continue;
    const dx = dxs.values().next().value!, dy = dys.values().next().value!;
    if (dx <= w || dy <= h) continue;
    candidates.push({ area: parts.length * w * h,
      geometry: { origin: [xs[0]!, ys[0]!], shape: [xs.length, ys.length], size: [w, h], pitch: [dx, dy] } });
  }
  if (!candidates.length) return null;
  const maximum = Math.max(...candidates.map(candidate => candidate.area)), matches = candidates.filter(candidate => candidate.area === maximum);
  if (matches.length !== 1) return null;
  const geometry = matches[0]!.geometry;
  const [x, y] = geometry.origin as [number, number], [nx, ny] = geometry.shape as [number, number];
  const [w, h] = geometry.size as [number, number], [dx, dy] = geometry.pitch as [number, number];
  if (x < 0 || y < 0 || x + (nx - 1) * dx + w > rows[0]!.length || y + (ny - 1) * dy + h > rows.length) return null;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const value = rows[y + j * dy]![x + i * dx];
    for (let v = y + j * dy; v < y + j * dy + h; v++) for (let u = x + i * dx; u < x + i * dx + w; u++) {
      if (rows[v]![u] !== value) return null;
    }
  }
  return geometry;
}

export function projectCellPatch(rows: NativeRows, geometry: CellPatchGeometry): R | null {
  if (!validateCellPatchGeometry(rows, geometry)) return null;
  const [x, y] = geometry.origin as [number, number], [w, h] = geometry.size as [number, number];
  const [dx, dy] = geometry.pitch as [number, number], [nx, ny] = geometry.shape as [number, number];
  const grid: string[][] = [], counts = new Map<string, number>(), motifs: R = {};
  for (let j = 0; j < ny; j++) {
    const line: string[] = [];
    for (let i = 0; i < nx; i++) {
      const patch = rows.slice(y + j * dy, y + j * dy + h).map(row => row.slice(x + i * dx, x + i * dx + w));
      const key = identity(patch), values = new Set(patch.flat());
      line.push(key); motifs[key] = { uniform: values.size === 1, palette: values.size === 1 ? values.values().next().value! : null, digest: key };
      if (values.size === 1) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    grid.push(line);
  }
  // Counter.most_common preserves first occurrence for tied frequencies.
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const empty = ranked.length && (ranked.length === 1 || ranked[0]![1] > ranked[1]![1]) ? ranked[0]![0] : null;
  return { geometry, ref: identity(geometry), grid, empty_hypothesis: empty, motifs,
    scope: 'Exact cell patch identities; uniform majority is an empty-cell hypothesis only. No mark role, dimension, response law or terminal length supplied.' };
}

export function measureCellPatchFields(rows: NativeRows, prior: readonly CellPatchGeometry[] = []): R[] {
  const parts = geometricComponents(rows), groups = rectangles(parts), geometries: CellPatchGeometry[] = [], receipts: string[] = [];
  const base = queuedGeometry(rows, groups);
  if (base && validateCellPatchGeometry(rows, base)) { geometries.push(base); receipts.push('queued_field_observation.measure'); }
  const add = (geometry: CellPatchGeometry, receipt: string): void => {
    if (validateCellPatchGeometry(rows, geometry) && !geometries.some(current => equal(current, geometry))) {
      geometries.push(geometry); receipts.push(receipt);
    }
  };
  for (const geometry of prior) add(geometry, 'current_separator_and_perimeter_revalidation');
  for (const { width: w, height: h, parts: cells } of groups) {
    const xs = sortedUnique(cells.map(part => part.bbox[0])), ys = sortedUnique(cells.map(part => part.bbox[1]));
    if (Math.min(xs.length, ys.length) < 2) continue;
    const dx = pitch(xs), dy = pitch(ys); if (dx <= w || dy <= h) continue;
    add({ origin: [xs[0]!, ys[0]!], shape: [Math.floor((xs.at(-1)! - xs[0]!) / dx) + 1, Math.floor((ys.at(-1)! - ys[0]!) / dy) + 1],
      size: [w, h], pitch: [dx, dy] }, 'partial_repeated_rectangles_with_current_full_perimeter_and_separators');
  }
  for (const frame of parts) {
    const [left, top, right, bottom] = frame.bbox;
    if (!samePerimeter(rows, frame.bbox, frame.color)) continue;
    for (const { width: w, height: h, parts: cells } of groups) {
      const inside = cells.filter(part => left < part.bbox[0] && part.bbox[2] < right && top < part.bbox[1] && part.bbox[3] < bottom);
      const xs = sortedUnique(inside.map(part => part.bbox[0])), ys = sortedUnique(inside.map(part => part.bbox[1]));
      if (Math.min(xs.length, ys.length) < 2) continue;
      const dx = pitch(xs), dy = pitch(ys); if (dx <= w || dy <= h) continue;
      const x = left + modulo(xs[0]! - left, dx), y = top + modulo(ys[0]! - top, dy);
      if (x !== left + 1 || y !== top + 1) continue;
      const nx = Math.floor((right - x - w) / dx) + 1, ny = Math.floor((bottom - y - h) / dy) + 1;
      if (Math.min(nx, ny) < 2 || x + (nx - 1) * dx + w !== right || y + (ny - 1) * dy + h !== bottom) continue;
      add({ origin: [x, y], shape: [nx, ny], size: [w, h], pitch: [dx, dy] }, 'framed_repeated_rectangles_and_exact_separators');
    }
  }
  const contained = (a: CellPatchGeometry, b: CellPatchGeometry): boolean => !equal(a, b) && equal(a.pitch, b.pitch) && equal(a.size, b.size)
    && [0, 1].every(axis => a.origin[axis]! >= b.origin[axis]! && modulo(a.origin[axis]! - b.origin[axis]!, b.pitch[axis]!) === 0
      && a.origin[axis]! + (a.shape[axis]! - 1) * a.pitch[axis]! <= b.origin[axis]! + (b.shape[axis]! - 1) * b.pitch[axis]!);
  return geometries.filter(geometry => !geometries.some(other => contained(geometry, other))).map(geometry => {
    const field = projectCellPatch(rows, geometry)!; field.measurement_receipts = receipts; return field;
  }).sort((a, b) => a.geometry.origin[1] - b.geometry.origin[1] || a.geometry.origin[0] - b.geometry.origin[0]);
}

export function cellPatchChanges(before: R, after: R): unknown[][] | null {
  if (!equal(before.geometry, after.geometry)) return null;
  return (before.grid as unknown[][]).flatMap((row, y) => row.flatMap((value, x) =>
    value !== after.grid[y][x] ? [[x, y, value, after.grid[y][x]]] : []));
}
