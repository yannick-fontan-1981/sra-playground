import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {previewLaw} from '../src/sic/reachable-preview-configurations.ts';
import {openParkedSubjects} from './sic-study-parked-subjects.mjs';
import {hash} from './sic-study-source-replay.mjs';

// Diagnostic only. Fit the spatial law to witnessed scalar arrivals, then
// search each participant's preparations separately in the public game.
const [engine,tape,code,observationFile,out,limitText='1000']=process.argv.slice(2);
const limit=Number(limitText);assert.ok(Number.isSafeInteger(limit)&&limit>0);
const {run,start,act,view,at,prefix,verify,live,score,directions,first,second,moving,parked}=await openParkedSubjects(engine,tape,code);
const measured=JSON.parse(await readFile(observationFile,'utf8'));
const arrivals=measured.arrivals.filter(a=>a.partnerHeld);
assert.ok(arrivals.length>=2);
const push=run.preparation.find(r=>r.result==='destination_moved_with_subject').actionIndex;
const preamble=run.replayCommands.slice(prefix.length,push),assignment=run.replayCommands[push].landmark;
const stride=2*Math.max(...verify.controlContrast.baselineDelta.map(Math.abs));
const grid=p=>p.map((v,i)=>Math.round((v-assignment.home[i])/stride));
const distance=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0);
const same=(a,b)=>!!a&&!!b&&distance(a,b)===0;
const target=[grid(assignment.home),grid(assignment.other)],scalar=arrivals[0].command;
const commonRoles=arrivals[0].marks.filter(m=>m.uniqueCell&&m.copies===1).map(m=>m.role)
  .filter(role=>arrivals.every(a=>a.marks.some(m=>m.role===role&&m.uniqueCell)));
assert.equal(commonRoles.length,1,'The calibration must identify an unambiguous visible mark');
const [cue]=commonRoles,pivot=assignment.displacedDestination.role;
const click=p=>({id:6,data:{x:Math.round(p[0]/2),y:Math.round(p[1]/2)}});
const steps=word=>word.map(id=>({id}));
async function restore(suffix=[]){
  let b=await start();for(const c of preamble)b=await act(c);
  assert.equal(hash(b).slice(0,16),preamble.at(-1).to);
  for(const c of suffix){if(!live(b))break;b=await act(c);}
  return b;
}
function state(l,side){
  const roles=side===0?[moving,parked]:[second,first],points=roles.map(k=>at(l,k));
  if(!points.every(Boolean)||l[pivot]?.length!==2)return;
  const actors=points.map(grid),pivots=l[pivot].map(p=>grid(p.at));
  const direct=distance(actors[0],pivots[0])+distance(actors[1],pivots[1]);
  const reverse=distance(actors[0],pivots[1])+distance(actors[1],pivots[0]);
  if(direct===reverse)return;
  if(reverse<direct)pivots.reverse();
  return {actors,pivots,marks:(l[cue]??[]).map(p=>grid(p.at)).sort()};
}
const examples=[];
for(const [i,a] of arrivals.entries()){
  const b=await restore(steps(a.path)),p=state(await view(b),0);
  assert.ok(p&&same(p.actors[0],grid(a.actor)));
  const result=await act({id:a.command});assert.ok(live(result));
  const after=state(await view(result),0);assert.ok(after&&same(after.actors[0],grid(a.landed)));
  examples.push({actor:grid(a.actor),centre:p.pivots[0],indicator:grid(a.landed),ref:i});
}
const law=previewLaw(examples,true),root=await restore(),rootLayout=await view(root),initial=state(rootLayout,0);
const approaches=[],searches=[];
for(const side of [0,1]){
  const enter=side===0?[]:[click(at(rootLayout,parked))],queue=[[]],seen=new Set(),solutions=[];
  const key=p=>JSON.stringify([p.actors[side],p.pivots[side],p.marks]);
  for(let i=0;i<queue.length&&seen.size<limit;i++){
    const path=queue[i],prefixArm=[...enter,...steps(path)],b=await restore(prefixArm);
    if(!live(b))continue;
    const s=state(await view(b),side);
    if(!s||!same(s.actors[1-side],initial.actors[1-side])||seen.has(key(s)))continue;
    seen.add(key(s));
    const forecast=law(s.actors[side],s.pivots[side]);
    if(forecast.length===1&&same(forecast[0].at,target[side]))solutions.push(path);
    for(const id of directions){
      await restore(prefixArm);const next=await act({id});if(!live(next))continue;
      const p=state(await view(next),side);
      if(p&&!seen.has(key(p))&&same(p.actors[1-side],initial.actors[1-side]))queue.push([...path,id]);
    }
  }
  approaches.push(solutions);searches.push({states:seen.size,solutions:solutions.length});
}
const trials=[],wins=[];
async function apply(order,words){
  let b=await restore(),active=0;
  const program=[...prefix,...preamble].map(({id,data})=>data?{id,data}:{id});
  for(const side of order){
    if(!live(b))break;
    if(active!==side){
      const l=await view(b),atPeer=at(l,active===0?parked:second);
      if(!atPeer)return;
      const c=click(atPeer);program.push(c);b=await act(c);active=side;
      if(!live(b)||!state(await view(b),active))return;
    }
    for(const id of words[side]){if(!live(b))break;program.push({id});b=await act({id});}
  }
  const prior=hash(b).slice(0,16),s=live(b)&&state(await view(b),active),before=b.levelsCompleted;
  if(live(b)){program.push({id:scalar});b=await act({id:scalar});}
  const record={order,words,prior,state:s??null,after:b.state,completed:b.levelsCompleted,won:score(b),length:program.length};
  trials.push(record);
  if(record.won){
    assert.ok(b.levelsCompleted>before||b.state==='WIN');
    let replay=await start();for(const c of program.slice(prefix.length))replay=await act(c);
    assert.ok(score(replay));assert.equal(hash(replay),hash(b));wins.push({program,prior,final:hash(b)});
  }
}
for(const b of approaches[0])for(const a of approaches[1]){
  for(const order of [[],[0],[1],[0,1],[1,0]])await apply(order,[b,a]);
}
const summary={searches,comparisons:trials.length,scores:wins.length,winningOrders:trials.filter(t=>t.won).map(t=>t.order),
  winningLengths:wins.map(w=>w.program.length),solitaryWins:trials.filter(t=>t.order.length<2&&t.won).length};
await writeFile(out,JSON.stringify({summary,examples,trials,wins}));console.log(JSON.stringify(summary));
