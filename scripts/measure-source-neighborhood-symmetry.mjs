import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureReferencePopulation, referencePopulationLocalRelations} from '../src/logos-engine/v6-reference-population-observation.ts';
import {measureTransferredPopulationSelection} from '../src/sic/population-placement.ts';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';

const [environment,output,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),out=[];
const degree=mask=>mask.toString(2).replaceAll('0','').length;
const symmetry=mask=>degree(mask)===2 ? (mask===3||mask===12?'opposite':'corner') : degree(mask);
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line);assert.ok(getGameByCode(run.code)?.group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},run);let b=rep.restore(0),prior=null,stationaryChanges=0;
  const bank=new Map(),tests=[],exact=new Map(),observed=new Set();
  function scene(rows){return measureReferencePopulation(rows,prior)??measureReferencePopulation(rows,null,{allowSurplus:true});}
  function record(layout,step){
    if(!layout)return;
    const relations=referencePopulationLocalRelations(layout);
    for(const {local_direction_mask:mask,appearance} of relations){
      if(exact.has(mask))continue;
      for(const [name,model] of [['degree',degree],['symmetry',symmetry]]){
        const candidates=[...exact].filter(([known])=>model(known)===model(mask));
        const colors=new Set(candidates.flatMap(([,v])=>[...v]));
        if(candidates.length>=2&&colors.size===1){
          const expected=[...colors][0];const id=[step,mask,appearance,name].join('/');
          if(!observed.has(id)){observed.add(id);tests.push({step,name,mask,expected,appearance,sources:candidates.map(([known])=>known)});}
        }
      }
    }
    for(const {local_direction_mask:mask,appearance} of relations){
      const v=exact.get(mask)??new Set();v.add(appearance);exact.set(mask,v);
      const cls=degree(mask),set=bank.get(cls)??new Set();set.add(appearance);bank.set(cls,set);
    }
  }
  prior=scene(b.frame);record(prior,0);
  for(const [i,st] of run.steps.entries()){
    const n=rep.act(op(st));assert.equal(hash(n).slice(0,16),st.to);
    if(!rep.win(n)&&n.state==='NOT_FINISHED'){
      const now=st.a===6?measureTransferredPopulationSelection(b.frame,n.frame,[st.data.x,st.data.y])?.scene??scene(n.frame):scene(n.frame);
      if(prior&&now&&st.a>=1&&st.a<=4){
        const a=new Map(prior.bodies.map(v=>[v.cell.join(),v.appearance])),z=new Map(now.bodies.map(v=>[v.cell.join(),v.appearance]));
        if([...a.keys()].filter(k=>!z.has(k)).length===1&&[...z.keys()].filter(k=>!a.has(k)).length===1)
          stationaryChanges+=[...a].filter(([k,color])=>z.has(k)&&z.get(k)!==color).length;
      }
      if(now)record(now,i+1);prior=now;
    }
    b=n;
  }
  out.push({code:run.code,level:run.start,stationaryChanges,tests,
    degrees:Object.fromEntries([...bank].map(([k,v])=>[k,[...v]])),masks:Object.fromEntries([...exact].map(([k,v])=>[k,[...v]]))});
}
await writeFile(output,JSON.stringify(out));console.log('episodes',out.length,'new masks predicted',out.reduce((n,r)=>n+r.tests.length,0));
