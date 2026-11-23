import type { Reading, Scene } from './paired-scene.ts';
import { md, type Learning } from './paired-displacements.ts';
import { sameSites, type TransportSide } from './transport-observations.ts';

export type ExchangedLandmark = {
  form: string;
  exchanges: Partial<Record<TransportSide, string>>;
  approaches: Partial<Record<TransportSide, string>>;
};

function location(tiles: readonly string[], form: string) {
  const i = tiles.indexOf(form);
  return i >= 0 && tiles.lastIndexOf(form) === i ? i : -1;
}

/** A subject and a previously unclassified glyph traded places in the public images. */
export function readExchangedLandmarks(s: Scene, m: Learning, b: Reading, a: Reading,
  before: string[], after: string[], command: string, ref: string) {
  const side = b.active, from = b.subjects[side], to = a.subjects[side], w = s.grid.columns;
  if (/^ACTION[1-4]$/.test(command) && side === a.active && md(s, from, to) > 1 &&
      (from % w === to % w || Math.floor(from / w) === Math.floor(to / w)) &&
      b.subjects[1-side] === a.subjects[1-side] && sameSites(b.pieces, a.pieces) && sameSites(b.supports, a.supports)) {
    const form = before[to]!;
    if (form === after[from] && s.other.some(p => s.initial[p] === form) &&
        !m.projections?.some(p => p.pivotForm === form) && location(before, form) === to && location(after, form) === from) {
      const known = m.exchangedLandmarks ??= [];
      let item = known.find(x => x.form === form);
      if (!item) { item = { form, exchanges: {}, approaches: {} }; known.push(item); }
      if (!item.exchanges[side]) {
        item.exchanges[side] = ref;
        m.refs = [...m.refs.slice(-5), ref];
        delete m.plan;
      }
    }
  }
  if (!m.exchangedLandmarks?.length) return;
  b.landmarks = m.exchangedLandmarks.map(x => location(before, x.form));
  a.landmarks = m.exchangedLandmarks.map(x => location(after, x.form));
  for (const [i,item] of m.exchangedLandmarks.entries()) {
    const p = a.landmarks[i]!;
    if (p < 0 || b.landmarks[i] !== p) continue;
    for (const who of [0,1] as const) {
      if (md(s, b.subjects[who], p) > 1 && md(s, a.subjects[who], p) === 1)
        item.approaches[who] ??= ref;
    }
  }
}

export function firstUnmeasuredApproach(s: Scene, m: Learning, b: Reading, a: Reading) {
  for (const [i, item] of (m.exchangedLandmarks ?? []).entries()) {
    const p = a.landmarks?.[i];
    if (p === undefined || p < 0 || b.landmarks?.[i] !== p) continue;
    for (const side of [0,1] as const) {
      if (!item.approaches[side] && md(s, b.subjects[side], p) > 1 && md(s, a.subjects[side], p) === 1)
        return { site: p, side, exchange: item.exchanges[0] ?? item.exchanges[1]! };
    }
  }
}
