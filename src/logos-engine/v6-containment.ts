/**
 * Complete native transfer of common_containment.py at
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. NumPy raster operations are explicit
 * integer/boolean loops; the joint pose search and its tie/ambiguity rules are
 * retained. No hidden terrain, game name or known solution enters the model.
 */
import { v6Digest, validateRows } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePoint, NativePublicObservation, NativeRows } from './v6-native-types.ts';

export type ContainmentRecord = Record<string, any>;
export interface ContainmentObservation extends ContainmentRecord { entities: readonly ContainmentRecord[]; level_epoch: number; observation_ref: string; frame_hash: string; levels_completed: number; state: string }
/** Missing data is meaningful in source command identities; preserve it. */
export interface ContainmentCommand extends ContainmentRecord { action_ref: string; data?: Record<string, number> }
export interface ContainmentBody { origin: NativePoint; shape: NativePoint[]; shell: NativePoint[]; color: number }
export interface ContainmentScene { bodies: ContainmentBody[]; goals: NativePoint[]; assignments: number[][]; terrain: boolean[][] }
export type ContainmentAction = readonly [mode: string, body: number | null, command: ContainmentCommand, expected: readonly NativePoint[] | null];
export type ContainmentGraph = Map<string, { point: NativePoint; path: string[] }>;
type PointSet = Map<string, NativePoint>;
const keyOf = (value: unknown): string => JSON.stringify(value);
const pointKey = (point: NativePoint): string => keyOf(point);
const comparePoint = (a: NativePoint, b: NativePoint): number => a[0] - b[0] || a[1] - b[1];
const points = (values: Iterable<NativePoint>): PointSet => new Map([...values].map(point => [pointKey(point), point]));
const sorted = (values: Iterable<NativePoint>): NativePoint[] => [...values].sort(comparePoint);
const serializedSet = <T>(values: Iterable<T>): T[] => [...values].sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);
const addressed = (command: ContainmentCommand): boolean => command.data !== undefined && Object.keys(command.data).length > 0;
function compareNumbers(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
}
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same((a as ContainmentRecord)[key], (b as ContainmentRecord)[key]));
}
function intersects(a: ReadonlyMap<string, NativePoint>, b: ReadonlyMap<string, NativePoint>): boolean { return [...a.keys()].some(key => b.has(key)); }
function union(sets: Iterable<ReadonlyMap<string, NativePoint>>): PointSet {
  const result: PointSet = new Map(); for (const set of sets) for (const [key, point] of set) result.set(key, point); return result;
}
function* permutations(length: number, prefix: number[] = [], used: Set<number> = new Set()): Generator<number[]> {
  if (prefix.length === length) { yield prefix; return; }
  for (let i = 0; i < length; i++) if (!used.has(i)) yield* permutations(length, [...prefix, i], new Set([...used, i]));
}

export function containmentNeighborhood(mask: readonly NativePoint[]): NativePoint[] {
  const support = points(mask), neighbours: PointSet = new Map();
  for (const [x, y] of support.values()) for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
    const point: NativePoint = [x + dx!, y + dy!]; if (!support.has(pointKey(point))) neighbours.set(pointKey(point), point);
  }
  return sorted(neighbours.values());
}

/** Flood only the exterior of the measured bounding box; retain enclosed support. */
export function fillContainmentSupport(support: readonly NativePoint[], width: number, height: number): NativePoint[] {
  const occupied = points(support), exterior = points([[-1, -1]]), queue: NativePoint[] = [[-1, -1]];
  for (let head = 0; head < queue.length; head++) for (const point of containmentNeighborhood([queue[head]!])) {
    const [x, y] = point, key = pointKey(point);
    if (x >= -1 && x <= width && y >= -1 && y <= height && !exterior.has(key) && !occupied.has(key)) { exterior.set(key, point); queue.push(point); }
  }
  const result: NativePoint[] = [];
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) if (!exterior.has(pointKey([x, y]))) result.push([x, y]);
  return result;
}

