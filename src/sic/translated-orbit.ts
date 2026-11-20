import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Memory, Edge } from './preparation-experiments.ts';
import { add, diff, point, size, same, type XY } from './access-terrain.ts';
import type { Territory, Stroke } from './controllable-territory.ts';

const dist = (a: XY, b: XY) => size(diff(a, b));
type Leg = { from: string; to: string; d: XY; op: string; ref: number };
export type OrbitProjection = {
  actor: string;
  from: XY;
  near: XY;
  far: XY;
  at: XY;
  delta: XY;
  foothold: XY;
  target: XY[];
  orbit: XY[];
  origins: number;
  component: number;
  motions: number;
  commands: number;
  signature: string;
  support: number;
  gap: number;
  step: number;
  refs: number[];
  score: number;
};
function connected(graph: Map<string, Set<string>>, start: string) {
  const seen = new Set([start]);
  for (const k of seen) for (const x of graph.get(k) ?? []) seen.add(x);
  return seen;
}
function connect(graph: Map<string, Set<string>>, from: string, to: string) {
  const v = graph.get(from) ?? new Set<string>();
  v.add(to);
  graph.set(from, v);
}
function motionCycle(edges: Edge[], entity: NativeEntity) {
  const id = entity.signature,
    poses = new Set<string>(),
    moves: Leg[] = [],
    graph = new Map<string, Set<string>>(),
    back = new Map<string, Set<string>>();
  for (const e of edges) {
    const anchor = e.anchors[id];
    if (!e.stable || !anchor) continue;
    poses.add(anchor.at);
    const v = e.effect.moves.find((v) => v.actor === id);
    if (!v) continue;
    poses.add(v.to);
    connect(graph, anchor.at, v.to);
    connect(back, v.to, anchor.at);
    moves.push({ from: anchor.at, to: v.to, d: [v.dx, v.dy], op: e.cmd, ref: e.ref });
  }
  const at = entity.position.join();
  if (moves.length < 3 || !graph.has(at)) return null;
  const canReturn = connected(back, at),
    cycle = [...connected(graph, at)].filter((k) => canReturn.has(k));
  if (cycle.length < 3) return null;
  const within = new Set(cycle),
    legs = moves.filter((v) => within.has(v.from) && within.has(v.to));
  const lengths = legs
    .map((v) => size(v.d))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!lengths.length) return null;
  return { poses, legs, step: lengths[Math.floor((lengths.length - 1) / 2)]!, orbit: cycle.map(point) };
}
export function proposedOrbitTransfers(m: Memory, o: NativeObservation, rows: NativeRows): OrbitProjection[] {
  const w = rows[0]!.length,
    h = rows.length,
    groups = new Map<string, NativeEntity[]>(),
    out: OrbitProjection[] = [];
  for (const e of o.entities) {
    const group = groups.get(e.signature) ?? [];
    group.push(e);
    groups.set(e.signature, group);
  }
  const moved = new Map<string, number>();
  for (const edge of m.edges)
    if (edge.stable) for (const v of edge.effect.moves) moved.set(v.actor, (moved.get(v.actor) ?? 0) + 1);
  for (const actor of o.entities) {
    if (actor.identity_ambiguous || (moved.get(actor.signature) ?? 0) < 3) continue;
    const c = motionCycle(m.edges, actor);
    if (!c) continue;
    const { poses, legs, step, orbit } = c;
    const offset: XY = [(actor.bbox[2] - actor.bbox[0]) / 2, (actor.bbox[3] - actor.bbox[1]) / 2];
    const visible = (p: XY) => p[0] >= 0 && p[0] < w - 2 * offset[0] && p[1] >= 0 && p[1] < h - 2 * offset[1];
    const ground = Object.entries(m.space.floor[actor.signature] ?? {}).sort((a, b) => b[1] - a[1])[0];
    const support = (p: XY) =>
      !ground || rows[p[1] + Math.floor(offset[1])]?.[p[0] + Math.floor(offset[0])] === Number(ground[0]);
    for (const [signature, markers] of groups) {
      if (signature === actor.signature || markers.length < 2 || markers.length > 12) continue;
      for (const near of markers) {
        const centre: XY = [
          (near.bbox[0] + near.bbox[2]) / 2 - offset[0],
          (near.bbox[1] + near.bbox[3]) / 2 - offset[1],
        ];
        const at = orbit.reduce((a, b) => (dist(a, centre) <= dist(b, centre) ? a : b));
        if (dist(at, centre) > step * 1.5) continue;
        for (const far of markers) {
          if (far === near) continue;
          const delta = diff([...far.position], [...near.position]),
            foothold = add(at, delta);
          if (!visible(foothold) || poses.has(foothold.join())) continue;
          const raw = orbit.map((p) => add(p, delta));
          if (raw.some((p) => poses.has(p.join()))) continue;
          const target = raw.filter((p) => visible(p) && support(p));
          if (target.length < 2) continue;
          const gap = orbit.reduce((n, p) => Math.min(n, dist(p, foothold)), Infinity);
          if (gap < step * 2) continue;
          let corroborating = 0;
          for (const [other, peers] of groups) {
            if (other === signature || other === actor.signature || peers.length < 2 || peers.length > 12)
              continue;
            if (
              peers.some(
                (a) =>
                  dist([...a.position], [...near.position]) <= step * 3 &&
                  peers.some((b) => same([...b.position], add([...a.position], delta)))
              )
            )
              corroborating++;
          }
          const sealed = target.some((p) => same(p, foothold)) ? target : [foothold, ...target],
            exits = legs.filter((v) => v.from === actor.position.join()).length;
          out.push({
            actor: actor.signature,
            from: [...actor.position],
            near: [...near.position],
            far: [...far.position],
            at,
            delta,
            foothold,
            target: sealed,
            orbit,
            origins: poses.size,
            component: orbit.length,
            motions: legs.length,
            commands: new Set(legs.map((v) => v.op)).size,
            signature,
            support: corroborating,
            gap,
            step,
            refs: [...new Set(legs.map((v) => v.ref))],
            score:
              corroborating * 3 +
              Math.log2(orbit.length) +
              target.length / raw.length +
              Math.min(2, gap / (4 * step)) +
              Math.min(2, exits / 2) -
              dist(at, centre) / step,
          });
        }
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
const recentMaps = new WeakMap<
  Memory,
  { observation: NativeObservation; turn: number; edges: number; maps: Territory[] }
>();
export function orbitTerritories(m: Memory, o: NativeObservation, rows: NativeRows): Territory[] {
  const recent = recentMaps.get(m);
  if (recent?.observation === o && recent.turn === m.turns && recent.edges === m.edges.length)
    return recent.maps;
  const goals = proposedOrbitTransfers(m, o, rows),
    out: Territory[] = [],
    w = rows[0]!.length,
    h = rows.length;
  const key = (p: XY) => p[1] * w + p[0],
    unique = new Set<string>();
  for (const g of goals) {
    const ticket = JSON.stringify([g.actor, g.foothold, g.delta]);
    if (unique.has(ticket)) continue;
    unique.add(ticket);
    const home = new Set(g.orbit.map(key)),
      foreign = new Set(g.target.map(key));
    const refs = new Set(g.refs),
      steps = new Map<string, Stroke>(),
      links = new Map<number, { to: number; stroke: Stroke }[]>(),
      stopped = new Map<string, number>(),
      passed = new Set<string>(),
      seen = new Set<string>();
    let origin: XY | null = null;
    for (const e of m.edges) {
      const a = e.anchors[g.actor];
      if (!e.stable || !a) continue;
      seen.add(a.at);
      origin ??= point(a.at);
      const mv = e.effect.moves.find((v) => v.actor === g.actor),
        edge = a.at + '/' + e.cmd;
      if (!mv) {
        if (e.visibleAfter?.includes(g.actor) && !e.manipulation?.changedClasses.includes(g.actor))
          stopped.set(edge, e.ref);
        continue;
      }
      seen.add(mv.to);
      passed.add(edge);
      if (!refs.has(e.ref)) continue;
      const k = [e.cmd, mv.dx, mv.dy].join('/'),
        stroke = steps.get(k) ?? { op: e.cmd, d: [mv.dx, mv.dy] as XY, ref: e.ref, support: 0 };
      stroke.support++;
      steps.set(k, stroke);
      const from = key(point(mv.from)),
        l = links.get(from) ?? [];
      l.push({ to: key(point(mv.to)), stroke });
      links.set(from, l);
    }
    const ops = [...steps.values()].sort((a, b) => b.support - a.support);
    if (!ops.length) continue;
    const stride: XY = [0, 1].map((j) =>
      Math.min(...ops.map((v) => Math.abs(v.d[j]!)).filter((x) => x > 0), g.step)
    ) as XY;
    const travel = [key(g.from)],
      route: Territory['route'] = new Map();
    for (const p of travel)
      for (const e of links.get(p) ?? []) {
        if (e.to === travel[0] || route.has(e.to)) continue;
        route.set(e.to, { prev: p, stroke: e.stroke });
        travel.push(e.to);
      }
    let rim: Territory['rim'] | null = null,
      best = -Infinity;
    for (const n of travel) {
      const p: XY = [n % w, Math.floor(n / w)];
      for (const s of ops) {
        const next = add(p, s.d);
        if (
          next[0] < 0 ||
          next[0] >= w ||
          next[1] < 0 ||
          next[1] >= h ||
          home.has(key(next)) ||
          dist(next, g.foothold) >= dist(p, g.foothold)
        )
          continue;
        const id = p.join() + '/' + s.op,
          tested = passed.has(id) ? null : (stopped.get(id) ?? null);
        const score =
          (tested !== null ? 7 : 0) - dist(next, g.foothold) / g.step - dist(p, g.from) / (g.step * 4);
        if (score > best) {
          best = score;
          rim = { p, at: next, stroke: s, tested, distance: dist(p, g.foothold) / g.step };
        }
      }
    }
    if (!rim) continue;
    const floor = Object.entries(m.space.floor[g.actor] ?? {}).sort((a, b) => b[1] - a[1])[0];
    out.push({
      actor: g.actor,
      from: g.from,
      origin: origin ?? g.from,
      ground: floor ? Number(floor[0]) : -1,
      width: w,
      stride,
      ops,
      seen,
      basis: 'translated_orbit',
      initialRegion: origin && home.has(key(origin)) ? home : null,
      home,
      foreign,
      foothold: g.foothold,
      rim,
      route,
      score: g.score,
      alternatives: goals.length,
      analogy: {
        near: g.near,
        far: g.far,
        landmark: g.signature,
        shift: g.delta,
        corroborating: g.support,
        refs: g.refs,
      },
    });
  }
  recentMaps.set(m, { observation: o, turn: m.turns, edges: m.edges.length, maps: out });
  return out;
}
