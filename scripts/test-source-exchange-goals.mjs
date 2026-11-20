import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts, same, inside, pointOf } from './source-transfer-demonstration.mjs';
import { length, diff, add } from './source-corresponding-sites.mjs';
import { observeByExclusion } from './track-source-roles-by-exclusion.mjs';
import { exchangePrefixes } from './observed-source-exchange-prefixes.mjs';

const [environment, out, ...entries] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const centre = (e) => [Math.round((e.bbox[0] + e.bbox[2]) / 2), Math.round((e.bbox[1] + e.bbox[3]) / 2)];
const within = (e, p) =>
  p && p[0] >= e.bbox[0] && p[0] <= e.bbox[2] && p[1] >= e.bbox[1] && p[1] <= e.bbox[3];
const gap = (p, e) =>
  Math.max(0, e.bbox[0] - p[0], p[0] - e.bbox[2]) + Math.max(0, e.bbox[1] - p[1], p[1] - e.bbox[3]);
function buttons(b, idx) {
  const keys = b.availableActionIds.filter((x) => x !== 6).map((x) => 'ACTION' + x);
  if (!b.availableActionIds.includes(6)) return keys;
  const small = idx.parts.filter((e) => e.area > 0 && e.area <= (b.frame.length * b.frame[0].length) / 12);
  const groups = new Map();
  for (const e of small) {
    const es = groups.get(e.signature) ?? [];
    es.push(e);
    groups.set(e.signature, es);
  }
  const candidates = [...groups.values()].sort((a, b) => a.length - b.length || b[0].area - a[0].area);
  for (let i = 0; keys.length < 40 && i < 8; i++)
    for (const g of candidates) {
      if (g[i]) keys.push('ACTION6:' + centre(g[i]).join());
      if (keys.length >= 40) break;
    }
  return [...new Set(keys)];
}
async function evaluate(code, level, prelude = []) {
  if (!allowed.has(code)) throw Error('Source only');
  const rep = sourceReplay(engine, programs, { code, start: level }),
    readParts = publicParts();
  function rawOpen() {
    let b = rep.openEntry().b;
    if (b.level !== level) {
      b = engine.dispatch({ type: 'load', code, level: 1 });
      for (let i = 1; i < level; i++) {
        const seq =
          i === 1
            ? programs.niveau_1[code]?.suite_gagnante
            : programs.niveaux_supérieurs.find((s) => s.code === code && s.l === i)?.seq;
        if (!seq || b.level !== i) return null;
        for (const k of seq) b = rep.act('ACTION' + k.replace('@', ':'));
      }
    }
    return b.level === level ? b : null;
  }
  const absoluteRoot = rawOpen();
  if (!absoluteRoot) return { code, level, status: 'unavailable' };
  const open = () => {
    let b = rawOpen();
    for (const k of prelude) {
      if (
        !b ||
        b.level !== level ||
        b.levelsCompleted !== absoluteRoot.levelsCompleted ||
        b.state === 'GAME_OVER' ||
        !b.availableActionIds.includes(Number(k.split(':')[0].slice(6)))
      )
        return null;
      b = rep.act(k);
    }
    return b;
  };
  const root = open();
  if (
    !root ||
    root.level !== level ||
    root.levelsCompleted !== absoluteRoot.levelsCompleted ||
    root.state === 'GAME_OVER'
  )
    return { code, level, status: 'prefix unavailable' };
  const exclusion = process.env.SIC_SOURCE_LOCAL_IDENTITY === '1';
  const observe = exclusion ? observeByExclusion(await readParts(root), readParts) : readParts;
  const initial = root.levelsCompleted,
    win = (b) => !!b && (b.levelsCompleted > initial || b.level > level || b.state === 'WIN');
  const active = (b) => !!b && !win(b) && b.state !== 'GAME_OVER';
  const act = (b, k) =>
    active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? rep.act(k) : null;
  const run = (ks) => ks.reduce(act, open());
  const achieves = (ks) => {
    let b = open();
    for (const k of ks) {
      b = act(b, k);
      if (win(b)) return true;
      if (!active(b)) return false;
    }
    return false;
  };
  const idx = await observe(root),
    keys = buttons(root, idx),
    singles = new Map(),
    pairs = [],
    setupCandidates = new Map();
  const stats = {
    openControls: keys.length,
    singleWins: 0,
    models: 0,
    calibratedPairs: 0,
    layouts: 0,
    planned: 0,
    exchanges: 0,
    uses: 0,
    useExact: 0,
    official: 0,
    withoutExchangeWon: 0,
    withoutPreparationWon: 0,
    requiredWins: 0,
  };
  for (const op of keys) {
    const next = act(open(), op);
    stats.singleWins += Number(win(next));
    if (!active(next)) continue;
    const to = await observe(next);
    singles.set(op, to);
    const moved = [...idx.ids.values()].filter(
      (e) => to.ids.has(e.signature) && !same(e.position, to.ids.get(e.signature).position)
    );
    if (hash(next) !== hash(root) && !setupCandidates.has(hash(next)))
      setupCandidates.set(hash(next), { word: [...prelude, op], key: hash(next), moving: moved.length });
    for (const a of moved)
      for (const b of moved) {
        if (
          a === b ||
          !same(to.ids.get(a.signature).position, b.position) ||
          !same(to.ids.get(b.signature).position, a.position)
        )
          continue;
        const moves = [...keys].filter((k) => !k.includes(':') && k !== op);
        pairs.push({ actor: a.signature, partner: b.signature, op, moves });
      }
  }
  const seen = new Set(),
    catalogue = [];
  for (const pair of pairs) {
    const { actor, partner, op } = pair,
      a = idx.ids.get(actor),
      p = idx.ids.get(partner),
      from = a.position;
    const u = [...singles].filter(
      ([k, t]) =>
        pair.moves.includes(k) &&
        same(t.ids.get(actor)?.position, from) &&
        t.ids.has(partner) &&
        !same(t.ids.get(partner).position, p.position)
    );
    if (!u.length) continue;
    const site = pointOf(op),
      relative = site && within(p, site) ? diff(site, p.position) : null;
    const triggerAt = (q) => (relative ? 'ACTION6:' + add(q, relative).join() : op);
    const signature = [actor, partner, op].join('|');
    if (seen.has(signature)) continue;
    seen.add(signature);
    stats.models++;
    let calibration = null;
    for (const [k, t] of u) {
      const q = t.ids.get(partner).position,
        key = triggerAt(q),
        second = run([k, key]);
      if (!active(second)) continue;
      const r = await observe(second);
      if (same(r.ids.get(actor)?.position, q) && same(r.ids.get(partner)?.position, from)) {
        calibration = { word: [k, key], q };
        break;
      }
    }
    if (!calibration) continue;
    stats.calibratedPairs++;
    const follow = [];
    for (const k of pair.moves) {
      const x = run([op, k]),
        y = run([...calibration.word, k]);
      if (!active(x) || !active(y)) continue;
      const s = await observe(x),
        t = await observe(y);
      for (const role of [actor, partner]) {
        const old = role === actor ? p.position : from,
          primed = role === actor ? calibration.q : from;
        const xx = s.ids.get(role)?.position,
          yy = t.ids.get(role)?.position;
        if (!xx || !yy) continue;
        const d = diff(xx, old);
        if (length(d) && same(d, diff(yy, primed))) follow.push({ op: k, role, delta: d });
      }
    }
    const path = [{ word: [], q: p.position }],
      visited = new Set([p.position.join()]);
    for (let i = 0; i < path.length && i < 64; i++) {
      const z = path[i];
      for (const [k] of u) {
        const word = [...z.word, k],
          b = run(word);
        if (!active(b)) continue;
        const s = await observe(b),
          q = s.ids.get(partner)?.position;
        if (!q || !same(s.ids.get(actor)?.position, from) || visited.has(q.join())) continue;
        visited.add(q.join());
        if (word.length < 12) path.push({ word, q });
        if (word.length < 2 || same(q, calibration.q)) continue;
        const targetFeatures = s.parts.filter(
          (e) =>
            e.signature !== actor &&
            e.signature !== partner &&
            !actor.startsWith(e.signature + '@') &&
            !partner.startsWith(e.signature + '@') &&
            e.area > 1 &&
            e.area < (b.frame.length * b.frame[0].length) / 12
        );
        for (const c of follow.length ? follow : [null]) {
          const at = c ? (c.role === actor ? q : from) : q,
            expected = c ? add(at, c.delta) : null;
          if (expected && !inside(expected, b.frame)) continue;
          const near = (pos) => Math.min(32, ...targetFeatures.map((e) => gap(pos, e)));
          const direct = c && singles.get(c.op)?.ids.get(c.role)?.position;
          const gain = expected && direct ? near(direct) - near(expected) : 0;
          const score = gain - near(expected ?? q) / 8 - word.length / 5 + length(diff(q, p.position)) / 64;
          catalogue.push({
            actor,
            partner,
            from,
            originalPartner: p.position,
            q,
            setup: word,
            trigger: triggerAt(q),
            rootTrigger: op,
            calibration,
            follow: c,
            expected,
            score,
          });
        }
      }
    }
    stats.layouts += visited.size;
  }
  catalogue.sort((a, b) => b.score - a.score);
  const byLanding = new Map();
  for (const c of catalogue) {
    const k = c.actor + '/' + c.q.join();
    if (!byLanding.has(k)) byLanding.set(k, c);
  }
  const plans = [...new Set([...byLanding.values(), ...catalogue])].slice(0, 32);
  const seal = createHash('sha256').update(JSON.stringify(plans)).digest('hex');
  stats.planned = plans.length;
  const records = [],
    followCoordinates = new Set();
  stats.followOnDeliveredRole = 0;
  stats.newFollowEndpointAgainstBare = 0;
  stats.changedFollowVector = 0;
  for (const plan of plans) {
    const b = run(plan.setup),
      pre = await observe(b);
    if (
      !same(pre.ids.get(plan.actor)?.position, plan.from) ||
      !same(pre.ids.get(plan.partner)?.position, plan.q)
    )
      throw Error('Incorrect preparation');
    const n = act(b, plan.trigger),
      t = active(n) ? await observe(n) : null;
    const exchanged =
      same(t?.ids.get(plan.actor)?.position, plan.q) && same(t?.ids.get(plan.partner)?.position, plan.from);
    stats.exchanges += Number(exchanged);
    let exact = false,
      finished = win(n),
      withoutExchange = false,
      withoutPreparation = false;
    if (exchanged && plan.follow) {
      const end = act(n, plan.follow.op),
        post = active(end) ? await observe(end) : null;
      exact = same(post?.ids.get(plan.follow.role)?.position, plan.expected);
      finished = win(end);
      const naked = run([...plan.setup, plan.follow.op]),
        barePart = active(naked) ? (await observe(naked)).ids.get(plan.follow.role) : null;
      if (exact) {
        followCoordinates.add(plan.follow.role + '/' + plan.expected.join());
        stats.followOnDeliveredRole += Number(plan.follow.role === plan.actor);
        stats.newFollowEndpointAgainstBare += Number(!!barePart && !same(barePart.position, plan.expected));
        const original = plan.follow.role === plan.actor ? plan.from : plan.q;
        stats.changedFollowVector += Number(
          !!barePart && !same(diff(barePart.position, original), plan.follow.delta)
        );
      }
      withoutExchange = achieves([...plan.setup, plan.follow.op]);
      withoutPreparation = achieves([plan.rootTrigger, plan.follow.op]);
      stats.uses++;
      stats.useExact += Number(exact);
      stats.withoutExchangeWon += Number(withoutExchange);
      stats.withoutPreparationWon += Number(withoutPreparation);
    }
    stats.official += Number(finished);
    const required = finished && exchanged && !!plan.follow && !withoutExchange && !withoutPreparation;
    stats.requiredWins += Number(required);
    records.push({ ...plan, exchanged, exact, finished, required });
  }
  return {
    code,
    level,
    status: 'evaluated',
    exclusion,
    initial: hash(absoluteRoot),
    prepared: hash(root),
    prelude,
    setupCandidates: [...setupCandidates.values()],
    stats,
    seal,
    distinctFollowCoordinates: followCoordinates.size,
    distinctDestinations: new Set(records.filter((r) => r.exchanged).map((r) => r.q.join())).size,
    ...(process.env.SIC_SOURCE_EXPORT_PATHS === '1' ? { records } : {}),
    examples: [...records]
      .sort((a, b) => Number(b.required) - Number(a.required) || Number(b.exact) - Number(a.exact))
      .slice(0, 3),
  };
}
const result = [];
for (const entry of entries) {
  const [code, l] = entry.split('/'),
    level = Number(l),
    explore = process.env.SIC_SOURCE_EXCHANGE_SETUP === '1';
  if (!allowed.has(code)) throw Error('Source only');
  const trace = process.env.SIC_SOURCE_EXCHANGE_TRACE;
  const witness = trace ? await exchangePrefixes(trace, code, level, engine, programs) : null;
  const queue = witness ? witness.paths.map((word) => ({ word })) : [];
  queue.push({ word: [] });
  const seen = new Set();
  let best,
    inspected = 0;
  for (let n = 0; n < queue.length && n < (witness ? witness.paths.length + 1 : explore ? 24 : 1); n++) {
    const s = queue[n],
      r = await evaluate(code, level, s.word);
    inspected++;
    if (witness && r.initial !== witness.initial) throw Error('Archived entrance mismatch');
    const next = r.setupCandidates ?? [];
    delete r.setupCandidates;
    if (!best || (r.stats?.planned ?? 0) > (best.stats?.planned ?? 0)) best = r;
    if (r.stats?.planned) break;
    if (witness || s.word.length >= 3) continue;
    if (r.prepared) seen.add(r.prepared);
    for (const x of next) {
      if (!seen.has(x.key)) {
        queue.push(x);
        seen.add(x.key);
      }
    }
  }
  result.push({ ...best, inspected, ...(witness ? { observedSwaps: witness.observedSwaps } : {}) });
}
await writeFile(out, JSON.stringify(result));
