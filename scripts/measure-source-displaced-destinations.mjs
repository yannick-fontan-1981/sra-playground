import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {measureDisplacedDestination} from '../src/sic/displaced-destination.ts';
import {cellMatches} from '../src/sic/calibrate-spatial-controls.ts';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';

// Nominate a contact before seeing the next image. The fixed reference is a
// visible object that stayed through the actor's preceding use of this motor.
const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(env),episodes=[];
const at=(layout,role)=>layout[role]?.length===1?layout[role][0].at:null;
const same=(a,b)=>a&&b&&a.every((v,i)=>v===b[i]);
async function layout(b){
  const key=hash(b),observation=await measureNativeObservation({frame_rows:b.frame,frame_hash:key,
    state:b.state,level:b.level,levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(i=>'ACTION'+i)},0,'source');
  return visualLayout(observation,b.frame);
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line);
  assert.ok(getGameByCode(run.code)&&getGameByCode(run.code).group!=='custom_4');
  if(run.error||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions||run.start!==run.finish)continue;
  const replay=sourceReplay(engine,{},run),motors=new Map(),seen=new Set(),confirmed=[];
  let board=replay.restore(0),before=await layout(board),tests=0,refuted=0;
  for(const [index,c] of run.steps.entries()){
    assert.equal(hash(board).slice(0,16),c.from);
    const pending=[];
    if(c.a>=1&&c.a<=4)for(const motion of (motors.get(c.a)?.values()??[])){
      const {actor,delta,anchors,pitch}=motion,origin=at(before,actor);
      if(!origin)continue;
      const expected=origin.map((v,i)=>v+delta[i]);
      for(const [role,group] of Object.entries(before)){
        if(actor===role)continue;
        const candidates=group.filter(p=>cellMatches(p.at,expected,pitch));
        if(candidates.length!==1)continue;
        const anchor=anchors.find(([peer,p])=>peer!==role&&same(at(before,peer),p));
        if(!anchor)continue;
        const site=candidates[0].at,key=JSON.stringify([c.from,c.a,actor,role,site]);
        if(seen.has(key))continue;
        seen.add(key);pending.push({actor,role,site,anchor,pitch});
      }
    }
    board=replay.act(op(c));
    assert.equal(hash(board).slice(0,16),c.to);
    if(replay.win(board)||board.state!=='NOT_FINISHED')break;
    const after=await layout(board);
    for(const p of pending){
      tests++;
      const [peer,position]=p.anchor;
      const moved=measureDisplacedDestination(before,after,p.role,p.site,p.actor,peer,position,p.pitch,'step/'+(index+1));
      if(moved)confirmed.push({step:index+1,command:c.a,actor:p.actor,role:p.role,copies:before[p.role].length});
      else refuted++;
    }
    if(c.a>=1&&c.a<=4){
      const anchors=Object.keys(before).filter(k=>same(at(before,k),at(after,k))).map(k=>[k,at(before,k)]);
      const byActor=motors.get(c.a)??new Map();
      for(const actor of Object.keys(before)){
        const p=at(before,actor),q=at(after,actor);
        if(!p||!q)continue;
        const delta=q.map((v,i)=>v-p[i]),stride=Math.max(...delta.map(Math.abs));
        if(stride>=2&&((delta[0]===0)!==(delta[1]===0)))byActor.set(actor,{actor,delta,anchors,pitch:[stride,stride]});
      }
      motors.set(c.a,byActor);
    }
    before=after;
  }
  episodes.push({code:run.code,level:run.start,tests,refuted,confirmed});
}
const summary={episodes:episodes.length,tests:episodes.reduce((n,e)=>n+e.tests,0),
  confirmed:episodes.reduce((n,e)=>n+e.confirmed.length,0),multiple:episodes.flatMap(e=>e.confirmed).filter(p=>p.copies>1).length,
  games:episodes.filter(e=>e.confirmed.length).map(e=>[e.code,e.level,e.confirmed.length])};
await writeFile(out,JSON.stringify({summary,episodes}));
console.log(JSON.stringify(summary));
