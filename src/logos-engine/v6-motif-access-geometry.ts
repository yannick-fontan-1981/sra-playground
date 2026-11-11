/**
 * Public geometry of common_motif_access.py at pinned V6
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Search enumerates conditional supported poses, never observed physical access.
 */
import { geometricComponents, projection, validateRows } from './v6-native-observer.ts';
import { framedPatterns } from './v6-geometric-scene.ts';
import { sha256Bytes } from './v6-hash.ts';
import type { NativeExecution, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export type MotifPoint = [number, number];
export type MotifBox = [number, number, number, number];
export type MotifBodyState = [MotifPoint, number];
export interface MotifBody { position: MotifPoint; size: number; colors: number[]; box: MotifBox }
export interface MotifCard { mask: number[]; box: MotifBox }
export interface MotifGrid {
  points: MotifPoint[]; size: number; commands: R[]; cards: MotifCard[]; base: number[]; n: number;
}
export type MotifMotion = Record<string, MotifPoint>;
/** The JSON tuple key is [position, action_ref, footprint size]. */
export type MotifBlocked = Map<string, string>;
export interface MotifPath { position: MotifPoint; last: string | null; path: string[] }
export interface MotifSearchBounds { readonly maximumStates: number; readonly maximumFrontier: number }
export interface MotifSearchCounters {
  readonly retainedStates: number; readonly frontierEntries: number; readonly peakFrontierEntries: number;
  readonly insertedEntries: number; readonly poppedEntries: number; readonly expandedStates: number;
  readonly generatedTransitions: number;
}
export interface MotifSearchResult {
  readonly status: 'complete' | 'resource_bound';
  readonly paths: MotifPath[] | null;
  readonly bound: 'maximum_states' | 'maximum_frontier' | 'deadline' | null;
  readonly bounds: MotifSearchBounds | null;
  readonly counters: MotifSearchCounters;
  readonly blockedInsertion: { requiredStates: number; requiredFrontierEntries: number } | null;
}
export const MOTIF_ACCESS_NATIVE_SEARCH_BOUNDS: Readonly<MotifSearchBounds> =
  Object.freeze({ maximumStates: 8192, maximumFrontier: 16384 });

export function checkedMotifBounds(bounds: MotifSearchBounds): MotifSearchBounds {
  if (!bounds || !Number.isSafeInteger(bounds.maximumStates) || bounds.maximumStates < 1
    || !Number.isSafeInteger(bounds.maximumFrontier) || bounds.maximumFrontier < 1) {
    throw new TypeError('Motif search requires positive safe integer state and frontier bounds');
  }
  return Object.freeze({ maximumStates: bounds.maximumStates, maximumFrontier: bounds.maximumFrontier });
}
export const motifTupleKey = (value: unknown): string => JSON.stringify(value);
const hasData = (command: R): boolean => Boolean(command.data && Object.keys(command.data).length);
const cloneBox = (box: readonly number[]): MotifBox => [box[0]!, box[1]!, box[2]!, box[3]!];
const sameColors = (a: readonly number[], b: readonly number[]): boolean => {
  const left = new Set(a), right = new Set(b);
  return left.size === right.size && [...left].every(value => right.has(value));
};
/** Same NumPy uint8 shape prefix and C-order bytes as rows_digest. */
export function motifRowsDigest(rows: NativeRows): string {
  const width = rows[0]?.length ?? 0;
  if (rows.some(row => row.length !== width)) throw new TypeError('Motif projection must be rectangular');
  const prefix = new TextEncoder().encode(`(${rows.length}, ${width})`);
  const bytes = new Uint8Array(prefix.length + rows.length * width); bytes.set(prefix);
  let offset = prefix.length;
  for (const row of rows) for (const value of row) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 255) throw new TypeError('Motif palette outside uint8 domain');
    bytes[offset++] = value;
  }
  return sha256Bytes(bytes);
}

