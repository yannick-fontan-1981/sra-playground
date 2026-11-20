import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import type { VisualLayout, PreviewLearning, PreviewWitness } from './witnessed-preview-transfer.ts';
import type { Motor } from './local-progress.ts';

type Stroke = { d: XY; count: number; last: string; first: string };
export type PartMotion = {
  axes: Record<string, Record<string, Stroke>>;
  displacements?: Record<string, Record<string, Stroke>>;
  sites: Record<string, number>;
  substrate: Record<string, number>;
};
export type Pivot = { role: string; at: XY };
export type WitnessGeometry = { pivots: Pivot[] };
export function rememberMotion(
  learning: PreviewLearning,
  role: string,
  from: XY,
  to: XY,
  q: string,
  b: NativeObservation,
  a: NativeObservation
) {
  const m = ((learning.partMotion ??= {})[role] ??= { axes: {}, sites: {}, substrate: {} });
  m.sites[from.join()] = a.revision;
  m.sites[to.join()] = a.revision;
  if (q.startsWith('ACTION6:')) return;
  const d = diff(to, from);
  const raw = ((m.displacements ??= {})[q] ??= {}),
    all = (raw[d.join()] ??= { d, count: 0, first: b.observation_ref, last: '' });
  if (all.last !== b.frame_hash) {
    all.count++;
    all.last = b.frame_hash;
  }
  if ((d[0] === 0) === (d[1] === 0)) return;
  const histogram = (m.axes[q] ??= {}),
    v = (histogram[d.join()] ??= { d, count: 0, first: b.observation_ref, last: '' });
  if (v.last !== b.frame_hash) {
    v.count++;
    v.last = b.frame_hash;
  }
}
export function exposedUnderParts(
  learn: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  before: VisualLayout,
  after: VisualLayout
) {
  if (!learn.partMotion) return;
  for (const [role, m] of Object.entries(learn.partMotion)) {
    const u = before[role],
      v = after[role];
    if (!u || !v || u.length !== v.length) continue;
    const gone = u.filter((x) => !v.some((y) => same(x.at, y.at))),
      emerged = v.filter((x) => !u.some((y) => same(x.at, y.at)));
    if (gone.length !== 1 || emerged.length !== 1) continue;
    const at = gone[0]!.at,
      entity = b.entities.find(
        (e) =>
          e.signature === gone[0]!.form && e.bbox[0] + e.bbox[2] === at[0] && e.bbox[1] + e.bbox[3] === at[1]
      );
    if (!entity) continue;
    const colors = new Map<number, number>();
    for (const [dx, dy] of entity.mask) {
      const x = entity.bbox[0] + dx,
        y = entity.bbox[1] + dy,
        c = next[y]?.[x];
      if (c === undefined || rows[y]?.[x] === c) continue;
      if (v.some((z) => x >= z.box[0]! && y >= z.box[1]! && x <= z.box[2]! && y <= z.box[3]!)) continue;
      colors.set(c, (colors.get(c) ?? 0) + 1);
    }
    const majority = [...colors].sort((a, b) => b[1] - a[1])[0];
    if (majority && majority[1] * 2 > [...colors.values()].reduce((x, y) => x + y, 0))
      m.substrate[majority[0]] = (m.substrate[majority[0]] ?? 0) + 1;
  }
}
export function controlledStrokes(m: PartMotion, available: Set<string>, except?: string): Motor[] {
  const modes: Motor[] = [];
  for (const [op, h] of Object.entries(m.axes)) {
    if (op === except || !available.has(op)) continue;
    const v = Object.values(h).sort((a, b) => b.count - a.count || size(a.d) - size(b.d));
    if (!v[0] || (v.length > 1 && v[0].count * 2 <= v.reduce((n, x) => n + x.count, 0))) continue;
    modes.push({ op, d: v[0].d, refs: [] });
  }
  return modes.filter((a) => !modes.some((b) => (a.d[0] === 0) === (b.d[0] === 0) && size(b.d) < size(a.d)));
}
export function aligned(raw: XY, origin: XY, pitch: XY): XY {
  return [
    origin[0] + pitch[0] * Math.round((raw[0] - origin[0]) / pitch[0]),
    origin[1] + pitch[1] * Math.round((raw[1] - origin[1]) / pitch[1]),
  ];
}
export function stationaryPivots(
  p: string,
  r: string,
  from: XY,
  to: XY,
  b: VisualLayout,
  a: VisualLayout
): Pivot[] {
  const result: Pivot[] = [];
  for (const [role, group] of Object.entries(b)) {
    if (role === p || role === r || group.length > 12) continue;
    for (const site of group) {
      if (same(site.at, from) || same(site.at, to) || !a[role]?.some((v) => same(v.at, site.at))) continue;
      // For a rigid symmetry about a stationary centre both arms have the same length.
      const u = diff(from, site.at),
        v = diff(to, site.at),
        gap = Math.abs(Math.hypot(...u) - Math.hypot(...v));
      const tolerance = Math.max(1, site.box[2]! - site.box[0]!, site.box[3]! - site.box[1]!);
      if (gap <= tolerance) result.push({ role, at: site.at });
    }
  }
  return result;
}
export function anchoredSamples(witnesses: PreviewWitness[], role: string, actor: XY, pitch: XY) {
  const out: { actor: XY; centre: XY; indicator: XY; ref: number }[] = [];
  for (const w of witnesses) {
    const samples = [];
    for (const c of w.geometry?.pivots ?? []) {
      if (c.role !== role) continue;
      const centre = aligned(c.at, w.from, pitch),
        origin = diff(w.from, centre),
        arrival = diff(w.arrived, centre);
      if (!size(origin) || !size(arrival) || same(origin, arrival)) continue;
      if (
        !(
          (Math.abs(origin[0]) === Math.abs(arrival[0]) && Math.abs(origin[1]) === Math.abs(arrival[1])) ||
          (Math.abs(origin[0]) === Math.abs(arrival[1]) && Math.abs(origin[1]) === Math.abs(arrival[0]))
        )
      )
        continue;
      samples.push({ actor: add(actor, origin), centre: actor, indicator: add(actor, arrival), ref: 0 });
    }
    // Two identical pieces can both fit one reading. Keep the closest valid origin only if unique.
    samples.sort((a, b) => size(diff(a.actor, actor)) - size(diff(b.actor, actor)));
    if (
      samples.length &&
      (!samples[1] || size(diff(samples[0]!.actor, actor)) < size(diff(samples[1].actor, actor)))
    )
      out.push(samples[0]!);
  }
  return out;
}
