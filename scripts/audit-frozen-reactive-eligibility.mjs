import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {hash} from './sic-study-source-replay.mjs';

const [frozen,environment,output,...files]=process.argv.slice(2);
const load=(root,path)=>import(pathToFileURL(resolve(root,path)).href);
const {createGameDispatcher}=await load(environment,'src/runtime/native-game-dispatcher.ts');
const {observePursuit,choosePursuit}=await load(frozen,'src/sic/pursuit-composition.ts');
const {visualLayout,newPreviewLearning}=await load(frozen,'src/sic/witnessed-preview-transfer.ts');
const {rememberMotion}=await load(frozen,'src/sic/controlled-parts.ts');
const {measureNativeObservation,publicFrameHash}=await load(frozen,'src/logos-engine/v6-native-observer.ts');
const same=(p,q)=>p.join()===q.join(),results=[];
async function observe(b,i){return measureNativeObservation({frame_rows:b.frame,level:b.level,levels_completed:b.levelsCompleted,
  state:b.state,available_action_refs:b.availableActionIds.map(a=>'ACTION'+a),frame_hash:await publicFrameHash(b.frame)},i,'evaluation-replay');}
for(const f of files)for(const line of (await readFile(f,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line);assert.ok(r.code!=='SS09'&&!r.resets&&!r.observedPriorLevelActions&&!r.error);
  const engine=createGameDispatcher(()=>{throw Error('Unexpected legacy engine');});
  let b=await engine.dispatch({type:'load',code:r.code,level:r.start});if(b.level!==r.start&&b.canSelectLevel)b=await engine.dispatch({type:'selectLevel',level:r.start});
  assert.equal(hash(b),r.initial);let o=await observe(b,0),multipleAt=null,firstOffer=null;
  const memory={pairs:{}},learn=newPreviewLearning(),tries={};
  for(const [i,c] of r.replayCommands.entries()){
    assert.equal(hash(b).slice(0,16),c.from);
    const old=visualLayout(o,b.frame);
    if(multipleAt!==null&&firstOffer===null){
      const plan=choosePursuit(memory,learn,old,b.frame,new Set(o.available_action_refs),tries);
      if(plan)firstOffer={step:i+1,basis:plan.basis,horizon:plan.horizon};
    }
    const n=await engine.dispatch({type:'action',actionId:c.id,...(c.id===6?{data:c.data}:{})});
    assert.equal(hash(n).slice(0,16),c.to);
    const a=await observe(n,i+1),next=visualLayout(a,n.frame),cmd='ACTION'+c.id;
    if(c.id>=1&&c.id<=4&&n.levelsCompleted===b.levelsCompleted&&n.state===b.state&&n.level===b.level){
      observePursuit(memory,old,next,cmd,a.observation_ref);
      for(const [role,parts] of Object.entries(old)){
        const returned=next[role];if(parts.length===1&&returned?.length===1&&!same(parts[0].at,returned[0].at))
          rememberMotion(learn,role,parts[0].at,returned[0].at,cmd,o,a);
      }
      if(multipleAt===null&&Object.values(memory.pairs).some(v=>v.away>=3&&v.responses.length>=2&&(next[v.peer]?.length??0)>1))multipleAt=i+1;
    }
    const t=c.reactiveContact;if(t){const k=[t.actor,t.peer,t.from,t.target,t.input].join('/');tries[k]=(tries[k]??0)+1;}
    b=n;o=a;
  }
  const pairs=Object.values(memory.pairs);
  results.push({code:r.code,level:r.start,actions:r.issued,pairs:pairs.length,retreating:pairs.filter(v=>v.away>=3&&v.away>=v.toward*4&&v.responses.length>=2).length,
    multipleAt,firstOffer,played:r.replayCommands.filter(c=>c.reactiveContact).length});
}
await writeFile(output,JSON.stringify(results));console.log('audited',results.length,'offers',results.filter(r=>r.firstOffer).length);
