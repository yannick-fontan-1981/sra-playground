import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {aligned} from '../src/sic/controlled-parts.ts';
import {cellMatches} from '../src/sic/calibrate-spatial-controls.ts';
import {hash} from './sic-study-source-replay.mjs';
import {openParkedSubjects} from './sic-study-parked-subjects.mjs';

// Compare actual scalar arrivals with destinations nominated by the autonomous
// planner. Each branch starts with the same verified push and parked partner.
const [engine,tape,code,out,capText='540']=process.argv.slice(2);
const cap=Number(capText);
assert.ok(Number.isSafeInteger(cap)&&cap>0);
const {run,start,act,view,at,prefix,verify,live,score,directions,first,second,moving,parked}=await openParkedSubjects(engine,tape,code);
const stride=2*Math.max(...verify.controlContrast.baselineDelta.map(Math.abs)),pitch=[stride,stride];
const push=run.preparation.find(p=>p.result==='destination_moved_with_subject');
assert.ok(push);
const afterPush=run.replayCommands.slice(prefix.length,push.actionIndex);
const pivot=afterPush.at(-1).landmark.role;
const actors=new Set([first,second,moving,parked]);
const near=(p,q)=>!!q&&cellMatches(p,q,pitch);
function describe(body,origin){
  return {at:body.at,width:body.box[2]-body.box[0]+1,height:body.box[3]-body.box[1]+1,
    uniqueCell:near(body.at,aligned(body.at,origin,pitch))};
}
let board=await start();
const forecasts=[],rootCommand=run.replayCommands[push.actionIndex];
const origin=rootCommand.landmark?.home;
assert.ok(origin,'The new assignment must expose a reference grid');
for(const [i,c] of run.replayCommands.slice(prefix.length).entries()){
  assert.equal(hash(board).slice(0,16),c.from);
  const t=c.landmark,trial=t?.access;
  if(trial?.purpose==='test_indication'){
    const layout=await view(board),g=layout[trial.cue]?.find(part=>near(part.at,t.expected));
    assert.ok(g);
    forecasts.push({action:prefix.length+i+1,role:trial.cue,...describe(g,t.home),expected:t.expected});
  }
  board=await act(c);
  assert.equal(hash(board).slice(0,16),c.to);
}
async function restore(word){
  let b=await start();
  for(const c of afterPush)b=await act(c);
  for(const id of word)b=await act({id});
  return b;
}
const root=await restore([]),held=at(await view(root),parked);
assert.equal(hash(root).slice(0,16),afterPush.at(-1).to);
const scalars=root.availableActionIds.filter(id=>!directions.includes(id)&&id!==6);
const queue=[[]],seen=new Set([hash(root)]),arrivals=[];
const counts={unchanged:0,terminal:0,stationary:0,scores:0};
let examined=0;
for(let i=0;i<queue.length&&i<cap;i++){
  const path=queue[i],b=await restore(path),prior=await view(b),actor=at(prior,moving);
  if(!actor||!near(at(prior,parked),held))continue;
  examined++;
  for(const id of [...scalars,...directions]){
    await restore(path);
    const next=await act({id}),scalar=scalars.includes(id);
    if(!live(next)){if(scalar)counts.terminal++;if(score(next))counts.scores++;continue;}
    const key=hash(next);
    if(!seen.has(key)){seen.add(key);queue.push([...path,id]);}
    if(!scalar)continue;
    if(key===hash(b)){counts.unchanged++;continue;}
    const post=await view(next),landed=at(post,moving);
    if(!landed||near(landed,actor)){counts.stationary++;continue;}
    const marks=[];
    for(const [role,parts] of Object.entries(prior)){
      if(actors.has(role)||role===pivot)continue;
      for(const p of parts.filter(p=>near(p.at,landed)))marks.push({role,copies:parts.length,...describe(p,origin)});
    }
    arrivals.push({path,command:id,actor,landed,partnerHeld:near(at(post,parked),held),marks});
  }
}
const summary={cap,examined,states:seen.size,counts,scalarArrivals:arrivals.length,
  arrivalsWithUniqueMarkerCell:arrivals.filter(a=>a.marks.some(m=>m.copies===1&&m.uniqueCell)).length,
  nominated:forecasts.length,ambiguous:forecasts.filter(f=>!f.uniqueCell).length};
await writeFile(out,JSON.stringify({summary,forecasts,arrivals}));console.log(JSON.stringify(summary));
