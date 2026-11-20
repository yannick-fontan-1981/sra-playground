import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { localPatch, separation } from '../src/sic/local-response.ts';
import { discriminatesAction } from './local-response-controls.mjs';

const [env,file] = process.argv.slice(2);
const pack=JSON.parse(await readFile(file,'utf8'));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const engine=await sourceBackend(resolve(env));
function replayNative(trace) {
  const lesson=pack.lessons?.[trace.lesson];
  let b=engine.dispatch({type:'load',code:trace.code,level:lesson?lesson.endLevel-1:trace.level});
  if(lesson){
    for(const c of lesson.commands){
      assert.equal(hash(b).slice(0,16),c.from);
      b=engine.dispatch({type:'action',actionId:c.id,...(c.id===6?{data:c.data}:{})});
      assert.equal(hash(b).slice(0,16),c.to);
    }
    assert.equal(b.level,lesson.endLevel);
  }
  assert.equal(hash(b),trace.initial);
  const base=b.levelsCompleted;
  for(const [id,x,y,to] of trace.commands){
    b=engine.dispatch({type:'action',actionId:id,...(id===6?{data:{x,y}}:{})});
    assert.equal(hash(b).slice(0,16),to);
  }
  assert.equal(b.levelsCompleted-base,trace.score);
}
for(const trace of pack.games)replayNative(trace);
for(const witness of pack.predictions) {
  const {code,level,steps,initial,initialCompleted,commitment:p,seal,expected}=witness;
  assert.equal(digest(p),seal);assert.ok(separation(p.site,p.trainedSite)>=3);
  const lesson=pack.lessons?.[witness.lesson];
  const replay=sourceReplay(engine,{}, {code,start:level,steps,initial,initialCompleted,
    ...(lesson?{publicLesson:lesson.commands,lessonEndLevel:lesson.endLevel,observedPriorLevelActions:lesson.commands.length}:{})});
  function branch(keys) {
    let b=replay.restore(steps.length);
    for(const key of keys) {
      if(b.level!==level || b.levelsCompleted!==initialCompleted || b.state!=='NOT_FINISHED')return null;
      b=replay.act(key);
    }
    return b.level===level && b.levelsCompleted===initialCompleted && b.state==='NOT_FINISHED'?b:null;
  }
  const base=branch([]),va=branch([p.a]),vb=branch([p.b]),vab=branch([p.a,p.b]);
  const aOK=localPatch(base,p.site)===p.firstBefore && localPatch(va,p.site)===p.firstAfter;
  const enabled=aOK && !!vb && localPatch(vb,p.siteB)!==p.afterB &&
    localPatch(va,p.siteB)===p.beforeB && localPatch(vab,p.siteB)===p.afterB;
  let use=false;
  if(enabled && p.siteC && localPatch(vab,p.siteC)===p.beforeC){
    const ac=branch([p.a,p.c]),bc=branch([p.b,p.c]),abc=branch([p.a,p.b,p.c]);
    use=!!ac&&!!bc&&localPatch(ac,p.siteC)!==p.afterC && localPatch(bc,p.siteC)!==p.afterC && localPatch(abc,p.siteC)===p.afterC;
  }
  const selective=enabled&&discriminatesAction(base,steps,p,branch,false).selective;
  const selectiveUse=use&&discriminatesAction(base,steps,p,branch,true).selective;
  assert.deepEqual({aOK,enabled,use,selective,selectiveUse},expected);
}
console.log(JSON.stringify({games:pack.games.length,pairedPredictions:pack.predictions.length}));
