import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {measureReferencePopulation,referencePopulationCellKey,referencePopulationNeighborhood} from '../src/logos-engine/v6-reference-population-observation.ts';
import {measureTransferredPopulationSelection} from '../src/sic/population-placement.ts';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),out=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line);assert.ok(getGameByCode(r.code)?.group!=='custom_4' && !r.error && !r.resets && !r.observedPriorLevelActions && !r.sourcePrefixActions);
  const rep=sourceReplay(engine,{},r),blocks=[];
  let b=rep.restore(0),sc=measureReferencePopulation(b.frame,null,{allowSurplus:true}),block=null;
  const lookup=(s,p)=>s?.bodies.find(v=>v.cell.join()===p.join());
  for(const [i,c] of r.steps.entries()){
    const prediction=r.replayCommands[i].roleArrangement,descriptor=prediction && JSON.stringify([prediction.stationary,prediction.destination,prediction.expectedMask]);
    const n=rep.act(op(c));assert.equal(hash(n).slice(0,16),c.to);
    if(prediction&&(!block||descriptor!==block.descriptor)){
      block={descriptor,start:i,end:i,word:[],stationary:prediction.stationary,destination:prediction.destination,
        expectedMask:prediction.expectedMask,initialAppearance:lookup(sc,prediction.stationary)?.appearance??null,heldEveryStep:true};blocks.push(block);
    }else if(!prediction)block=null;
    const next=rep.win(n)?null:(c.a===6?measureTransferredPopulationSelection(b.frame,n.frame,[c.data.x,c.data.y])?.scene:null)
      ??(sc?measureReferencePopulation(n.frame,sc):null)??measureReferencePopulation(n.frame,null,{allowSurplus:true});
    if(block){
      const body=lookup(next,block.stationary);block.heldEveryStep&&=!!body;
      block.end=i;block.word.push(op(c));block.endAppearance=body?.appearance??null;
      block.observedMask=next?referencePopulationNeighborhood(block.stationary,new Set(next.bodies.map(b=>referencePopulationCellKey(b.cell)))).local_direction_mask:null;
    }
    sc=next;b=n;
  }
  assert.equal(rep.win(b),r.levels[0].won);
  for(const t of blocks){
    delete t.descriptor;
    function branch(replacement){
      let b=rep.restore(t.start),used=t.start,unchanged=true;
      for(const input of replacement){
        if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(Number(input.split(':')[0].slice(6))))return null;
        const before=hash(b);b=rep.act(input);used++;unchanged&&=hash(b)===before;
      }
      for(const st of r.steps.slice(t.end+1)){
        if(used>=r.cap||rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(st.a))break;
        b=rep.act(op(st));used++;
      }
      return {won:rep.win(b),used,unchanged};
    }
    t.omitted=branch([]);t.substitutions=[];
    const initial=rep.restore(t.start),seen=[...new Set(r.steps.slice(0,t.start).map(op))];
    for(const input of seen){
      if(t.word.includes(input)||!initial.availableActionIds.includes(Number(input.split(':')[0].slice(6))))continue;
      const result=branch(Array(t.word.length).fill(input));if(result)t.substitutions.push({input,...result});
    }
    t.start++;t.end++;
  }
  out.push({code:r.code,level:r.start,actions:r.issued,won:r.levels[0].won,blocks});
}
await writeFile(output,JSON.stringify(out));console.log(out.length,out.reduce((n,r)=>n+r.blocks.length,0));
