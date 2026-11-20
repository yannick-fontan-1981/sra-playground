import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts, same } from './source-transfer-demonstration.mjs';
const [environment, directory, output, split = '0/1'] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  runs = [];
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n'))
    runs.push(JSON.parse(line));
if (
  runs.length !== 100 ||
  new Set(runs.map((r) => r.code)).size !== 100 ||
  runs.some((r) => !allowed.has(r.code))
)
  throw Error('Source corpus incomplete');
function groups(index) {
  const g = new Map();
  for (const e of index.parts) {
    const es = g.get(e.signature) ?? new Map();
    es.set(e.position.join(), e.position);
    g.set(e.signature, es);
  }
  return g;
}
async function audit(r) {
  const replay = sourceReplay(engine, {}, r),
    observe = publicParts(),
    found = [],
    seen = new Set();
  let b = replay.restore(0),
    before = groups(await observe(b));
  for (const [i, s] of r.steps.entries()) {
    const k = op(s),
      n = replay.act(k);
    if (hash(b).slice(0, 16) !== s.from || hash(n).slice(0, 16) !== s.to) throw Error('Divergent source');
    if (
      n.level !== b.level ||
      n.levelsCompleted !== b.levelsCompleted ||
      n.state === 'GAME_OVER' ||
      n.state === 'WIN'
    )
      break;
    const after = groups(await observe(n)),
      moves = [];
    for (const [sig, old] of before) {
      const fresh = after.get(sig);
      if (old.size > 12 || fresh?.size !== old.size) continue;
      const removed = [...old].filter(([p]) => !fresh.has(p)),
        added = [...fresh].filter(([p]) => !old.has(p));
      if (removed.length === 1 && added.length === 1)
        moves.push({ sig, from: removed[0][1], to: added[0][1], members: old.size });
    }
    for (const [j, a] of moves.entries())
      for (const c of moves.slice(j + 1)) {
        if (!same(a.from, c.to) || !same(a.to, c.from)) continue;
        const signature = [s.from, k, a.sig, c.sig].join('/');
        if (seen.has(signature)) continue;
        seen.add(signature);
        found.push({
          step: i + 1,
          from: s.from,
          to: s.to,
          op: k,
          roles: [a, c],
          requiresExclusion: a.members > 1 || c.members > 1,
        });
      }
    b = n;
    before = after;
  }
  return {
    code: r.code,
    steps: r.steps.length,
    unique: found.filter((x) => !x.requiresExclusion).length,
    exclusion: found.filter((x) => x.requiresExclusion).length,
    examples: found.filter((x) => x.requiresExclusion).slice(0, 3),
  };
}
const [n, N] = split.split('/').map(Number),
  reports = [];
for (const [i, r] of runs.entries()) if (i % N === n) reports.push(await audit(r));
await writeFile(output, JSON.stringify(reports));
