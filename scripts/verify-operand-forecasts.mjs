import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash} from './sic-study-source-replay.mjs';

const [mode,root,output,...files]=process.argv.slice(2);
assert.ok(['source','native'].includes(mode));
const engine=mode==='source'?await sourceBackend(resolve(root)):
  (await import(pathToFileURL(resolve(root,'src/runtime/native-game-dispatcher.ts')).href))
    .createGameDispatcher(()=>{throw Error('Unexpected backend');});
const patch=(rows,b)=>rows.slice(b[1],b[3]+1).map(row=>row.slice(b[0],b[2]+1).join(',')).join('/');
const results=[];
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line);assert.ok(!r.error&&!r.resets&&!r.observedPriorLevelActions&&!r.sourcePrefixActions);
  assert.ok(mode==='source'?getGameByCode(r.code)?.group!=='custom_4':/^SS(0[1-8]|10)$/.test(r.code));
  let board;
  if(mode==='source')board=sourceReplay(engine,{},r).restore(0);
  else{
    board=await engine.dispatch({type:'load',code:r.code,level:r.start});
    if(board.level!==r.start&&board.canSelectLevel)board=await engine.dispatch({type:'selectLevel',level:r.start});
  }
  assert.equal(hash(board),r.initial);const forecasts=[];
  for(const [i,c] of r.replayCommands.entries()){
    assert.equal(hash(board).slice(0,16),c.from);
    const before=board,f=c.operand;
    if(f){
      assert.equal(patch(before.frame,f.target),f.before);
      assert.ok(f.kept.length&&f.kept.every(b=>patch(before.frame,b)===f.after));
      assert.equal(f.word[f.index],'ACTION'+c.id+(c.id===6?':'+c.data.x+','+c.data.y:''));
    }
    board=await engine.dispatch({type:'action',actionId:c.id,...(c.id===6?{data:c.data}:{})});
    assert.equal(hash(board).slice(0,16),c.to);
    if(!f)continue;
    const won=board.state==='WIN'||board.levelsCompleted>before.levelsCompleted;
    const kept=!won&&f.kept.every(b=>patch(board.frame,b)===f.after);
    let changed=!won&&patch(board.frame,f.target)===f.after;
    if(f.at&&!won){
      const o=await measureNativeObservation({frame_rows:board.frame,frame_hash:await publicFrameHash(board.frame),
        level:board.level,levels_completed:board.levelsCompleted,state:board.state,available_action_refs:board.availableActionIds.map(n=>'ACTION'+n)},i+1,'forecast-check');
      const actor=o.entities.filter(e=>e.signature===f.actor);
      changed=actor.length===1&&[0,1].every(k=>(actor[0].bbox[k]+actor[0].bbox[k+2])/2===f.at[k]);
    }
    forecasts.push({step:i+1,input:f.word[f.index],scope:f.at?'position':'effect',sites:f.kept.length,
      compared:f.correspondence>0,won,kept:won?null:kept,matched:won?null:changed});
  }
  const won=board.state==='WIN'||board.levelsCompleted>r.initialCompleted;assert.equal(won,r.levels[0].won);
  results.push({code:r.code,level:r.start,won,actions:r.issued,forecasts});
}
await writeFile(output,JSON.stringify(results));console.log('verified',results.length,'forecasts',results.reduce((n,r)=>n+r.forecasts.length,0));
