import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash} from './sic-study-source-replay.mjs';
import {observedRewrite} from '../src/sic/rewrite-composition.ts';

const [mode,environment,out,...files]=process.argv.slice(2);assert.ok(['source','native'].includes(mode));
let legacy;
const open=async()=>mode==='source'?(legacy??=await sourceBackend(resolve(environment))):
  (await import(pathToFileURL(resolve(environment,'src/runtime/native-game-dispatcher.ts')).href)).createGameDispatcher(()=>{throw Error('Unexpected fallback');});
const rows=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const run=JSON.parse(line);assert.ok(!run.error&&!run.resets&&!run.sourcePrefixActions&&!run.observedPriorLevelActions&&run.start===run.finish);
  assert.notEqual(run.code,'SS09');
  const engine=await open();let board=await engine.dispatch({type:'load',code:run.code,level:run.start});
  if(board.level!==run.start&&board.canSelectLevel)board=await engine.dispatch({type:'selectLevel',level:run.start});
  assert.equal(hash(board),run.initial);
  const past=[],trials=[];let active;
  for(const [i,cmd] of run.replayCommands.entries()){
    assert.equal(hash(board).slice(0,16),cmd.from);
    const next=await engine.dispatch({type:'action',actionId:cmd.id,...(cmd.id===6?{data:cmd.data}:{})});
    assert.equal(hash(next).slice(0,16),cmd.to);
    const changed=[],w=board.frame[0].length,op='ACTION'+cmd.id+(cmd.id===6?':'+cmd.data.x+','+cmd.data.y:'');
    let count=0;
    for(let y=0;y<board.frame.length;y++)for(let x=0;x<w;x++)if(board.frame[y][x]!==next.frame[y][x]){
      count++;if(count<=192)changed.push([y*w+x,board.frame[y][x],next.frame[y][x]]);
    }
    const p=cmd.composition;
    if(p){
      assert.equal(p.word[p.stage],op);assert.equal(p.word.length,p.sources.length);
      for(const n of p.sources)assert.ok(n>0&&n<=i,'Forecast uses a future observation');
      const source=past[p.sources[p.stage]-1];assert.equal(source.op,op);
      assert.equal(source.changes.length,p.changes);
      if(p.stage===0){
        assert.ok(p.origin.length===16||p.origin.length===64);
        assert.equal(hash(board).slice(0,p.origin.length),p.origin);
        active={at:i+1,word:p.word,sources:p.sources,checks:[]};trials.push(active);
      }
      assert.ok(active&&active.checks.length===p.stage);assert.deepEqual(active.word,p.word);assert.deepEqual(active.sources,p.sources);
      const boundary=next.levelsCompleted>board.levelsCompleted||next.state==='WIN';
      const matched=!boundary&&observedRewrite(source,board.frame,next.frame);
      active.checks.push(boundary?'score':matched?'matched':'refuted');
      if(!matched||p.stage+1===p.word.length)active=null;
    }else active=null;
    past.push({op,changes:count<=192?changed:[]});board=next;
  }
  const won=board.levelsCompleted>run.initialCompleted||board.state==='WIN';assert.equal(won,run.levels[0].won);
  rows.push({code:run.code,level:run.start,won,actions:run.issued,trials});
}
await writeFile(out,JSON.stringify(rows));console.log(rows.length,rows.reduce((n,r)=>n+r.trials.length,0));
