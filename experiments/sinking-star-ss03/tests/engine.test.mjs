import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel, initialState, stepWorld, planPull, equal, offset, doorsOpen, renderWorld, PullPuzzleSession, PALETTE, GRID} from '../dist/core.js';

const spec = (rows, id = 'fixture') => ({id, title: id, rows});
const fixture = rows => {
  const level = spec(rows), w = compileLevel(level);
  return {level, w, s: initialState(w)};
};
const at = (rows, x, y) => ({x: Math.floor((20 - rows[0].length) / 2) + x, y: Math.floor((20 - rows.length) / 2) + y});
const physical = s => ({hero:s.hero, stones:s.stones, supports:s.supports, complete:s.complete});

test('maps are centered on the shared 20 × 20 grid with exact three-pixel cells', () => {
  const rows=['#######','#T..g.#','#######'];
  const {w}=fixture(rows);
  assert.deepEqual(GRID,{cells:20,cellPx:3,originPx:2,canvasPx:64});
  assert.deepEqual(w.start,at(rows,1,1));
  assert.equal(PALETTE[14],'#50b848');
  assert.equal(w.terrain.length,400);
});

test('level parser accepts T and rejects warrior markers, missing destinations and malformed rectangles', () => {
  for (const rows of [
    ['#####','#W.g#','#####'],
    ['#####','#T..#','#####'],
    ['#####','#TTg#','#####'],
    ['#####','#T.g##','#####'],
    ['#####','#TDg#','#####'],
  ]) assert.throws(()=>compileLevel(spec(rows)));
  assert.throws(()=>compileLevel({...spec(['#####','#T.g#','#####']),facing:'X'}));
});

test('a direction automatically pulls exactly the adjacent rear stone, never a whole file', () => {
  const rows=['########','#ooT..g#','########'];
  const {w,s}=fixture(rows), before=structuredClone(s), plan=planPull(w,s,'E');
  assert.equal(plan.valid,true);
  assert.deepEqual(plan.stones,[at(rows,2,1)]);
  assert.deepEqual(plan.destinations,[s.hero]);
  assert.deepEqual(plan.heroTo,at(rows,4,1));
  const next=stepWorld(w,s,4);
  assert.deepEqual(next.hero,at(rows,4,1));
  assert.deepEqual(next.stones,[at(rows,1,1),at(rows,3,1)]);
  assert.deepEqual(s,before,'pure movement must leave the supplied state unchanged');
});

test('a perpendicular step releases the stone immediately', () => {
  const {w,s}=fixture(['#########','#.......#','#..oT...#','#.......#','#.....g.#','#########']);
  const pulled=stepWorld(w,s,4), side=stepWorld(w,pulled,1);
  assert.equal(planPull(w,pulled,'N'),null);
  assert.deepEqual(side.stones,pulled.stones);
  assert.deepEqual(side.hero,offset(pulled.hero,'N'));
  assert.equal(side.failed,false);
});

test('the Thief cannot push a stone in front of them', () => {
  const {w,s}=fixture(['#######','#To..g#','#######']);
  const next=stepWorld(w,s,4);
  assert.deepEqual(physical(next),physical(s));
  assert.equal(next.facing,'E');
  assert.equal(next.failed,true);
});

for (const [label,row] of [
  ['wall','#oT#..g#'],
  ['stone','#oTo..g#'],
  ['water','#oT~..g#'],
]) test(`blocked forward ${label} cancels both hero movement and rear-stone pull`, () => {
  const {w,s}=fixture(['########',row,'########']);
  const plan=planPull(w,s,'E'), next=stepWorld(w,s,4);
  assert.equal(plan.valid,false);
  assert.deepEqual(physical(next),physical(s));
  assert.equal(next.failed,true);
  assert.deepEqual(next.supports,s.supports);
});

test('existing submerged platforms remain walkable and support a pulled stone without sinking it', () => {
  const rows=['########','#oTs..g#','########'];
  const {w,s}=fixture(rows);
  const onPlatform=stepWorld(w,s,4), stoneOnPlatform=stepWorld(w,onPlatform,4);
  assert.equal(onPlatform.failed,false);
  assert.deepEqual(stoneOnPlatform.stones,[at(rows,3,1)]);
  assert.deepEqual(stoneOnPlatform.supports,s.supports);
  assert.equal(stoneOnPlatform.stones.length,s.stones.length);
});

test('a stone replaces the hero on a pressure button while the hero enters its open door', () => {
  const rows=['#######','#o@D.g#','#######'];
  const {w,s}=fixture(rows);
  assert.equal(doorsOpen(w,s),true);
  const next=stepWorld(w,s,4);
  assert.deepEqual(next.hero,at(rows,3,1));
  assert.deepEqual(next.stones,[at(rows,2,1)]);
  assert.equal(doorsOpen(w,next),true);
  assert.equal(next.failed,false);
});

test('pulling a button stone into its now-closing door is rejected atomically', () => {
  const {w,s}=fixture(['#######','#o@D.g#','#######']);
  const onDoor=stepWorld(w,s,4), next=stepWorld(w,onDoor,4);
  assert.equal(planPull(w,onDoor,'E').valid,false);
  assert.deepEqual(physical(next),physical(onDoor));
  assert.equal(next.failed,true);
  assert.equal(doorsOpen(w,next),true);
});

