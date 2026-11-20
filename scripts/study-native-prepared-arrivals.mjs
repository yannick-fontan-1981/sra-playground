import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { newOccupancyMemory, observePoses, offerPreparedPreview } from '../src/sic/occupancy-programs.ts';
const [dir, out] = process.argv.slice(2),
  allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  result = [];
function view(rows) {
  const grouped = new Map();
  for (const [, role, x, y] of rows) grouped.set(role, grouped.has(role) ? null : [x, y]);
  return Object.fromEntries([...grouped].filter(([, p]) => p));
}
for (const file of (await readdir(dir)).filter((n) => /^poses20-.*\.json$/.test(n)).sort()) {
  for (const run of JSON.parse(await readFile(join(dir, file), 'utf8'))) {
    if (!allowed.has(run.code)) throw Error('Source only');
    const m = newOccupancyMemory(),
      scenes = new Map(),
      choices = new Set(),
      tickets = [],
      seen = new Set();
    const id = (h) => {
      if (!scenes.has(h)) scenes.set(h, scenes.size);
      return scenes.get(h);
    };
    for (const [i, [root, q, to, terminal]] of run.steps.entries()) {
      const s = id(root),
        before = view(run.frames[root]);
      m.layouts[s] ??= before;
      // Use previously witnessed commands only, then verify availability independently in the game.
      const trial = offerPreparedPreview(m, s, choices, 64, 64)?.occupancy;
      if (trial && tickets.length < 4 && !seen.has(trial.plan.key)) {
        tickets.push({ i, root, trial });
        seen.add(trial.plan.key);
      }
      choices.add(q);
      if (!terminal && run.frames[to]) observePoses(m, s, id(to), before, view(run.frames[to]), q, i + 2);
    }
    result.push({ code: run.code, level: run.level, tickets });
  }
}
await writeFile(out, JSON.stringify(result));
console.log(
  result.length,
  result.filter((r) => r.tickets.length).length,
  result.reduce((n, r) => n + r.tickets.length, 0)
);
