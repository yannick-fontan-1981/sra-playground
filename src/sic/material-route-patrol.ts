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
