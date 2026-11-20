import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, stem, out] = process.argv.slice(2),
  games = await sourceBackend(resolve(env)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const defs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  rows = [];
for (const f of [
  ...Array.from({ length: 8 }, (_, j) => 'source-final-' + j),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
])
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code + '/' + r.start, r);
  }
const eq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1],
  pos = (g, k) => (g?.groups.get(k)?.length === 1 ? g.groups.get(k)[0].p : null);
for (let j = 0; j < 6; j++)
  for (const t of JSON.parse(await readFile(join(dir, stem + j + '.json'), 'utf8'))) {
    if (!allowed.has(t.code)) throw Error('Source only');
    const first = t.sequence.findIndex((x) => x.hit);
    if (first < 0) continue;
    const r = runs.get(t.code + '/' + t.level),
      rep = sourceReplay(games, defs, r),
      read = sourcePoseIndex();
    let b = rep.restore(0);
    for (let k = 0; k <= t.i; k++) {
      await read(b);
      if (k < t.i) b = rep.act(op(r.steps[k]));
    }
    const q = t.sequence[first].q,
      prep = t.sequence.slice(0, first).map((v) => v.q),
      keys = t.ranked.map((v) => v.q),
      tested = new Map();
    async function attempt(word) {
      const id = JSON.stringify(word);
      if (tested.has(id)) return tested.get(id);
      let board = rep.restore(t.i),
        preserved = true;
      for (const a of word) {
        board = rep.act(a);
        if (rep.win(board) || board.state !== b.state) {
          preserved = false;
          break;
        }
        const g = await read(board);
        preserved &&= eq(pos(g, t.p), t.origin) && eq(pos(g, t.r), t.site);
      }
      const before = hash(board).slice(0, 16),
        end = preserved ? rep.act(q) : board,
        g = rep.win(end) || end.state !== b.state ? null : await read(end);
      const item = {
        word,
        preserved: !!preserved,
        before,
        end: hash(end).slice(0, 16),
        arrived: pos(g, t.p),
        hit: !!(preserved && eq(pos(g, t.p), t.site)),
      };
      tested.set(id, item);
      return item;
    }
    await attempt([]);
    // Test actual subsequences and equal-length rival preparations to distinguish order, timing and action identity.
    for (let mask = 1; mask < 2 ** prep.length; mask++) await attempt(prep.filter((_, n) => mask & (1 << n)));
    for (const k of keys) for (let n = 1; n <= prep.length; n++) await attempt(Array(n).fill(k));
    const values = [...tested.values()],
      shortest = values.filter((v) => v.hit).sort((a, b) => a.word.length - b.word.length)[0];
    const rival =
      shortest && values.find((v) => v.preserved && !v.hit && v.word.length === shortest.word.length);
    const absent = t.ranked.find((v) => v.q === q)?.absentRef;
    rows.push({
      code: t.code,
      level: t.level,
      i: t.i,
      root: t.root,
      origin: t.origin,
      mark: t.site,
      q,
      sequence: prep,
      direct: values[0],
      shortest,
      rival,
      matchedAbsent: absent,
      tests: values.length,
      positive: values.filter((v) => v.hit).length,
      distinctEnds: new Set(values.filter((v) => v.hit).map((v) => v.end)).size,
    });
  }
await writeFile(out, JSON.stringify(rows, null, 2) + '\n');
console.log(rows.length);
