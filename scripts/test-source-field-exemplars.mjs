import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { exemplarPlans } from '../src/sic/field-exemplars.ts';
import { fieldObligationPlans, fulfillsSite } from '../src/sic/field-obligations.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, output, ...inputs] = process.argv.slice(2);
const prior = inputs.find(s => s.startsWith('--prior='));
const rules = prior ? JSON.parse(await readFile(prior.slice(8),'utf8')).rules : null;
const files = inputs.filter(s => s !== prior);
const engine = await sourceBackend(resolve(environment));
const results = [];
const click = ([x,y,right,bottom]) => 'ACTION6:' + [Math.floor((x+right)/2), Math.floor((y+bottom)/2)].join(',');
const uniform = (rows, cell) => {
  const [x,y,right,bottom] = cell.box, value = rows[y][x];
  return rows.slice(y,bottom+1).every(row => row.slice(x,right+1).every(v => v === value)) ? value : null;
};

function tryPlan(rep, run, prefix, plan) {
  let board = rep.restore(prefix);
  const commands = [], tested = new Set(), predictions = [];
  const assignments = plan.obligations ?? plan.assignments;
  const satisfied = (value,cell) => plan.obligations ? fulfillsSite(value,cell) : value === cell.desired;
  const initiallyWrong = assignments.filter(cell => !satisfied(uniform(board.frame,cell),cell));
  const fixed = assignments.find(cell => satisfied(uniform(board.frame,cell),cell));
  let stop = 'budget';
  while (prefix + commands.length < run.cap) {
    const wrong = assignments.filter(cell => !satisfied(uniform(board.frame,cell),cell));
    if (!wrong.length) { stop = 'predicted_configuration_reached'; break; }
    if (!board.availableActionIds.includes(6)) { stop = 'command_unavailable'; break; }
    const chosen = wrong[0], value = uniform(board.frame,chosen);
    const key = JSON.stringify([chosen.box,value]);
    if (tested.has(key)) { stop = 'repeated_value_at_site'; break; }
    tested.add(key);
    const held = assignments.filter(cell => satisfied(uniform(board.frame,cell),cell));
    const input = click(chosen.box);
    board = rep.act(input);
    commands.push(input);
    const won = rep.win(board);
    const kept = !won && held.every(cell => satisfied(uniform(board.frame,cell),cell));
    predictions.push({box:chosen.box, from:value, ...(plan.obligations?{equal:chosen.equal,different:chosen.different}:{desired:chosen.desired}), held:held.length,
      observed:won?null:uniform(board.frame,chosen), kept:won?null:kept, won});
    if (won) { stop = 'official_completion'; break; }
    if (board.state !== 'NOT_FINISHED' || !kept) { stop = 'preservation_or_state_refuted'; break; }
  }
  function replay(word) {
    let b = rep.restore(prefix), used = 0;
    for (const c of word) {
      if (b.state !== 'NOT_FINISHED' || !b.availableActionIds.includes(6) || rep.win(b)) break;
      b = rep.act(c);
      used++;
    }
    return {won:rep.win(b),used,final:hash(b).slice(0,16)};
  }
  const won = rep.win(board);
  let controls;
  if (won) {
    const repeat = replay(commands);
    assert.ok(repeat.won && repeat.used === commands.length && repeat.final === hash(board).slice(0,16));
    controls = {repeat, omitFirst:replay(commands.slice(1)), repeatFirst:replay(commands.map(() => commands[0])),
      replaced:fixed?replay([click(fixed.box),...commands.slice(1)]):null};
  }
  return {prefix, examples:plan.examples, agreements:plan.agreements, orientations:plan.orientations, relativeRules:plan.relativeRules,
    ...(plan.obligations?{cues:plan.cues.length,distinctSites:plan.obligations.length}:{}),
    wrongAtStart:initiallyWrong.length,
    predictions, commands, stop, won, controls};
}

for (const file of files) {
  for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line), game = getGameByCode(run.code);
    assert.ok(game && game.group !== 'custom_4');
    if (run.error || run.resets || run.sourcePrefixActions || run.observedPriorLevelActions) continue;
    const rep = sourceReplay(engine,{},run), trials = [], inspected = [];
    for (const prefix of [0,4,12,23]) {
      if (prefix >= run.issued) continue;
      const board = rep.restore(prefix);
      if (!board.availableActionIds.includes(6)) break;
      const parts = geometricComponents(board.frame);
      const plans = rules ? fieldObligationPlans(board.frame,parts,rules) : exemplarPlans(board.frame,parts);
      inspected.push({prefix, plans:plans.length});
      if (plans[0]) trials.push(tryPlan(rep,run,prefix,plans[0]));
    }
    results.push({code:run.code,level:run.start,baselineWon:run.levels[0].won,baselineActions:run.issued,inspected,trials});
  }
}
await writeFile(output,JSON.stringify(results));
console.log('levels',results.length,'with plans',results.filter(r=>r.trials.length).length,'cold wins',results.filter(r=>r.trials.some(t=>!t.prefix&&t.won)).length);
