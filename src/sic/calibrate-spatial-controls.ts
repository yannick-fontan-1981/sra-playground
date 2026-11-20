import { same, diff, size, type XY } from './access-terrain.ts';
import type { PartMotion } from './controlled-parts.ts';
import type { Motor } from './local-progress.ts';

type Hypothesis = Motor & { basis: 'observed' | 'pooled' | 'untested'; support: number };
export function cellMatches(actual: XY | null, expected: XY, pitch?: XY): boolean {
  return (
    !!actual &&
    (pitch
      ? Math.abs(actual[0] - expected[0]) * 2 < pitch[0] && Math.abs(actual[1] - expected[1]) * 2 < pitch[1]
      : same(actual, expected))
  );
}
// Fit a common spatial unit before proposing missing controls. A proposal never counts as an observed stroke.
export function spatialControls(
  m: PartMotion,
  available: Set<string>,
  read: string,
  failed: Record<string, number>,
  frame: string,
  actor: string
): { pitch: XY; motors: Hypothesis[] } | null {
  const keys = [...available].filter((q) => q !== read && !q.startsWith('ACTION6') && q !== 'RESET'),
    all = m.displacements ?? m.axes,
    counts = new Map<number, number>();
  for (const q of keys)
    for (const v of Object.values(all[q] ?? {})) {
      if ((v.d[0] === 0) === (v.d[1] === 0)) continue;
      counts.set(size(v.d), (counts.get(size(v.d)) ?? 0) + Math.min(8, v.count));
    }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < 2) return null;
  const l = best[0],
    pitch: XY = [l, l],
    axes: XY[] = [
      [l, 0],
      [-l, 0],
      [0, l],
      [0, -l],
    ],
    motors: Hypothesis[] = [];
  const options: { q: string; d: XY; score: number; count: number; basis: Hypothesis['basis'] }[] = [];
  for (const q of keys) {
    const raw = Object.values(all[q] ?? {});
    const scores = axes.map((d) => ({
      d,
      n: raw.filter((v) => cellMatches(v.d, d, pitch)).reduce((n, v) => n + v.count, 0),
      exact: raw.find((v) => same(v.d, d))?.count ?? 0,
    }));
    const total = scores.reduce((n, v) => n + v.n, 0);
    for (const v of scores) {
      if (failed[JSON.stringify(['direction', frame, actor, q, v.d])] !== undefined) continue;
      options.push({
        q,
        d: v.d,
        score: v.n ? (v.n + 0.5) / (total + 1) : 0,
        count: v.n,
        basis: v.n * 2 > total ? (v.exact === v.n ? 'observed' : 'pooled') : 'untested',
      });
    }
  }
  options.sort((a, b) => b.score - a.score || b.count - a.count);
  const used = new Set<string>();
  for (const h of options) {
    if (used.has(h.q) || motors.some((z) => same(z.d, h.d))) continue;
    used.add(h.q);
    motors.push({ op: h.q, d: h.d, refs: [], basis: h.basis, support: h.count });
  }
  return { pitch, motors };
}
export function surfaceFromVisits(
  sites: Record<string, number>,
  rows: readonly (readonly number[])[],
  p: XY,
  pitch: XY,
  occluded: XY[]
) {
  const ballots = new Map<number, number>(),
    cells = new Set<string>();
  for (const raw of Object.keys(sites)) {
    const [x, y] = raw.split(',').map(Number),
      at: XY = [
        p[0] + Math.round((x! - p[0]) / pitch[0]) * pitch[0],
        p[1] + Math.round((y! - p[1]) / pitch[1]) * pitch[1],
      ];
    if (cells.has(at.join()) || occluded.some((v) => cellMatches(at, v, pitch))) continue;
    cells.add(at.join());
    const colors = new Map<number, number>();
    for (let y = Math.ceil((at[1] - pitch[1] / 2) / 2); y < (at[1] + pitch[1] / 2) / 2; y++)
      for (let x = Math.ceil((at[0] - pitch[0] / 2) / 2); x < (at[0] + pitch[0] / 2) / 2; x++) {
        const c = rows[y]?.[x];
        if (c !== undefined) colors.set(c, (colors.get(c) ?? 0) + 1);
      }
    const top = [...colors].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] * 2 > [...colors.values()].reduce((n, v) => n + v, 0))
      ballots.set(top[0], (ballots.get(top[0]) ?? 0) + 1);
  }
  const first = [...ballots].sort((a, b) => b[1] - a[1])[0];
  return first && first[1] >= 2 && first[1] * 2 > [...ballots.values()].reduce((n, v) => n + v, 0)
    ? first[0]
    : null;
}
