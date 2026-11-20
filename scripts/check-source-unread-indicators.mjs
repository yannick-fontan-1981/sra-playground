import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, selection, shard, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env)),
  codes = new Set(GAME_CATALOG.map((g) => g.code)),
  [ix, parts] = shard.split('/').map(Number);
const defs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  results = [];
for (const f of [
  ...Array.from({ length: 8 }, (_, j) => 'source-final-' + j),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
const loc = (g, p) => (g?.groups.get(p)?.length === 1 ? g.groups.get(p)[0].p : null);
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1],
  sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
for (const [idx, g] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (idx % parts !== ix || !g.tickets.length) continue;
  if (!codes.has(g.code)) throw Error('Source only');
  const r = runs.get(g.code + '/' + g.level),
    rep = sourceReplay(engine, defs, r),
    read = sourcePoseIndex(),
    states = [];
  let b = rep.restore(0);
  for (let i = 0; i <= Math.max(...g.tickets.map((t) => t.i)); i++) {
    states.push(await read(b));
    if (i < r.steps.length) b = rep.act(op(r.steps[i]));
  }
  for (const t of g.tickets) {
    const root = rep.restore(t.i);
    if (
      !hash(root).startsWith(t.root) ||
      !eq(loc(states[t.i], t.p), t.origin) ||
      !eq(loc(states[t.i], t.r), t.site)
    )
      throw Error('Public root differs');
    const history = r.steps.slice(0, t.i),
      keys = [...root.availableActionIds.filter((v) => v !== 6).map((v) => 'ACTION' + v)];
    if (root.availableActionIds.includes(6))
      keys.push(
        ...[
          ...new Set(
            history
              .map(op)
              .filter((q) => q.startsWith('ACTION6:'))
              .reverse()
          ),
        ].slice(0, 2)
      );
    const record = { ...t, code: r.code, level: r.start, ranked: [], branches: [], sequence: [] };
    for (const q of keys) {
      const stats = {
        q,
        stable: 0,
        moved: 0,
        elsewhere: 0,
        ordinary: 0,
        absentRef: null,
        otherLand: 0,
        previousHere: false,
      };
      for (let j = 0; j < t.i; j++) {
        if (op(history[j]) !== q) continue;
        stats.previousHere ||= history[j].from === t.root;
        const a = states[j],
          z = states[j + 1],
          x = loc(a, t.p),
          y = loc(z, t.p);
        if (!x || !y) continue;
        if (eq(x, y)) {
          stats.stable++;
          if (history[j].from !== history[j].to) stats.elsewhere++;
          if (!loc(a, t.r) && eq(x, t.origin)) stats.absentRef = j;
        } else {
          stats.moved++;
          if (eq(sub(y, x), sub(t.site, t.origin))) stats.ordinary++;
        }
        for (const [role, parts] of a.groups) {
          if (role === t.p || parts.length !== 1) continue;
          const before = parts[0].p,
            to = loc(z, role);
          if (!to || eq(before, to)) continue;
          if ([...a.groups.values()].some((d) => d.length === 1 && eq(d[0].p, to))) {
            stats.otherLand++;
            break;
          }
        }
      }
      // Prefer controls already shown to leave this subject available; share their trials across readings of the same pose.
      stats.score = (stats.stable + 1) / (stats.stable + stats.moved + 2);
      record.ranked.push(stats);
    }
    record.ranked = record.ranked
      .filter((s) => !s.previousHere)
      .sort(
        (a, b) =>
          b.score - a.score ||
          Number(b.otherLand > 0) - Number(a.otherLand > 0) ||
          Number(b.elsewhere > 0) - Number(a.elsewhere > 0)
      );
    for (const s of record.ranked) {
      rep.restore(t.i);
      const z = rep.act(s.q),
        win = rep.win(z),
        v = win || z.state !== root.state ? null : await read(z);
      const end = loc(v, t.p),
        marker = loc(v, t.r),
        hit = !!eq(end, t.site);
      record.branches.push({
        q: s.q,
        hit,
        end,
        marker,
        win,
        novelOperator: !s.moved,
        ordinaryHere: s.ordinary > 0,
        stationaryControl: s.absentRef,
      });
    }
    rep.restore(t.i);
    for (const s of record.ranked) {
      const z = rep.act(s.q),
        win = rep.win(z),
        v = win || z.state !== root.state ? null : await read(z),
        end = loc(v, t.p),
        mark = loc(v, t.r);
      record.sequence.push({ q: s.q, hit: !!eq(end, t.site), end, mark, win });
      if (!eq(end, t.origin) || !eq(mark, t.site)) break;
    }
    results.push(record);
  }
}
await writeFile(out, JSON.stringify(results));
console.log(
  results.length,
  results.filter((r) => r.branches.some((s) => s.hit)).length,
  results.filter((r) => r.sequence.some((s) => s.hit)).length
);