export function measureContainmentScene(observation: ContainmentObservation, rows: NativeRows): ContainmentScene | null {
  validateRows(rows);
  const height = rows.length, width = rows[0]!.length, byValue = new Map<number, ContainmentRecord[]>();
  for (const entity of observation.entities) { if (!byValue.has(entity.palette_value)) byValue.set(entity.palette_value, []); byValue.get(entity.palette_value)!.push(entity); }
  const options: ContainmentScene[] = [];
  for (const [floor, group] of byValue) {
    const holes: { shape: NativePoint[]; origin: NativePoint; rim: NativePoint[]; rimValue: number }[] = [];
    const largest = Math.max(...group.map(entity => entity.area));
    for (const entity of group) {
      if (entity.area === largest) continue;
      const [x, y, right, bottom] = entity.bbox;
      if (Math.min(right - x, bottom - y) < 1) continue;
      const shape = sorted(points(entity.mask).values());
      const rim = containmentNeighborhood(shape).map(([i, j]): NativePoint => [x + i, y + j]);
      if (!rim.every(([i, j]) => i >= 0 && i < width && j >= 0 && j < height)) continue;
      const rimValues = new Set(rim.map(([i, j]) => rows[j]![i]!));
      if (rimValues.size === 1) holes.push({ shape, origin: [x, y], rim, rimValue: [...rimValues][0]! });
    }
    if (!holes.length) continue;
    const bodies: ContainmentBody[] = [], shapes = new Map(holes.map(hole => [keyOf(hole.shape), hole.shape]));
    for (const entity of observation.entities) {
      if (entity.palette_value === floor) continue;
      const [x, y, right, bottom] = entity.bbox;
      if (![...shapes.values()].some(shape => Math.max(...shape.map(p => p[0])) === right - x && Math.max(...shape.map(p => p[1])) === bottom - y)) continue;
      const shape = fillContainmentSupport(entity.mask, right - x + 1, bottom - y + 1);
      if (shapes.has(keyOf(shape))) bodies.push({ origin: [x, y], shape, shell: sorted(points(entity.mask).values()), color: entity.palette_value });
    }
    if (!bodies.length || holes.length !== bodies.length) continue;
    const assignments = [...permutations(holes.length)].filter(assignment => bodies.every((body, i) => same(body.shape, holes[assignment[i]!]!.shape)));
    if (!assignments.length) continue;
    const terrain = rows.map(row => row.map(value => value === floor));
    for (const hole of holes) for (const [x, y] of hole.rim) terrain[y]![x] = true;
    for (const body of bodies) for (const [x, y] of body.shape) terrain[body.origin[1] + y]![body.origin[0] + x] = true;
    options.push({ bodies, goals: holes.map(hole => hole.origin), assignments, terrain });
  }
  return options.length === 1 ? options[0]! : null;
}

/** Recognize a bound pose only when another support explains every lost edge. */
export function containmentContactPose(rows: NativeRows, bodies: readonly ContainmentBody[], predicted: readonly NativePoint[]): NativePoint[] {
  const footprints = predicted.slice(0, bodies.length).map((position, i) => points(bodies[i]!.shape.map(([x, y]): NativePoint => [position[0] + x, position[1] + y])));
  if (footprints.reduce((sum, footprint) => sum + footprint.size, 0) !== union(footprints).size) return [];
  let witnessed = false;
  for (let i = 0; i < Math.min(predicted.length, bodies.length); i++) {
    const position = predicted[i]!, body = bodies[i]!, footprint = footprints[i]!;
    const support = points(body.shell.map(([x, y]): NativePoint => [position[0] + x, position[1] + y]));
    if (![...footprint.values()].every(([x, y]) => x >= 0 && x < rows[0]!.length && y >= 0 && y < rows.length)) return [];
    const missing = new Map([...support].filter(([, [x, y]]) => rows[y]![x] !== body.color));
    if (!missing.size) continue;
    if (missing.size === support.size) return [];
    const near = points(containmentNeighborhood([...union(footprints.filter((_, j) => j !== i)).values()]));
    const interior = new Set([...footprint].filter(([key]) => !support.has(key)).map(([, [x, y]]) => rows[y]![x]!));
    if ([...missing].some(([key, [x, y]]) => !near.has(key) || !interior.has(rows[y]![x]!))) return [];
    witnessed = true;
  }
  return witnessed ? predicted.map(point => [...point] as NativePoint) : [];
}

