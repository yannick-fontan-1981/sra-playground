import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [output, ...files] = process.argv.slice(2);
const runs = (
  await Promise.all(files.map(async (f) => (await readFile(f, 'utf8')).trim().split('\n').map(JSON.parse)))
).flat();
if (
  runs.length !== 100 ||
  runs
    .map((r) => r.code)
    .sort()
    .join() !==
    GAME_CATALOG.map((r) => r.code)
      .sort()
      .join()
)
  throw Error('Expected the 100 original games');
const votes = new Map();
for (const r of runs) {
  if (r.start !== 1 || r.finish !== 1 || r.sic !== r.steps.length) throw Error('Invalid source run');
  const counts = new Map();
  for (let i = 1; i < r.steps.length; i++) {
    const b = r.steps[i - 1],
      c = r.steps[i];
    if (b.from === b.to || b.to !== c.from) continue;
    const key = 'ACTION' + b.a + '/ACTION' + c.a,
      g = counts.get(key) ?? [0, 0];
    g[Number(c.to === b.from)]++;
    counts.set(key, g);
  }
  for (const [k, v] of counts) {
    const samples = votes.get(k) ?? [];
    samples.push(v);
    votes.set(k, samples);
  }
}
const table = Object.fromEntries(
  [...votes]
    .filter(([, xs]) => xs.length >= 3 && xs.some((v) => v[1] > 0))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, xs]) => [
      k,
      {
        games: xs.length,
        reversingGames: xs.filter((v) => v[1]).length,
        probability: Number(
          (xs.reduce((n, [miss, hit]) => n + (hit + 1) / (hit + miss + 2), 0) / xs.length).toFixed(4)
        ),
      },
    ])
);
await writeFile(output, JSON.stringify(table, null, 2) + '\n');
console.log(runs.length, Object.keys(table).length);
