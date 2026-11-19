import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solve} from '../scripts/solver.mjs';

const design=level=>JSON.parse(readFileSync(new URL('../reference/level'+level+'-design.json',import.meta.url),'utf8'));

for(const [name,restriction] of [
  ['reflections',{disableReflections:true}],
  ['the Merchant push',{disableMerchantPushes:true}],
  ['the Bard song',{disableBardSong:true}],
  ['the press',{disablePistons:true}],
  ['building the bridge',{disablePlatforms:true}],
])test('L4 cannot be solved without '+name,()=>{
  const result=solve(design(4).spec,{maxStates:20000,maxMs:10000,...restriction});
  assert.equal(result.status,'unsolvable',JSON.stringify(result));
  assert.equal(result.states,result.expanded,'The queue must be exhausted, not capped');
});
