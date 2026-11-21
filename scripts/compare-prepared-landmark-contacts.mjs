import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from './sic-study-source-replay.mjs';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';

// Offline only. Hold the click and every subsequent command fixed while
// replacing all movements leading up to the click. Never supply a prefix to SIC.
const [engineRoot,code,levelText,tapeFile,out]=process.argv.slice(2),level=Number(levelText);
const {createGameDispatcher}=await import(pathToFileURL(resolve(engineRoot,'src/runtime/native-game-dispatcher.ts')));
const raw=JSON.parse(await readFile(tapeFile,'utf8')),tape=raw.win??raw.replayCommands;
const click=tape.findIndex(c=>c.id===6);
assert.ok(click>0 && click<=4 && tape.slice(0,click).every(c=>c.id>=1&&c.id<=4));
const engine=createGameDispatcher(()=>{throw Error('Unexpected legacy environment');});
const act=c=>engine.dispatch({type:'action',actionId:c.id,...(c.data?{data:c.data}:{})});
async function reset(){
  const b=await engine.dispatch({type:'load',code,level});
  return b.level===level?b:engine.dispatch({type:'selectLevel',level});
}
const root=await reset(),directions=root.availableActionIds.filter(id=>id>=1&&id<=4);
const live=b=>b.state==='NOT_FINISHED'&&b.level===level&&b.levelsCompleted===root.levelsCompleted;
const wins=b=>b.state==='WIN'||b.levelsCompleted>root.levelsCompleted;
const views=new Map();
async function view(b){
  const h=hash(b);
  if(!views.has(h)){
    const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,level:b.level,
      levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(id=>'ACTION'+id)},views.size,'laboratory');
    views.set(h,visualLayout(o,b.frame));
  }
  return views.get(h);
}
const initial=await view(root),pairRoles=Object.keys(initial).filter(k=>initial[k].length===2);
let arms=[[]];
for(let i=0;i<click;i++)arms=arms.flatMap(prefix=>directions.map(id=>[...prefix,id]));
const branches=[];
for(const word of arms){
  let b=await reset();
  for(const id of word){if(!live(b))break;b=await act({id});}
  if(!live(b)){branches.push({word,won:wins(b)});continue;}
  const before=await view(b),pre=hash(b);
  b=await act(tape[click]);
  const visibleClick=pre!==hash(b),after=live(b)?await view(b):{};
  // A click may redraw both bodies in place. Use the body away from the click
  // with a unique shape that disappears in the click. Report simple overlap separately.
  const {x,y}=tape[click].data;
  const remote=Object.entries(before).filter(([k,g])=>g.length===1&&!after[k]&&
    (x<g[0].box[0]||x>g[0].box[2]||y<g[0].box[1]||y>g[0].box[3])).flatMap(([,g])=>g);
  const occluded=pairRoles.filter(k=>before[k]?.length===1 && initial[k].some(p=>
    !before[k].some(q=>q.at.join()===p.at.join()) && remote.some(body=>
      2*body.box[0]<=p.at[0] && p.at[0]<=2*body.box[2] && 2*body.box[1]<=p.at[1] && p.at[1]<=2*body.box[3])));
  for(const c of tape.slice(click+1)){if(!live(b))break;b=await act(c);}
  branches.push({word,before,visibleClick,occluded,won:wins(b)});
}
const stable=pairRoles.filter(k=>branches.every(r=>!r.before||(r.before[k]??[]).every(p=>initial[k].some(q=>q.at.join()===p.at.join()))));
const groups=new Map();
for(const r of branches){
  const covered=r.occluded?.some(k=>stable.includes(k))??false;
  const key=[covered,r.visibleClick??false,r.won].join();
  groups.set(key,{remoteBodyCoversLandmark:covered,visibleClick:r.visibleClick??false,official:r.won,count:1+(groups.get(key)?.count??0)});
}
const original=branches.find(r=>r.word.every((v,i)=>v===tape[i].id));
assert.equal(original.won,true,'The benchmark suffix must score from its original preparation');
const report={code,level,prefixLength:click,commands:tape.length,alternativePrefixes:branches.length,stablePairs:stable.length,groups:[...groups.values()]};
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
