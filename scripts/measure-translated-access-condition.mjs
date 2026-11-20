import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, g, selection, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const files =
  g === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  allowed = new Set(GAME_CATALOG.map((x) => x.code)),
  report = [];
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  sub = (a, b) => [a[0] - b[0], a[1] - b[1]],
  length = (v) => Math.abs(v[0]) + Math.abs(v[1]);
for (const entry of JSON.parse(await readFile(selection, 'utf8'))) {
  if (!allowed.has(entry.code)) throw Error('Source games only');
  const r = runs.get(entry.code + '/' + entry.level),
    rep = sourceReplay(engine, programs, r),
    inspect = publicParts(),
    cases = [];
  for (const t of entry.cases) {
    const base = rep.restore(t.write);
    if (!hash(base).startsWith(t.baseline)) throw Error('Wrong public root');
    const keys = base.availableActionIds
      .filter((k) => k !== 6)
      .map((k) => 'ACTION' + k)
      .filter((k) => k !== t.a && k !== t.q);
    const cache = new Map(),
      parts = new Map(),
      anchor = { signature: t.anchor, fixed: [] };
    const at = (es, role) => {
      const list = es.filter((e) => e.signature === role.signature);
      return list.length === role.fixed.length + 1 &&
        role.fixed.every((s) => list.some((v) => v.position.join() === s))
        ? (list.find((v) => !role.fixed.includes(v.position.join()))?.position ?? null)
        : null;
    };
    const get = async (word) => {
      const k = word.join('/');
      if (cache.has(k)) return cache.get(k);
      let b = rep.restore(t.write);
      for (const x of word) {
        if (
          b.state !== base.state ||
          rep.win(b) ||
          !b.availableActionIds.includes(Number(x.slice(6).split(':')[0]))
        )
          break;
        b = rep.act(x);
      }
      const h = hash(b),
        win = rep.win(b);
      let es = [];
      if (!win && b.state === base.state) {
        if (!parts.has(h)) parts.set(h, (await inspect(b)).parts);
        es = parts.get(h);
      }
      const v = { p: at(es, t.role), r: at(es, anchor), win, h: h.slice(0, 16) };
      cache.set(k, v);
      return v;
    };
    const start = await get([]),
      A = await get([t.a]);
    if (!eq(start.p, A.p) || !start.r || !A.r || eq(start.r, A.r)) continue;
    const shift = sub(A.r, start.r),
      options = [],
      locations = new Set();
    for (const b of [...keys.map((k) => [k]), ...keys.flatMap((k) => keys.map((j) => [k, j]))]) {
      const B = await get(b);
      if (!B.p || eq(B.p, start.p) || !eq(B.r, start.r) || locations.has(B.p.join())) continue;
      const AB = await get([t.a, ...b]);
      if (!eq(B.p, AB.p) || !eq(AB.r, A.r)) continue;
      locations.add(B.p.join());
      const offset = sub(B.p, start.p);
      options.push({ b, B, AB, offset, cost: length(sub(shift, offset)), aligned: eq(shift, offset) });
    }
    const selected = options.sort((a, b) => a.cost - b.cost || a.b.length - b.b.length).slice(0, 2),
      tickets = [];
    for (const z of selected) {
      const { b, B, AB } = z,
        words = [[], [t.a], b, [t.a, ...b]],
        origins = [start, A, B, AB],
        returns = [];
      for (const word of words) returns.push(await get([...word, t.q]));
      const ds = returns.map((v, i) => (v.p ? sub(v.p, origins[i].p) : null)),
        wins = returns.map((x) => x.win);
      let nonAdditive = false,
        jointMotion = false,
        relationRestored = false;
      if (ds.every(Boolean)) {
        nonAdditive = !eq(sub(ds[3], ds[1]), sub(ds[2], ds[0]));
        jointMotion = length(ds[3]) > 0 && ds.slice(0, 3).every((d) => length(d) === 0);
        relationRestored = z.aligned && eq(ds[0], ds[3]) && (!eq(ds[1], ds[0]) || !eq(ds[2], ds[0]));
      }
      const BA = await get([...b, t.a]),
        reversed = eq(BA.r, AB.r) && eq(BA.p, AB.p) ? await get([...b, t.a, t.q]) : null;
      tickets.push({
        b,
        z: z.offset,
        aligned: z.aligned,
        nonAdditive,
        jointMotion,
        relationRestored,
        jointWin: wins[3] && wins.slice(0, 3).every((v) => !v),
        ds,
        wins,
        reverseSame: reversed
          ? reversed.win === wins[3] && ((!reversed.p && !returns[3].p) || eq(reversed.p, returns[3].p))
          : null,
        reverseDifferentPixels: reversed ? BA.h !== AB.h : null,
        origins: origins.map((v) => [v.p, v.r]),
      });
    }
    cases.push({ i: t.i, a: t.a, q: t.q, shift, independentPlacements: options.length, tickets });
  }
  report.push({ code: r.code, level: r.start, cases });
}
await writeFile(out, JSON.stringify(report));
