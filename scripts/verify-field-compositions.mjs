import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';

// Recompute each claimed relation from public pixels. The solver and its
// proposal/matching functions are not called by this replay.
const [mode,root,output,...files] = process.argv.slice(2);
assert.ok(['source','native'].includes(mode));
const engine = mode==='source' ? await sourceBackend(resolve(root)) :
  (await import(pathToFileURL(resolve(root,'src/runtime/native-game-dispatcher.ts')).href)).createGameDispatcher(()=>{throw Error('Unexpected backend');});
const results = [];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const patch = (rows,[x,y,r,b]) => rows.slice(y,b+1).map(row=>row.slice(x,r+1));
function status(board,site) {
  const p = patch(board.frame,site.box), values = new Set(p.flat()), value = p[0][0];
  return {value:values.size===1?value:null,ok:values.size===1 && site.equal.every(c=>c===value) && !site.different.includes(value)};
}
for (const file of files) {
  for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    assert.ok(!run.error && !run.resets && !run.observedPriorLevelActions && !run.sourcePrefixActions);
    const game=getGameByCode(run.code);
    assert.ok(mode==='source' ? game && game.group!=='custom_4' : /^SS(0[1-8]|10)$/.test(run.code));
    async function open() {
      if (mode==='source') return sourceReplay(engine,{},run).restore(0);
      let b=await engine.dispatch({type:'load',code:run.code,level:run.start});
      if (b.level!==run.start && b.canSelectLevel) b=await engine.dispatch({type:'selectLevel',level:run.start});
      return b;
    }
    const act=c=>engine.dispatch({type:'action',actionId:c.id,...(c.id===6?{data:c.data}:{})});
    const won=b=>b.levelsCompleted>run.initialCompleted || b.state==='WIN';
    let board=await open();
    assert.equal(hash(board),run.initial);
    const forecasts=[];
    for (const [i,c] of run.replayCommands.entries()) {
      const before=board,f=c.field;
      assert.equal(hash(before).slice(0,16),c.from);
      if (f) {
        assert.equal(c.id,6);
        const [l,t,r,b]=f.target.box;
        assert.deepEqual(c.data,{x:Math.floor((l+r)/2),y:Math.floor((t+b)/2)});
        assert.deepEqual(status(before,f.target),{value:f.before,ok:false});
        assert.deepEqual(f.held,f.obligations.filter(s=>status(before,s).ok));
      }
      board=await act(c);
      assert.equal(hash(board).slice(0,16),c.to);
      if (f) {
        const boundary=won(board);
        forecasts.push({step:i+1,origin:f.origin,cues:f.cues.length,examples:f.examples.length,sites:f.obligations.length,
          missing:f.obligations.length-f.held.length,won:boundary,matched:boundary?null:status(board,f.target).ok,
          kept:boundary?null:f.held.every(s=>status(board,s).ok),
          referenceKept:boundary?null:[...f.cues,...f.examples].every(box=>digest(patch(before.frame,box))===digest(patch(board.frame,box)))});
      }
    }
    assert.equal(won(board),run.levels[0].won);
    const final=hash(board),tape=run.replayCommands.map(c=>({id:c.id,...(c.id===6?{data:c.data}:{})}));
    let controls;
    if (won(board) && forecasts.length) {
      async function intervene(actions) {
        let b=await open(),used=0;
        for (const c of actions) {
          if (won(b) || b.state!=='NOT_FINISHED' || !b.availableActionIds.includes(c.id)) break;
          b=await act(c);used++;
        }
        return {won:won(b),used,final:hash(b).slice(0,16)};
      }
      const index=forecasts[0].step-1,f=run.replayCommands[index].field;
      const repeat=await intervene(tape);
      assert.ok(repeat.won && repeat.final===final.slice(0,16));
      const held=f.held[0]?.box;
      const replacement=held?{id:6,data:{x:Math.floor((held[0]+held[2])/2),y:Math.floor((held[1]+held[3])/2)}}:null;
      controls={repeat, omission:await intervene(tape.filter((_,n)=>n!==index)),
        replacement:replacement?await intervene(tape.with(index,replacement)):null};
    }
    results.push({code:run.code,level:run.start,actions:run.issued,won:run.levels[0].won,tape:digest(tape),
      initial:run.initial,final,forecasts,...(controls?{controls}:{})});
  }
}
await writeFile(output,JSON.stringify(results));
console.log('verified',results.length,'field commands',results.reduce((n,r)=>n+r.forecasts.length,0));
