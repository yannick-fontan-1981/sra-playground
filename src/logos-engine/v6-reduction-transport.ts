/**
 * Native common_reduction_transport.py, source 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Repeated cells, reduction and movable support laws are measured hypotheses.
 * Only returned public pixels, current input candidates and acquired responses
 * enter this component; its finite route is not an authored game solution.
 */
import { symbolicDigest as digest, sha256Bytes } from './v6-hash.ts';
import { projection } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeExecution, NativePublicObservation, NativeRows } from './v6-native-types.ts';
import { retainNativeJson } from './v6-native-owned.ts';

type R = Record<string, any>;
export type ReductionPoint = [number, number];
export type ReductionModel = {
  unit: number; pitch: number; phase: ReductionPoint; floor: number; token: number;
  ring: number | null; rail: number | null; width: number; height: number;
};
export type ReductionScene = {
  floor: Set<string>; pegs: Set<string>; carriers: ReductionPoint[]; rails: Set<string>;
  edges: Set<string>; known_cells?: Set<string>;
};
export type ReductionState = [Set<string>, ReductionPoint[]];
export type ReductionOperation = ['jump', ReductionPoint, ReductionPoint] | ['move', ReductionPoint];
export interface ReductionSearchBounds {
  readonly maximumStates: number;
  readonly maximumFrontier: number;
}
export interface ReductionSearchCounters {
  readonly retainedStates: number;
  readonly frontierEntries: number;
  readonly peakFrontierEntries: number;
  readonly insertedEntries: number;
  readonly poppedEntries: number;
  readonly staleEntries: number;
  readonly expandedStates: number;
  readonly generatedTransitions: number;
}
export interface ReductionSearchResult {
  readonly status: 'found' | 'exhausted' | 'resource_bound';
  readonly path: ReductionOperation[] | null;
  readonly bound: 'maximum_states' | 'maximum_frontier' | 'deadline' | null;
  readonly bounds: ReductionSearchBounds;
  readonly counters: ReductionSearchCounters;
  readonly blockedInsertion: {
    readonly newState: boolean; readonly requiredStates: number; readonly requiredFrontierEntries: number; readonly cost: number;
  } | null;
}
export interface NativeReductionTransportOptions {
  /** Opt-in resource profile; the unconfigured constructor retains source search. */
  readonly boundedSearch?: ReductionSearchBounds;
}
export const REDUCTION_VECTORS: readonly ReductionPoint[] = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]] as ReductionPoint[]);
const key = (p: readonly number[]) => `${p[0]},${p[1]}`;
const point = (s: string): ReductionPoint => s.split(',').map(Number) as ReductionPoint;
const edge = (a: readonly number[], b: readonly number[]) => `${key(a)}>${key(b)}`;
const add = (a: readonly number[], b: readonly number[]): ReductionPoint => [a[0]! + b[0]!, a[1]! + b[1]!];
const compare = (a: readonly number[], b: readonly number[]) => a[0]! - b[0]! || a[1]! - b[1]!;
const sorted = (s: Set<string>): ReductionPoint[] => [...s].map(point).sort(compare);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const hasData = (command: R) => command.data && Object.keys(command.data).length > 0;
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
const countValue = (rows: NativeRows, x: number, y: number, size: number, value: number): number => {
  let count = 0; for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) if (rows[yy]![xx] === value) count++;
  return count;
};
const frequent = <T>(values: Iterable<T>): T | null => {
  const counts = new Map<T, number>(); for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let result: T | null = null, best = 0; for (const [value, count] of counts) if (count > best) { result = value; best = count; }
  return result;
};
function rowsHash(rows: NativeRows): string {
  const header = new TextEncoder().encode(`(${rows.length}, ${rows[0]?.length ?? 0})`);
  const bytes = new Uint8Array(header.length + rows.length * (rows[0]?.length ?? 0)); bytes.set(header);
  let offset = header.length; for (const row of rows) for (const value of row) bytes[offset++] = value;
  return sha256Bytes(bytes);
}

