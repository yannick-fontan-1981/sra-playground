/** Pinned queued_field_observation: public lattices, active envelopes and preview alternatives. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const ascending = (a: number, b: number): number => a - b;
const distinct = (values: number[]): number[] => [...new Set(values)].sort(ascending);

/** Supplied geometry is a current sampling hypothesis, never a transported board. */
export function queuedFieldGrid(rows: NativeRows, geometry: R): number[][] | null {
  const [x0, y0] = geometry.origin, [nx, ny] = geometry.shape, [w, h] = geometry.size, [dx, dy] = geometry.pitch;
  const grid: number[][] = [];
  for (let j = 0; j < ny; j++) {
    const line: number[] = [];
    for (let i = 0; i < nx; i++) {
      const values = new Set<number>();
      for (let y = y0 + j * dy; y < y0 + j * dy + h; y++) for (let x = x0 + i * dx; x < x0 + i * dx + w; x++) {
        const value = rows.at(y)?.at(x);
        if (value === undefined) return null;
        values.add(value);
      }
      if (values.size !== 1) return null;
      line.push([...values][0]!);
    }
    grid.push(line);
  }
  return grid;
}

export function measureQueuedField(rows: NativeRows, retainedGeometry: R | null = null, memberCount: number | null = null): R | null {
  const parts = geometricComponents(rows), rectangles = new Map<string, { size: number[]; cells: R[] }>();
  for (const part of parts) {
    const [x, y, r, b] = part.bbox, w = r - x + 1, h = b - y + 1;
    if (Math.min(w, h) < 2 || part.area !== w * h) continue;
    const key = `${w},${h}`;
    if (!rectangles.has(key)) rectangles.set(key, { size: [w, h], cells: [] });
    rectangles.get(key)!.cells.push(part);
  }
  let geometry = retainedGeometry;
  if (geometry === null) {
    const candidates: { weight: number; geometry: R }[] = [];
    for (const { size: [w, h], cells } of rectangles.values()) {
      const xs = distinct(cells.map(part => part.bbox[0])), ys = distinct(cells.map(part => part.bbox[1]));
      if (Math.min(xs.length, ys.length) < 2 || cells.length !== xs.length * ys.length) continue;
      const dxs = distinct(xs.slice(1).map((value, i) => value - xs[i]!)), dys = distinct(ys.slice(1).map((value, i) => value - ys[i]!));
      if (dxs.length !== 1 || dys.length !== 1) continue;
      const dx = dxs[0]!, dy = dys[0]!;
      if (dx <= w! || dy <= h!) continue;
      candidates.push({ weight: cells.length * w! * h!, geometry: { origin: [xs[0], ys[0]], shape: [xs.length, ys.length], size: [w, h], pitch: [dx, dy] } });
    }
    if (!candidates.length) return null;
    const best = Math.max(...candidates.map(item => item.weight)), matches = candidates.filter(item => item.weight === best);
    if (matches.length !== 1) return null;
    geometry = matches[0]!.geometry;
  }
  const g = geometry, [x0, y0] = g.origin, [nx, ny] = g.shape, [w, h] = g.size, [dx, dy] = g.pitch;
  if (x0 < 0 || y0 < 0 || x0 + (nx - 1) * dx + w > rows[0]!.length || y0 + (ny - 1) * dy + h > rows.length) return null;
  const grid = queuedFieldGrid(rows, g);
  if (!grid) return null;
  const marks: R[] = [];
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, covered: [number, number][] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (l < x0 + i * dx && x0 + i * dx + w - 1 < r && t < y0 + j * dy && y0 + j * dy + h - 1 < b) covered.push([i, j]);
    }
    if (covered.length < 2 || new Set(covered.map(([i]) => i)).size !== 1) continue;
    if (r - l + 1 > dx || b - t + 1 > covered.length * dy) continue;
    if (covered.some(([i, j]) => grid[j]![i] === part.color)) continue;
    marks.push({ column: covered[0]![0], rows: covered.map(([, j]) => j), values: covered.map(([i, j]) => grid[j]![i]), bbox: part.bbox, palette: part.color });
  }
  const compatible = marks.filter(mark => memberCount === null || mark.values.length === memberCount), mark = compatible.length === 1 ? compatible[0]! : null;
  const previews: R[] = [];
  if (mark) {
    const k = mark.values.length, palettes = new Set(grid.flat());
    for (const { size: [pw, ph], cells: rawCells } of rectangles.values()) {
      if (pw! >= w || ph! >= h) continue;
      const cells = rawCells.filter(part => palettes.has(part.color) && !(x0 <= part.bbox[0] && part.bbox[0] < x0 + nx * dx && y0 <= part.bbox[1] && part.bbox[1] < y0 + ny * dy));
      const xs = distinct(cells.map(part => part.bbox[0])), ys = distinct(cells.map(part => part.bbox[1]));
      if (ys.length !== k || cells.length !== xs.length * ys.length || !xs.length) continue;
      const positions = new Map<string, number>(cells.map(part => [`${part.bbox[0]},${part.bbox[1]}`, part.color]));
      for (const forward of [true, false]) for (const downward of [true, false]) {
        const order = forward ? xs : [...xs].reverse(), vertical = downward ? ys : [...ys].reverse();
        previews.push({ orientation: [forward, downward], members: order.map(x => vertical.map(y => positions.get(`${x},${y}`))), positions: order.map(x => vertical.map(y => [x, y])) });
      }
    }
  }
  const counts = new Map<number, number>();
  for (const line of grid) for (const value of line) counts.set(value, (counts.get(value) ?? 0) + 1);
  const rank = [...counts].sort((a, b) => b[1] - a[1]);
  return { geometry: g, geometry_ref: identity(g), grid, mark, mark_alternatives: marks, active_member_count_constraint: memberCount,
    preview_alternatives: previews, empty_appearance_hypothesis: rank.length === 1 || rank[0]![1] > rank[1]![1] ? rank[0]![0] : null };
}

export function queuedFieldBoard(scene: R, empty: number): (number | null)[][] {
  const result = (scene.grid as number[][]).map(row => row.map(value => value === empty ? null : value));
  if (scene.mark) for (const j of scene.mark.rows as number[]) result[j]![scene.mark.column] = null;
  return result;
}
