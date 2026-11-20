import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

const [environment, study, predictions, shard, output] = process.argv.slice(2);
const [index, count] = shard.split('/').map(Number),
  engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const starts = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const runs = new Map(),
  result = [];
for (const file of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(study, file + '.jsonl'), 'utf8')).trim().split('\n')) {
    const d = JSON.parse(line);
    runs.set(d.code + '/' + d.start, d);
  }
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const bag = (sites) =>
  sites
    .map((p) => p.join())
    .sort()
    .join(';');
const position = (v, k) => (v?.get(k)?.length === 1 ? v.get(k)[0].p : null);
for (const [j, s] of JSON.parse(await readFile(predictions, 'utf8')).entries()) {
  if (j % count !== index) continue;
  if (!allowed.has(s.code)) throw Error('Expected a source game');
  const r = runs.get(s.code + '/' + s.level),
    rep = sourceReplay(engine, starts, r),
    read = sourcePoseIndex(),
    rows = [];
  result.push({ code: s.code, level: s.level, rows });
  if (!s.tickets.length) continue;
  let b = rep.restore(0);
  const stop = Math.max(...s.tickets.map((t) => t.i));
  for (let i = 0; i <= stop; i++) {
    await read(b);
    if (i < stop) b = rep.act(op(r.steps[i]));
  }
  for (const t of s.tickets) {
    const root = rep.restore(t.i),
      v = (await read(root)).groups,
      cs = (g) => (g?.get(t.c) ?? []).map((e) => e.p);
    if (
      !hash(root).startsWith(t.root) ||
      !eq(position(v, t.p), t.fromP) ||
      bag(cs(v)) !== bag([...t.rest, t.fromC])
    )
      throw Error('Invalid contact root ' + s.code + ' ' + t.i);
    const possible = (board, q) => board.availableActionIds.includes(Number(q.slice(6).split(':')[0]));
    const live = (g) => g.state === root.state && g.level === root.level && !rep.win(g);
    const peek = async (g) => (live(g) ? (await read(g)).groups : null);
    const observed = async (g) => {
      const v = await peek(g);
      return { p: position(v, t.p), c: cs(v), won: rep.win(g) };
    };
    const options = new Set([
      t.op,
      ...root.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n),
      ...t.continuations.map((v) => v.op),
    ]);
    const returns = new Map();
    for (const q of options) {
      if (!possible(root, q)) continue;
      rep.restore(t.i);
      returns.set(q, await observed(rep.act(q)));
    }
    const prepared = returns.get(t.op),
      target = bag([...t.rest, t.nextC]),
      exact = Boolean(eq(prepared?.p, t.nextP) && bag(prepared.c) === target),
      uses = [];
    if (exact) {
      for (const follow of t.continuations) {
        rep.restore(t.i);
        const first = rep.act(t.op);
        if (!possible(first, follow.op)) continue;
        const after = await observed(rep.act(follow.op)),
          bare = returns.get(follow.op);
        const predicted = Boolean(eq(after.p, follow.after)),
          different = Boolean(after.p && bare?.p && !eq(after.p, bare.p));
        let rival = false,
          samePlayer = false,
          all = false;
        if (predicted && different) {
          const alternatives = [];
          for (const [q, z] of returns) {
            if (q === t.op || !z.p || !z.c.length || bag(z.c) === target) continue;
            rep.restore(t.i);
            const other = rep.act(q);
            if (!live(other) || !possible(other, follow.op)) continue;
            const control = await observed(rep.act(follow.op));
            if (!control.p) continue;
            alternatives.push(!eq(after.p, control.p));
            samePlayer ||= Boolean(eq(z.p, t.nextP) && !eq(after.p, control.p));
          }
          rival = alternatives.some(Boolean);
          all = alternatives.length > 0 && alternatives.every(Boolean);
        }
        uses.push({ q: follow.op, predicted, different, rival, samePlayer, all, won: after.won });
      }
    }
    rows.push({
      i: t.i,
      op: t.op,
      p: t.p,
      c: t.c,
      start: t.fromC,
      exact,
      first: t.first,
      prior: t.priorPush,
      n: t.support,
      copies: t.rest.length + 1,
      movedP: Boolean(eq(prepared?.p, t.nextP)),
      movedC: bag(prepared?.c ?? []) === target,
      distinct: [...returns].some(
        ([q, z]) => q !== t.op && z.p && z.c.length && (bag(z.c) !== target || !eq(z.p, t.nextP))
      ),
      uses,
    });
  }
}
await writeFile(output, JSON.stringify(result));
