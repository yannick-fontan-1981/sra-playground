import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay, hash, op} from './sic-study-source-replay.mjs';
const [env,oldFile,newFile]=process.argv.slice(2);
const [old,updated]=await Promise.all([oldFile,newFile].map(async f=>JSON.parse((await readFile(f,'utf8')).trim())));
assert.equal(old.initial,updated.initial);
assert.equal(old.initialCompleted,updated.initialCompleted);
assert.equal(old.start,updated.start);
const engine=await sourceBackend(resolve(env)),replay=sourceReplay(engine,{},updated);
const i=old.steps.findIndex((step,i)=>updated.steps[i] && op(step)!==op(updated.steps[i]));
assert.ok(i>=0);
const from=replay.restore(i);
assert.equal(hash(from).slice(0,16),old.steps[i].from);
const outcomes=[];
for(const [label,run] of [['v31',old],['v32',updated]]) for(const [other,choice] of [['v31',old],['v32',updated]]) {
  let b=replay.restore(i),issued=0;
  for(const step of [choice.steps[i],...run.steps.slice(i+1)]){
    if(b.level!==run.start || b.levelsCompleted!==run.initialCompleted || b.state!=='NOT_FINISHED')break;
    b=replay.act(op(step));issued++;
    if(label===other)assert.equal(hash(b).slice(0,16),step.to);
  }
  outcomes.push({actionFrom:other,suffixFrom:label,issuedAfterPrefix:issued,score:b.levelsCompleted-run.initialCompleted,state:b.state,final:hash(b)});
}
console.log(JSON.stringify({code:old.code,level:old.start,step:i+1,from:hash(from),old:op(old.steps[i]),updated:op(updated.steps[i]),outcomes}));
