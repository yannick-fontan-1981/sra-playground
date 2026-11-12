/** Faithful public-raster transfer of V6 ordered_recruitment/geometry.py.
 * Source revision: 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * A measured chain/front/legend is a hypothesis, never a private queue law.
 */
import { canonical, compareUnicode, isJsonObject } from './canonical.ts';
import { sha256Bytes } from './v6-hash.ts';
import { components } from './v6-topological-recolor-geometry.ts';
import { pythonEqual, pythonTruthy } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

export type OrderedRecruitmentMeasurement = Record<string, any>;
type R = OrderedRecruitmentMeasurement;
type Point = readonly [number, number];
export type RecruitmentLattice = [number[], number[], number[], number];
const numbers = (a: number, b: number): number => a - b;
const points = (a: readonly number[], b: readonly number[]): number => a[0]! - b[0]! || a[1]! - b[1]!;
const key = (p: readonly number[]): string => p.join(',');
const setsEqual = <T>(a: Set<T>, b: Set<T>): boolean => a.size === b.size && [...a].every(v => b.has(v));
const integerMaps = new WeakSet<object>();

/** Python's source has integer keys in measurement.types. Restore that one
 * typed field after JSON transport as well as on fresh measurements; ordinary
 * string-key mappings continue to use Python's Unicode lexical ordering.
 * Hashes admit the repository's exact portable scalar domain. */
export function recruitmentDigest(value: unknown): string {
  const ancestors = new WeakSet<object>(); let nodes = 0;
  function encode(v: unknown, numericKeys = false, depth = 0): string {
    if (++nodes > 1_000_000 || depth > 128) throw new TypeError('Recruitment JSON size/nesting limit exceeded');
    if (v === null || typeof v !== 'object') return canonical(v).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
    if (ancestors.has(v)) throw new TypeError('Cyclic recruitment JSON');
    ancestors.add(v);
    let result: string;
    if (Array.isArray(v)) {
      if (Object.keys(v).length !== v.length || v.some((_, i) => !Object.hasOwn(v, i))) throw new TypeError('Recruitment arrays must be dense');
      result = `[${v.map(child => encode(child, false, depth + 1)).join(',')}]`;
    } else {
      if (!isJsonObject(v) || Object.getOwnPropertySymbols(v).length) throw new TypeError('Recruitment JSON requires plain mappings');
      const keys = Object.keys(v);
      if (Object.getOwnPropertyNames(v).length !== keys.length) throw new TypeError('Recruitment JSON requires enumerable members');
      for (const k of keys) if (!('value' in Object.getOwnPropertyDescriptor(v, k)!)) throw new TypeError('Recruitment JSON accessors are unsupported');
      const typedMeasurement = Object.hasOwn(v, 'types') && Object.hasOwn(v, 'legend') && Array.isArray(v.rooms) && Array.isArray(v.buttons);
      const numeric = numericKeys || integerMaps.has(v);
      if (numeric && keys.some(k => !/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(k) || !Number.isSafeInteger(Number(k)))) throw new TypeError('Recruitment type keys must be exact integers');
      keys.sort(numeric ? (a, b) => Number(a) - Number(b) : compareUnicode);
      result = `{${keys.map(k => `${encode(k, false, depth + 1)}:${encode(v[k], typedMeasurement && k === 'types', depth + 1)}`).join(',')}}`;
    }
    ancestors.delete(v); return result;
  }
  return sha256Bytes(new TextEncoder().encode(encode(value)));
}

function dominant(values: Iterable<number>): number | undefined {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let winner: number | undefined, highest = 0;
  for (const [value, count] of counts) if (count > highest) { winner = value; highest = count; }
  return winner;
}
// Source list indexing wraps negative coordinates; it does not silently yield
// undefined on an incompatible lattice. Retain that distinction at the port.
function pixel(rows: NativeRows, x: number, y: number): number {
  const row = rows[y < 0 ? rows.length + y : y];
  if (!row) throw new RangeError('Recruitment raster row outside input');
  const value = row[x < 0 ? row.length + x : x];
  if (value === undefined) throw new RangeError('Recruitment raster column outside input');
  return value;
}
function* pixels(rows: NativeRows, l = 0, t = 0, r = rows[0]!.length - 1, b = rows.length - 1): Generator<number> {
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) yield pixel(rows, x, y);
}

