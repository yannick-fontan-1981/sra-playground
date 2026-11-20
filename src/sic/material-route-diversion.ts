import { alternatingHistogram, alternatingOverlays, type AlternatingActor, type AlternatingBox,
  type AlternatingPosition as Point } from '../logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingGuard, AlternatingTopology } from '../logos-engine/v6-alternating-graph-questions.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';
import { guardSightline } from './material-route-watch.ts';

export type PursuitProfile = { body: number; distance: number; evidence: string[] };
export type GuardDiversion = { target: Point; passage: Point; trail: Point[]; evidence: string[] };
export type GuardDiversionStep = { input: string; to: Point; guard: AlternatingGuard; expected: Point; target: Point;
  passage: Point; trail: Point[]; awakening: boolean; capture?: AlternatingGuard; evidence: string[] };
type Removal = { guard_histogram: number[][]; size: number };
type Turn = { at: Point; follower: Point; trail: Point[]; removed: number; depth: number; first?: GuardDiversionStep };

const key = (point: Point) => point.join(',');
const same = (a: Point, b: Point) => key(a) === key(b);
const sameHistogram = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);
const box = ([y, x]: Point, size: number): AlternatingBox => [y, x, y + size - 1, x + size - 1];
const identity = ({ at, follower, trail, removed }: Turn) => [key(at), key(follower), trail.map(key).join('/'), removed].join('|');

function reachableWithoutGuard(graph: AlternatingTopology, start: Point, guard: Point): boolean {
  const queue = [key(start)], seen = new Set(queue), blocked = key(guard), target = key(graph.target);
  for (const position of queue) {
    if (position === target) return true;
    for (const next of graph.edges.get(position) ?? []) {
      if (next === blocked || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

/** Search for a full escape before trying to move a follower out of an indispensable passage. */
export function planGuardDiversion(graph: AlternatingTopology, actor: AlternatingActor, controls: Readonly<Record<string, Point>>,
  removals: readonly Removal[], profile: PursuitProfile, remaining: number, memory?: GuardDiversion): GuardDiversionStep | null {
  const followers = graph.guards.filter(guard => guard.histogram.some(([ink, count]) => ink === profile.body && count === actor.size ** 2 - 1));
  if (followers.length !== 1 || profile.distance < 2 || profile.distance > 4) return null;
  const guard = followers[0]!, start: Point = [actor.bbox[0], actor.bbox[1]], fixed = graph.guards.filter(other => other !== guard);
  if (fixed.length > 8 || fixed.some(other => !removals.some(rule =>
    rule.size === actor.size && sameHistogram(rule.guard_histogram, other.histogram)))) return null;
  if (!memory && reachableWithoutGuard(graph, start, guard.position)) return null;
  const sight = guardSightline(graph, guard, profile.distance);
  const trigger = sight.length === profile.distance ? sight.at(-1) : null;
  const initial: Turn = { at: start, follower: guard.position, trail: memory?.trail ?? [], removed: 0, depth: 0 };
  const passage = memory?.passage ?? guard.position;
  const queue = [initial], seen = new Set([identity(initial)]), moves = Object.entries(controls);
  const evidence = memory?.evidence ?? profile.evidence;
  for (let index = 0; index < queue.length && index < 4096; index++) {
    const turn = queue[index]!;
    if (same(turn.at, graph.target)) return turn.first ?? null;
    if (turn.depth >= remaining) continue;
    const active = fixed.map((item, bit) => ({ item, bit })).filter(({ bit }) => !(turn.removed & (1 << bit)));
    for (const [input, [dy, dx]] of moves) {
      const to: Point = [turn.at[0] + dy, turn.at[1] + dx];
      if (!graph.edges.get(key(turn.at))?.has(key(to)) || same(to, turn.follower)
        || turn.trail.length === 0 && same(to, guard.front) || active.some(({ item }) => same(to, item.front))) continue;
      const expected = turn.trail[0] ?? turn.follower;
      if (same(to, expected) || !same(expected, turn.follower) && !graph.edges.get(key(turn.follower))?.has(key(expected))) continue;
      const capture = active.find(({ item }) => same(to, item.position));
      if (capture && same(turn.at, capture.item.front)) continue;
      const awakening = !turn.trail.length && !!trigger && same(to, trigger);
      const trail = turn.trail.length ? [...turn.trail.slice(1), to] : awakening ? sight : [];
      const removed = capture ? turn.removed | (1 << capture.bit) : turn.removed;
      const next: Turn = { at: to, follower: expected, trail, removed, depth: turn.depth + 1,
        first: turn.first ?? { input, to, guard, expected, target: graph.target, passage, trail, awakening, evidence,
          ...(capture ? { capture: capture.item } : {}) } };
      const signature = identity(next);
      if (seen.has(signature)) continue;
      seen.add(signature);
      queue.push(next);
    }
  }
  return null;
}

export function observeGuardDiversion(step: GuardDiversionStep, actor: AlternatingActor, rows: NativeRows, floor: number, ref: string) {
  if (!sameHistogram(alternatingHistogram(rows, box(step.to, actor.size)), actor.histogram)
    || !sameHistogram(alternatingHistogram(rows, actor.bbox), [[floor, actor.size ** 2]])) return null;
  const body = step.guard.histogram.find(([, count]) => count === actor.size ** 2 - 1)?.[0];
  const pieces = alternatingOverlays(rows);
  const matches = pieces.filter(item => item.size === actor.size
    && item.histogram.some(([ink, count]) => ink === body && count === actor.size ** 2 - 1));
  const next = matches.length === 1 ? matches[0]! : null;
  if (!next || !same([next.bbox[0], next.bbox[1]], step.expected)) return null;
  const markerChanged = !sameHistogram(next.histogram, step.guard.histogram);
  if (same(step.guard.position, step.expected) && step.awakening !== markerChanged) return null;
  const capture = step.capture;
  if (capture && pieces.some(item =>
    same([item.bbox[0], item.bbox[1]], capture.position) && sameHistogram(item.histogram, capture.histogram))) return null;
  return { target: step.target, passage: step.passage, trail: step.trail, evidence: [...step.evidence.slice(-4), ref] } satisfies GuardDiversion;
}
