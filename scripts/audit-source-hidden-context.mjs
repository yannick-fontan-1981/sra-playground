import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GAME_CATALOG, getGameByCode } from '../src/games/catalog.ts';
import { op } from './sic-study-source-replay.mjs';
import { contextsFor, evaluateAmbiguity } from './source-history-predictions.mjs';

const [output,...files] = process.argv.slice(2);
const excluded = new Set(['hanoi_order', ...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const entries=[];
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line), entry=getGameByCode(r.code);
  assert.ok(entry && entry.group!=='custom_4');
  if (excluded.has(entry.family) || r.error) continue;
  const byQuestion=new Map(), history=[];
  let repeated=0, ambiguous=0, firstContradiction=0;
  const models={};
  for (const [i,s] of r.steps.entries()) {
    if (i>0) assert.equal(r.steps[i-1].to,s.from);
    const question=s.from+'/'+op(s), prior=byQuestion.get(question)??[];
    const contexts=contextsFor(i,history.at(-1),history.at(-2));
    if (prior.length) {
      repeated++;
      if (!prior.some(item=>item.next===s.to)) firstContradiction++;
      if (evaluateAmbiguity(prior,{contexts,next:s.to},models)) ambiguous++;
    }
    prior.push({contexts,next:s.to}); byQuestion.set(question,prior);
    history.push({source:s.from,op:op(s)});
  }
  entries.push({code:r.code,level:r.start,steps:r.issued,repeated,ambiguous,firstContradiction,models});
}
const sum=key=>entries.reduce((s,e)=>s+e[key],0);
const models={};
for (const e of entries) for (const [name,counts] of Object.entries(e.models)) {
  const target=models[name]??={};
  for (const [key,n] of Object.entries(counts)) target[key]=(target[key]??0)+n;
}
const summary={entries:entries.length,steps:sum('steps'),repeated:sum('repeated'),
  queriesWithKnownAmbiguity:sum('ambiguous'),novelOutcomesOnRepeat:sum('firstContradiction'),models};
await writeFile(output,JSON.stringify({summary,entries},null,2)+'\n');
console.log(JSON.stringify(summary));
