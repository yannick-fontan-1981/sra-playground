/** Pinned trace_field_observation: measured cells, rings and an ordered public trace. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { comparePoints, pointKey, type Point } from './v6-point-set.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const numeric = (a: number, b: number): number => a - b;
const gcd = (left: number, right: number): number => {
  let a = Math.abs(left), b = Math.abs(right);
  while (b) { const next = a % b; a = b; b = next; }
  return a;
};
const pixel = (rows: NativeRows, x: number, y: number): number => {
  const value = rows.at(y)?.at(x);
  if (value === undefined) throw new RangeError('Trace measurement outside the supplied public raster');
  return value;
};

export function traceFieldCenter(geometry: R, cell: readonly number[]): [number, number] {
  return [geometry.bbox[0] + geometry.pitch * cell[0]! + Math.floor(geometry.pitch / 2),
    geometry.bbox[1] + geometry.pitch * cell[1]! + Math.floor(geometry.pitch / 2)];
}

export function measureTraceField(rows: NativeRows, retainedGeometry: R | null = null): R | null {
  const parts = geometricComponents(rows), squares = new Map<number, R[]>(), frames: R[] = [];
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, w = r - l + 1, h = b - t + 1;
    if (w !== h || w < 3) continue;
    if (part.area === w * h) {
      if (!squares.has(w)) squares.set(w, []);
      squares.get(w)!.push(part);
    }
    if (part.area !== 4 * (w - 1)) continue;
    let complete = true;
    for (let y = t; y <= b && complete; y++) for (let x = l; x <= r; x++) {
      if ((y === t || y === b || x === l || x === r) && pixel(rows, x, y) !== part.color) { complete = false; break; }
    }
    if (complete) frames.push(part);
  }
  let geometry = retainedGeometry;
  if (geometry === null) {
    const candidates: { weight: number; geometry: R }[] = [];
    for (const frame of frames) {
      const [l, t, r, b] = frame.bbox;
      for (const [size, rawCells] of squares) {
        const cells = rawCells.filter(part => l < part.bbox[0] && part.bbox[0] <= part.bbox[2] && part.bbox[2] < r
          && t < part.bbox[1] && part.bbox[1] <= part.bbox[3] && part.bbox[3] < b);
        const xs = [...new Set<number>(cells.map(part => part.bbox[0]))].sort(numeric), ys = [...new Set<number>(cells.map(part => part.bbox[1]))].sort(numeric);
        if (cells.length < 3 || Math.min(xs.length, ys.length) < 2) continue;
        const distances = [xs, ys].flatMap(axis => axis.slice(1).map((value, index) => value - axis[index]!));
        const pitch = distances.reduce(gcd);
        if (pitch <= size || (r - l) % pitch || (b - t) % pitch || Math.floor((r - l) / pitch) < 2) continue;
        if (xs.some(x => (x - l - 1) % pitch) || ys.some(y => (y - t - 1) % pitch)) continue;
        const counts = new Map<number, number>();
        for (const cell of cells) counts.set(cell.color, (counts.get(cell.color) ?? 0) + 1);
        const floor = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
        candidates.push({ weight: cells.length * size * size, geometry: { bbox: frame.bbox, pitch, size,
          shape: [Math.floor((r - l) / pitch), Math.floor((b - t) / pitch)], outer_value: frame.color, floor_value: floor } });
      }
    }
    if (!candidates.length) return null;
    const best = Math.max(...candidates.map(candidate => candidate.weight)), matched = candidates.filter(candidate => candidate.weight === best);
    if (matched.length !== 1) return null;
    geometry = matched[0]!.geometry;
  }
  const g = geometry, [l, t, r, b] = g.bbox, pitch = g.pitch, [nx, ny] = g.shape;
  if (r >= rows[0]!.length || b >= rows.length) return null;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    if ((x === l || x === r || y === t || y === b) && pixel(rows, x, y) !== g.outer_value) return null;
  }
  const marks: R[] = [];
  for (const frame of frames) {
    const [a, c, z, d] = frame.bbox, width = z - a + 1;
    if (width >= pitch) continue;
    const point: Point = [Math.floor((a + z) / 2), Math.floor((c + d) / 2)], cells: Point[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (comparePoints(traceFieldCenter(g, [i, j]), point) === 0) cells.push([i, j]);
    if (cells.length === 1) marks.push({ cell: [...cells[0]!], bbox: frame.bbox, palette: frame.color,
      center_value: pixel(rows, point[0], point[1]), width });
  }
  const heads = marks.filter(mark => mark.center_value !== g.floor_value), receivers = marks.filter(mark => mark.center_value === g.floor_value);
  const pairs = heads.flatMap(head => receivers.filter(receiver => head.width === receiver.width).map(receiver => [head, receiver] as const));
  if (pairs.length !== 1) return null;
  const [head, receiver] = pairs[0]!, traceValue = head.center_value, edges: R[] = [], traced: [Point, Point][] = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) for (const [dx, dy] of [[1, 0], [0, 1]] as Point[]) {
    if (x + dx >= nx || y + dy >= ny) continue;
    const a: Point = [x, y], other: Point = [x + dx, y + dy], [px, py] = traceFieldCenter(g, a), [qx, qy] = traceFieldCenter(g, other);
    const mx = Math.floor((px + qx) / 2), my = Math.floor((py + qy) / 2), value = pixel(rows, mx, my);
    let width: number | null;
    if (value === traceValue) { traced.push(comparePoints(a, other) <= 0 ? [a, other] : [other, a]); width = null; }
    else {
      width = 1;
      for (const sign of [-1, 1]) {
        let k = 1;
        while (k < Math.floor(pitch / 2) && pixel(rows, mx + sign * k * dx, my + sign * k * dy) === value) { width++; k++; }
      }
    }
    edges.push({ cells: [[...a], [...other]], midpoint: [mx, my], value, width });
  }
  const widths = edges.filter(edge => edge.width !== null).map(edge => edge.width), minimum = widths.length ? Math.min(...widths) : null;
  const allowed = edges.filter(edge => edge.width === null || edge.width === minimum).map(edge => edge.cells);
  const adjacent = new Map<string, Point[]>();
  const neighbors = (point: Point): Point[] => {
    const key = pointKey(point);
    if (!adjacent.has(key)) adjacent.set(key, []);
    return adjacent.get(key)!;
  };
  for (const [a, other] of traced) { neighbors(a).push(other); neighbors(other).push(a); }
  if ([...adjacent.values()].some(values => values.length > 2)) return null;
  const path: Point[] = [head.cell];
  let previous: Point | null = null;
  for (;;) {
    const following = neighbors(path.at(-1)!).filter(point => previous === null || comparePoints(point, previous) !== 0);
    if (!following.length) break;
    if (following.length !== 1 || path.some(point => comparePoints(point, following[0]!) === 0)) return null;
    previous = path.at(-1)!; path.push(following[0]!);
  }
  if (path.length > 1 && path.length !== adjacent.size) return null;
  path.reverse();
  return { geometry: g, geometry_ref: identity(g), head, receiver_hypothesis: receiver, prefix: path.map(point => [...point]),
    allowed_edges_hypothesis: allowed, edge_measurements: edges, trace_value: path.length > 1 ? traceValue : null,
    scope: 'Thinner separators as passages and distinct empty mark as final receiver remain hypotheses. No palette role or game law is fixed.' };
}

export function traceFieldRingMatches(rows: NativeRows, geometry: R, mark: R, cell: readonly number[]): boolean {
  const [x, y] = traceFieldCenter(geometry, cell), half = Math.floor(mark.width / 2);
  for (let yy = y - half; yy <= y + half; yy++) for (let xx = x - half; xx <= x + half; xx++) {
    if ((yy === y - half || yy === y + half || xx === x - half || xx === x + half) && pixel(rows, xx, yy) !== mark.palette) return false;
  }
  return true;
}
