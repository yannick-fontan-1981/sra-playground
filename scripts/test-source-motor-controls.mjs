import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {sourcePoseIndex} from './source-numbered-poses.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
const [env,dir,selection,shard,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),[ix,n]=shard.split('/').map(Number);
const allow=new Set(GAME_CATALOG.map(v=>v.code)),programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8')),runs=new Map(),result=[];
for(const f of [...Array.from({length:8},(_,i)=>'source-final-'+i),...['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s)])for(const line of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n')){const r=JSON.parse(line);runs.set(r.code+'/'+r.start,r);}
for(const [j,entry] of JSON.parse(await readFile(selection,'utf8')).entries()){
 if(j%n!==ix)continue;if(!allow.has(entry.code))throw Error('Source games only');
 const r=runs.get(entry.code+'/'+entry.level),rep=sourceReplay(engine,programs,r),read=sourcePoseIndex(),rows=[];
 const view=async b=>(await read(b)).groups;
 if(entry.tickets.length){
  let b=rep.restore(0);
  for(let i=0;i<=Math.max(...entry.tickets.map(t=>t.i));i++){await view(b);if(i<r.steps.length)b=rep.act(op(r.steps[i]));}
 }
 for(const t of entry.tickets){
  const origin=rep.restore(t.i),al=origin.availableActionIds,valid=t.arms.every(v=>al.includes(Number(v.op.slice(6))));
  if(!valid)continue;
  const current=(await view(origin)).get(t.actor);
  if(!hash(origin).startsWith(t.root)||current?.length!==1||current[0].shape!==t.shape||current[0].p.join()!==t.p.join())throw Error('Motor identity mismatch '+r.code+'/'+t.i);
  const arms=[];for(const arm of t.arms){rep.restore(t.i);const z=rep.act(arm.op),live=!rep.win(z)&&z.state===origin.state;
   const members=live?(await view(z)).get(t.actor):null,actual=members?.length===1?members[0]:null;
   arms.push({...arm,actual:actual?.p??null,exact:actual?.p.join()===arm.to.join(),shapeChanged:!!actual&&actual.shape!==t.shape,won:rep.win(z)});
  }
  rows.push({i:t.i,p:t.p,actor:t.actor,newSite:t.newSite,change:t.change,arms,both:arms.every(a=>a.exact)});
 }
 result.push({code:r.code,level:r.start,rows});
}
await writeFile(out,JSON.stringify(result));



