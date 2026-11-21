import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';

const [environment,output,controls,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),scores=JSON.parse(await readFile(controls,'utf8')),results=[];
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const center=p=>[0,1].map(i=>p.bbox[i]+p.bbox[i+2]);
const only=group=>group?.size===1?group.values().next().value:null;
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);assert.ok(game&&game.group!=='custom_4');
  const score=scores.find(s=>s.code===r.code&&s.level===r.start);
  if(!score?.orders||!score.orders.every(s=>s.won)||score.shorter.some(s=>s.won)||score.otherCounts.some(s=>s.won))continue;
  const rep=sourceReplay(engine,{},r),input=[...new Set(score.word)],counts=w=>input.map(op=>w.filter(k=>k===op).length);
  const goal=counts(score.word),observations=[],proper=[[],...input.map(a=>[a])];
  for(const a of input)for(const b of input)if(counts([a,b]).every((v,i)=>v<=goal[i]))proper.push([a,b]);
  for(const word of proper){
    let b=rep.restore(score.prefix);for(const cmd of word)b=rep.act(cmd);
    assert.ok(!rep.win(b)&&b.state==='NOT_FINISHED');
    observations.push({word,counts:counts(word),view:footprints(b.frame),image:hash(b)});
  }
  const initial=observations[0].view,units=observations.slice(1,1+input.length),joint=observations.slice(1+input.length);
  const roles=new Set(observations.flatMap(s=>[...s.view.keys()])),witnesses=[],arrivals=[];
  function fit(get){
    const base=get(initial),single=units.map(s=>get(s.view));
    if(base===null||single.includes(null))return;
    const delta=single.map(x=>x-base);if(delta.every(x=>x===0))return;
    const project=c=>base+c.reduce((n,x,i)=>n+x*delta[i],0);
    if(!joint.every(s=>get(s.view)===project(s.counts)))return;
    return {base,delta,end:project(goal)};
  }
  for(const role of roles){
    const n=fit(v=>v.get(role)?.size??0);
    if(n)witnesses.push({type:'count',role:digest(role),...n});
    const coords=[0,1].map(axis=>fit(v=>{const p=only(v.get(role));return p?center(p)[axis]:null;}));
    coords.forEach((c,axis)=>{if(c)witnesses.push({type:axis?'y':'x',role:digest(role),...c});});
    const part=only(initial.get(role));if(!part)continue;
    if(coords.every(c=>c)&&input.length===2){
      const [x,y]=coords,det=x.delta[0]*y.delta[1]-x.delta[1]*y.delta[0];if(!det)continue;
      const goals=[];
      for(const [target,group] of initial){
        if(role===target)continue;
        for(const [site,p] of group){
          if(!observations.every(q=>q.view.get(target)?.has(site)))continue;
          const [a,b,c,d]=p.bbox;
          if(c-a>2*(part.bbox[2]-part.bbox[0]+1)||d-b>2*(part.bbox[3]-part.bbox[1]+1))continue;
          if(x.end>=2*a-1&&x.end<=2*c+1&&y.end>=2*b-1&&y.end<=2*d+1)
            goals.push({target:digest(target),position:center(p),copies:group.size});
        }
      }
      arrivals.push({role:digest(role),start:center(part),projected:[x.end,y.end],goals});
    }
  }
  // A local state can survive even when neither the actor nor the target has
  // a stable singleton identity. Keep one representative per input and type.
  const bits=new Map();
  for(const role of roles){
    const places=new Set(observations.flatMap(s=>[...(s.view.get(role)?.keys()??[])]));
    for(const site of places){
      const bit=fit(v=>Number(v.get(role)?.has(site)??false));
      if(!bit||bit.end<0||bit.end>1)continue;
      const k=bit.delta.join('/')+'/'+bit.end;if(!bits.has(k))bits.set(k,{type:'occupied',role:digest(role),site,...bit});
    }
  }
  witnesses.push(...bits.values());
  const privateByInput=input.map((_,i)=>[...new Set(witnesses.filter(w=>w.delta[i]&&w.delta.filter(Boolean).length===1).map(w=>w.type))]);
  const equalImages=joint.every(s=>joint.every(t=>s.counts.join()!==t.counts.join()||s.image===t.image));
  results.push({code:r.code,level:r.start,prefix:score.prefix,input,goal,observations:proper.length,equalImages,
    privateByInput,witnesses,arrivals});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length);
