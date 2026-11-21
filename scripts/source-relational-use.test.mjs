import test from 'node:test';
import assert from 'node:assert/strict';
import {relationalUses} from './source-relational-use.mjs';

// An observation at x=1 taught a write at x=2. The prepared site at x=4
// has a new colour and must predict a write at x=5 with its current value.
const before=[[0,2,7,0,0,0,0]],after=[[0,2,2,0,0,0,0]],created=[[0,0,0,0,9,8,0]];
const site={size:[1,1],end:[4,0]},motors=new Map([['ACTION4',new Map([['1,0',[1,0]]])]]);

test('transfer a local relationship to a different palette and receiving site',()=>{
  const uses=relationalUses([{before,after,step:{a:4}}],site,created,[4],motors);
  const moved=uses.find(r=>r.input==='ACTION4' && r.tx===5 && r.ty===0 && r.expected[0]===9);
  assert.ok(moved);
  assert.deepEqual(moved.sourceOffset,[0,0]);
  assert.deepEqual(moved.destinationOffset,[1,0]);
  assert.equal(uses.some(r=>r.expected[0]===2),false);
});

test('rebind an observed click to its operand and abstain for unavailable gestures',()=>{
  const history=[{before,after,step:{a:6,data:{x:1,y:0}}}];
  assert.ok(relationalUses(history,site,created,[6],motors).some(r=>r.input==='ACTION6:4,0' && r.tx===5));
  assert.deepEqual(relationalUses(history,site,created,[4],motors),[]);
  assert.deepEqual(relationalUses(history,site,created,[6],new Map()),[]);
});
