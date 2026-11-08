/** Public lattice/chain/mark measurements from pinned rooted_chain_observation.py. */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { PointSet, pointKey, comparePoints, type Point } from './v6-point-set.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const majority = (values: Iterable<number>): number => {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]![0];
};

export function measureRootedQuota(rows: NativeRows, contentPalette: number | null = null): R | null {
  const parts = geometricComponents(rows), candidates: { area: number; part: R; xs: number[]; ys: number[] }[] = [];
  for (const part of parts) {
    const [l, t, r, b] = part.bbox, w = r - l + 1, h = b - t + 1;
    if (Math.min(w, h) < 9) continue;
    const xs: number[] = [], ys: number[] = [];
    for (let x = l; x <= r; x++) {
      let count = 0; for (let y = t; y <= b; y++) count += Number(rows[y]![x] === part.color);
      if (count * 2 >= h) xs.push(x);
    }
    for (let y = t; y <= b; y++) {
      let count = 0; for (let x = l; x <= r; x++) count += Number(rows[y]![x] === part.color);
      if (count * 2 >= w) ys.push(y);
    }
    if (Math.min(xs.length, ys.length) < 3 || xs[0] !== l || xs.at(-1) !== r || ys[0] !== t || ys.at(-1) !== b) continue;
    const dx = new Set(xs.slice(1).map((value, i) => value - xs[i]!)), dy = new Set(ys.slice(1).map((value, i) => value - ys[i]!));
    if (dx.size !== 1 || dy.size !== 1 || Math.min([...dx][0]!, [...dy][0]!) < 4) continue;
    candidates.push({ area: w * h, part, xs, ys });
  }
  if (!candidates.length) return null;
  const { part: frame, xs, ys } = candidates.reduce((a, b) => b.area > a.area ? b : a);
  const [l, t, r, b] = frame.bbox, nx = xs.length - 1, ny = ys.length - 1;
  const centers = new Map<string, { cell: Point; point: Point }>();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) centers.set(`${i},${j}`,
    { cell: [i, j], point: [Math.floor((xs[i]! + xs[i + 1]!) / 2), Math.floor((ys[j]! + ys[j + 1]!) / 2)] });
  const inner: number[] = [];
  for (let y = t + 1; y < b; y++) for (let x = l + 1; x < r; x++) if (rows[y]![x] !== frame.color) inner.push(rows[y]![x]!);
  const bg = majority(inner), empty = contentPalette ?? majority([...centers.values()].map(({ point: [x, y] }) => rows[y]![x]!));
  const graph = new Map<string, Point[]>([...centers].map(([key]) => [key, []]));
  for (const { cell, point: [x, y] } of centers.values()) {
    for (const peer of [[cell[0] + 1, cell[1]], [cell[0], cell[1] + 1]] as Point[]) {
      const hit = centers.get(pointKey(peer)); if (!hit) continue;
      const [X, Y] = hit.point, line: number[] = [];
      if (y === Y) for (let u = x; u <= X; u++) line.push(rows[y]![u]!);
      else for (let v = y; v <= Y; v++) line.push(rows[v]![x]!);
      if (line.every(value => value !== bg && value !== frame.color)) {
        graph.get(pointKey(cell))!.push(peer); graph.get(pointKey(peer))!.push(cell);
      }
    }
  }
  if ([...graph.values()].some(peers => peers.length > 2)) return null;
  const pending = new PointSet([...centers.values()].map(value => value.cell)), chains: R[] = [];
  const thickness = (cell: Point): number => {
    const [x, y] = centers.get(pointKey(cell))!.point, color = rows[y]![x], runs: number[] = [];
    for (const [u, v] of [[1, 0], [0, 1]]) {
      let count = 1;
      for (const sign of [-1, 1]) {
        let k = 1;
        while (0 <= x + u! * k * sign && x + u! * k * sign < rows[0]!.length && 0 <= y + v! * k * sign
          && y + v! * k * sign < rows.length && rows[y + v! * k * sign]![x + u! * k * sign] === color) { count++; k++; }
      }
      runs.push(count);
    }
    return Math.min(...runs);
  };
  while (pending.size) {
    const seed = pending.sorted()[0]!, group = new PointSet([seed]), todo: Point[] = [seed];
    while (todo.length) for (const peer of graph.get(pointKey(todo.pop()!))!) if (!group.has(peer)) { group.add(peer); todo.push(peer); }
    pending.differenceUpdate(group);
    // CPython point-set order is visible in endpoint_widths and the plan digest.
    const ends = [...group].filter(cell => graph.get(pointKey(cell))!.length <= 1);
    if (ends.length !== 2) return null;
    const widths = ends.map(thickness);
    if (widths[0] === widths[1]) return null;
    const root = ends[widths.indexOf(Math.max(...widths))]!, path: Point[] = [root];
    let previous: Point | null = null;
    for (;;) {
      const next = graph.get(pointKey(path.at(-1)!))!.filter(peer => previous === null || comparePoints(peer, previous) !== 0);
      if (!next.length) break;
      previous = path.at(-1)!; path.push(next[0]!);
    }
    if (path.length !== group.size) return null;
    chains.push({ cells: path.map(cell => [...cell]), points: path.map(cell => [...centers.get(pointKey(cell))!.point]),
      endpoint_widths: widths, root_hypothesis: 'unique wider endpoint, pending effect validation' });
  }
  const clues: number[][] = [], unitShapes: number[][] = [];
  for (const axis of [0, 1]) {
    const values: number[] = [], units = new PointSet();
    for (let i = 0; i < (axis === 0 ? ny : nx); i++) {
      const mid = axis === 0 ? Math.floor((ys[i]! + ys[i + 1]!) / 2) : Math.floor((xs[i]! + xs[i + 1]!) / 2);
      const pitch = axis === 0 ? ys[1]! - ys[0]! : xs[1]! - xs[0]!;
      const near = parts.filter(part => {
        const [L, T, R, B] = part.bbox, cx = (L + R) / 2, cy = (T + B) / 2;
        return axis === 0 ? l - pitch <= L && L <= R && R < l && Math.abs(cy - mid) < pitch / 4
          : t - pitch <= T && T <= B && B < t && Math.abs(cx - mid) < pitch / 4;
      });
      if (!near.length) return null;
      const hollow = near.filter(part => {
        const [L, T, R, B] = part.bbox;
        return R - L === B - T && part.area === (R - L + 1) ** 2 - 1 && rows[Math.floor((T + B) / 2)]![Math.floor((L + R) / 2)] !== part.color;
      });
      if (hollow.length) {
        if (hollow.length !== 1) return null;
        const [L, T, R, B] = hollow[0]!.bbox;
        if (near.some(part => !(L <= part.bbox[0] && part.bbox[2] <= R && T <= part.bbox[1] && part.bbox[3] <= B))) return null;
        values.push(0); continue;
      }
      const shapes = new PointSet(near.map(part => [part.bbox[2] - part.bbox[0] + 1, part.bbox[3] - part.bbox[1] + 1]));
      if (shapes.size !== 1 || near.some(part => part.area !== (part.bbox[2] - part.bbox[0] + 1) * (part.bbox[3] - part.bbox[1] + 1))) return null;
      units.update(shapes); values.push(near.length);
    }
    if (units.size !== 1) return null;
    unitShapes.push([...units][0]!.slice()); clues.push(values);
  }
  if (unitShapes[0]![0] !== unitShapes[1]![1] || unitShapes[0]![1] !== unitShapes[1]![0]) return null;
  chains.sort((a, b) => comparePoints(a.points[0], b.points[0]));
  const result: R = { bbox: frame.bbox, x_lines: xs, y_lines: ys, shape: [nx, ny], background: bg, grid_palette: frame.color,
    empty_content_palette: empty, chains, row_marks: clues[0], column_marks: clues[1], mark_unit_shapes: unitShapes,
    scope: 'Measured counts and drawn connectivity; quota semantics, root and prefix edit remain hypotheses.' };
  result.geometry_ref = identity(result);
  return result;
}

export function measureRootedLengths(rows: NativeRows, scene: R, model: R): number[] | null {
  const out: number[] = [];
  for (const chain of scene.chains as R[]) {
    const bits: number[] = [];
    for (const [x, y] of chain.points as number[][]) {
      const value = rows[y!]![x!];
      if (value === scene.empty_content_palette) bits.push(0);
      else if (model.fill_palette === value) bits.push(1);
      else return null;
    }
    const length = bits.reduce((sum, value) => sum + value, 0);
    if (bits.some((value, index) => value !== Number(index < length))) return null;
    out.push(length);
  }
  return out;
}
