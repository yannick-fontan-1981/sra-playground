import { bases, type FrameEffect } from './motion-frames.ts';
import { add as sum, diff as sub, same as equal, size } from './access-terrain.ts';
import type { InverseInputs, InversePlan, FrameUse } from './inverse-frame-sites.ts';
export function proposeIdentification({
  i,
  now,
  known,
  history,
  sample,
  rows,
  tried,
  pairAt,
}: InverseInputs): InversePlan[] {
  const offers: InversePlan[] = [];
  for (const [q, roles] of known)
    for (const [id, role] of roles) {
      const h = history.get(q + '/' + id),
        cur = sample(now.g, now.s, role);
      if (!h || !cur) continue;
      const last = h.filter((e) => !equal(e.from, e.to)).at(-1);
      if (!last) continue;
      const stride = size(sub(last.from, last.to)),
        fixed = bases(h, cur).filter((m) => m.object);
      for (const [anchor, at] of cur.anchors) {
        if (anchor === 'world' || anchor === 'self' || fixed.some((m) => m.object === anchor)) continue;
        const before = last.anchors.get(anchor);
        if (!before) continue;
        const offset = sub(last.to, before),
          loose = size(offset);
        if (loose > 2 * Math.max(stride, 2)) continue;
        const anchorId = JSON.stringify([anchor, []]);
        for (const [a] of known) {
          if (a === q) continue;
          const hist = history.get(a + '/' + anchorId) ?? [],
            writes = hist.filter((e) => !equal(e.from, e.to));
          if (!writes.length) continue;
          const others = history.get(a + '/' + id) ?? [];
          const matched = (e: FrameEffect) =>
            pairAt ? pairAt(e, role) : others.find((x) => x.index === e.index);
          const write =
            writes.filter((e) => e.scene === now.s).at(-1) ??
            writes
              .filter((e) => {
                const other = matched(e);
                return equal(e.from, at) && other && equal(other.from, other.to);
              })
              .at(-1) ??
            writes.at(-1)!;
          const peer = matched(write);
          if ((pairAt && !peer) || (peer && !equal(peer.from, peer.to))) continue;
          if (
            pairAt &&
            h.some((e) => {
              const r = e.anchors.get(anchor);
              return r && !equal(e.from, e.to) && !equal(sum(r, offset), e.to);
            })
          )
            continue;
          const delta = sub(write.to, write.from);
          for (const length of [1, 2]) {
            const placement = sum(at, [delta[0] * length, delta[1] * length]),
              dest = sum(placement, offset);
            if (
              [placement, dest].some(
                (v) => v[0] < 0 || v[1] < 0 || v[0] >= rows[0]!.length || v[1] >= rows.length
              )
            )
              continue;
            const self = sum(cur.from, sub(last.to, last.from)),
              world = last.to;
            if (equal(dest, self) || equal(dest, world) || equal(dest, cur.from)) continue;
            const key = JSON.stringify([role, anchor, q, a, placement, dest]);
            if (tried.has(key)) continue;
            const dist = Math.min(size(sub(dest, self)), size(sub(dest, world)));
            const score =
              8 / (1 + loose) +
              Math.min(6, dist / Math.max(1, stride)) +
              (peer ? 4 : 0) +
              (write.scene === now.s ? 6 : equal(write.from, at) ? 3 : 0) -
              length / 2;
            // A second command is committed only when an independently observed stride could extend this arrival.
            let best: FrameUse | null = null;
            for (const [s] of known) {
              if (s === q) continue;
              const prior = (history.get(s + '/' + id) ?? []).filter((e) => !equal(e.from, e.to)).at(-1);
              if (!prior) continue;
              const to = sum(dest, sub(prior.to, prior.from));
              if (to[0] < 0 || to[1] < 0 || to[0] >= rows[0]!.length || to[1] >= rows.length) continue;
              const model = { op: s, to, refs: [prior.index], score: 1 };
              if (!best || prior.index > best.refs[0]!) best = model;
            }
            offers.push({
              i: i + 1,
              root: now.s,
              role,
              anchor,
              at,
              from: cur.from,
              placement,
              patient: cur.from,
              to: dest,
              direct: sum(at, offset),
              goal: null,
              solved: null,
              axes: [anchor, anchor],
              offset,
              a,
              q,
              length,
              refs: [last.index],
              actuatorRefs: [write.index],
              novel: !h.some((e) => equal(e.to, dest)),
              key,
              score,
              follow: best,
              alternatives: { traveller: self, world },
              basis: 'single_response',
              priorMoving: h.filter((e) => !equal(e.from, e.to)).length,
              existingReference: fixed.length > 0,
              pairedSetup: !!peer,
            });
          }
        }
      }
    }
  offers.sort((a, b) => b.score - a.score);
  const selected = [],
    bindings = new Set();
  for (const p of offers) {
    const k = JSON.stringify([p.q, p.role, p.to]);
    if (bindings.has(k)) continue;
    bindings.add(k);
    tried.add(p.key);
    selected.push(p);
    if (selected.length === 2) break;
  }
  return selected;
}
