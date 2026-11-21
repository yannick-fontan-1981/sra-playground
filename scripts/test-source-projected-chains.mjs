import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { applicable, preparationModel, predictionHolds } from './source-project-preparations.mjs';

const [environment, output, mode, ...files] = process.argv.slice(2);
assert.ok(['last-three', 'fixed'].includes(mode));
const engine = await sourceBackend(resolve(environment)),
  seen = new Set();
await writeFile(output, '', { flag: 'wx' });
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ongoing = (replay, board) => !replay.win(board) && board.state === 'NOT_FINISHED';
const legal = (board, word) => board.availableActionIds.includes(Number(word.split(':')[0].slice(6)));
function evaluate(replay, tape, prefix, compose) {
  const model = preparationModel(),
    events = [],
    probes = [];
  let board = replay.restore(0);
  for (const step of tape.slice(0, prefix)) {
    assert.equal(hash(board).slice(0, 16), step.from);
    const before = board,
      word = op(step);
    board = replay.act(word);
    assert.equal(hash(board).slice(0, 16), step.to);
    model.observe(before.frame, board.frame, word, step.from);
  }
  const origin = hash(board);
  function restore() {
    let current = replay.restore(prefix);
    for (const step of events) {
      current = replay.act(step.op);
      assert.equal(hash(current), step.end);
    }
    return current;
  }
  function act(step) {
    const before = board,
      start = hash(board);
    board = replay.act(step.op);
    const playable = ongoing(replay, board),
      end = hash(board);
    events.push({
      op: step.op,
      end,
      confirmed: playable && predictionHolds(board.frame, step),
      won: replay.win(board),
    });
    if (playable) {
      if (!events.at(-1).confirmed) model.refute(step);
      model.observe(before.frame, board.frame, step.op, start.slice(0, 16));
    }
    return events.at(-1);
  }
  while (events.length < 12 && ongoing(replay, board)) {
    const start = hash(board),
      available = new Set(board.availableActionIds.map((id) => 'ACTION' + id));
    const program = model.choose(board.frame, start.slice(0, 16), available, events.length < 11 && compose);
    if (!program) break;
    const [a, b] = program.steps;
    if (!b) {
      act(a);
      continue;
    }
    // Fix the forecast before intervening. The direct arm is never shown to the policy.
    const probe = { at: events.length, origin: start, forecast: digest(program.steps), a: a.op, b: b.op };
    const direct = replay.act(b.op);
    probe.directWon = replay.win(direct);
    probe.direct = ongoing(replay, direct) && predictionHolds(direct.frame, b);
    board = restore();
    assert.equal(hash(board), start);
    const first = act(a);
    probe.first = first.confirmed;
    if (first.confirmed && legal(board, b.op) && applicable(board.frame, b)) {
      const second = act(b);
      probe.executed = true;
      probe.pair = second.confirmed;
      probe.won = second.won;
    }
    // The equal-length control uses two real actions from the same origin.
    if (probe.pair || probe.won) {
      const scored = hash(board);
      let same = replay.restore(prefix);
      for (const step of events.slice(0, probe.at)) same = replay.act(step.op);
      assert.equal(hash(same), start);
      same = replay.act(b.op);
      if (ongoing(replay, same) && legal(same, b.op)) {
        same = replay.act(b.op);
        probe.duplicate = ongoing(replay, same) && predictionHolds(same.frame, b);
        probe.duplicateWon = replay.win(same);
      }
      board = restore();
      assert.equal(hash(board), scored);
    }
    probes.push(probe);
  }
  return { origin, actions: events.map((e) => e.op), wonAt: events.findIndex((e) => e.won) + 1, probes };
}
for (const file of files)
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/).filter(Boolean)) {
    const r = JSON.parse(line),
      game = getGameByCode(r.code),
      id = [r.code, r.start].join('/');
    assert.ok(game && game.group !== 'custom_4');
    if (
      seen.has(id) ||
      r.error ||
      r.resets ||
      r.sourcePrefixActions ||
      r.observedPriorLevelActions ||
      r.start !== r.finish
    )
      continue;
    if (mode === 'last-three' && !r.levels[0].won) continue;
    seen.add(id);
    const replay = sourceReplay(engine, {}, r);
    const cuts = mode === 'last-three' ? [r.steps.length - 3] : [0, 8, 24, 48];
    for (const prefix of cuts.filter((n) => n >= 0 && n < r.steps.length)) {
      const arms = [false, true, 'blocked-use'].map((composition) =>
        evaluate(replay, r.steps, prefix, composition),
      );
      assert.equal(arms[0].origin, arms[1].origin);
      assert.equal(arms[0].origin, arms[2].origin);
      await appendFile(
        output,
        JSON.stringify({
          code: r.code,
          level: r.start,
          prefix,
          mode,
          sourceWon: r.levels[0].won,
          single: arms[0],
          composition: arms[1],
          blockedUse: arms[2],
        }) + '\n',
      );
    }
  }
