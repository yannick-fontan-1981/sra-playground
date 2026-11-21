import { neighbor, type TransportSide } from './transport-observations.ts';
import type { Scene, Reading } from './paired-scene.ts';
export type Projection = {
  pivotForm: string;
  from: number;
  to: number;
  ref: string;
};
type Image = {
  source: number;
  landing: number;
  pivot: number;
  dir: number;
  out: number;
  side: TransportSide | -1;
};
const axes = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;
export function castingSites(s: Scene, p: number, pivot: number) {
  const w = s.grid.columns,
    dx = (p % w) - (pivot % w),
    dy = Math.floor(p / w) - Math.floor(pivot / w);
  if ((dx === 0) === (dy === 0)) return [];
  const dir = axes.findIndex(
    ([x, y]) => x === Math.sign(dx) && y === Math.sign(dy),
  );
  return axes.flatMap(([x, y], out) => {
    if (x * dx + y * dy !== 0) return [];
    const n = neighbor(
      s.grid,
      pivot,
      x * (Math.abs(dx) + Math.abs(dy)),
      y * (Math.abs(dx) + Math.abs(dy)),
    );
    return n >= 0 ? [{ dir, out, landing: n }] : [];
  });
}
function matches(
  s: Scene,
  pivot: number,
  dir: number,
  out: number,
  r: Projection,
) {
  return (
    s.initial[pivot] === r.pivotForm &&
    ((r.from === dir && r.to === out) || (r.to === dir && r.from === out))
  );
}
export function images(s: Scene, v: Reading, rules?: Projection[]): Image[] {
  const result: Image[] = [],
    sites = [...v.subjects, ...v.pieces];
  for (const [i, source] of sites.entries())
    for (const pivot of s.other)
      for (const c of castingSites(s, source, pivot)) {
        if (rules && !rules.some((r) => matches(s, pivot, c.dir, c.out, r)))
          continue;
        if (
          sites.includes(c.landing) ||
          (!s.ground.includes(c.landing) &&
            !s.other.includes(c.landing) &&
            !v.supports.includes(c.landing))
        )
          continue;
        result.push({
          source,
          pivot,
          ...c,
          side: i < 2 ? (i as TransportSide) : -1,
        });
      }
  return result;
}
export function previewLooksLike(
  s: Scene,
  site: number,
  key: string,
  cargo: boolean,
) {
  const a = key.split(',').map(Number),
    mid = Math.floor(a.length / 2),
    h = Math.floor(s.grid.pitch / 2);
  if (s.goals.includes(site) || s.doors.some((d) => d.controls.includes(site)))
    return false;
  if (cargo)
    return (
      a[mid] === s.floor &&
      a[0] !== s.floor &&
      a.every((v, i) => i === mid || v === a[0])
    );
  const center = a[mid];
  return (
    center !== s.floor &&
    !s.bodies.includes(center!) &&
    a.every(
      (v, i) =>
        v ===
        (i % s.grid.pitch === h || Math.floor(i / s.grid.pitch) === h
          ? center
          : s.floor),
    )
  );
}
export function visibleImages(s: Scene, v: Reading, tiles: string[]) {
  return images(s, v).filter((im) =>
    previewLooksLike(s, im.landing, tiles[im.landing]!, im.side === -1),
  );
}
export function applyImages(v: Reading, seen: Image[]) {
  const targets = new Map<number, number>();
  for (const t of seen) {
    if (targets.has(t.source) && targets.get(t.source) !== t.landing) return;
    targets.set(t.source, t.landing);
  }
  if (!targets.size || new Set(targets.values()).size !== targets.size) return;
  const n: Reading = {
    ...v,
    subjects: v.subjects.map((p) => targets.get(p) ?? p) as [number, number],
    pieces: v.pieces.map((p) => targets.get(p) ?? p).sort((a, b) => a - b),
  };
  return n;
}
export function recognizeProjection(
  s: Scene,
  b: Reading,
  a: Reading,
  tiles: string[],
  ref: string,
): Projection[] {
  const possible = visibleImages(s, b, tiles);
  const verified = possible.filter((t) =>
    t.side === -1
      ? !a.pieces.includes(t.source) && a.pieces.includes(t.landing)
      : a.subjects[t.side] === t.landing && b.subjects[t.side] !== t.landing,
  );
  return verified
    .filter(
      (t) =>
        verified.filter((p) => p.source === t.source && p.landing === t.landing)
          .length === 1,
    )
    .map((t) => ({
      pivotForm: s.initial[t.pivot]!,
      from: t.dir,
      to: t.out,
      ref,
    }));
}
export function shortcuts(s: Scene, site: number, rules: Projection[]) {
  return s.other.flatMap((p) =>
    castingSites(s, site, p)
      .filter((c) => rules.some((r) => matches(s, p, c.dir, c.out, r)))
      .map((c) => c.landing),
  );
}
