import assert from 'node:assert/strict';
import test from 'node:test';
import {chooseMobileIndication,identifyMobileModels} from '../src/sic/plan-mobile-indication.ts';
import {newIndicatedMemory,type AccessContext,type AccessScene} from '../src/sic/seek-indicated-access.ts';
import type {XY} from '../src/sic/access-terrain.ts';
const xy=(x:number,y:number):XY=>[x*2,y*2];
const ctx:AccessContext={actor:'traveller',parked:'partner',home:xy(1,1),goal:xy(4,6),pitch:[2,2]};
const scene=(p:XY,c:XY,r:XY):AccessScene=>({at:p,form:'pose',visible:{tool:c,hint:r},next:{}});
const ops=['ACTION1','ACTION2','ACTION3','ACTION4','ACTION7'];
const motors=[{op:'ACTION2',d:xy(1,0)},{op:'ACTION3',d:xy(0,-1)},{op:'ACTION4',d:xy(-1,0)},{op:'ACTION1',d:xy(0,1)}];
const rows=Array.from({length:9},()=>Array<number>(10).fill(0));
for(const y of [2,3])for(let x=3;x<=7;x++)rows[y]![x]=1;
rows[5]![4]=1;rows[6]![4]=1;
function memory(){
  const m=newIndicatedMemory();
  m.scenes.a=scene(xy(4,3),xy(3,3),xy(3,4));m.scenes.a.next.ACTION2='b';
  m.scenes.b=scene(xy(5,3),xy(4,3),xy(4,4));
  m.scenes.c=scene(xy(6,3),xy(4,3),xy(4,5));
  for(const s of Object.values(m.scenes))m.sites[s.at.join()]=true;
  m.productions.push({cue:'hint',op:'ACTION2',offset:xy(-2,2),form:'pose',ref:'seen'});
  return m;
}
test('pulling a measured pivot can enable a new projected arrival across an impassable row',()=>{
  const m=memory();
  const models=identifyMobileModels(m,ctx);
  assert.equal(models.length,1);assert.equal(models[0]!.pull,true);assert.equal(models[0]!.push,false);
  const plan=chooseMobileIndication(m,ctx,'a',rows,motors,ops,24,200,1)!;
  assert.ok(plan);assert.equal(plan.motion,'pull');assert.ok(plan.path.some(s=>s.placed.join()!==s.centre.join()));
  assert.ok(plan.path.some(s=>s.command==='ACTION7'));assert.deepEqual(plan.path.at(-1)!.expected,ctx.goal);
  assert.equal(chooseMobileIndication(m,ctx,'a',rows,motors,ops,2,200,1),undefined);
});
test('a remote changed surface is a conditional route only while its measured appearance persists',()=>{
  const m=memory(),late={...ctx,goal:xy(4,7)};
  const changed=rows.map(r=>r.slice());
  changed[5]![4]=0;changed[6]![4]=8;changed[7]![4]=1;
  assert.equal(chooseMobileIndication(m,late,'a',changed,motors,ops,24,600,1),undefined);
  m.preparedGround=[{at:xy(4,6),appearance:'8',ref:'first contact'}];
  const plan=chooseMobileIndication(m,late,'a',changed,motors,ops,24,600,1)!;
  assert.ok(plan.path.some(s=>s.preparedSurface));assert.deepEqual(plan.path.at(-1)!.expected,late.goal);
  changed[6]![4]=0;
  assert.equal(chooseMobileIndication(m,late,'a',changed,motors,ops,24,600,1),undefined);
});
test('a moving indication alone does not establish mobility of its proposed pivot',()=>{
  const m=memory();delete m.scenes.a!.next.ACTION2;
  assert.equal(chooseMobileIndication(m,ctx,'a',rows,motors,ops,24,200,1),undefined);
});