test('stepping from a pressure button into its door without a replacement weight is rejected', () => {
  const {w,s}=fixture(['#######','#.@D.g#','#######']);
  assert.equal(doorsOpen(w,s),true);
  const next=stepWorld(w,s,4);
  assert.equal(next.failed,true);
  assert.deepEqual(physical(next),physical(s));
});

test('an unoccupied door can close when the hero leaves a button', () => {
  const {w,s}=fixture(['########','#.@..Dg#','########']);
  const next=stepWorld(w,s,4);
  assert.equal(next.failed,false);
  assert.deepEqual(next.hero,offset(s.hero,'E'));
  assert.equal(doorsOpen(w,next),false);
});

test('every pressure button is required; hero and stones both count as weights', () => {
  const {w,s}=fixture(['#########','#o@D.b.g#','#########']);
  assert.equal(doorsOpen(w,s),false);
  const blocked=stepWorld(w,s,4);
  assert.deepEqual(blocked.hero,s.hero);
  const weighted={...s,stones:[...s.stones,w.buttons[1]]};
  assert.equal(doorsOpen(w,weighted),true);
  const crossing=stepWorld(w,weighted,4);
  assert.equal(crossing.failed,false);
  assert.equal(doorsOpen(w,crossing),true);
});

test('reaching a destination completes the map, and further directional moves preserve the completed state', () => {
  const {w,s}=fixture(['######','#oTg.#','######']);
  const next=stepWorld(w,s,4);
  assert.equal(next.complete,true);
  assert.equal(equal(next.hero,w.goal),true);
  assert.equal(stepWorld(w,next,3),next);
  assert.equal(planPull(w,next,'W'),null);
});

test('ACTION5, malformed numbers and non-directional actions are rejected', () => {
  const {w,s}=fixture(['#####','#T.g#','#####']);
  for (const id of [0,5,6,-1,NaN,Infinity,1.5,'4']) assert.throws(()=>stepWorld(w,s,id),RangeError);
});

test('public observations expose pixels and progress, not solver state or solutions', () => {
  const session=new PullPuzzleSession([spec(['#######','#oT..g#','#######'])]);
  const ob=session.observe();
  assert.equal(ob.gameCode,'SS03');
  assert.deepEqual(ob.availableActionIds,[1,2,3,4]);
  assert.equal(ob.level,1);
  assert.equal(ob.canUndo,false);
  assert.equal(ob.frame.length,64);
  assert.ok(ob.frame.every(r=>r.length===64&&r.every(v=>Number.isInteger(v)&&v>=0&&v<16)));
  for (const key of ['hero','stones','supports','world','terrain','witness','solution','plan']) assert.equal(key in ob,false);
  assert.deepEqual(ob.frames.at(-1),ob.frame);
});

test('undo restores the exact public frame and orientation after an animated pull', () => {
  const session=new PullPuzzleSession([spec(['#######','#oT..g#','#######'])]);
  const before=session.observe(), after=session.action(4);
  assert.equal(after.frames.length,3);
  assert.deepEqual(after.frameDurationsMs,[60,80,0]);
  assert.equal(after.canUndo,true);
  assert.deepEqual(session.undo(),before);
});

test('finishing a selected later level returns to the first uncompleted one, and undo reverses that transition', () => {
  const levels=[spec(['#####','#Tg.#','#####'],'one'),spec(['#####','#Tg.#','#####'],'two')];
  const session=new PullPuzzleSession(levels);
  session.selectLevel(2);
  const before=session.observe(), after=session.action(4);
  assert.equal(after.state,'NOT_FINISHED');
  assert.equal(after.levelsCompleted,1);
  assert.equal(after.level,1);
  assert.deepEqual(after.frames.at(-1),after.frame);
  assert.deepEqual(session.undo(),before);
  session.action(4);
  const win=session.action(4);
  assert.equal(win.levelsCompleted,2);
  assert.equal(win.state,'WIN');
});

test('reset affects only the current map; restart clears all progress and loads the tutorial', () => {
  const levels=[spec(['#####','#Tg.#','#####'],'one'),spec(['#####','#Tg.#','#####'],'two')];
  const session=new PullPuzzleSession(levels);
  session.action(4);
  assert.equal(session.observe().level,2);
  const reset=session.reset();
  assert.equal(reset.levelsCompleted,1);
  assert.equal(reset.level,2);
  assert.equal(reset.canUndo,false);
  const restarted=session.restart();
  assert.equal(restarted.level,1);
  assert.equal(restarted.levelsCompleted,0);
  assert.equal(restarted.canUndo,false);
});

test('level selection validates bounds and clears the previous map history', () => {
  const levels=[spec(['######','#T.g.#','######'],'one'),spec(['######','#T.g.#','######'],'two')];
  const session=new PullPuzzleSession(levels);
  session.action(4);
  assert.equal(session.observe().canUndo,true);
  assert.equal(session.selectLevel(2).canUndo,false);
  for (const n of [0,3,-1,1.5,NaN]) assert.throws(()=>session.selectLevel(n),RangeError);
  assert.throws(()=>new PullPuzzleSession([]));
  assert.throws(()=>new PullPuzzleSession([levels[0],levels[0]]));
});

test('the initial frame has the green Thief and no destination prediction', () => {
  const {w,s}=fixture(['#######','#oT..g#','#######']);
  const frame=renderWorld(w,s), values=frame.flat();
  assert.ok(values.includes(14));
  assert.equal(values.includes(8),false);
  assert.equal(values.includes(1),false);
  assert.equal(values.filter(v=>v===13).length,8);
});
