import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePartnerTest,nextPartnerTest,sitePatch,type PartnerTest} from '../src/sic/test-partner-preparation.ts';
import type {VisualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import type {NativeObservation} from '../src/logos-engine/v6-native-types.ts';
import type {XY} from '../src/sic/access-terrain.ts';

const body=(x:number,y:number,form:string)=>({at:[2*x,2*y] as XY,box:[x,y,x,y],form});
const pitch:XY=[4,4],rows=Array.from({length:8},()=>Array<number>(9).fill(0));
const visible=(a=5):VisualLayout=>({active:[body(1,2,'selected')],peer:[body(a,4,'parked')]});
const switched=(a=5):VisualLayout=>({held:[body(1,2,'parkedB')],preparer:[body(a,4,'selectedA')]});
function observation(l:VisualLayout){
  return {available_action_refs:['ACTION6','ACTION3','ACTION1'],entities:Object.values(l).flat().map(b=>({signature:b.form,bbox:b.box,mask:[[0,0]]}))} as unknown as NativeObservation;
}
const begin=():PartnerTest=>({phase:'select_partner',actor:'active',peer:'peer',origin:[2,4],destination:[6,4],
  initialPartner:[10,8],partnerAt:[10,8],blockedMotor:'ACTION1',prepareMotor:'ACTION3',prepareDelta:[-4,0],
  refusal:'failed-motor',motorRef:'other-controlled',originalPatch:sitePatch(rows,[6,4],pitch)});
test('the same refused input is retested only in the restored control configuration',()=>{
  const s=begin(),a=visible(),b=switched(),p=switched(3),back=visible(3);
  assert.equal(nextPartnerTest(s,a,observation(a),rows,pitch)?.command,'ACTION6:5,4');
  assert.equal(advancePartnerTest(s,a,b,pitch),'partner_selected');
  assert.equal(nextPartnerTest(s,b,observation(b),rows,pitch)?.command,'ACTION3');
  assert.equal(advancePartnerTest(s,b,p,pitch),'partner_preparation_confirmed');
  assert.equal(nextPartnerTest(s,p,observation(p),rows,pitch)?.command,'ACTION6:1,2');
  assert.equal(advancePartnerTest(s,p,back,pitch),'subject_reselected');
  const changed=rows.map(row=>[...row]);changed[2]![3]=7;
  const retry=nextPartnerTest(s,back,observation(back),changed,pitch)!;
  assert.equal(retry.command,'ACTION1');assert.equal(retry.changedSite,true);
  assert.equal(advancePartnerTest(s,back,back,pitch),'still_blocked');
  assert.equal(advancePartnerTest(s,back,{...back,active:[body(3,2,'selected')]},pitch),'released');
});
test('a redraw or a moving partner alone cannot verify the release',()=>{
  const s=begin(),a=visible();assert.equal(advancePartnerTest(s,a,a,pitch),'lost');
  s.phase='retry';
  assert.equal(advancePartnerTest(s,a,{active:[body(3,2,'selected')],peer:[body(3,4,'parked')]},pitch),'lost');
  assert.equal(advancePartnerTest(s,a,{...a,active:[body(3,2,'selected')]},pitch),'still_blocked');
});
