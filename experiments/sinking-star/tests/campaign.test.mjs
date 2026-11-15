import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileLevel, initialState, stepWorld, renderWorld, cellToPixel, buttonsPressed, mirrorCandidates, SinkingStarSession } from '../dist/core.js';
import { SS01_LEVELS } from '../dist/levels.js';
import { search, walkingCells, ruleKey } from './helpers/search.mjs';
const eq = (a,b) => a.x === b.x && a.y === b.y;
const worlds = SS01_LEVELS.map(compileLevel);
const witnesses = worlds.map(w => search(w));
const replay = (w, actions) => actions.reduce((s,a) => stepWorld(w,s,a), initialState(w));
function tilePixels(frame,p) {
  const q=cellToPixel(p);
  return [0,1,2].map(y=>frame[q.y+y].slice(q.x,q.x+3));
}
function fixture(rows) { return compileLevel({id:'fixture',title:'Fixture',facing:'N',rows}); }
function graph(w) {
  const first=initialState(w), queue=[first], seen=new Map([[ruleKey(first),first]]), reverse=new Map();
  for(let head=0;head<queue.length;head++) for(const a of [1,2,3,4,5]) {
    const next=stepWorld(w,queue[head],a), key=ruleKey(next), previous=ruleKey(queue[head]);
    if(!reverse.has(key)) reverse.set(key,new Set());
    reverse.get(key).add(previous);
    if(!seen.has(key)){seen.set(key,next);queue.push(next);}
    assert.ok(seen.size<10000,'Unexpected state-space explosion, not an impossibility proof.');
  }
  const won=[...seen].filter(([,s])=>s.complete).map(([k])=>k), reachable=new Set(won);
  for(let i=0;i<won.length;i++) for(const key of reverse.get(won[i])??[]) {
    if(!reachable.has(key)){reachable.add(key);won.push(key);}
  }
  return {states:[...seen.values()],solvableStates:reachable.size};
}

