import type { Edge, Memory } from './preparation-experiments.ts';
import { add, diff, point, same, size, type XY } from './access-terrain.ts';

export type AccessLaw = {
  kind: 'anchor' | 'stride' | 'alignment';
  actor: string;
  anchor: string;
  op: string;
  offset: XY;
  guard?: XY;
  refs: number[];
  starts: string[];
  sites: string[];
  deltas: string[];
  reciprocal: boolean;
};
export const lawId = (l: AccessLaw) => [l.kind, l.actor, l.anchor, l.op, l.offset, l.guard ?? ''].join('/');
export function landing(l: AccessLaw, p: XY, q: XY) {
  if (l.guard && !same(diff(q, p), l.guard)) return null;
  return add(l.kind === 'anchor' ? q : p, l.offset);
}
const at = (e: Edge, id: string) => e.anchors[id]?.at;
export function accessLaws(m: Memory, present: Set<string>, commands: Set<string>) {
  const laws = new Map<string, AccessLaw>(),
    edges = m.edges.filter((e) => e.stable);
  const outgoing = new Map<number, Edge[]>();
  const motions = new Map<string, number>();
  const vectors = new Map<string, Set<string>>();
  for (const e of edges) {
    const list = outgoing.get(e.s) ?? [];
    list.push(e);
    outgoing.set(e.s, list);
    for (const v of e.effect.moves) {
      motions.set(v.actor, Math.min(motions.get(v.actor) ?? Infinity, Math.abs(v.dx) + Math.abs(v.dy)));
      const key = v.actor + '/' + e.cmd,
        vs = vectors.get(key) ?? new Set();
      vs.add([v.dx, v.dy].join());
      vectors.set(key, vs);
    }
  }
  function witness(l: AccessLaw, from: string, site: string, delta: string) {
    const key = lawId(l),
      prev = laws.get(key);
    if (!prev) {
      laws.set(key, { ...l, starts: [from], sites: [site], deltas: [delta] });
      return;
    }
    for (const [arr, v] of [
      [prev.starts, from],
      [prev.sites, site],
      [prev.deltas, delta],
    ] as const)
      if (!arr.includes(v)) arr.push(v);
    prev.reciprocal ||= l.reciprocal;
    for (const r of l.refs) if (prev.refs.length < 4 && !prev.refs.includes(r)) prev.refs.push(r);
  }
  for (const e of edges) {
    if (!commands.has(e.cmd)) continue;
    for (const v of e.effect.moves) {
      if (!present.has(v.actor)) continue;
      const p = point(v.from),
        d: XY = [v.dx, v.dy],
        dest = point(v.to);
      const base = {
        actor: v.actor,
        op: e.cmd,
        refs: [e.ref],
        starts: [],
        sites: [],
        deltas: [],
        reciprocal: false,
      };
      if (
        size(d) >= 2 * motions.get(v.actor)! &&
        (vectors.get(v.actor + '/' + e.cmd)!.size > 1 || e.effect.moves.length > 1)
      )
        witness({ ...base, kind: 'stride', offset: d, anchor: '' }, v.from, v.from, d.join());
      for (const [id, mark] of Object.entries(e.anchors)) {
        if (id === v.actor || !present.has(id) || !motions.has(id)) continue;
        const q = point(mark.at),
          offset = diff(dest, q);
        if (size(offset) > motions.get(v.actor)! || same(p, q)) continue;
        const other = e.effect.moves.find((z) => z.actor === id);
        const reciprocal = !!other && other.dx === -v.dx && other.dy === -v.dy;
        witness({ ...base, kind: 'anchor', anchor: id, offset, reciprocal }, v.from, mark.at, d.join());
      }
    }
  }
  // A changed the relative layout. The traveler's origin and B are identical in both arms.
  for (const prep of edges) {
    if (!prep.effect.moves.length) continue;
    const direct = outgoing.get(prep.s)!,
      ready = outgoing.get(prep.t) ?? [];
    for (const arm of ready) {
      if (!commands.has(arm.cmd) || !arm.effect.moves.length) continue;
      const control = direct.find((e) => e.cmd === arm.cmd);
      if (!control) continue;
      for (const v of arm.effect.moves) {
        if (
          !present.has(v.actor) ||
          !control.visibleAfter?.includes(v.actor) ||
          at(prep, v.actor) !== v.from ||
          at(control, v.actor) !== v.from ||
          prep.effect.moves.some((z) => z.actor === v.actor)
        )
          continue;
        const plain = control.effect.moves.find((z) => z.actor === v.actor);
        if (plain?.to === v.to) continue;
        for (const mark of prep.effect.moves) {
          if (!present.has(mark.actor) || at(arm, mark.actor) !== mark.to) continue;
          const d: XY = [v.dx, v.dy],
            guard = diff(point(mark.to), point(v.from));
          witness(
            {
              kind: 'alignment',
              anchor: mark.actor,
              actor: v.actor,
              op: arm.cmd,
              offset: d,
              guard,
              refs: [control.ref, prep.ref, arm.ref],
              sites: [],
              starts: [],
              deltas: [],
              reciprocal: false,
            },
            v.from,
            mark.to,
            d.join()
          );
        }
      }
    }
  }
  return [...laws.values()].filter(
    (l) => l.kind !== 'anchor' || l.reciprocal || (l.sites.length >= 2 && l.deltas.length >= 2)
  );
}
