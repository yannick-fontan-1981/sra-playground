import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {aligned} from '../src/sic/controlled-parts.ts';
import {cellMatches} from '../src/sic/calibrate-spatial-controls.ts';
import {openParkedSubjects} from './sic-study-parked-subjects.mjs';
import {hash} from './sic-study-source-replay.mjs';

// The public tape supplies the verified push. A separate measurement supplies
// arrivals that were actually played with the partner parked. Choose the
// one nearest the proposed target, then vary only what the partner does.
const [engine,tape,code,observed,out,armsText='32',depthText='2',offsetText='0']=process.argv.slice(2);
const maxArms=Number(armsText),depth=Number(depthText),offset=Number(offsetText);
assert.ok(Number.isSafeInteger(maxArms)&&maxArms>0&&Number.isInteger(depth)&&depth>=1&&depth<=3);
const {run,start,act,view,at,prefix,verify,live,score,ops,directions,first,second,moving,parked}=await openParkedSubjects(engine,tape,code);
const push=run.preparation.find(t=>t.result==='destination_moved_with_subject');
assert.ok(push);
const tapePrefix=run.replayCommands.slice(prefix.length,push.actionIndex),assignment=run.replayCommands[push.actionIndex].landmark;
const stride=2*Math.max(...verify.controlContrast.baselineDelta.map(Math.abs)),pitch=[stride,stride],goal=assignment.home;
const cell=p=>aligned(p,goal,pitch),near=(p,q)=>!!q&&cellMatches(p,q,pitch);
const gap=(p,q)=>cell(p).reduce((s,v,i)=>s+Math.abs(v-cell(q)[i]),0)/stride;
const click=p=>({id:6,data:{x:Math.round(p[0]/2),y:Math.round(p[1]/2)}});
const read=JSON.parse(await readFile(observed,'utf8'));
const arrivals=read.arrivals.filter(e=>e.partnerHeld).sort((a,b)=>gap(a.landed,goal)-gap(b.landed,goal)||a.path.length-b.path.length);
const entry=arrivals[offset];assert.ok(entry);
const route=[...tapePrefix,...[...entry.path,entry.command].map(id=>({id}))];
async function replay(suffix=[]){
  let b=await start();
  for(const c of route)b=await act(c);
  for(const c of suffix){if(!live(b))break;b=await act(c);}
  return b;
}
const site=await replay(),initial=await view(site),subjectAt=at(initial,moving),partnerAt=at(initial,parked);
assert.ok(near(subjectAt,entry.landed)&&partnerAt);
const pivot=assignment.displacedDestination.role;
function pose(l,active){
  const a=at(l,active==='partner'?first:parked),b=at(l,active==='partner'?second:moving);
  const p=l[pivot];
  if(!a||!b||p?.length!==2)return;
  const normal=gap(a,p[0].at)+gap(b,p[1].at),reverse=gap(a,p[1].at)+gap(b,p[0].at);
  if(normal===reverse)return;
  return {partner:cell(a),subject:cell(b),partnerPivot:cell(p[Number(reverse<normal)].at),subjectPivot:cell(p[Number(normal<reverse)].at)};
}
const selected=click(partnerAt),back=click(subjectAt),restored=await replay([selected]),held=pose(await view(restored),'partner');
assert.ok(held&&near(held.subject,subjectAt));
const scan=[{word:[],state:held}],configs=new Set([JSON.stringify(held)]),shifted=[],victories=[];
for(let i=0;i<scan.length&&scan.length<maxArms;i++){
  const a=scan[i];
  for(const id of ops){
    const word=[...a.word,id],suffix=[selected,...word.map(id=>({id}))];
    const b=await replay(suffix);
    if(score(b))victories.push({phase:'partner',word});
    if(!live(b))continue;
    const state=pose(await view(b),'partner');if(!state)continue;
    if(!near(state.subject,subjectAt)){shifted.push({word,state});continue;}
    const key=JSON.stringify(state);if(configs.has(key))continue;
    configs.add(key);scan.push({word,state});
    if(scan.length>=maxArms)break;
  }
}
let words=[[]];
const probes=[];
for(let i=0;i<depth;i++){words=words.flatMap(w=>ops.map(id=>[...w,id]));probes.push(...words);}
const arms=[];
for(const [index,arm] of [{word:null},...scan].entries()){
  const prep=arm.word===null?[]:[selected,...arm.word.map(id=>({id})),back];
  const b=await replay(prep);if(!live(b))continue;
  const state=pose(await view(b),'subject');if(!state||!near(state.subject,subjectAt))continue;
  const results=[];
  for(const word of probes){
    let next=await replay(prep),played=0;
    for(const id of word){if(!live(next))break;next=await act({id});played++;}
    if(score(next))victories.push({phase:'subject',preparation:arm.word,word:word.slice(0,played)});
    const end=live(next)&&pose(await view(next),'subject');
    results.push({word,played,won:score(next),official:next.state,
      ...(end?{subject:end.subject,partnerHeld:near(end.partner,state.partner),pivot:end.subjectPivot,gap:gap(end.subject,goal)}:{})});
  }
  arms.push({word:arm.word,state,results});
  if(index%12===0)await writeFile(out+'.progress',JSON.stringify({tested:arms.length,eligible:scan.length,successes:victories.length}));
}
const control=arms.find(a=>a.word===null),placebo=arms.find(a=>a.word?.length===0);
assert.ok(control&&placebo);
const comparable=(r,other)=>r.partnerHeld&&other.partnerHeld&&r.played===other.played;
const improvements=[],opened=[],changedOfficial=[];
for(const arm of arms.filter(a=>a.word?.length))for(const [i,r] of arm.results.entries()){
  const base=placebo.results[i];
  if(comparable(r,base)&&r.gap<base.gap)improvements.push({prep:arm.word,word:r.word,before:base.gap,after:r.gap});
  if(comparable(r,base)&&near(base.subject,subjectAt)&&!near(r.subject,subjectAt))opened.push({prep:arm.word,word:r.word});
  if(r.official!==base.official)changedOfficial.push({prep:arm.word,word:r.word,before:base.official,after:r.official});
}
const summary={origin:hash(site),startGap:gap(subjectAt,goal),arms:arms.length,words:probes.length,
  partnerSites:new Set(arms.map(a=>a.state.partner.join())).size,pivotSites:new Set(arms.map(a=>a.state.partnerPivot.join())).size,
  partnerShiftedSubject:shifted.length,opened:opened.length,closer:improvements.length,changedOfficial:changedOfficial.length,
  closest:Math.min(...arms.flatMap(a=>a.results.filter(r=>r.partnerHeld).map(r=>r.gap))),wins:victories.length};
await writeFile(out,JSON.stringify({summary,entry,arms,improvements,opened,changedOfficial,shifted,victories}));
console.log(JSON.stringify(summary));
