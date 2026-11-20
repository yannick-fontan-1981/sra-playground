import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { op, sourceReplay, hash } from './sic-study-source-replay.mjs';

const [environment, directory, out] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const runs = [],
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (let i = 0; i < 8; i++)
  for (const l of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n'))
    runs.push(JSON.parse(l));
if (
  runs.length !== 100 ||
  new Set(runs.map((r) => r.code)).size !== 100 ||
  runs.some((r) => !allowed.has(r.code))
)
  throw Error('Expected the original 100 source traces');
const reports = [];
for (const r of runs) {
  const table = new Map(),
    index = new Map();
  for (const [i, s] of r.steps.entries()) {
    const k = op(s),
      edges = table.get(k) ?? new Map(),
      dest = edges.get(s.from) ?? new Set();
    dest.add(s.to);
    edges.set(s.from, dest);
    table.set(k, edges);
    if (!index.has(s.from)) index.set(s.from, i);
  }
  const seen = new Set(),
    rings = [];
  const rep = sourceReplay(engine, {}, r);
  for (const [k, edges] of table)
    for (const start of edges.keys()) {
      const path = [];
      let x = start;
      while (!path.includes(x) && edges.get(x)?.size === 1) {
        path.push(x);
        x = [...edges.get(x)][0];
      }
      const loop = path.indexOf(x);
      if (loop < 0 || path.length - loop < 2) continue;
      const states = path.slice(loop),
        key = k + '/' + [...states].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      let b = rep.restore(index.get(x));
      const root = hash(b);
      let exact = true;
      for (let i = 0; i < states.length; i++) {
        if (!b.availableActionIds.includes(Number(k.split(':')[0].slice(6)))) {
          exact = false;
          break;
        }
        b = rep.act(k);
        if (!hash(b).startsWith(states[(i + 1) % states.length])) {
          exact = false;
          break;
        }
      }
      rings.push({
        op: k,
        period: states.length,
        root,
        prefix: index.get(x),
        exact: exact && hash(b) === root,
      });
    }
  if (rings.length) reports.push({ code: r.code, rings });
}
await writeFile(out, JSON.stringify({ games: runs.length, reports }));
