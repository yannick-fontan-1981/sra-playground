import type { NativePoint } from '../logos-engine/v6-native-types.ts';

type CoverageEdge<T> = { point: NativePoint; visits: number; step: T };
const key = (point: NativePoint, visits: number) => point.join(',') + '/' + visits;

/** A position reached with new visits is a different planning state. */
export function searchCoverageRoute<T>(start: NativePoint, goal: NativePoint, acquired: number, required: number,
  edges: (position: NativePoint, first: boolean) => Iterable<CoverageEdge<T>>, limit = 8192,
): T[] | null {
  const queue: { point: NativePoint; visits: number; path: T[] }[] = [{ point: start, visits: acquired, path: [] }];
  const seen = new Set([key(start, acquired)]);
  for (const item of queue) {
    for (const { point, visits, step } of edges(item.point, item.path.length === 0)) {
      const coverage = visits | item.visits;
      const path = [...item.path, step];
      if (point[0] === goal[0] && point[1] === goal[1]) {
        if (coverage === required) return path;
        continue;
      }
      const identity = key(point, coverage);
      if (seen.has(identity)) continue;
      if (seen.size >= limit) return null;
      seen.add(identity);
      queue.push({ point, visits: coverage, path });
    }
  }
  return null;
}