export function motifLattice(o: R, rows: NativeRows, inputs: readonly R[]): MotifGrid | null {
  const bySize = new Map<number, R[]>();
  for (const entity of o.entities as R[]) {
    const [l, t, r, b] = entity.bbox;
    if (entity.rectangular && r - l === b - t && r > l) {
      const group = bySize.get(r - l + 1) ?? []; group.push(entity); bySize.set(r - l + 1, group);
    }
  }
  const fields: MotifGrid[] = [];
  let patterns: ReturnType<typeof framedPatterns> | undefined;
  for (const [size, group] of bySize) {
    const positions = new Map<string, MotifPoint>();
    for (const entity of group) {
      const point: MotifPoint = [entity.bbox[0], entity.bbox[1]];
      positions.set(motifTupleKey(point), point);
    }
    const ys = [...new Set([...positions.values()].map(point => point[1]))].sort((a, b) => a - b);
    for (const y of ys) {
      const row = [...positions.values()].filter(point => point[1] === y).map(point => point[0]).sort((a, b) => a - b);
      if (row.length < 2 || new Set(row.slice(1).map((x, i) => x - row[i]!)).size !== 1) continue;
      const pitch = row[1]! - row[0]!, n = row.length;
      const points: MotifPoint[] = [];
      for (let j = 0; j < n; j++) for (const x of row) points.push([x, y + j * pitch]);
      if (!points.every(point => positions.has(motifTupleKey(point)))) continue;
      const commands: R[] = [];
      for (const [x, Y] of points) {
        const command = inputs.find(c => hasData(c) && x <= c.data.x && c.data.x < x + size && Y <= c.data.y && c.data.y < Y + size);
        if (!command) break;
        commands.push(structuredClone(command));
      }
      if (commands.length !== points.length) continue;
      patterns ??= framedPatterns(rows, geometricComponents(rows));
      const cards: MotifCard[] = [];
      for (const pattern of patterns) {
        const [l, t, r, b] = pattern.bbox, w = r - l + 1, h = b - t + 1;
        if (points.some(([x, Y]) => l <= x && x <= r && t <= Y && Y <= b)) continue;
        const islands = (o.entities as R[]).filter(e => e.palette_value === pattern.color && e.rectangular
          && l <= e.bbox[0] && e.bbox[0] <= e.bbox[2] && e.bbox[2] <= r
          && t <= e.bbox[1] && e.bbox[1] <= e.bbox[3] && e.bbox[3] <= b);
        if (islands.length < 2) continue;
        const dimensions = new Map<string, MotifPoint>();
        for (const e of islands) {
          const value: MotifPoint = [e.bbox[2] - e.bbox[0] + 1, e.bbox[3] - e.bbox[1] + 1];
          dimensions.set(motifTupleKey(value), value);
        }
        if (dimensions.size !== 1) continue;
        const [sw, sh] = [...dimensions.values()][0]!, gx = (w - sw * n) / (n - 1), gy = (h - sh * n) / (n - 1);
        if (gx < 0 || gy < 0 || !Number.isInteger(gx) || !Number.isInteger(gy)) continue;
        const marks: number[] = [];
        for (const e of islands) {
          const [X, Y] = e.position, ix = (X - l) / (sw + gx), iy = (Y - t) / (sh + gy);
          if (!Number.isInteger(ix) || !Number.isInteger(iy) || ix < 0 || ix >= n || iy < 0 || iy >= n) break;
          marks.push(iy * n + ix);
        }
        if (marks.length === islands.length) cards.push({ mask: marks.sort((a, b) => a - b), box: cloneBox(pattern.bbox) });
      }
      if (cards.length) fields.push({ points, size, commands, cards, base: points.map(([x, Y]) => rows[Y]![x]!), n });
    }
  }
  return fields.length === 1 ? fields[0]! : null;
}

