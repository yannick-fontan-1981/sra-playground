import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState} from '../dist/core.js';
import {solve,stateKey,replay} from '../scripts/solver.mjs';
const spec={id:'search',title:'Search',rows:['#########','#W.~o.g.#','#########']};
test('author search finds a route that the engine replays without invalid moves',()=>{
 const r=solve(spec,{maxStates:1000,maxMs:1000});assert.equal(r.status,'solved');const p=replay(spec,r.actions);assert.ok(p.state.complete);assert.equal(p.metrics.blocked,0);assert.ok(p.metrics.swaps>0);
});
test('disabling swaps exhausts an actually disconnected walking region',()=>{
 const r=solve(spec,{disableSwap:true,maxStates:1000,maxMs:1000});assert.equal(r.status,'unsolvable');assert.ok(r.states>0);
});
test('a state bound is reported as a limit, never as unsolvable',()=>{
 assert.equal(solve(spec,{maxStates:1,maxMs:1000}).status,'limit');
});
test('search keys include moving monsters, permanent water platforms, and gate memory',()=>{
 const s=initialState(compileLevel(spec)),key=stateKey(s);
 assert.notEqual(stateKey({...s,monsters:[{x:1,y:1}]}),key);
 assert.notEqual(stateKey({...s,supports:[{x:2,y:1}]}),key);
 assert.notEqual(stateKey({...s,gateClosed:[true]}),key);
 assert.equal(stateKey({...s,facing:'S',failed:true}),key,'render-only fields do not change directional behavior');
});
