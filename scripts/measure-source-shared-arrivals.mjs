import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(env),episodes=[];
const near=(p,q)=>p&&q&&p.every((v,i)=>Math.abs(v-q[i])<=1);
const separate=(a,b)=>a[2]<b[0]||b[2]<a[0]||a[3]<b[1]||b[3]<a[1];
async function layout(b){
  const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:hash(b),state:b.state,level:b.level,
    levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(id=>'ACTION'+id)},0,'source');
  return visualLayout(o,b.frame);
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line);assert.ok(getGameByCode(r.code)&&getGameByCode(r.code).group!=='custom_4');
  if(r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions||r.start!==r.finish)continue;
  const rep=sourceReplay(engine,{},r),seen=new Set(),learned=new Map(),data={code:r.code,level:r.start,states:0,twoMoves:0,twoMarked:0,prospective:0,confirmed:0,rivalConfirmed:0};
  for(const [i,c] of r.steps.entries()){
    if(seen.has(c.from))continue;seen.add(c.from);
    const b=rep.restore(i);assert.equal(hash(b).slice(0,16),c.from);
    const scalars=b.availableActionIds.filter(k=>k===5||k===7);if(!scalars.length)continue;
    const before=await layout(b);
    for(const id of scalars){
      const witnesses=learned.get(id)??new Map(),predictions=[];
      for(const w of witnesses.values()){
        const actor=before[w.actor],mark=before[w.cue];if(actor?.length!==1||mark?.length!==1||near(actor[0].at,mark[0].at))continue;
        predictions.push({actor:w.actor,from:actor[0],destination:mark[0]});
      }
      const independent=(a,b)=>a.actor!==b.actor&&separate(a.from.box,b.from.box)&&separate(a.destination.box,b.destination.box)&&
        separate(a.from.box,b.destination.box)&&separate(b.from.box,a.destination.box);
      const paired=pairs=>pairs.some((a,j)=>pairs.slice(j+1).some(b=>independent(a,b)));
      const next=rep.act('ACTION'+id);
      if(!rep.win(next)&&next.state==='NOT_FINISHED'){
        const after=await layout(next),moved=[],marked=[];
        for(const [k,g] of Object.entries(before)){
          const dest=after[k];if(g.length!==1||dest?.length!==1||near(g[0].at,dest[0].at))continue;
          const motion={actor:k,from:g[0],destination:dest[0]};moved.push(motion);
          for(const [cue,parts] of Object.entries(before)){
            if(cue===k||parts.length!==1||!near(parts[0].at,dest[0].at))continue;
            marked.push(motion);witnesses.set(k+'/'+cue,{actor:k,cue});
          }
        }
        data.states++;if(paired(moved))data.twoMoves++;if(paired(marked))data.twoMarked++;
        if(paired(predictions)){
          data.prospective++;
          const actual=l=>predictions.filter(p=>l[p.actor]?.length===1&&near(l[p.actor][0].at,p.destination.at));
          if(paired(actual(after)))data.confirmed++;
          const rival=b.availableActionIds.find(k=>k>=1&&k<=4);
          if(rival){rep.restore(i);const cmp=rep.act('ACTION'+rival);
            if(!rep.win(cmp)&&cmp.state==='NOT_FINISHED'&&paired(actual(await layout(cmp))))data.rivalConfirmed++;}
        }
      }
      learned.set(id,witnesses);rep.restore(i);
    }
  }
  episodes.push(data);
}
const sum=key=>episodes.reduce((n,e)=>n+e[key],0);
const summary={episodes:episodes.length,...Object.fromEntries(['states','twoMoves','twoMarked','prospective','confirmed','rivalConfirmed'].map(k=>[k,sum(k)])),
  games:episodes.filter(e=>e.twoMoves||e.prospective).map(e=>[e.code,e.level,e.twoMoves,e.twoMarked,e.prospective,e.confirmed,e.rivalConfirmed])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(JSON.stringify(summary));