export function motifBody(rows: NativeRows, uiTop: number, colors: readonly number[] | null = null,
  expected: MotifBodyState | null = null): MotifBody | null {
  if (expected !== null && colors?.length) {
    const [[x, y], size] = expected;
    if (size % 2 === 0 && Math.min(x, y) >= 0 && x + size <= rows[0]!.length && y + size <= uiTop) {
      for (const vertical of [true, false]) {
        const first = rows[y]![x]!, second = vertical ? rows[y]![x + size / 2]! : rows[y + size / 2]![x]!;
        let matched = sameColors([first, second], colors);
        for (let yy = 0; matched && yy < size; yy++) for (let xx = 0; xx < size; xx++) {
          if (rows[y + yy]![x + xx] !== ((vertical ? xx : yy) < size / 2 ? first : second)) { matched = false; break; }
        }
        if (matched) return { position: [x, y], size, colors: [...colors], box: [x, y, x + size - 1, y + size - 1] };
      }
    }
  }
  const parts = geometricComponents(rows).filter(part => part.bbox[3] < uiTop && part.rectangular), options: MotifBody[] = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const p = parts[i]!, q = parts[j]!;
    if (p.color === q.color || p.area !== q.area || colors?.length && !sameColors(colors, [p.color, q.color])) continue;
    const a = p.bbox, b = q.bbox, l = Math.min(a[0], b[0]), t = Math.min(a[1], b[1]), r = Math.max(a[2], b[2]), bot = Math.max(a[3], b[3]);
    if (r - l !== bot - t || (r - l + 1) * (bot - t + 1) !== p.area + q.area) continue;
    options.push({ position: [l, t], size: r - l + 1, colors: [p.color, q.color].sort((x, y) => x - y), box: [l, t, r, bot] });
  }
  return options.length === 1 ? options[0]! : null;
}

export function motifTarget(rows: NativeRows, uiTop: number, colors: readonly number[]): MotifBox | null {
  const found: MotifBox[] = [];
  for (const pattern of framedPatterns(rows, geometricComponents(rows))) {
    const [l, t, r, b] = pattern.bbox;
    if (b >= uiTop || !colors.includes(pattern.color)) continue;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, count = 0;
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]![x] === pattern.color) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); count++;
    }
    if (count && count === (x1 - x0 + 1) * (y1 - y0 + 1)) found.push([x0, y0, x1, y1]);
  }
  return found.length === 1 ? found[0]! : null;
}

/** The original breadth-first insertion order includes the last measured input. */
function* searchMotifPaths(rows: NativeRows, body: MotifBody, motion: MotifMotion, uiTop: number,
  blocked: MotifBlocked, bounds: MotifSearchBounds | null, control?: () => 'deadline' | null): Generator<void, MotifSearchResult> {
  validateRows(rows);
  const counts = new Map<number, number>();
  for (const row of rows.slice(0, uiTop)) for (const color of row) counts.set(color, (counts.get(color) ?? 0) + 1);
  let background: number | undefined, largest = 0;
  for (const [color, count] of counts) if (count > largest) { largest = count; background = color; }
  if (background === undefined) throw new RangeError('Motif support field is empty');
  const known = new Set<string>(), pending: MotifPath[] = [];
  let head = 0, peak = 0, expanded = 0, generated = 0, work = 0;
  const finish = (status: MotifSearchResult['status'], bound: MotifSearchResult['bound'] = null,
    blockedInsertion: MotifSearchResult['blockedInsertion'] = null): MotifSearchResult => ({
    status, paths: status === 'complete' ? pending : null, bound, bounds,
    counters: { retainedStates: known.size, frontierEntries: pending.length - head, peakFrontierEntries: peak,
      insertedEntries: pending.length, poppedEntries: head, expandedStates: expanded, generatedTransitions: generated }, blockedInsertion,
  });
  if (control?.() === 'deadline') return finish('resource_bound', 'deadline');
  const first: MotifPath = { position: [...body.position], last: null, path: [] };
  known.add(motifTupleKey([first.position, null])); pending.push(first); peak = 1;
  while (head < pending.length) {
    if (control?.() === 'deadline') return finish('resource_bound', 'deadline');
    const current = pending[head++]!; expanded++;
    for (const [key, delta] of Object.entries(motion)) {
      generated++;
      if (++work % 128 === 0) { yield; if (control?.() === 'deadline') return finish('resource_bound', 'deadline'); }
      const next: MotifPoint = [current.position[0] + delta[0], current.position[1] + delta[1]], id = motifTupleKey([next, key]), size = body.size;
      if (known.has(id) || Math.min(...next) < 0 || next[0] + size > rows[0]!.length || next[1] + size > uiTop) continue;
      const box: MotifBox = [next[0], next[1], next[0] + size - 1, next[1] + size - 1];
      const refusal = blocked.get(motifTupleKey([current.position, key, size]));
      if (refusal !== undefined && motifRowsDigest(projection(rows, box)) === refusal) continue;
      let supported = true;
      for (let y = next[1]; supported && y < next[1] + size; y++) for (let x = next[0]; x < next[0] + size; x++) {
        if (rows[y]![x] === background) { supported = false; break; }
      }
      if (!supported) continue;
      const requiredStates = known.size + 1, requiredFrontierEntries = pending.length - head + 1;
      const reached = bounds && (requiredStates > bounds.maximumStates ? 'maximum_states'
        : requiredFrontierEntries > bounds.maximumFrontier ? 'maximum_frontier' : null);
      if (reached) return finish('resource_bound', reached, { requiredStates, requiredFrontierEntries });
      known.add(id); pending.push({ position: next, last: key, path: [...current.path, key] });
      peak = Math.max(peak, pending.length - head);
    }
  }
  return finish('complete');
}

