import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// Test the necessity of each placement in a winning arrangement and whether its
// placement operations commute. The final activation is identical for all arms.
const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), reports = [];
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const run = JSON.parse(line), game = getGameByCode(run.code);
  assert.ok(game && game.group !== 'custom_4' && !run.resets && !run.sourcePrefixActions && !run.observedPriorLevelActions);
  const replay = sourceReplay(engine, {}, run);
  let board = replay.restore(0);
  for (const s of run.steps) {
    assert.equal(hash(board).slice(0, 16), s.from);
    board = replay.act(op(s));
    assert.equal(hash(board).slice(0, 16), s.to);
  }
  assert.equal(replay.win(board), run.levels[0].won);
  assert.equal(run.steps.length, run.issued);
  const result = {code: run.code, level: run.start, won: replay.win(board), actions: run.issued, trajectory: run.trajectory};
  reports.push(result);
  if (!result.won) continue;
  const end = run.steps.at(-1);
  let start = run.steps.length - 1;
  while (start && run.steps[start - 1].a === 6 && run.steps[start - 1].family === end.family) start--;
  const clicks = run.steps.slice(start, -1);
  if (end.a === 6 || clicks.length < 2 || clicks.length % 2) continue;
  const pairs = [];
  for (let i = 0; i < clicks.length; i += 2) pairs.push(clicks.slice(i, i + 2).map(op));
  function test(preparations, activate = true) {
    let state = replay.restore(start);
    const inputs = preparations.flat();
    if (activate) inputs.push(op(end));
    for (const input of inputs) {
      if (replay.win(state) || state.state !== 'NOT_FINISHED') break;
      state = replay.act(input);
    }
    return replay.win(state);
  }
  const indices = pairs.map((_, i) => i);
  const swapped = [];
  for (const i of indices) for (const j of indices.slice(i + 1)) {
    const order = [...pairs];
    [order[i], order[j]] = [order[j], order[i]];
    swapped.push({first: i + 1, second: j + 1, won: test(order)});
  }
  Object.assign(result, {prefix: start, pairs: pairs.length, original: test(pairs), activationAlone: test([]),
    withoutActivation: test(pairs, false), leaveOneOut: indices.map(i => test(pairs.filter((_, j) => j !== i))),
    inIsolation: pairs.map(pair => test([pair])), swapped, reverseOrder: test([...pairs].reverse())});
  assert.equal(result.original, true);
}
await writeFile(output, JSON.stringify(reports));
console.log('replayed', reports.length, 'wins', reports.filter(r => r.won).length);
