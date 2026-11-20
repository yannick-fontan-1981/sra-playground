import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash, op, sourceReplay} from './sic-study-source-replay.mjs';

export function compareUseScores(engine,run) {
const replay=sourceReplay(engine,{},run),results=[];
assert.ok(run.levels[0].won);
for(const [i,c] of run.replayCommands.entries()){
  const p=c.localCapacity;
  if(p?.stage!=='use')continue;
  const before=replay.restore(i);
  assert.equal(hash(before).slice(0,16),c.from);
  const choices=[...new Set([p.c,...before.availableActionIds.filter(id=>id!==6&&id!==7).map(id=>'ACTION'+id),...run.steps.slice(0,i).filter(s=>s.a===6).map(op)])];
  const resultsFromState=[];
  for(const k of [null,...choices]){
    let b=replay.restore(i),issued=0;
    for(const action of [...(k?[k]:[]),...run.steps.slice(i+1).map(op)]){
      if(replay.win(b)||b.state!=='NOT_FINISHED')break;
      b=replay.act(action);issued++;
    }
    if(k===p.c)assert.ok(replay.win(b));
    resultsFromState.push({op:k,score:b.levelsCompleted-run.initialCompleted,issued,final:hash(b).slice(0,16)});
  }
  results.push({i:i+1,from:c.from,planned:p.c,site:p.siteC,outcomes:resultsFromState});
}
return {code:run.code,level:run.start,prior:run.observedPriorLevelActions??0,actions:run.issued,results};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
const [env,file,lessonFile]=process.argv.slice(2);
const read=async f=>JSON.parse((await readFile(f,'utf8')).trim());
const run=await read(file);
if(lessonFile){
  const lesson=await read(lessonFile);
  assert.equal(lesson.code,run.code);
  run.publicLesson=lesson.commands;
  run.lessonEndLevel=lesson.endLevel;
}
console.log(JSON.stringify(compareUseScores(await sourceBackend(resolve(env)),run)));
}
