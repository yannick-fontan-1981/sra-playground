import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { actionRelation } from '../src/sic/composition-context.ts';

const [output, ...files] = process.argv.slice(2);
const runs = (
  await Promise.all(files.map(async (file) => (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse)))
).flat();
const codes = GAME_CATALOG.map((game) => game.code).sort();
if (
  codes.length !== 100 ||
  runs
    .map((r) => r.code)
    .sort()
    .join() !== codes.join()
)
  throw Error('Expected all original games exactly once');
const votes = new Map();
for (const r of runs.sort((a, b) => a.code.localeCompare(b.code))) {
  if (r.error || r.start !== 1 || r.finish !== 1 || r.sic !== r.steps.length)
    throw Error('Invalid trace ' + r.code);
  const seen = new Set(),
    local = new Map(),
    keys = [];
  let previous;
  for (const s of r.steps) {
    const key = s.a === 6 ? 'ACTION6:' + s.data.x + ',' + s.data.y : 'ACTION' + s.a;
    seen.add(s.from);
    const effect = s.from === s.to ? 'unchanged' : seen.has(s.to) ? 'return' : 'new';
    if (previous) {
      const context = previous + '/' + actionRelation(keys.at(-1), key, keys.at(-2));
      const counts = local.get(context) ?? [0, 0];
      counts[Number(effect === 'new')]++;
      local.set(context, counts);
    }
    previous = effect;
    keys.push(key);
    seen.add(s.to);
  }
  for (const [context, [other, novel]] of local) {
    const sample = votes.get(context) ?? [];
    sample.push((novel + 1) / (other + novel + 2));
    votes.set(context, sample);
  }
}
const prior = Object.fromEntries(
  [...votes]
    .filter(([, v]) => v.length >= 3)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([context, v]) => [context, Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(4))])
);
await writeFile(output, JSON.stringify(prior, null, 2) + '\n');
console.log('Source games', runs.length, 'learned context classes', Object.keys(prior).length);
