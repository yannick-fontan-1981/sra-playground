import { createHash } from 'node:crypto';
import { predictSpatialCapability } from '../src/sic/spatial-capability.ts';

// An untouched family of same-length preparations. Both planners receive the same
// words and the same fixed training transitions. Feedback reveals only the chosen prefix.
export async function qualifyPreparationAlternatives({
  word,
  vocab,
  actor,
  primary,
  model,
  edges,
  prepare,
  consequence,
  known,
  baseline,
  follow,
}) {
  if (!model) return { eligible: false };
  const ids = [actor, ...primary],
    pool = new Map(),
    byCommand = new Map();
  for (let i = 0; i <= word.length; i++)
    for (let j = i; j <= word.length; j++)
      for (const a of vocab)
        for (const b of vocab) {
          const w = [...word.slice(0, i), a, ...word.slice(i, j), b, ...word.slice(j)],
            k = w.join('/');
          if (!pool.has(k)) pool.set(k, w);
        }
  const hash = (k) => createHash('sha256').update(k).digest('hex');
  const words = [...pool]
    .map(([k, w]) => [hash(k), w])
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .slice(0, 96)
    .map((x) => x[1]);
  for (const e of edges.values()) {
    if (!ids.every((id) => e.from[id] && e.to[id])) continue;
    const a = byCommand.get(e.k) ?? [];
    a.push(e);
    byCommand.set(e.k, a);
  }
  const vec = (l) => [l.actor, ...primary.map((id) => l.objects[id])];
  const layout = (v) => ({
    actor: v[0],
    objects: Object.fromEntries(primary.map((id, i) => [id, v[i + 1]])),
  });
  const key = (v) => v.join('/');
  const measured = await prepare([]);
  const cached = new Map();
  function project(state, op) {
    const id = [state.scene, key(state.v), op].join('|');
    if (cached.has(id)) return cached.get(id);
    const exact = state.scene ? edges.get(state.scene + '/' + op) : null;
    if (exact) {
      const vs = ids.map((id) => exact.to[id]);
      const out = vs.every(Boolean) ? [{ v: vs, scene: exact.target, p: 1 }] : [];
      cached.set(id, out);
      return out;
    }
    let best = Infinity,
      donors = [];
    for (const e of byCommand.get(op) ?? []) {
      const distance = ids.reduce(
        (n, id, i) => n + Math.abs(state.v[i][0] - e.from[id][0]) + Math.abs(state.v[i][1] - e.from[id][1]),
        0
      );
      if (distance < best) {
        best = distance;
        donors = [];
      }
      if (distance === best) donors.push(e);
    }
    const votes = new Map();
    for (const e of donors) {
      const v = ids.map((id, i) => state.v[i].map((x, j) => x + e.to[id][j] - e.from[id][j]));
      const k = key(v),
        s = votes.get(k) ?? { v, scene: null, p: 0 };
      s.p += 1 / donors.length;
      votes.set(k, s);
    }
    const out = [...votes.values()];
    cached.set(id, out);
    return out;
  }
  function imagine(initial, commands) {
    let worlds = [{ v: vec(initial.l), scene: initial.key, p: 1 }];
    for (const op of commands) {
      const next = new Map();
      for (const world of worlds)
        for (const child of project(world, op)) {
          const k = (child.scene ?? '?') + '/' + key(child.v),
            s = next.get(k) ?? { ...child, p: 0 };
          s.p += world.p * child.p;
          next.set(k, s);
        }
      worlds = [...next.values()]
        .sort((a, b) => b.p - a.p || key(a.v).localeCompare(key(b.v), 'en'))
        .slice(0, 12);
      if (!worlds.length) break;
    }
    let success = 0,
      novel = 0;
    for (const w of worlds)
      if (predictSpatialCapability(model, layout(w.v))) {
        success += w.p;
        if (!known.has(key(w.v))) novel += w.p;
      }
    return { success, novel, dominant: worlds[0]?.p ?? 0, worlds };
  }
  function best(initial, choices, n) {
    let winner = null;
    for (const w of choices) {
      const p = imagine(initial, w.slice(n));
      if (p.success < 0.5 - 1e-8) continue;
      const rank = [
        Math.round(10000 * p.success),
        Math.round(10000 * p.novel),
        Math.round(10000 * p.dominant),
      ];
      if (
        !winner ||
        rank[0] > winner.rank[0] ||
        (rank[0] === winner.rank[0] &&
          (rank[1] > winner.rank[1] || (rank[1] === winner.rank[1] && rank[2] > winner.rank[2])))
      )
        winner = { w, p, rank };
    }
    return winner;
  }
  async function assess(w, p) {
    const r = await prepare(w);
    if (!r) return { word: w, legal: false };
    const v = key(vec(r.l)),
      result = {
        word: w,
        legal: true,
        works: await consequence(r),
        predicted: p.success,
        predictedPositions: p.worlds.length,
        covered: p.worlds.some((x) => key(x.v) === v),
        exact: p.worlds[0] ? key(p.worlds[0].v) === v : false,
        newJoint: !known.has(v),
        newImage: !baseline.has(r.key),
      };
    if (result.works && follow) result.continued = await follow(w);
    return result;
  }
  const proposal = best(measured, words, 0);
  if (!proposal) return { eligible: true, testWords: words.length, selected: false };
  const open = await assess(proposal.w, proposal.p);
  const original = proposal.w,
    prefix = [];
  let p = proposal,
    changes = 0;
  while (prefix.length < original.length) {
    prefix.push(p.w[prefix.length]);
    if (prefix.length === original.length) break;
    const r = await prepare(prefix);
    if (!r) {
      p = null;
      break;
    }
    const choices = words.filter((w) => prefix.every((s, i) => w[i] === s));
    const next = best(r, choices, prefix.length);
    if (!next) {
      p = null;
      break;
    }
    if (next.w.join('/') !== p.w.join('/')) changes++;
    p = next;
  }
  const feedback = p ? await assess(prefix, p.p) : { abstained: true, prefix };
  // Test whether the selected capability was already available with no preparation.
  const bare = await prepare([]);
  return {
    eligible: true,
    testWords: words.length,
    selected: true,
    bare: bare ? await consequence(bare) : null,
    open,
    feedback,
    changes,
  };
}
