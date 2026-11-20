import { alternatingHistogram, alternatingOverlays, type AlternatingActor, type AlternatingBox,
  type AlternatingPosition } from '../logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingGuard, AlternatingTopology } from '../logos-engine/v6-alternating-graph-questions.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Point = AlternatingPosition;
type Controls = Readonly<Record<string, Point>>;
type Removal = { guard_histogram: number[][]; size: number };
export type PatrolMemory = { histogram: number[][]; position: Point; delta: Point; reversed: boolean; evidence: string[] };
export type PatrolStep = { input: string; to: Point; obstacle: AlternatingGuard; alternatives: Point[];
  expected: Point | null; learning: boolean; capture?: AlternatingGuard };
type Track = { position: Point; delta: Point };
type Formation = Track[];
type GuardedPatrolRoute = { guards: AlternatingGuard[]; awaitingClear: AlternatingGuard[]; floor: number };
export type PatrolGroupMemory = { histogram: number[][]; formations: Formation[]; target: Point; evidence: string[];
  guardedRoute?: GuardedPatrolRoute };
export type PatrolGroupStep = { input: string; to: Point; current: PatrolGroupMemory; next: Formation[];
  positions: Point[]; expected: Point[]; learning: boolean; capture?: AlternatingGuard };

const key = ([row, col]: Point) => row + ',' + col;
const point = (id: string): Point => id.split(',').map(Number) as unknown as Point;
const same = (a: Point, b: Point) => key(a) === key(b);
const histogramMatches = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);
const add = ([row, col]: Point, [dy, dx]: Point): Point => [row + dy, col + dx];
const subtract = ([row, col]: Point, [y, x]: Point): Point => [row - y, col - x];
const adjacent = (graph: AlternatingTopology, a: Point, b: Point) => graph.edges.get(key(a))?.has(key(b)) === true;
const box = ([row, col]: Point, size: number): AlternatingBox => [row, col, row + size - 1, col + size - 1];
const canRemove = (guard: AlternatingGuard, size: number, removals: readonly Removal[]) =>
  removals.some(removal => removal.size === size && histogramMatches(removal.guard_histogram, guard.histogram));

export function recognizesPatrolGroup(graph: AlternatingTopology, size: number, histogram: number[][], removals: readonly Removal[]) {
  return graph.guards.filter(guard => histogramMatches(guard.histogram, histogram)).length >= 2
    && graph.guards.every(guard => histogramMatches(guard.histogram, histogram) || canRemove(guard, size, removals));
}

function advance(graph: AlternatingTopology, position: Point, delta: Point) {
  const forward = add(position, delta);
  if (adjacent(graph, position, forward)) return { position: forward, delta };
  const back = subtract(position, delta);
  return adjacent(graph, position, back) ? { position: back, delta: subtract(back, position) } : null;
}

function distancesFromGoal(graph: AlternatingTopology): Map<string, number> {
  const start = key(graph.target), distance = new Map([[start, 0]]), queue = [start];
  for (const at of queue) for (const next of graph.edges.get(at) ?? []) {
    if (distance.has(next)) continue;
    distance.set(next, distance.get(at)! + 1);
    queue.push(next);
  }
  return distance;
}

