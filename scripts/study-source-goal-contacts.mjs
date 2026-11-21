import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import {resolve} from 'node:path';
import {GAME_CATALOG,getGameByCode} from '../src/games/catalog.ts';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout,newPreviewLearning,observePreviewBindings} from '../src/sic/witnessed-preview-transfer.ts';
import {spatialControls,cellMatches} from '../src/sic/calibrate-spatial-controls.ts';
import {poseRole} from '../src/sic/occupancy-programs.ts';
import {contactDescriptors} from '../src/sic/source-contact-hypothesis.ts';
import {add} from '../src/sic/access-terrain.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay,hash,op} from './sic-study-source-replay.mjs';

// Learn only from the public state before the final score and comparable
// nonterminal steps. Geometry is relative to the measured motion unit.
function contactDescriptions(o,layout,memory,command) {
  const keys=new Set(), available=new Set(o.available_action_refs);
  const seen=new Map(o.entities.map(e=>[e.signature,e]));
  for(const [actor,motion] of Object.entries(memory.partMotion??{})) {
    const parts=layout[actor]??[], last=memory.lastActor[actor];
    const mover=parts.length===1?parts[0]:parts.find(p=>last && p.at[0]===last[0] && p.at[1]===last[1]);
    if(!mover) continue;
    const model=spatialControls(motion,available,'',{},o.frame_hash,actor);
    const stroke=model?.motors.find(m=>m.op===command && m.support>0);
    if(!stroke) continue;
    const arrival=add(mover.at,stroke.d);
    for(const [kind,others] of Object.entries(layout)) {
      if(kind===actor || others.length>12) continue;
      for(const target of others) {
        if(!cellMatches(arrival,target.at,model.pitch) || cellMatches(mover.at,target.at,model.pitch)) continue;
        const e=seen.get(target.form);
        if(!e || poseRole(e)!==kind) continue;
        const centered=Math.max(Math.abs(arrival[0]-target.at[0]),Math.abs(arrival[1]-target.at[1]))<=1;
        const mobile=Object.hasOwn(memory.partMotion??{},kind);
        for(const key of contactDescriptors(e,others.length,model.pitch[0]/2,centered,mobile)) keys.add(key);
      }
    }
  }
  return [...keys].sort();
}
const [env,out,...files]=process.argv.slice(2);
const engine=await sourceBackend(resolve(env));
const programs=JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const reserved=new Set(['hanoi_order',...GAME_CATALOG.filter(g=>g.group==='official').map(g=>g.family)]);
const levels=[];
for(const f of files) for(const line of (await readFile(f,'utf8')).trim().split(/\r?\n/)) {
  const r=JSON.parse(line), game=getGameByCode(r.code);
  assert.ok(game && game.group!=='custom_4');
  if(reserved.has(game.family)||r.error) continue;
  assert.ok(!r.resets && !r.observedPriorLevelActions && r.start===r.finish);
  const replay=sourceReplay(engine,programs,r),memory=newPreviewLearning(),questions=[];
  const project=(b,n)=>measureNativeObservation({frame_rows:b.frame,frame_hash:hash(b),level:b.level,levels_completed:b.levelsCompleted,
    state:b.state,available_action_refs:b.availableActionIds.map(v=>'ACTION'+v)},n,r.code);
  let board=replay.restore(0),before=await project(board,1),layout=visualLayout(before,board.frame);
  for(const [i,s] of r.steps.entries()) {
    assert.equal(hash(board).slice(0,16),s.from);
    const keys=contactDescriptions(before,layout,memory,op(s));
    const next=replay.act(op(s));
    assert.equal(hash(next).slice(0,16),s.to);
    const won=replay.win(next);
    if(keys.length||won) questions.push({at:i+1,keys,won});
    const after=await project(next,i+2),view=visualLayout(after,next.frame);
    observePreviewBindings(memory,before,after,layout,view,op(s));
    before=after;layout=view;board=next;
  }
  assert.equal(replay.win(board),r.levels[0].won);
  levels.push({code:r.code,family:game.family,level:r.start,actions:r.issued,won:r.levels[0].won,questions});
}
const rows=levels.flatMap(l=>l.questions.map(q=>({...q,family:l.family})));
const wins=rows.filter(q=>q.won);
const byKey=new Map();
for(const r of rows) for(const k of r.keys) {
  const t=byKey.get(k)??{win:new Set(),loss:new Set()};
  (r.won?t.win:t.loss).add(r.family);byKey.set(k,t);
}
const supported=[...byKey].filter(([,t])=>t.win.size>=2).map(([key,t])=>({key,winningFamilies:t.win.size,otherFamilies:t.loss.size})).sort((a,b)=>b.winningFamilies-a.winningFamilies);
let retained=0, falsePositive=0, eligible=0;
for (const l of levels) for (const q of l.questions) {
  const admitted=q.keys.some(key=>{
    const t=byKey.get(key),won=t.win.size-Number(t.win.has(l.family)),other=t.loss.size-Number(t.loss.has(l.family));
    return won>=2 && won>other;
  });
  if(admitted) {eligible++; if(q.won)retained++;else falsePositive++;}
}
const summary={levels:levels.length,officialWins:wins.length,terminalContacts:wins.filter(q=>q.keys.length).length,
  nonterminalContacts:rows.filter(q=>!q.won&&q.keys.length).length,sharedSignatures:supported.length,
  leaveFamilyOut:{eligible,scoreOnThisCommand:retained,withoutTerminalScore:falsePositive}};
await writeFile(out,JSON.stringify({summary,supported,levels},null,2)+'\n');
console.log(JSON.stringify(summary));