export function motifPaths(rows: NativeRows, body: MotifBody, motion: MotifMotion, uiTop: number,
  blocked: MotifBlocked = new Map()): MotifPath[] {
  const search = searchMotifPaths(rows, body, motion, uiTop, blocked, null);
  let result = search.next(); while (!result.done) result = search.next();
  return result.value.paths!;
}
export function boundedMotifPaths(rows: NativeRows, body: MotifBody, motion: MotifMotion, uiTop: number,
  blocked: MotifBlocked, bounds: MotifSearchBounds): MotifSearchResult {
  const search = searchMotifPaths(rows, body, motion, uiTop, blocked, checkedMotifBounds(bounds));
  let result = search.next(); while (!result.done) result = search.next();
  return result.value;
}
export async function boundedMotifPathsCooperative(rows: NativeRows, body: MotifBody, motion: MotifMotion, uiTop: number,
  blocked: MotifBlocked, bounds: MotifSearchBounds, execution?: NativeExecution): Promise<MotifSearchResult> {
  const control = (): 'deadline' | null => {
    if (execution?.signal?.aborted) throw new DOMException('Motif search aborted', 'AbortError');
    return execution?.deadlineMs !== undefined && (execution.now ?? performance.now.bind(performance))() >= execution.deadlineMs ? 'deadline' : null;
  };
  const search = searchMotifPaths(rows, body, motion, uiTop, blocked, checkedMotifBounds(bounds), control);
  let result = search.next();
  while (!result.done) { if (execution) await execution.yieldControl(); result = search.next(); }
  return result.value;
}
export function motifRouteFromPaths(paths: readonly MotifPath[], size: number, goal: MotifBox): string[] | null {
  let found: string[] | null = null;
  for (const item of paths) if (goal[0] <= item.position[0] && goal[1] <= item.position[1]
    && item.position[0] + size - 1 <= goal[2] && item.position[1] + size - 1 <= goal[3]
    && (found === null || item.path.length < found.length)) found = item.path;
  return found === null ? null : [...found];
}
export function motifRoute(rows: NativeRows, body: MotifBody, goal: MotifBox | null, motion: MotifMotion,
  uiTop: number, blocked: MotifBlocked = new Map()): string[] | null {
  return goal && Object.keys(motion).length ? motifRouteFromPaths(motifPaths(rows, body, motion, uiTop, blocked), body.size, goal) : null;
}
