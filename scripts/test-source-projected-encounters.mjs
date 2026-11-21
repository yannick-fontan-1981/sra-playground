import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay, hash, op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion, projectEncounters, preparationVisible} from './source-projected-encounters.mjs';

const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), reports = [], seen = new Set();
for (const file of files) for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
  const run = JSON.parse(line), game = getGameByCode(run.code);
  assert.ok(game && game.group !== 'custom_4');
  if (run.error || run.resets || run.sourcePrefixActions || run.observedPriorLevelActions || run.start !== run.finish) continue;
  const id = run.code + '/' + run.start;
  if (seen.has(id)) continue;
  seen.add(id);
  const early = [4,8,16], final = run.steps.length - 2;
  const prefixes = new Set([...early, final].filter(n => n >= 0 && n < run.steps.length));
  const report = {code:run.code, level:run.start, historicalWin:run.levels[0].won, samples:[]};
  reports.push(report);
  const rep = sourceReplay(engine, {}, run), memory = new Map();
  let board = rep.restore(0);
  if (board.availableActionIds.filter(n => n >= 1 && n <= 4).length < 2) continue;
  let view = footprints(board.frame);
  for (let i = 0; i <= Math.max(...prefixes); i++) {
    if (prefixes.has(i)) {
      const dirs = board.availableActionIds.filter(n => n >= 1 && n <= 4).map(n => 'ACTION' + n);
      const sample = {prefix:i, fixed:early.includes(i), atEnd:i === final, choices:[], direct:{}};
      report.samples.push(sample);
      const plans = dirs.flatMap(a => dirs.map(b => ({a, b, predictions:
        projectEncounters(view, memory, a, b, [board.frame[0].length,board.frame.length])})));
      if (plans.some(p => p.predictions.length)) {
        // All predictions are made on the real prefix, before any alternative
        // is played. Each alternative is then run independently.
        for (const a of dirs) {
          rep.restore(i);
          const mid = rep.act(a), midHash = hash(mid), immediate = rep.win(mid);
          sample.direct[a] = immediate;
          const middle = immediate || mid.state !== 'NOT_FINISHED' ? null : footprints(mid.frame);
          for (const plan of plans.filter(p => p.a === a)) {
            const {b, predictions} = plan;
            const flags = [...new Set(predictions.flatMap(p => p.flags))].sort();
            const feasible = !!middle && mid.availableActionIds.includes(Number(b.slice(6)));
            const verifiedFlags = [...new Set((middle ? predictions.filter(p => preparationVisible(middle,p)) : [])
              .flatMap(p => p.flags))].sort();
            let win = false;
            if (feasible) {
              rep.restore(i);
              assert.equal(hash(rep.act(a)), midHash);
              win = rep.win(rep.act(b));
            }
            sample.choices.push({a,b,flags,verifiedFlags,verified:verifiedFlags.length > 0,feasible,win});
          }
        }
        board = rep.restore(i);
      }
    }
    if (i === Math.max(...prefixes)) break;
    const step = run.steps[i], next = rep.act(op(step));
    assert.equal(hash(next).slice(0,16), step.to);
    const after = footprints(next.frame);
    if (step.a >= 1 && step.a <= 4) observeEncounterMotion(memory, view, after, op(step));
    view = after;
    board = next;
  }
}
await writeFile(output, JSON.stringify(reports));
console.log('levels', reports.length, 'eligible positions', reports.flatMap(r => r.samples).filter(s => s.choices.length).length);
