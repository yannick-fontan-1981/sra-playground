import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from '../../../scripts/sic-study-source-games.mjs';
import { sourceReplay } from '../../../scripts/sic-study-source-replay.mjs';

const [env, output, ...files] = process.argv.slice(2);
const separator = files.indexOf('--');
assert.ok(separator > 0 && separator < files.length - 1, 'Pass the two sets of JSONL files separated by --');
const engine = await sourceBackend(resolve(env));
async function verify(paths) {
  const runs = new Map();
  for (const path of paths) {
    for (const line of (await readFile(path, 'utf8')).trim().split(/\r?\n/)) {
      const r = JSON.parse(line);
      assert.ok(!r.error && !runs.has(r.code), r.code);
      assert.equal(r.start, 1);
      assert.equal(r.finish, 1);
      assert.equal(r.cap, 60);
      assert.equal(r.resets, 0);
      assert.equal(r.steps.length, r.sic);
      assert.equal(r.sic, r.issued);
      const replay = sourceReplay(engine, {}, r);
      const final = replay.restore(r.steps.length);
      assert.equal(replay.win(final), r.levels[0].won, r.code);
      runs.set(r.code, { won: r.levels[0].won, commands: r.issued, initial: r.initial,
        trajectory: r.trajectory, steps: r.steps });
    }
  }
  assert.equal(runs.size, 100);
  return runs;
}
const main = await verify(files.slice(0, separator));
const candidate = await verify(files.slice(separator + 1));
const games = [];
for (const code of [...main.keys()].sort()) {
  const a = main.get(code), b = candidate.get(code);
  assert.equal(a.initial, b.initial, code);
  const signature = s => JSON.stringify([s.a, s.data?.x, s.data?.y, s.from, s.to]);
  let prefix = 0;
  while (prefix < Math.min(a.commands, b.commands) && signature(a.steps[prefix]) === signature(b.steps[prefix])) prefix++;
  const same = prefix === a.commands && prefix === b.commands;
  assert.equal(same, a.trajectory === b.trajectory);
  games.push({ code, main: [a.won, a.commands], candidate: [b.won, b.commands], same, prefix });
}
const summary = { games: games.length, mainWins: games.filter(g => g.main[0]).length,
  candidateWins: games.filter(g => g.candidate[0]).length, identical: games.filter(g => g.same).length,
  lost: games.filter(g => g.main[0] && !g.candidate[0]).map(g => g.code),
  gained: games.filter(g => !g.main[0] && g.candidate[0]).map(g => g.code) };
await writeFile(output, JSON.stringify({ summary, games }, null, 2) + '\n');
console.log(JSON.stringify(summary));