export function recruitmentRectangles(rows: NativeRows): R[] {
  const h = rows.length, w = rows[0]!.length, out: R[] = [], background = dominant(pixels(rows));
  for (let t = 0; t < h - 5; t++) {
    let x = 0;
    while (x < w) {
      let r = x;
      while (r + 1 < w && rows[t]![r + 1] === rows[t]![x]) r++;
      if (6 <= r - x + 1 && r - x + 1 <= 40 && rows[t]![x] !== background) {
        const v = rows[t]![x]!;
        for (let b = t + 3; b < Math.min(h, t + 32); b++) {
          let sides = true, bottom = true;
          for (let y = t; y <= b; y++) if (rows[y]![x] !== v || rows[y]![r] !== v) { sides = false; break; }
          if (!sides) continue;
          for (let xx = x; xx <= r; xx++) if (rows[b]![xx] !== v) { bottom = false; break; }
          if (!bottom) continue;
          const base = dominant(pixels(rows, x + 1, t + 1, r - 1, b - 1));
          if (base !== undefined && base !== v) out.push({ bbox: [x, t, r, b], border: v, base });
        }
      }
      x = r + 1;
    }
  }
  return out;
}

export function recruitmentLegend(rows: NativeRows, cc: readonly R[]): R | null {
  const squares = cc.filter(c => c.bbox[2] - c.bbox[0] === c.bbox[3] - c.bbox[1] && c.bbox[2] > c.bbox[0]
    && c.cells.length === (c.bbox[2] - c.bbox[0] + 1) ** 2);
  const groups = new Map<string, { y: number; n: number; bodies: R[] }>();
  for (const c of squares) {
    const y = c.bbox[1], n = c.bbox[3] - c.bbox[1] + 1, id = `${y},${n}`;
    if (!groups.has(id)) groups.set(id, { y, n, bodies: [] });
    groups.get(id)!.bodies.push(c);
  }
  const relations: R[] = [];
  for (const { y, n, bodies: large } of groups.values()) {
    const edge = Math.max(...large.map(c => c.bbox[2]));
    const small = (groups.get(`${y},${n - 1}`)?.bodies ?? []).filter(c => c.bbox[0] > edge);
    if (large.length !== 2 || small.length !== 2) continue;
    large.sort((a, b) => a.bbox[0] - b.bbox[0]); small.sort((a, b) => a.bbox[0] - b.bbox[0]);
    if (large.at(-1)!.bbox[2] >= small[0]!.bbox[0]) continue;
    const l = large.at(-1)!.bbox[2] + 1, r = small[0]!.bbox[0] - 1, glyphs: number[][] = [];
    for (let x = l; x < r; x++) {
      const v = rows[y]![x]!;
      if (n >= 3 && rows[y + n - 1]![x] === v && rows[y + Math.floor(n / 2)]![x + 1] === v
        && rows[y + Math.floor(n / 2)]![x] !== v && rows[y]![x + 1] !== v) glyphs.push([x, y, x + 1, y + n - 1, v]);
    }
    if (glyphs.length !== 1) continue;
    relations.push({ left: large.map(c => c.value), right: small.map(c => c.value), glyph: glyphs[0], evidence_boxes: [...large, ...small].map(c => c.bbox) });
  }
  if (relations.length < 2) return null;
  const pairMap = new Map<string, number[]>();
  for (const r of relations) { const pair = [...r.left].sort(numbers); pairMap.set(key(pair), pair); }
  const pairs = [...pairMap.values()];
  if (relations.some(r => !pairMap.has(key([...r.right].sort(numbers)))) || pairs.length !== relations.length
    || new Set(pairs.flat()).size !== 2 * pairs.length) return null;
  return { pairs: pairs.sort(points), relations };
}

export function recruitmentSpiral(n: number): number[][] {
  const out: number[][] = []; let left = 0, top = 0, right = n - 1, bottom = n - 1;
  while (left <= right && top <= bottom) {
    for (let x = left; x <= right; x++) out.push([x, top]); top++;
    for (let y = top; y <= bottom; y++) out.push([right, y]); right--;
    if (top <= bottom) { for (let x = right; x >= left; x--) out.push([x, bottom]); bottom--; }
    if (left <= right) { for (let y = bottom; y >= top; y--) out.push([left, y]); left++; }
  }
  return out;
}

