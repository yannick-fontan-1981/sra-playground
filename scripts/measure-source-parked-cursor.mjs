import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {newCursorMemory,offerCursorTrial,recordCursorTrial} from '../src/sic/marked-cursor-selection.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {hash,op,sourceReplay} from './sic-study-source-replay.mjs';

const [env,out,...files]=process.argv.slice(2),engine=await sourceBackend(resolve(env));
const held=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const episodes=[];
function spriteMoved(rows,next,box,ink){
  for(let y=box[1];y<=box[3];y++)for(let x=box[0];x<=box[2];x++)
    if(rows[y]?.[x]===ink && next[y]?.[x]!==ink)return true;
  return false;
}
for(const file of files)for(const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)){
  const r=JSON.parse(line),g=getGameByCode(r.code);assert.ok(g&&g.group!=='custom_4');
  if(r.error||held.has(g.family))continue;
  assert.ok(!r.resets&&!r.observedPriorLevelActions&&!r.sourcePrefixActions&&r.start===r.finish);
  if(!r.steps.some(s=>s.a===6)||!r.steps.some(s=>s.a>=1 && s.a<=4))continue;
  const rep=sourceReplay(engine,{},r),memory=newCursorMemory(),witnesses=[],forks=[],states=new Map();
  async function observe(board){
    const key=hash(board);
    if(!states.has(key))states.set(key,await measureNativeObservation({frame_rows:board.frame,frame_hash:key,
      level:board.level,levels_completed:board.levelsCompleted,state:board.state,
      available_action_refs:board.availableActionIds.map(a=>'ACTION'+a),palette:board.palette},states.size,'source'));
    return states.get(key);
  }
  let b=rep.restore(0),o=await observe(b),lastSwitch;
  for(const [i,s] of r.steps.entries()){
    const n=rep.act(op(s));assert.equal(hash(n).slice(0,16),s.to);
    if(!rep.win(n)&&n.state==='NOT_FINISHED'){
      const a=await observe(n);
      // Score the actual selected point, including choices initiated by another family.
      const proposed=s.a===6?offerCursorTrial(memory,o,b.frame,true):null;
      const t=proposed?.command===op(s)?proposed:undefined;
      const result=recordCursorTrial(memory,o,a,b.frame,n.frame,op(s),t);
      if(result==='cursor_mark_transferred'&&memory.pending)lastSwitch={i,trial:memory.pending};
      if(result==='new_cursor_moved_while_previous_cursor_stayed'&&lastSwitch){
        witnesses.push({...lastSwitch,verified:i});lastSwitch=undefined;
      }
      if(result==='cursor_control_unconfirmed')lastSwitch=undefined;
      o=a;
    }
    b=n;
  }
  assert.equal(rep.win(b),r.levels[0].won);
  const alive=b=>!rep.win(b)&&b.state==='NOT_FINISHED';
  for(const {i,trial,verified} of witnesses){
    // Insert one ordinary movement before selecting the other cursor. Preserve
    // the original action cap, selection coordinate and subsequent commands.
    const initial=rep.restore(i);
    const marked=(b,part)=>trial.offsets.every(([x,y])=>b.frame[y+part.box[1]]?.[x+part.box[0]]===trial.ink);
    function continueAfterSelection(at){
      let used=i+2;
      for(const s of r.steps.slice(i+1)){
        if(used>=r.cap||!alive(at))break;
        if(!at.availableActionIds.includes(s.a))return {used,score:null};
        at=rep.act(op(s));used++;
      }
      return {used,score:Number(rep.win(at))};
    }
    let stationary=null;
    for(const action of initial.availableActionIds.filter(a=>a>=1&&a<=5)){
      rep.restore(i);const idle=rep.act('ACTION'+action);
      if(!alive(idle)||hash(idle)!==hash(initial)||!idle.availableActionIds.includes(6))continue;
      const selected=rep.act(op(r.steps[i]));
      if(!alive(selected)||!marked(selected,trial.target))continue;
      stationary={action,...continueAfterSelection(selected)};break;
    }
    for(const action of initial.availableActionIds.filter(a=>a>=1&&a<=4)){
      rep.restore(i);
      let at=rep.act('ACTION'+action);
      if(!alive(at)||!spriteMoved(initial.frame,at.frame,trial.source.box,trial.source.ink)||marked(at,trial.target))continue;
      if(!at.availableActionIds.includes(6))continue;
      at=rep.act(op(r.steps[i]));
      if(!alive(at)||!marked(at,trial.target))continue;
      forks.push({switchAt:i+1,verifiedAt:verified+1,input:action,...continueAfterSelection(at),stationary});
    }
  }
  episodes.push({code:r.code,level:r.start,won:r.levels[0].won,switches:witnesses.length,forks});
}
const branches=episodes.flatMap(e=>e.forks);
const summary={episodes:episodes.length,confirmedSwitches:episodes.reduce((n,e)=>n+e.switches,0),branches:branches.length,
  changedWinningScores:episodes.filter(e=>e.won).flatMap(e=>e.forks).filter(f=>f.score===0).length,
  converted:episodes.filter(e=>!e.won&&e.forks.some(f=>f.score===1)).map(e=>[e.code,e.level])};
await writeFile(out,JSON.stringify({summary,episodes}));console.log(JSON.stringify(summary));
