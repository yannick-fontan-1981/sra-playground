import { resolveRole } from '../src/sic/exchange-roles.ts';
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// The transported-endpoint hypothesis comes from the source corpus. Q need never have produced it here.
export function unseenResponse({
  i,
  now,
  known,
  history,
  pairAt,
  sample,
  tried,
  transitions,
  cache,
  available,
}) {
  const candidates = [],
    roles = new Map();
  for (const pool of known.values()) for (const [k, r] of pool) roles.set(k, r);
  const pos = (s, r) => {
    const g = cache.get(s);
    return g ? resolveRole(g, r)?.position : null;
  };
  const latest = transitions.at(-1);
  if (!latest || latest.to !== now.s || latest.from === latest.to) return [];
  for (const [writer, reference] of known.get(latest.op) ?? []) {
    if (reference.fixed.length) continue;
    const anchor = reference.signature,
      write = (history.get(latest.op + '/' + writer) ?? []).findLast(
        (e) => e.afterScene === now.s && e.scene === latest.from && !eq(e.from, e.to)
      );
    if (!write) continue;
    for (const [id, role] of roles) {
      if (role.signature === anchor) continue;
      const peer = pairAt(write, role),
        cur = sample(now.g, now.s, role);
      if (
        !peer ||
        !cur ||
        !eq(peer.from, peer.to) ||
        !eq(peer.to, cur.from) ||
        !eq(cur.anchors.get(anchor), write.to) ||
        eq(cur.from, write.to)
      )
        continue;
      for (const q of available) {
        if (q === latest.op) continue;
        const key = JSON.stringify([role, anchor, q, cur.from, write.to]);
        if (tried.has(key)) continue;
        const witnesses = transitions.filter((t) => t.op === q);
        if (witnesses.some((t) => t.from === now.s)) continue;
        const previous = witnesses
          .map((t) => ({ t, from: pos(t.from, role), to: pos(t.to, role), r: pos(t.from, reference) }))
          .filter((v) => v.from && v.to);
        if (previous.some((v) => v.r && eq(v.to, v.r) && !eq(v.from, v.to))) continue;
        const counter =
          previous.findLast((v) => v.t.from === write.scene) ??
          previous.findLast((v) => eq(v.from, cur.from)) ??
          previous.at(-1);
        const ordinary = counter
          ? [cur.from[0] + counter.to[0] - counter.from[0], cur.from[1] + counter.to[1] - counter.from[1]]
          : cur.from;
        if (eq(ordinary, write.to)) continue;
        // Target an endpoint previously occupied by another role, favouring a physically matched unsuccessful use of Q.
        const limit = distance(write.from, write.to);
        const score =
          (counter?.t.from === write.scene ? 12 : 0) +
          (counter && eq(counter.from, cur.from) ? 5 : 0) +
          (counter && eq(counter.from, counter.to) ? 3 : 0) +
          (!previous.length ? 1 : 0) +
          (distance(cur.from, write.to) > limit ? 1 : 0) +
          1 / (1 + role.fixed.length);
        candidates.push({
          basis: 'unseen_response',
          i: i + 1,
          root: now.s,
          baseline: write.scene,
          write: write.index,
          sample: counter?.t.index ?? null,
          priorCount: 0,
          a: latest.op,
          q,
          role,
          anchor,
          from: cur.from,
          before: write.from,
          placed: write.to,
          offset: [0, 0],
          to: write.to,
          without: write.from,
          world: cur.from,
          relative: ordinary,
          score,
          key,
          knownControl: counter?.t.from === write.scene,
          seenQ: witnesses.length,
          priorMoves: previous.filter((v) => !eq(v.from, v.to)).length,
        });
      }
    }
  }
  return candidates.sort((a, b) => b.score - a.score);
}
