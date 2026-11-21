import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from './sic-study-source-replay.mjs';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';

// Native counterfactuals after a handoff chosen by SIC. Each branch restores
// the same autonomous prefix. This executable is independent of the pilot.
const [env,file,out,capText]=process.argv.slice(2),cap=Number(capText);
assert.ok(Number.isSafeInteger(cap)&&cap>0);
const run=JSON.parse(await readFile(file,'utf8'));
const click=run.replayCommands.findIndex(c=>c.landmark?.stage==='select_after_contact');
assert.ok(click>=0 && run.start===run.finish && !run.resets && !run.observedPriorLevelActions);
const handoff=run.replayCommands[click],{guard,home,other}=handoff.landmark;
const pitch=2*Math.max(...handoff.controlContrast.baselineDelta.map(Math.abs));
assert.ok(pitch>0);
const near=(p,q)=>p&&q&&Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]))<pitch/2;
const gap=(p,q)=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));
const {createGameDispatcher}=await import(pathToFileURL(resolve(env,'src/runtime/native-game-dispatcher.ts')));
const engine=createGameDispatcher(()=>{throw Error('Unexpected legacy engine');});
const act=c=>engine.dispatch({type:'action',actionId:c.id,...(c.data?{data:c.data}:{})});
async function restore(path){
  let b=await engine.dispatch({type:'load',code:run.code,level:run.start});
  if(b.level!==run.start)b=await engine.dispatch({type:'selectLevel',level:run.start});
  for(const c of run.replayCommands.slice(0,click+1))b=await act(c);
  assert.equal(hash(b).slice(0,16),handoff.to);
  for(const id of path)b=await act({id});
  return b;
}
const views=new Map();
async function view(b){
  const h=hash(b);
  if(!views.has(h)){
    const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,level:b.level,
      levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(id=>'ACTION'+id)},views.size,'access-fork');
    views.set(h,visualLayout(o,b.frame));
  }
  return views.get(h);
}
const base=await restore([]),root=await view(base);
const solo=(l,k)=>l[k]?.length===1?l[k][0].at:null;
function roleAt(site){
  const candidates=Object.keys(root).filter(k=>near(solo(root,k),site));
  assert.equal(candidates.length,1,'Ambiguous subject at handoff');
  return candidates[0];
}
const actor=roleAt(guard),parked=roleAt(home),directions=base.availableActionIds.filter(id=>id>=1&&id<=4);
const operations=base.availableActionIds.filter(id=>id>4&&id!==6);
const won=b=>b.levelsCompleted>base.levelsCompleted||b.state==='WIN';
const live=b=>b.state==='NOT_FINISHED'&&b.level===run.start&&!won(b);
const seen=new Set([hash(base)]),sites=new Map(),probes=[],seeds=[];
async function closeUnderMovement(queue,recordOperations){
  let examined=0,official=0,best=Infinity;
  const localSites=new Map();
  while(examined<queue.length&&examined<cap){
    const path=queue[examined++],b=await restore(path),l=await view(b),at=solo(l,actor);
    if(!at||!near(solo(l,parked),home))continue;
    localSites.set(at.join(),at);
    best=Math.min(best,gap(at,other));
    if(recordOperations)for(const id of operations){
      await restore(path);
      const n=await act({id});let effect='unchanged',partner;
      if(won(n))effect='official';
      else if(!live(n))effect='lost';
      else if(hash(n)!==hash(b)){
        effect='other_change';
        const after=await view(n),arrival=solo(after,actor);
        if(arrival&&!near(arrival,at)&&near(solo(after,parked),home)){
          effect='relocation';seeds.push({h:hash(n),path:[...path,id]});
          const peers=Object.keys(l).filter(k=>k!==actor&&near(solo(l,k),arrival)&&near(solo(after,k),at));
          if(peers.length===1)partner=peers[0];
        }
      }
      probes.push({l,depth:path.length,id,effect,partner});
    }
    for(const id of directions){
      await restore(path);const n=await act({id});
      if(won(n)){official++;continue;}
      if(!live(n))continue;
      const h=hash(n);
      if(!seen.has(h)){seen.add(h);queue.push([...path,id]);}
    }
  }
  if(recordOperations)for(const [key,at] of localSites)sites.set(key,at);
  return {examined,queued:queue.length,exhausted:examined===queue.length,official,best,sites:localSites.size,
    newPixelCenters:recordOperations?null:[...localSites.keys()].filter(k=>!sites.has(k)).length};
}
const directionsOnly=await closeUnderMovement([[]],true);
const continuations=[];
for(const seed of seeds)if(!seen.has(seed.h)){seen.add(seed.h);continuations.push(seed.path);}
const afterRelocation=await closeUnderMovement(continuations,false);
const effects={},evidence=[];
for(const p of probes)effects[p.effect]=1+(effects[p.effect]??0);
for(const id of operations){
  const rows=probes.filter(p=>p.id===id),hits=rows.filter(p=>p.effect==='relocation');
  const identified=new Set(hits.map(p=>p.partner));
  if(!hits.length||identified.size!==1||!hits[0].partner)continue;
  const peer=hits[0].partner,groups={};
  for(const p of rows){
    const at=solo(p.l,peer);
    const condition=!at?'absent':[...sites.values()].some(site=>near(site,at))?'on_reachable_site':'outside_measured_sites';
    const group=groups[condition]??={};
    group[p.effect]=1+(group[p.effect]??0);
  }
  evidence.push({operation:id,firstRelocationDepth:Math.min(...hits.map(p=>p.depth)),groups});
}
const report={game:run.code,level:run.start,fromAction:click+1,pitchPixels:pitch/2,directionsOnly,afterRelocation,effects,evidence};
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
