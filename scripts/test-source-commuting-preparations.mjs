import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { overlay, combinedPositions } from './source-isolated-preparations.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';

// Fit no game-specific symbols. Try both orders of two preparations and a common
// final use. Repeated preparations keep the lengths and the clock identical.
const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), results = [], seen = new Set();
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code), key = r.code + '/' + r.start;
  assert.ok(game && game.group !== 'custom_4');
  if (!r.levels?.[0]?.won || r.error || r.resets || r.sourcePrefixActions || r.observedPriorLevelActions
      || r.start !== r.finish || seen.has(key)) continue;
  seen.add(key);
  const replay = sourceReplay(engine, {}, r), tape = r.steps.map(op);
  assert.ok(replay.win(replay.restore(tape.length)));
  const experiments = [];
  for (const length of [1, 2]) for (const tail of [1, 2]) {
    const prefix = tape.length - tail - 2 * length;
    if (prefix < 0) continue;
    const a = tape.slice(prefix, prefix + length), b = tape.slice(prefix + length, -tail), use = tape.slice(-tail);
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const initial = replay.restore(prefix), memo = new Map();
    function arm(commands) {
      const id = commands.join('/');
      if (!memo.has(id)) {
        let board = replay.restore(prefix), used = 0;
        for (const cmd of commands) {
          if (replay.win(board) || board.state !== 'NOT_FINISHED'
              || !board.availableActionIds.includes(Number(cmd.split(':')[0].slice(6)))) break;
          board = replay.act(cmd); used++;
        }
        memo.set(id, {board, used, won: replay.win(board)});
      }
      return memo.get(id);
    }
    const first = arm(a), second = arm(b);
    if (first.won || second.won || first.used < length || second.used < length) continue;
    // Fix the predicted arrangement using just the two isolated preparations.
    const forecast = overlay(initial.frame, first.board.frame, second.board.frame);
    const positions = combinedPositions(initial.frame, first.board.frame, second.board.frame);
    const afterAB = arm([...a, ...b]), afterBA = arm([...b, ...a]);
    const signature = v => hash(v.board).slice(0, 16);
    const ab = signature(afterAB), ba = signature(afterBA);
    assert.equal(ab, r.steps[tape.length - tail - 1].to);
    const swapped = arm([...b, ...a, ...use]), original = arm([...a, ...b, ...use]);
    assert.ok(original.won && !afterAB.won && original.used === tape.length - prefix);
    const bothOrders = swapped.won && !afterBA.won && swapped.used === original.used;
    const row = {prefix, length, tail, a, b, use, bothOrders, sameArrangement: ab === ba,
      onlyA: forecast.onlyA, onlyB: forecast.onlyB, conflicts: forecast.conflicts,
      overlayAvailable: forecast.anticipated !== null, overlayAB: ab === forecast.anticipated, overlayBA: ba === forecast.anticipated,
      writesAB: forecast.retained(afterAB.board.frame), writesBA: forecast.retained(afterBA.board.frame),
      added: positions.added, separate: positions.separate, positionsAB: positions.check(afterAB.board.frame),
      positionsBA: positions.check(afterBA.board.frame)};
    if (bothOrders) {
      const withoutA = arm([...b, ...use]).won, withoutB = arm([...a, ...use]).won;
      const noPreparation = arm(use).won, duplicateA = arm([...a, ...a, ...use]).won, duplicateB = arm([...b, ...b, ...use]).won;
      Object.assign(row, {withoutA, withoutB, noPreparation, duplicateA, duplicateB,
        requiresBoth: !(withoutA || withoutB || noPreparation || duplicateA || duplicateB)});
    }
    experiments.push(row);
  }
  results.push({code: r.code, level: r.start, experiments});
}
await writeFile(output, JSON.stringify(results));
console.log('source wins', results.length, 'windows', results.reduce((count, r) => count + r.experiments.length, 0));
