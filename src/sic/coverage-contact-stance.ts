import { neighbor, type TransportState } from './transport-observations.ts';
import type { Coverage } from './controlled-coverage.ts';

type Kind = 'push' | 'pull' | 'range';
const cardinal = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

// Estimate the remaining work backwards from each desired piece placement.
// Every edge requires an actual standing place for a subject with the corresponding capability.
export function contactStanceCost(
  scene: Pick<Coverage, 'grid' | 'terrain' | 'controls'>,
  kinds: Kind[],
) {
  if (!kinds.includes('push') || !kinds.includes('pull')) return;
  const ground = new Set(scene.terrain),
    infinity = ground.size + 1,
    grid = scene.grid;
  const edges = new Map<
      number,
      { to: number; stand: number; side: number }[]
    >(),
    incoming = new Map<number, number[]>();
  for (const p of ground) {
    const choices = [];
    for (const [dx, dy] of cardinal) {
      const to = neighbor(grid, p, dx, dy);
      if (!ground.has(to)) continue;
      for (const [side, kind] of kinds.entries()) {
        const stand = kind === 'push' ? neighbor(grid, p, -dx, -dy) : to;
        const landing = kind === 'push' ? to : neighbor(grid, to, dx, dy);
        if (!ground.has(stand) || !ground.has(landing)) continue;
        choices.push({ to, stand, side });
        const from = incoming.get(to) ?? [];
        if (!from.includes(p)) from.push(p);
        incoming.set(to, from);
      }
    }
    edges.set(p, choices);
  }
  const remaining = scene.controls.map((goal) => {
    const distances = new Map([[goal, 0]]),
      queue = [goal];
    for (const n of queue)
      for (const prev of incoming.get(n) ?? []) {
        if (distances.has(prev)) continue;
        distances.set(prev, distances.get(n)! + 1);
        queue.push(prev);
      }
    return distances;
  });
  const access = new Map<string, Map<number, number>>();
  function walkTo(s: TransportState, side: number, to: number) {
    const start = s.subjects[side]!,
      id = s.pieces.join(',') + '/' + start;
    let distances = access.get(id);
    if (!distances) {
      distances = new Map([[start, 0]]);
      const queue = [start],
        blocked = new Set(s.pieces);
      for (const n of queue)
        for (const [dx, dy] of cardinal) {
          const k = neighbor(grid, n, dx, dy);
          if (!ground.has(k) || blocked.has(k) || distances.has(k)) continue;
          distances.set(k, distances.get(n)! + 1);
          queue.push(k);
        }
      access.set(id, distances);
    }
    return (
      (distances.get(to) ?? infinity) +
      Number(side !== s.active) +
      Number(s.subjects[1 - side] === to)
    );
  }
  return (s: TransportState) => {
    let best = Infinity;
    for (const order of [
      [0, 1],
      [1, 0],
    ]) {
      let displacements = 0,
        approach = infinity;
      for (const [i, p] of s.pieces.entries()) {
        const distances = remaining[order[i]!]!,
          d = distances.get(p) ?? infinity;
        displacements += d;
        if (!d) continue;
        for (const e of edges.get(p) ?? []) {
          if (
            s.pieces.includes(e.to) ||
            s.pieces.includes(e.stand) ||
            (distances.get(e.to) ?? infinity) >= d
          )
            continue;
          approach = Math.min(approach, walkTo(s, e.side, e.stand));
        }
      }
      best = Math.min(best, 4 * displacements + approach);
    }
    return best;
  };
}
