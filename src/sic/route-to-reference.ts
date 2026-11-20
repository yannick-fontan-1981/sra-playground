import { add, diff, point, same, size, type XY } from './access-terrain.ts';
import type { Role } from './exchange-roles.ts';
import type { InversePlan } from './inverse-frame-sites.ts';
import type { Edge, Memory } from './preparation-experiments.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ReferenceRecipe = {
  q: string;
  role: Role;
  anchor: string;
  offset: XY;
  refs: number[];
  placement: XY;
};
export type ReferenceStep = { op: string; ref: number; source: number; target: number; at: XY; patient: XY };

// Only the final probe is unmeasured. Every step of the approach has a witnessed start and finish.
export function routeToReference(
  m: Memory,
  o: NativeObservation,
  start: number,
  rows: NativeRows,
  recipes: ReferenceRecipe[]
): InversePlan[] {
  if (!recipes.length) return [];
  const outgoing = new Map<number, Edge[]>(),
    incoming = new Map<number, Edge>();
  for (const e of m.edges)
    if (e.stable) {
      const list = outgoing.get(e.s) ?? [];
      list.push(e);
      outgoing.set(e.s, list);
      incoming.set(e.t, e);
    }
  const paths = new Map<string, Map<number, Edge[]>>();
  function approaches(q: string) {
    if (paths.has(q)) return paths.get(q)!;
    const path = new Map<number, Edge[]>([[start, []]]),
      queue = [start];
    for (const s of queue)
      for (const e of outgoing.get(s) ?? []) {
        if (e.cmd === q || path.has(e.t)) continue;
        path.set(e.t, [...path.get(s)!, e]);
        queue.push(e.t);
      }
    paths.set(q, path);
    return path;
  }
  const samples = new Map<string, XY | null>();
  function pose(s: number, role: Role): XY | null {
    const key = JSON.stringify([s, role]);
    if (samples.has(key)) return samples.get(key)!;
    let at: XY | null = null;
    if (role.fixed.length) {
      const group = m.frames?.duplicates?.[s]?.[role.signature];
      if (group?.length === role.fixed.length + 1 && role.fixed.every((k) => group.includes(k))) {
        const v = group.find((k) => !role.fixed.includes(k));
        if (v) at = point(v);
      }
    } else {
      const edge = outgoing.get(s)?.find((e) => e.anchors[role.signature]);
      if (edge) at = point(edge.anchors[role.signature]!.at);
      else if (incoming.has(s)) {
        const prev = incoming.get(s)!,
          move = prev.manipulation?.moves.find(
            (v) => v.role.signature === role.signature && !v.role.fixed.length
          );
        if (move) at = move.to;
        else if (
          prev.manipulation &&
          prev.visibleAfter?.includes(role.signature) &&
          prev.anchors[role.signature] &&
          !prev.manipulation.changedClasses.includes(role.signature)
        )
          at = point(prev.anchors[role.signature]!.at);
      }
      if (!at && s === start) {
        const e = o.entities.find((e) => e.signature === role.signature && !e.identity_ambiguous);
        if (e) at = [...e.position];
      }
    }
    samples.set(key, at);
    return at;
  }
  const small = new Set(
    o.entities
      .filter((e) => !e.identity_ambiguous && e.area <= (rows.length * rows[0]!.length) / 10)
      .map((e) => e.signature)
  );
  const offers: InversePlan[] = [];
  for (const recipe of recipes) {
    const { q, role, anchor, offset } = recipe,
      reference = { signature: anchor, fixed: [] },
      from = pose(start, role),
      at = pose(start, reference);
    if (!from || !at) continue;
    const direct = add(at, offset);
    const visited = new Set<string>(),
      moves: { e: Edge; from: XY; to: XY }[] = [];
    for (const e of m.edges)
      if (e.stable) {
        const u = pose(e.s, role),
          v = pose(e.t, role);
        if (!u || !v || same(u, v)) continue;
        if (e.cmd === q) visited.add(v.join());
        else moves.push({ e, from: u, to: v });
      }
    for (const [s, edges] of approaches(q)) {
      if (!edges.length) continue;
      const available = m.scenes[s]?.split('|')[1]?.split(',') ?? [];
      if (!available.includes(q.split(':')[0]!) || outgoing.get(s)?.some((e) => e.cmd === q)) continue;
      const placement = pose(s, reference),
        patient = pose(s, role);
      if (!placement || !patient || same(placement, at) || same(placement, recipe.placement)) continue;
      const to = add(placement, offset);
      if (
        to[0] < 0 ||
        to[1] < 0 ||
        to[0] >= rows[0]!.length ||
        to[1] >= rows.length ||
        same(to, patient) ||
        same(to, direct) ||
        visited.has(to.join())
      )
        continue;
      const key = JSON.stringify(['route', q, role, anchor, placement, patient, to]);
      if (m.frames!.tried[key] !== undefined) continue;
      const via: ReferenceStep[] = [];
      for (const e of edges) {
        const p = pose(e.t, role),
          r = pose(e.t, reference);
        if (!p || !r) break;
        via.push({ op: e.cmd, ref: e.ref, source: e.s, target: e.t, at: r, patient: p });
      }
      if (via.length !== edges.length) continue;
      let goal: XY | null = null,
        gain = 0;
      for (const sig of small) {
        if (sig === anchor || sig === role.signature) continue;
        const v = pose(s, { signature: sig, fixed: [] });
        if (!v) continue;
        const d2 = size(diff(to, v)),
          g = (size(diff(direct, v)) - d2) / (1 + d2);
        if (g > gain) {
          goal = v;
          gain = g;
        }
      }
      const next = moves
        .filter((v) => same(v.from, to) && !same(v.to, patient))
        .sort((v, w) => w.e.ref - v.e.ref)[0];
      const follow = next ? { op: next.e.cmd, to: next.to, refs: [next.e.ref], score: 1 } : null;
      const cheap = moves.some((v) => same(v.from, from) && same(v.to, to));
      const score = Math.min(12, gain) + (follow ? 4 : 0) + (cheap ? 0 : 3) - Math.log2(1 + edges.length);
      if (!goal && !follow) continue;
      offers.push({
        i: o.revision,
        root: start,
        role,
        anchor,
        at,
        from,
        placement,
        patient,
        to,
        direct,
        goal,
        solved: null,
        axes: [anchor, anchor],
        offset,
        a: edges[0]!.cmd,
        q,
        length: edges.length,
        refs: recipe.refs,
        actuatorRefs: via.map((v) => v.ref),
        novel: true,
        key,
        score,
        follow,
        via,
      });
    }
  }
  const seen = new Set<string>();
  return offers
    .sort((a, b) => b.score - a.score)
    .filter((p) => {
      const k = JSON.stringify([p.role, p.to]);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 2);
}
