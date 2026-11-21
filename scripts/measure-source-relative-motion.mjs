import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {observeTravel} from '../src/sic/observed-travel-frontier.ts';
import {choosePairExperiment,newPairMemory,observePair,pairContacts} from './source-relative-motion.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';

const [environment,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(environment));
const held=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const episodes=[];
const cmd=key=>({action_ref:key.split(':')[0],data:key.includes(':')?
  Object.fromEntries(key.split(':')[1].split(',').map((n,i)=>[i?'y':'x',Number(n)])):{}});
function perceive(m,travel,b,n,input,ref,trial) {
  const after=observeTravel(travel,b.frame,n.frame,cmd(input),ref);
  observePair(m,travel,after,b.frame,n.frame,input,ref,trial);
  return after;
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g && g.group!=='custom_4');
  if(r.error||held.has(g.family))continue;
  assert.ok(!r.resets&&!r.observedPriorLevelActions&&!r.sourcePrefixActions&&r.start===r.finish);
  const replay=sourceReplay(engine,{},r),memory=newPairMemory(),tested=new Set(),forks=[];
  let board=replay.restore(0),travel,forecastable=0,unambiguous=0;
  for(const [i,s] of r.steps.entries()){
    const turn=choosePairExperiment(memory,travel,board.frame),contacts=pairContacts(memory,travel,board.frame);
    if(turn)forecastable++;
    if(memory.pair?.laws.length===1)unambiguous++;
    for(const initial of (turn?[turn]:contacts.slice(0,4))){
      const key=[memory.pair.body,memory.pair.laws.join(),initial.targetBody??initial.input].join('/');
      if(tested.has(key)||tested.size>=10)continue;
      tested.add(key);
      let current=replay.restore(i),t=structuredClone(travel),p=initial,expected=0,verified=0;
      const m=structuredClone(memory),issued=[];
      while(p && issued.length<Math.min(40,r.cap-i)){
        const next=replay.act(p.input);
        issued.push(p.input);
        if(replay.win(next)||next.state!=='NOT_FINISHED'){current=next;break;}
        const previousPeer=m.pair?.position,subject=t?.actor;
        t=perceive(m,t,current,next,p.input,'fork/'+issued.length,p);
        if(m.pair && t?.actor!==subject && m.pair.position!==previousPeer){
          expected++;verified+=Number(Object.values(p.destinations).includes(m.pair.position));
        }
        current=next;
        const routes=pairContacts(m,t,current.frame);
        p=choosePairExperiment(m,t,current.frame)??routes.find(v=>v.target===initial.target)??routes[0];
      }
      forks.push({prefix:i,turn:!!turn,initialLaws:memory.pair.laws,finalLaws:m.pair?.laws??[],
        target:initial.target??null,issued,expected,verified,won:replay.win(current)});
    }
    if(turn||contacts.length)board=replay.restore(i);
    const n=replay.act(op(s));assert.equal(hash(n).slice(0,16),s.to);
    if(n.state==='NOT_FINISHED'&&!replay.win(n))travel=perceive(memory,travel,board,n,op(s),'source/'+(i+1));
    board=n;
  }
  assert.equal(replay.win(board),r.levels[0].won);
  episodes.push({code:r.code,level:r.start,won:replay.win(board),forecastable,unambiguous,forks});
}
const all=episodes.flatMap(e=>e.forks);
const summary={episodes:episodes.length,withExperiments:episodes.filter(e=>e.forks.length).length,forks:all.length,
  completed:all.filter(f=>f.won).length,conversions:episodes.filter(e=>!e.won&&e.forks.some(f=>f.won)).map(e=>[e.code,e.level])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(summary);
