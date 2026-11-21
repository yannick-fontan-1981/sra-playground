import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG, getGameByCode } from '../src/games/catalog.ts';
import { continuationAt, newLocalMemory, observeLocal } from '../src/sic/prospective-local-use.ts';
import { localPatch } from '../src/sic/local-response.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, output, ...files] = process.argv.slice(2);
const heldout = new Set(['hanoi_order', ...GAME_CATALOG.filter(g => g.group === 'official').map(g => g.family)]);
const programs = JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url),'utf8'));
const engine = await sourceBackend(resolve(environment));
const entries = [];
function observation(board, index) {
  return { frame_hash: hash(board), observation_ref: String(index), level_epoch: board.level,
    levels_completed: board.levelsCompleted, state: board.state, available_action_refs: board.availableActionIds.map(id => 'ACTION'+id) };
}
for (const file of files) {
  for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    const entry = getGameByCode(run.code);
    assert.ok(entry && entry.group !== 'custom_4');
    if (heldout.has(entry.family)) continue;
    assert.ok(!run.error && !run.resets && !run.observedPriorLevelActions && run.start === run.finish && run.steps.length === run.issued);
    const replay = sourceReplay(engine, programs, run), memory = newLocalMemory();
    let board = replay.restore(0), before = observation(board, 0);
    const emitted = [], seen = new Set();
    for (const [i, step] of run.steps.entries()) {
      assert.equal(before.frame_hash.slice(0,16), step.from);
      // Seal the prediction before consulting the historical command or its return.
      const plan = continuationAt(memory, before, board.frame);
      if (plan && !seen.has(before.frame_hash+'/'+plan.c)) {
        seen.add(before.frame_hash+'/'+plan.c);
        emitted.push({ i, plan });
      }
      const next = replay.act(op(step)), after = observation(next, i+1);
      assert.equal(after.frame_hash.slice(0,16), step.to);
      observeLocal(memory, before, after, board.frame, next.frame, op(step));
      board = next;
      before = after;
    }
    assert.equal(replay.win(board),run.levels[0].won);
    const checks = [];
    for (const {i,plan} of emitted) {
      const root = Number(plan.observedPrefix.first)-1;
      assert.ok(Number.isInteger(root) && root >= 0 && root + 2 <= i);
      function check(at, word) {
        let b = replay.restore(at);
        for (const command of word) {
          const id = Number(command.split(':')[0].slice(6));
          if (replay.win(b) || b.state !== 'NOT_FINISHED' || !b.availableActionIds.includes(id)) return null;
          b = replay.act(command);
        }
        return b.level === run.start && !replay.win(b) && b.state === 'NOT_FINISHED' ? localPatch(b,plan.siteC) === plan.afterC : null;
      }
      checks.push({ i, root, c: plan.c, followed: op(run.steps[i]) === plan.c,
        matched: check(i,[plan.c]), withoutA: check(root,[plan.b,plan.c]), withoutB: check(root,[plan.a,plan.c]),
        alone: check(root,[plan.c]) });
    }
    entries.push({code:run.code,level:run.start,steps:run.issued,checks});
  }
}
const trials = entries.flatMap(entry=>entry.checks);
const summary = { entries:entries.length, actions:entries.reduce((n,e)=>n+e.steps,0), proposals:trials.length,
  entriesWithProposal:entries.filter(e=>e.checks.length).length, matched:trials.filter(r=>r.matched===true).length,
  contradicted:trials.filter(r=>r.matched===false).length,
  controlled:trials.filter(r=>r.matched===true && [r.withoutA,r.withoutB,r.alone].every(v=>v===false)).length,
  followedHistorically:trials.filter(r=>r.followed).length };
await writeFile(output, JSON.stringify({summary,entries},null,2)+'\n');
console.log(JSON.stringify(summary));
