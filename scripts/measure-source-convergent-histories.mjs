import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

// Compare future observations after different routes have converged to an identical public image.
const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.resets||run.observedPriorLevelActions||run.sourcePrefixActions||run.start!==run.finish)continue;
  const rep=sourceReplay(engine,{},run),visits=new Map(),tested=new Set(),pairs=[];
  for(const [i,step] of run.steps.entries()){
    const previous=i?run.steps[i-1]:null;
    const here={prefix:i,input:previous?op(previous):null,incoming:previous?.from};
    const options=visits.get(step.from)??[];
    const other=options.find(entry=>entry.incoming!==here.incoming&&entry.input!==here.input&&entry.input);
    if(here.input&&other&&pairs.length<4&&!tested.has(step.from)){
      const a=rep.restore(other.prefix),b=rep.restore(i);
      assert.equal(hash(a),hash(b));
      const controls=[...new Set([op(step),op(run.steps[other.prefix]),...b.availableActionIds.filter(n=>n!==6).map(n=>'ACTION'+n)])]
        .filter(input=>a.availableActionIds.includes(Number(input.split(':')[0].slice(6)))&&b.availableActionIds.includes(Number(input.split(':')[0].slice(6))));
      function future(prefix,input){
        rep.restore(prefix);const n=rep.act(input);
        return [hash(n).slice(0,20),n.state,n.level,n.levelsCompleted,n.availableActionIds.join(',')];
      }
      const outcomes=controls.map(input=>{
        const first=future(other.prefix,input),second=future(i,input);
        const equal=JSON.stringify(first)===JSON.stringify(second);
        if(!equal){assert.deepEqual(future(other.prefix,input),first);assert.deepEqual(future(i,input),second);}
        return {input,equal,...(!equal?{first,second}:{})};
      });
      pairs.push({prefix:[other.prefix,i],entry:[other.input,here.input],image:step.from,outcomes});tested.add(step.from);
    }
    options.push(here);visits.set(step.from,options);
  }
  results.push({code:run.code,level:run.start,trajectory:run.trajectory,pairs});
}
await writeFile(output,JSON.stringify(results));
const pairs=results.flatMap(r=>r.pairs),effects=pairs.flatMap(p=>p.outcomes);
console.log(JSON.stringify({episodes:results.length,pairs:pairs.length,controls:effects.length,different:effects.filter(e=>!e.equal).length}));
