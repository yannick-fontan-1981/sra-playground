import {createInterface} from 'node:readline';
import {existsSync} from 'node:fs';
import {assessHypothesisPartition} from './src/sic/discriminating-experiment.ts';
const typed=existsSync(new URL('./src/sic/subset-query.ts',import.meta.url));
const api=typed?await import('./src/sic/subset-query.ts'):await import('./ordre-gel.mjs');
for await(const line of createInterface({input:process.stdin})){
  const {members,queries}=JSON.parse(line);
  const offers=queries.map(q=>{
    const global=members.filter(k=>q.tested.includes(k)).length,local=members.length-global;
    const split=typed?api.subsetQuerySplit(global,members.length):{global,local,remaining:assessHypothesisPartition([global,local]).remaining};
    return {...q,kind:'scope',controlShape:null,...split};
  });
  let winner;
  if(typed)winner=api.selectSubsetQuery(offers);
  else{
    const tuples=offers.map(o=>[o.remaining,0,o.tested,o.command,null]);
    const best=api.select(tuples);winner=offers.find(o=>o.command===best[3]);
  }
  console.log(JSON.stringify({offers,winner}));
}
