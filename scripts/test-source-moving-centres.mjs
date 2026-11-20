import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

const [environment, study, predictions, output] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const entries = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const runs = new Map(),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (const file of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
]) {
  for (const line of (await readFile(join(study, file + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
}
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const pos = (groups, id) => (groups.get(id)?.length === 1 ? groups.get(id)[0].p : null);
const result = [];
for (const { code, level, tickets } of JSON.parse(await readFile(predictions, 'utf8'))) {
  if (!allowed.has(code)) throw Error('Source only');
  const rows = [];
  result.push({ code, level, rows });
  if (!tickets.length) continue;
  const r = runs.get(code + '/' + level),
    rep = sourceReplay(engine, entries, r),
    observe = sourcePoseIndex();
  let b = rep.restore(0);
  const stop = Math.max(...tickets.map((t) => t.i));
  for (let i = 0; i <= stop; i++) {
    await observe(b);
    if (i < stop) b = rep.act(op(r.steps[i]));
  }
  for (const t of tickets) {
    const root = rep.restore(t.i),
      ids = [t.p, t.r, t.c];
    const view = async (board) => {
      const data = (await observe(board)).groups;
      return ids.map((k) => pos(data, k));
    };
    const orig = await view(root);
    if (!hash(root).startsWith(t.root) || orig.some((v, j) => !same(v, t.before[j])))
      throw Error('Role mismatch ' + code + ' ' + t.i);
    const live = (b) => !rep.win(b) && b.state === root.state && b.level === root.level;
    const commands = root.availableActionIds.filter((k) => k !== 6).map((k) => 'ACTION' + k);
    const alternatives = [];
    for (const a of new Set([t.a, ...commands])) {
      rep.restore(t.i);
      const prepared = rep.act(a);
      const actual = live(prepared) ? await view(prepared) : [null, null, null];
      const next = t.q && live(prepared) ? rep.act(t.q) : null;
      alternatives.push({ a, actual, arrived: next && live(next) ? (await view(next))[0] : null });
    }
    const chosen = alternatives.find((v) => v.a === t.a);
    const bare = t.q ? alternatives.find((v) => v.a === t.q)?.actual[0] : null;
    const exact = chosen.actual.every((v, j) => same(v, t.after[j]));
    rows.push({
      i: t.i,
      a: t.a,
      q: t.q,
      target: t.after[1],
      forecast: t.after,
      actual: chosen.actual,
      arrived: chosen.arrived,
      exact,
      cueExact: Boolean(same(chosen.actual[1], t.after[1])),
      anchorExact: Boolean(same(chosen.actual[2], t.after[2])),
      movingPointExact: Boolean(same(chosen.actual[0], t.after[0])),
      fixedCentreExact: Boolean(same(chosen.actual[1], t.fixed)),
      used: Boolean(t.q && same(chosen.arrived, t.after[1])),
      bare,
      differingControl: alternatives.some(
        (v) => v.a !== t.a && v.actual[1] && !same(v.actual[1], t.after[1])
      ),
    });
  }
}
await writeFile(output, JSON.stringify(result));
