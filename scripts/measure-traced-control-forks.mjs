import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {initialMemory,recordExperiment,sceneKey} from '../src/sic/preparation-experiments.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {openControlForks,controlStudy,learnControl,forkKey,predictControl,checkControl} from '../src/sic/matched-control-experiment.ts';
import {groupsOf,resolveRole} from '../src/sic/exchange-roles.ts';
const [env,dir,g,shard,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),[ix,n]=shard.split('/').map(Number);
const files=g==='lower'?Array.from({length:8},(_,i)=>'source-final-'+i):['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s);
const allow=new Set(GAME_CATALOG.map(x=>x.code)),runs=[],results=[],fixed=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
for(const f of files)for(const l of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n'))runs.push(JSON.parse(l));
const observe=(b,i)=>measureNativeObservation({frame_rows:b.frame,frame_hash:hash(b),level:b.level,levels_completed:b.levelsCompleted,state:b.state,available_action_refs:b.availableActionIds.map(x=>'ACTION'+x)},i+1);
const at=(g,r)=>resolveRole(g,r)?.position??null;
for(const [k,r] of runs.entries()){
 if(k%n!==ix)continue;if(!allow.has(r.code))throw Error('Source only');
 const rep=sourceReplay(engine,fixed,r),m=initialMemory(r.start),study=controlStudy(),sealed=[],seen=new Set(),counts={},examples=[];
 const inc=k=>counts[k]=(counts[k]??0)+1;let b=rep.restore(0),o=await observe(b,0);
 for(const [i,c] of r.steps.entries()){
  if(!hash(b).startsWith(c.from))throw Error('Divergent source prefix');
  const key=op(c),scene=m.scenes.indexOf(sceneKey(o)),available=new Set(b.availableActionIds.flatMap(n=>n===6?r.steps.slice(0,i).map(op).filter(k=>k.startsWith('ACTION6:')):['ACTION'+n]));
  const offers=openControlForks(m,o,scene,available),current=groupsOf(o),forecast=[];
  for(const rule of study.rules){
   const f=rule.fork,p=at(current,f.subject),ref=at(current,f.reference);if(!p||!ref||f.trigger!==key)continue;
   const predicted=predictControl(rule,sceneKey(o),p,ref);if(predicted)forecast.push({rule,predicted});
  }
  for(const f of offers){
   const id=forkKey(f);if(seen.has(id))continue;seen.add(id);inc('offered');
   if(f.trigger!==key && offers.find(v=>v.trigger===f.trigger)===f)sealed.push({i,f});
  }
  const z=rep.act(key);if(!hash(z).startsWith(c.to))throw Error('Divergent action');
  const y=await observe(z,i+1);
  if(y.level_epoch===o.level_epoch&&y.state===o.state){
   const after=groupsOf(y);
   for(const v of forecast){const actual=at(after,v.rule.fork.subject);checkControl(v.rule,sceneKey(o),actual,v.predicted,y.revision);inc('naturalForecast');if(actual?.join()===v.predicted.join())inc('naturalExact');}
   for(const f of offers)if(f.trigger===key && study.examined[forkKey(f)]===undefined){
    inc('naturallyPlayed');const actual=at(after,f.subject),n=study.rules.length;learnControl(study,f,actual,y.revision);
    if(study.rules.length>n){inc('naturalSelective');if(f.firstMotion)inc('naturalFirstEver');if(examples.length<4)examples.push({i,op:key,p:f.subjectAt,first:f.firstMotion,priority:f.priority,r:f.markerAt,otherR:f.otherMarker,other:f.otherResult,actual});}
   }
   recordExperiment(m,o,y,{action_ref:'ACTION'+c.a,data:c.data??{}},b.frame,z.frame);
  }
  b=z;o=y;
 }
 // The archived trajectory is now complete. The separate branch tests never enter the historical memory above.
 for(const {i,f} of sealed.sort((a,b)=>b.f.priority-a.f.priority||a.i-b.i).slice(0,12)){
  rep.restore(i);const z=rep.act(f.trigger);inc('freshExperiments');if(rep.win(z)||z.state==='GAME_OVER')continue;
  const actual=at(groupsOf(await observe(z,i+1)),f.subject);if(!actual)continue;
  if((actual.join()===f.subjectAt.join())!==(f.otherResult.join()===f.subjectAt.join())){
   inc('freshSelective');if(f.firstMotion)inc('firstEver');if(examples.length<8)examples.push({branch:true,i,op:f.trigger,p:f.subjectAt,first:f.firstMotion,priority:f.priority,r:f.markerAt,otherR:f.otherMarker,other:f.otherResult,actual});
  }
 }
 results.push({code:r.code,level:r.start,counts,examples});
}
await writeFile(out,JSON.stringify(results));

