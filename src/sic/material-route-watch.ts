import { alternatingHistogram, alternatingOverlays, type AlternatingActor, type AlternatingBox, type AlternatingPosition } from '../logos-engine/v6-alternating-graph-observation.ts';
import type { AlternatingGuard, AlternatingTopology } from '../logos-engine/v6-alternating-graph-questions.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Point = AlternatingPosition;
type Removal = { guard_histogram: number[][]; size: number };
export type GuardWatch = { body: number; target: Point; evidence: string[] };
export type GuardWatchStep = { input: string; to: Point; guard: AlternatingGuard; body: number; alternatives: Point[];
  target: Point; evidence: string[]; capture?: AlternatingGuard };
const key = (point: Point) => point.join(',');
const point = (id: string): Point => id.split(',').map(Number) as unknown as Point;
const box = ([y, x]: Point, size: number): AlternatingBox => [y, x, y + size - 1, x + size - 1];
const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Keep the immediate step clear of an unfamiliar guard and its possible next positions. */
export function planGuardWatch(graph: AlternatingTopology, actor: AlternatingActor, controls: Readonly<Record<string, Point>>,
  removals: readonly Removal[], remaining: number, watch?: GuardWatch): GuardWatchStep | null {
  const known = (guard: AlternatingGuard) => removals.some(r => r.size === actor.size && equal(r.guard_histogram, guard.histogram));
  const unfamiliar = graph.guards.filter(guard => !known(guard));
  const guard = unfamiliar.length === 1 ? unfamiliar[0]! : null;
  if (!guard || (!watch && !graph.guards.some(known))) return null;
  const body = guard.histogram.find(([, count]) => count === actor.size ** 2 - 1)?.[0];
  if (body === undefined || watch && watch.body !== body) return null;
  const alternatives = [guard.position, ...[...graph.edges.get(key(guard.position)) ?? []].map(point)];
  const fixed = graph.guards.filter(item => item !== guard);
  if (fixed.length > 8) return null;
  const moves = Object.entries(controls).sort(([a], [b]) => a.localeCompare(b));
  type Search = { at: Point; cleared: number; depth: number; first?: GuardWatchStep };
  const start: Point = [actor.bbox[0], actor.bbox[1]];
  const queue: Search[] = [{ at: start, cleared: 0, depth: 0 }], seen = new Set([key(start) + '/0']);
  for (const state of queue) {
    if (key(state.at) === key(graph.target)) return state.first ?? null;
    if (state.depth >= remaining || seen.size >= 2_048) continue;
    const active = fixed.map((candidate, index) => ({ candidate, index })).filter(({ index }) => !(state.cleared & (1 << index)));
    for (const [input, [dy, dx]] of moves) {
      const to: Point = [state.at[0] + dy, state.at[1] + dx], target = key(to);
      if (!graph.edges.get(key(state.at))?.has(target) || target === key(guard.position)
        || !state.first && alternatives.some(other => target === key(other))) continue;
      if (active.some(({ candidate }) => target === key(candidate.front))) continue;
      const contact = active.find(({ candidate }) => target === key(candidate.position));
      if (contact && key(contact.candidate.front) === key(state.at)) continue;
      const cleared = contact ? state.cleared | (1 << contact.index) : state.cleared;
      const signature = target + '/' + cleared;
      if (seen.has(signature)) continue;
      seen.add(signature);
      queue.push({ at: to, cleared, depth: state.depth + 1, first: state.first ?? { input, to, guard, alternatives, body,
        target: graph.target, evidence: watch?.evidence ?? [], ...(contact ? { capture: contact.candidate } : {}) } });
    }
  }
  return null;
}

export function observeGuardWatch(step: GuardWatchStep, actor: AlternatingActor, first: NativeRows, second: NativeRows,
  floor: number, ref: string) {
  const destination = box(step.to, actor.size);
  if (!equal(alternatingHistogram(second, destination), actor.histogram)
    || !equal(alternatingHistogram(second, actor.bbox), [[floor, actor.size ** 2]])) return null;
  const matches = alternatingOverlays(second).filter(piece => piece.size === actor.size &&
    piece.histogram.some(([ink, count]) => ink === step.body && count === actor.size ** 2 - 1));
  if (matches.length !== 1) return null;
  const next = matches[0]!, position: Point = [next.bbox[0], next.bbox[1]];
  if (!step.alternatives.some(candidate => key(position) === key(candidate))) return null;
  const allowed = [actor.bbox, destination, step.guard.bbox, next.bbox];
  for (let y = 1; y < first.length - 1; y++) for (let x = 1; x < first[y]!.length - 1; x++) {
    if (first[y]![x] !== second[y]?.[x] && !allowed.some(([t, l, b, r]) => t <= y && y <= b && l <= x && x <= r)) return null;
  }
  const changedMark = !equal(next.histogram, step.guard.histogram);
  const moved = key(position) !== key(step.guard.position);
  return { watch: { body: step.body, target: step.target, evidence: [...step.evidence.slice(-4), ref] },
    reason: moved ? 'guard_movement_observed' : changedMark ? 'guard_marker_changed_in_place' : 'guard_remained_in_place' };
}
