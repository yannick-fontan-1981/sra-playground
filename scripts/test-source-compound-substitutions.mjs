import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {poseFamilyKey} from '../src/sic/pose-families.ts';
import {footprints} from './source-contact-footprints.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op,hash} from './sic-study-source-replay.mjs';

const [environment,output,routes,evidence,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment));
const plans=JSON.parse(await readFile(routes,'utf8')),marks=JSON.parse(await readFile(evidence,'utf8'));
const results=[],same=(a,b)=>a?.join()===b?.join();
const center=p=>[0,1].map(i=>(p.bbox[i]+p.bbox[i+2])/2);
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const pose=p=>poseFamilyKey({palette_value:p.color,bbox:p.bbox,mask:p.mask});
const actionId=input=>Number(input.split(':')[0].slice(6));
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  const trials=plans.find(p=>p.code===r.code&&p.level===r.start)?.trials;
  if(!trials?.length)continue;
  const rep=sourceReplay(engine,{},r),seen=new Set(),probes=[];
  for(const t of trials.filter(t=>t.divergence)){
    const w=marks.find(p=>p.code===r.code&&p.level===r.start)?.confirmations.find(w=>w.actor===t.actor&&w.peer===t.peer&&w.step===t.earlier);
    assert.ok(w);
    const learned=footprints(rep.restore(w.step-1).frame),original=[...learned].find(([k])=>digest(k)===w.actor)?.[1];
    if(!original?.size)continue;
    const family=pose(original.values().next().value),labels=new Map();
    function observations(b){
      const subjects=[],items=[];
      for(const [k,group] of footprints(b.frame)){
        let id=labels.get(k);
        if(!id){id={pose:pose(group.values().next().value),hash:digest(k)};labels.set(k,id);}
        if(id.pose===family)subjects.push(...[...group.values()].map(center));
        if(id.hash===w.peer)items.push(...[...group.values()].map(center));
      }
      return {actor:subjects.length===1?subjects[0]:null,items};
    }
    const beforeWord=t.plan.slice(0,t.steps-1),suffix=t.plan.slice(t.steps);
    function restore(){let b=rep.restore(t.prefix);for(const q of beforeWord)b=rep.act(q);return b;}
    const root=restore(),image=hash(root),view=observations(root),destination=t.divergence.expected;
    const nearby=(p,q)=>Math.max(...p.map((v,i)=>Math.abs(v-q[i])))<=w.pitch*.45;
    const id=[image,t.actor,t.peer,destination,w.firstSite].join('/');
    if(seen.has(id)||!view.actor||view.items.some(p=>nearby(p,w.firstSite)))continue;seen.add(id);
    const priorClicks=r.steps.slice(0,t.prefix).filter(s=>s.a===6).map(op).reverse();
    const clicks=[view.actor,destination,w.firstSite].map(p=>'ACTION6:'+p.map(Math.floor).join(','));
    const inputs=[...new Set(root.availableActionIds.flatMap(n=>n===6?[...clicks,...[...new Set(priorClicks)].slice(0,2)]:['ACTION'+n]))];
    const requiresLoss=view.items.some(p=>nearby(p,destination)),cache=new Map();
    function measure(word){
      if(cache.has(word.join('/')))return cache.get(word.join('/'));
      let b=restore();assert.equal(hash(b),image);let used=0;
      for(const input of word){
        if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(actionId(input))||t.prefix+beforeWord.length+used>=r.cap)break;
        b=rep.act(input);used++;
      }
      const scored=rep.win(b),o=b.state==='NOT_FINISHED'&&!scored?observations(b):null;
      const matched=!!o&&used===word.length&&same(o.actor,destination)&&!o.items.some(p=>nearby(p,w.firstSite))&&
        (!requiresLoss||(o.items.length===view.items.length-1&&!o.items.some(p=>nearby(p,destination))));
      let carried=0;
      if(matched)for(const q of suffix){
        if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(actionId(q))||t.prefix+beforeWord.length+used+carried>=r.cap)break;
        b=rep.act(q);carried++;
      }
      const result={matched,scored:scored&&used===word.length,suffixWon:rep.win(b),carried};
      cache.set(word.join('/'),result);return result;
    }
    const singles=inputs.map(input=>({input,...measure([input])})),pairs=[];
    function scoreFromPrefix(word){
      let b=rep.restore(t.prefix),used=0;
      for(const q of word){
        if(rep.win(b)||b.state!=='NOT_FINISHED'||t.prefix+used>=r.cap||!b.availableActionIds.includes(actionId(q)))break;
        b=rep.act(q);used++;
      }
      return {word,won:rep.win(b),used};
    }
    for(const a of inputs)for(const b of inputs){
      const x=measure([a,b]);
      if(!x.matched&&!x.scored)continue;
      const ca=measure([a]),cb=measure([b]),reverse=measure([b,a]);
      const pair={a,b,...x,bothRequired:![ca,cb].some(t=>t.matched||t.scored),orderRequired:!reverse.matched&&!reverse.scored};
      if(x.scored){
        const word=[...beforeWord,a,b],ordered=[[]];
        for(const input of word.length<=5?word:[]){
          const prior=ordered.splice(0),seen=new Set();
          for(const prefix of prior)for(let i=0;i<=prefix.length;i++){
            const v=[...prefix.slice(0,i),input,...prefix.slice(i)];
            if(!seen.has(v.join('/'))){seen.add(v.join('/'));ordered.push(v);}
          }
        }
        pair.scoreControls={chosen:scoreFromPrefix(word),recorded:scoreFromPrefix(r.steps.slice(t.prefix,t.prefix+word.length).map(op)),
          omitted:word.map((_,i)=>scoreFromPrefix(word.filter((_,j)=>j!==i))),
          permutations:ordered.filter(v=>v.length===word.length).map(scoreFromPrefix),
          repeated:inputs.map(input=>scoreFromPrefix(Array(word.length).fill(input)))};
      }
      pairs.push(pair);
    }
    probes.push({prefix:t.prefix,stepInPlan:t.steps,first:w.firstSite,from:view.actor,destination,requiresLoss,
      singles,pairs,pairsTested:inputs.length**2});
  }
  results.push({code:r.code,level:r.start,probes});
}
await writeFile(output,JSON.stringify(results));console.log('probes',results.reduce((a,r)=>a+r.probes.length,0));
