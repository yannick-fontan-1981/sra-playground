import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,op} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),game=getGameByCode(r.code);
  assert.ok(game&&game.group!=='custom_4');
  if(r.error||r.start!==r.finish||r.sourcePrefixActions||r.observedPriorLevelActions||r.resets)continue;
  const entry={code:r.code,level:r.start,won:r.levels[0].won};results.push(entry);
  if(!entry.won||r.issued<3)continue;
  const prefix=r.issued-3,word=r.steps.slice(prefix).map(op),symbols=[...new Set(word)];
  if(symbols.length===1)continue;
  const rep=sourceReplay(engine,{},r),cache=new Map();
  function test(actions){
    const id=actions.join('/');
    if(cache.has(id))return cache.get(id);
    let b=rep.restore(prefix),used=0;
    for(const action of actions){
      if(rep.win(b)||b.state!=='NOT_FINISHED'||!b.availableActionIds.includes(Number(action.split(':')[0].slice(6))))break;
      b=rep.act(action);used++;
    }
    const outcome={actions,won:rep.win(b),used};cache.set(id,outcome);return outcome;
  }
  assert.ok(test(word).won);
  const changes=new Map(),orders=new Map(),omissions=new Map();
  for(let k=0;k<3;k++){
    const q=word.filter((_,i)=>i!==k);omissions.set(q.join('/'),test(q));
    for(const symbol of symbols){
      if(symbol===word[k])continue;
      const v=word.with(k,symbol);changes.set(v.join('/'),test(v));
    }
    for(let j=0;j<3;j++){
      if(k===j)continue;
      const v=[word[k],word[j],word[3-k-j]];orders.set(v.join('/'),test(v));
    }
  }
  entry.prefix=prefix;entry.word=word;entry.orders=[...orders.values()];entry.omissions=[...omissions.values()];
  entry.substitutions=[...changes.values()];
  const shorter=[],otherCounts=[];
  for(const a of symbols){
    shorter.push(test([a]));
    for(const b of symbols){
      shorter.push(test([a,b]));
      for(const c of symbols){
        const q=[a,b,c];
        if(!orders.has(q.join('/')))otherCounts.push(test(q));
      }
    }
  }
  entry.shorter=shorter;entry.otherCounts=otherCounts;
}
await writeFile(output,JSON.stringify(results));console.log('qualified',results.filter(r=>r.orders).length,'of',results.length);
