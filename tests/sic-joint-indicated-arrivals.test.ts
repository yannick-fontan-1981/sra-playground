import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseJointArrival,jointPose,measureJointReturn,newJointMemory,observeJointIndications,type JointContext} from '../src/sic/joint-indicated-arrivals.ts';
import type {XY} from '../src/sic/access-terrain.ts';
import type {VisualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import type {NativeObservation} from '../src/logos-engine/v6-native-types.ts';

const context:JointContext={roles:['brush','parked'],goals:[[12,4],[32,16]],pitch:[4,4],pivot:'turnstile',
  alternate:{actor:'brush',peer:'parked',alternateActor:'resting',alternatePeer:'navigator',ref:'verified-selector'}};
const body=(at:XY,name:string)=>({at,box:[at[0]/2,at[1]/2,at[0]/2,at[1]/2],form:name});
function view(actor:XY,marks:XY[],partner:XY=[28,20]):VisualLayout{
  return {brush:[body(actor,'b')],parked:[body(partner,'p')],turnstile:[body([12,8],'t'),body([32,20],'t')],cue:marks.map(p=>body(p,'c'))};
}
const rows=Array.from({length:16},()=>Array<number>(23).fill(3));
const motors=([{op:'ACTION1',d:[0,-4]},{op:'ACTION2',d:[4,0]},{op:'ACTION3',d:[0,4]},{op:'ACTION4',d:[-4,0]}]) as {op:string;d:XY}[];
const o={available_action_refs:['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5','ACTION6'],entities:[],frame_hash:'public-hash'} as unknown as NativeObservation;
test('the same operation can be proposed after both independently projected destinations are marked',()=>{
  const m=newJointMemory(),before=view([8,12],[]),part=view([8,8],[[32,16]]),both=view([8,8],[[32,16],[12,4]]);
  observeJointIndications(m,context,before,part,'ACTION1','remote-marker');
  assert.equal(m.witnesses.cue?.[0]?.ref,'remote-marker');
  assert.notEqual(chooseJointArrival(m,context,part,o,rows,motors,3,20,500)?.purpose,'test_joint_arrivals');
  const offer=chooseJointArrival(m,context,both,o,rows,motors,3,20,500)!;
  assert.equal(offer.purpose,'test_joint_arrivals');assert.equal(offer.command,'ACTION5');
  assert.deepEqual(offer.displayed,[true,true]);assert.equal(offer.witness,'remote-marker');
  assert.equal(measureJointReturn(m,context,both,offer),'joint_arrival_not_confirmed');
  assert.notEqual(chooseJointArrival(m,context,both,o,rows,motors,3,20,500)?.purpose,'test_joint_arrivals');
});
test('a preparation keeps the other actor and its mechanism fixed; a failed edge is not reused',()=>{
  const m=newJointMemory(),s=view([8,12],[[32,16]]),before=view([12,12],[]);
  observeJointIndications(m,context,before,s,'ACTION4','return');
  const proposal=()=>chooseJointArrival(m,context,s,o,rows,motors,3,30,600);
  const first=proposal()!;assert.equal(first.purpose,'position_for_shared_operation');
  assert.equal(measureJointReturn(m,context,s,first),'joint_preparation_refuted');
  assert.notEqual(proposal()?.key,first.key);
});
test('a changing partner or an ambiguous pairing cannot support a remote indication',()=>{
  const m=newJointMemory(),before=view([8,12],[],[28,24]),after=view([8,8],[[32,16]]);
  observeJointIndications(m,context,before,after,'ACTION1','uncontrolled');
  assert.deepEqual(m.witnesses,{});
  after.turnstile=[body([16,12],'t'),body([16,12],'t')];
  assert.equal(jointPose(after,context),undefined);
});
