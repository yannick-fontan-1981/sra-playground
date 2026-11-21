import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {openParkedSubjects} from './sic-study-parked-subjects.mjs';
import {hash} from './sic-study-source-replay.mjs';

// Offline interventions from a recorded refusal. The solver never reads this tape.
const [engine,tape,code,out]=process.argv.slice(2);
const {run,prefix,verify,start,act,view,at,live,score,directions,first,second,parked,moving}=await openParkedSubjects(engine,tape,code);
const stride=2*Math.max(...verify.controlContrast.baselineDelta.map(Math.abs));
assert.ok(stride>0);
const near=(a,b)=>a&&b&&a.every((v,i)=>Math.abs(v-b[i])<stride/2);
const click=p=>({id:6,data:{x:Math.round(p[0]/2),y:Math.round(p[1]/2)}});
const preparations=[[],...directions.flatMap(a=>[[a],...directions.map(b=>[a,b])])];

async function restore(index){
  let board=await start();
  for(const command of run.replayCommands.slice(prefix.length,index)){
    assert.equal(hash(board).slice(0,16),command.from);
    board=await act(command);
    assert.equal(hash(board).slice(0,16),command.to);
  }
  return board;
}
function footprint(frame,p){
  const [cx,cy]=p.map(v=>Math.round(v/2)),r=Math.max(1,Math.floor(stride/4)),values=[];
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)values.push(frame[y]?.[x]??-1);
  return values.join();
}
const cases=[],tested=new Set();
for(const receipt of run.preparation.filter(p=>p.result==='approach_refuted_replan')){
  const index=receipt.actionIndex-1,command=run.replayCommands[index],trial=command.landmark;
  const key=command.from+'/'+command.id;
  if(!trial?.verifiedReturnSource||tested.has(key))continue;
  tested.add(key);
  const board=await restore(index),layout=await view(board),actor=at(layout,moving),partner=at(layout,parked);
  if(!actor||!near(partner,trial.guard))continue;
  const refused=await act(command);
  if(!live(refused)||!near(at(await view(refused),moving),actor))continue;
  const trials=[];
  for(const word of preparations){
    await restore(index);
    let b=await act(click(partner));
    if(!live(b))continue;
    let l=await view(b);
    if(!near(at(l,first),partner)||!near(at(l,second),actor))continue;
    for(const id of word){
      b=await act({id});
      if(!live(b))break;
    }
    if(!live(b))continue;
    l=await view(b);
    const placement=at(l,first);
    if(!placement||!near(at(l,second),actor))continue;
    b=await act(click(actor));
    if(!live(b))continue;
    l=await view(b);
    if(!near(at(l,moving),actor)||!near(at(l,parked),placement))continue;
    const changed=footprint(board.frame,trial.expected)!==footprint(b.frame,trial.expected);
    b=await act(command);
    const arrive=!!(live(b)&&near(at(await view(b),moving),trial.expected));
    trials.push({prep:word,at:placement,changed,arrive,score:score(b),alive:live(b)});
  }
  cases.push({i:index+1,input:command.id,prediction:trial.expected,origin:actor,trials});
}
await writeFile(out,JSON.stringify(cases));
const rows=cases.flatMap(c=>c.trials);
console.log(JSON.stringify({cases:cases.length,branches:rows.length,
  successful:cases.filter(c=>c.trials.some(t=>t.arrive)).map(c=>c.i),
  releasedWhenChanged:rows.filter(r=>r.changed&&r.arrive).length,changed:rows.filter(r=>r.changed).length,
  releasedWhenUnchanged:rows.filter(r=>!r.changed&&r.arrive).length,
  controlReleased:rows.filter(t=>t.prep.length===0&&t.arrive).length}));
