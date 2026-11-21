import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay, op, hash} from './sic-study-source-replay.mjs';

// Look for terminal contacts at one of two stable landmarks. Compute the
// predictions before exposing the next frame or playing a counterfactual.
const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const gap=(p,q)=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));
const records=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game && game.group!=='custom_4');
  if(run.error||run.start!==run.finish||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},run),cache=new Map(),motion=new Map(),history=new Map();
  const inspect=async b=>{
    const h=hash(b);
    if(!cache.has(h)){
      const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,level:b.level,
        levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(k=>'ACTION'+k)},cache.size,'source');
      cache.set(h,visualLayout(o,b.frame));
    }
    return cache.get(h);
  };
  let b=rep.restore(0),layout=await inspect(b);
  const targets=Object.entries(layout).filter(([,parts])=>parts.length===2).map(([role,parts])=>({role,sites:parts.map(p=>p.at)}));
  for(const [i,c] of run.steps.entries()){
    for(const t of targets)if(layout[t.role]?.some(v=>!t.sites.some(p=>gap(p,v.at)===0)))t.disqualified=true;
    const terminal=i+1===run.steps.length;
    if(terminal){
      const predictions=[];
      for(const t of targets.filter(t=>!t.disqualified))for(const [actor,commands] of motion){
        if(t.role===actor||layout[actor]?.length!==1)continue;
        const body=layout[actor][0];
        for(const [id,values] of commands){
          const best=[...values.values()].sort((a,b)=>b.count-a.count)[0];
          if(!best||best.count*2<=[...values.values()].reduce((n,s)=>n+s.count,0))continue;
          const {d}=best,pitch=Math.max(...d.map(Math.abs));
          const future=body.at.map((n,i)=>n+d[i]);
          for(const [j,site] of t.sites.entries()){
            if(gap(future,site)*2>=pitch||gap(body.at,site)*2<pitch)continue;
            const other=t.sites[1-j];
            const held=Object.keys(layout).some(k=>k!==actor&&k!==t.role&&motion.has(k)&&layout[k].some(p=>gap(p.at,other)*2<pitch));
            predictions.push({id,actor,t:t.role,held,returning:history.get(actor)?.has(site.join())??false});
          }
        }
      }
      if(predictions.length){
        const outcomes=[];
        for(const id of b.availableActionIds.filter(a=>a>=1&&a<=4)){
          rep.restore(i);const n=rep.act('ACTION'+id);
          outcomes.push({id,won:rep.win(n),changed:hash(n)!==hash(b)});
        }
        rep.restore(i);
        records.push({code:run.code,level:run.start,at:i+1,played:c.a,predictions,outcomes});
      }
    }
    const n=rep.act(op(c));assert.equal(hash(n).slice(0,16),c.to);
    if(rep.win(n)||n.state!=='NOT_FINISHED'){b=n;break;}
    const next=await inspect(n);
    if(c.a>=1&&c.a<=4)for(const [k,parts] of Object.entries(layout)){
      if(parts.length!==1||next[k]?.length!==1)continue;
      const old=parts[0],now=next[k][0],d=old.at.map((v,i)=>now.at[i]-v);
      const span=Math.max(old.box[2]-old.box[0]+1,old.box[3]-old.box[1]+1);
      if((d[0]===0)===(d[1]===0)||Math.max(...d.map(Math.abs))<Math.max(2,span)||Math.max(...d.map(Math.abs))>span*4)continue;
      if(!motion.has(k))motion.set(k,new Map());
      const commands=motion.get(k);if(!commands.has(c.a))commands.set(c.a,new Map());
      const values=commands.get(c.a),key=d.join();
      values.set(key,{d,count:1+(values.get(key)?.count??0)});
      if(!history.has(k))history.set(k,new Set());
      history.get(k).add(old.at.join()).add(now.at.join());
    }
    b=n;layout=next;
  }
  assert.equal(rep.win(b),run.levels[0].won);
}
await writeFile(out,JSON.stringify(records));
const decisive=records.filter(r=>r.predictions.some(p=>r.outcomes.some(o=>o.id===p.id&&o.won))&&r.outcomes.some(o=>!o.won));
console.log(JSON.stringify({proposals:records.length,decisive:decisive.map(r=>[r.code,r.level,r.predictions.some(p=>p.held)])}));