export function recruitmentLatticeSubsets(allpoints: readonly (readonly number[])[]): RecruitmentLattice[] {
  const counts = new Map<number, number>();
  for (const [, y] of allpoints) counts.set(y!, (counts.get(y!) ?? 0) + 1);
  const eligible = [...counts].filter(([, count]) => count >= 3).map(([y]) => y).sort(numbers), eligibleSet = new Set(eligible);
  const lattices: RecruitmentLattice[] = [];
  for (const top of eligible) for (const following of eligible) {
    const pitch = following - top; if (pitch < 2) continue;
    for (let n = 3; n < 9; n++) {
      const ys = Array.from({ length: n }, (_, k) => top + pitch * k), ySet = new Set(ys);
      if (ys.some(y => !eligibleSet.has(y))) continue;
      const selected = allpoints.filter(([, y]) => ySet.has(y!)), xs = [...new Set(selected.map(([x]) => x!))].sort(numbers);
      if (xs.length !== 2 * n) continue;
      const a = xs.slice(0, n), e = xs.slice(n);
      if ([a, e].some(group => group.slice(1).some((v, i) => v - group[i]! !== pitch)) || e[0]! - a.at(-1)! <= pitch) continue;
      if (selected.length < 2 * n * n - 2) continue;
      lattices.push([a, e, ys, pitch]);
    }
  }
  const footprints = lattices.map(([a, e, ys]) => new Set([...a, ...e].flatMap(x => ys.map(y => `${x},${y}`))));
  return lattices.filter((_, i) => !footprints.some(other => footprints[i]!.size < other.size && [...footprints[i]!].every(p => other.has(p))));
}

export function recruitmentConnector(rows: NativeRows, bbox: readonly number[], base: number, axis: string): R | null {
  const [l, t, r, b] = bbox as [number, number, number, number], cells: Point[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]![x] !== base) cells.push([x, y]);
  if (![3, 4].includes(cells.length) || new Set(cells.map(([x, y]) => rows[y]![x])).size !== 1) return null;
  const cellSet = new Set(cells.map(key)), matches: R[] = [];
  for (const tip of cells) for (const direction of [-1, 1]) for (let depth = 1; depth <= Math.max(r - l, b - t); depth++) {
    const wing: Point = axis === 'horizontal' ? [tip[0] - direction * depth, tip[1]] : [tip[0], tip[1] - direction * depth];
    const wings: Point[] = axis === 'horizontal' ? [[wing[0], wing[1] - depth], [wing[0], wing[1] + depth]] : [[wing[0] - depth, wing[1]], [wing[0] + depth, wing[1]]];
    const core = new Set([key(tip), ...wings.map(key)]);
    if (setsEqual(cellSet, core) || setsEqual(cellSet, new Set([...core, key(wing)]))) matches.push({ tip: [...tip], wings: wings.sort(points).map(p => [...p]), direction, axis,
      center_filled: cellSet.has(key(wing)), cells: [...cells].sort(points).map(p => [...p]) });
  }
  return matches.length === 1 ? matches[0]! : null;
}