/** Joint maximum-support pose matching, followed by minimum total displacement. */
export function measureContainmentPositions(rows: NativeRows, bodies: readonly ContainmentBody[], prior: readonly NativePoint[]): NativePoint[] {
  const height = rows.length, width = rows[0]!.length;
  type Choice = { cost: number; distance: number; position: NativePoint };
  const choices: Choice[][] = [];
  for (let i = 0; i < Math.min(bodies.length, prior.length); i++) {
    const body = bodies[i]!, old = prior[i]!, mask = body.shell;
    if (!mask.length) throw new TypeError('Observed containment body has no measured shell');
    const bw = Math.max(...mask.map(p => p[0])) + 1, bh = Math.max(...mask.map(p => p[1])) + 1;
    const ny = height - bh + 1, nx = width - bw + 1;
    if (ny < 0 || nx < 0) throw new RangeError('Measured containment body exceeds the public viewport');
    const votes = new Uint16Array(nx * ny);
    // Uint16Array preserves NumPy's declared uint16 accumulation behavior.
    for (const [x, y] of mask) for (let yy = 0; yy < ny; yy++) for (let xx = 0; xx < nx; xx++) {
      if (rows[y + yy]![x + xx] === body.color) votes[yy * nx + xx] = votes[yy * nx + xx]! + 1;
    }
    const threshold = Math.floor((mask.length + 1) / 2), scored: Choice[] = [];
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if (votes[y * nx + x]! >= threshold) {
      scored.push({ cost: -votes[y * nx + x]!, distance: Math.abs(old[0] - x) + Math.abs(old[1] - y), position: [x, y] });
    }
    scored.sort((a, b) => a.cost - b.cost || a.distance - b.distance || comparePoint(a.position, b.position));
    choices.push(scored);
  }
  if (choices.some(value => !value.length)) return containmentContactPose(rows, bodies, prior);
  const order = bodies.map((_, i) => i).sort((a, b) => choices[a]!.length - choices[b]!.length);
  const lower = Array.from({ length: order.length + 1 }, (_, k) => order.slice(k).reduce((sum, i) => sum + choices[i]![0]!.cost, 0));
  let best: readonly [number, number] | null = null;
  const solutions = new Map<string, NativePoint[]>(), poses: NativePoint[] = Array(bodies.length);
  const assign = (k: number, occupied: PointSet, cost: number, distance: number): void => {
    if (best !== null && compareNumbers([cost + lower[k]!, distance], best) > 0) return;
    if (k === order.length) {
      const score: readonly [number, number] = [cost, distance];
      if (best === null || compareNumbers(score, best) < 0) { best = score; solutions.clear(); }
      const retained = poses.map(point => [...point] as NativePoint); solutions.set(keyOf(retained), retained); return;
    }
    const i = order[k]!;
    for (const choice of choices[i]!) {
      if (best !== null && cost + choice.cost + lower[k + 1]! > best[0]) break;
      const footprint = points(bodies[i]!.shape.map(([x, y]): NativePoint => [choice.position[0] + x, choice.position[1] + y]));
      if (intersects(footprint, occupied)) continue;
      poses[i] = choice.position; assign(k + 1, union([occupied, footprint]), cost + choice.cost, distance + choice.distance);
    }
  };
  assign(0, new Map(), 0, 0);
  return solutions.size === 1 ? [...solutions.values()][0]! : containmentContactPose(rows, bodies, prior);
}

export function containmentAdd(point: NativePoint, delta: NativePoint): NativePoint { return [point[0] + delta[0], point[1] + delta[1]]; }
export function containmentDistance(a: NativePoint, b: NativePoint): number { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); }

export class Containment {
  readonly id = 'containment';
  readonly familyId = 'containment';
  epoch: number | null = null;
  positions: NativePoint[] = [];
  events: ContainmentRecord[] = [];
  passed: ContainmentRecord[] = [];
  previous: unknown = null;
  fit: ContainmentScene | null | undefined;
  vectors = new Map<string, NativePoint>();
  noMoves = new Map<string, readonly [string, readonly NativePoint[]]>();
  active: number | null = null;
  failed = new Map<string, readonly [number, NativePoint, string]>();
  probes = new Map<string, readonly [number, NativePoint, number | null, NativePoint, string]>();
  motionRefs = new Map<string, string>();
  selectionTests = new Map<string, readonly [number, NativePoint, number | null]>();
  effectBounds: ContainmentRecord = {};
  bodies: ContainmentBody[] | undefined;
  goals: NativePoint[] | undefined;
  assignments: number[][] | undefined;
  terrain: boolean[][] | undefined;
  passable: PointSet[] | undefined;
  regions: Map<string, { stamp: readonly [number, NativePoint, readonly (readonly [string, NativePoint])[]]; points: PointSet }> | undefined;

