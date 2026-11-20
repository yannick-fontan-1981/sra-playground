import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, point, same, size, terrain, type XY } from './access-terrain.ts';
import type { Edge, Memory } from './preparation-experiments.ts';

export type Stroke = { op: string; d: XY; ref: number; support: number };
export type Rim = { p: XY; at: XY; stroke: Stroke; tested: number | null; distance: number };
export type Territory = {
  actor: string;
  from: XY;
  origin: XY;
  ground: number;
  width: number;
  stride: XY;
  ops: Stroke[];
  seen: Set<string>;
  basis: 'substrate' | 'failed_stroke';
  home: Set<number>;
  initialRegion: Set<number> | null;
  foreign: Set<number>;
  foothold: XY;
  rim: Rim;
  alternatives: number;
  route: Map<number, { prev: number; stroke: Stroke }>;
  score: number;
};
const key = (p: XY, w: number) => p[1] * w + p[0];
const xy = (i: number, w: number): XY => [i % w, Math.floor(i / w)];
export const terrainKey = key;
type Dynamics = {
  origin: XY;
  seen: Set<string>;
  strokes: Map<string, Map<string, { d: XY; origins: Set<string>; ref: number }>>;
};
function dynamics(edges: Edge[]) {
  const roles = new Map<string, Dynamics>();
  for (const e of edges)
    if (e.stable)
      for (const v of e.effect.moves) {
        const d: XY = [v.dx, v.dy];
        if ((d[0] === 0) === (d[1] === 0)) continue;
        let role = roles.get(v.actor);
        if (!role) {
          role = { origin: point(v.from), seen: new Set(), strokes: new Map() };
          roles.set(v.actor, role);
        }
        role.seen.add(v.from);
        role.seen.add(v.to);
        const moves = role.strokes.get(e.cmd) ?? new Map(),
          k = d.join(),
          g = moves.get(k) ?? { d, origins: new Set<string>(), ref: e.ref };
        g.origins.add(v.from);
        moves.set(k, g);
        role.strokes.set(e.cmd, moves);
      }
  for (const [id, role] of roles) {
    let first = true;
    for (const e of edges) {
      if (!e.stable) continue;
      const prior = e.anchors[id]?.at;
      if (prior) {
        role.seen.add(prior);
        if (first) {
          role.origin = point(prior);
          first = false;
        }
      }
      const move = e.effect.moves.find((v) => v.actor === id);
      if (move) role.seen.add(move.to);
    }
  }
  return roles;
}
function ordinary(r: Dynamics) {
  const offers: Stroke[] = [];
  for (const [op, options] of r.strokes) {
    const by = [...options.values()].sort((a, b) => b.origins.size - a.origins.size || size(a.d) - size(b.d));
    const best = by[0]!;
    offers.push({ op, d: best.d, ref: best.ref, support: best.origins.size });
  }
  const step = (axis: 0 | 1) =>
    offers.filter((v) => v.d[axis] !== 0).sort((a, b) => b.support - a.support || size(a.d) - size(b.d))[0]
      ?.d[axis];
  const x = Math.abs(step(0) ?? 0),
    y = Math.abs(step(1) ?? 0);
  if (!x || !y) return null;
  const ops = offers.filter((v) => Math.abs(v.d[0]) === x || Math.abs(v.d[1]) === y);
  return ops.length >= 2 && r.seen.size >= 4 ? { stride: [x, y] as XY, ops } : null;
}
function atRole(e: Edge, sig: string): XY | null {
  return e.anchors[sig] ? point(e.anchors[sig]!.at) : null;
}
function chart(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  actor: NativeEntity,
  r: Dynamics,
  mobile: Set<string>
): Territory[] {
  const model = ordinary(r);
  if (!model || !m.space.floor[actor.signature]) return [];
  const { stride, ops } = model,
    w = rows[0]!.length,
    h = rows.length,
    from: XY = [...actor.position],
    origin = r.origin;
  const ground = terrain(rows, actor, mobile, o, m.space.floor);
  if (ground.ground < 0) return [];
  const legal = new Set<number>();
  const maxX = w - (actor.bbox[2] - actor.bbox[0] + 1),
    maxY = h - (actor.bbox[3] - actor.bbox[1] + 1);
  for (let y = from[1] % stride[1]; y <= maxY; y += stride[1])
    for (let x = from[0] % stride[0]; x <= maxX; x += stride[0]) {
      const p: XY = [x, y];
      if (ground.region(p) > 0 || r.seen.has(p.join())) legal.add(key(p, w));
    }
  const here = key(from, w);
  if (!legal.has(here)) return [];
  const steps: XY[] = [
    [stride[0], 0],
    [-stride[0], 0],
    [0, stride[1]],
    [0, -stride[1]],
  ];
  const neighbour = (p: XY, d: XY) => {
    const t = add(p, d);
    return t[0] >= 0 && t[0] <= maxX && t[1] >= 0 && t[1] <= maxY ? key(t, w) : -1;
  };
  const regions = new Map<number, Set<number>>(),
    remaining = new Set(legal);
  for (const start of legal) {
    if (!remaining.delete(start)) continue;
    const component = new Set([start]),
      queue = [start];
    for (const cell of queue) {
      const p = xy(cell, w);
      for (const d of steps) {
        const dest = neighbour(p, d);
        if (remaining.delete(dest)) {
          component.add(dest);
          queue.push(dest);
        }
      }
    }
    for (const cell of component) regions.set(cell, component);
  }
  const home = regions.get(here)!;
  const known = new Set<Set<number>>([home]);
  for (const e of m.edges)
    if (e.stable) {
      const a = atRole(e, actor.signature);
      if (a) {
        const zone = regions.get(key(a, w));
        if (zone) known.add(zone);
      }
      const mv = e.effect.moves.find((v) => v.actor === actor.signature);
      if (mv) {
        const zone = regions.get(key(point(mv.to), w));
        if (zone) known.add(zone);
      }
    }
  const candidates = [...new Set(regions.values())]
    .filter((c) => !known.has(c) && c.size >= 2)
    .map((foreign) => ({ foreign, accessible: home, basis: 'substrate' as 'substrate' | 'failed_stroke' }));
  const stops = new Map<string, number>(),
    passed = new Set<string>();
  for (const e of m.edges)
    if (e.stable && ops.some((v) => v.op === e.cmd)) {
      const at = atRole(e, actor.signature);
      if (!at) continue;
      const edgeKey = at.join() + '/' + e.cmd;
      const move = e.effect.moves.find((v) => v.actor === actor.signature);
      if (move) {
        passed.add(edgeKey);
        continue;
      }
      if (
        e.visibleAfter?.includes(actor.signature) &&
        !e.manipulation?.changedClasses.includes(actor.signature)
      )
        stops.set(edgeKey, e.ref);
    }
  const route = new Map<number, { prev: number; stroke: Stroke }>(),
    travel = [here];
  for (const cell of travel) {
    const p = xy(cell, w);
    for (const v of ops) {
      const dest = neighbour(p, v.d),
        edgeKey = p.join() + '/' + v.op;
      if (!home.has(dest) || dest === here || route.has(dest) || (stops.has(edgeKey) && !passed.has(edgeKey)))
        continue;
      route.set(dest, { prev: cell, stroke: v });
      travel.push(dest);
    }
  }
  // Two surfaces can look connected even though a command repeatedly stops at their boundary.
  // Preserve the accessible side and split off only unvisited patches behind an observed stop.
  const accessible = new Set(travel),
    unseen = new Set([...home].filter((k) => !accessible.has(k)));
  const witnessed = new Set([...r.seen].map((k) => key(point(k), w)));
  for (const edge of m.edges) {
    const at = atRole(edge, actor.signature);
    if (at) witnessed.add(key(at, w));
  }
  for (const start of unseen) {
    if (!unseen.delete(start)) continue;
    const patch = new Set([start]),
      queue = [start];
    let visited = witnessed.has(start);
    for (const k of queue) {
      const p = xy(k, w);
      for (const d of steps) {
        const next = neighbour(p, d);
        if (!unseen.delete(next)) continue;
        queue.push(next);
        patch.add(next);
        if (witnessed.has(next)) visited = true;
      }
    }
    if (visited || patch.size < 2) continue;
    const barrier = travel.some((k) => {
      const p = xy(k, w);
      return ops.some((v) => {
        const id = p.join() + '/' + v.op;
        return stops.has(id) && !passed.has(id) && patch.has(neighbour(p, v.d));
      });
    });
    if (barrier) candidates.push({ foreign: patch, accessible, basis: 'failed_stroke' });
  }
  const results: Territory[] = [];
  for (const { foreign, accessible: currentHome, basis } of candidates) {
    let best: Territory | null = null;
    const dist = new Int16Array(w * h);
    dist.fill(-1);
    const closest = new Int32Array(w * h),
      queue = [...foreign];
    for (const k of queue) {
      dist[k] = 0;
      closest[k] = k;
    }
    for (const k of queue) {
      const p = xy(k, w);
      for (const d of steps) {
        const n = neighbour(p, d);
        if (n >= 0 && dist[n] === -1) {
          dist[n] = dist[k]! + 1;
          closest[n] = closest[k]!;
          queue.push(n);
        }
      }
    }
    for (const k of travel) {
      const p = xy(k, w);
      for (const v of ops) {
        const dest = neighbour(p, v.d);
        if (dest < 0 || currentHome.has(dest) || dist[dest]! < 0 || dist[dest]! >= dist[k]!) continue;
        const edgeKey = p.join() + '/' + v.op,
          tested = !passed.has(edgeKey) ? (stops.get(edgeKey) ?? null) : null;
        if (basis === 'failed_stroke' && (tested === null || !foreign.has(dest))) continue;
        const pending = m.territory?.goal,
          retained = pending?.actor === actor.signature && foreign.has(key(pending.foothold, w));
        const score =
          (retained ? 8 : 0) +
          (tested !== null ? 6 : 0) +
          Math.log2(1 + foreign.size) -
          dist[k]! * 1.4 -
          (Math.abs(p[0] - from[0]) / stride[0] + Math.abs(p[1] - from[1]) / stride[1]) * 0.1 +
          Math.log2(1 + r.seen.size);
        if (best && best.score >= score) continue;
        best = {
          actor: actor.signature,
          from,
          origin,
          ground: ground.ground,
          width: w,
          stride,
          ops,
          seen: r.seen,
          basis,
          home: currentHome,
          initialRegion: currentHome.has(key(origin, w))
            ? currentHome
            : (regions.get(key(origin, w)) ?? null),
          foreign,
          foothold: xy(closest[k]!, w),
          rim: { p, at: xy(dest, w), stroke: v, tested, distance: dist[k]! },
          alternatives: candidates.length,
          route,
          score,
        };
      }
    }
    if (best) results.push(best);
  }
  return results;
}
export function territorialMaps(m: Memory, o: NativeObservation, rows: NativeRows): Territory[] {
  const by = dynamics(m.edges),
    mobile = new Set(by.keys()),
    maps: Territory[] = [];
  for (const actor of o.entities) {
    const r = by.get(actor.signature);
    if (!r || actor.identity_ambiguous) continue;
    maps.push(...chart(m, o, rows, actor, r, mobile));
  }
  return maps.sort((a, b) => b.score - a.score);
}
export function approach(map: Territory, dest: XY): { op: string; to: XY; ref: number }[] {
  let k = key(dest, map.width);
  const path = [];
  while (map.route.has(k)) {
    const step = map.route.get(k)!;
    path.push({ op: step.stroke.op, to: xy(k, map.width), ref: step.stroke.ref });
    k = step.prev;
  }
  return k === key(map.from, map.width) ? path.reverse() : [];
}
