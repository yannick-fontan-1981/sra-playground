import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion,encounterRoute,preparationVisible} from './source-projected-encounters.mjs';

const [environment,ranking,output,...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)), rules = JSON.parse(await readFile(ranking,'utf8')).rules;
const results = [], seen = new Set(), prefix = 8, budget = 32;
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code), id = r.code+'/'+r.start;
  assert.ok(game && game.group !== 'custom_4');
  if (seen.has(id) || r.error || r.resets || r.sourcePrefixActions || r.observedPriorLevelActions || r.start !== r.finish) continue;
  seen.add(id);
  const rep = sourceReplay(engine,{},r);
  const report = {code:r.code,level:r.start,historicalWinWithinBudget:r.levels[0].won && r.issued <= prefix+budget,
    historicalFullWin:r.levels[0].won,arms:[]};
  results.push(report);
  if (r.steps.length <= prefix || !rules[r.code]) continue;
  for (const horizon of [2,6]) {
    let board = rep.restore(0), view = footprints(board.frame);
    if (board.availableActionIds.filter(n => n>=1 && n<=4).length < 2) break;
    const memory = new Map(), tried = new Set(), used = new Map();
    for (const s of r.steps.slice(0,prefix)) {
      board = rep.act(op(s));
      assert.equal(hash(board).slice(0,16),s.to);
      const after = footprints(board.frame);
      if (s.a>=1 && s.a<=4) observeEncounterMotion(memory,view,after,op(s));
      view = after;
    }
    const origin = hash(board);
    const arm = {horizon,origin,issued:0,checked:0,matched:0,completedRoutes:0,routeSizes:[],won:false,inputs:[]};
    report.arms.push(arm);
    let plan = null, index = 0;
    while (arm.issued < budget && !rep.win(board) && board.state === 'NOT_FINISHED') {
      const h = hash(board), attempted = used.get(h) ?? new Set(), dirs = board.availableActionIds
        .filter(n=>n>=1 && n<=4).map(n=>'ACTION'+n);
      if (!plan) {
        plan = encounterRoute(view,memory,dirs,[board.frame[0].length,board.frame.length],
          Math.min(horizon,budget-arm.issued),rules[r.code],tried,attempted);
        index = 0;
        if (!plan) break;
        arm.routeSizes.push(plan.steps.length);
      }
      const s = plan.steps[index];
      if (!dirs.includes(s.input) || attempted.has(s.input)) {
        tried.add(plan.id);
        plan = null;
        continue;
      }
      attempted.add(s.input);used.set(h,attempted);
      board = rep.act(s.input);
      arm.inputs.push(s.input);
      arm.issued++;
      if (rep.win(board) || board.state !== 'NOT_FINISHED') break;
      const next = footprints(board.frame);
      observeEncounterMotion(memory,view,next,s.input);
      view = next;
      index++;
      if (index === plan.steps.length) {
        arm.completedRoutes++;
        tried.add(plan.id);
        plan = null;
      } else {
        arm.checked++;
        if (preparationVisible(next,{...plan,...s})) arm.matched++;
        else plan = null;
      }
    }
    arm.won = rep.win(board);
    arm.final = hash(board);
    arm.state = board.state;
  }
}
await writeFile(output,JSON.stringify(results));
console.log('levels',results.length,'route wins',results.flatMap(r=>r.arms).filter(a=>a.won).length);
