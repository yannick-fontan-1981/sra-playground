import assert from 'node:assert/strict';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, forecastFile, output, ...files] = process.argv.slice(2);
const plans = new Map(),
  done = new Set();
const read = async (f) => (await readFile(f, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
for (const p of await read(forecastFile)) {
  const key = p.code + '/' + p.level;
  if (!plans.has(key)) plans.set(key, []);
  plans.get(key).push(p);
}
const engine = await sourceBackend(resolve(environment));
await writeFile(output, '', { flag: 'wx' });
for (const f of files)
  for (const r of await read(f)) {
    const key = r.code + '/' + r.start;
    if (!plans.has(key) || done.has(key)) continue;
    assert.ok(getGameByCode(r.code) && getGameByCode(r.code).group !== 'custom_4');
    assert.ok(!r.resets && !r.error && !r.sourcePrefixActions && !r.observedPriorLevelActions);
    done.add(key);
    const replay = sourceReplay(engine, {}, r);
    for (const p of plans.get(key)) {
      const cache = new Map();
      function play(word) {
        const id = word.join('/');
        if (cache.has(id)) return cache.get(id);
        let board = replay.restore(p.prefix),
          actions = 0;
        assert.equal(hash(board), p.origin);
        for (const cmd of word) {
          if (
            replay.win(board) ||
            board.state !== 'NOT_FINISHED' ||
            !board.availableActionIds.includes(Number(cmd.split(':')[0].slice(6)))
          )
            break;
          board = replay.act(cmd);
          actions++;
        }
        const score = { won: replay.win(board), actions };
        cache.set(id, score);
        return score;
      }
      function measure(word) {
        const [a, b, u] = word,
          result = play(word);
        if (!result.won || result.actions !== 3) return { won: result.won, necessary: false };
        const necessary = [[a, u], [b, u], [u], [a, a, u], [b, b, u]].every((control) => !play(control).won);
        return { won: true, necessary };
      }
      await appendFile(
        output,
        JSON.stringify({
          code: r.code,
          level: r.start,
          prefix: p.prefix,
          proposed: measure(p.proposed),
          ...(p.inferredUse ? { inferredUse: measure(p.inferredUse) } : {}),
          reference: p.reference.map(measure),
          options: p.options,
          tied: p.equallyRanked,
        }) + '\n',
      );
    }
  }
