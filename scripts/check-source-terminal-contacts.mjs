import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, registry, output] = process.argv.slice(2);
const source = await sourceBackend(resolve(env)),
  programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  sources = new Map(),
  ids = new Set(GAME_CATALOG.map((g) => g.code));
for (const file of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((x) => 'cold12-' + x),
]) {
  for (const line of (await readFile(join(dir, file + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    sources.set(r.code + '/' + r.start, r);
  }
}
const results = [];
for (const t of JSON.parse(await readFile(registry, 'utf8'))) {
  if (!ids.has(t.code)) throw Error('Source only');
  if (!t.fresh) continue;
  const r = sources.get(t.code + '/' + t.level),
    replay = sourceReplay(source, programs, r),
    last = r.steps.length - 1,
    actual = op(r.steps[last]),
    root = replay.restore(last),
    before = hash(root),
    checks = [];
  for (const q of new Set([
    actual,
    ...root.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n),
  ])) {
    if (hash(replay.restore(last)) !== before) throw Error('Different root');
    checks.push({ q, passed: replay.win(replay.act(q)) });
  }
  if (!checks.find((z) => z.q === actual)?.passed) throw Error('Official score mismatch');
  results.push({ code: t.code, level: t.level, candidates: t.offered, correctControl: actual, checks });
}
await writeFile(output, JSON.stringify(results));
console.log(results.length, results.filter((x) => x.checks.some((q) => !q.passed)).length);
