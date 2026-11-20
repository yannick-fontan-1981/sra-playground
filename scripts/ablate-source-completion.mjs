import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
const [env,file,code,output]=process.argv.slice(2);
if(!GAME_CATALOG.some(g=>g.code===code))throw Error('Source only');
const rows=(await readFile(file,'utf8')).trim().split('\n').map(JSON.parse),r=rows.find(x=>x.code===code);
if(!r?.levels[0].won)throw Error('Expected official native win');
const event=r.preparation.findLast(e=>e.transport?.won||e.frame?.won);if(!event)throw Error('No winning composed experiment');
const end=event.actionIndex,begin=end-(event.frame?.trial.step??event.transport.index)-1,word=r.steps.slice(begin,end).map(op);
if(!word.length||word.length>11)throw Error('Expected a bounded native experiment');
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const rep=sourceReplay(await sourceBackend(resolve(env)),programs,r),origin=hash(rep.restore(begin)),winning=[];
for(let mask=0;mask<2**word.length;mask++){
  let b=rep.restore(begin);if(hash(b)!==origin)throw Error('Divergent public prefix');
  for(let j=0;j<word.length;j++)if((mask>>j)&1){
    if(rep.win(b)||b.state==='GAME_OVER'||!b.availableActionIds.includes(Number(word[j].slice(6).split(':')[0])))break;
    b=rep.act(word[j]);
  }
  if(rep.win(b))winning.push(mask);
}
const complete=2**word.length-1;if(!winning.includes(complete))throw Error('Official win failed to reproduce');
const bits=m=>word.map((_,i)=>i).filter(i=>(m>>i)&1);
const minimum=Math.min(...winning.map(m=>bits(m).length));
await writeFile(output,JSON.stringify({code,level:r.start,begin:begin+1,end,origin,word,subsets:complete+1,winning:winning.length,minimum,
  minimalPrograms:winning.filter(m=>bits(m).length===minimum).map(m=>bits(m)),necessaryPositions:bits(complete).filter(i=>winning.every(m=>(m>>i)&1)),
  singleDeletionWins:bits(complete).filter(i=>winning.includes(complete^(1<<i)))}));
