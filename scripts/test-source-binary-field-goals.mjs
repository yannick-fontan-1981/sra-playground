import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {geometricComponents} from '../src/logos-engine/v6-native-observer.ts';
import {fieldPitches} from '../src/sic/field-exemplars.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';
import {experiment} from './source-coupled-field-model.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const shape=part=>JSON.stringify(part.mask);
function cluster(parts,origin){
  const cells=parts.map(c=>({box:c.bbox,value:c.color})),pitches=[0,1].map(k=>fieldPitches(cells,k)[0]);
  const locations=new Map(parts.map(c=>[c.bbox.slice(0,2).join(),c])),found=new Set([origin]),queue=[origin];
  for(let i=0;i<queue.length;i++)for(const axis of [0,1]){
    const pitch=pitches[axis];if(!pitch)continue;
    for(const sign of [-1,1]){
      const pos=queue[i].bbox.slice(0,2);pos[axis]+=sign*pitch;
      const next=locations.get(pos.join());
      if(next&&!found.has(next)){found.add(next);queue.push(next);}
    }
  }
  return queue;
}
const results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},run),trials=[],tested=new Set(),witnesses=new Map();
  let board=rep.restore(0),parts=geometricComponents(board.frame);
  for(const [i,step] of run.steps.entries()){
    if(!board.availableActionIds.includes(6)||trials.length>=4)break;
    const next=rep.act(op(step));assert.equal(hash(next).slice(0,16),step.to);
    if(rep.win(next)||next.state!=='NOT_FINISHED')break;
    if(step.from===step.to){board=next;continue;}
    const current=geometricComponents(next.frame);
    if(step.a===6)for(const p of parts){
      const [x,y,r,b]=p.bbox,dx=step.data.x-x,dy=step.data.y-y;
      if(p.area<2||p.area>144||dx<0||dy<0||x+dx>r||y+dy>b||!p.mask.some(([u,v])=>u===dx&&v===dy))continue;
      const q=current.find(c=>p.color!==c.color&&c.bbox.join()===p.bbox.join()&&shape(c)===shape(p));
      if(!q)continue;
      const palette=[p.color,q.color].sort((a,b)=>a-b),role=shape(p),key=JSON.stringify([palette,role]);
      const prior=witnesses.get(key)??new Set();prior.add(p.bbox.join());witnesses.set(key,prior);
      if(prior.size<2)continue;
      const matching=current.filter(c=>palette.includes(c.color)&&shape(c)===role);
      if(matching.length<3||matching.length>64)continue;
      const component=cluster(matching,q);
      for(const field of [component,matching]){
        if(field.length<3||new Set(field.map(c=>c.color)).size!==2)continue;
        const boxes=field.map(c=>c.bbox.join()).sort(),scope=JSON.stringify([key,boxes]);
        if(tested.has(scope)||trials.length>=4)continue;
        tested.add(scope);
        const ordered=[...field].sort((a,b)=>a.bbox[1]-b.bbox[1]||a.bbox[0]-b.bbox[0]);
        for(const value of palette){
          const obligations=ordered.map(c=>({box:c.bbox,mask:c.mask,equal:[value],different:[],
            input:'ACTION6:'+ [c.bbox[0]+dx,c.bbox[1]+dy].join()}));
          const plan={palette,obligations,cues:[],unbound:[]};
          const t=experiment(run,rep,plan,{transferColumns:true,prefix:i+1});
          if(t)trials.push({prefix:i+1,fieldSize:field.length,majority:field.filter(c=>c.color===value).length>=field.length/2,
            won:t.won,actions:t.actions,stop:t.stop,probes:t.forecast.filter(z=>z.kind==='probe').length,
            composed:t.forecast.filter(z=>z.kind!=='probe').length,controls:t.controls});
          rep.restore(i+1);
        }
      }
    }
    board=next;parts=current;
  }
  results.push({code:run.code,level:run.start,baselineWon:run.levels[0].won,trials});
}
await writeFile(output,JSON.stringify(results));
console.log('binary field trials',results.reduce((n,r)=>n+r.trials.length,0));
