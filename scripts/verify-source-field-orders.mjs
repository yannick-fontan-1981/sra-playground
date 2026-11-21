import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run=JSON.parse(line), game=getGameByCode(run.code);
  assert.ok(game && game.group!=='custom_4' && !run.error && !run.resets && !run.observedPriorLevelActions && !run.sourcePrefixActions);
  if (!run.levels[0].won || !run.replayCommands.length || !run.replayCommands.every(c=>c.field && c.id===6)) continue;
  const rep=sourceReplay(engine,{},run), tape=run.replayCommands.map(c=>'ACTION6:'+c.data.x+','+c.data.y);
  function play(actions) {
    let b=rep.restore(0), used=0;
    for (const a of actions) {
      if (rep.win(b) || b.state!=='NOT_FINISHED' || !b.availableActionIds.includes(6)) break;
      b=rep.act(a);
      used++;
    }
    return {won:rep.win(b),used,final:hash(b).slice(0,16)};
  }
  const repeat=play(tape);
  assert.ok(repeat.won && repeat.used===run.issued);
  const omission=tape.map((_,i)=>play(tape.filter((_,j)=>i!==j)).won);
  const swaps=tape.slice(1).map((_,i)=>{
    const copy=[...tape];
    [copy[i],copy[i+1]]=[copy[i+1],copy[i]];
    return play(copy).won;
  });
  const reversed=play([...tape].reverse());
  let pairs=0, sameBoard=0, sameScore=0;
  for (const [i,a] of tape.entries()) for (const b of tape.slice(i+1)) {
    if (a===b) continue;
    const ab=play([a,b]),ba=play([b,a]);
    pairs++;
    sameBoard+=Number(ab.final===ba.final);
    sameScore+=Number(ab.won===ba.won);
  }
  results.push({code:run.code,level:run.start,actions:tape.length,distinctCommands:new Set(tape).size,
    omissionTests:omission.length,stillWonWhenOmitted:omission.flatMap((v,i)=>v?[i+1]:[]),
    adjacentSwaps:swaps.length,winningAdjacentSwaps:swaps.filter(Boolean).length,reversed,
    distinctCommandPairs:pairs,sameBoardAfterEitherOrder:sameBoard,sameScoreAfterEitherOrder:sameScore});
}
await writeFile(output,JSON.stringify(results));
console.log('verified orders',results.map(r=>[r.level,r.actions,r.stillWonWhenOmitted.length,r.reversed.won]));
