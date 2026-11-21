import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,pairsFile,...files]=process.argv.slice(2);
const pairs=JSON.parse(await readFile(pairsFile,'utf8')),engine=await sourceBackend(resolve(environment));
const runs=new Map(),results=[];
for(const f of files)for(const line of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');runs.set(r.trajectory,r);
}
for(const r of pairs.filter(r=>r.pairs.some(p=>p.outcomes.some(o=>!o.equal)))){
  const run=runs.get(r.trajectory);assert.ok(run&&!run.resets&&!run.sourcePrefixActions&&!run.observedPriorLevelActions);
  const rep=sourceReplay(engine,{},run);
  for(const p of r.pairs.filter(p=>p.outcomes.some(e=>!e.equal))){
    const [a,b]=p.prefix;
    const limit=run.cap-Math.max(a,b),observedWinner=run.levels[0].won;
    const dictionary=new Map();
    // Reuse either observed continuation and every independently discriminating first action.
    for(const at of [a,b]){
      const historical=run.steps.slice(at,at+limit).map(op);
      for(const [kind,word] of [['observed',historical],...p.outcomes.filter(e=>!e.equal&&e.input!==historical[0])
        .map(e=>['replaced_first',[e.input,...historical.slice(1)]])]){
        if(!word.length)continue;
        const k=word.join('/');if(!dictionary.has(k))dictionary.set(k,{at,kind,word});
      }
    }
    function roll(prefix,word){
      let n=rep.restore(prefix),used=0;
      for(const input of word){
        if(rep.win(n)||n.state!=='NOT_FINISHED'||!n.availableActionIds.includes(Number(input.split(':')[0].slice(6))))break;
        n=rep.act(input);used++;
      }
      return {used,won:rep.win(n),state:n.state,end:hash(n).slice(0,16)};
    }
    const suffixes=[];
    for(const {at,kind,word} of dictionary.values()){
      const first=roll(a,word),second=roll(b,word);
      const selectsWin=first.won!==second.won;
      if(selectsWin){assert.deepEqual(roll(a,word),first);assert.deepEqual(roll(b,word),second);}
      suffixes.push({at,kind,firstInput:word[0],length:word.length,first,second,selectsWin});
    }
    results.push({code:r.code,level:r.level,trajectory:run.trajectory,originalWon:observedWinner,
      prefix:[a,b],image:p.image,entry:p.entry,suffixes});
  }
}
await writeFile(output,JSON.stringify(results));
console.log('pairs',results.length,'winning differences',results.flatMap(r=>r.suffixes).filter(s=>s.selectsWin).length);
