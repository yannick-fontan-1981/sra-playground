import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [environment,output,type,experiment,...files]=process.argv.slice(2);
assert.ok(['coordinates','operands'].includes(type));
const engine=await sourceBackend(resolve(environment)),rows=JSON.parse(await readFile(experiment,'utf8')),results=[];
const parse=q=>Number(q.split(':')[0].slice(6));
function preparations(row){
  if(type==='coordinates')return row.groups.flatMap(group=>group.tests.filter(t=>t.reason==='arrived'&&t.matched>=2)
    .map(t=>({prefix:group.prefix,word:t.used,target:t.goal.map(v=>Math.floor(v/2)),rank:t.rank,kind:'arrived'})));
  const items=[];
  for(const b of row.branches){
    const word=[];
    for(const t of b.trials){
      word.push(...t.word.slice(0,t.executed));
      if(t.result?.changed&&t.result.kept)items.push({prefix:b.prefix,word:[...word],
        target:[0,1].map(i=>Math.floor((t.target[i]+t.target[i+2])/2)),rank:null,kind:t.kind});
    }
  }
  return items;
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  const rowsForRun=rows.find(z=>z.code===r.code&&z.level===r.start);
  if(!rowsForRun||r.error||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},r),seen=new Set(),experiments=[];
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  for(const prep of preparations(rowsForRun)){
    if(experiments.length>=8||prep.prefix+prep.word.length>=r.cap)continue;
    const root=rep.restore(prep.prefix),history=r.steps.slice(0,prep.prefix).map(op);
    function apply(prefix,word){
      let b=rep.restore(prep.prefix),used=0;
      for(const cmd of prefix){
        if(!live(b)||!b.availableActionIds.includes(parse(cmd)))return null;
        b=rep.act(cmd);
      }
      if(!live(b))return null;
      const origin=hash(b);
      for(const cmd of word){
        if(!live(b)||!b.availableActionIds.includes(parse(cmd))||prep.prefix+prefix.length+used>=r.cap)break;
        b=rep.act(cmd);used++;
      }
      return {used,won:rep.win(b),changed:hash(b)!==origin,image:hash(b).slice(0,16),lost:b.state==='GAME_OVER'};
    }
    let placed=root;for(const q of prep.word){assert.ok(live(placed));placed=rep.act(q);}
    assert.ok(live(placed));
    const label=[hash(placed),prep.target,prep.prefix].join('/');if(seen.has(label))continue;seen.add(label);
    const click='ACTION6:'+prep.target.join(','),pastClicks=[...new Set([...history,...prep.word].filter(q=>parse(q)===6).reverse())].slice(0,3);
    const simple=[...new Set(placed.availableActionIds.flatMap(n=>n===6?[click,...pastClicks]:['ACTION'+n]))];
    const words=simple.map(q=>[q]),pairIds=new Set();
    for(let i=history.length-1;i>0&&pairIds.size<4;i--){
      const pair=history.slice(i-1,i+1),k=pair.join('/');
      if(!pairIds.has(k)&&pair.every(q=>placed.availableActionIds.includes(parse(q)))){words.push(pair);pairIds.add(k);}
    }
    const measured=[];
    for(const word of words){
      if(prep.prefix+prep.word.length+word.length>r.cap)continue;
      const after=apply(prep.word,word),before=apply([],word),short=apply(prep.word.slice(0,-1),word);
      assert.ok(after&&before&&short);
      const opened=after.changed&&!before.changed&&!short.changed&&!after.lost&&after.used===word.length;
      if(after.won||opened){
        const reference=r.steps.slice(prep.prefix,prep.prefix+prep.word.length).map(op);
        const replaced=reference.length===prep.word.length?apply(reference,word):null;
        measured.push({word,after,before,short,replaced,opened});
      }
    }
    experiments.push({prefix:prep.prefix,preparation:prep.word,target:prep.target,rank:prep.rank,kind:prep.kind,usesTested:words.filter(w=>prep.prefix+prep.word.length+w.length<=r.cap).length,measured});
  }
  results.push({code:r.code,level:r.start,baselineWon:r.levels[0].won,experiments});
}
await writeFile(output,JSON.stringify(results));console.log('preparations',results.reduce((s,r)=>s+r.experiments.length,0));
