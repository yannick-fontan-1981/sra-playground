// Compare the reachable locations of the same visible part after two equal-duration preparations.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {groupsOf,observedRoleMoves,resolveRole} from '../src/sic/exchange-roles.ts';
import {publicParts} from './source-transfer-demonstration.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
const [env,dir,g,selection,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),allow=new Set(GAME_CATALOG.map(x=>x.code));
const files=g==='lower'?Array.from({length:8},(_,i)=>'source-final-'+i):['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s);
const fixed=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8')),runs=new Map(),report=[];
for(const f of files)for(const l of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n')){const r=JSON.parse(l);runs.set(r.code+'/'+r.start,r);}
const eq=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
for(const entry of JSON.parse(await readFile(selection,'utf8'))){
 if(!allow.has(entry.code))throw Error('Source only');
 const r=runs.get(entry.code+'/'+entry.level),rep=sourceReplay(engine,fixed,r),inspect=publicParts(),rows=[];
 for(const root of entry.records.filter(v=>v.examples.length)){
  const initial=rep.restore(root.i),cache=new Map(),groups=new Map(),keys=initial.availableActionIds.flatMap(n=>n===6?[...new Set(r.steps.slice(0,root.i).map(op).filter(k=>k.startsWith('ACTION6:')).reverse())].slice(0,2):['ACTION'+n]);
  async function get(word){const id=word.join('/');if(cache.has(id))return cache.get(id);
    let b=rep.restore(root.i);
    for(const a of word){if(rep.win(b)||b.state!==initial.state||!b.availableActionIds.includes(Number(a.slice(6).split(':')[0])))return null;b=rep.act(a);}
    const won=rep.win(b),live=!won&&b.state===initial.state,h=hash(b);if(live&&!groups.has(h))groups.set(h,groupsOf({entities:(await inspect(b)).parts}));
    const s={won,g:live?groups.get(h):null};cache.set(id,s);return s;}
  const at=(s,role)=>s?.g?resolveRole(s.g,role)?.position??null:null;
  for(const c of root.examples){
    const left=await get([c.a]),right=await get([c.b]),lq=await get([c.a,c.q]),rq=await get([c.b,c.q]);
    const roles=new Map([...observedRoleMoves(left.g,lq.g),...observedRoleMoves(right.g,rq.g)].map(v=>[JSON.stringify(v.role),v.role]));
    const ps=[...roles.values()].filter(p=>eq(at(left,p),c.patient)&&eq(at(right,p),c.patient)&&eq(at(lq,p),c.y)&&eq(at(rq,p),c.z));
    const rs=observedRoleMoves(left.g,right.g).filter(v=>eq(v.from,c.at1)&&eq(v.to,c.at2));if(ps.length!==1||rs.length!==1)continue;
    const p=ps[0],ref=rs[0].role,activated=!eq(c.y,c.patient),a=activated?c.a:c.b,b=activated?c.b:c.a,landing=activated?c.y:c.z,location=activated?c.at1:c.at2,other=activated?c.at2:c.at1;
    const forecasts=[];
    // The full calibration uses up to two commands starting in the common root, before the fresh third command.
    for(const v of keys){
     const counts=new Map();
     for(const s of [[],...keys.map(k=>[k])]){
      const u=at(await get(s),p),z=at(await get([...s,v]),p);
      if(!u||!z||eq(u,landing))continue;
      const delta=sub(z,u),k=delta.join(),row=counts.get(k)??{delta,sources:new Set()};row.sources.add(u.join());counts.set(k,row);
     }
     const sorted=[...counts.values()].sort((x,y)=>y.sources.size-x.sources.size);
     if(!sorted.length||sorted[1]?.sources.size===sorted[0].sources.size||eq(sorted[0].delta,[0,0]))continue;
     const to=add(landing,sorted[0].delta);
     if(to[0]<0||to[1]<0||to[0]>=initial.frame[0].length||to[1]>=initial.frame.length||eq(to,c.patient))continue;
     forecasts.push({op:v,to,origins:sorted[0].sources.size});
    }
    const enumerate=async (prep,mark)=>{
      const all=new Map(),held=new Map(),wins=[],words=[{w:[],fixed:true}];let read=0,tested=0;
      for(const item of words){
       const w=item.w,s=await get([prep,...w]);if(!s)continue;tested++;
       if(s.won){wins.push({w,fixedBefore:item.fixed});continue;}
       const z=at(s,p),m=at(s,ref),fixed=item.fixed&&eq(m,mark);
       if(z){read++;const k=z.join();if(!all.has(k))all.set(k,w);if(fixed&&!held.has(k))held.set(k,w);}
       if(s.g&&w.length<3)for(const v of keys)words.push({w:[...w,v],fixed});
      }
      return {all,held,wins,tested,read};
    };
    const on=await enumerate(a,location),off=await enumerate(b,other);
    const newAll=[...on.all].filter(([k])=>!off.all.has(k)),newHeld=[...on.held].filter(([k])=>!off.held.has(k));
    for(const f of forecasts){const end=await get([a,c.q,f.op]),actual=at(end,p);
      f.actual=actual;f.exact=eq(actual,f.to);f.won=!!end?.won;f.outside=f.exact&&!off.all.has(f.to.join());
      f.outsideFixed=f.exact&&eq(at(await get([a,c.q]),ref),location)&&eq(at(end,ref),location)&&!off.held.has(f.to.join());
    }
    const sample=x=>x.slice(0,4).map(([k,w])=>({to:k.split(',').map(Number),w}));
    rows.push({i:root.i,a,b,q:c.q,p:c.patient,marker:location,other,landing,keys,depth:3,read:[on.read,off.read],tested:[on.tested,off.tested],
      n:[on.all.size,off.all.size],held:[on.held.size,off.held.size],gain:newAll.length,gainFixed:newHeld.length,
      landingExclusive:!off.all.has(landing.join()),examples:sample(newAll),fixedExamples:sample(newHeld),
      win:[on.wins.length,off.wins.length],winExample:on.wins[0]??null,forecasts});
  }
 }
 report.push({code:r.code,level:r.start,rows});
}
await writeFile(out,JSON.stringify(report));

