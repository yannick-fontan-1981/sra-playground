import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {publicParts} from './source-transfer-demonstration.mjs';
import {groupsOf,observedRoleMoves,resolveRole} from '../src/sic/exchange-roles.ts';
const [env,dir,g,shard,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),[idx,total]=shard.split('/').map(Number);
const names=g==='lower'?Array.from({length:8},(_,i)=>'source-final-'+i):['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s);
const dirs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8')),allow=new Set(GAME_CATALOG.map(x=>x.code)),runs=[],results=[];
for(const name of names)for(const line of (await readFile(join(dir,name+'.jsonl'),'utf8')).trim().split('\n'))runs.push(JSON.parse(line));
const eq=(a,b)=>!!a&&!!b&&a[0]===b[0]&&a[1]===b[1],roleId=r=>JSON.stringify([r.signature,r.fixed]);
const locate=(s,r)=>s?.group?resolveRole(s.group,r)?.position??null:null;
for(const [k,r] of runs.entries()){
 if(k%total!==idx)continue;if(!allow.has(r.code))throw Error('Source corpus only');
 const rep=sourceReplay(engine,dirs,r),inspect=publicParts(),prefixes=[0],seen=new Set(),records=[];
 for(const [j,c] of r.steps.entries()){
   if(j>=4&&j<=12&&seen.has(c.from)){prefixes.push(j);break;}
   seen.add(c.from);
 }
 if(prefixes.length===1&&r.steps.length>8)prefixes.push(8);
 for(const i of prefixes){
   const root=rep.restore(i),cache=new Map();
   const available=b=>b.availableActionIds.flatMap(n=>n===6?[...new Set(r.steps.slice(0,i).map(op).filter(a=>a.startsWith('ACTION6:')).reverse())].slice(0,2):['ACTION'+n]);
   const get=async word=>{const key=word.join('/');if(cache.has(key))return cache.get(key);
     let b=rep.restore(i);for(const act of word){if(!b||!b.availableActionIds.includes(Number(act.slice(6).split(':')[0]))||rep.win(b)||b.state!==root.state){b=null;break;}b=rep.act(act);}
     const s=b&&!rep.win(b)&&b.state===root.state?{image:hash(b),group:groupsOf({entities:(await inspect(b)).parts}),keys:available(b)}:null;
     cache.set(key,s);return s;};
   const base=await get([]),keys=available(root),setups=new Map(),outcomes=new Map(),cards=[],transfers=[],unique=new Set(),candidates=[];
   if(!base)continue;
   for(const a of keys){const s=await get([a]);if(!s)continue;setups.set(a,s);
     for(const q of s.keys){const z=await get([a,q]);if(z)outcomes.set(a+'/'+q,{z,moves:observedRoleMoves(s.group,z.group)});}
   }
   for(const [a,s] of setups)for(const [b,t] of setups){
     if(a>=b||s.image===t.image)continue;
     const references=observedRoleMoves(s.group,t.group).filter(v=>locate(base,v.role));
     for(const q of s.keys){const left=outcomes.get(a+'/'+q),right=outcomes.get(b+'/'+q);if(!left||!right)continue;
       const movable=new Map([...left.moves,...right.moves].map(v=>[roleId(v.role),v.role]));
       const onlyLeft=[],onlyRight=[];
       for(const [id,role] of movable){const p=locate(s,role),r0=locate(t,role),y=locate(left.z,role),z=locate(right.z,role);
         if(!eq(p,r0)||!y||!z||eq(y,z))continue;
         const one=eq(p,y)!==eq(p,z);
         if(one){if(!eq(p,y))onlyLeft.push(role);else onlyRight.push(role);}
         const facts={a,b,q,p,y,z,one};
         cards.push({...facts,reference:references.length>0,role:id});
         if(!one)continue;
         for(const ref of references){if(ref.role.signature===role.signature)continue;
           const binding=JSON.stringify([q,id,roleId(ref.role),p,ref.from,ref.to,y,z]);if(unique.has(binding))continue;
           unique.add(binding);candidates.push({...facts,role,ref:ref.role,at1:ref.from,at2:ref.to});
         }
       }
       if(onlyLeft.length&&onlyRight.length)transfers.push({a,b,q,left:onlyLeft.length,right:onlyRight.length,refs:references.length});
     }
   }
   // One spatial binding per trigger and patient, up to four. Seal both alternative effects before trying any two-action preparation.
   const selected=[],used=new Set();
   for(const c of candidates){const key=c.q+'/'+roleId(c.role);if(used.has(key))continue;used.add(key);selected.push(c);if(selected.length===4)break;}
   const forecasts=[],hits=[];
   if(selected.length){
     for(const a of keys)for(const b of keys){
       const setup=await get([a,b]);if(!setup)continue;
       for(const [j,c] of selected.entries()){
         if(a===c.q||b===c.q||!setup.keys.includes(c.q)||!eq(locate(setup,c.role),c.p))continue;
         const pt=locate(setup,c.ref),side=eq(pt,c.at1)?1:eq(pt,c.at2)?2:null;if(!side)continue;
         const id=JSON.stringify([j,setup.image]);if(used.has(id))continue;used.add(id);
         const expected=side===1?c.y:c.z;const z=await get([a,b,c.q]),actual=locate(z,c.role);if(!actual)continue;
         forecasts.push({j,side,word:[a,b],expected,actual,exact:eq(expected,actual)});
       }
     }
     for(const [j,c] of selected.entries()){const ys=forecasts.filter(f=>f.j===j);
       const both=[1,2].every(side=>ys.some(f=>f.side===side&&f.exact));
       if(both)hits.push({a:c.a,b:c.b,q:c.q,patient:c.p,at1:c.at1,at2:c.at2,y:c.y,z:c.z,arms:ys,allExact:ys.every(f=>f.exact)});
     }
   }
   records.push({i,keys:keys.length,selective:cards.length,newControl:cards.filter(c=>c.one).length,spatial:cards.filter(c=>c.one&&c.reference).length,
     exclusiveTransfers:transfers.length,transferExamples:transfers.slice(0,3),namedConditions:selected.length,predictions:forecasts.length,exact:forecasts.filter(c=>c.exact).length,
     replicatedTwoSides:hits.length,consistentlyReplicated:hits.filter(h=>h.allExact).length,examples:hits.slice(0,3)});
 }
 results.push({code:r.code,level:r.start,records});
}
await writeFile(out,JSON.stringify(results));

