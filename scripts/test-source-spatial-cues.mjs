import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {sourcePoseIndex} from './source-numbered-poses.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
const [env,dir,selection,shard,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),[ix,n]=shard.split('/').map(Number);
const defs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8')),allow=new Set(GAME_CATALOG.map(x=>x.code)),runs=new Map(),report=[];
for(const f of [...Array.from({length:8},(_,i)=>'source-final-'+i),...['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s)])for(const l of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n')){const r=JSON.parse(l);runs.set(r.code+'/'+r.start,r);}
const eq=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
const pos=(g,k)=>g?.get(k)?.length===1?g.get(k)[0].p:null;
for(const [j,r0] of JSON.parse(await readFile(selection,'utf8')).entries()){
 if(j%n!==ix)continue;if(!allow.has(r0.code))throw Error('Source only');
 const r=runs.get(r0.code+'/'+r0.level),rep=sourceReplay(engine,defs,r),read=sourcePoseIndex(),rows=[];
 if(r0.tickets.length){
  let b=rep.restore(0); const max=Math.max(...r0.tickets.map(t=>t.i));
  for(let i=0;i<=max;i++){await read(b);if(i<max)b=rep.act(op(r.steps[i]));}
 }
 for(const t of r0.tickets){
  const root=rep.restore(t.i),original=(await read(root)).groups;
  if(!hash(root).startsWith(t.root)||!eq(pos(original,t.p),t.from)||!eq(pos(original,t.r),t.to))throw Error('Cue identity mismatch');
  const keys=root.availableActionIds.flatMap(n=>n===6?[...new Set(r.steps.slice(0,t.i).map(op).filter(x=>x.startsWith('ACTION6:')).reverse())].slice(0,2):['ACTION'+n]);
  const returns=[];for(const q of keys){
   rep.restore(t.i);const z=rep.act(q),won=rep.win(z),live=!won&&z.state===root.state;
   const obs=live?(await read(z)).groups:null,p=pos(obs,t.p),mark=pos(obs,t.r);
   returns.push({q,affected:p&&!eq(p,t.from),arrival:eq(p,t.to)===true,won,p,mark,suggested:q===t.suggested,motor:t.motor.includes(q)});
  }
  const hits=returns.filter(o=>o.arrival),uses=[];
  for(const h of hits)for(const v of keys){
   rep.restore(t.i);const z=rep.act(h.q);
   if(!z.availableActionIds.includes(Number(v.slice(6).split(':')[0])))continue;
   const after=rep.act(v),won=rep.win(after),live=!won&&after.state===root.state;
   const end=live?pos((await read(after)).groups,t.p):null,without=returns.find(q=>q.q===v);
   if(won||end&&!eq(end,t.to)&&!eq(end,t.from)&&!eq(end,without?.p))uses.push({trigger:h.q,follow:v,end,won,direct:without?.p,directWon:without?.won});
  }
  rows.push({i:t.i,p:t.from,cue:t.to,motor:t.motor,newCue:t.newCue,suggested:t.suggested,hits,uses,available:keys.length,atLeastOneControl:returns.some(x=>!x.arrival&&x.p),checks:returns.length});
 }
 report.push({code:r.code,level:r.start,rows});
}
await writeFile(out,JSON.stringify(report));

