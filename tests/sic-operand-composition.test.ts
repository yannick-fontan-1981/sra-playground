import assert from 'node:assert/strict';
import test from 'node:test';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {learnOperands,newOperandMemory,operandMatches,operandPlan} from '../src/sic/operand-composition.ts';
import {createCompositionTrials,exhaustedGroup} from '../src/sic/test-observed-compositions.ts';
import {v6Canonical} from '../src/logos-engine/v6-native-observer.ts';

type Mark=readonly [number,number,number];
function board(marks:readonly Mark[]){
  const rows=Array.from({length:12},()=>Array<number>(20).fill(0));
  for(const [x,y,v] of marks){rows[y]![x]=v;rows[y+1]![x]=v;}
  return rows;
}
async function observe(rows:number[][],revision:number){
  return measureNativeObservation({frame_rows:rows,frame_hash:await publicFrameHash(rows),level:1,levels_completed:0,
    state:'NOT_FINISHED',available_action_refs:['ACTION1','ACTION4','ACTION6']},revision,'operand-test');
}
test('a retained local consequence can be requested on a new point and verified at both locations',async()=>{
  const a=board([[3,3,2],[11,3,2]]),b=board([[3,3,7],[11,3,2]]),c=board([[3,3,7],[11,3,2],[16,8,4]]);
  const [oa,ob,oc]=await Promise.all([observe(a,0),observe(b,1),observe(c,2)]),m=newOperandMemory();
  learnOperands(m,oa!,ob!,a,b,'ACTION6:3,4');
  assert.equal(operandPlan(m,ob!,b,3),undefined);
  learnOperands(m,ob!,oc!,b,c,'ACTION1');
  const p=operandPlan(structuredClone(m),oc!,c,3);assert.ok(p);
  assert.deepEqual(p.steps,[{input:'ACTION6:11,4'}]);assert.ok(p.sourceRefs.includes(ob!.observation_ref));
  const good=board([[3,3,7],[11,3,7],[16,8,4]]),lost=board([[3,3,2],[11,3,7],[16,8,4]]);
  assert.equal(operandMatches(p,await observe(good,3),good),true);
  assert.equal(operandMatches(p,await observe(lost,3),lost),false);
  learnOperands(m,oc!,await observe(lost,3),c,lost,'ACTION6:11,4');
  assert.equal(operandPlan(m,await observe(lost,3),lost,3),undefined);
});
test('a measured movement can bind the same local operation to a second site',async()=>{
  const a=board([[1,4,3],[6,4,2],[10,4,2]]),b=board([[5,4,3],[6,4,7],[10,4,2]]);
  const c=board([[5,4,3],[6,4,7],[10,4,2],[16,8,4]]);
  const [oa,ob,oc]=await Promise.all([observe(a,0),observe(b,1),observe(c,2)]),m=newOperandMemory();
  learnOperands(m,oa!,ob!,a,b,'ACTION4');learnOperands(m,ob!,oc!,b,c,'ACTION1');
  const p=operandPlan(m,oc!,c,3);assert.ok(p?.actor);assert.deepEqual(p.steps,[{input:'ACTION4'}]);
  const applied=board([[9,4,3],[6,4,7],[10,4,7],[16,8,4]]);
  assert.ok(operandMatches(p,await observe(applied,3),applied));
});
test('the composition contract declares the preserved site and its current public evidence',async()=>{
  const a=board([[3,3,2],[11,3,2]]),b=board([[3,3,7],[11,3,2]]),c=board([[3,3,7],[11,3,2],[16,8,4]]);
  const [oa,ob,oc]=await Promise.all([observe(a,0),observe(b,1),observe(c,2)]),family=createCompositionTrials();
  await family.observePublicOutcome!(oa!,ob!,{action_ref:'ACTION6',data:{x:3,y:4}},a,b);
  await family.observePublicOutcome!(ob!,oc!,{action_ref:'ACTION1',data:{}},b,c);
  const plan=await family.proposeInGroup!(exhaustedGroup,oc!,c,[],5);assert.ok(plan?.operand);
  assert.deepEqual(plan.actions,[{action_ref:'ACTION6',data:{x:11,y:4}}]);
  const bundle=plan.bundle_template,ref=bundle.preserve_refs[0];
  assert.equal(bundle.preserve_refs.length,1);
  assert.ok(plan.compositions.some(c=>c.id===ref&&c.observed));
  assert.equal(bundle.preservation_evidence[ref].observation_ref,oc!.observation_ref);
  assert.deepEqual(bundle.preservation_evidence[ref].witness_refs,[ob!.observation_ref,oc!.observation_ref]);
  assert.doesNotThrow(()=>v6Canonical(plan.operandForecast));
  assert.doesNotThrow(()=>v6Canonical(plan));
  assert.doesNotThrow(()=>v6Canonical(family.state!()));
});
