import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash} from './sic-study-source-replay.mjs';

const [environment,output,frontiers,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment)),reports=[];
const data=JSON.parse(await readFile(frontiers,'utf8')),episodes=new Map(),key=p=>p.join(','),dist=(p,q)=>Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1]);
for(const file of files)for(const l of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(l),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  episodes.set([r.code,r.start].join('/'),r);
}
async function parts(b){const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:await publicFrameHash(b.frame),
  state:b.state,level:b.level,levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(n=>'ACTION'+n)},0,'source-check');
  return visualLayout(o,b.frame);}
for(const row of data)for(const s of row.tests){
  const run=episodes.get([row.code,row.level].join('/'));assert.ok(run&&!run.resets&&!run.sourcePrefixActions&&!run.observedPriorLevelActions);
  const rep=sourceReplay(engine,{},run),initial=rep.restore(s.prefix),live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  const role=s.actor,pitch=dist(s.from,s.barrier);assert.ok(role&&pitch);
  const controls=initial.availableActionIds.filter(n=>n>=1&&n<=4).map(n=>'ACTION'+n),extra=initial.availableActionIds.filter(n=>n===5).map(n=>'ACTION'+n);
  const restore=word=>{let b=rep.restore(s.prefix);for(const cmd of word){if(!live(b))break;b=rep.act(cmd);}return b;};
  const here=(await parts(initial))[role]?.[0]?.at;if(!here)continue;
  const queue=[{word:[],at:here,image:hash(initial)}],seen=new Set([hash(initial)]),attempts=[];
  let found,expanded=0,nearest=dist(here,s.from)/pitch;
  while(queue.length&&expanded<48){
    queue.sort((a,b)=>(a.word.length+dist(a.at,s.from)/pitch)-(b.word.length+dist(b.at,s.from)/pitch));
    const state=queue.shift();if(key(state.at)===key(s.from)){found=state;break;}
    if(state.word.length>=9||s.prefix+state.word.length+3>run.cap)continue;expanded++;
    for(const cmd of [...controls,...extra]){
      const origin=restore(state.word);assert.equal(hash(origin),state.image);const n=rep.act(cmd);if(!live(n))continue;
      const h=hash(n);if(seen.has(h))continue;seen.add(h);const view=await parts(n),at=view[role]?.[0]?.at;
      if(!at||view[role].length!==1||!view[s.role]?.some(p=>dist(p.at,s.barrier)<=pitch*.6))continue;
      nearest=Math.min(nearest,dist(at,s.from)/pitch);queue.push({word:[...state.word,cmd],at,image:h});
    }
  }
  if(found){
    for(const mode of [null,...extra])for(const move of controls){
      let b=restore(found.word);if(mode)b=rep.act(mode);if(!live(b))continue;
      const before=await parts(b),n=rep.act(move);const after=await parts(n),old=before[s.role]??[],next=after[s.role]??[];
      const atBarrier=old.filter(p=>dist(p.at,s.barrier)<=pitch*.6),left=atBarrier.filter(p=>!next.some(q=>key(p.at)===key(q.at)));
      const entered=next.filter(p=>!old.some(q=>key(p.at)===key(q.at)));const a=after[role]?.[0]?.at;
      attempts.push({mode,move,sameStart:before[role]?.length===1&&key(before[role][0].at)===key(s.from),actorEntered:a&&key(a)===key(s.barrier),
        barrierMoved:left.length===1&&entered.length===1?{from:left[0].at,to:entered[0].at}:null,won:rep.win(n)});
    }
  }
  reports.push({code:row.code,level:row.level,prefix:s.prefix,expanded,nearest,expected:s.preparation,actual:found?.word??null,attempts});
}
await writeFile(output,JSON.stringify(reports));console.log('placements',reports.map(r=>[r.code,r.prefix,r.actual?.length??null]));
