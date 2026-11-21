import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';
import {translations} from './sic-study-registered-landmarks.mjs';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(env),episodes=[];
const plus=(p,q)=>p.map((v,i)=>v+q[i]);
const minus=(p,q)=>p.map((v,i)=>v-q[i]);
const near=(p,q)=>p.every((v,i)=>Math.abs(v-q[i])<=1);
async function layout(board){
  const observation=await measureNativeObservation({frame_rows:board.frame,frame_hash:hash(board),state:board.state,
    level:board.level,levels_completed:board.levelsCompleted,available_action_refs:board.availableActionIds.map(id=>'ACTION'+id)},0,'source');
  return visualLayout(observation,board.frame);
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line);
  assert.ok(getGameByCode(r.code)&&getGameByCode(r.code).group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),motors=new Map(),visited=new Map(),tested=new Set();
  const data={code:r.code,level:r.start,registeredFrames:0,registeredTests:0,registeredMatches:0,rotatedTests:0,rotatedMatches:0};
  let board=rep.restore(0),before=await layout(board);
  for(const record of r.steps){
    const command=op(record),offsets=translations(before).map(w=>w.d),predictions=[];
    if(offsets.length)data.registeredFrames++;
    if(record.a>=1&&record.a<=4&&offsets.length){
      const rotated=offsets.flatMap(([x,y])=>[[y,-x],[-y,x]]).filter(d=>!offsets.some(k=>near(k,d)));
      for(const [subject,commands] of motors){
        const current=before[subject],motion=commands.get(command);
        if(!motion||current?.length!==1)continue;
        const destination=plus(current[0].at,motion);
        if(visited.get(subject)?.has(destination.join()))continue;
        for(const [label,ds] of [['registered',offsets],['rotated',rotated]]){
          const hasSupport=ds.some(d=>[...motors.keys()].some(peer=>peer!==subject&&before[peer]?.length===1&&near(plus(before[peer][0].at,d),destination)));
          const key=JSON.stringify([record.from,subject,command,label]);
          if(hasSupport&&!tested.has(key)){tested.add(key);predictions.push({subject,destination,label});}
        }
      }
    }
    board=rep.act(command);assert.equal(hash(board).slice(0,16),record.to);
    if(rep.win(board)||board.state!=='NOT_FINISHED')break;
    const after=await layout(board);
    for(const {subject,destination,label} of predictions){
      data[label+'Tests']++;
      if(after[subject]?.length===1&&near(after[subject][0].at,destination))data[label+'Matches']++;
    }
    if(record.a>=1&&record.a<=4)for(const [role,parts] of Object.entries(before)){
      const next=after[role];if(parts.length!==1||next?.length!==1)continue;
      const d=minus(next[0].at,parts[0].at);
      if(!((d[0]===0)!==(d[1]===0))||Math.max(...d.map(Math.abs))<2)continue;
      if(!motors.has(role)){motors.set(role,new Map());visited.set(role,new Set());}
      motors.get(role).set(command,d);
      for(const p of [parts[0].at,next[0].at])visited.get(role).add(p.join());
    }
    before=after;
  }
  episodes.push(data);
}
const counts=Object.fromEntries(['registeredFrames','registeredTests','registeredMatches','rotatedTests','rotatedMatches'].map(k=>[k,episodes.reduce((n,e)=>n+e[k],0)]));
await writeFile(out,JSON.stringify({episodes,counts}));console.log(JSON.stringify({episodes:episodes.length,...counts}));
