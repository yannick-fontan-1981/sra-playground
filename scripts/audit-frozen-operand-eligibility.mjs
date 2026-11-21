import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';

const [frozen, environment, output, ...files] = process.argv.slice(2);
const load = (root, path) => import(pathToFileURL(resolve(root, path)).href);
const { createGameDispatcher } = await load(environment, 'src/runtime/native-game-dispatcher.ts');
const { measureNativeObservation, publicFrameHash } = await load(frozen, 'src/logos-engine/v6-native-observer.ts');
const { newOperandMemory, learnOperands, operandPlan } = await load(frozen, 'src/sic/operand-composition.ts');
async function observe(board, turn) {
  return measureNativeObservation({
    frame_rows: board.frame, frame_hash: await publicFrameHash(board.frame), level: board.level,
    levels_completed: board.levelsCompleted, state: board.state, available_action_refs: board.availableActionIds.map(n => 'ACTION' + n),
  }, turn, 'frozen-operand-evaluation');
}
const results = [];
for (const file of files) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    assert.ok(/^SS(0[1-8]|10)$/.test(run.code) && !run.error && !run.resets && !run.observedPriorLevelActions);
    const engine = createGameDispatcher(() => { throw Error('Unexpected engine'); });
    let board = await engine.dispatch({type: 'load', code: run.code, level: run.start});
    if (board.level !== run.start && board.canSelectLevel) board = await engine.dispatch({type:'selectLevel',level:run.start});
    assert.equal(hash(board), run.initial);
    let previous = await observe(board, 0);
    const memory = newOperandMemory();
    const counts = {rule: 0, confirmedSite: 0, planIgnoringScheduling: 0, selected: 0};
    const first = {};
    function count(key, condition, step) {
      if (!condition) return;
      counts[key]++;
      first[key] ??= step;
    }
    for (const [index, command] of run.replayCommands.entries()) {
      assert.equal(hash(board).slice(0, 16), command.from);
      const step = index + 1;
      count('rule', memory.rules.length, step);
      count('confirmedSite', memory.rules.some(rule => rule.sites.some(site => site.confirmed)), step);
      // Ask the frozen proposal function directly, before the scheduler and the other
      // composition programs compete. No hypothetical command is executed.
      count('planIgnoringScheduling', operandPlan(memory, previous, board.frame, run.cap - index), step);
      count('selected', command.operand, step);
      const next = await engine.dispatch({type:'action',actionId:command.id,...(command.id === 6 ? {data:command.data} : {})});
      assert.equal(hash(next).slice(0, 16), command.to);
      const current = await observe(next, step);
      if (previous.level_epoch === current.level_epoch && previous.state === current.state && previous.levels_completed === current.levels_completed) {
        const key = 'ACTION' + command.id + (command.id === 6 ? ':' + command.data.x + ',' + command.data.y : '');
        learnOperands(memory, previous, current, board.frame, next.frame, key);
      }
      board = next;
      previous = current;
    }
    results.push({code:run.code, level:run.start, actions:run.issued, counts, first});
  }
}
await writeFile(output, JSON.stringify(results));
console.log('audited', results.length);
