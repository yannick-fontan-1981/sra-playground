import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,equal,doorsOpen} from '../dist/core.js';
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
