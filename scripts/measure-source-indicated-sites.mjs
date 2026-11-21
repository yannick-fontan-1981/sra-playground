import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';

// Prospectively choose visible candidates that changed with a moving subject.
// Did a scalar operation take the subject to the indicated, previously visited site?
const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),records=[];
const gap=(p,q)=>Math.max(Math.abs(p[0]-q[0]),Math.abs(p[1]-q[1]));
const solo=(l,k)=>l[k]?.length===1?l[k][0].at:undefined;
let episodes=0;
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line),game=getGameByCode(run.code);
  assert.ok(game&&game.group!=='custom_4');
  if(run.error||run.start!==run.finish||run.resets||run.sourcePrefixActions||run.observedPriorLevelActions)continue;
  episodes++;
  const rep=sourceReplay(engine,{},run),cache=new Map(),actors=new Map(),tested=new Set();
  async function view(b){
    const key=hash(b);
    if(!cache.has(key)){
      const o=await measureNativeObservation({frame_rows:b.frame,frame_hash:key,state:b.state,level:b.level,
        levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(id=>'ACTION'+id)},cache.size,'source-probe');
      cache.set(key,visualLayout(o,b.frame));
    }
    return cache.get(key);
  }
  let board=rep.restore(0),layout=await view(board);
  for(const [i,c] of run.steps.entries()){
    const hypotheses=[];
    for(const [actor,m] of actors){
      const at=solo(layout,actor);
      if(!at||m.sites.size<3)continue;
      const pitches=[...m.strides].sort((a,b)=>b[1]-a[1]),pitch=pitches[0][0];
      for(const cue of m.cues){
        const indicated=solo(layout,cue);
        if(!indicated||gap(at,indicated)<pitch/2)continue;
        const visited=[...m.sites.values()].some(site=>gap(site,indicated)<pitch/2);
        for(const id of board.availableActionIds.filter(v=>v>4&&v!==6)){
          const key=JSON.stringify([actor,cue,id,visited]);
          if(tested.has(key))continue;
          tested.add(key);
          hypotheses.push({actor,id,visited,indicated,pitch});
        }
      }
    }
    // Rank and freeze all hypotheses before exposing any branch outcome. Reuse
    // one physical intervention for every prediction about that same action.
    for(const id of new Set(hypotheses.map(h=>h.id))){
      rep.restore(i);const next=rep.act('ACTION'+id);
      const observed=rep.win(next)?'official':next.state!=='NOT_FINISHED'?'lost':hash(next)===hash(board)?'unchanged':null;
      const resultLayout=observed?null:await view(next);
      for(const h of hypotheses.filter(h=>h.id===id)){
        const arrived=resultLayout&&solo(resultLayout,h.actor);
        records.push({code:run.code,level:run.start,decision:i+1,id,visited:h.visited,
          result:observed??(arrived&&gap(arrived,h.indicated)<h.pitch/2?'arrived':'other_change')});
      }
    }
    if(hypotheses.length)rep.restore(i);
    const n=rep.act(op(c));assert.equal(hash(n).slice(0,16),c.to);
    if(rep.win(n)||n.state!=='NOT_FINISHED')break;
    const after=await view(n);
    if(c.a>=1&&c.a<=4)for(const actor of Object.keys(layout)){
      const at=solo(layout,actor),to=solo(after,actor);
      if(!at||!to)continue;
      const stride=gap(at,to),box=layout[actor][0].box,span=Math.max(box[2]-box[0]+1,box[3]-box[1]+1);
      if(stride<Math.max(2,span)||stride>4*span)continue;
      const m=actors.get(actor)??{sites:new Map(),cues:new Set(),strides:new Map()};
      actors.set(actor,m);m.sites.set(at.join(),at).set(to.join(),to);m.strides.set(stride,1+(m.strides.get(stride)??0));
      for(const k of Object.keys(after)){
        if(k===actor)continue;
        const p=solo(after,k),old=solo(layout,k);
        if(p&&(!old||gap(old,p)>=stride/2))m.cues.add(k);
      }
    }
    board=n;layout=after;
  }
}
const counts={};for(const r of records){const row=counts[String(r.visited)]??={};row[r.result]=1+(row[r.result]??0);}
await writeFile(out,JSON.stringify({episodes,counts,records}));
console.log(JSON.stringify({episodes,counts,confirmed:records.filter(r=>r.visited&&r.result==='arrived').map(({code,level})=>[code,level]).slice(0,20)}));
