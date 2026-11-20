import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { groupsOf, observedRoleMoves, resolveRole } from '../src/sic/exchange-roles.ts';
const [environment, dir, out, cohort, split = '0/1'] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const runs = [],
  allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  names =
    cohort === 'lower'
      ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
for (const n of names)
  for (const l of (await readFile(join(dir, n + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(l));
if (runs.some((r) => !allowed.has(r.code))) throw Error('Not a source game');
const eq = (p, q) => JSON.stringify(p) === JSON.stringify(q),
  dist = (p, q) => p.reduce((n, x, i) => n + Math.abs(x - q[i]), 0);
const [part, total] = split.split('/').map(Number),
  reports = [];
for (const [i, r] of runs.entries())
  if (i % total === part) {
    const rep = sourceReplay(engine, programs, r),
      read = publicParts(),
      examples = [],
      stats = {
        routes: 0,
        sites: 0,
        pairs: 0,
        activeOperand: 0,
        evenWhenSilent: 0,
        changedControl: 0,
        newRecipient: 0,
        newDriverMotion: 0,
        exactShift: 0,
        isolatedDriver: 0,
        isolatedRecipient: 0,
        confirmedSilent: 0,
        isolatedUses: 0,
        relocatedDriver: 0,
        relocatedRecipient: 0,
        relocatedUses: 0,
        requiresAll: 0,
        won: 0,
        requiresBoth: 0,
      };
    const keys = (b) => b.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n);
    const active = (b) =>
      b &&
      b.level === r.start &&
      b.levelsCompleted === r.initialCompleted &&
      b.state !== 'WIN' &&
      b.state !== 'GAME_OVER';
    const won = (b) =>
      b && (b.state === 'WIN' || b.levelsCompleted > r.initialCompleted || b.level > r.start);
    const group = async (b) => groupsOf({ entities: (await read(b)).parts });
    const apply = (b, k) =>
      active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? rep.act(k) : null;
    const seen = new Set();
    for (let j = 0; j < Math.min(r.steps.length - 1, 36) && stats.sites < 4; j++) {
      const root = rep.restore(j),
        a = op(r.steps[j]);
      if (a.includes(':')) continue;
      const place = apply(root, a);
      if (!active(place) || hash(place) === hash(root)) continue;
      const old = await group(root),
        now = await group(place);
      const moves = observedRoleMoves(old, now);
      const candidates = [];
      for (const m of moves) {
        const traveler = resolveRole(now, m.role),
          previous = resolveRole(old, m.role);
        if (!traveler || !previous) continue;
        const gap = (x, y) => Math.max(0, y[0] - x[2], x[0] - y[2]) + Math.max(0, y[1] - x[3], x[1] - y[3]);
        const stride = dist(m.from, m.to);
        for (const [sig, sites] of now) {
          if (sig === m.role.signature || sites.size > 12) continue;
          for (const [key, e] of sites) {
            if (e.area > (root.frame.length * root.frame[0].length) / 12 || !old.get(sig)?.has(key)) continue;
            const near = gap(traveler.bbox, e.bbox),
              was = gap(previous.bbox, e.bbox);
            if (near > stride || was <= near) continue;
            const role = { signature: sig, fixed: [...sites.keys()].filter((p) => p !== key).sort() };
            const score =
              8 / (1 + near) + Math.min(4, was - near) - Math.abs(Math.log(e.area / traveler.area));
            candidates.push({ m, t: role, at: e.position, score, near });
          }
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const p = candidates[0];
      if (!p) continue;
      const id = JSON.stringify([p.m.role.signature, p.t.signature, p.m.to, p.at]);
      if (seen.has(id)) continue;
      seen.add(id);
      stats.routes++;
      const cache = new Map();
      function run(ks) {
        const key = JSON.stringify(ks);
        if (cache.has(key)) return cache.get(key);
        let b = rep.restore(j);
        for (const k of ks) {
          if (!active(b)) break;
          b = apply(b, k);
        }
        cache.set(key, b);
        return b;
      }
      const commands = keys(root);
      for (const s of r.steps.slice(Math.max(0, j - 8), j + 1))
        if (s.a === 6 && !commands.includes(op(s))) commands.push(op(s));
      const dormant = commands.filter((k) => {
        const w = run([k]);
        return active(w) && hash(w) === hash(root);
      });
      if (!dormant.length) continue;
      stats.sites++;
      for (const b of dormant.slice(0, 4)) {
        const operand = run([a, b]);
        if (!active(operand)) continue;
        const awakened = hash(place) !== hash(operand);
        stats.activeOperand += Number(awakened);
        for (const c of keys(place)) {
          if (c === b) continue;
          const bare = run([a, c]),
            test = run([a, b, c]);
          if (!bare || !test) continue;
          stats.pairs++;
          if (won(test)) {
            stats.won++;
            const omit = run([b, c]);
            if (!won(bare) && !won(omit)) {
              stats.requiresBoth++;
              if (!won(run([a, b]))) stats.requiresAll++;
              if (examples.length < 4) examples.push({ j, a, b, c, official: true });
            }
          }
          if (!active(bare) || !active(test)) continue;
          const groupD = await group(bare),
            groupP = await group(test),
            groupB = await group(operand);
          const d = resolveRole(groupD, p.m.role)?.position,
            t = resolveRole(groupP, p.m.role)?.position,
            peerD = resolveRole(groupD, p.t)?.position,
            peerT = resolveRole(groupP, p.t)?.position;
          const moved = (d && t && !eq(d, t)) || (peerD && peerT && !eq(peerD, peerT));
          if (!moved) continue;
          stats.changedControl++;
          stats.evenWhenSilent += Number(!awakened);
          const newRecipient = peerD && eq(peerD, p.at) && peerT && !eq(peerT, p.at);
          const newDriver = d && eq(d, p.m.to) && t && !eq(t, p.m.to);
          const expected = d && p.at.map((v, i) => v + d[i] - p.m.to[i]);
          const exact = newRecipient && eq(peerT, expected);
          stats.newRecipient += Number(!!newRecipient);
          stats.newDriverMotion += Number(!!newDriver);
          stats.exactShift += Number(!!exact);
          const isolatedDriver = !!newDriver && eq(resolveRole(groupB, p.m.role)?.position, p.m.to);
          const isolatedRecipient = !!newRecipient && eq(resolveRole(groupB, p.t)?.position, p.at);
          stats.isolatedDriver += Number(isolatedDriver);
          stats.isolatedRecipient += Number(isolatedRecipient);
          const bDriver = resolveRole(groupB, p.m.role)?.position,
            bRecipient = resolveRole(groupB, p.t)?.position;
          const relocatedDriver = !!newDriver && !!bDriver && !eq(bDriver, p.m.to) && !eq(bDriver, t);
          const relocatedRecipient =
            !!newRecipient && !!bRecipient && !eq(bRecipient, p.at) && !eq(bRecipient, peerT);
          stats.relocatedDriver += Number(relocatedDriver);
          stats.relocatedRecipient += Number(relocatedRecipient);
          if (isolatedDriver || isolatedRecipient || relocatedDriver || relocatedRecipient) {
            const use = isolatedDriver || isolatedRecipient ? 'isolatedUses' : 'relocatedUses';
            stats.confirmedSilent += Number(!awakened);
            const next = run([a, b, c, c]),
              other = run([a, c, c]),
              skip = run([a, b, c]);
            const role = isolatedDriver || relocatedDriver ? p.m.role : p.t,
              at = (end) => resolveRole(end, role)?.position;
            if (won(next) && !won(other) && !won(skip)) stats[use]++;
            else if (active(next) && active(other)) {
              const u = at(await group(next)),
                v = at(await group(other)),
                w = at(groupP);
              if (u && v && w && !eq(u, v) && !eq(u, w)) stats[use]++;
            }
          }
          if (
            (isolatedDriver || isolatedRecipient || relocatedDriver || relocatedRecipient) &&
            examples.length < 4
          )
            examples.push({
              j,
              a,
              b,
              c,
              awakened,
              site: p.m.to,
              target: p.at,
              bare: d ?? null,
              after: t ?? null,
              directTarget: peerD ?? null,
              placedTarget: peerT ?? null,
              exact: !!exact,
              bDriver,
              bRecipient,
            });
        }
      }
    }
    reports.push({ code: r.code, level: r.start, stats, examples });
  }
await writeFile(out, JSON.stringify(reports));
