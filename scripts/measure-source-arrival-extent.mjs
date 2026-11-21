import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {getGameByCode} from '../src/games/catalog.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

// Estimate how often a public scalar actually sends the actor to the centre of
// another visible object. Spatial coincidence is measured separately by size.
const [env,out,...paths]=process.argv.slice(2),engine=await sourceBackend(env),episodes=[];
const at=(l,k)=>l[k]?.length===1?l[k][0]:null;
const gap=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
const span=g=>Math.max(g.box[2]-g.box[0]+1,g.box[3]-g.box[1]+1);
async function see(b){
 const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:hash(b),state:b.state,level:b.level,levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(i=>'ACTION'+i)},0,'spatial');
 return visualLayout(o,b.frame);
}
for(const path of paths)for(const line of (await readFile(path,'utf8')).trim().split(/\r?\n/)){
 const r=JSON.parse(line);assert.ok(getGameByCode(r.code)&&getGameByCode(r.code).group!=='custom_4');if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
 const rep=sourceReplay(engine,{},r),b0=rep.restore(0),moves=new Map(),visited=new Map(),seen=new Set(),trials=[];
 let b=b0,l=await see(b);
 // For each distinct motor situation use a witnessed stride and select candidate sites before the return.
 for(const [i,c] of r.steps.entries()){
  assert.equal(hash(b).slice(0,16),c.from);
  if(c.a>=1&&c.a<=4){
   const eligible=[];
   for(const [k,d] of moves){
    const actor=at(l,k);if(!actor||span(actor)>d/2)continue;
    for(const [role,g] of Object.entries(l)){
     if(k===role||g.length!==1)continue;const mark=g[0];if(gap(actor.at,mark.at)<=d/3||!(visited.get(k)??[]).some(p=>gap(p,mark.at)<=d/3))continue;
     const key=JSON.stringify([c.from,k,role,mark.at]);if(seen.has(key))continue;seen.add(key);
     eligible.push({k,d,role,at:mark.at,compact:span(mark)<=d/2});
    }
   }
   if(eligible.length)for(const id of b.availableActionIds.filter(v=>v===5||v===7)){
    rep.restore(i);const next=rep.act('ACTION'+id);if(!rep.win(next)&&next.state==='NOT_FINISHED'){
     const view=await see(next);for(const p of eligible){const end=at(view,p.k);if(end)trials.push({i:i+1,id,compact:p.compact,hit:gap(end.at,p.at)<=p.d/3});}
    }
    b=rep.restore(i);assert.equal(hash(b).slice(0,16),c.from);
   }
  }
  b=rep.act(op(c));assert.equal(hash(b).slice(0,16),c.to);if(rep.win(b)||b.state!=='NOT_FINISHED')break;
  const after=await see(b);
  if(c.a>=1&&c.a<=4)for(const k of Object.keys(l)){
   const a=at(l,k),z=at(after,k);if(!a||!z)continue;
   const d=z.at.map((v,i)=>v-a.at[i]);if((d[0]===0)===(d[1]===0))continue;
   const stride=Math.max(...d.map(Math.abs));if(stride<2)continue;
   moves.set(k,stride);
   const old=visited.get(k)??[];if(!old.some(p=>gap(p,a.at)===0))old.push(a.at);if(!old.some(p=>gap(p,z.at)===0))old.push(z.at);visited.set(k,old);
  }
  l=after;
 }
 episodes.push({code:r.code,level:r.start,trials});
}
const pairs=episodes.flatMap(e=>e.trials),summary={episodes:episodes.length,compact:pairs.filter(p=>p.compact).length,compactHits:pairs.filter(p=>p.compact&&p.hit).length,wide:pairs.filter(p=>!p.compact).length,wideHits:pairs.filter(p=>!p.compact&&p.hit).length,
 byGame:episodes.filter(e=>e.trials.some(t=>t.hit)).map(e=>[e.code,e.level,e.trials.filter(t=>t.compact&&t.hit).length,e.trials.filter(t=>!t.compact&&t.hit).length])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(JSON.stringify(summary));