export function measureOrderedRecruitment(rows: NativeRows | null | undefined, order?: readonly (readonly number[])[] | null): R | null {
  if (!rows?.length || !rows[0]?.length) return null;
  const cc = components(rows), lg = recruitmentLegend(rows, cc); if (!lg) return null;
  const types: Record<string, number> = Object.fromEntries(lg.pairs.flatMap((p: number[], i: number) => p.map(v => [v, i])));
  integerMaps.add(types);
  const typed = (v: number): boolean => Object.hasOwn(types, v), rects = recruitmentRectangles(rows), buttons: R[] = [];
  for (const r of rects) {
    const [l, t, x, b] = r.bbox;
    if (!(x - l < b - t)) continue;
    const fields = cc.filter(c => typed(c.value) && l < c.bbox[0] && c.bbox[0] <= c.bbox[2] && c.bbox[2] < x
      && t < c.bbox[1] && c.bbox[1] <= c.bbox[3] && c.bbox[3] < b && c.bbox[2] - c.bbox[0] === c.bbox[3] - c.bbox[1]
      && c.cells.length === (c.bbox[2] - c.bbox[0] + 1) ** 2);
    if (fields.length === 1) buttons.push({ ...r, value: fields[0]!.value, type: types[fields[0]!.value], point: [Math.floor((l + x) / 2), Math.floor((t + b) / 2)] });
  }
  if (buttons.length !== lg.pairs.length || new Set(buttons.map(b => b.type)).size !== buttons.length
    || new Set(buttons.map(b => key([b.bbox[2] - b.bbox[0], b.bbox[3] - b.bbox[1]]))).size !== 1) return null;
  const player = new Set<number>(buttons.map(b => b.value)), enemy = new Set(Object.keys(types).map(Number).filter(v => !player.has(v)));
  if (enemy.size !== player.size || lg.pairs.some((p: number[]) => p.filter(v => player.has(v)).length !== 1)) return null;
  const rooms: R[] = [];
  for (const r of rects) {
    const [l, t, x, b] = r.bbox;
    if (!(x - l > b - t) || t >= Math.min(...buttons.map(z => z.bbox[1]))) continue;
    const possible: [number, ...RecruitmentLattice][] = [];
    for (const value of new Set(pixels(rows, l + 1, t + 1, x - 1, b - 1))) {
      if (typed(value) || value === r.base || value === r.border) continue;
      const allpoints: Point[] = [];
      for (let y = t + 1; y < b; y++) for (let xx = l + 1; xx < x; xx++) if (rows[y]![xx] === value) allpoints.push([xx, y]);
      for (const lattice of recruitmentLatticeSubsets(allpoints)) possible.push([value, ...lattice]);
    }
    if (possible.length !== 1) continue;
    const [value, a, e, ys, pitch] = possible[0]!, path = recruitmentSpiral(ys.length), left: R[] = [], right: R[] = []; let valid = true;
    for (const [xs, values, out] of [[a.slice().reverse(), player, left], [e, enemy, right]] as [number[], Set<number>, R[]][]) {
      let emptySeen = false;
      for (const [u, v] of path) {
        const xx = xs[u!]! - (pitch - 1), y = ys[v!]! - (pitch - 1), color = pixel(rows, xx, y);
        if (values.has(color)) { if (emptySeen) { valid = false; break; } out.push({ type: types[color], value: color, point: [xx, y] }); }
        else if (color === r.base) emptySeen = true;
        else { valid = false; break; }
      }
    }
    if (!valid) continue;
    const fronts: R[] = [];
    for (const [xs, queue] of [[a.slice().reverse(), left], [e, right]] as [number[], R[]][]) {
      if (!queue.length) continue;
      const marker = rows[ys[0]!]![xs[0]!]!;
      if (typed(marker) || marker === r.base || marker === value) { valid = false; break; }
      const marks: number[][] = [];
      for (const yy of ys) for (const xx of xs) if (rows[yy]![xx] !== r.base && rows[yy]![xx] !== value) marks.push([xx, yy]);
      if (!pythonEqual(marks, [[xs[0], ys[0]]])) { valid = false; break; }
      fronts.push({ point: [xs[0], ys[0]], value: marker });
    }
    if (!valid) continue;
    const lower = cc.filter(c => c.cells.length === 1 && l < c.bbox[0] && c.bbox[0] < x && ys.at(-1)! + 1 < c.bbox[1] && c.bbox[1] < b
      && !typed(c.value) && ![r.base, r.border, value].includes(c.value));
    rooms.push({ ...r, left, right, empty_value: value, grid: { left: a, right: e, ys, pitch }, quota_hypothesis: lower.length, front_markers: fronts,
      order_status: 'front_anchored_inward_spiral_hypothesis_not_full_order_law' });
  }
  if (rooms.length < 2 || new Set(rooms.map(r => key([r.bbox[2] - r.bbox[0], r.bbox[3] - r.bbox[1]]))).size !== 1) return null;
  const active = rooms.map((r, i) => r.left.length ? i : -1).filter(i => i >= 0); if (active.length !== 1) return null;
  const graph: number[][] = rooms.map(() => []), links: R[] = [];
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i]!, b = rooms[j]!, [l, t, r, d] = a.bbox, [u, v, x, y] = b.bbox; let witness: R | null = null;
    if (d === y && t === v) {
      const [left, right] = [a, b].sort((q, z) => q.bbox[0] - z.bbox[0]), lo = left!.bbox[2] + 1, hi = right!.bbox[0] - 1;
      const blocked = rooms.some(z => z !== a && z !== b && z.bbox[0] <= hi && z.bbox[2] >= lo && z.bbox[1] <= d && z.bbox[3] >= t);
      if (!blocked && lo <= hi) witness = recruitmentConnector(rows, [lo, t + 1, hi, d - 1], a.base, 'horizontal');
    } else if (l === u && r === x) {
      const [upper, lower] = [a, b].sort((q, z) => q.bbox[1] - z.bbox[1]), lo = upper!.bbox[3] + 1, hi = lower!.bbox[1] - 1;
      const blocked = rooms.some(z => z !== a && z !== b && z.bbox[1] <= hi && z.bbox[3] >= lo && z.bbox[0] <= r && z.bbox[2] >= l);
      if (!blocked && lo <= hi) witness = recruitmentConnector(rows, [l + 1, lo, r - 1, hi], a.base, 'vertical');
    }
    if (witness) { graph[i]!.push(j); graph[j]!.push(i); links.push({ rooms: [a.bbox, b.bbox], witness, meaning: 'chain_link_hypothesis_not_progression_law' }); }
  }
  if (graph.some(neighbors => neighbors.length > 2 || !neighbors.length)) return null;
  let ordered: R[];
  if (pythonTruthy(order)) {
    if (!setsEqual(new Set(rooms.map(r => key(r.bbox))), new Set(order!.map(key)))) return null;
    ordered = order!.map(box => rooms.find(r => pythonEqual(r.bbox, [...box]))!);
    const indices = order!.map(box => rooms.findIndex(r => pythonEqual(r.bbox, [...box])));
    const edge = (a: number, b: number): string => key([...new Set([a, b])].sort(numbers));
    const expected = new Set(indices.slice(1).map((j, i) => edge(indices[i]!, j))), actual = new Set(graph.flatMap((ns, i) => ns.map(j => edge(i, j))));
    if (!setsEqual(expected, actual)) return null;
  } else {
    if (graph[active[0]!]!.length !== 1) return null;
    const walk = [active[0]!];
    while (walk.length < rooms.length) {
      const nexts = graph[walk.at(-1)!]!.filter(j => !walk.includes(j)); if (nexts.length !== 1) return null; walk.push(nexts[0]!);
    }
    ordered = walk.map(i => rooms[i]!);
  }
  const current = ordered.findIndex(r => r.left.length), ar = ordered[current]!, activeButtons = buttons.every(b => b.border === ar.border); let quota: number | null = null;
  if (activeButtons) {
    const candidates = rects.filter(r => r.bbox[1] > Math.max(...rooms.map(q => q.bbox[3])) && r.bbox[3] < Math.min(...buttons.map(q => q.bbox[1])) && r.border === ar.border);
    if (candidates.length !== 1) return null;
    const q = candidates[0]!, [l, t, r, b] = q.bbox, runs: number[] = []; let xx = l + 1;
    const nonbase = (x: number): boolean => { for (let yy = t + 1; yy < b; yy++) if (rows[yy]![x] !== q.base) return true; return false; };
    while (xx < r) {
      if (!nonbase(xx)) { xx++; continue; }
      let end = xx; while (end + 1 < r && nonbase(end + 1)) end++;
      const vals = new Set(pixels(rows, xx, t + 1, end, b - 1)); if (vals.size !== 1) return null;
      runs.push([...vals][0]!); xx = end + 1;
    }
    quota = runs.filter(v => v === q.border).length; if (quota < 1) return null;
  }
  return { links, rooms: ordered, current, buttons, legend: lg, types, player_values: [...player].sort(numbers), enemy_values: [...enemy].sort(numbers),
    phase_hypothesis: activeButtons ? 'RECRUIT' : 'COMBAT', quota, order: ordered.map(r => r.bbox), signature: {
      room_shape: [ar.bbox[2] - ar.bbox[0] + 1, ar.bbox[3] - ar.bbox[1] + 1], grid_side: ar.grid.ys.length, grid_pitch: ar.grid.pitch, legend_pair_count: lg.pairs.length } };
}
