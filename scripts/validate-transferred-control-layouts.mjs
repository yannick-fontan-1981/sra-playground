import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {publicParts} from './source-transfer-demonstration.mjs';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {groupsOf,observedRoleMoves,resolveRole} from '../src/sic/exchange-roles.ts';
const [env,dir,g,selection,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const files=g==='lower'?Array.from({length:8},(_,i)=>'source-final-'+i):['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s);
const defs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8')),allowed=new Set(GAME_CATALOG.map(x=>x.code)),runs=new Map(),report=[];
for(const f of files)for(const l of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n')){const r=JSON.parse(l);runs.set(r.code+'/'+r.start,r);}
const eq=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
for(const entry of JSON.parse(await readFile(selection,'utf8'))){
 if(!allowed.has(entry.code))throw Error('Source games only');
 const r=runs.get(entry.code+'/'+entry.level),rep=sourceReplay(engine,defs,r),inspect=publicParts(),rows=[];
 for(const test of entry.records.filter(c=>c.examples.length)){
   const initial=rep.restore(test.i),get=async word=>{const k=word.join('/');if(cache.has(k))return cache.get(k);
     let b=rep.restore(test.i);for(const s of word){if(b.state!==initial.state||rep.win(b)||!b.availableActionIds.includes(Number(s.slice(6).split(':')[0])))return null;b=rep.act(s);}
     const v=rep.win(b)||b.state!==initial.state?null:{h:hash(b),g:groupsOf({entities:(await inspect(b)).parts})};cache.set(k,v);return v;};
   const cache=new Map(),at=(s,r)=>s?resolveRole(s.g,r)?.position??null:null;
   const keys=initial.availableActionIds.flatMap(n=>n!==6?['ACTION'+n]:[...new Set(r.steps.slice(0,test.i).map(op).filter(x=>x.startsWith('ACTION6:')).reverse())].slice(0,2));
   const trainingFrames=new Set();
   for(const word of [[],...keys.map(k=>[k]),...keys.flatMap(a=>keys.map(b=>[a,b]))]){const v=await get(word);if(v)trainingFrames.add(v.h);}
   for(const card of test.examples){
     const s=await get([card.a]),t=await get([card.b]),sa=await get([card.a,card.q]),tb=await get([card.b,card.q]);
     if(!s||!t||!sa||!tb)throw Error('Lost training branches');
     const roles=new Map([...observedRoleMoves(s.g,sa.g),...observedRoleMoves(t.g,tb.g)].map(v=>[JSON.stringify(v.role),v.role]));
     const patients=[...roles.values()].filter(r=>eq(at(s,r),card.patient)&&eq(at(t,r),card.patient)&&eq(at(sa,r),card.y)&&eq(at(tb,r),card.z));
     const references=observedRoleMoves(s.g,t.g).filter(r=>eq(r.from,card.at1)&&eq(r.to,card.at2));
     if(patients.length!==1||references.length!==1){rows.push({i:test.i,ambiguous:true});continue;}
     const actor=patients[0],marker=references[0].role,displacements=[sub(card.y,card.patient),sub(card.z,card.patient)],offsets=[sub(card.patient,card.at1),sub(card.patient,card.at2)];
     const previous=trainingFrames;
     const keys2=keys.filter(k=>k!==card.q),seen=new Set(),examples=[],counts={};
     const inc=(k,y=true)=>{if(y)counts[k]=(counts[k]??0)+1;};
     for(const a of keys2)for(const b of keys2)for(const d of keys2){
       const word=[a,b,d],z=await get(word);if(!z||seen.has(z.h)||previous.has(z.h))continue;
       seen.add(z.h);const p=at(z,actor),m=at(z,marker);if(!p||!m)continue;
       const side=offsets.findIndex(v=>eq(v,sub(p,m)));if(side<0)continue;
       const forecast=add(p,displacements[side]),translated=!eq(p,card.patient),active=!eq(forecast,p);
       const result=await get([...word,card.q]),actual=at(result,actor);if(!actual)continue;
       const correct=eq(actual,forecast);inc('predicted');inc('exact',correct);inc('side'+side);inc('exactSide'+side,correct);inc('translated',translated);inc('translatedExact',translated&&correct);
       inc('active',active);inc('activeExact',active&&correct);inc('newLanding',translated&&active&&correct&&!eq(actual,card.y)&&!eq(actual,card.z));
       if(examples.length<8)examples.push({word,p,m,side,forecast,actual,translated,correct});
     }
     rows.push({i:test.i,a:card.a,b:card.b,q:card.q,from:card.patient,r1:card.at1,r2:card.at2,displacements,counts,examples});
   }
 }
 report.push({code:r.code,level:r.start,rows});
}
await writeFile(out,JSON.stringify(report));

