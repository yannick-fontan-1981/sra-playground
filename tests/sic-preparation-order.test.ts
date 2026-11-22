import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import type {Memory} from '../src/sic/preparation-experiments.ts';
import {createPreparedEffects} from '../src/sic/test-prepared-effects.ts';
import {evidencedPlanGroup,recurrentExperimentGroup} from '../src/sic/experiment-arbitration.ts';

const base={strategy:'motion_contrast',mode:'active',minimumOutcomes:2} as const;
async function picture(x:number,y:number,rev:number) {
  const rows=Array.from({length:20},()=>Array<number>(35).fill(0));
  for(let k=2;k<5;k++)rows[k]!.fill(1,x,x+3);
  for(let k=y;k<y+2;k++)rows[k]!.fill(2,22,26);
  const o=await measureNativeObservation({frame_rows:rows,frame_hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    state:'NOT_FINISHED',level:1,levels_completed:0,available_action_refs:['ACTION1','ACTION2','ACTION3','ACTION4']},rev,'order');
  return {rows,o};
}
const cmd=(action_ref:string)=>({action_ref,data:{}});
test('a witnessed probe is measured after the other preparation order, binding all three original observations',async()=>{
  for(const [shift,A,B] of [[0,'ACTION3','ACTION2'],[2,'ACTION2','ACTION3']] as const) {
    const C='ACTION4';
    const scenes=await Promise.all([[2,8],[5,8],[8,8],[9,8],[2,8],[3,8],[6,8],[6,11]].map(([x,y],i)=>picture(x!+shift,y!,i+1)));
    const [root,first,second,control,back,b,ba,final]=scenes;
    for(const active of [false,true]){
      const family=createPreparedEffects(active?{...base,earlyControl:'compare_preparation_orders'}:base);
      for(const [i,key]of [A,B,C,'ACTION1'].entries()){
        const from=scenes[i]!,to=scenes[i+1]!;
        await family.observePublicOutcome!(from.o,to.o,cmd(key),from.rows,to.rows);
      }
      const offer=(s:typeof back,n:number,group=recurrentExperimentGroup)=>family.proposeInGroup!(group,s!.o,s!.rows,[],n,{});
      assert.ok(!(await offer(back,2))?.preparationOrderForecast);
      assert.ok(!(await offer(back,3,evidencedPlanGroup))?.preparationOrderForecast);
      const firstStep=await offer(back,3);
      if (!active){assert.ok(!firstStep?.preparationOrderForecast);continue;}
      assert.equal(firstStep?.actions[0].action_ref,B);
      assert.deepEqual(firstStep.preparationOrderForecast.evidence,[first!.o.revision,second!.o.revision,control!.o.revision]);
      assert.equal(firstStep.preparationOrderForecast.origin,root!.o.frame_hash);
      let plan=firstStep;
      for(const [i,[from,to,key]]of ([[back,b,B],[b,ba,A],[ba,final,C]] as const).entries()){
        if(i)plan=await offer(from,3-i);
        assert.equal(plan.actions[0].action_ref,key);
        assert.equal(plan.preparationOrderForecast.step,i+1);
        const result=await family.record!(from!.o,to!.o,plan.actions[0],from!.rows,to!.rows,plan);
        if(i<2){assert.equal(result.events[0].result,'order_preparation_observed');continue;}
        const subject=from!.o.entities.find(e=>e.palette_value===2)!;
        assert.equal(result.events[0].result,'preparation_order_changed_the_probe_motion');
        assert.ok(result.events[0].orderMeasurement.gained.includes(subject.signature));
        assert.equal(plan.sicSituationCard.mode,'exploration');
      }
      const stored=family.state!() as Memory;
      assert.equal(Object.keys(stored.orderStudy!.discoveries).length,1);
      assert.equal(stored.orderStudy!.pending,undefined);
      // Record a fresh forward witness with a different probe. The two orders
      // previously changed the red subject's mobility, which makes it relevant again.
      const later=await Promise.all([[2,8],[5,8],[8,8],[10,8],[2,8]].map(([x,y],i)=>picture(x!+shift,y!,9+i)));
      let at=final!;
      for(const [i,key] of ['ACTION1',A,B,'ACTION1','ACTION1'].entries()){
        const to=later[i]!;
        await family.observePublicOutcome!(at.o,to.o,cmd(key),at.rows,to.rows);
        at=to;
      }
      const reuse=await offer(at,3);
      assert.equal(reuse.preparationOrderForecast.probe,'ACTION1');
      assert.deepEqual(reuse.preparationOrderForecast.forward,[A,B]);
      assert.equal(reuse.preparationOrderForecast.relatedEvidence,final!.o.revision);

    }
  }
});

test('an independently played partial reverse order reduces the remaining experimental cost',async()=>{
  const family=createPreparedEffects({...base,earlyControl:'compare_preparation_orders'});
  const scenes=await Promise.all([[2,8],[5,8],[8,8],[9,8],[2,8],[3,8]].map(([x,y],i)=>picture(x!,y!,i+1)));
  for(const [i,key]of ['ACTION3','ACTION2','ACTION4','ACTION1','ACTION2'].entries()){
    const from=scenes[i]!,to=scenes[i+1]!;
    await family.observePublicOutcome!(from.o,to.o,cmd(key),from.rows,to.rows);
  }
  const end=scenes.at(-1)!;
  const cost=(n:number)=>family.proposeInGroup!(recurrentExperimentGroup,end.o,end.rows,[],n,{});
  assert.ok(!(await cost(1))?.preparationOrderForecast);
  const choice=await cost(2);
  assert.equal(choice.actions[0].action_ref,'ACTION3');
  assert.equal(choice.preparationOrderForecast.step,2);
  assert.deepEqual(choice.preparationOrderForecast.reversePrefix,[end.o.revision]);
  const after=await picture(6,8,7);
  await family.record!(end.o,after.o,choice.actions[0],end.rows,after.rows,choice);
  const elsewhere=await picture(12,8,8);
  await family.observePublicOutcome!(after.o,elsewhere.o,cmd('ACTION1'),after.rows,elsewhere.rows);
  assert.equal((family.state!() as Memory).orderStudy?.pending,undefined);
  assert.ok(!((await family.proposeInGroup!(recurrentExperimentGroup,elsewhere.o,elsewhere.rows,[],1,{}))?.preparationOrderForecast));
});
