import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from './sic-study-source-replay.mjs';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {poseRole} from '../src/sic/occupancy-programs.ts';

// Offline fork of a verified public control test. Preserve the old subject
// throughout the preparation and compare the same scalar operation at each depth.
const [env,tapeFile,out,scalarText,depthText,nodeText]=process.argv.slice(2);
const scalar=Number(scalarText),maxDepth=Number(depthText),maxNodes=Number(nodeText);
assert.ok(Number.isInteger(scalar)&&scalar>4&&scalar!==6&&maxDepth>=0&&maxDepth<=12&&maxNodes>0);
const run=JSON.parse(await readFile(tapeFile,'utf8'));
const step=run.preparation.find(e=>e.result==='protected_advance_blocked_try_another_motor'||e.result==='protected_advance_unconfirmed')?.actionIndex;
assert.ok(step>0&&run.start===run.finish&&run.resets===0);
const parked=run.replayCommands[step-1].observedSubjects[0];
const {createGameDispatcher}=await import(pathToFileURL(resolve(env,'src/runtime/native-game-dispatcher.ts')).href);
const engine=createGameDispatcher(()=>{throw Error('Unexpected backend')});
const act=(id,data)=>engine.dispatch({type:'action',actionId:id,...(data?{data}:{})});
async function restore(word){
  let b=await engine.dispatch({type:'load',code:run.code,level:run.start});
  if(b.level!==run.start)b=await engine.dispatch({type:'selectLevel',level:run.start});
  for(const c of run.replayCommands.slice(0,step))b=await act(c.id,c.data);
  assert.equal(hash(b).slice(0,16),run.replayCommands[step-1].to);
  for(const d of word)b=await act(d);
  return b;
}
const base=await restore([]),seen=new Set([hash(base)]),views=new Map();
assert.ok(run.preparation.some(e=>e.actionIndex<step&&e.result==='new_cursor_moved_while_previous_cursor_stayed'));
const live=b=>b.state==='NOT_FINISHED'&&b.level===base.level&&b.levelsCompleted===base.levelsCompleted;
const preserves=b=>base.frame.slice(parked[1],parked[3]+1).every((row,i)=>row.slice(parked[0],parked[2]+1).every((v,j)=>v===b.frame[parked[1]+i]?.[parked[0]+j]));
async function view(b){
  const h=hash(b);
  if(!views.has(h)){
    const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,level:b.level,levels_completed:b.levelsCompleted,
      available_action_refs:b.availableActionIds.map(a=>'ACTION'+a)},views.size,'public-fork');
    views.set(h,visualLayout(o,b.frame));
  }
  return views.get(h);
}
const gap=(p,q)=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));
async function classify(before,after){
  if(after.levelsCompleted>base.levelsCompleted||after.state==='WIN')return 'score';
  if(!live(after))return 'lost';
  if(hash(before)===hash(after))return 'unchanged';
  const a=await view(before),b=await view(after);
  const moved=Object.keys(a).filter(k=>a[k].length===1&&b[k]?.length===1&&gap(a[k][0].at,b[k][0].at)>2);
  return moved.some(k=>moved.some(j=>k!==j&&gap(a[k][0].at,b[j][0].at)<=1&&gap(a[j][0].at,b[k][0].at)<=1))?'position_exchange':'other_change';
}
async function compareAccess(preparation){
  const start=await restore(preparation),initialView=await view(base);
  const source=run.replayCommands[step-1].observedSubjects[1];
  const obs=await measureNativeObservation({frame_rows:base.frame,frame_hash:hash(base),state:base.state,level:base.level,
    levels_completed:base.levelsCompleted,available_action_refs:base.availableActionIds.map(v=>'ACTION'+v)},1,'public-control');
  const bodies=obs.entities.filter(e=>e.area>=2&&e.bbox[0]>=source[0]&&e.bbox[1]>=source[1]&&e.bbox[2]<=source[2]&&e.bbox[3]<=source[3])
    .sort((a,b)=>b.area-a.area);
  if(!bodies[0]||bodies[0].area===bodies[1]?.area)return {comparable:false};
  const role=poseRole(bodies[0]);
  if(initialView[role]?.length!==1)return {comparable:false};
  const here=(await view(start))[role];
  if(here?.length!==1)return {comparable:false};
  const choices=start.availableActionIds.filter(v=>v>=1&&v<=4).map(id=>({id}));
  if(start.availableActionIds.includes(6))choices.push({id:6,data:{x:Math.floor(here[0].at[0]/2),y:Math.floor(here[0].at[1]/2)}});
  let control;
  for(const c of choices){
    await restore(preparation);const b=await act(c.id,c.data);
    if(live(b)&&hash(b)===hash(start)){control=c;break;}
  }
  if(!control)return {comparable:false};
  async function reach(action){
    const queue=[[]],images=new Set(),sites=new Set();let wins=0;
    for(let i=0;i<queue.length;i++){
      const word=queue[i];await restore(preparation);
      let b=await act(action.id,action.data);
      for(const d of word)b=await act(d);
      if(b.levelsCompleted>base.levelsCompleted||b.state==='WIN'){wins++;continue;}
      if(!live(b)||!preserves(b)||images.has(hash(b)))continue;
      images.add(hash(b));const body=(await view(b))[role];
      if(body?.length!==1)continue;
      sites.add(body[0].at.join(','));
      if(word.length<3)for(const d of b.availableActionIds.filter(v=>v>=1&&v<=4))queue.push([...word,d]);
    }
    return {sites,wins};
  }
  const paired=await reach({id:scalar}),sham=await reach(control);
  const verify=run.replayCommands.slice(0,step).findLast(c=>c.cursorStage==='verify'),oldBox=verify?.observedSubjects?.[1];
  const stride=oldBox?Math.max(Math.abs(source[0]+source[2]-oldBox[0]-oldBox[2]),Math.abs(source[1]+source[3]-oldBox[1]-oldBox[3])):0;
  const positions=s=>[...s].map(k=>k.split(',').map(Number)),controlSites=positions(sham.sites);
  // A facing change can shift a bounding-box center without entering a new
  // cell. Count only centers an entire verified stride away from all controls
  // and from each other. This is a lower bound over these two finite searches.
  const separated=[];
  if(stride>0&&sham.sites.size)for(const p of positions(paired.sites)){
    if(controlSites.every(q=>gap(p,q)>=stride)&&separated.every(q=>gap(p,q)>=stride))separated.push(p);
  }
  return {comparable:true,continuationDepth:3,control:control.id,withOperation:paired.sites.size,withoutOperation:sham.sites.size,
    verifiedStridePixels:stride/2,atLeastOneStrideApart:separated.length,
    newlyReachableCenters:[...paired.sites].filter(site=>!sham.sites.has(site)).length,
    centersOnlyInControl:[...sham.sites].filter(site=>!paired.sites.has(site)).length,scoredWith:paired.wins,scoredWithout:sham.wins};
}
const frontier=[[]],depths=[];let examined=0,firstExchange=null,access=null;
while(examined<frontier.length&&examined<maxNodes){
  const word=frontier[examined++],b=await restore(word);
  if(!b.availableActionIds.includes(scalar))continue;
  const effect=await classify(b,await act(scalar)),layer=depths[word.length]??={};
  layer[effect]=(layer[effect]??0)+1;
  if(effect==='position_exchange'&&firstExchange===null){firstExchange=word.length;access=await compareAccess(word);}
  if(word.length>=maxDepth)continue;
  for(const d of b.availableActionIds.filter(v=>v>=1&&v<=4)){
    await restore(word);const n=await act(d),h=hash(n);
    if(live(n)&&preserves(n)&&!seen.has(h)){seen.add(h);frontier.push([...word,d]);}
  }
}
const report={game:run.code,level:run.start,afterAction:step,scalar,maxDepth,maxNodes,examined,seen:seen.size,exhaustedWithinDepth:examined===frontier.length,firstExchange,depths,access};
await writeFile(out,JSON.stringify(report));console.log(JSON.stringify(report));