  state(): ContainmentRecord {
    const result: ContainmentRecord = { format: 'native.containment.v1', epoch: this.epoch, positions: this.positions,
      events: this.events, passed: this.passed, previous: this.previous };
    if (this.fit !== undefined) Object.assign(result, { fit: this.fit, vectors: Object.fromEntries(this.vectors),
      no_moves: serializedSet(this.noMoves.values()), active: this.active, failed: serializedSet(this.failed.values()), probes: serializedSet(this.probes.values()),
      motion_refs: Object.fromEntries(this.motionRefs), selection_tests: serializedSet(this.selectionTests.values()), effect_bounds: this.effectBounds });
    if (this.bodies !== undefined) Object.assign(result, { bodies: this.bodies, goals: this.goals, assignments: this.assignments, terrain: this.terrain,
      passable: this.passable!.map(set => sorted(set.values())) });
    if (this.regions !== undefined) result.regions = [...this.regions.values()].map(value => [value.stamp, sorted(value.points.values())]);
    return structuredClone(result);
  }

  restore(snapshot: ContainmentRecord): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.containment.v1' || !(value.epoch === null || Number.isSafeInteger(value.epoch))
      || !Array.isArray(value.positions) || !Array.isArray(value.events) || !Array.isArray(value.passed)
      || Object.hasOwn(value, 'fit') && (!Array.isArray(value.no_moves) || !Array.isArray(value.failed) || !Array.isArray(value.probes) || !Array.isArray(value.selection_tests))
      || Object.hasOwn(value, 'bodies') && (!Array.isArray(value.bodies) || !Array.isArray(value.passable))) throw new TypeError('Incompatible containment memory snapshot');
    this.epoch = value.epoch; this.positions = value.positions; this.events = value.events; this.passed = value.passed; this.previous = value.previous;
    this.fit = value.fit;
    this.vectors = new Map(Object.entries(value.vectors ?? {}));
    this.noMoves = new Map((value.no_moves ?? []).map((item: any) => [keyOf(item), item]));
    this.active = value.active ?? null;
    this.failed = new Map((value.failed ?? []).map((item: any) => [keyOf(item), item]));
    this.probes = new Map((value.probes ?? []).map((item: any) => [keyOf(item), item]));
    this.motionRefs = new Map(Object.entries(value.motion_refs ?? {}));
    this.selectionTests = new Map((value.selection_tests ?? []).map((item: any) => [keyOf(item), item]));
    this.effectBounds = value.effect_bounds ?? {};
    this.bodies = value.bodies; this.goals = value.goals; this.assignments = value.assignments; this.terrain = value.terrain;
    this.passable = value.passable?.map((support: NativePoint[]) => points(support));
    this.regions = value.regions === undefined ? undefined : new Map(value.regions.map(([stamp, support]: [any, NativePoint[]]) => [keyOf(stamp), { stamp, points: points(support) }]));
  }

  start(observation: ContainmentObservation, rows: NativeRows): void {
    this.epoch = observation.level_epoch; this.fit = measureContainmentScene(observation, rows); this.vectors.clear(); this.noMoves.clear();
    this.active = null; this.failed.clear(); this.probes.clear(); this.motionRefs.clear(); this.selectionTests.clear(); this.effectBounds = {};
    if (this.fit === null) return;
    this.bodies = this.fit.bodies; this.goals = this.fit.goals; this.assignments = this.fit.assignments; this.terrain = this.fit.terrain;
    this.positions = this.bodies.map(body => body.origin); this.passable = [];
    const height = this.terrain.length, width = this.terrain[0]!.length;
    for (const body of this.bodies) {
      const shape = body.shape, bw = Math.max(...shape.map(p => p[0])) + 1, bh = Math.max(...shape.map(p => p[1])) + 1;
      const support: PointSet = new Map();
      for (let y = 0; y < height - bh + 1; y++) for (let x = 0; x < width - bw + 1; x++) {
        if (shape.every(([xx, yy]) => this.terrain![y + yy]![x + xx])) support.set(pointKey([x, y]), [x, y]);
      }
      this.passable.push(support);
    }
  }

  footprint(index: number, position: NativePoint): PointSet {
    return points(this.bodies![index]!.shape.map(([x, y]): NativePoint => [position[0] + x, position[1] + y]));
  }
  graph(index: number, positions: readonly NativePoint[], ignore: Iterable<number> = []): ContainmentGraph {
    const ignored = new Set(ignore), occupied = union(positions.flatMap((position, j) => j !== index && !ignored.has(j) ? [this.footprint(j, position)] : []));
    const start = positions[index]!, seen: ContainmentGraph = new Map([[pointKey(start), { point: start, path: [] }]]), queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const position = queue[head]!;
      for (const [key, delta] of this.vectors) {
        const next = containmentAdd(position, delta), nextKey = pointKey(next);
        if (seen.has(nextKey) || !this.passable![index]!.has(nextKey) || this.failed.has(keyOf([index, position, key])) || intersects(this.footprint(index, next), occupied)) continue;
        seen.set(nextKey, { point: next, path: [...seen.get(pointKey(position))!.path, key] }); queue.push(next);
      }
    }
    return seen;
  }

  select(index: number, positions: readonly NativePoint[], inputs: readonly ContainmentCommand[]): ContainmentAction[] | null {
    if (index === this.active) return [];
    const footprint = this.footprint(index, positions[index]!), [x, y] = positions[index]!, body = this.bodies![index]!;
    if (this.selectionTests.has(keyOf([index, positions[index], this.active]))) return null;
    const choices = inputs.filter(command => addressed(command) && footprint.has(pointKey([command.data!.x!, command.data!.y!])));
    if (!choices.length) return null;
    const shell = points(body.shell);
    choices.sort((a, b) => Number(shell.has(pointKey([a.data!.x! - x, a.data!.y! - y]))) - Number(shell.has(pointKey([b.data!.x! - x, b.data!.y! - y])))
      || a.data!.y! - b.data!.y! || a.data!.x! - b.data!.x!);
    return [['selection', index, choices[0]!, null]];
  }
  walk(index: number, path: readonly string[], positions: readonly NativePoint[]): ContainmentAction[] {
    const result: ContainmentAction[] = [], pos = [...positions];
    for (const key of path) {
      pos[index] = containmentAdd(pos[index]!, this.vectors.get(key)!);
      result.push(['walk', index, { action_ref: key }, [...pos]]);
    }
    return result;
  }

  choices(_observation: ContainmentObservation, inputs: readonly ContainmentCommand[]): ContainmentAction[] {
    const pos = this.positions, plain = inputs.filter(command => !addressed(command)).map(command => command.action_ref).sort();
    const unseen = plain.filter(key => !this.vectors.has(key) && !this.noMoves.has(keyOf([key, pos])));
    if (unseen.length) return [['calibrate', this.active, { action_ref: unseen[0]! }, null]];
    if (this.active === null || !this.vectors.size) return [];
    const all = pos.map((_, i) => i), access = pos.map((_, i) => this.graph(i, pos)), relaxed = pos.map((_, i) => this.graph(i, pos, all));
    const assignmentCost = (assignment: readonly number[]) => [assignment.reduce((sum, j, i) => sum + Number(!relaxed[i]!.has(pointKey(this.goals![j]!))), 0),
      assignment.reduce((sum, j, i) => sum + containmentDistance(pos[i]!, this.goals![j]!), 0)];
    const target = [...this.assignments!].sort((a, b) => compareNumbers(assignmentCost(a), assignmentCost(b)))[0]!;
    const goals = target.map(j => this.goals![j]!);
    const direct: { order: number[]; plan: ContainmentAction[] }[] = [], services: { order: number[]; plan: ContainmentAction[] }[] = [];
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i]!;
      if (same(pos[i], goal)) continue;
      const selection = this.select(i, pos, inputs), path = access[i]!.get(pointKey(goal));
      if (selection !== null && path) {
        const plan = [...selection, ...this.walk(i, path.path, pos)]; direct.push({ order: [plan.length, i], plan }); continue;
      }
      for (let j = 0; j < pos.length; j++) {
        if (i === j) continue;
        const enter = this.select(j, pos, inputs);
        if (enter === null) continue;
        for (const { point: launch, path } of access[j]!.values()) for (const [key, delta] of this.vectors) {
          if (!intersects(this.footprint(j, containmentAdd(launch, delta)), this.footprint(i, pos[i]!))) continue;
          const trial = [i, pos[i], j, launch, key]; if (this.probes.has(keyOf(trial))) continue;
          let land = pos[i]!; const possible: NativePoint[] = [];
          while (true) {
            land = containmentAdd(land, delta);
            if (!(land[0] >= 0 && land[0] < this.terrain![0]!.length && land[1] >= 0 && land[1] < this.terrain!.length)) break;
            if (this.passable![i]!.has(pointKey(land)) && containmentDistance(land, goal) < containmentDistance(pos[i]!, goal)) possible.push(land);
          }
          if (!possible.length) continue;
          const goalRegion = this.region(i, goal), connected = possible.some(point => goalRegion.has(pointKey(point)));
          const gain = containmentDistance(pos[i]!, goal) - Math.min(...possible.map(point => containmentDistance(point, goal)));
          const plan: ContainmentAction[] = [...enter, ...this.walk(j, path, pos), ['contact', i, { action_ref: key }, null]];
          services.push({ order: [Number(!connected), plan.length, -gain, i, j], plan });
        }
      }
    }
    if (services.length) return services.sort((a, b) => compareNumbers(a.order, b.order))[0]!.plan;
    if (direct.length) return direct.sort((a, b) => compareNumbers(a.order, b.order))[0]!.plan;
    return [];
  }

  region(index: number, goal: NativePoint): PointSet {
    const vectors = [...this.vectors].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    const stamp = [index, goal, vectors] as const, key = keyOf(stamp);
    if (!this.regions) throw new TypeError('Containment regions require an initialized public epoch');
    if (!this.regions.has(key)) {
      const positions = [...this.positions]; positions[index] = goal;
      const reachable = this.graph(index, positions, positions.map((_, i) => i));
      this.regions.set(key, { stamp, points: points([...reachable.values()].map(value => value.point)) });
    }
    return this.regions.get(key)!.points;
  }

  async propose(observation: ContainmentObservation, rows: NativeRows, inputs: readonly ContainmentCommand[], remaining: number): Promise<ContainmentRecord | null> {
    if (!inputs.some(command => !addressed(command))) return null;
    if (this.epoch !== observation.level_epoch) { this.start(observation, rows); this.regions = new Map(); }
    if (!this.fit) return null;
    const current = measureContainmentPositions(rows, this.bodies!, this.positions);
    if (!current.length) return null;
    this.positions = current; const plan = this.choices(observation, inputs);
    if (!plan.length) return null;
    const refs = [observation.observation_ref, ...new Set(this.motionRefs.values())], steps: ContainmentRecord[] = []; let pos: readonly NativePoint[] = current;
    for (const [kind, body, command, expected] of plan.slice(0, Math.min(remaining, 16))) {
      steps.push({ mode: kind, body, action: command, poses: pos, active: this.active,
        expected_before: { level_epoch: this.epoch, frame_hash: steps.length ? null : observation.frame_hash }, expected_after: expected });
      if (expected === null) break;
      pos = expected;
    }
    if (!steps.length) throw new RangeError('Containment proposal requires a positive remaining prefix budget');
    const actions = steps.map(step => step.action), focus = `C_containment_${(await v6Digest([refs, actions])).slice(0, 18)}`;
    const info = { cavities: this.goals, bodies: current, compatible_assignments: this.assignments!.length, selected_before: this.active,
      measured_command_displacements: Object.fromEntries(this.vectors), terminal_hypothesis: 'occupy all silhouette-compatible cavities', next_experiment: steps.at(-1)!.mode };
    const reasons: Record<string, string> = {
      selection: 'Test control acquisition on an occupant needed for the pending cavity.',
      calibrate: 'Measure which body translates and its pixel displacement under an uncharacterized input.',
      contact: 'Test whether approaching an overlapping support transfers a body toward an inaccessible matching cavity.',
      walk: 'Move a measured occupant toward a silhouette-compatible cavity.',
    };
    const why = reasons[steps.at(-1)!.mode]!, facts = { measured_cavity_body_correspondence: true, public_inputs_bound: true, effects_revalidated: true };
    return { status: 'proposed', kind: 'containment_and_contact', containment_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs,
      binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [],
        purpose: why, preconditions: facts, evidence: refs, actions, outcome_guard: { path: ['value'], contains: focus } } };
  }

  bind(proposal: ContainmentRecord, domain: ObservedInputDomain): void { domain.bindProposal(proposal as Parameters<ObservedInputDomain['bindProposal']>[0]); }

  before(proposal: ContainmentRecord, index: number, publicPacket: NativePublicObservation, observation: ContainmentObservation): ContainmentRecord {
    const step = proposal.steps[index], pos = step.poses as NativePoint[], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref)
      && (index > 0 || observation.observation_ref === bound.observation_ref) && same(measureContainmentPositions(publicPacket.frame_rows, this.bodies!, pos), pos);
    return { admitted: ok, reason: 'reobserve_bound_geometry_and_poses' };
  }

  after(proposal: ContainmentRecord, index: number, before: ContainmentObservation, after: ContainmentObservation, _first: NativeRows, second: NativeRows): ContainmentRecord {
    const step = proposal.steps[index], expected = step.expected_after;
    if (!same([before.state, before.levels_completed, before.level_epoch], [after.state, after.levels_completed, after.level_epoch])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const found = measureContainmentPositions(second, this.bodies!, expected?.length ? expected : step.poses);
    const matched = expected?.length ? same(found, expected) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_all_observed_poses' };
  }

  record(before: ContainmentObservation, after: ContainmentObservation, command: ContainmentCommand, first: NativeRows, second: NativeRows, proposal: ContainmentRecord, index: number): ContainmentRecord {
    const step = proposal.steps[index], kind = step.mode, body = step.body as number, ref = after.observation_ref, key = command.action_ref;
    const old = step.poses as NativePoint[], event: ContainmentRecord = { mode: kind, evidence: ref, key };
    if (after.levels_completed > before.levels_completed) { this.passed.push({ score: after.levels_completed, ref }); return { ...event, status: 'score_boundary' }; }
    const next = measureContainmentPositions(second, this.bodies!, step.expected_after?.length ? step.expected_after : old);
    if (!next.length) return { ...event, status: 'pose_ambiguous' };
    const moved = old.flatMap((point, j) => !same(point, next[j]) ? [j] : []);
    if (kind === 'calibrate') {
      if (moved.length === 1) {
        const j = moved[0]!, dx = next[j]![0] - old[j]![0], dy = next[j]![1] - old[j]![1];
        if ((dx === 0) !== (dy === 0)) { this.active = j; this.vectors.set(key, [dx, dy]); this.motionRefs.set(key, ref); }
      } else { const value = [key, next] as const; this.noMoves.set(keyOf(value), value); }
    }
    if (kind === 'walk' && !moved.length) { const value = [body, old[body]!, key] as const; this.failed.set(keyOf(value), value); }
    if (kind === 'selection') {
      const crop = (rows: NativeRows) => [...this.bodies![body]!.shape].sort(comparePoint).map(([x, y]) => rows[old[body]![1] + y]![old[body]![0] + x]);
      if (!moved.length && !same(crop(first), crop(second))) { this.active = body; event.selection_status = 'appearance_change_pending_translation'; }
      const value = [body, old[body]!, step.active] as const; this.selectionTests.set(keyOf(value), value);
    }
    if (kind === 'contact') {
      if (this.active === null) throw new TypeError('Measured contact requires a bound active body');
      const value = [body, old[body]!, this.active, old[this.active]!, key] as const; this.probes.set(keyOf(value), value);
      if (moved.length === 1 && moved[0] === body && this.active !== body) {
        event.contact_displacement = [next[body]![0] - old[body]![0], next[body]![1] - old[body]![1]]; this.motionRefs.set('contact', ref);
      }
    }
    Object.assign(event, { status: 'public_effect_measured', moved, before: old, after: next, active: this.active });
    this.events.push(event); this.positions = next; return event;
  }
}
