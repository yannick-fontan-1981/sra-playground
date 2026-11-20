import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, same, type XY } from './access-terrain.ts';
import type { Territory } from './controllable-territory.ts';
import type { Edge, Memory } from './preparation-experiments.ts';
import type { TerritorialStep } from './pursue-territory.ts';

type Motion = { op: string; d: XY; ref: number; origins: Set<string> };
type Trial = {
  anchor: string;
  at: XY;
  ideal: XY;
  landing: XY;
  program: TerritorialStep[];
  value: number;
  refs: number[];
};
const dist = (a: XY, b: XY, t: Territory) =>
  Math.abs(a[0] - b[0]) / t.stride[0] + Math.abs(a[1] - b[1]) / t.stride[1];
const still = (e: Edge, role: string) =>
  !!e.anchors[role] &&
  !!e.visibleAfter?.includes(role) &&
  !e.effect.moves.some((v) => v.actor === role) &&
  !e.manipulation?.changedClasses.includes(role);

// The desired new ability is still unknown. Invert only what the agent can already do:
// find motor sequences that put a separate, visibly movable part at a useful place.
export function imaginedPlacements(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  t: Territory,
  available: Set<string>
): Trial[] {
  const motions = new Map<string, Map<string, Motion>>(),
    probes = new Map<string, number>();
  for (const e of m.edges) {
    if (!e.stable || !still(e, t.actor)) continue;
    if (e.anchors[t.actor]!.at === t.from.join()) probes.set(e.cmd, e.ref);
    for (const v of e.effect.moves) {
      if (v.actor === t.actor) continue;
      const by = motions.get(v.actor) ?? new Map<string, Motion>();
      const k = JSON.stringify([e.cmd, v.dx, v.dy]),
        motion = by.get(k) ?? { op: e.cmd, d: [v.dx, v.dy] as XY, ref: e.ref, origins: new Set<string>() };
      motion.origins.add(v.from);
      by.set(k, motion);
      motions.set(v.actor, by);
    }
  }
  const trials: Trial[] = [];
  for (const ent of o.entities) {
    const by = motions.get(ent.signature);
    if (!by || ent.identity_ambiguous) continue;
    const at: XY = [...ent.position],
      strokes: Motion[] = [];
    for (const v of Array.from(by.values()).sort((a, b) => b.origins.size - a.origins.size)) {
      if (!available.has(v.op) || strokes.some((s) => s.op === v.op)) continue;
      strokes.push(v);
    }
    if (!strokes.length) continue;
    const stop = m.edges.some((e) => e.stable && still(e, ent.signature) && e.cmd !== strokes[0]!.op);
    const w = t.width,
      maxX = w - 1 - (ent.bbox[2] - ent.bbox[0]),
      maxY = rows.length - 1 - (ent.bbox[3] - ent.bbox[1]);
    const sites: XY[] = [at],
      parents = new Map<string, { parent: XY; step: Motion }>(),
      depth = new Map([[at.join(), 0]]);
    for (const p of sites)
      for (const step of strokes) {
        const dest = add(p, step.d),
          key = dest.join();
        if (dest[0] < 0 || dest[1] < 0 || dest[0] > maxX || dest[1] > maxY || depth.has(key)) continue;
        parents.set(key, { parent: p, step });
        depth.set(key, depth.get(p.join())! + 1);
        sites.push(dest);
      }
    // First test the remote landing and the local embarkation point. Also test their two axis alignments.
    const aims: XY[] = [t.foothold, t.rim.p, t.from, [t.foothold[0], t.from[1]], [t.from[0], t.foothold[1]]];
    const used = new Set<string>();
    for (const aim of aims) {
      let ideal = at;
      for (const p of sites) {
        const d = dist(p, aim, t),
          best = dist(ideal, aim, t);
        if (d < best || (d === best && depth.get(p.join())! < depth.get(ideal.join())!)) ideal = p;
      }
      if (same(ideal, at) || used.has(ideal.join())) continue;
      used.add(ideal.join());
      const program: TerritorialStep[] = [],
        refs: number[] = [];
      let p = ideal;
      while (!same(p, at)) {
        const { parent, step } = parents.get(p.join())!;
        program.push({
          op: step.op,
          stage: 'displace',
          from: t.from,
          marker: parent,
          expectedMarker: p,
          ref: step.ref,
        });
        refs.push(step.ref);
        p = parent;
      }
      program.reverse();
      for (const q of available) {
        if (q.startsWith('ACTION6:') || program.some((step) => step.op === q)) continue;
        const bare = probes.get(q);
        trials.push({
          anchor: ent.signature,
          at,
          ideal,
          landing: t.foothold,
          program: [...program, { op: q, stage: 'land', from: t.from, to: t.foothold }],
          value:
            12 +
            (stop ? 2 : 0) +
            (bare !== undefined ? 3 : 0) +
            (same(ideal, aim) ? 2 : 0) -
            Math.log2(1 + program.length),
          refs: bare !== undefined ? [...refs, bare] : refs,
        });
      }
    }
  }
  return trials;
}
