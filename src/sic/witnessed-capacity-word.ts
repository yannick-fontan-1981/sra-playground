import type { Memory, Edge } from './preparation-experiments.ts';
import { point, type XY } from './access-terrain.ts';
import type { Role } from './exchange-roles.ts';
import type { WordEffect } from './conditional-word-search.ts';

export function observedPositionAfter(m: Memory, e: Edge, role: Role): XY | null {
  const all = m.frames?.duplicates?.[e.t]?.[role.signature];
  if (all && all.length === role.fixed.length + 1 && role.fixed.every((p) => all.includes(p))) {
    const v = all.find((p) => !role.fixed.includes(p));
    if (v) return point(v);
  }
  if (role.fixed.length) return null;
  const moved = e.effect.moves.find((v) => v.actor === role.signature);
  if (moved) return point(moved.to);
  const seen = e.anchors[role.signature]?.at;
  if (
    seen &&
    e.visibleAfter?.includes(role.signature) &&
    !e.manipulation?.changedClasses.includes(role.signature)
  )
    return point(seen);
  return null;
}
// Look up a contiguous word already played in this episode. Each use binds the actual chronological revisions;
// graph paths pieced together from different visits cannot act as experimental controls.
export function witnessedWord(
  m: Memory,
  rootFrame: string,
  word: string[],
  revision: number,
  actor: string,
  site: Role,
  prepared: boolean
): WordEffect | null {
  const history = m.delayed.history;
  if (!word.length || word.length > history.length) return null;
  const patient = { signature: actor, fixed: [] };
  for (let start = history.length - word.length; start >= 0; start--) {
    const first = m.edges[history[start]!]!;
    if (first.cmd !== word[0] || !m.scenes[first.s]?.startsWith(rootFrame + '|')) continue;
    let next = first.s,
      valid = true;
    for (const [j, op] of word.entries()) {
      const e = m.edges[history[start + j]!]!,
        ref = revision - history.length + start + j + 1;
      if (
        !e.stable ||
        e.s !== next ||
        e.cmd !== op ||
        m.revisionScene[ref - 1] !== e.s ||
        m.revisionScene[ref] !== e.t
      ) {
        valid = false;
        break;
      }
      next = e.t;
    }
    if (!valid) continue;
    const final = m.edges[history[start + word.length - 1]!]!;
    return {
      patient: observedPositionAfter(m, final, patient),
      marker: observedPositionAfter(m, final, site),
      frame: rootFrame,
      entered: false,
      win: false,
      afterFirst: prepared ? { p: observedPositionAfter(m, first, patient), r: observedPositionAfter(m, first, site) } : null,
      ref: revision - history.length + start + word.length,
    };
  }
  return null;
}
