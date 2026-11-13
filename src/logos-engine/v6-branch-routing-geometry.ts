/** Geometry and complete Cartesian enumeration from common_branch_routing.py.
 * Source: V6 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 * Native search bounds are explicit extensions, never evidence of impossibility.
 */
import { projection, validateRows } from './v6-native-observer.ts';
import type { NativeExecution, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export type BranchPoint = [number, number];
export type BranchBox = [number, number, number, number];
export type BranchState = [BranchPoint[], number];
export interface BranchBar { position: BranchPoint; length: number; hue: number }
export interface BranchModel {
  axis: 0 | 1; tangent: 0 | 1; sign: 1 | -1; unit: number;
  goals: number[]; sources: number[]; bars: BranchBar[]; active: number;
  highlight: number; order: number[]; limit: number; goal_boxes: BranchBox[];
}
export interface BranchSearchBounds {
  readonly maximumIdentityAssignments: number;
  readonly maximumPlacements: number;
  readonly yieldInterval: number;
}
export const BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS: Readonly<BranchSearchBounds> = Object.freeze({
  maximumIdentityAssignments: 16_384, maximumPlacements: 65_536, yieldInterval: 128,
});
export function checkedBranchBounds(value: Partial<BranchSearchBounds>): BranchSearchBounds {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid BranchRouting search bounds');
  const result = { ...BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS };
  for (const [key, count] of Object.entries(value)) {
    const name = key as keyof BranchSearchBounds;
    if (!Object.hasOwn(result, name) || !Number.isSafeInteger(count)
      || count < 1 || count > result[name]) {
      throw new TypeError('Invalid or enlarged BranchRouting search bound: ' + key);
    }
    result[name] = count;
  }
  return Object.freeze(result);
}
export type BranchSearchPhase = 'identity' | 'placements';
export class BranchRoutingIncomplete extends Error {
  readonly phase: BranchSearchPhase;
  readonly cause: 'maximum_identity_assignments' | 'maximum_placements' | 'deadline' | 'aborted';
  readonly examined: number;
  readonly bounds: BranchSearchBounds;
  constructor(phase: BranchSearchPhase, cause: BranchRoutingIncomplete['cause'], examined: number, bounds: BranchSearchBounds) {
    super('BranchRouting enumeration incomplete: ' + cause);
    this.name = 'BranchRoutingIncomplete'; this.phase = phase; this.cause = cause; this.examined = examined; this.bounds = bounds;
  }
}
class Work {
  examined = 0;
  readonly phase: BranchSearchPhase;
  readonly bounds: BranchSearchBounds | null;
  readonly execution: NativeExecution | undefined;
  constructor(phase: BranchSearchPhase, bounds: BranchSearchBounds | null, execution?: NativeExecution) {
    this.phase = phase; this.bounds = bounds; this.execution = execution;
    if (execution?.deadlineMs !== undefined && !Number.isFinite(execution.deadlineMs)) throw new TypeError('Invalid BranchRouting deadline');
  }
  check(): void {
    if (!this.bounds) return;
    if (this.execution?.signal?.aborted) throw new BranchRoutingIncomplete(this.phase, 'aborted', this.examined, this.bounds);
    if (this.execution?.deadlineMs !== undefined) {
      const now = (this.execution.now ?? (() => performance.now()))();
      if (!Number.isFinite(now)) throw new TypeError('BranchRouting clock must be finite');
      if (now >= this.execution.deadlineMs) throw new BranchRoutingIncomplete(this.phase, 'deadline', this.examined, this.bounds);
    }
  }
  take(): void {
    this.check();
    const limit = this.phase === 'identity' ? this.bounds?.maximumIdentityAssignments : this.bounds?.maximumPlacements;
    if (limit !== undefined && this.examined >= limit) {
      throw new BranchRoutingIncomplete(this.phase, this.phase === 'identity' ? 'maximum_identity_assignments' : 'maximum_placements', this.examined, this.bounds!);
    }
    this.examined++;
  }
  get due(): boolean { return this.bounds !== null && this.examined % this.bounds.yieldInterval === 0; }
}
/** itertools.product order: the final coordinate varies fastest. */
function* productIndices(lengths: readonly number[]): Generator<number[]> {
  if (lengths.some(length => length <= 0)) return;
  const indices = lengths.map(() => 0);
  if (!lengths.length) { yield []; return; }
  while (true) {
    yield indices;
    let column = indices.length - 1;
    while (column >= 0 && indices[column]! + 1 >= lengths[column]!) { indices[column] = 0; column--; }
    if (column < 0) return;
    indices[column] = indices[column]! + 1;
  }
}
function drain<T>(generator: Generator<void, T>): T {
  let next = generator.next(); while (!next.done) next = generator.next(); return next.value;
}
async function cooperate<T>(generator: Generator<void, T>, execution?: NativeExecution): Promise<T> {
  let next = generator.next();
  while (!next.done) {
    if (execution) await execution.yieldControl();
    else await new Promise<void>(resolve => setTimeout(resolve, 0));
    next = generator.next();
  }
  return next.value;
}
const point = (value: readonly number[]): BranchPoint => [value[0]!, value[1]!];
export const branchTupleKey = (value: unknown): string => JSON.stringify(value);
const sameSet = (left: Set<number>, right: Set<number>): boolean => left.size === right.size && [...left].every(x => right.has(x));

export function branchLayout(o: R, rows: NativeRows, _inputs: readonly R[]): BranchModel | null {
  validateRows(rows);
  const cavities: R[] = [], rectangles: R[] = [];
  for (const e of o.entities as R[]) {
    const [l, t, r, b] = e.bbox as BranchBox;
    if (e.rectangular) { rectangles.push(e); continue; }
    const width = r - l + 1, height = b - t + 1;
    if (e.area * 2 < width * height) continue;
    const occupied = new Set((e.mask as BranchPoint[]).map(([x, y]) => y * width + x));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (!occupied.has(y * width + x)) {
      count++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (!count || count !== (x1 - x0 + 1) * (y1 - y0 + 1)) continue;
    const touched = [x0 === 0, y0 === 0, x1 === r - l, y1 === b - t];
    if (touched.filter(Boolean).length !== 1 || x1 - x0 !== y1 - y0) continue;
    cavities.push({ box: [l + x0, t + y0, l + x1, t + y1], axis: touched[0] || touched[2] ? 0 : 1,
      sign: touched[0] || touched[1] ? 1 : -1, size: x1 - x0 + 1, hue: e.palette_value });
  }
  const grouped = new Map<string, R[]>();
  for (const c of cavities) {
    const key = branchTupleKey([c.axis, c.sign, c.size, c.hue]);
    const group = grouped.get(key) ?? []; group.push(c); grouped.set(key, group);
  }
  const candidates: BranchModel[] = [];
  for (const targets of grouped.values()) {
    if (targets.length < 2) continue;
    const { axis, sign, size: unit } = targets[0]! as { axis: 0 | 1; sign: 1 | -1; size: number }, tangent = (1 - axis) as 0 | 1;
    const targetCoordinates = new Set<number>(targets.map(c => c.box[axis]));
    if (targetCoordinates.size !== 1) continue;
    const goals = new Set<number>(targets.map(c => c.box[tangent]));
    if ([...goals].some(value => value % unit !== 0)) continue;
    const sources: BranchBox[] = [];
    for (const e of rectangles) {
      const box = e.bbox as BranchBox;
      if (box[2] - box[0] + 1 !== unit || box[3] - box[1] + 1 !== unit) continue;
      for (const cap of rectangles) {
        const cb = cap.bbox as BranchBox;
        const aligned = cb[tangent] === box[tangent] && cb[tangent + 2] === box[tangent + 2];
        const adjacent = sign === 1 ? cb[axis + 2]! + 1 === box[axis] : cb[axis]! - 1 === box[axis + 2];
        const normalLength = axis === 0 ? rows[0]!.length : rows.length;
        const border = sign === 1 ? cb[axis]! <= 1 : cb[axis + 2]! >= normalLength - 2;
        if (aligned && adjacent && border) { sources.push([...box]); break; }
      }
    }
    if (!sources.length) continue;
    const normal = sign === 1 ? Math.min(...sources.map(c => c[axis])) : Math.max(...sources.map(c => c[axis]));
    const terminal = [...targetCoordinates][0]!, bars: BranchBar[] = [];
    for (const e of rectangles) {
      const box = e.bbox as BranchBox, thick = box[axis + 2]! - box[axis]! + 1, length = box[tangent + 2]! - box[tangent]! + 1;
      if (thick !== unit || length < 2 * unit || length % unit !== 0 || box[tangent]! % unit !== 0) continue;
      if (!((box[axis]! - normal) * sign > 0 && (terminal - box[axis]!) * sign > 0)) continue;
      bars.push({ position: point(box), length: length / unit, hue: e.palette_value });
    }
    if (!bars.length) continue;
    const hues = new Map<number, number>(); for (const bar of bars) hues.set(bar.hue, (hues.get(bar.hue) ?? 0) + 1);
    const singles = bars.map((bar, index) => hues.get(bar.hue) === 1 ? index : -1).filter(index => index >= 0);
    const active = bars.length === 1 ? 0 : singles.length === 1 ? singles[0]! : null;
    if (active === null) continue;
    const order = bars.map((_, index) => index).sort((a, b) => sign * (bars[a]!.position[axis] - bars[b]!.position[axis]));
    candidates.push({ axis, tangent, sign, unit, goals: [...goals].map(x => x / unit).sort((a, b) => a - b),
      sources: sources.map(c => Math.floor(c[tangent] / unit)).sort((a, b) => a - b), bars, active, highlight: bars[active]!.hue,
      order, limit: Math.floor((axis === 0 ? rows.length : rows[0]!.length) / unit), goal_boxes: targets.map(c => [...c.box] as BranchBox) });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
export function branchBbox(position: readonly number[], length: number, model: BranchModel): BranchBox {
  const [x, y] = position as BranchPoint, unit = model.unit;
  return [x, y, x + unit * (model.tangent === 0 ? length : 1) - 1, y + unit * (model.tangent === 1 ? length : 1) - 1];
}
/** Preserve NumPy slice/clipping semantics, including a nonempty partial cut. */
export function branchReadState(rows: NativeRows, model: BranchModel, expected: readonly (readonly number[])[]): BranchState | null {
  const poses: BranchPoint[] = [], colors: number[] = [];
  for (let i = 0; i < Math.min(expected.length, model.bars.length); i++) {
    const pos = expected[i]!, cut = projection(rows, branchBbox(pos, model.bars[i]!.length, model)), values = new Set(cut.flat());
    if (values.size !== 1) return null;
    colors.push([...values][0]!); poses.push(point(pos));
  }
  const selected = colors.map((color, i) => color === model.highlight ? i : -1).filter(i => i >= 0);
  return selected.length === 1 ? [poses, selected[0]!] : null;
}
function* identity(o: R, model: BranchModel, prior: readonly (readonly number[])[], bounds: BranchSearchBounds | null,
  execution?: NativeExecution): Generator<void, BranchState | null> {
  const work = new Work('identity', bounds, execution); work.check();
  const options: R[][] = [], cache = new Map<string, R[]>();
  for (let i = 0; i < Math.min(model.bars.length, prior.length); i++) {
    const bar = model.bars[i]!, width = model.unit * (model.tangent === 0 ? bar.length : 1), height = model.unit * (model.tangent === 1 ? bar.length : 1);
    const key = `${width},${height}`;
    if (!cache.has(key)) cache.set(key, (o.entities as R[]).filter(e => e.rectangular && e.bbox[2] - e.bbox[0] + 1 === width && e.bbox[3] - e.bbox[1] + 1 === height));
    options.push(cache.get(key)!);
  }
  let best: number | null = null, answer: BranchState | null = null;
  for (const indices of productIndices(options.map(items => items.length))) {
    work.take(); const objects = indices.map((i, axis) => options[axis]![i]!), positions = objects.map(e => point(e.position));
    if (new Set(positions.map(branchTupleKey)).size === positions.length) {
      const selected = objects.map((e, index) => e.palette_value === model.highlight ? index : -1).filter(i => i >= 0);
      if (selected.length === 1) {
        const score = positions.reduce((sum, p, index) => sum + Math.abs(p[0] - prior[index]![0]!) + Math.abs(p[1] - prior[index]![1]!), 0);
        const candidate: BranchState = [positions, selected[0]!];
        if (best === null || score < best) { best = score; answer = candidate; }
        else if (score === best && branchTupleKey(answer) !== branchTupleKey(candidate)) answer = null;
      }
    }
    if (work.due) { yield; work.check(); }
  }
  work.check(); return answer;
}
export function branchObservedState(o: R, model: BranchModel, prior: readonly (readonly number[])[]): BranchState | null {
  return drain(identity(o, model, prior, null));
}
export function boundedBranchObservedState(o: R, model: BranchModel, prior: readonly (readonly number[])[],
  bounds: Partial<BranchSearchBounds>, execution?: NativeExecution): BranchState | null {
  return drain(identity(o, model, prior, checkedBranchBounds(bounds), execution));
}
export function boundedBranchObservedStateCooperative(o: R, model: BranchModel, prior: readonly (readonly number[])[],
  bounds: Partial<BranchSearchBounds>, execution?: NativeExecution): Promise<BranchState | null> {
  return cooperate(identity(o, model, prior, checkedBranchBounds(bounds), execution), execution);
}
export function branchPropagated(starts: readonly number[], model: BranchModel, withExits: true): [Set<number>, BranchPoint[]];
export function branchPropagated(starts: readonly number[], model: BranchModel, withExits?: false): Set<number>;
export function branchPropagated(starts: readonly number[], model: BranchModel, withExits = false): Set<number> | [Set<number>, BranchPoint[]] {
  let rays = new Set(model.sources); const exits: BranchPoint[] = [];
  for (const i of model.order) {
    const low = starts[i]; if (low === undefined) throw new RangeError('Missing BranchRouting start');
    const high = low + model.bars[i]!.length - 1, hits = new Set([...rays].filter(x => low <= x && x <= high));
    if (hits.size) rays = new Set([...rays].filter(x => !hits.has(x)).concat([low - 1, high + 1]));
    const outside = [...rays].filter(x => x < 0 || x >= model.limit).sort((a, b) => a - b);
    for (const x of outside) { exits.push([i, x]); rays.delete(x); }
  }
  return withExits ? [rays, exits] : rays;
}
export interface BranchPlacement { cost: number; starts: number[]; displacement: number[] }
function* placements(model: BranchModel, positions: readonly (readonly number[])[], active: number,
  bounds: BranchSearchBounds | null, execution?: NativeExecution): Generator<void, BranchPlacement | null> {
  const work = new Work('placements', bounds, execution); work.check();
  const goals = new Set(model.goals); let best: BranchPlacement | null = null;
  for (const indices of productIndices(model.bars.map(bar => Math.max(0, model.limit - bar.length + 1)))) {
    work.take();
    if (sameSet(branchPropagated(indices, model), goals)) {
      const displacement = indices.map((start, index) => start * model.unit - positions[index]![model.tangent]!);
      const cost = displacement.reduce((sum, delta, index) => sum + Math.floor(Math.abs(delta) / model.unit) + Number(delta !== 0 && index !== active), 1);
      // Cartesian traversal is already lexicographic by starts. Its first
      // equal-cost candidate is exactly min((cost, starts, displacement)).
      if (best === null || cost < best.cost) best = { cost, starts: [...indices], displacement };
    }
    if (work.due) { yield; work.check(); }
  }
  work.check(); return best;
}
export function branchPlacement(model: BranchModel, positions: readonly (readonly number[])[], active: number): BranchPlacement | null {
  return drain(placements(model, positions, active, null));
}
export function boundedBranchPlacementCooperative(model: BranchModel, positions: readonly (readonly number[])[], active: number,
  bounds: Partial<BranchSearchBounds>, execution?: NativeExecution): Promise<BranchPlacement | null> {
  return cooperate(placements(model, positions, active, checkedBranchBounds(bounds), execution), execution);
}