/** Exact source lattice admission, including first-observed Counter ties. */
export function reductionLayout(observation: R, rows: NativeRows): ReductionModel | null {
  const groups = new Map<string, { floor: number; unit: number; amount: number }>();
  for (const e of observation.entities as R[]) if (e.rectangular && e.bbox[2] - e.bbox[0] === e.bbox[3] - e.bbox[1] && e.area > 1) {
    const floor = e.palette_value, unit = e.bbox[2] - e.bbox[0] + 1, k = key([floor, unit]);
    const group = groups.get(k) ?? { floor, unit, amount: 0 }; group.amount++; groups.set(k, group);
  }
  const candidates: ReductionModel[] = [];
  for (const { floor, unit, amount } of groups.values()) {
    if (amount < 4) continue;
    const squares = (observation.entities as R[]).filter(e => e.palette_value === floor && e.area === unit * unit && e.rectangular);
    const axes = [0, 1].map(axis => [...new Set<number>(squares.map(e => e.position[axis]))].sort((a, b) => a - b));
    const gaps = axes.flatMap(values => values.slice(1).map((value, i) => value - values[i]!));
    if (!gaps.length) continue; const pitch = gaps.reduce(gcd);
    if (!(unit < pitch && pitch <= 2 * unit)) continue;
    const phase: ReductionPoint = [squares[0]!.position[0] % pitch, squares[0]!.position[1] % pitch];
    const tokens = (observation.entities as R[]).filter(e => e.bbox[2] - e.bbox[0] + 1 === unit && e.bbox[3] - e.bbox[1] + 1 === unit
      && unit * unit / 2 < e.area && e.area < unit * unit && [0, 1].every(axis => e.position[axis] % pitch === phase[axis]));
    const colors = new Set<number>(tokens.map(e => e.palette_value));
    if (colors.size !== 1 || tokens.length < 2) continue;
    const rings = (observation.entities as R[]).filter(e => e.bbox[2] - e.bbox[0] + 1 === unit + 2 && e.bbox[3] - e.bbox[1] + 1 === unit + 2
      && e.area === 4 * unit + 4 && [0, 1].every(axis => (e.position[axis] + 1) % pitch === phase[axis]));
    if (new Set(rings.map(e => e.palette_value)).size > 1) continue;
    const m: ReductionModel = { unit, pitch, phase, floor, token: [...colors][0]!, ring: rings.length ? rings[0]!.palette_value : null,
      rail: null, width: rows[0]!.length, height: rows.length };
    if (rings.length) {
      const samples: number[] = [];
      for (const e of rings) {
        const x = e.position[0] + 1, y = e.position[1] + 1;
        for (const [dx, dy] of REDUCTION_VECTORS) {
          const X = x + dx * pitch, Y = y + dy * pitch;
          if (X >= 0 && X + unit <= m.width && Y >= 1 && Y + unit <= m.height) {
            const center = rows[Y + Math.floor(unit / 2)]![X + Math.floor(unit / 2)]!, count = countValue(rows, X, Y, unit, center);
            if (unit <= count && count < unit * unit && center !== floor) samples.push(center);
          }
        }
      }
      if (!samples.length) continue; m.rail = frequent(samples);
    }
    candidates.push(m);
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function reductionScan(rows: NativeRows, m: ReductionModel): ReductionScene {
  const s = m.unit, pitch = m.pitch, [px, py] = m.phase;
  const floor = new Set<string>(), pegs = new Set<string>(), rails = new Set<string>(), carriers = new Set<string>();
  for (let y = py; y <= rows.length - s; y += pitch) {
    if (y < 1) continue;
    for (let x = px; x <= rows[0]!.length - s; x += pitch) {
      const q: ReductionPoint = [(x - px) / pitch, (y - py) / pitch], k = key(q);
      if (countValue(rows, x, y, s, m.token) > s * s / 2) pegs.add(k);
      const border = m.ring !== null && x > 0 && y > 0 && x + s < rows[0]!.length && y + s < rows.length
        && [[x - 1, y - 1], [x + s, y - 1], [x - 1, y + s], [x + s, y + s]].every(([X, Y]) => rows[Y!]![X!] === m.ring);
      if (border) { carriers.add(k); rails.add(k); }
      else if (countValue(rows, x, y, s, m.floor) >= s * s / 4) floor.add(k);
      if (m.rail !== null && rows[y + Math.floor(s / 2)]![x + Math.floor(s / 2)] === m.rail) rails.add(k);
    }
  }
  const edges = new Set<string>();
  for (const k of rails) {
    const p = point(k);
    for (const v of REDUCTION_VECTORS) {
      const q = add(p, v); if (!rails.has(key(q))) continue;
      const x = px + p[0] * pitch + Math.floor(s / 2), y = py + p[1] * pitch + Math.floor(s / 2);
      const permitted = new Set([m.rail, m.ring, m.token, rows[y]![x]!, rows[y + v[1] * pitch]![x + v[0] * pitch]!]);
      let allowed = true; for (let i = 0; i <= pitch; i++) if (!permitted.has(rows[y + v[1] * i]![x + v[0] * i]!)) { allowed = false; break; }
      if (allowed) edges.add(edge(p, q));
    }
  }
  return { floor, pegs, carriers: sorted(carriers), rails, edges };
}

export const reductionState = (scene: ReductionScene): ReductionState => [new Set(scene.pegs), scene.carriers.map(p => [...p])];
export const packReductionState = (current: ReductionState): [ReductionPoint[], ReductionPoint[]] => [sorted(current[0]), current[1].map(p => [...p])];
const stateKey = (current: ReductionState): string => JSON.stringify(packReductionState(current));
export function reductionMoved(current: ReductionState, vector: ReductionPoint, edges: Set<string>): ReductionState {
  const [pegs, carriers] = current, next = carriers.map(p => [...p] as ReductionPoint), tokens = new Set(pegs), oldCarriers = new Set(carriers.map(key));
  for (const [index, p] of carriers.entries()) {
    const q = add(p, vector), k = key(q);
    if (edges.has(edge(p, q)) && !oldCarriers.has(k) && !tokens.has(k)) {
      next[index] = q; if (tokens.has(key(p))) { tokens.delete(key(p)); tokens.add(k); }
    }
  }
  return [tokens, next.sort(compare)];
}
export function* reductionSuccessors(current: ReductionState, scene: ReductionScene): Generator<[ReductionState, ReductionOperation, number]> {
  const [pegs, carriers] = current, supports = new Set([...scene.floor, ...carriers.map(key)]);
  for (const p of sorted(pegs)) for (const vector of REDUCTION_VECTORS) {
    const mid = add(p, vector), end = add(mid, vector);
    if (pegs.has(key(mid)) && supports.has(key(end)) && !pegs.has(key(end))) {
      const tokens = new Set(pegs); tokens.delete(key(p)); tokens.delete(key(mid)); tokens.add(key(end));
      yield [[tokens, carriers], ['jump', p, end], 2];
    }
  }
  for (const vector of REDUCTION_VECTORS) {
    const next = reductionMoved(current, vector, scene.edges);
    if (stateKey(next) !== stateKey(current)) yield [next, ['move', [...vector]], 1];
  }
}

/** Source Dijkstra: primitive cost first and insertion serial second. */
export function reductionRoute(current: ReductionState, scene: ReductionScene, limit: number, reveal = false): ReductionOperation[] | null {
  type Entry = { cost: number; serial: number; state: ReductionState; key: string };
  const start = stateKey(current); let serial = 1;
  const heap: Entry[] = [{ cost: 0, serial: 0, state: current, key: start }], costs = new Map([[start, 0]]);
  const parents = new Map<string, { previous: string; action: ReductionOperation }>();
  const order = (a: Entry, b: Entry) => a.cost - b.cost || a.serial - b.serial;
  const push = (value: Entry) => {
    let i = heap.length; heap.push(value);
    while (i > 0) { const parent = Math.floor((i - 1) / 2); if (order(heap[parent]!, value) <= 0) break; heap[i] = heap[parent]!; i = parent; }
    heap[i] = value;
  };
  const pop = (): Entry => {
    const first = heap[0]!, last = heap.pop()!; if (!heap.length) return first;
    let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1;
      if (child + 1 < heap.length && order(heap[child + 1]!, heap[child]!) < 0) child++;
      if (order(last, heap[child]!) <= 0) break; heap[i] = heap[child]!; i = child;
    } heap[i] = last; return first;
  };
  while (heap.length) {
    const { cost, state: node, key: nodeKey } = pop(); if (costs.get(nodeKey) !== cost) continue;
    const frontier = node[1].some(p => node[0].has(key(p)) && REDUCTION_VECTORS.some(v => !scene.known_cells?.has(key(add(add(p, v), v)))));
    if (reveal ? frontier && nodeKey !== start : node[0].size === 1) {
      const result: ReductionOperation[] = []; let cursor = nodeKey;
      while (cursor !== start) { const parent = parents.get(cursor)!; result.push(parent.action); cursor = parent.previous; }
      return result.reverse();
    }
    if (cost >= limit) continue;
    for (const [following, action, weight] of reductionSuccessors(node, scene)) {
      const value = cost + weight, nextKey = stateKey(following);
      if (value <= limit && value < (costs.get(nextKey) ?? Infinity)) {
        costs.set(nextKey, value); parents.set(nextKey, { previous: nodeKey, action }); push({ cost: value, serial: serial++, state: following, key: nextKey });
      }
    }
  }
  return null;
}

function checkedReductionBounds(bounds: ReductionSearchBounds): ReductionSearchBounds {
  if (!bounds || !Number.isSafeInteger(bounds.maximumStates) || bounds.maximumStates < 1
    || !Number.isSafeInteger(bounds.maximumFrontier) || bounds.maximumFrontier < 1) throw new TypeError('Reduction search bounds must be positive exact integers');
  return Object.freeze({ maximumStates: bounds.maximumStates, maximumFrontier: bounds.maximumFrontier });
}

/**
 * Native bounded Dijkstra. Its queue, successors and cost/serial ordering are
 * the source order. A resource stop occurs before the map/parent/heap insertion
 * that would exceed a bound. One temporary successor can be inspected to decide
 * whether that insertion is new; it is never retained after a resource stop.
 */
function* boundedReductionSearch(current: ReductionState, scene: ReductionScene, limit: number,
  inputBounds: ReductionSearchBounds, reveal: boolean, control?: () => 'deadline' | null): Generator<void, ReductionSearchResult> {
  type Entry = { cost: number; serial: number; state: ReductionState; key: string };
  const bounds = checkedReductionBounds(inputBounds), heap: Entry[] = [], costs = new Map<string, number>();
  const parents = new Map<string, { previous: string; action: ReductionOperation }>();
  let serial = 1, insertedEntries = 0, poppedEntries = 0, staleEntries = 0, expandedStates = 0;
  let generatedTransitions = 0, peakFrontierEntries = 0, work = 0;
  const finish = (status: ReductionSearchResult['status'], path: ReductionOperation[] | null,
    bound: ReductionSearchResult['bound'] = null, blockedInsertion: ReductionSearchResult['blockedInsertion'] = null): ReductionSearchResult => ({
    status, path, bound, bounds, blockedInsertion,
    counters: { retainedStates: costs.size, frontierEntries: heap.length, peakFrontierEntries,
      insertedEntries, poppedEntries, staleEntries, expandedStates, generatedTransitions },
  });
  if (control?.() === 'deadline') return finish('resource_bound', null, 'deadline');
  const start = stateKey(current);
  heap.push({ cost: 0, serial: 0, state: current, key: start }); costs.set(start, 0);
  insertedEntries = peakFrontierEntries = 1;
  const order = (a: Entry, b: Entry) => a.cost - b.cost || a.serial - b.serial;
  const push = (value: Entry) => {
    let i = heap.length; heap.push(value);
    while (i > 0) { const parent = Math.floor((i - 1) / 2); if (order(heap[parent]!, value) <= 0) break; heap[i] = heap[parent]!; i = parent; }
    heap[i] = value; peakFrontierEntries = Math.max(peakFrontierEntries, heap.length); insertedEntries++;
  };
  const pop = (): Entry => {
    const first = heap[0]!, last = heap.pop()!; if (!heap.length) return first;
    let i = 0; while (i * 2 + 1 < heap.length) { let child = i * 2 + 1;
      if (child + 1 < heap.length && order(heap[child + 1]!, heap[child]!) < 0) child++;
      if (order(last, heap[child]!) <= 0) break; heap[i] = heap[child]!; i = child;
    } heap[i] = last; return first;
  };
  while (heap.length) {
    if (control?.() === 'deadline') return finish('resource_bound', null, 'deadline');
    const { cost, state: node, key: nodeKey } = pop(); poppedEntries++;
    if (++work % 128 === 0) { yield; if (control?.() === 'deadline') return finish('resource_bound', null, 'deadline'); }
    if (costs.get(nodeKey) !== cost) { staleEntries++; continue; }
    const frontier = node[1].some(p => node[0].has(key(p)) && REDUCTION_VECTORS.some(v => !scene.known_cells?.has(key(add(add(p, v), v)))));
    if (reveal ? frontier && nodeKey !== start : node[0].size === 1) {
      const path: ReductionOperation[] = []; let cursor = nodeKey;
      while (cursor !== start) { const parent = parents.get(cursor)!; path.push(parent.action); cursor = parent.previous; }
      return finish('found', path.reverse());
    }
    if (cost >= limit) continue;
    expandedStates++;
    for (const [following, action, weight] of reductionSuccessors(node, scene)) {
      generatedTransitions++;
      if (++work % 128 === 0) { yield; if (control?.() === 'deadline') return finish('resource_bound', null, 'deadline'); }
      const value = cost + weight, nextKey = stateKey(following);
      if (value <= limit && value < (costs.get(nextKey) ?? Infinity)) {
        const newState = !costs.has(nextKey), requiredStates = costs.size + Number(newState), requiredFrontierEntries = heap.length + 1;
        const blocked = requiredStates > bounds.maximumStates ? 'maximum_states'
          : requiredFrontierEntries > bounds.maximumFrontier ? 'maximum_frontier' : null;
        if (blocked) return finish('resource_bound', null, blocked, { newState, requiredStates, requiredFrontierEntries, cost: value });
        costs.set(nextKey, value); parents.set(nextKey, { previous: nodeKey, action });
        push({ cost: value, serial: serial++, state: following, key: nextKey });
      }
    }
  }
  return finish('exhausted', null);
}

/** Complete within the supplied primitive-cost limit, or explicitly unknown. */
export function boundedReductionRoute(current: ReductionState, scene: ReductionScene, limit: number,
  bounds: ReductionSearchBounds, reveal = false): ReductionSearchResult {
  const search = boundedReductionSearch(current, scene, limit, bounds, reveal);
  let result = search.next(); while (!result.done) result = search.next(); return result.value;
}

/** Cooperative scheduling changes neither insertion order nor physical action count. */
export async function boundedReductionRouteCooperative(current: ReductionState, scene: ReductionScene, limit: number,
  bounds: ReductionSearchBounds, reveal = false, execution?: NativeExecution): Promise<ReductionSearchResult> {
  const control = (): 'deadline' | null => {
    if (execution?.signal?.aborted) throw new DOMException('Reduction search aborted', 'AbortError');
    return execution?.deadlineMs !== undefined && (execution.now ?? performance.now.bind(performance))() >= execution.deadlineMs ? 'deadline' : null;
  };
  const search = boundedReductionSearch(current, scene, limit, bounds, reveal, control);
  let result = search.next();
  while (!result.done) { if (execution) await execution.yieldControl(); result = search.next(); }
  return result.value;
}

export function translatedReductionScene(scene: ReductionScene, offset: ReductionPoint): ReductionScene {
  const shift = (values: Set<string>) => new Set([...values].map(value => key(add(point(value), offset))));
  return { floor: shift(scene.floor), pegs: shift(scene.pegs), rails: shift(scene.rails), carriers: scene.carriers.map(p => add(p, offset)).sort(compare),
    edges: new Set([...scene.edges].map(value => { const [a, b] = value.split('>'); return edge(add(point(a!), offset), add(point(b!), offset)); })) };
}
export function reductionVisibleCells(m: ReductionModel, offset: ReductionPoint): Set<string> {
  const values = new Set<string>(), [px, py] = m.phase;
  for (let y = py; y <= m.height - m.unit; y += m.pitch) if (y >= 1)
    for (let x = px; x <= m.width - m.unit; x += m.pitch) values.add(key(add([(x - px) / m.pitch, (y - py) / m.pitch], offset)));
  return values;
}
export function mergeReductionScene(previous: ReductionScene | null, local: ReductionScene, m: ReductionModel, offset: ReductionPoint): ReductionScene {
  const seen = reductionVisibleCells(m, offset), next = translatedReductionScene(local, offset);
  if (previous === null) return { ...next, known_cells: seen };
  return { floor: new Set([...previous.floor, ...next.floor]), rails: new Set([...previous.rails, ...next.rails]), edges: new Set([...previous.edges, ...next.edges]),
    known_cells: new Set([...(previous.known_cells ?? []), ...seen]), pegs: new Set([...previous.pegs].filter(p => !seen.has(p)).concat([...next.pegs])),
    carriers: sorted(new Set(previous.carriers.map(key).filter(p => !seen.has(p)).concat(next.carriers.map(key)))) };
}
export function alignReductionScene(rows: NativeRows, _observation: R, m: ReductionModel, previous: ReductionScene, offset: ReductionPoint): [ReductionModel, ReductionPoint, ReductionScene] | null {
  const model = structuredClone(m), phases: string[] = [], unit = m.unit;
  for (let y = 1; y <= rows.length - unit; y++) for (let x = 0; x <= rows[0]!.length - unit; x++) {
    if (rows[y]![x] !== m.floor || rows[y - 1]![x] === m.floor || x > 0 && rows[y]![x - 1] === m.floor) continue;
    if (countValue(rows, x, y, unit, m.floor) === unit * unit) phases.push(key([x % m.pitch, y % m.pitch]));
  }
  const phase = frequent(phases); if (phase !== null) model.phase = point(phase);
  const local = reductionScan(rows, model), width = Math.floor(m.width / m.pitch), height = Math.floor(m.height / m.pitch);
  const ranked: { rank: ReductionPoint; candidate: ReductionPoint }[] = [];
  for (let dx = -width; dx <= width; dx++) for (let dy = -height; dy <= height; dy++) {
    const candidate = add(offset, [dx, dy]), seen = reductionVisibleCells(model, candidate);
    const actual = new Set([...local.floor].map(p => key(add(point(p), candidate)))), expected = new Set([...previous.floor].filter(p => seen.has(p)));
    let agreement = 0, mismatch = 0;
    for (const p of actual) { if (expected.has(p)) agreement++; else if (seen.has(p) && previous.known_cells?.has(p)) mismatch++; }
    for (const p of expected) if (!actual.has(p) && seen.has(p) && previous.known_cells?.has(p)) mismatch++;
    if (agreement >= Math.min(3, previous.floor.size)) ranked.push({ rank: [2 * mismatch - agreement, -agreement], candidate });
  }
  if (!ranked.length) return null; ranked.sort((a, b) => compare(a.rank, b.rank) || compare(a.candidate, b.candidate));
  const matches = ranked.filter(value => compare(value.rank, ranked[0]!.rank) === 0);
  if (matches.length !== 1) return null;
  const chosen = matches[0]!.candidate; return [model, chosen, mergeReductionScene(previous, local, model, chosen)];
}

function packScene(scene: ReductionScene | null): R | null {
  if (scene === null) return null;
  return { floor: sorted(scene.floor), pegs: sorted(scene.pegs), carriers: structuredClone(scene.carriers), rails: sorted(scene.rails),
    edges: [...scene.edges].map(value => value.split('>').map(point)).sort((a, b) => compare(a[0]!, b[0]!) || compare(a[1]!, b[1]!)),
    ...(scene.known_cells ? { known_cells: sorted(scene.known_cells) } : {}) };
}
const validPoint = (p: any): p is ReductionPoint => Array.isArray(p) && p.length === 2 && p.every(Number.isSafeInteger);
function unpackScene(value: R | null): ReductionScene | null {
  if (value === null) return null;
  if (!value || ['floor', 'pegs', 'carriers', 'rails'].some(name => !Array.isArray(value[name]) || !value[name].every(validPoint))
    || !Array.isArray(value.edges) || !value.edges.every((e: any) => Array.isArray(e) && e.length === 2 && e.every(validPoint))
    || value.known_cells !== undefined && (!Array.isArray(value.known_cells) || !value.known_cells.every(validPoint))) throw new TypeError('Invalid reduction scene');
  return { floor: new Set(value.floor.map(key)), pegs: new Set(value.pegs.map(key)), carriers: value.carriers.map((p: ReductionPoint) => [...p]), rails: new Set(value.rails.map(key)),
    edges: new Set(value.edges.map(([a, b]: ReductionPoint[]) => edge(a!, b!))), ...(value.known_cells ? { known_cells: new Set<string>(value.known_cells.map(key)) } : {}) };
}

/** Original single-event API; the common runtime owns its explicit list adapter. */
export class ReductionTransport {
  readonly id = 'reduction_transport'; readonly familyId = 'reduction_transport';
  private readonly boundedSearch: ReductionSearchBounds | null;
  private proposalRefusal: R | null = null;
  epoch: number | null = null; passed: R[] = []; events: R[] = [];
  model: ReductionModel | null | undefined; motion: Record<string, ReductionPoint> = {}; tested = new Map<string, [string, [ReductionPoint[], ReductionPoint[]]]>();
  verified = new Set<string>(); refs: Record<string, string> = {}; selected: ReductionPoint | null = null; retired = false; offset: ReductionPoint = [0, 0]; scene: ReductionScene | null = null;
  constructor(options: NativeReductionTransportOptions = {}) {
    this.boundedSearch = options.boundedSearch ? checkedReductionBounds(options.boundedSearch) : null;
  }
  state(): R {
    const result: R = { format: 'native.reduction_transport.v1', epoch: this.epoch, passed: this.passed, events: this.events };
    if (this.model !== undefined) Object.assign(result, { model: this.model, motion: this.motion, tested: [...this.tested.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      verified: [...this.verified].sort(), refs: this.refs, selected: this.selected, retired: this.retired, offset: this.offset, scene: packScene(this.scene) });
    return structuredClone(result);
  }
  restore(snapshot: R): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.reduction_transport.v1' || !(value.epoch === null || Number.isSafeInteger(value.epoch))
      || !Array.isArray(value.passed) || !Array.isArray(value.events)) throw new TypeError('Incompatible reduction-transport state');
    let scene: ReductionScene | null = null;
    if (Object.hasOwn(value, 'model')) {
      const m = value.model;
      if (m !== null && (!m || ![m.unit, m.pitch, m.floor, m.token, m.width, m.height].every(Number.isSafeInteger)
        || m.unit <= 0 || m.pitch <= m.unit || m.pitch > 2 * m.unit || m.width < m.unit || m.height < m.unit || !validPoint(m.phase)
        || m.phase.some((x: number) => x < 0 || x >= m.pitch) || ![m.ring, m.rail].every(x => x === null || Number.isSafeInteger(x)))) throw new TypeError('Invalid reduction geometry');
      if (!value.motion || Object.values(value.motion).some(v => !validPoint(v)) || !Array.isArray(value.tested)
        || !value.tested.every((item: any) => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string'
          && Array.isArray(item[1]) && item[1].length === 2 && item[1].every((cells: any) => Array.isArray(cells) && cells.every(validPoint)))
        || !Array.isArray(value.verified) || value.verified.some((x: unknown) => typeof x !== 'string') || !value.refs
        || Object.values(value.refs).some(x => typeof x !== 'string') || !validPoint(value.offset)
        || !(value.selected === null || validPoint(value.selected)) || typeof value.retired !== 'boolean') throw new TypeError('Invalid reduction retained evidence');
      scene = unpackScene(value.scene);
    }
    this.epoch = value.epoch; this.passed = value.passed; this.events = value.events; this.model = value.model;
    this.motion = value.motion ?? {}; this.tested = new Map((value.tested ?? []).map((item: any) => [JSON.stringify(item), item]));
    this.verified = new Set(value.verified ?? []); this.refs = value.refs ?? {}; this.selected = value.selected ?? null;
    this.retired = value.retired ?? false; this.offset = value.offset ?? [0, 0]; this.scene = scene;
    this.proposalRefusal = null;
  }
  /** A bounded search refusal is diagnostic, never acquired state or an action. */
  currentProposalRefusal(observation: R): R | null {
    const refusal = this.proposalRefusal;
    if (!refusal || ['observation_ref', 'level_epoch', 'frame_hash'].some(field => refusal[field] !== observation[field])
      || refusal.owner_state_ref !== `reduction_owner:${digest(this.state())}`) return null;
    return structuredClone(refusal);
  }
  propose(o: R, rows: NativeRows, inputs: readonly R[], remaining: number, execution?: NativeExecution): R | null | Promise<R | null> {
    this.proposalRefusal = null;
    if (this.boundedSearch && execution?.signal?.aborted) return Promise.reject(new DOMException('Reduction search aborted', 'AbortError'));
    if (!o.available_action_refs.includes('ACTION6')) return null;
    if (this.epoch !== o.level_epoch) {
      this.epoch = o.level_epoch; this.model = reductionLayout(o, rows); this.motion = {}; this.tested.clear(); this.verified.clear(); this.refs = {};
      this.selected = null; this.retired = false; this.offset = [0, 0]; this.scene = null;
    }
    if (!this.model || this.retired) return null;
    const scene = mergeReductionScene(this.scene, reductionScan(rows, this.model), this.model, this.offset), current = reductionState(scene);
    if (this.boundedSearch) return this.proposeBounded(o, rows, inputs, remaining, scene, current, execution);
    this.scene = scene;
    let path = reductionRoute(current, scene, remaining);
    const reveal = path === null; if (reveal) path = reductionRoute(current, scene, remaining, true);
    return this.packageProposal(o, rows, inputs, remaining, scene, current, path, reveal);
  }
  private async proposeBounded(o: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    scene: ReductionScene, current: ReductionState, execution?: NativeExecution): Promise<R | null> {
    const ownerStateRef = `reduction_owner:${digest(this.state())}`;
    const goal = await boundedReductionRouteCooperative(current, scene, remaining, this.boundedSearch!, false, execution);
    let result = goal, reveal = false, searchesStarted = 1;
    // A cut off goal search is unknown. It must not spend a second budget on
    // reveal, claim exhaustion or retain a partial route as a continuation.
    if (goal.status === 'exhausted') {
      reveal = true; searchesStarted++;
      result = await boundedReductionRouteCooperative(current, scene, remaining, this.boundedSearch!, true, execution);
    }
    if (ownerStateRef !== `reduction_owner:${digest(this.state())}`) throw new Error('Reduction memory changed during cooperative search');
    if (result.status === 'resource_bound') {
      this.proposalRefusal = retainNativeJson({
        schema: 'logos-engine.native.bounded-search-refusal.v1', rule: 'native.bounded_reduction_search',
        provider: this.familyId, observation_ref: o.observation_ref, level_epoch: o.level_epoch, frame_hash: o.frame_hash,
        model: structuredClone(this.model), model_ref: `reduction_model:${digest(this.model)}`,
        state_ref: `reduction_state:${digest(packReductionState(current))}`, scene_ref: `reduction_scene:${digest(packScene(scene))}`,
        owner_state_ref: ownerStateRef, counters: result.counters, bounds: result.bounds, reached_bound: result.bound,
        blocked_insertion: result.blockedInsertion, search_phase: reveal ? 'reveal' : 'goal', searches_started: searchesStarted,
        completed_searches: reveal ? [{ phase: 'goal', status: goal.status, counters: goal.counters }] : [],
        primitive_cost_limit: remaining, status: 'unknown', search_status: 'resource_bound', release_authority: false,
        scope: 'The declared native resource bound stopped this current conditional search; neither impossibility nor an effect law was established.',
      });
      return null;
    }
    this.scene = scene;
    return this.packageProposal(o, rows, inputs, remaining, scene, current, result.path, reveal);
  }
  private packageProposal(o: R, rows: NativeRows, inputs: readonly R[], remaining: number,
    scene: ReductionScene, current: ReductionState, path: ReductionOperation[] | null, reveal: boolean): R | null {
    if (!path?.length) return null;
    let steps: R[] = [], hypothetical = current;
    const plain = inputs.filter(a => !hasData(a) && a.action_ref !== 'ACTION7').map(a => a.action_ref as string);
    for (const operation of path) {
      if (operation[0] === 'move') {
        const vector = operation[1]; let k = Object.keys(this.motion).find(k => same(this.motion[k], vector));
        if (k === undefined) {
          k = plain.find(k => !Object.hasOwn(this.motion, k) && !this.tested.has(JSON.stringify([k, packReductionState(current)])));
          if (k === undefined) break;
          steps.push({ action: { action_ref: k }, mode: 'calibrate', current: packReductionState(hypothetical), expected_after: null, vector_hypothesis: vector }); break;
        }
        const following = reductionMoved(hypothetical, vector, scene.edges);
        steps.push({ action: { action_ref: k }, mode: 'move', current: packReductionState(hypothetical), expected_after: packReductionState(following) }); hypothetical = following;
      } else {
        const [, start, end] = operation;
        for (const [mode, cell] of [['select', start], ['jump', end]] as const) {
          if (mode === 'select' && same(this.selected, start) && !steps.length) continue;
          const s = this.model!.unit, pitch = this.model!.pitch, [px, py] = this.model!.phase;
          const x = px + (cell[0] - this.offset[0]) * pitch, y = py + (cell[1] - this.offset[1]) * pitch;
          const command = inputs.find(a => hasData(a) && x <= a.data.x && a.data.x < x + s && y <= a.data.y && a.data.y < y + s);
          if (!command) break;
          let following = hypothetical;
          if (mode === 'jump') {
            const mid: ReductionPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2], pegs = new Set(hypothetical[0]);
            pegs.delete(key(start)); pegs.delete(key(mid)); pegs.add(key(end)); following = [pegs, hypothetical[1]];
          }
          const box = [x, y, x + s - 1, y + s - 1];
          steps.push({ action: command, mode, cell, current: packReductionState(hypothetical), expected_after: packReductionState(following), box,
            point_digest: rowsHash(projection(rows, box)) }); hypothetical = following;
          break; // The next addressed patch is rebound from the actual response.
        }
        break;
      }
      if (steps.length >= Math.min(16, remaining)) break;
    }
    steps = steps.slice(0, Math.min(16, remaining)); if (!steps.length) return null;
    for (const [index, step] of steps.entries()) step.expected_before = { level_epoch: this.epoch, frame_hash: index === 0 ? o.frame_hash : null };
    const refs = [o.observation_ref, ...Object.values(this.refs)], actions = steps.map(s => s.action), focus = 'C_reduction_' + digest([refs, actions]).slice(0, 16);
    const why = 'Test a departure-intermediate-arrival reduction while preserving a continuation through fixed and movable observed supports.';
    const info = { population: current[0].size, carriers: current[1].length, continuation_operations: path.length, control_vectors: this.motion, reveal_frontier: reveal,
      camera_offset: this.offset, goal_hypothesis: 'one remaining member of the repeated population', scope: 'Public visible field; hidden regions and causal sufficiency remain unknown.' };
    const facts = { measured_repeated_cells: true, ternary_reduction_hypothesis: true, bounded_continuation_found: true };
    return { status: 'proposed', kind: 'supported_ternary_reduction', reduction_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: o.observation_ref, level_epoch: this.epoch, levels_completed: o.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts,
        evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(p: R, domain: ObservedInputDomain): void {
    const frame = p.steps[0].expected_before.frame_hash;
    for (const step of p.steps as R[]) if (hasData(step.action)) {
      const d = step.action.data, binding = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${d.x},${d.y}`);
      if (!binding) throw new TypeError('Reduction point absent from current measured input domain');
      step.point_binding = { ...structuredClone(binding), projection_bbox: [...step.box], projected_rows_digest: step.point_digest };
    }
  }
  before(p: R, i: number, publicPacket: NativePublicObservation, o: R): R {
    const step = p.steps[i], b = p.binding;
    const current = packReductionState(reductionState(mergeReductionScene(this.scene, reductionScan(publicPacket.frame_rows, this.model!), this.model!, this.offset)));
    const ok = publicPacket.level === b.level_epoch && publicPacket.levels_completed === b.levels_completed && (i !== 0 || o.observation_ref === b.observation_ref)
      && publicPacket.available_action_refs.includes(step.action.action_ref) && same(current, step.current);
    return { admitted: Boolean(ok), reason: 'bind_population_supports_and_epoch' };
  }
  after(p: R, i: number, before: R, after: R, first: NativeRows, second: NativeRows): R {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed]))
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const step = p.steps[i], pred = step.expected_after, aligned = alignReductionScene(second, after, this.model!, this.scene!, this.offset);
    let matched: boolean | null = pred && aligned ? same(packReductionState(reductionState(aligned[2])), pred) : null;
    if (step.mode === 'select' && matched) matched = rowsHash(first) !== rowsHash(second);
    const cameraChanged = Boolean(aligned && (!same(aligned[1], this.offset) || !same(aligned[0].phase, this.model!.phase)));
    return { matched, seal_prefix: matched !== true || cameraChanged || i + 1 === p.steps.length,
      reason: cameraChanged ? 'camera_reconciled' : 'compare_frozen_population_and_supports' };
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, p: R, i: number, _frames?: readonly NativeRows[]): R {
    this.proposalRefusal = null;
    const step = p.steps[i], ref = after.observation_ref, mode = step.mode;
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { status: 'official_boundary', ref }; }
    const old = reductionState(this.scene!), aligned = alignReductionScene(second, after, this.model!, this.scene!, this.offset);
    if (aligned === null) { this.retired = true; const event = { ref, status: 'camera_registration_ambiguous' }; this.events.push(event); return event; }
    const [newModel, newOffset, newScene] = aligned, next = reductionState(newScene);
    const event: R = { ref, mode, status: 'observed_response', before_population: old[0].size, after_population: next[0].size, camera_offset: newOffset };
    if (mode === 'calibrate') {
      const k = command.action_ref, trial: [string, [ReductionPoint[], ReductionPoint[]]] = [k, packReductionState(old)]; this.tested.set(JSON.stringify(trial), trial);
      const fits = REDUCTION_VECTORS.filter(v => stateKey(reductionMoved(old, v, this.scene!.edges)) === stateKey(next) && stateKey(old) !== stateKey(next));
      if (fits.length === 1) { this.motion[k] = [...fits[0]!]; this.refs[k] = ref; } event.compatible_control_vectors = fits.map(v => [...v]);
    } else {
      const matched = this.after(p, i, before, after, first, second).matched;
      if (matched) { this.verified.add(mode); this.refs[mode] = ref; this.selected = mode === 'select' ? [...step.cell] as ReductionPoint : null; }
      else { this.selected = null; this.retired = same(newOffset, this.offset) && same(newModel.phase, this.model!.phase); }
      event.matched = matched;
    }
    this.model = newModel; this.offset = newOffset; this.scene = newScene; this.events.push(event); return event;
  }
}
