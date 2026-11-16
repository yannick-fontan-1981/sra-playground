import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type CoverageEdge<T> = { point: NativePoint; visits: number; step: T; uses?: number };
const key = (point: NativePoint, visits: number, spent: number) => point.join(',') + '/' + visits + '/' + spent;

/** A position reached with different visits or available supports is a different planning state. */
export function searchCoverageRoute<T>(start: NativePoint, goal: NativePoint, acquired: number, required: number,
  edges: (position: NativePoint, first: boolean, spent: number) => Iterable<CoverageEdge<T>>, limit = 8192,
): T[] | null {
  const queue: { point: NativePoint; visits: number; spent: number; path: T[] }[] = [{ point: start, visits: acquired, spent: 0, path: [] }];
  const seen = new Set([key(start, acquired, 0)]);
  for (const item of queue) {
    for (const { point, visits, step, uses = 0 } of edges(item.point, item.path.length === 0, item.spent)) {
      const coverage = visits | item.visits;
      const spent = item.spent | uses;
      const path = [...item.path, step];
      if (point[0] === goal[0] && point[1] === goal[1]) {
        if (coverage === required) return path;
        continue;
      }
      const identity = key(point, coverage, spent);
      if (seen.has(identity)) continue;
      if (seen.size >= limit) return null;
      seen.add(identity);
      queue.push({ point, visits: coverage, spent, path });
    }
  }
  return null;
}
