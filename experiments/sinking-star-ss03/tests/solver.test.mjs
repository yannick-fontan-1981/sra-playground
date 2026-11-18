import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,equal,doorsOpen} from '../dist/core.js';
import {reachable,solve} from '../scripts/solver.mjs';

const num=p=>p.y*20+p.x;

test('walking reachability is directed: approaching a crate can make the reverse step pull it',()=>{
  const level={id:'directed',title:'Directed walk',rows:['########','#o.T..g#','########']};
  const w=compileLevel(level),before=initialState(w),approached=stepWorld(w,before,3);
  assert.equal(approached.failed,false);
  assert.deepEqual(approached.stones,before.stones);
  assert.ok(reachable(w,before).has(num(approached.hero)));
  assert.equal(reachable(w,approached).has(num(before.hero)),false);
  const reverse=stepWorld(w,approached,4);
  assert.deepEqual(reverse.hero,before.hero);
  assert.notDeepEqual(reverse.stones,before.stones);
});

test('the solver proves a compulsory button handoff with a playable directional witness',()=>{
  const level={id:'gate-handoff',title:'Gate handoff',rows:[
    '#########',
    '###.....#',
    '#o@D.g..#',
    '####....#',
    '#########',
  ]};
  const found=solve(level,{maxStates:1000,maxMs:1000});
  assert.equal(found.status,'solved');
  const w=compileLevel(level);let s=initialState(w),pulls=0;
  for(const action of found.actions){
    assert.equal(s.complete,false,'the witness must stop at its first completed state');
    const next=stepWorld(w,s,action);
    assert.equal(next.failed,false);
    assert.equal(equal(next.hero,s.hero),false,'no manufactured or blocked steps');
    if(!next.stones.every(p=>s.stones.some(q=>equal(p,q))))pulls++;
    s=next;
  }
  assert.equal(s.complete,true);
  assert.equal(pulls,1);
  assert.equal(doorsOpen(w,s),true);
  assert.equal(solve(level,{disablePull:true,maxStates:1000,maxMs:1000}).status,'unsolvable');
  assert.equal(solve(level,{lockDoors:true,maxStates:1000,maxMs:1000}).status,'unsolvable');
});

test('complete-state piston search retains a latched door when the hero returns to the identical square',()=>{
  const level={id:'latch',title:'Gate memory',rows:['#########','###.#####','#T....Dg#','#########'],
    circuits:[{id:'a',buttons:[{x:3,y:1}]}],gates:[
      {at:{x:3,y:1},circuit:'a',direction:'S',closedWhen:'pressed'},
      {at:{x:6,y:2},circuit:'a',direction:'E',closedWhen:'released'},
    ]};
  const w=compileLevel(level),first=initialState(w);
  assert.throws(()=>reachable(w,first),/only valid for levels without piston circuits/);
  const before=stepWorld(w,stepWorld(w,first,4),4),latched=stepWorld(w,before,1);
  assert.deepEqual(latched.hero,before.hero,'the upward move is pushed straight back');
  assert.deepEqual(latched.stones,before.stones);
  assert.deepEqual(latched.supports,before.supports);
  assert.deepEqual(before.gateClosed,[false,true]);
  assert.deepEqual(latched.gateClosed,[true,false],'the gate itself now holds its button');
  const found=solve(level,{maxStates:200,maxMs:1000});
  assert.equal(found.status,'solved');assert.equal(found.pistonPushes,1);
  let state=first;
  for(const action of found.actions){state=stepWorld(w,state,action);assert.ok(!state.failed&&!state.dead);}
  assert.equal(state.complete,true);
  assert.equal(solve(level,{disablePistons:true,maxStates:200,maxMs:1000}).status,'unsolvable');
  assert.equal(solve(level,{maxStates:1,maxMs:1000}).status,'limit');
  assert.equal(solve(level,{maxStates:200,maxMs:0}).status,'limit');
});

test('piston search finds a necessary pull followed by a forced file push and honors both ablations',()=>{
  const level={id:'pull-piston',title:'Pull then push',rows:['#########','#.....###','#oT...Dg#','#########'],
    circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[
      {at:{x:2,y:2},circuit:'a',direction:'E',closedWhen:'pressed'},
      {at:{x:6,y:2},circuit:'a',direction:'E',closedWhen:'released'},
    ]};
  const options={maxStates:500,maxMs:1000},found=solve(level,options);
  assert.equal(found.status,'solved');
  const w=compileLevel(level);let state=initialState(w),pulls=0,pistons=0;
  for(const action of found.actions){
    const detail=stepDetailed(w,state,action);state=detail.state;
    assert.ok(!state.failed&&!state.dead);
    pulls+=detail.phases.filter(p=>p.kind==='pull').length;
    pistons+=detail.phases.filter(p=>p.kind==='piston').length;
  }
  assert.ok(state.complete&&pulls>=1&&pistons>=1);
  assert.equal(solve(level,{...options,disablePull:true}).status,'unsolvable');
  assert.equal(solve(level,{...options,disablePistons:true}).status,'unsolvable');
});
