import assert from 'node:assert/strict';
import {translations} from './sic-study-registered-landmarks.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

// Source-only prospective test. Two disjoint pairs of landmarks nominate a
// translation. Repeat a previously observed motor and inspect its predicted
// remote footprint and equal-distance controls on the public return.
const [env,out,...paths]=process.argv.slice(2), engine=await sourceBackend(resolve(env));
const episodes=[];
const plus=(a,b)=>a.map((v,i)=>v+b[i]), minus=(a,b)=>a.map((v,i)=>v-b[i]);
const span=p=>Math.max(...p.map(Math.abs));

function patchChanged(b,a,p,r){
  const x=Math.round(p[0]/2),y=Math.round(p[1]/2);
  if(x-r<0||y-r<0||x+r>=b[0].length||y+r>=b.length)return null;
  for(let j=y-r;j<=y+r;j++)for(let i=x-r;i<=x+r;i++)if(b[j][i]!==a[j][i])return true;
  return false;
}
for(const file of paths)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line), game=getGameByCode(r.code);
  assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),cache=new Map(),lastMoves=new Map(),dedup=new Set(),results=[];
  async function view(b){
    const h=hash(b);if(!cache.has(h)){
      const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:h,state:b.state,level:b.level,
        levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(i=>'ACTION'+i),palette:b.palette},0,'audit');
      cache.set(h,visualLayout(o,b.frame));
    }return cache.get(h);
  }
  let board=rep.restore(0);
  for(const [i,record] of r.steps.entries()){
    const layout=await view(board),offsets=translations(layout);
    const predictions=[];
    for(const w of offsets)for(const [k,m] of lastMoves){
      const body=layout[k]?.length===1&&layout[k][0];
      if(!body||m.op!==op(record)||i===0)continue;
      const local=plus(body.at,m.d);
      if(span(w.d)<4*span(m.d))continue;
      const remote=plus(local,w.d), controls=[[w.d[1],-w.d[0]],[-w.d[1],w.d[0]],w.d.map(v=>-v)]
        .filter(d=>!offsets.some(other=>other.d.join()===d.join())).map(d=>plus(local,d));
      const radius=Math.max(0,Math.min(2,Math.floor(span(m.d)/4)));
      if(patchChanged(board.frame,board.frame,remote,radius)===null||!controls.some(c=>patchChanged(board.frame,board.frame,c,radius)!==null))continue;
      const key=JSON.stringify([record.from,m.op,k,remote]);if(dedup.has(key))continue;
      dedup.add(key);predictions.push({k,local,remote,controls,radius,op:m.op});
    }
    const after=rep.act(op(record));assert.equal(hash(after).slice(0,16),record.to);
    if(rep.win(after)||after.state!=='NOT_FINISHED')break;
    const next=await view(after);
    for(const p of predictions){
      if(next[p.k]?.length!==1||span(minus(next[p.k][0].at,p.local))>1)continue;
      const observed=patchChanged(board.frame,after.frame,p.remote,p.radius);
      const controls=p.controls.map(c=>patchChanged(board.frame,after.frame,c,p.radius)).filter(v=>v!==null);
      results.push({step:i+1,motor:p.op,observed,controls});
    }
    if(record.a>=1&&record.a<=4)for(const [k,g] of Object.entries(layout)){
      const target=next[k];if(g.length!==1||target?.length!==1)continue;
      const d=minus(target[0].at,g[0].at);
      if(span(d)>=2&&(d[0]===0)!==(d[1]===0))lastMoves.set(k,{op:op(record),d});
    }
    board=after;
  }
  episodes.push({code:r.code,level:r.start,results});
}
const observations=episodes.flatMap(r=>r.results), exact=observations.filter(p=>p.observed).length,controls=observations.flatMap(p=>p.controls);
const summary={episodes:episodes.length,eligibleGames:episodes.filter(r=>r.results.length).map(r=>[r.code,r.level]),tests:observations.length,
  changed:exact,controlChanges:controls.filter(Boolean).length,controls:controls.length,
  exclusive:episodes.filter(r=>r.results.some(p=>p.observed&&p.controls.every(x=>!x))).map(r=>[r.code,r.level])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(JSON.stringify(summary));
