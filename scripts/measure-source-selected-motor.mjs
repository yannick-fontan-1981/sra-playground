import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [env, solver, output, ...pairs] = process.argv.slice(2);
assert.ok(pairs.length && pairs.length % 2 === 0);
const {newCursorMemory,offerCursorTrial,recordCursorTrial} = await import(
  pathToFileURL(resolve(solver, 'src/sic/marked-cursor-selection.ts')).href);
const engine = await sourceBackend(resolve(env)), results = [];
for (let i = 0; i < pairs.length; i += 2) {
  const runs = (await readFile(pairs[i], 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const {episodes} = JSON.parse(await readFile(pairs[i + 1], 'utf8'));
  for (const episode of episodes) {
    const run = runs.find(r => r.code === episode.code && r.start === episode.level);
    assert.ok(run && getGameByCode(run.code)?.group !== 'custom_4' && !run.resets && !run.sourcePrefixActions && !run.observedPriorLevelActions);
    const replay = sourceReplay(engine, {}, run), cache = new Map();
    async function observe(b) {
      const frame = hash(b);
      if (!cache.has(frame)) cache.set(frame, await measureNativeObservation({frame_rows:b.frame,frame_hash:frame,
        level:b.level,levels_completed:b.levelsCompleted,state:b.state,palette:b.palette,
        available_action_refs:b.availableActionIds.map(a => 'ACTION' + a)}, cache.size, 'source'));
      return cache.get(frame);
    }
    for (const t of episode.tests.filter(t => t.selection === 'reversible_body_choice')) {
      let b = replay.restore(0);
      const memory = newCursorMemory();
      for (const step of run.steps.slice(0, t.at - 1)) {
        const n = replay.act(op(step));
        assert.equal(hash(n).slice(0, 16), step.to);
        recordCursorTrial(memory, await observe(b), await observe(n), b.frame, n.frame, op(step));
        b = n;
      }
      const origin = await observe(b), selection = offerCursorTrial(memory, origin, b.frame, true);
      const click = replay.act(t.input), afterClick = await observe(click);
      const predicted = selection?.command === t.input;
      const visual = recordCursorTrial(memory, origin, afterClick, b.frame, click.frame, t.input, predicted ? selection : undefined);
      const passive = !!memory.pending?.passive, probes = [];
      let current = click, motor;
      while (memory.pending) {
        const pending = memory.pending, command = pending.command;
        assert.ok(!probes.some(probe => probe.command === command));
        const moved = replay.act(command);
        motor = recordCursorTrial(memory, await observe(current), await observe(moved), current.frame, moved.frame, command, pending);
        probes.push({command,result:motor??null});
        if (motor !== 'cursor_move_blocked_try_another_direction') break;
        current = moved;
      }
      results.push({code:run.code,level:run.start,at:t.at,predicted,passive,visual:visual??null,probes,
        motor:motor??null,clickChanged:hash(b)!==hash(click)});
    }
  }
}
await writeFile(output, JSON.stringify(results));
console.log(results.length, results.filter(r => r.probes.length).length, results.filter(r => r.motor === 'new_cursor_moved_while_previous_cursor_stayed').length);
