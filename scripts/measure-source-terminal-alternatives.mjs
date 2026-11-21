import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// Replace one command. Keep the following commands, the public entry and the action count fixed.
const [env, output, codes, ...files] = process.argv.slice(2);
const wanted = new Set(codes.split(','));
assert.ok([...wanted].every(code => getGameByCode(code) && getGameByCode(code).group !== 'custom_4'));
const engine = await sourceBackend(resolve(env)), episodes = [], seen = new Set();
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const run = JSON.parse(line);
  if (run.error || !wanted.has(run.code) || seen.has(run.trajectory)) continue;
  seen.add(run.trajectory);
  assert.ok(run.start === run.finish && !run.resets && !run.sourcePrefixActions && !run.observedPriorLevelActions);
  const replay = sourceReplay(engine, {}, run), tape = run.steps.map(op), clicks = new Set(), choices = [];
  const terminal = board => replay.win(board) ? 'win' : board.state === 'GAME_OVER' ? 'loss' : 'live';
  const baseline = terminal(replay.restore(run.issued));
  assert.equal(baseline === 'win', run.levels[0].won);
  const stride = Math.max(1, Math.ceil(run.issued / 12));
  for (const [i, actual] of tape.entries()) {
    if (actual.startsWith('ACTION6:')) clicks.add(actual);
    if (i % stride && i < tape.length - 3) continue;
    const b = replay.restore(i), receipt = hash(b);
    const alternatives = new Set(b.availableActionIds.filter(id => id >= 1 && id <= 5).map(id => 'ACTION' + id));
    if (b.availableActionIds.includes(6)) {
      for (const click of [...clicks].slice(-5)) alternatives.add(click);
    }
    alternatives.delete(actual);
    for (const candidate of alternatives) {
      assert.equal(hash(replay.restore(i)), receipt);
      let board = replay.act(candidate), end = i + 1;
      const first = terminal(board);
      while (end < tape.length && terminal(board) === 'live') {
        const id = run.steps[end].a;
        if (!board.availableActionIds.includes(id)) break;
        board = replay.act(tape[end++]);
      }
      const outcome = terminal(board);
      choices.push({ at: i + 1, origin: receipt.slice(0, 16), actual, candidate, first, outcome,
        end, interrupted: outcome === 'live' && end < tape.length });
    }
  }
  const game = getGameByCode(run.code);
  episodes.push({ code: run.code, level: run.start, group: game.group, baseline, actions: run.issued, choices });
  console.log(run.code, run.start, baseline, choices.length, choices.filter(x => x.first === 'loss').length,
    choices.filter(x => x.outcome === 'loss').length, choices.filter(x => x.outcome === 'win').length);
}
await writeFile(output, JSON.stringify(episodes));
