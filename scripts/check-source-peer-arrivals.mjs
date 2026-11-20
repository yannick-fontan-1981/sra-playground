import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, selection, shard, out] = process.argv.slice(2),
  backend = await sourceBackend(resolve(env)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const defs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  result = [];
for (const f of [
  ...Array.from({ length: 8 }, (_, j) => 'source-final-' + j),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
const [part, n] = shard.split('/').map(Number);
const eq = (x, y) => x && y && x[0] === y[0] && x[1] === y[1];
const xy = (r) => r.slice(2, 4);
const peer = (g, t) => {
  const rows = g?.rows.filter((x) => x[1] === t.p) ?? [];
  if (rows.length !== 1 + t.peers.length || !t.peers.every((p) => rows.some((r) => eq(xy(r), p))))
    return null;
  return rows.find((r) => !t.peers.some((p) => eq(xy(r), p))) ?? null;
};
const shown = (g, t) => g?.rows.some((r) => r[1] === t.r && eq(xy(r), t.site));
const covers = (row, at) => row && Math.abs(row[2] - at[0]) < row[5] && Math.abs(row[3] - at[1]) < row[6];
for (const [j, g] of JSON.parse(await readFile(selection, 'utf8')).entries()) {
  if (j % n !== part || !g.tickets.length) continue;
  if (!allowed.has(g.code)) throw Error('Source only');
  const run = runs.get(g.code + '/' + g.level),
    rep = sourceReplay(backend, defs, run),
    read = sourcePoseIndex(),
    history = [];
  let b = rep.restore(0);
  for (let k = 0; k <= Math.max(...g.tickets.map((v) => v.i)); k++) {
    history.push(await read(b));
    if (k < run.steps.length) b = rep.act(op(run.steps[k]));
  }
  for (const t of g.tickets) {
    const board = rep.restore(t.i);
    if (
      !hash(board).startsWith(t.root) ||
      !shown(history[t.i], t) ||
      !eq(xy(peer(history[t.i], t)), t.origin)
    )
      throw Error('Source binding');
    const prefix = run.steps.slice(0, t.i),
      choices = board.availableActionIds.filter((v) => v !== 6).map((v) => 'ACTION' + v);
    if (board.availableActionIds.includes(6))
      choices.push(
        ...[
          ...new Set(
            prefix
              .map(op)
              .filter((q) => q.startsWith('ACTION6:'))
              .reverse()
          ),
        ].slice(0, 2)
      );
    const ranked = choices
      .filter((q) => !prefix.some((s) => s.from === t.root && op(s) === q))
      .map((q) => {
        let still = 0,
          moved = 0,
          colocated = 0;
        for (let k = 0; k < t.i; k++)
          if (op(prefix[k]) === q) {
            const l = history[k].groups.get(t.p),
              r = history[k + 1].groups.get(t.p);
            if (!l || !r || l.length !== r.length) continue;
            const delta = l.filter((x) => !r.some((y) => eq(x.p, y.p))).length;
            if (!delta) still++;
            if (delta === 1) {
              moved++;
              const target = r.find((y) => !l.some((x) => eq(x.p, y.p)));
              if (target && history[k].rows.some((s) => s[1] !== t.p && covers(s, target.p))) colocated++;
            }
          }
        return { q, stationary: (still + 1) / (still + moved + 2), colocated };
      })
      .sort((a, b) => b.stationary - a.stationary || Number(b.colocated > 0) - Number(a.colocated > 0));
    const row = { ...t, code: g.code, level: g.level, branches: [], sequence: [] };
    result.push(row);
    async function action(q) {
      const next = rep.act(q),
        valid = next.state === board.state && !rep.win(next),
        view = valid ? await read(next) : null,
        r = peer(view, t),
        at = r ? xy(r) : null;
      return {
        q,
        arrived: at,
        hit: !!(at && !eq(at, t.origin) && covers(r, t.site)),
        unchanged: !!(eq(at, t.origin) && shown(view, t)),
        displayPersists: !!shown(view, t),
      };
    }
    for (const { q } of ranked) {
      rep.restore(t.i);
      row.branches.push(await action(q));
    }
    rep.restore(t.i);
    for (const { q } of ranked) {
      const d = await action(q);
      row.sequence.push(d);
      if (!d.unchanged) break;
    }
  }
}
await writeFile(out, JSON.stringify(result));
console.log(
  result.length,
  result.filter((r) => r.branches.some((d) => d.hit)).length,
  result.filter((r) => r.sequence.some((d) => d.hit)).length
);
