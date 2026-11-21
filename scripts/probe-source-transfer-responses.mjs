import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

// Intervene on the very next command after the offline tracker predicts joint motion.
// Give the tracker only the public prefix and the new observation for each branch.
const [environment, findings, output, ...files] = process.argv.slice(2);
const { localExact } = JSON.parse(await readFile(findings, 'utf8'));
const pending = new Map(localExact.filter(row => row.transfers.length).map(row =>
  [row.code + '/' + row.level, [...new Set(row.transfers.map(event => event.step))]]));
const engine = await sourceBackend(resolve(environment));
const cases = [];
for (const file of files) {
  const lines = (await readFile(file, 'utf8')).trim().split(/\r?\n/);
  for (const line of lines) {
    const run = JSON.parse(line);
    const key = run.code + '/' + run.start;
    const cutPoints = pending.get(key);
    if (!cutPoints) continue;
    const game = getGameByCode(run.code);
    assert.ok(game && game.group !== 'custom_4');
    assert.ok(!run.observedPriorLevelActions && !run.sourcePrefixActions && !run.resets);
    const replay = sourceReplay(engine, {}, run);
    for (const at of cutPoints) {
      const pose = sourcePoseIndex();
      let board = replay.restore(0);
      const frames = {}, steps = [], branches = [];
      for (const step of run.steps.slice(0, at)) {
        const from = hash(board).slice(0, 16);
        assert.equal(from, step.from);
        frames[from] ??= (await pose(board)).rows;
        board = replay.act(op(step));
        const to = hash(board).slice(0, 16);
        assert.equal(to, step.to);
        assert.equal(board.state, 'NOT_FINISHED');
        frames[to] ??= (await pose(board)).rows;
        steps.push([from, op(step), to, false]);
      }
      const last = steps.at(-1)[2];
      const publicCommands = board.availableActionIds.filter(id => id >= 1 && id <= 5).map(id => 'ACTION' + id);
      const actual = run.steps[at] && op(run.steps[at]);
      if (actual?.startsWith('ACTION6:')) publicCommands.push(actual);
      for (const command of publicCommands) {
        assert.equal(hash(replay.restore(at)).slice(0, 16), last);
        const next = replay.act(command), to = hash(next).slice(0, 16);
        const terminal = next.state !== 'NOT_FINISHED' || replay.win(next);
        if (!terminal) frames[to] ??= (await pose(next)).rows;
        if (command === actual) assert.equal(to, run.steps[at].to);
        branches.push([last, command, to, terminal]);
      }
      cases.push({ code: run.code, level: run.start, at, actual, steps, frames, branches });
    }
    pending.delete(key);
  }
}
assert.equal(pending.size, 0, 'Missing source tapes for identified hypotheses');
await writeFile(output, JSON.stringify(cases));
console.log('source prefixes', cases.length, 'command alternatives', cases.reduce((n, c) => n + c.branches.length, 0));
