import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

const [environment,output,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(environment)),results=[];
const key=(a,b)=>[a,b].sort().join('/');
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  if(r.error||r.start!==r.finish||r.resets||r.sourcePrefixActions||r.observedPriorLevelActions)continue;
  const rep=sourceReplay(engine,{},r),samples=new Map(),audits=[];
  const live=b=>b.state==='NOT_FINISHED'&&!rep.win(b);
  // The fixed prefixes and eligible commands are determined without access to
  // the terminal program. Two actions must change the image in both orders.
  for(const i of [0,4,8]){
    if(i+2>=r.steps.length-3)continue;
    const root=rep.restore(i),initial=hash(root),prior=r.steps.slice(0,i);
    const clicks=[...new Set(prior.filter(s=>s.a===6).map(op).reverse())].slice(0,3);
    const actions=root.availableActionIds.flatMap(n=>n===6?clicks:['ACTION'+n]);
    const returns=new Map();
    for(const a of actions)for(const b of actions){
      if(a===b)continue;
      rep.restore(i);const first=rep.act(a);
      if(!live(first)||!first.availableActionIds.includes(Number(b.split(':')[0].slice(6))))continue;
      const h=hash(first);if(h===initial)continue;
      const last=rep.act(b);if(!live(last))continue;
      const end=hash(last);if(end!==h)returns.set(a+'/'+b,end);
    }
    let judged=0;
    for(const a of actions)for(const b of actions){
      if(a>=b)continue;
      const ab=returns.get(a+'/'+b),ba=returns.get(b+'/'+a);
      if(!ab||!ba)continue;
      const id=key(a,b),s=samples.get(id)??{same:0,different:0};
      if(ab===ba)s.same++;else s.different++;
      samples.set(id,s);judged++;
    }
    audits.push({prefix:i,inputs:actions.length,pairs:judged});
  }
  const word=r.steps.slice(-3).map(op),members=[...new Set(word)],pairs=[];
  for(const a of members)for(const b of members){
    if(a<b)pairs.push({a,b,...(samples.get(key(a,b))??{same:0,different:0})});
  }
  const prediction=pairs.length&&pairs.every(p=>p.same&&!p.different)?'all_orders':
    pairs.some(p=>p.different&&!p.same)?'order_matters':'unresolved';
  results.push({code:r.code,level:r.start,won:r.levels[0].won,word,prediction,pairs,audits});
}
await writeFile(output,JSON.stringify(results));console.log('episodes',results.length);
