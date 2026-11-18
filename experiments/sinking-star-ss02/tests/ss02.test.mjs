import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileLevel,initialState,stepWorld,planPush,transitionFrames,doorsOpen,renderWorld,PushPuzzleSession,GRID,PALETTE,equal,offset,contains} from '../dist/core.js';
import {SS02_LEVELS} from '../dist/levels.js';
import {reachable} from '../scripts/solver.mjs';
const witnesses=JSON.parse(readFileSync(new URL('witnesses.json',import.meta.url)));
const source=JSON.parse(readFileSync(new URL('../reference/hauling-grids.json',import.meta.url)));
const fixture=(rows,facing='E')=>compileLevel({id:'TEST',title:'Fixture',rows,facing});
const tile=(frame,p)=>frame.slice(2+p.y*3,5+p.y*3).map(row=>row.slice(2+p.x*3,5+p.x*3));
const key=p=>p.y*20+p.x;

test('strict 20×20 logical grid, 3×3 cells, 64×64 canvas and agreed palette',()=>{
 assert.deepEqual(GRID,{cells:20,cellPx:3,originPx:2,canvasPx:64});assert.equal(PALETTE.length,16);
 assert.equal(PALETTE[8],'#ef4141');assert.equal(PALETTE[15],'#9e6bdb');
});
for(const n of [1,2,3,7])test(`atomic file of ${n} stones advances one cell`,()=>{
 const row='#W'+'o'.repeat(n)+'..g#',w=fixture(['#'.repeat(row.length),row,'#'.repeat(row.length)]),s=initialState(w);
 const p=planPush(w,s,'E');assert.equal(p.stones.length,n);assert.equal(p.valid,true);
 const before=structuredClone(s),next=stepWorld(w,s,4);assert.deepEqual(s,before);
 assert.ok(equal(next.hero,s.stones[0]));assert.deepEqual(next.stones,s.stones.map(p=>offset(p,'E')));
});
for(const n of [1,2,3])test(`wall at tail cancels all ${n} stones`,()=>{
 const row='#W'+'o'.repeat(n)+'#g#',w=fixture(['#'.repeat(row.length),row,'#'.repeat(row.length)]),s=initialState(w),p=planPush(w,s,'E');
 assert.equal(p.valid,false);const next=stepWorld(w,s,4);
 assert.equal(next.failed,true);assert.deepEqual(next.stones,s.stones);assert.deepEqual(next.hero,s.hero);
});
test('a direction turns and pushes immediately, with animation and no destination preview',()=>{
 const w=fixture(['#######','#Wo..g#','#######'],'N'),s=initialState(w),next=stepWorld(w,s,4);
 assert.equal(next.facing,'E');assert.deepEqual(next.hero,s.stones[0]);assert.deepEqual(next.stones,[offset(s.stones[0],'E')]);
 const frames=transitionFrames(w,s,next,4);
 assert.equal(frames.length,3);assert.deepEqual(frames.at(-1),renderWorld(w,next));
 assert.ok(frames.every(f=>!f.flat().includes(1)));
 assert.deepEqual(tile(frames[0],next.stones[0]),[[13,3,3],[13,3,3],[13,3,3]]);
});
for(const [direction,action,rows] of [
 ['N',1,['#######','#.....#','#..o..#','#..W.g#','#######']],
 ['S',2,['#######','#..W.g#','#..o..#','#.....#','#######']],
 ['W',3,['#######','#.....#','#.oW.g#','#.....#','#######']],
 ['E',4,['#######','#.....#','#.Wo.g#','#.....#','#######']],
])test(`directional action ${action} pushes toward ${direction}`,()=>{
 const w=fixture(rows,direction==='N'?'S':'N'),s=initialState(w),next=stepWorld(w,s,action);
 assert.equal(next.facing,direction);assert.deepEqual(next.hero,s.stones[0]);
 assert.deepEqual(next.stones,[offset(s.stones[0],direction)]);assert.equal(next.failed,false);
});
test('warrior cannot enter water',()=>{
 const w=fixture(['######','#W~.g#','######']),s=initialState(w);
 assert.deepEqual(stepWorld(w,s,4).hero,s.hero);
});
test('chain into water sinks only the last stone and creates a permanent support',()=>{
 const w=fixture(['########','#Woo~.g#','########']),s=initialState(w),p=planPush(w,s,'E'),next=stepWorld(w,s,4);
 assert.equal(p.sinks,true);assert.equal(next.stones.length,1);assert.equal(next.supports.length,1);
 assert.deepEqual(next.supports[0],p.to);
 const next2=stepWorld(w,next,4);assert.equal(next2.stones.length,1);assert.equal(next2.supports.length,1);
 assert.deepEqual(next2.stones[0],p.to);
});
test('submerged stone is walkable, not pushable',()=>{
 const w=fixture(['#######','#Wos.g#','#######']),s=initialState(w),next=stepWorld(w,s,4);
 assert.equal(next.stones.length,1);assert.equal(next.supports.length,1);
 const next2=stepWorld(w,next,4);
 assert.ok(equal(next2.hero,s.supports[0]));
 const bare=fixture(['#######','#Ws..g#','#######']),b=initialState(bare),walk=stepWorld(bare,b,4);
 assert.ok(equal(walk.hero,b.supports[0]));assert.deepEqual(stepWorld(bare,walk,4).supports,b.supports);
 assert.deepEqual(walk.supports,b.supports);
});
test('all buttons must be occupied at once, by hero or stone',()=>{
 const w=fixture(['########','#W.b.b.#','#.o..Dg#','########']),s=initialState(w);
 assert.equal(doorsOpen(w,s),false);
 assert.equal(doorsOpen(w,{...s,hero:w.buttons[0],stones:[w.buttons[1]]}),true);
 assert.equal(doorsOpen(w,{...s,hero:w.start,stones:[w.buttons[1]]}),false);
});
test('closed door blocks movement',()=>{
 const w=fixture(['#######','#WDg.b#','#######']),s=initialState(w);
 assert.deepEqual(stepWorld(w,s,4).hero,s.hero);
});
test('moving off last button onto its door is rejected atomically',()=>{
 const w=fixture(['#####','#@Dg#','#####']),s=initialState(w);
 assert.equal(doorsOpen(w,s),true);assert.deepEqual(stepWorld(w,s,4).hero,s.hero);
});
test('pushing from a button cannot close the door on the moved stone',()=>{
 const w=fixture(['#######','#@oD.g#','#######']),s=initialState(w);
 assert.equal(planPush(w,s,'E').valid,false);const next=stepWorld(w,s,4);
 assert.deepEqual(next.hero,s.hero);assert.deepEqual(next.stones,s.stones);
});
test('a pushable stone has no destination preview',()=>{
 const w=fixture(['#######','#Wo..g#','#######']),s=initialState(w),p=planPush(w,s,'E');
 assert.deepEqual(tile(renderWorld(w,s),p.to),[[3,3,3],[3,3,3],[3,3,3]]);
 assert.ok(!renderWorld(w,s).flat().includes(1));
});
test('a blocked push has no preview or animation',()=>{
 const w=fixture(['######','#Wo#g#','######']),s=initialState(w),p=planPush(w,s,'E');
 assert.deepEqual(tile(renderWorld(w,s),p.to),[[4,4,4],[4,4,4],[4,4,4]]);
 const next=stepWorld(w,s,4);assert.equal(next.failed,true);
 const frames=transitionFrames(w,s,next,4);assert.equal(frames.length,1);
 assert.ok(!frames[0].flat().includes(1));
});
test('sunk stone renders a cyan X on brown',()=>{
 const w=fixture(['#######','#Wo~.g#','#######']),s=stepWorld(w,initialState(w),4);
 assert.deepEqual(tile(renderWorld(w,s),s.supports[0]),[[10,13,10],[13,10,13],[10,13,10]]);
});
test('button corners remain visible below a stone',()=>{
 const w=fixture(['#######','#WobDg#','#######']),s=stepWorld(w,initialState(w),4),sprite=tile(renderWorld(w,s),w.buttons[0]);
 assert.equal(sprite[0][0],7);assert.equal(sprite[0][2],7);assert.equal(sprite[2][0],7);assert.equal(sprite[2][2],7);
});
for(const r of source.levels)test(`L${r.level}: retained source grid ${r.transcription}`,()=>{
 const legend={'F':'W','T':'W','W':'W','G':'g','*':'o','{':'b','[':'D'};
 const normalized=r.sourceRows.map(row=>[...row].map(c=>legend[c]??c).join(''));
 assert.deepEqual(SS02_LEVELS[r.level-1].rows,normalized);
});
for(const [index,spec] of SS02_LEVELS.entries())test(`${spec.id}: verified witness and no walking-only solution`,()=>{
 const w=compileLevel(spec),first=initialState(w);let s=first,pushes=0,chain=false;
 assert.equal(reachable(w,first).has(key(w.goal)),false);
 for(const a of witnesses[index].actions){
  assert.ok(a>=1&&a<=4);const p=planPush(w,s,['N','S','W','E'][a-1]);
  if(p){assert.equal(p.valid,true,`invalid witnessed push in ${spec.id}`);pushes++;chain ||= p.stones.length>1;}
  s=stepWorld(w,s,a);assert.equal(s.failed,false);
  const frame=renderWorld(w,s);assert.equal(frame.length,64);assert.ok(frame.every(r=>r.length===64&&r.every(v=>Number.isInteger(v)&&v>=0&&v<=15)));
 }
 assert.equal(s.complete,true);assert.ok(pushes>0);
 if(index===0){assert.equal(chain,true);assert.equal(s.supports.length,1);assert.equal(s.stones.length,2);assert.ok(w.buttons.every(b=>contains(s.stones,b)));assert.ok(reachable(w,first).size>=30);}
});
test('whole campaign completes eight levels, undo reverses victory and progress',()=>{
 const session=new PushPuzzleSession(SS02_LEVELS);let o=session.observe(),before;
 for(let i=0;i<8;i++){
  assert.equal(o.level,i+1);
  for(const a of witnesses[i].actions){before=o;o=session.action(a);assert.deepEqual(o.frames.at(-1),o.frame);assert.equal(o.frames.length,o.frameDurationsMs?.length??1);}
  assert.equal(o.levelsCompleted,i+1);
 }
 assert.equal(o.state,'WIN');let undo=session.undo();assert.equal(undo.state,'NOT_FINISHED');assert.equal(undo.levelsCompleted,7);assert.deepEqual(undo.frame,before.frame);
 assert.equal(session.action(witnesses[7].actions.at(-1)).state,'WIN');
});
test('undo restores movement, direction, chains, sinking and door state',()=>{
 const session=new PushPuzzleSession([SS02_LEVELS[0]]),initial=session.observe();
 for(const a of witnesses[0].actions)session.action(a);
 for(const _ of witnesses[0].actions)session.undo();
 assert.deepEqual(session.observe(),initial);
});
test('reset, restart and level selection preserve public contract',()=>{
 const session=new PushPuzzleSession(SS02_LEVELS);session.action(4);assert.ok(session.observe().canUndo);
 assert.deepEqual(session.reset(),new PushPuzzleSession(SS02_LEVELS).observe());
 assert.equal(session.selectLevel(8).level,8);assert.equal(session.restart().level,1);assert.equal(session.observe().levelsCompleted,0);
});
test('mutating an observation cannot mutate game state',()=>{
 const session=new PushPuzzleSession(SS02_LEVELS),before=structuredClone(session.observe()),o=session.observe();
 o.frame[0][0]=99;o.palette[8]='bad';o.availableActionIds.push(7);assert.deepEqual(session.observe(),before);
});
test('observations contain only public pixels, actions and progress',()=>{
 const o=new PushPuzzleSession(SS02_LEVELS).observe();
 assert.deepEqual(o.availableActionIds,[1,2,3,4]);
 assert.deepEqual(Object.keys(o).sort(),['gameCode','frame','frames','state','availableActionIds','canUndo','canSelectLevel','level','levelCount','levelsCompleted','defaultFps','palette'].sort());
});
for(const a of [-1,0,5,6,7,1.5,NaN])test(`invalid action ${a} is rejected`,()=>{
 const w=compileLevel(SS02_LEVELS[0]);assert.throws(()=>stepWorld(w,initialState(w),a),RangeError);
});
for(const level of [0,9,-1,1.5,NaN])test(`invalid level ${level} is rejected`,()=>assert.throws(()=>new PushPuzzleSession(SS02_LEVELS).selectLevel(level),RangeError));
test('bad maps are rejected',()=>{
 for(const rows of [[],['WWg'],['W?g'],['Wg','..g'],['W'.padEnd(21,'.')+'g']])assert.throws(()=>fixture(rows));
});
test('standalone contains no solver, witness or remote script',()=>{
 const html=readFileSync(new URL('../dist/SS02-demo.html',import.meta.url),'utf8');
 assert.equal(/<script[^>]+src=|fetch\(|XMLHttpRequest|function solve\(|witnesses\.json|sourceRoute/.test(html),false);
 assert.ok(html.includes('<details open id="tutorial"'));
});
