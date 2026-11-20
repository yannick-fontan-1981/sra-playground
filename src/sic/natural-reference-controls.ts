import { add, diff, same, size, type XY } from './access-terrain.ts';
import type { InverseInputs, InversePlan } from './inverse-frame-sites.ts';
import type { Role } from './exchange-roles.ts';

export type NaturalControl = {
  root: string | number;
  baseline: string | number;
  i: number;
  a: string;
  q: string;
  role: Role;
  anchor: string;
  from: XY;
  before: XY;
  placed: XY;
  offset: XY;
  to: XY;
  without: XY;
  world: XY;
  relative: XY;
  write: number;
  sample: number;
  priorCount: number;
  score: number;
  key: string;
  follow?: { op: string; to: XY; ref: number };
};

export function usePreparedReference(p: NaturalControl): InversePlan {
  return {
    i: p.i,
    root: p.root,
    role: p.role,
    anchor: p.anchor,
    at: p.placed,
    from: p.from,
    placement: p.placed,
    patient: p.from,
    to: p.to,
    direct: p.without,
    goal: null,
    solved: null,
    axes: [p.anchor, p.anchor],
    offset: p.offset,
    a: p.a,
    q: p.q,
    length: 0,
    refs: [p.sample],
    actuatorRefs: [p.write],
    novel: true,
    key: p.key,
    score: p.score,
    follow: p.follow ? { op: p.follow.op, to: p.follow.to, refs: [p.follow.ref], score: 1 } : null,
    basis: 'observed_preparation',
    alternatives: { traveller: p.relative, world: p.world },
    priorMoving: p.priorCount,
    pairedSetup: true,
    beforeReference: p.before,
  };
}

// The preparatory command has already happened. Measuring Q now costs one action.
export function naturalControls({
  now,
  rows,
  known,
  history,
  pairAt,
  sample,
  tried,
  i,
}: InverseInputs): NaturalControl[] {
  if (!pairAt) return [];
  const offers: NaturalControl[] = [];
  for (const [a, writers] of known)
    for (const [writer, reference] of writers) {
      if (reference.fixed.length) continue;
      const write = history
        .get(a + '/' + writer)
        ?.filter((e) => e.afterScene === now.s && !same(e.from, e.to))
        .at(-1);
      if (!write) continue;
      const anchor = reference.signature;
      for (const [q, roles] of known) {
        if (a === q) continue;
        for (const [id, role] of roles) {
          if (role.signature === anchor) continue;
          const h = history.get(q + '/' + id),
            cur = sample(now.g, now.s, role);
          if (!h || !cur || h.some((e) => e.scene === now.s)) continue;
          const at = cur.anchors.get(anchor),
            peer = pairAt(write, role);
          if (!at || !same(at, write.to) || !peer || !same(peer.from, peer.to) || !same(peer.to, cur.from))
            continue;
          // A prior moving use gives a candidate offset. All earlier moving uses with the reference visible must agree.
          const moves = h.filter((e) => e.anchors.has(anchor) && !same(e.from, e.to)),
            prior = moves.at(-1);
          if (!prior) continue;
          const offset = diff(prior.to, prior.anchors.get(anchor)!);
          if (moves.some((e) => !same(add(e.anchors.get(anchor)!, offset), e.to))) continue;
          const to = add(at, offset),
            without = add(write.from, offset),
            relative = add(cur.from, diff(prior.to, prior.from));
          if (
            same(to, without) ||
            same(to, cur.from) ||
            same(to, prior.to) ||
            same(to, relative) ||
            to[0] < 0 ||
            to[1] < 0 ||
            to[0] >= rows[0]!.length ||
            to[1] >= rows.length
          )
            continue;
          const key = JSON.stringify([role, anchor, q, cur.from, at, offset]);
          if (tried.has(key)) continue;
          const sameSubject = same(prior.from, cur.from),
            sameReference = same(prior.anchors.get(anchor)!, write.from);
          const score =
            (sameSubject ? 5 : 0) +
            (sameReference ? 5 : 0) +
            Math.min(4, moves.length) +
            4 / (1 + size(offset));
          offers.push({
            root: now.s,
            baseline: write.scene,
            i: i + 1,
            a,
            q,
            role,
            anchor,
            from: cur.from,
            before: write.from,
            placed: at,
            offset,
            to,
            without,
            relative,
            world: prior.to,
            write: write.index,
            sample: prior.index,
            priorCount: moves.length,
            score,
            key,
          });
        }
      }
    }
  offers.sort((a, b) => b.score - a.score);
  for (const p of offers.slice(0, 2)) {
    const id = JSON.stringify([p.role.signature, p.role.fixed]);
    for (const [op] of known) {
      const effect = history
        .get(op + '/' + id)
        ?.filter((e) => same(e.from, p.to) && !same(e.from, e.to))
        .at(-1);
      if (effect && (!p.follow || effect.index > p.follow.ref))
        p.follow = { op, to: effect.to, ref: effect.index };
    }
  }
  return offers;
}