for(const [i,w] of worlds.entries()) {
  test(`${w.id}: a replayable shortest witness and no walking-only bypass`,()=>{
    assert.equal(witnesses[i].status,'solved');
    assert.ok(witnesses[i].actions.includes(5));
    assert.equal(replay(w,witnesses[i].actions).complete,true);
    assert.equal(search(w,{actions:[1,2,3,4]}).status,'unsolvable');
  });
  test(`${w.id}: exploration, no soft locks, pure transitions and valid rendering`,()=>{
    const {states,solvableStates}=graph(w);
    assert.equal(solvableStates,states.length,'Every reachable rules-state must still admit a win.');
    for(const s of states) {
      const occupied=[s.hero,...s.rocks];
      assert.equal(new Set(occupied.map(p=>`${p.x},${p.y}`)).size,occupied.length);
      for(const p of occupied) {
        assert.equal(w.tiles[p.y*20+p.x],'.');
        assert.ok(!w.mirrors.some(m=>eq(m,p)));
        assert.ok(p.x>=0&&p.x<20&&p.y>=0&&p.y<20);
      }
      assert.ok(buttonsPressed(w,s)||!w.doors.some(d=>occupied.some(p=>eq(p,d))));
      const frame=renderWorld(w,s);
      assert.equal(frame.length,64);
      assert.ok(frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<=15)));
      assert.deepEqual(frame,renderWorld(w,s));
      for(const a of [1,2,3,4,5]) {
        const before=JSON.stringify(s),next=stepWorld(w,s,a);
        assert.equal(JSON.stringify(s),before);
        assert.deepEqual(next,stepWorld(w,s,a));
        assert.equal(next.rocks.length,w.rocks.length);
      }
    }
  });
}
for(const [i,w] of worlds.slice(0,3).entries()) {
  test(`${w.id}: roomy start with four moves, loops and several reflection distances`,()=>{
    const cells=walkingCells(w),s=initialState(w);
    assert.equal(cells.length,[25,25,24][i]);
    for(const a of [1,2,3,4]) assert.ok(!eq(stepWorld(w,s,a).hero,s.hero));
    const set=new Set(cells.map(p=>`${p.x},${p.y}`));
    const edges=cells.reduce((n,p)=>n+[[1,0],[0,1]].filter(([dx,dy])=>set.has(`${p.x+dx},${p.y+dy}`)).length,0);
    assert.ok(edges>=cells.length,'The starting area must contain loops, not just a wider dead-end.');
    assert.ok(cells.filter(p=>mirrorCandidates(w,{...s,hero:p}).length===1).length>=3);
  });
}
test('new level 1 cannot be won by pressing the power immediately',()=>{
  assert.equal(stepWorld(worlds[0],initialState(worlds[0]),5).complete,false);
  assert.ok(witnesses[0].actions.length>=4);
});
test('new levels 2 and 3 still teach failed water/wall landings',()=>{
  for(const w of [worlds[1],worlds[2]]) {
    const start=initialState(w),next=stepWorld(w,start,5);
    assert.equal(next.failed,true);assert.deepEqual(next.hero,start.hero);
  }
});
for(const i of [4,5,7]) test(`${worlds[i].id}: a stone swap is genuinely necessary`,()=>{
  assert.equal(search(worlds[i],{allow:(s,n)=>JSON.stringify(s.rocks)===JSON.stringify(n.rocks)}).status,'unsolvable');
});
for(const i of [6,7]) test(`${worlds[i].id}: neither mirror can be omitted`,()=>{
  const w=worlds[i];
  for(const removed of w.mirrors) {
    const disabled={...w,mirrors:w.mirrors.filter(m=>m!==removed)};
    assert.equal(search(disabled).status,'unsolvable');
  }
  assert.equal(witnesses[i].actions.filter(a=>a===5).length,2);
});
test('a mirror swaps the stone atomically and the exchange is reversible',()=>{
  const w=worlds[4],actions=witnesses[4].actions,at=actions.indexOf(5),before=replay(w,actions.slice(0,at));
  const after=stepWorld(w,before,5);
  assert.deepEqual(after.hero,before.rocks[0]);assert.deepEqual(after.rocks,[before.hero]);
  assert.deepEqual(stepWorld(w,after,5),before);
});
test('direction keys never push a stone',()=>{
  const w=fixture(['########','#......#','#.Mo.g.#','#..2...#','########']);
  const s=initialState(w),after=stepWorld(w,s,4);
  assert.deepEqual(after.hero,s.hero);assert.deepEqual(after.rocks,s.rocks);assert.equal(after.facing,'E');
});
test('a stone before a mirror source blocks the ray',()=>{
  const w=fixture(['########','#......#','#..2.g.#','#..o...#','#..M...#','########']);
  assert.equal(stepWorld(w,initialState(w),5).failed,true);
});
test('a stone before a target blocks the ray but its own endpoint is exchangeable',()=>{
  const w=fixture(['########','#......#','#..2og.#','#......#','#..M...#','########']);
  const s=initialState(w);
  assert.equal(stepWorld(w,s,5).failed,true);
  assert.equal(stepWorld(w,stepWorld(w,s,1),5).failed,false);
});
test('rendered rays end at a stone instead of visually promising a path through it',()=>{
  const w=fixture(['########','#......#','#..2og.#','#......#','#..M...#','########']);
  const p=w.rocks[0],frame=renderWorld(w,initialState(w));
  const beyond=tilePixels(frame,{x:p.x+2,y:p.y});
  assert.equal(beyond.flat().includes(10),false);
});
test('a button releases immediately when vacated and a rock can keep it pressed',()=>{
  const w=worlds[5],actions=witnesses[5].actions,at=actions.indexOf(5);
  const onButton=replay(w,actions.slice(0,at));
  assert.equal(buttonsPressed(w,onButton),true);
  assert.equal(buttonsPressed(w,stepWorld(w,onButton,3)),false);
  const swapped=stepWorld(w,onButton,5);
  assert.equal(buttonsPressed(w,swapped),true);
  assert.deepEqual(swapped.rocks,w.buttons);
});
test('all buttons form a single AND circuit, without a permanent latch',()=>{
  const w=fixture(['########','#..2...#','#.@.*g.#','#..D...#','########']);
  const s=initialState(w);
  assert.equal(buttonsPressed(w,s),true);
  assert.equal(buttonsPressed(w,{...s,rocks:[]}),false);
  assert.equal(buttonsPressed(w,stepWorld(w,s,1)),false);
});
test('empty button sets do not implicitly open doors',()=>{
  const w=fixture(['########','#..2...#','#.MD.g.#','########']);
  const s=initialState(w);
  assert.equal(buttonsPressed(w,s),false);
  assert.deepEqual(stepWorld(w,s,4).hero,s.hero);
});
test('a closed door blocks a ray as well as walking',()=>{
  const w=fixture(['########','#......#','#..2.Dg#','#......#','#..M.b.#','########']);
  assert.equal(stepWorld(w,initialState(w),5).failed,true);
});
test('walking off the last button into its door is rejected, with facing updated',()=>{
  const w=fixture(['########','#..2...#','#......#','#.@D.g.#','########']);
  const s=initialState(w),next=stepWorld(w,s,4);
  assert.deepEqual(next.hero,s.hero);assert.equal(next.facing,'E');assert.equal(buttonsPressed(w,next),true);
});
test('a swap that would close a door on the Merchant is rejected atomically',()=>{
  const w=fixture(['########','#......#','#..2.Dg#','#......#','#..@...#','########']);
  const s=initialState(w),next=stepWorld(w,s,5);
  assert.equal(next.failed,true);assert.deepEqual(next.hero,s.hero);assert.deepEqual(next.rocks,s.rocks);
});
test('closing a door on a stone is rejected too',()=>{
  const w=fixture(['########','#..2...#','#......#','#.@D.g.#','########']);
  const s={...initialState(w),rocks:[w.doors[0]]},next=stepWorld(w,s,3);
  assert.deepEqual(next.hero,s.hero);assert.deepEqual(next.rocks,s.rocks);
});
test('open/closed door sprites and occupied-button pink corners are visible',()=>{
  const w=worlds[5],s=initialState(w),actions=witnesses[5].actions,at=actions.indexOf(5);
  assert.deepEqual(tilePixels(renderWorld(w,s),w.doors[0]),[[7,7,7],[7,5,7],[7,7,7]]);
  const onButton=replay(w,actions.slice(0,at)),swapped=stepWorld(w,onButton,5);
  assert.equal(tilePixels(renderWorld(w,swapped),w.doors[0])[1][1],3);
  for(const state of [onButton,swapped]){
    const pixels=tilePixels(renderWorld(w,state),w.buttons[0]);
    for(const [x,y] of [[0,0],[0,2],[2,0],[2,2]])assert.equal(pixels[y][x],7);
  }
  assert.equal(tilePixels(renderWorld(w,swapped),w.buttons[0])[1][0],13);
});
test('session: all eight levels, cross-level Undo, WIN, restart, and no score fabrication',()=>{
  const session=new SinkingStarSession(SS01_LEVELS),start=session.observe();
  for(const [i,result] of witnesses.entries()) {
    for(const a of result.actions.slice(0,-1))session.action(a);
    const before=session.observe();session.action(result.actions.at(-1));
    assert.equal(session.observe().levelsCompleted,i+1);
    assert.deepEqual(session.undo(),before);session.action(result.actions.at(-1));
  }
  assert.equal(session.observe().state,'WIN');assert.equal(session.observe().levelCount,8);
  assert.deepEqual(session.restart(),start);
  session.selectLevel(8);for(const a of witnesses[7].actions)session.action(a);
  assert.equal(session.observe().levelsCompleted,1);assert.equal(session.observe().level,1);
});
test('Undo restores stone locations, doors and buttons, not just the Merchant',()=>{
  const session=new SinkingStarSession(SS01_LEVELS);session.selectLevel(6);
  const path=witnesses[5].actions,at=path.indexOf(5);
  for(const a of path.slice(0,at))session.action(a);
  const before=session.observe(),after=session.action(5);
  assert.notDeepEqual(before.frame,after.frame);assert.deepEqual(session.undo(),before);
  assert.deepEqual(session.action(5),after);
});
test('search budget exhaustion is not reported as impossibility',()=>{
  assert.equal(search(worlds[0],{maxStates:1}).status,'budget');
});
test('browser build contains neither an author solver nor witness paths',()=>{
  const html=readFileSync(new URL('../dist/ss01-demo.html',import.meta.url),'utf8');
  assert.ok(!html.includes('function search('));assert.ok(!html.includes('solvableStates'));
  assert.ok(!html.includes('shortestActions'));assert.ok(!html.includes('tests/helpers'));
});
