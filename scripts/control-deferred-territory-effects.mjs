import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { groupsOf, resolveRole } from '../src/sic/exchange-roles.ts';
const [env, dir, g, input, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const files =
  g === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  cases = [],
  allowed = new Set(GAME_CATALOG.map((x) => x.code));
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const parts = (b) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
    },
    1
  );
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
for (const r of JSON.parse(await readFile(input, 'utf8'))) {
  if (!allowed.has(r.code)) throw Error('Source levels only');
  const src = runs.get(r.code + '/' + r.level),
    rep = sourceReplay(engine, programs, src),
    seen = new Set();
  for (const c of r.cases) {
    const d = c.delayed;
    if (!d) continue;
    const start = await parts(rep.restore(c.i)),
      groups = groupsOf(start);
    const rolesAt = (p) =>
      p
        ? start.entities
            .filter((e) => eq(e.position, p))
            .map((e) => ({
              signature: e.signature,
              fixed: [...groups.get(e.signature).keys()].filter((k) => k !== p.join()).sort(),
            }))
        : [];
    const patients = rolesAt(c.from),
      markers = rolesAt(c.site);
    const root = () => {
      let b = rep.restore(c.i);
      for (const k of d.prefix) b = rep.act(k);
      return b;
    };
    const base = root(),
      alphabet = base.availableActionIds.filter((k) => k !== 6).map((n) => 'ACTION' + n),
      cache = new Map();
    const get = async (word) => {
      const id = word.join('/');
      if (cache.has(id)) return cache.get(id);
      let b = root();
      for (const k of word) {
        if (rep.win(b) || b.state !== base.state) break;
        b = rep.act(k);
      }
      const s = {
        win: rep.win(b),
        parts: b.state !== base.state || rep.win(b) ? null : groupsOf(await parts(b)),
      };
      cache.set(id, s);
      return s;
    };
    const at = (s, role) => (s.parts && role ? (resolveRole(s.parts, role)?.position ?? null) : null);
    for (const e of d.examples) {
      const key = JSON.stringify([c.i, d.prefix, d.a, e.suffix, c.from, c.site]);
      if (seen.has(key)) continue;
      seen.add(key);
      const alone = await get(e.suffix),
        joint = await get([d.a, ...e.suffix]),
        prep = await get([d.a]);
      if (alone.win !== e.alone.win || joint.win !== e.joint.win) throw Error('Lost branch outcome');
      const roleFor = (roles, k) =>
        roles.filter(
          (role) =>
            (!e.alone[k] || eq(at(alone, role), e.alone[k])) &&
            (!e.joint[k] || eq(at(joint, role), e.joint[k]))
        );
      const p = roleFor(patients, 'p'),
        m = roleFor(markers, 'marker');
      if ((e.markerMoves && m.length !== 1) || (e.newMotion && p.length !== 1)) continue;
      const marker = m.length === 1 ? m[0] : null,
        actor = p.length === 1 ? p[0] : null,
        shams = [];
      for (const alternative of alphabet.filter((k) => k !== d.a)) {
        const z = await get([alternative]),
          q = await get([alternative, ...e.suffix]);
        const matched =
          (!actor || eq(at(z, actor), at(prep, actor))) && (!marker || eq(at(z, marker), at(prep, marker)));
        const reproduces = e.win
          ? q.win
          : (!e.newMotion || eq(at(q, actor), e.joint.p)) &&
            (!e.markerMoves || eq(at(q, marker), e.joint.marker));
        shams.push({ a: alternative, matched, reproduces, win: q.win });
      }
      cases.push({
        code: r.code,
        level: r.level,
        i: c.i,
        kind: c.kind,
        a: d.a,
        prefix: d.prefix,
        suffix: e.suffix,
        entry: e.entry,
        win: e.win,
        newMotion: e.newMotion,
        newActuation: e.markerMoves,
        joint: e.joint,
        alone: e.alone,
        shams,
      });
    }
  }
}
await writeFile(out, JSON.stringify(cases));
