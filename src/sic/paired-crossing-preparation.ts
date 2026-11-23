import type { Scene, Reading } from './paired-scene.ts';
import { surrounding } from './paired-scene.ts';
import { neighbor } from './transport-observations.ts';
export type Link = {
  head: number;
  tail: number;
  dx: number;
  dy: number;
  water: number[];
};
export function joinSeparatedOperators(s: Scene, v: Reading): Link | undefined {
  const dry = new Set([...s.ground, ...v.supports]),
    wet = new Set(s.medium);
  const flood = (p: number) => {
    const q = [p],
      seen = new Set(q);
    for (const x of q)
      for (const z of surrounding(s.grid, x))
        if (dry.has(z) && !seen.has(z)) {
          seen.add(z);
          q.push(z);
        }
    return seen;
  };
  const first = flood(v.subjects[0]);
  if (first.has(v.subjects[1]) || s.goals.some((p) => first.has(p))) return;
  const second = flood(v.subjects[1]);
  if (s.goals.some((p) => second.has(p))) return;
  const options: Link[] = [];
  for (const p of first)
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const water = [];
      let z = neighbor(s.grid, p, dx, dy);
      while (wet.has(z) && !dry.has(z)) {
        water.push(z);
        z = neighbor(s.grid, z, dx, dy);
      }
      if (water.length && water.length <= v.pieces.length && second.has(z))
        options.push({ head: p, tail: z, dx, dy, water });
    }
  const rank = (l: Link) => l.water.length * 10 + delivery(s, l, v);
  return options.sort((a, b) => rank(a) - rank(b))[0];
}
export function delivery(s: Scene, l: Link, v: Reading) {
  const missing = l.water.filter((p) => !v.supports.includes(p)).length;
  if (!missing) return 0;
  const w = s.grid.columns,
    xy = (p: number) => [p % w, Math.floor(p / w)] as const;
  const candidates = v.pieces
    .map((p) => {
      const [x, y] = xy(p);
      const ends = [l.head, l.tail].map((z, i) => {
        const [a, b] = xy(z),
          sign = i ? -1 : 1;
        const axial = ((a - x) * l.dx + (b - y) * l.dy) * sign,
          offset = Math.abs((a - x) * l.dy - (b - y) * l.dx);
        if (axial < 0) return 120 + offset + Math.abs(axial);
        const stance = neighbor(s.grid, p, -sign * l.dx, -sign * l.dy);
        const actor = v.subjects.map(
          (n) =>
            Math.abs((n % w) - (stance % w)) +
            Math.abs(Math.floor(n / w) - Math.floor(stance / w)),
        );
        return 5 * offset + 0.65 * axial + 0.45 * Math.min(...actor);
      });
      return Math.min(...ends);
    })
    .sort((a, b) => a - b);
  return (
    22 * missing +
    candidates.slice(0, missing).reduce((sum, n) => sum + n, 0) +
    45 * Math.max(0, missing - candidates.length)
  );
}
