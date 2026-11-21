import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryByRegrasp} from './source-regrasp-delivery.mjs';

test('release and reattach on another side to move a corner object to the opposite corner',()=>{
  const floor=new Set(Array.from({length:9},(_,i)=>[i%3,Math.floor(i/3)].join()));
  const args=[floor,[0,0],[1,0],[[2,0]],[[0,2]]];
  assert.equal(deliveryByRegrasp(...args,{allowRegrasp:false}),null);
  const plan=deliveryByRegrasp(...args,{allowRegrasp:true});
  assert.equal(plan.steps.length,12);
  assert.equal(plan.steps.filter(s=>s.input==='ACTION5').length,4);
  assert.deepEqual(plan.steps.at(-1).object,[0,2]);
  assert.equal(plan.steps.at(-1).held,false);
});