export function planPatrolStep(graph: AlternatingTopology, actor: AlternatingActor, controls: Controls,
  removals: readonly Removal[], known: PatrolMemory | undefined, remaining: number): PatrolStep | null {
  const unfamiliar = graph.guards.filter(guard => !canRemove(guard, actor.size, removals));
  const obstacle = unfamiliar.length === 1 ? unfamiliar[0]! : null;
  if (!obstacle || known && (!histogramMatches(obstacle.histogram, known.histogram) || !same(obstacle.position, known.position))) return null;
  const guards = graph.guards.filter(guard => guard !== obstacle);
  if (guards.length > 8) return null;
  const start: Point = [actor.bbox[0], actor.bbox[1]], moves = Object.entries(controls).sort(([a], [b]) => a.localeCompare(b));
  const alternatives = [...graph.edges.get(key(obstacle.position)) ?? []].map(point);
  if (!known?.reversed) {
    const distances = distancesFromGoal(graph);
    const safe = moves.flatMap(([input, delta]) => {
      const to = add(start, delta);
      return adjacent(graph, start, to) && ![obstacle.position, ...alternatives, ...guards.flatMap(guard => [guard.position, guard.front])]
        .some(p => same(p, to)) ? [{ input, to }] : [];
    }).sort((a, b) => (distances.get(key(a.to)) ?? 1_000) - (distances.get(key(b.to)) ?? 1_000))[0];
    return safe ? { ...safe, obstacle, alternatives, expected: null, learning: true } : null;
  }

  type Turn = { actor: Point; patrol: Point; delta: Point; removed: number; depth: number; first: PatrolStep | null };
  const identity = (turn: Turn) => [key(turn.actor), key(turn.patrol), key(turn.delta), turn.removed].join('/');
  const initial = { actor: start, patrol: obstacle.position, delta: known.delta, removed: 0, depth: 0, first: null };
  const queue: Turn[] = [initial], seen = new Set([identity(initial)]);
  for (let i = 0; i < queue.length && i < 2_048; i++) {
    const turn = queue[i]!;
    if (same(turn.actor, graph.target)) return turn.first;
    if (turn.depth >= remaining) continue;
    const nextPatrol = advance(graph, turn.patrol, turn.delta);
    if (!nextPatrol) continue;
    const active = guards.map((guard, index) => ({ guard, index })).filter(({ index }) => !(turn.removed & (1 << index)));
    for (const [input, delta] of moves) {
      const to = add(turn.actor, delta);
      if (!adjacent(graph, turn.actor, to) || same(to, turn.patrol) || same(to, nextPatrol.position)
        || active.some(({ guard }) => same(to, guard.front))) continue;
      const removal = active.find(({ guard }) => same(to, guard.position));
      if (removal && same(turn.actor, removal.guard.front)) continue;
      const removed = removal ? turn.removed | 1 << removal.index : turn.removed;
      const next = { actor: to, patrol: nextPatrol.position, delta: nextPatrol.delta, removed, depth: turn.depth + 1,
        first: turn.first ?? { input, to, obstacle, alternatives, expected: nextPatrol.position, learning: false,
          ...(removal ? { capture: removal.guard } : {}) } };
      const id = identity(next);
      if (seen.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return null;
}

export function movedPatrol(step: PatrolStep, actor: AlternatingActor, rows: NativeRows): Point | null {
  if (!histogramMatches(alternatingHistogram(rows, box(step.to, actor.size)), actor.histogram)) return null;
  const positions = alternatingOverlays(rows).filter(candidate =>
    candidate.size === actor.size && histogramMatches(candidate.histogram, step.obstacle.histogram));
  if (positions.length !== 1) return null;
  const [y, x] = positions[0]!.bbox, at: Point = [y, x];
  return step.alternatives.some(candidate => same(at, candidate)) && (!step.expected || same(at, step.expected)) ? at : null;
}

export function observePatrolReturn(step: PatrolStep, actor: AlternatingActor, at: Point, frames: readonly NativeRows[],
  previous: PatrolMemory | undefined, ref: string): PatrolMemory | null {
  // An intermediate frame establishes the player arrived before the other sprite moved.
  const actorArrivedFirst = () => frames.some(frame =>
    histogramMatches(alternatingHistogram(frame, box(step.to, actor.size)), actor.histogram)
    && histogramMatches(alternatingHistogram(frame, step.obstacle.bbox), step.obstacle.histogram));
  if (!previous && !actorArrivedFirst()) return null;
  const delta = subtract(at, step.obstacle.position);
  const opposite: Point = [-delta[0], -delta[1]];
  if (previous && !same(previous.delta, delta) && !same(previous.delta, opposite)) return null;
  if (previous && same(previous.delta, opposite) && step.alternatives.some(candidate =>
    same(candidate, add(step.obstacle.position, previous.delta)))) return null;
  const reversed = !!previous && (previous.reversed || same(previous.delta, opposite));
  return { histogram: step.obstacle.histogram, position: at, delta, reversed,
    evidence: [...(previous?.evidence.slice(-4) ?? []), ref] };
}

const trackKey = ({ position, delta }: Track) => key(position) + ':' + key(delta);
const formationKey = (formation: Formation) => formation.map(trackKey).sort().join('/');
const distinctFormations = (formations: Formation[]) => [...new Map(formations.map(item => [formationKey(item), item])).values()];
const positionsOf = (formations: readonly Formation[]): Point[] => [...new Map(formations.flat().map(track => [key(track.position), track.position])).values()];
const occupancy = (positions: readonly Point[]) => [...new Set(positions.map(key))].sort().join('/');

function seedFormations(graph: AlternatingTopology, guards: readonly AlternatingGuard[]): Formation[] {
  let formations: Formation[] = [[]];
  for (const guard of guards) {
    const delta = subtract(guard.front, guard.position), opposite = subtract(guard.position, guard.front);
    const alternatives = [delta, opposite].flatMap(direction => advance(graph, guard.position, direction)
      ? [{ position: guard.position, delta: direction }] : []);
    formations = formations.flatMap(formation => alternatives.map(track => [...formation, track]));
  }
  return distinctFormations(formations);
}

function visibleFormation(formation: Formation, occluders: ReadonlySet<string>) {
  return occupancy(formation.filter(track => !occluders.has(key(track.position))).map(track => track.position));
}

export function planPatrolGroup(graph: AlternatingTopology, actor: AlternatingActor, controls: Controls, histogram: number[][],
  known: PatrolGroupMemory | undefined, remaining: number, removals: readonly Removal[] = []): PatrolGroupStep | null {
  const moving = graph.guards.filter(guard => histogramMatches(guard.histogram, histogram));
  if (!known && (moving.length < 2 || moving.length > 6)) return null;
  if (known && !same(known.target, graph.target)) return null;
  const stationary = graph.guards.filter(guard => !histogramMatches(guard.histogram, histogram));
  if (stationary.some(guard => !canRemove(guard, actor.size, removals))) return null;
  const guards = [...new Map([...(known?.guardedRoute?.guards ?? []), ...stationary].map(guard => [key(guard.position), guard])).values()];
  if (guards.length > 8) return null;
  const formations = known?.formations ?? seedFormations(graph, moving);
  const occluded = new Set(stationary.map(guard => key(guard.position)));
  const visible = occupancy(moving.map(guard => guard.position));
  if (!formations.length || formations.some(formation => visibleFormation(formation, occluded) !== visible)) return null;
  const base = known ?? { histogram, formations, target: graph.target, evidence: [] };
  const current = guards.length || known?.guardedRoute
    ? { ...base, guardedRoute: { floor: graph.first, guards, awaitingClear: known?.guardedRoute?.awaitingClear ?? [] } } : base;
  const moves = Object.entries(controls).sort(([a], [b]) => a.localeCompare(b));
  const horizon = Math.min(remaining, 96);
  const phases = [{ formations, blocked: new Set(positionsOf(formations).map(key)) }];
  for (let index = 0; index < horizon; index++) {
    const forecast = phases[index]!.formations.map(formation => formation.map(track => advance(graph, track.position, track.delta)));
    if (forecast.some(formation => formation.some(track => !track))) break;
    const next = distinctFormations(forecast as Formation[]);
    phases.push({ formations: next, blocked: new Set(positionsOf(next).map(key)) });
  }
  if (phases.length < 2) return null;
  const start: Point = [actor.bbox[0], actor.bbox[1]];
  const next = phases[1]!.formations;
  const initial = { position: start, time: 0, removed: 0, first: null as PatrolGroupStep | null };
  const queue = [initial], seen = new Set([key(start) + '/0']);
  const distances = distancesFromGoal(graph);
  let probe: PatrolGroupStep | null = null;
  for (let index = 0; index < queue.length && index < 16_384; index++) {
    const turn = queue[index]!;
    if (same(turn.position, graph.target)) return turn.first;
    const after = phases[turn.time + 1];
    if (!after) continue;
    const before = phases[turn.time]!;
    const active = guards.flatMap((guard, i) => turn.removed & (1 << i) ? [] : [{ guard, bit: 1 << i }]);
    for (const [input, delta] of moves) {
      const to = add(turn.position, delta), id = key(to);
      if (!adjacent(graph, turn.position, to) || before.blocked.has(id) || after.blocked.has(id)
        || active.some(({ guard }) => same(to, guard.front))) continue;
      const contact = active.find(({ guard }) => same(to, guard.position));
      if (contact && same(turn.position, contact.guard.front)) continue;
      const removed = turn.removed | (contact?.bit ?? 0);
      const first = turn.first ?? { input, to, current, next, positions: positionsOf(formations), expected: positionsOf(next), learning: !known,
        ...(contact ? { capture: contact.guard } : {}) };
      if (turn.time === 0 && (!probe || (distances.get(id) ?? Infinity) < (distances.get(key(probe.to)) ?? Infinity))) probe = first;
      const time = turn.time + 1, state = id + '/' + time + (guards.length ? '/' + removed : '');
      if (seen.has(state)) continue;
      seen.add(state);
      queue.push({ position: to, time, removed, first });
    }
  }
  return probe && next.length > 1 ? { ...probe, learning: true } : null;
}

function visiblePatrols(rows: NativeRows, actor: AlternatingActor, histogram: number[][]): Point[] {
  return alternatingOverlays(rows).flatMap(candidate => candidate.size === actor.size && histogramMatches(candidate.histogram, histogram)
    ? [[candidate.bbox[0], candidate.bbox[1]] as Point] : []);
}

export function observePatrolGroup(step: PatrolGroupStep, actor: AlternatingActor, rows: NativeRows,
  frames: readonly NativeRows[], ref: string): PatrolGroupMemory | null {
  const landed = (frame: NativeRows) => histogramMatches(alternatingHistogram(frame, box(step.to, actor.size)), actor.histogram);
  if (!landed(rows)) return null;
  const { current } = step;
  if (!current.evidence.length && !frames.some(frame => landed(frame)
    && occupancy(visiblePatrols(frame, actor, current.histogram)) === occupancy(step.positions))) return null;
  const observed = occupancy(visiblePatrols(rows, actor, current.histogram));
  const guarded = current.guardedRoute;
  const occluded = new Set(guarded?.guards.filter(guard =>
    histogramMatches(alternatingHistogram(rows, guard.bbox), guard.histogram)).map(guard => key(guard.position)));
  // Overlaid walkers are one visible sprite but retain both directions in every compatible formation.
  const formations = step.next.filter(formation => visibleFormation(formation, occluded) === observed);
  if (!formations.length) return null;
  const result = { ...current, formations, evidence: [...current.evidence.slice(-4), ref] };
  if (!guarded) return result;
  const covered = new Set([key(step.to), ...positionsOf(formations).map(key)]);
  const guards = guarded.guards.filter(guard => !step.capture || !same(guard.position, step.capture.position));
  if (guards.some(guard => !covered.has(key(guard.position))
    && !histogramMatches(alternatingHistogram(rows, guard.bbox), guard.histogram))) return null;
  const awaitingClear = [...guarded.awaitingClear, ...(step.capture ? [step.capture] : [])];
  if (awaitingClear.some(guard => !covered.has(key(guard.position))
    && !histogramMatches(alternatingHistogram(rows, guard.bbox), [[guarded.floor, actor.size ** 2]]))) return null;
  return { ...result, guardedRoute: { ...guarded, guards,
    awaitingClear: awaitingClear.filter(guard => covered.has(key(guard.position))) } };
}
