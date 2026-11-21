import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';
import {newConfigurationMemory,nextConfiguration,observeConfiguration} from '../src/sic/configuration-trials.ts';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const reserved=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const entries=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);assert.ok(game && game.group!=='custom_4');
  if(r.error||reserved.has(game.family))continue;
  assert.ok(!r.resets&&!r.observedPriorLevelActions&&r.start===r.finish);
  const replay=sourceReplay(engine,programs,r),memory=newConfigurationMemory(),seen=new Set(),experiments=[];
  let b=replay.restore(0);
  for(const [i,s] of r.steps.entries()){
    const options=b.availableActionIds.map(id=>'ACTION'+id);
    const choice=nextConfiguration(memory,b.frame,options);
    const key=JSON.stringify(memory.factors.map(f=>f.action));
    if(choice&&!seen.has(key)){
      seen.add(key);
      const local=structuredClone(memory),commands=[];
      let board=b, proposed=choice;
      while(proposed && i+commands.length<r.cap && !replay.win(board) && board.state==='NOT_FINISHED'){
        const next=replay.act(proposed.action);
        commands.push(proposed.action);
        if(!replay.win(next)&&next.state==='NOT_FINISHED')
          observeConfiguration(local,board.frame,next.frame,proposed.action,'fork/'+commands.length,proposed);
        board=next;
        proposed=nextConfiguration(local,board.frame,board.availableActionIds.map(id=>'ACTION'+id));
        if(commands.length>=2**local.factors.length*2)break;
      }
      experiments.push({at:i+1,factors:memory.factors.length,commands,won:replay.win(board)});
      b=replay.restore(i);
    }
    const next=replay.act(op(s));assert.equal(hash(b).slice(0,16),s.from);assert.equal(hash(next).slice(0,16),s.to);
    if(!replay.win(next) && next.state==='NOT_FINISHED')observeConfiguration(memory,b.frame,next.frame,op(s),'step/'+i);
    b=next;
  }
  assert.equal(replay.win(b),r.levels[0].won);
  entries.push({code:r.code,level:r.start,originalWon:r.levels[0].won,factors:memory.factors.length,experiments});
}
const summary={entries:entries.length,episodesWithTrials:entries.filter(e=>e.experiments.length).length,
  officialWins:entries.flatMap(e=>e.experiments).filter(t=>t.won).length,
  newWins:entries.filter(e=>!e.originalWon&&e.experiments.some(t=>t.won)).map(e=>[e.code,e.level])};
await writeFile(out,JSON.stringify({summary,entries},null,2)+'\n');console.log(JSON.stringify(summary));
