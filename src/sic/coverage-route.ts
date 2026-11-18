import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type CoverageEdge<T> = { point: NativePoint; visits: number; step: T; uses?: number; phase?: number };
const key = (point: NativePoint, visits: number, spent: number, phase: number) => [point.join(','), visits, spent, phase].join('/');

/** A position reached with different visits or available supports is a different planning state. */
export function searchCoverageRoute<T>(start: NativePoint, goal: NativePoint, acquired: number, required: number,
  edges: (position: NativePoint, first: boolean, spent: number, phase: number) => Iterable<CoverageEdge<T>>,
  limit = 8192, startPhase = 0,
): T[] | null {
  const queue: { point: NativePoint; visits: number; spent: number; phase: number; path: T[] }[] = [
    { point: start, visits: acquired, spent: 0, phase: startPhase, path: [] },
  ];
  const seen = new Set([key(start, acquired, 0, startPhase)]);
  for (const item of queue) {
    for (const { point, visits, step, uses = 0, phase = item.phase } of edges(item.point, item.path.length === 0, item.spent, item.phase)) {
      const coverage = visits | item.visits;
      const spent = item.spent | uses;
      const path = [...item.path, step];
      if (point[0] === goal[0] && point[1] === goal[1]) {
        if (coverage === required) return path;
        continue;
      }
      const identity = key(point, coverage, spent, phase);
      if (seen.has(identity)) continue;
      if (seen.size >= limit) return null;
      seen.add(identity);
      queue.push({ point, visits: coverage, spent, phase, path });
    }
  }
  return null;
}
