import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { geometryIndex, diff, add, length } from './source-corresponding-sites.mjs';
import { hash } from './sic-study-source-replay.mjs';

export const same = (p, q) => !!p && !!q && p[0] === q[0] && p[1] === q[1];
export const inside = (p, rows) => p[0] >= 0 && p[1] >= 0 && p[1] < rows.length && p[0] < rows[p[1]].length;
export const pointOf = (k) => (k.includes(':') ? k.split(':')[1].split(',').map(Number) : null);
export const travel = (b) => b.availableActionIds.filter((n) => n >= 1 && n <= 4).map((n) => 'ACTION' + n);
export function publicParts() {
  const cache = new Map();
  return async function (b) {
    const k = hash(b);
    if (!cache.has(k)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: k,
          level: b.level,
          levels_completed: b.levelsCompleted,
          state: b.state,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      cache.set(k, geometryIndex(o.entities, b.frame));
    }
    return cache.get(k);
  };
}
function owner(index, p) {
  return index.parts.find((e) =>
    e.mask.some(([dx, dy]) => p[0] === e.position[0] + dx && p[1] === e.position[1] + dy)
  );
}
// Local equality of colours, independent of palette numbering.
function patch(rows, p) {
  const codes = new Map(),
    out = [];
  for (let y = -2; y <= 2; y++)
    for (let x = -2; x <= 2; x++) {
      const q = add(p, [x, y]);
      if (!inside(q, rows)) {
        out.push(-1);
        continue;
      }
      const ink = rows[q[1]][q[0]];
      if (!codes.has(ink)) codes.set(ink, codes.size);
      out.push(codes.get(ink));
    }
  return out;
}
export async function readDemonstration(seed, replay) {
  const observe = publicParts(),
    ref = seed.original,
    word = ref.keys;
  let b = replay.restore(0);
  const root = b;
  const steps = [];
  for (const k of word) {
    const p = pointOf(k);
    const next = replay.act(k);
    if (p) {
      const s = await observe(b),
        e = owner(s, p);
      if (!e) return null;
      const after = await observe(next),
        f = owner(after, p);
      const first = patch(b.frame, p),
        second = patch(next.frame, p);
      steps.push({
        kind: 'site',
        shape: e.geometry,
        area: e.area,
        box: [e.bbox[2] - e.bbox[0], e.bbox[3] - e.bbox[1]],
        pointWithin: diff(p, e.position),
        patch: first,
        resultingPatch: second,
        changed: hash(b) !== hash(next),
        localChange: first.some((z, i) => z !== second[i]),
        newOwner: f?.geometry ?? null,
        entryOffset: diff(ref.selected.entry, p),
        exitOffset: diff(ref.selected.exit, p),
        sourcePoint: p,
      });
    } else steps.push({ kind: 'travel', key: k });
    b = next;
  }
  if (hash(b) !== ref.image) throw Error('Divergent observed training case');
  const prepared = await observe(b),
    after = await observe(replay.act(seed.probe));
  const actors = [...prepared.ids.values()].filter(
    (e) => same(e.position, ref.p) && same(after.ids.get(e.signature)?.position, ref.actual)
  );
  if (actors.length !== 1) return null;
  const actor = actors[0];
  const marker = prepared.parts.find(
    (e) =>
      same(e.position, ref.selected.entry) &&
      prepared.parts.some((f) => e.geometry === f.geometry && same(f.position, ref.selected.exit))
  );
  if (!marker) return null;
  const sites = steps.filter((s) => s.kind === 'site');
  const bind = (field) =>
    sites.reduce((best, s) => (length(s[field]) < length(best[field]) ? s : best), sites[0]);
  if (!sites.length) return null;
  const entrySite = bind('entryOffset'),
    exitSite = bind('exitOffset');
  if (
    entrySite === exitSite ||
    length(entrySite.entryOffset) > Math.max(2, length(seed.ordinary)) ||
    length(exitSite.exitOffset) > Math.max(2, length(seed.ordinary))
  )
    return null;
  // A transferable schema has all its spatial preparations before its approach.
  const lastSite = steps.findLastIndex((s) => s.kind === 'site');
  if (steps.slice(0, lastSite + 1).some((s) => s.kind !== 'site')) return null;
  if (seed.next !== seed.probe || !steps.slice(lastSite + 1).every((s) => s.key === seed.probe)) return null;
  return {
    steps: sites.map((s) => ({
      shape: s.shape,
      area: s.area,
      box: s.box,
      pointWithin: s.pointWithin,
      patch: s.patch,
      resultingPatch: s.resultingPatch,
      changed: s.changed,
      localChange: s.localChange,
      newOwner: s.newOwner,
      entryOffset: s === entrySite ? s.entryOffset : null,
      exitOffset: s === exitSite ? s.exitOffset : null,
    })),
    actorShape: actor.geometry,
    markerShape: marker.geometry,
    commandToEntry: diff(ref.p, ref.selected.entry),
    stride: seed.ordinary,
    entryFromOrdinary: diff(add(ref.p, seed.ordinary), ref.selected.entry),
    arrivalFromExit: diff(ref.actual, ref.selected.exit),
    rootHash: hash(root),
  };
}
export function candidates(spec, index, rows, relational = false) {
  const matches = [];
  for (const e of index.parts) {
    if (e.geometry !== spec.shape && (!relational || e.area > 4 * spec.area || e.area * 4 < spec.area))
      continue;
    const extent = [e.bbox[2] - e.bbox[0], e.bbox[3] - e.bbox[1]];
    const p = add(
      e.position,
      spec.pointWithin.map((n, i) => Math.round((n * (extent[i] + 1)) / (spec.box[i] + 1)))
    );
    if (!inside(p, rows)) continue;
    const seen = patch(rows, p);
    const fidelity = seen.reduce((n, v, i) => n + Number(v === spec.patch[i]), 0) / seen.length;
    matches.push({ p, fidelity: fidelity + Number(spec.shape === e.geometry) });
  }
  return matches.sort((a, b) => b.fidelity - a.fidelity).slice(0, relational ? 16 : Infinity);
}
export function changedAsExpected(spec, before, after, index, point, relational = false) {
  if (spec.changed && hash(before) === hash(after)) return false;
  if (!spec.localChange) return true;
  const e = owner(index, point),
    seen = patch(after.frame, point);
  if (relational) {
    const pre = patch(before.frame, point);
    return (
      !!e &&
      seen.some((x, i) => x !== pre[i]) &&
      seen.filter((x, i) => x === spec.resultingPatch[i]).length >= seen.length / 2
    );
  }
  return !!e && e.geometry === spec.newOwner && seen.every((x, i) => x === spec.resultingPatch[i]);
}
