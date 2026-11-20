import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {sourcePoseIndex} from './source-numbered-poses.mjs';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
const [env,dir,group,shard,out]=process.argv.slice(2),engine=await sourceBackend(resolve(env)),[ix,n]=shard.split('/').map(Number);
const fixed=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const files=group==='lower'?Array.from({length:8},(_,i)=>'source-final-'+i):['u2','u2entry','u3','u3entry','u4','u5'].map(s=>'cold12-'+s);
const allow=new Set(GAME_CATALOG.map(x=>x.code)),runs=[],result=[];
for(const f of files)for(const line of (await readFile(join(dir,f+'.jsonl'),'utf8')).trim().split('\n'))runs.push(JSON.parse(line));
for(const [j,r] of runs.entries()){
 if(j%n!==ix)continue;if(!allow.has(r.code))throw Error('Source only');
 const rep=sourceReplay(engine,fixed,r),read=sourcePoseIndex(),byFrame={},steps=[];
 const snapshot=async b=>{const key=hash(b).slice(0,16);if(!byFrame[key])byFrame[key]=(await read(b)).rows;};
 let b=rep.restore(0);
 for(const c of r.steps){
  if(!hash(b).startsWith(c.from))throw Error('Source prefix mismatch');await snapshot(b);
  const a=op(c),z=rep.act(a);if(!hash(z).startsWith(c.to))throw Error('Source output mismatch');
  const terminal=rep.win(z)||z.state!==b.state||z.level!==b.level;
  if(!terminal)await snapshot(z);
  steps.push([c.from,a,terminal?null:c.to,rep.win(z)]);b=z;if(terminal)break;
 }
 result.push({code:r.code,level:r.start,steps,frames:byFrame});
}
await writeFile(out,JSON.stringify(result));



